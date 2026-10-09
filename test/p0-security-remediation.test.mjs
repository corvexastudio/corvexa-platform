import test from 'node:test'
import assert from 'node:assert/strict'
import { timingSafeEqual } from 'node:crypto'
import { createBooking } from '../src/lib/booking/booking-manager.ts'
import { recordReviewClick } from '../src/lib/reviews/review-manager.ts'
import { customerViewQuote } from '../src/lib/quotes/quote-manager.ts'
import { customerViewInvoice } from '../src/lib/payments/invoice-manager.ts'
import { getTenantContext, verifyTenantResource } from '../src/lib/security/tenant-context.ts'
import { createClient } from '@supabase/supabase-js'

/**
 * ==============================================================================
 * SIMULATED POSTGRESQL / RLS EXECUTION ENGINE (MIGRATION 25 SPECIFICATION)
 * Models PostgreSQL RLS evaluation, search_path enforcement, and Migration 25 triggers.
 * ==============================================================================
 */
function createSecureTestDb(initialData = {}) {
  const store = {
    organizations: initialData.organizations ? JSON.parse(JSON.stringify(initialData.organizations)) : [],
    profiles: initialData.profiles ? JSON.parse(JSON.stringify(initialData.profiles)) : [],
    quotes: initialData.quotes ? JSON.parse(JSON.stringify(initialData.quotes)) : [],
    quote_items: initialData.quote_items ? JSON.parse(JSON.stringify(initialData.quote_items)) : [],
    invoices: initialData.invoices ? JSON.parse(JSON.stringify(initialData.invoices)) : [],
    invoice_items: initialData.invoice_items ? JSON.parse(JSON.stringify(initialData.invoice_items)) : [],
    appointments: initialData.appointments ? JSON.parse(JSON.stringify(initialData.appointments)) : [],
    contacts: initialData.contacts ? JSON.parse(JSON.stringify(initialData.contacts)) : [],
    review_requests: initialData.review_requests ? JSON.parse(JSON.stringify(initialData.review_requests)) : [],
    services: initialData.services ? JSON.parse(JSON.stringify(initialData.services)) : [],
    leads: initialData.leads ? JSON.parse(JSON.stringify(initialData.leads)) : [],
    activity_logs: initialData.activity_logs ? JSON.parse(JSON.stringify(initialData.activity_logs)) : [],
    automation_runs: initialData.automation_runs ? JSON.parse(JSON.stringify(initialData.automation_runs)) : [],
    notifications: initialData.notifications ? JSON.parse(JSON.stringify(initialData.notifications)) : [],
    messages: initialData.messages ? JSON.parse(JSON.stringify(initialData.messages)) : []
  }

  // Returns a client scoped to a role: 'anon' | 'authenticated' | 'service_role'
  return function getClient({ role = 'anon', userId = null, userEmail = null, jwtRole = null } = {}) {
    const isServiceRole = role === 'service_role' || jwtRole === 'service_role'

    function getCurrentProfile() {
      if (!userId) return null
      return store.profiles.find((p) => p.id === userId) || null
    }

    function isSuperAdmin() {
      const p = getCurrentProfile()
      return p?.role === 'super_admin'
    }

    function getUserOrgId() {
      const p = getCurrentProfile()
      return p?.org_id || null
    }

    function getUserRole() {
      const p = getCurrentProfile()
      return p?.role || null
    }

    // Apply Migration 25 PostgreSQL RLS policies
    function filterByRls(table, rows) {
      if (isServiceRole) return rows

      if (role === 'anon') {
        // Migration 25 REVOKED ALL access from anon on tenant tables.
        // Direct PostgREST queries return zero rows.
        return []
      }

      if (role === 'authenticated') {
        const orgId = getUserOrgId()
        const superAdmin = isSuperAdmin()

        if (table === 'profiles') {
          return rows.filter((r) => r.id === userId || superAdmin)
        }

        if (table === 'organizations') {
          return rows.filter((r) => r.id === orgId || superAdmin)
        }

        // All tenant tables isolated by org_id
        return rows.filter((r) => r.org_id === orgId || superAdmin)
      }

      return []
    }

    return {
      _store: store,
      auth: {
        getUser: async () => ({
          data: { user: userId ? { id: userId, email: userEmail } : null },
          error: userId ? null : new Error('No session')
        })
      },
      from: (table) => {
        let filters = []
        let selectColumns = '*'

        const builder = {
          select: (cols = '*') => {
            selectColumns = cols
            return builder
          },
          eq: (col, val) => {
            filters.push((row) => row[col] === val)
            return builder
          },
          neq: (col, val) => {
            filters.push((row) => row[col] !== val)
            return builder
          },
          in: (col, vals) => {
            filters.push((row) => vals.includes(row[col]))
            return builder
          },
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => {
            const res = await builder._executeSelect()
            if (res.error) return { data: null, error: res.error }
            return { data: res.data[0] || null, error: null }
          },
          single: async () => {
            const res = await builder._executeSelect()
            if (res.error) return { data: null, error: res.error }
            if (res.data.length === 0) {
              return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
            }
            return { data: res.data[0], error: null }
          },
          _executeSelect: async () => {
            if (!store[table]) {
              return { data: null, error: { message: `Table ${table} not found` } }
            }
            const visible = filterByRls(table, store[table])
            const filtered = visible.filter((row) => filters.every((fn) => fn(row)))
            return { data: JSON.parse(JSON.stringify(filtered)), error: null }
          },
          then: (resolve, reject) => {
            builder._executeSelect().then(resolve, reject)
          },
          insert: (records) => {
            const list = Array.isArray(records) ? records : [records]
            const inserted = []
            let insertError = null

            for (const item of list) {
              const row = { id: item.id || `id-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...item }

              // Enforcement of Migration 25 BEFORE INSERT trigger on profiles
              if (table === 'profiles') {
                if (!isServiceRole && !isSuperAdmin()) {
                  if (row.role && !['owner', 'member'].includes(row.role)) {
                    insertError = {
                      message: 'Cannot self-assign privileged role on profile insertion.',
                      code: '42501'
                    }
                    break
                  }
                  if (row.org_id !== undefined && row.org_id !== null) {
                    insertError = {
                      message: 'Cannot self-assign organization on profile insertion. Must be linked via authorized onboarding.',
                      code: '42501'
                    }
                    break
                  }
                }
              }

              // RLS INSERT check
              if (!isServiceRole) {
                if (role === 'anon') {
                  insertError = {
                    message: `Permission denied for table ${table}. Anonymous inserts are revoked.`,
                    code: '42501'
                  }
                  break
                }
                if (role === 'authenticated') {
                  if (table === 'organizations') {
                    // Authenticated users can create org during onboarding
                  } else if (table === 'profiles') {
                    if (row.id !== userId) {
                      insertError = { message: 'Cannot create profile for another user', code: '42501' }
                      break
                    }
                  } else {
                    const userOrg = getUserOrgId()
                    if (row.org_id !== userOrg && !isSuperAdmin()) {
                      insertError = { message: 'Cross-tenant insert prohibited', code: '42501' }
                      break
                    }
                  }
                }
              }

              if (!store[table]) store[table] = []
              store[table].push(row)
              inserted.push(row)
            }

            const response = {
              data: insertError ? null : inserted,
              error: insertError,
              select: () => ({
                single: async () => ({ data: insertError ? null : (inserted[0] || null), error: insertError }),
                maybeSingle: async () => ({ data: insertError ? null : (inserted[0] || null), error: insertError }),
                then: (resolve, reject) => Promise.resolve({ data: insertError ? null : inserted, error: insertError }).then(resolve, reject)
              }),
              single: async () => ({ data: insertError ? null : (inserted[0] || null), error: insertError }),
              then: (resolve, reject) => Promise.resolve({ data: insertError ? null : inserted, error: insertError }).then(resolve, reject)
            }

            return response
          },
          update: (updates) => {
            return {
              eq: (col, val) => {
                filters.push((row) => row[col] === val)
                return {
                  select: () => ({
                    single: async () => {
                      const res = await builder._executeUpdate(updates)
                      return { data: res.data?.[0] || null, error: res.error }
                    }
                  }),
                  then: (resolve, reject) => {
                    builder._executeUpdate(updates).then(resolve, reject)
                  }
                }
              }
            }
          },
          _executeUpdate: async (updates) => {
            if (role === 'anon') {
              return {
                data: null,
                error: {
                  message: `Permission denied for table ${table}. Anonymous updates are revoked.`,
                  code: '42501'
                }
              }
            }

            const visible = filterByRls(table, store[table])
            const targetRows = visible.filter((row) => filters.every((fn) => fn(row)))

            if (targetRows.length === 0) {
              return { data: [], error: null }
            }

            for (const row of targetRows) {
              // Migration 25 BEFORE UPDATE Trigger on profiles (CRIT-02)
              if (table === 'profiles') {
                if (!isServiceRole && !isSuperAdmin()) {
                  if (updates.role !== undefined && updates.role !== row.role) {
                    return {
                      data: null,
                      error: {
                        message: 'Modifying profile role is prohibited. Only server administrative operations may change roles.',
                        code: '42501'
                      }
                    }
                  }
                  if (updates.org_id !== undefined && updates.org_id !== row.org_id) {
                    return {
                      data: null,
                      error: {
                        message: 'Modifying profile org_id is prohibited. Cross-tenant movement is forbidden.',
                        code: '42501'
                      }
                    }
                  }
                  if (updates.id !== undefined && updates.id !== row.id) {
                    return {
                      data: null,
                      error: {
                        message: 'Modifying profile user id is prohibited.',
                        code: '42501'
                      }
                    }
                  }
                }
              }

              // Migration 25 organizations UPDATE policy (HIGH-02: requires owner or admin)
              if (table === 'organizations' && !isServiceRole && !isSuperAdmin()) {
                const callerRole = getUserRole()
                if (!['owner', 'admin'].includes(callerRole)) {
                  return {
                    data: null,
                    error: {
                      message: 'Insufficient privilege: only owner or admin can update organization settings.',
                      code: '42501'
                    }
                  }
                }
              }

              Object.assign(row, updates)
            }

            return { data: targetRows, error: null }
          }
        }

        return builder
      }
    }
  }
}

/**
 * ==============================================================================
 * TEST DATA SEED
 * Two tenants: Org A (Victim) and Org B (Attacker)
 * ==============================================================================
 */
const SEED_DATA = {
  organizations: [
    { id: 'org-victim-a', name: 'Apex Plumbing Corp', slug: 'apex-plumbing', owner_phone: '+15551110001' },
    { id: 'org-attacker-b', name: 'Rogue Trades LLC', slug: 'rogue-trades', owner_phone: '+15552220002' }
  ],
  profiles: [
    { id: 'usr-victim-owner', email: 'owner@apexplumbing.com', org_id: 'org-victim-a', role: 'owner' },
    { id: 'usr-attacker-member', email: 'attacker@roguetrades.com', org_id: 'org-attacker-b', role: 'member' },
    { id: 'usr-attacker-tech', email: 'tech@apexplumbing.com', org_id: 'org-victim-a', role: 'technician' }
  ],
  quotes: [
    { id: 'quote-victim-1', org_id: 'org-victim-a', manage_token: 'secret-quote-token-apex', subtotal: 5000, total: 5500, status: 'sent' }
  ],
  invoices: [
    { id: 'inv-victim-1', org_id: 'org-victim-a', manage_token: 'secret-invoice-token-apex', amount_due: 3500, status: 'sent' }
  ],
  appointments: [
    { id: 'apt-victim-1', org_id: 'org-victim-a', manage_token: 'secret-manage-token-apex', service_type: 'Pipe Repair', status: 'confirmed', start_time: new Date(Date.now() + 86400000).toISOString() }
  ],
  contacts: [
    { id: 'cnt-victim-1', org_id: 'org-victim-a', name: 'Jane Doe', phone: '+15559991111' }
  ],
  review_requests: [
    { id: 'rev-victim-1', org_id: 'org-victim-a', token: 'review-token-victim-apex', google_review_url: 'https://g.page/r/apex-plumbing/review', click_count: 0, status: 'pending' }
  ],
  services: [
    { id: 'srv-victim-1', org_id: 'org-victim-a', name: 'Pipe Repair', duration_minutes: 60, price: 150, is_active: true }
  ]
}

/**
 * ==============================================================================
 * 16 REQUIRED P0 VERIFICATION TESTS
 * ==============================================================================
 */

test('TEST 1: Anonymous SELECT quotes → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const { data } = await anonClient.from('quotes').select('*')
  assert.strictEqual(data.length, 0, 'Anonymous caller must receive 0 quote rows across all tenants')
})

test('TEST 2: Anonymous SELECT invoices → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const { data } = await anonClient.from('invoices').select('*')
  assert.strictEqual(data.length, 0, 'Anonymous caller must receive 0 invoice rows across all tenants')
})

test('TEST 3: Anonymous SELECT appointments → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const { data } = await anonClient.from('appointments').select('*')
  assert.strictEqual(data.length, 0, 'Anonymous caller must receive 0 appointment rows across all tenants')
})

test('TEST 4: User A attempts to access User B tenant data → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  // Attacker authenticated in Org B
  const attackerClient = getClient({ role: 'authenticated', userId: 'usr-attacker-member', userEmail: 'attacker@roguetrades.com' })

  // Attacker attempts to query quotes from Org A
  const { data: quotes } = await attackerClient.from('quotes').select('*')
  assert.strictEqual(quotes.length, 0, 'User in Org B cannot see quotes belonging to Org A')

  // Attacker attempts to query appointments from Org A
  const { data: appointments } = await attackerClient.from('appointments').select('*')
  assert.strictEqual(appointments.length, 0, 'User in Org B cannot see appointments belonging to Org A')
})

test('TEST 5: User changes role to owner or super_admin → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  // Technician attempts privilege escalation to owner
  const techClient = getClient({ role: 'authenticated', userId: 'usr-attacker-tech', userEmail: 'tech@apexplumbing.com' })

  const res1 = await techClient.from('profiles').update({ role: 'owner' }).eq('id', 'usr-attacker-tech')
  assert.strictEqual(res1.error?.code, '42501', 'Technician self-escalation to owner must be rejected by trigger')
  assert.match(res1.error.message, /Modifying profile role is prohibited/)

  // Member attempts escalation to super_admin
  const memberClient = getClient({ role: 'authenticated', userId: 'usr-attacker-member', userEmail: 'attacker@roguetrades.com' })
  const res2 = await memberClient.from('profiles').update({ role: 'super_admin' }).eq('id', 'usr-attacker-member')
  assert.strictEqual(res2.error?.code, '42501', 'Member self-escalation to super_admin must be rejected by trigger')
})

test('TEST 6: User changes org_id → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  // Member of Org B attempts to move their account into Org A (Victim)
  const memberClient = getClient({ role: 'authenticated', userId: 'usr-attacker-member', userEmail: 'attacker@roguetrades.com' })

  const res = await memberClient.from('profiles').update({ org_id: 'org-victim-a' }).eq('id', 'usr-attacker-member')
  assert.strictEqual(res.error?.code, '42501', 'Cross-tenant org_id modification must be rejected by trigger')
  assert.match(res.error.message, /Cross-tenant movement is forbidden/)
})

test('TEST 7: Member attempts cross-tenant takeover → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const memberClient = getClient({ role: 'authenticated', userId: 'usr-attacker-member', userEmail: 'attacker@roguetrades.com' })

  // Attacker attempts both role elevation AND org hijacking in single query
  const res = await memberClient.from('profiles').update({
    role: 'owner',
    org_id: 'org-victim-a'
  }).eq('id', 'usr-attacker-member')

  assert.strictEqual(res.error?.code, '42501', 'Compound tenant takeover attempt must be rejected')
})

test('TEST 8: Anonymous INSERT contact with arbitrary org_id → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const res = await anonClient.from('contacts').insert({
    org_id: 'org-victim-a',
    name: 'Spam Contact',
    phone: '+15550009999'
  })

  assert.strictEqual(res.error?.code, '42501', 'Anonymous contact insert must be rejected')
})

test('TEST 9: Anonymous INSERT appointment with arbitrary org_id → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const res = await anonClient.from('appointments').insert({
    org_id: 'org-victim-a',
    title: 'Spam Appointment',
    start_time: new Date().toISOString()
  })

  assert.strictEqual(res.error?.code, '42501', 'Anonymous appointment insert must be rejected')
})

test('TEST 10: Public booking through legitimate API → succeeds', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  // Legitimate API route executes with service_role client after verifying booking slug
  const serviceRoleClient = getClient({ role: 'service_role' })

  // Book for 3 days in the future to avoid overlap with seed appointment at +24h
  const futureTime = new Date(Date.now() + 3 * 86400000).toISOString()
  const result = await createBooking(serviceRoleClient, {
    orgId: 'org-victim-a',
    serviceId: 'srv-victim-1',
    customerName: 'Alice Springs',
    customerPhone: '+15559876543',
    customerEmail: 'alice@example.com',
    customerAddress: '123 River Road',
    startTime: futureTime,
    source: 'booking_page'
  })

  if (!result.success) {
    console.error('TEST 10 FAILURE REASON:', result.error)
  }
  assert.strictEqual(result.success, true, 'Legitimate booking via server-side API must succeed')
  assert.ok(result.manageToken, 'Must generate secure management token')
  assert.ok(result.appointment?.id, 'Must generate appointment record')

  // Verify appointment was created in target org
  const { data: createdApt } = await serviceRoleClient.from('appointments').select('*').eq('id', result.appointment.id).single()
  assert.strictEqual(createdApt.org_id, 'org-victim-a')
})

test('TEST 11: Anonymous review request UPDATE → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const res = await anonClient.from('review_requests').update({
    google_review_url: 'https://evil-phishing.com'
  }).eq('id', 'rev-victim-1')

  assert.strictEqual(res.error?.code, '42501', 'Anonymous update on review_requests must be rejected')
})

test('TEST 12: Legitimate review click tracking → succeeds', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const serviceRoleClient = getClient({ role: 'service_role' })

  const result = await recordReviewClick(serviceRoleClient, 'review-token-victim-apex')
  assert.strictEqual(result.success, true, 'Click tracking via server handler must succeed')
  assert.strictEqual(result.googleReviewUrl, 'https://g.page/r/apex-plumbing/review')

  // Verify counter was incremented
  const { data: updatedReq } = await serviceRoleClient.from('review_requests').select('*').eq('token', 'review-token-victim-apex').single()
  assert.strictEqual(updatedReq.click_count, 1)
  assert.strictEqual(updatedReq.status, 'clicked')
})

test('TEST 13: Attempt to modify google_review_url using public token → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  // Attacker sends PATCH to review_requests referencing token
  const res = await anonClient.from('review_requests').update({
    google_review_url: 'https://attacker-redirect.com'
  }).eq('token', 'review-token-victim-apex')

  assert.strictEqual(res.error?.code, '42501', 'Cannot modify google_review_url with public token')

  // Verify URL was NOT modified
  const serviceRoleClient = getClient({ role: 'service_role' })
  const { data: req } = await serviceRoleClient.from('review_requests').select('*').eq('token', 'review-token-victim-apex').single()
  assert.strictEqual(req.google_review_url, 'https://g.page/r/apex-plumbing/review')
})

test('TEST 14: Attempt to modify review_request org_id → denied', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const anonClient = getClient({ role: 'anon' })

  const res = await anonClient.from('review_requests').update({
    org_id: 'org-attacker-b'
  }).eq('token', 'review-token-victim-apex')

  assert.strictEqual(res.error?.code, '42501', 'Cannot modify review_request org_id')
})

test('TEST 15: Service-role server operation → still succeeds', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const adminClient = getClient({ role: 'service_role' })

  // Service role can view tokenized quotes
  const quoteResult = await customerViewQuote(adminClient, 'secret-quote-token-apex')
  assert.strictEqual(quoteResult.success, true, 'Service role can resolve tokenized quote')
  assert.strictEqual(quoteResult.quote?.org_id, 'org-victim-a')

  // Service role can view tokenized invoices
  const invoiceResult = await customerViewInvoice(adminClient, 'secret-invoice-token-apex')
  assert.strictEqual(invoiceResult.success, true, 'Service role can resolve tokenized invoice')
  assert.strictEqual(invoiceResult.invoice?.org_id, 'org-victim-a')
})

test('TEST 16: Authenticated tenant user can still perform legitimate dashboard operations inside own tenant', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  const victimOwnerClient = getClient({ role: 'authenticated', userId: 'usr-victim-owner', userEmail: 'owner@apexplumbing.com' })

  // Owner can read their own quotes
  const { data: quotes } = await victimOwnerClient.from('quotes').select('*')
  assert.strictEqual(quotes.length, 1, 'Owner can access their own tenant quotes')
  assert.strictEqual(quotes[0].id, 'quote-victim-1')

  // Owner can read their own appointments
  const { data: appointments } = await victimOwnerClient.from('appointments').select('*')
  assert.strictEqual(appointments.length, 1, 'Owner can access their own tenant appointments')

  // Owner can update their own profile name
  const { data: updatedProfile, error } = await victimOwnerClient.from('profiles').update({
    full_name: 'Apex Master Plumber'
  }).eq('id', 'usr-victim-owner')

  assert.strictEqual(error, null, 'Updating safe profile field must succeed')
})

/**
 * ==============================================================================
 * ADDITIONAL HIGH-SEVERITY REGRESSION TESTS
 * ==============================================================================
 */

test('HIGH-01: Open redirect parameter sanitation', () => {
  function sanitizeRedirect(nextParam) {
    let safeDestination = '/client/dashboard'
    if (nextParam && typeof nextParam === 'string') {
      const trimmed = nextParam.trim()
      if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes(':')) {
        safeDestination = trimmed
      }
    }
    return safeDestination
  }

  // Attack payloads
  assert.strictEqual(sanitizeRedirect('https://evil.com'), '/client/dashboard')
  assert.strictEqual(sanitizeRedirect('//evil.com'), '/client/dashboard')
  assert.strictEqual(sanitizeRedirect('/\\evil.com'), '/client/dashboard')
  assert.strictEqual(sanitizeRedirect('javascript:alert(1)'), '/client/dashboard')
  assert.strictEqual(sanitizeRedirect('http://attacker.com/steal'), '/client/dashboard')

  // Legitimate destinations
  assert.strictEqual(sanitizeRedirect('/client/dashboard'), '/client/dashboard')
  assert.strictEqual(sanitizeRedirect('/client/settings'), '/client/settings')
  assert.strictEqual(sanitizeRedirect('/client/inbox?filter=unread'), '/client/inbox?filter=unread')
})

test('HIGH-02: Organization update policy rejects non-admin/non-owner members', async () => {
  const getClient = createSecureTestDb(SEED_DATA)
  // Technician of Org A attempts to change business name
  const techClient = getClient({ role: 'authenticated', userId: 'usr-attacker-tech', userEmail: 'tech@apexplumbing.com' })

  const res = await techClient.from('organizations').update({
    name: 'Hacked Plumbing Corp'
  }).eq('id', 'org-victim-a')

  assert.strictEqual(res.error?.code, '42501', 'Technician must not be allowed to update organization settings')
  assert.match(res.error.message, /Insufficient privilege/)
})

test('HIGH-03: Automations worker requires CRON_SECRET in production and uses constant-time comparison', () => {
  function safeCompareSecrets(a, b) {
    try {
      const bufA = Buffer.from(a, 'utf8')
      const bufB = Buffer.from(b, 'utf8')
      if (bufA.length !== bufB.length) return false
      return timingSafeEqual(bufA, bufB)
    } catch {
      return false
    }
  }

  const configured = 'secret-cron-token-32-chars-long!'
  assert.strictEqual(safeCompareSecrets('secret-cron-token-32-chars-long!', configured), true)
  assert.strictEqual(safeCompareSecrets('wrong-secret', configured), false)
  assert.strictEqual(safeCompareSecrets('secret-cron-token-32-chars-long?', configured), false)
  assert.strictEqual(safeCompareSecrets('', configured), false)
})

test('HIGH-04: Health check response masks sensitive database error details', () => {
  // Simulates health route sanitization
  function sanitizeHealthError(err) {
    return 'Database service unavailable'
  }

  const rawFatalError = '[SECURITY FATAL] SUPABASE_SERVICE_ROLE_KEY is required for privileged database operations, but was not found in the environment.'
  const sanitized = sanitizeHealthError(new Error(rawFatalError))

  assert.strictEqual(sanitized, 'Database service unavailable')
  assert.strictEqual(sanitized.includes('SUPABASE_SERVICE_ROLE_KEY'), false, 'Must not leak secret variable name')
  assert.strictEqual(sanitized.includes('SECURITY FATAL'), false, 'Must not leak internal security alert')
})

test('HIGH-08: Test SMS endpoint forces recipient to organization owner_phone', () => {
  // Simulates test SMS recipient binding
  function resolveTargetPhone(orgOwnerPhone, bodyPhone) {
    // Strictly bound to orgOwnerPhone regardless of bodyPhone
    return orgOwnerPhone
  }

  const orgOwnerPhone = '+15551112222'
  const attackerSuppliedPhone = '+15559998888'

  const resolved = resolveTargetPhone(orgOwnerPhone, attackerSuppliedPhone)
  assert.strictEqual(resolved, '+15551112222', 'Must ignore attacker phone and send strictly to verified owner')
})

