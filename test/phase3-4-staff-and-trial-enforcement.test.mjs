/**
 * CAPTODESK — PHASE 3.4: STAFF MANAGEMENT CONTROLS & TRIAL QUOTA ENFORCEMENT TEST SUITE
 * 
 * Verifies:
 * - RBAC-003: Staff role update, suspension, and member removal permissions
 * - RBAC-003: PATCH /api/team/[id] allows owners/admins to update roles
 * - RBAC-003: DELETE /api/team/[id] unlinks member, unassigns crew and pending jobs
 * - RBAC-003: Self-modification, self-deletion, cross-tenant, and privilege escalation guards
 * - RBAC-003: Dispatchers and technicians are rejected from staff management endpoints (403)
 * - BILL-001: SubscriptionService.evaluateTrialQuota derives trial status, booking counters, and 14-day window
 * - BILL-001: processMissedCall suppresses outbound recovery SMS ('trial_limit_reached') while preserving leads
 * - BILL-001: createBooking strictly preserves public customer booking success while suppressing automated outbound SMS
 */

process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeRole, hasPermission } from '../src/lib/security/permissions.ts'
import { SubscriptionService, evaluateTrialQuota } from '../src/lib/billing/subscription-service.ts'
import { processMissedCall } from '../src/lib/services/call-recovery.ts'
import { createBooking } from '../src/lib/booking/booking-manager.ts'
import { PATCH as teamPatch, DELETE as teamDelete } from '../src/app/api/team/[id]/route.ts'

// --- Mock Actors & Identifiers ---
const ORG_A = 'org-tenant-alpha-001'
const ORG_B = 'org-tenant-bravo-002'

const ACTORS = {
  OWNER: { id: 'usr-owner-01', email: 'owner@tenant-a.com', role: 'owner', org_id: ORG_A, full_name: 'Owner Alice' },
  ADMIN: { id: 'usr-admin-01', email: 'admin@tenant-a.com', role: 'admin', org_id: ORG_A, full_name: 'Admin Bob' },
  DISPATCHER: { id: 'usr-disp-01', email: 'dispatcher@tenant-a.com', role: 'dispatcher', org_id: ORG_A, full_name: 'Dispatcher Dan' },
  TECHNICIAN: { id: 'usr-tech-01', email: 'technician@tenant-a.com', role: 'technician', org_id: ORG_A, full_name: 'Tech Tim' },
  MEMBER: { id: 'usr-mem-01', email: 'member@tenant-a.com', role: 'member', org_id: ORG_A, full_name: 'Member Mary' },
  OTHER_ORG_TECH: { id: 'usr-other-01', email: 'tech@tenant-b.com', role: 'technician', org_id: ORG_B, full_name: 'Other Tech' }
}

/**
 * Creates an in-memory mock Supabase client for RBAC and business logic tests
 */
function createMockClient(currentUser, customStore = {}) {
  const store = {
    organizations: customStore.organizations || [
      { id: ORG_A, name: 'Tenant Alpha HVAC', subscription_status: 'trial', created_at: new Date().toISOString() },
      { id: ORG_B, name: 'Tenant Bravo Plumbing', subscription_status: 'active', created_at: new Date().toISOString() }
    ],
    profiles: customStore.profiles || Object.values(ACTORS).map(a => ({ ...a })),
    saas_subscriptions: customStore.saas_subscriptions || [],
    appointments: customStore.appointments || [],
    jobs: customStore.jobs || [],
    crew_members: customStore.crew_members || [],
    contacts: customStore.contacts || [],
    leads: customStore.leads || [],
    calls: customStore.calls || [],
    notifications: customStore.notifications || [],
    audit_logs: customStore.audit_logs || [],
    compliance_audit_logs: customStore.compliance_audit_logs || [],
    compliance_suppression_list: customStore.compliance_suppression_list || [],
    services: customStore.services || [],
    conversations: customStore.conversations || [],
    messages: customStore.messages || []
  }

  const client = {
    _store: store,
    auth: {
      getUser: async () => {
        if (!currentUser) return { data: { user: null }, error: new Error('No session') }
        return {
          data: {
            user: {
              id: currentUser.id,
              email: currentUser.email,
              app_metadata: {},
              user_metadata: {}
            }
          },
          error: null
        }
      }
    },
    from: (tableName) => {
      if (!store[tableName]) store[tableName] = []
      let filters = []
      let selectOpts = {}
      let isSingle = false
      let isMaybeSingle = false

      const query = {
        select: (cols, opts) => {
          if (opts) selectOpts = opts
          return query
        },
        eq: (col, val) => {
          filters.push(row => row[col] === val)
          return query
        },
        neq: (col, val) => {
          filters.push(row => row[col] !== val)
          return query
        },
        in: (col, arr) => {
          filters.push(row => arr.includes(row[col]))
          return query
        },
        is: (col, val) => {
          filters.push(row => val === null ? (row[col] === null || row[col] === undefined) : row[col] === val)
          return query
        },
        gte: (col, val) => {
          filters.push(row => new Date(row[col]) >= new Date(val))
          return query
        },
        lte: (col, val) => {
          filters.push(row => new Date(row[col]) <= new Date(val))
          return query
        },
        limit: (_n) => query,
        order: () => query,
        single: async () => {
          isSingle = true
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          if (rows.length === 0) return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          return { data: { ...rows[0] }, error: null }
        },
        maybeSingle: async () => {
          isMaybeSingle = true
          const rows = store[tableName].filter(row => filters.every(f => f(row)))
          return { data: rows[0] ? { ...rows[0] } : null, error: null }
        },
        insert: (payload) => {
          const items = Array.isArray(payload) ? payload : [payload]
          const inserted = items.map(item => ({
            id: item.id || `gen-${Math.random().toString(36).substring(2, 9)}`,
            created_at: item.created_at || new Date().toISOString(),
            ...item
          }))
          store[tableName].push(...inserted)

          const insertChain = {
            select: () => insertChain,
            single: async () => ({ data: { ...inserted[0] }, error: null }),
            maybeSingle: async () => ({ data: { ...inserted[0] }, error: null }),
            then: (resolve, reject) => Promise.resolve({ data: inserted, error: null }).then(resolve, reject)
          }
          return insertChain
        },
        update: (updates) => {
          const updateChain = {
            eq: (col, val) => {
              filters.push(row => row[col] === val)
              return updateChain
            },
            in: (col, arr) => {
              filters.push(row => arr.includes(row[col]))
              return updateChain
            },
            select: () => updateChain,
            single: async () => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              if (rows.length === 0) return { data: null, error: { message: 'Row not found' } }
              Object.assign(rows[0], updates)
              return { data: { ...rows[0] }, error: null }
            },
            maybeSingle: async () => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              if (rows[0]) Object.assign(rows[0], updates)
              return { data: rows[0] ? { ...rows[0] } : null, error: null }
            },
            then: (resolve, reject) => {
              const rows = store[tableName].filter(row => filters.every(f => f(row)))
              rows.forEach(r => Object.assign(r, updates))
              return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
            }
          }
          return updateChain
        },
        delete: () => {
          const deleteChain = {
            eq: (col, val) => {
              filters.push(row => row[col] === val)
              return deleteChain
            },
            then: (resolve, reject) => {
              const remaining = store[tableName].filter(row => !filters.every(f => f(row)))
              store[tableName] = remaining
              return Promise.resolve({ data: null, error: null }).then(resolve, reject)
            }
          }
          return deleteChain
        },
        then: (resolve, reject) => {
          const filtered = store[tableName].filter(row => filters.every(f => f(row)))
          if (selectOpts.count === 'exact') {
            return Promise.resolve({ count: filtered.length, data: selectOpts.head ? null : filtered, error: null }).then(resolve, reject)
          }
          return Promise.resolve({ data: filtered, count: filtered.length, error: null }).then(resolve, reject)
        }
      }
      return query
    }
  }

  return client
}

// ==============================================================================
// 1. RBAC-003: Staff Management Permissions Matrix
// ==============================================================================
test('RBAC-003: Permissions capability mapping correctly grants team:manage and team:remove', () => {
  // Super admin and Owners have full team management
  assert.equal(hasPermission('super_admin', 'team:manage'), true)
  assert.equal(hasPermission('super_admin', 'team:remove'), true)
  assert.equal(hasPermission('owner', 'team:manage'), true)
  assert.equal(hasPermission('owner', 'team:remove'), true)

  // Admins have team management
  assert.equal(hasPermission('admin', 'team:manage'), true)
  assert.equal(hasPermission('admin', 'team:remove'), true)
  assert.equal(hasPermission('client_admin', 'team:manage'), true)
  assert.equal(hasPermission('client_admin', 'team:remove'), true)

  // Dispatchers, Technicians, and Members CANNOT manage or remove team members
  assert.equal(hasPermission('dispatcher', 'team:manage'), false)
  assert.equal(hasPermission('dispatcher', 'team:remove'), false)
  assert.equal(hasPermission('technician', 'team:manage'), false)
  assert.equal(hasPermission('technician', 'team:remove'), false)
  assert.equal(hasPermission('member', 'team:manage'), false)
  assert.equal(hasPermission('member', 'team:remove'), false)
})

// ==============================================================================
// 2. RBAC-003: Staff Management API Endpoints (PATCH & DELETE)
// ==============================================================================
test('RBAC-003: Owner can update a technician to dispatcher via PATCH /api/team/[id]', async () => {
  const mockClient = createMockClient(ACTORS.OWNER)

  const req = new Request('http://localhost:3000/api/team/' + ACTORS.TECHNICIAN.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher', fullName: 'Tim Dispatched' })
  })

  const res = await teamPatch(req, { params: Promise.resolve({ id: ACTORS.TECHNICIAN.id }), customSupabase: mockClient })
  assert.equal(res.status, 200)

  const json = await res.json()
  assert.equal(json.success, true)
  assert.equal(json.member.role, 'dispatcher')
  assert.equal(json.member.full_name, 'Tim Dispatched')

  // Verify in-memory store updated
  const updatedInDb = mockClient._store.profiles.find(p => p.id === ACTORS.TECHNICIAN.id)
  assert.equal(updatedInDb.role, 'dispatcher')
})

test('RBAC-003: Owner can remove a member via DELETE /api/team/[id] and unassign pending jobs', async () => {
  const initialJobs = [
    { id: 'job-1', org_id: ORG_A, assigned_to: ACTORS.TECHNICIAN.id, status: 'scheduled' },
    { id: 'job-2', org_id: ORG_A, assigned_to: ACTORS.TECHNICIAN.id, status: 'completed' } // Completed jobs not unassigned
  ]
  const initialCrews = [
    { id: 'crew-m-1', profile_id: ACTORS.TECHNICIAN.id }
  ]

  const mockClient = createMockClient(ACTORS.OWNER, {
    jobs: initialJobs,
    crew_members: initialCrews
  })

  const req = new Request('http://localhost:3000/api/team/' + ACTORS.TECHNICIAN.id, {
    method: 'DELETE'
  })

  const res = await teamDelete(req, { params: Promise.resolve({ id: ACTORS.TECHNICIAN.id }), customSupabase: mockClient })
  assert.equal(res.status, 200)

  const json = await res.json()
  assert.equal(json.success, true)

  // Verify org_id unlinked and role set to member
  const profileInDb = mockClient._store.profiles.find(p => p.id === ACTORS.TECHNICIAN.id)
  assert.equal(profileInDb.org_id, null)
  assert.equal(profileInDb.role, 'member')

  // Verify crew assignment removed
  assert.equal(mockClient._store.crew_members.length, 0)

  // Verify scheduled job unassigned, completed job preserved
  const job1 = mockClient._store.jobs.find(j => j.id === 'job-1')
  const job2 = mockClient._store.jobs.find(j => j.id === 'job-2')
  assert.equal(job1.assigned_to, null)
  assert.equal(job2.assigned_to, ACTORS.TECHNICIAN.id)
})

test('RBAC-003: Self-modification and self-deletion are strictly blocked (400 Bad Request)', async () => {
  const mockClient = createMockClient(ACTORS.OWNER)

  // Self PATCH
  const patchReq = new Request('http://localhost:3000/api/team/' + ACTORS.OWNER.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher' })
  })
  const patchRes = await teamPatch(patchReq, { params: Promise.resolve({ id: ACTORS.OWNER.id }), customSupabase: mockClient })
  assert.equal(patchRes.status, 400)
  const patchJson = await patchRes.json()
  assert.match(patchJson.error, /cannot modify your own profile/i)

  // Self DELETE
  const deleteReq = new Request('http://localhost:3000/api/team/' + ACTORS.OWNER.id, {
    method: 'DELETE'
  })
  const deleteRes = await teamDelete(deleteReq, { params: Promise.resolve({ id: ACTORS.OWNER.id }), customSupabase: mockClient })
  assert.equal(deleteRes.status, 400)
  const deleteJson = await deleteRes.json()
  assert.match(deleteJson.error, /cannot remove your own account/i)
})

test('RBAC-003: Cross-tenant member modification/removal is rejected (404 Not Found)', async () => {
  const mockClient = createMockClient(ACTORS.OWNER)

  const req = new Request('http://localhost:3000/api/team/' + ACTORS.OTHER_ORG_TECH.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher' })
  })

  const res = await teamPatch(req, { params: Promise.resolve({ id: ACTORS.OTHER_ORG_TECH.id }), customSupabase: mockClient })
  assert.equal(res.status, 404)
  const json = await res.json()
  assert.match(json.error, /not found in your organization/i)
})

test('RBAC-003: Privilege escalation guards block non-owners from modifying owner or escalating to super_admin', async () => {
  const mockClient = createMockClient(ACTORS.ADMIN)

  // 1. Admin attempts to demote/modify Owner -> 403 Forbidden
  const demoteOwnerReq = new Request('http://localhost:3000/api/team/' + ACTORS.OWNER.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'technician' })
  })
  const demoteRes = await teamPatch(demoteOwnerReq, { params: Promise.resolve({ id: ACTORS.OWNER.id }), customSupabase: mockClient })
  assert.equal(demoteRes.status, 403)
  const demoteJson = await demoteRes.json()
  assert.match(demoteJson.error, /cannot modify organization owners/i)

  // 2. Admin attempts to assign super_admin -> 403 Forbidden
  const superReq = new Request('http://localhost:3000/api/team/' + ACTORS.TECHNICIAN.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'super_admin' })
  })
  const superRes = await teamPatch(superReq, { params: Promise.resolve({ id: ACTORS.TECHNICIAN.id }), customSupabase: mockClient })
  assert.equal(superRes.status, 403)
  const superJson = await superRes.json()
  assert.match(superJson.error, /unauthorized role assignment/i)

  // 3. Admin attempts to delete Owner -> 403 Forbidden
  const deleteOwnerReq = new Request('http://localhost:3000/api/team/' + ACTORS.OWNER.id, {
    method: 'DELETE'
  })
  const deleteRes = await teamDelete(deleteOwnerReq, { params: Promise.resolve({ id: ACTORS.OWNER.id }), customSupabase: mockClient })
  assert.equal(deleteRes.status, 403)
  const deleteJson = await deleteRes.json()
  assert.match(deleteJson.error, /cannot remove organization owners/i)
})

test('RBAC-003: Dispatchers and Technicians cannot access staff management endpoints (403 Forbidden)', async () => {
  // Dispatcher calling PATCH
  const dispClient = createMockClient(ACTORS.DISPATCHER)
  const dispReq = new Request('http://localhost:3000/api/team/' + ACTORS.TECHNICIAN.id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'dispatcher' })
  })
  const dispRes = await teamPatch(dispReq, { params: Promise.resolve({ id: ACTORS.TECHNICIAN.id }), customSupabase: dispClient })
  assert.equal(dispRes.status, 403)

  // Technician calling DELETE
  const techClient = createMockClient(ACTORS.TECHNICIAN)
  const techReq = new Request('http://localhost:3000/api/team/' + ACTORS.MEMBER.id, {
    method: 'DELETE'
  })
  const techRes = await teamDelete(techReq, { params: Promise.resolve({ id: ACTORS.MEMBER.id }), customSupabase: techClient })
  assert.equal(techRes.status, 403)
})

// ==============================================================================
// 3. BILL-001: Trial Quota Evaluation
// ==============================================================================
test('BILL-001: evaluateTrialQuota correctly recognizes active paid tenants as non-trial', async () => {
  const mockClient = createMockClient(ACTORS.OWNER, {
    organizations: [{ id: ORG_A, subscription_status: 'active' }],
    saas_subscriptions: [{ org_id: ORG_A, status: 'active' }]
  })

  const quota = await evaluateTrialQuota(mockClient, ORG_A)
  assert.equal(quota.isTrial, false)
  assert.equal(quota.isExceeded, false)
})

test('BILL-001: evaluateTrialQuota permits trial tenants under 3 bookings', async () => {
  const mockClient = createMockClient(ACTORS.OWNER, {
    organizations: [{ id: ORG_A, subscription_status: 'trial', created_at: new Date().toISOString() }],
    appointments: [
      { id: 'apt-1', org_id: ORG_A, status: 'confirmed' },
      { id: 'apt-2', org_id: ORG_A, status: 'completed' }
    ]
  })

  const quota = await evaluateTrialQuota(mockClient, ORG_A)
  assert.equal(quota.isTrial, true)
  assert.equal(quota.isExceeded, false)
  assert.equal(quota.bookedCount, 2)
  assert.equal(quota.maxBookings, 3)
})

test('BILL-001: evaluateTrialQuota marks trial quota exceeded when 3 or more bookings are reached', async () => {
  const mockClient = createMockClient(ACTORS.OWNER, {
    organizations: [{ id: ORG_A, subscription_status: 'trial', created_at: new Date().toISOString() }],
    appointments: [
      { id: 'apt-1', org_id: ORG_A, status: 'confirmed' },
      { id: 'apt-2', org_id: ORG_A, status: 'completed' },
      { id: 'apt-3', org_id: ORG_A, status: 'scheduled' }
    ]
  })

  const quota = await evaluateTrialQuota(mockClient, ORG_A)
  assert.equal(quota.isTrial, true)
  assert.equal(quota.isExceeded, true)
  assert.equal(quota.bookedCount, 3)
  assert.match(quota.reason, /trial booking quota reached/i)
})

test('BILL-001: evaluateTrialQuota marks trial exceeded when 14-day window has expired', async () => {
  const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
  const mockClient = createMockClient(ACTORS.OWNER, {
    organizations: [{ id: ORG_A, subscription_status: 'trial', created_at: fifteenDaysAgo }],
    appointments: [{ id: 'apt-1', org_id: ORG_A, status: 'confirmed' }]
  })

  const quota = await evaluateTrialQuota(mockClient, ORG_A)
  assert.equal(quota.isTrial, true)
  assert.equal(quota.isExceeded, true)
  assert.equal(quota.daysRemaining, 0)
  assert.match(quota.reason, /trial period window has expired/i)
})

// ==============================================================================
// 4. BILL-001: Missed Call Recovery Trial Limit Enforcement
// ==============================================================================
test('BILL-001: processMissedCall pauses automated SMS auto-reply when trial quota is reached but preserves lead', async () => {
  let smsSent = false
  const sendSmsMock = async () => {
    smsSent = true
    return { success: true, messageId: 'msg-mock-123' }
  }

  // Tenant Alpha with 3 existing appointments (trial quota exceeded)
  const mockClient = createMockClient(ACTORS.OWNER, {
    organizations: [{
      id: ORG_A,
      name: 'Tenant Alpha HVAC',
      telnyx_phone_number: '+13125550100',
      subscription_status: 'trial',
      is_missed_call_active: true,
      timezone: 'America/Chicago'
    }],
    appointments: [
      { id: 'apt-1', org_id: ORG_A, status: 'confirmed' },
      { id: 'apt-2', org_id: ORG_A, status: 'completed' },
      { id: 'apt-3', org_id: ORG_A, status: 'scheduled' }
    ]
  })

  const result = await processMissedCall(mockClient, {
    callerNumber: '+13125550199',
    calledNumber: '+13125550100',
    callOutcome: {
      state: 'missed',
      wasAnswered: false,
      isEligibleForRecovery: true,
      durationSeconds: 15,
      hangupCause: 'normal_clearing'
    },
    sendSmsFn: sendSmsMock
  })

  // 1. Verify outbound carrier SMS was NOT sent
  assert.equal(smsSent, false)

  // 2. Result indicates trial_limit_reached suppression
  assert.equal(result.success, true)
  assert.equal(result.suppressionReason, 'trial_limit_reached')

  // 3. Verify call record logged with auto_reply_sent: false
  const callRecord = mockClient._store.calls[0]
  assert.ok(callRecord)
  assert.equal(callRecord.auto_reply_sent, false)
  assert.equal(callRecord.suppression_reason, 'trial_limit_reached')

  // 4. Verify contact was upserted and lead created so prospect is not lost
  const contact = mockClient._store.contacts.find(c => c.phone === '+13125550199')
  assert.ok(contact)
  const lead = mockClient._store.leads.find(l => l.contact_id === contact.id)
  assert.ok(lead)
  assert.match(lead.notes, /trial quota limit/i)

  // 5. In-app upgrade notification dispatched to owner
  const notification = mockClient._store.notifications.find(n => n.org_id === ORG_A)
  assert.ok(notification)
  assert.match(notification.title, /trial quota reached/i)
})

// ==============================================================================
// 5. BILL-001: Public Booking Graceful Behavior Under Trial Limit
// ==============================================================================
test('BILL-001: createBooking strictly preserves public customer booking success when trial limit is exceeded', async () => {
  let smsSent = false
  const sendSmsMock = async () => {
    smsSent = true
    return { success: true, messageId: 'msg-mock-booking' }
  }

  // Tenant Alpha with 3 existing appointments (trial quota exceeded)
  const mockClient = createMockClient(ACTORS.OWNER, {
    organizations: [{
      id: ORG_A,
      name: 'Tenant Alpha HVAC',
      telnyx_phone_number: '+13125550100',
      owner_phone: '+13125550101',
      subscription_status: 'trial',
      booking_mode: 'instant',
      timezone: 'America/Chicago'
    }],
    appointments: [
      { id: 'apt-1', org_id: ORG_A, status: 'confirmed', start_time: '2026-10-01T10:00:00Z', end_time: '2026-10-01T11:00:00Z' },
      { id: 'apt-2', org_id: ORG_A, status: 'completed', start_time: '2026-10-02T10:00:00Z', end_time: '2026-10-02T11:00:00Z' },
      { id: 'apt-3', org_id: ORG_A, status: 'scheduled', start_time: '2026-10-03T10:00:00Z', end_time: '2026-10-03T11:00:00Z' }
    ],
    services: [
      { id: 'svc-1', org_id: ORG_A, name: 'AC Inspection', duration_minutes: 60, price: 149, is_active: true, requires_address: true }
    ]
  })

  // Homeowner submits booking on /book/[slug]
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  tomorrow.setHours(14, 0, 0, 0)

  const bookingRes = await createBooking(mockClient, {
    orgId: ORG_A,
    serviceId: 'svc-1',
    customerName: 'Jane Homeowner',
    customerPhone: '+13125559988',
    customerEmail: 'jane@example.com',
    customerAddress: '123 Main St, Chicago, IL',
    startTime: tomorrow.toISOString(),
    notes: 'Urgent cooling issue'
  })

  // CRITICAL BUSINESS RULE: Public booking MUST succeed!
  assert.equal(bookingRes.success, true)
  assert.ok(bookingRes.appointment)
  assert.ok(bookingRes.manageToken)
  assert.ok(bookingRes.manageUrl)

  // Verify appointment record created
  const createdApt = mockClient._store.appointments.find(a => a.id === bookingRes.appointment.id)
  assert.ok(createdApt)
  assert.equal(createdApt.service_type, 'AC Inspection')

  // Verify linked job created
  const linkedJob = mockClient._store.jobs.find(j => j.appointment_id === createdApt.id)
  assert.ok(linkedJob)

  // Verify lead captured
  const lead = mockClient._store.leads.find(l => l.contact_id === createdApt.contact_id)
  assert.ok(lead)

  // Verify outbound carrier SMS was SUPPRESSED
  const complianceLog = mockClient._store.compliance_audit_logs.find(c => c.action === 'message_suppressed')
  assert.ok(complianceLog)
  assert.equal(complianceLog.reason, 'trial_limit_reached')

  // Verify contractor received in-app warning notification
  const notif = mockClient._store.notifications.find(n => n.org_id === ORG_A && n.title.includes('Trial Quota Reached'))
  assert.ok(notif)
  assert.match(notif.message, /trial booking quota has been reached/i)
})
