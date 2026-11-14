process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import {
  formatCustomerGreetingName,
  renderSituationAwareText,
} from '../src/lib/notifications/situation-templates.ts'
import { PLATFORM_TOLL_FREE_NUMBER } from '../src/lib/billing/plans.ts'
import { updateJobStatus } from '../src/lib/jobs/job-manager.ts'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')

function createJobStatusMockDb(initialState = {}, options = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    jobs: initialState.jobs || [],
    contacts: initialState.contacts || [],
    appointments: initialState.appointments || [],
    invoices: initialState.invoices || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    consent_records: initialState.consent_records || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
  }

  let jobUpdateAttempts = 0

  const applyFilters = (rows, filters) =>
    rows.filter((row) =>
      filters.every((f) => {
        if (f.type === 'eq') return row[f.col] === f.val
        if (f.type === 'in') return f.vals.includes(row[f.col])
        return true
      })
    )

  const buildQuery = (tableName) => {
    if (!tables[tableName]) tables[tableName] = []
    const filters = []
    let pendingAction = null
    let selectOptions = null
    let limitCount = null

    const execute = async () => {
      if (pendingAction === 'insert') {
        const inserted = Array.isArray(pendingActionPayload)
          ? pendingActionPayload
          : [pendingActionPayload]
        for (const item of inserted) {
          tables[tableName].push({ id: item.id || `${tableName}_${tables[tableName].length + 1}`, ...item })
        }
        return { data: inserted[0], error: null }
      }

      if (pendingAction === 'update') {
        const matches = applyFilters(tables[tableName], filters)
        if (tableName === 'jobs') {
          jobUpdateAttempts += 1
          if (
            options.failFirstOptionalJobUpdate &&
            jobUpdateAttempts === 1 &&
            ('eta_minutes' in pendingActionPayload || 'technician_name' in pendingActionPayload)
          ) {
            return {
              data: null,
              error: { code: '42703', message: 'column "eta_minutes" does not exist' },
            }
          }
        }
        for (const row of matches) {
          Object.assign(row, pendingActionPayload)
        }
        const first = matches[0] ? { ...matches[0] } : null
        return { data: first, error: first ? null : { message: 'Not found' } }
      }

      const matches = applyFilters(tables[tableName], filters)
      const limited = limitCount ? matches.slice(0, limitCount) : matches
      if (selectOptions?.head) {
        return { data: null, count: matches.length, error: null }
      }
      return { data: limited.map((r) => ({ ...r })), error: null }
    }

    let pendingActionPayload = null
    const builder = {
      select(_cols, opts) {
        selectOptions = opts || null
        if (!pendingAction) pendingAction = 'select'
        return builder
      },
      insert(payload) {
        pendingAction = 'insert'
        pendingActionPayload = payload
        return builder
      },
      update(payload) {
        pendingAction = 'update'
        pendingActionPayload = payload
        return builder
      },
      eq(col, val) {
        filters.push({ type: 'eq', col, val })
        return builder
      },
      in(col, vals) {
        filters.push({ type: 'in', col, vals })
        return builder
      },
      is() {
        return builder
      },
      order() {
        return builder
      },
      limit(n) {
        limitCount = n
        return builder
      },
      async single() {
        const res = await execute()
        if (res.error) return res
        const row = Array.isArray(res.data) ? res.data[0] : res.data
        return { data: row || null, error: row ? null : { message: 'Row not found' } }
      },
      async maybeSingle() {
        const res = await execute()
        if (res.error) return res
        const row = Array.isArray(res.data) ? res.data[0] : res.data
        return { data: row || null, error: null }
      },
      then(resolve, reject) {
        return execute().then(resolve, reject)
      },
    }
    return builder
  }

  return {
    tables,
    from: (tableName) => buildQuery(tableName),
  }
}

test('formatCustomerGreetingName & customer_en_route format customer greetings consistently', () => {
  assert.strictEqual(formatCustomerGreetingName('karl Marx'), 'Karl Marx')
  assert.strictEqual(formatCustomerGreetingName('robert redford'), 'Robert Redford')
  assert.strictEqual(formatCustomerGreetingName('Mary McDonald'), 'Mary McDonald')
  assert.strictEqual(formatCustomerGreetingName('there'), 'there')
  assert.strictEqual(formatCustomerGreetingName(null), 'there')
  assert.strictEqual(formatCustomerGreetingName('   '), 'there')

  const soloMsg = renderSituationAwareText('customer_en_route', {
    operationMode: 'solo',
    customerName: 'karl Marx',
    businessName: "Shanta M's Business",
    technicianName: 'Shanta M',
    etaMinutes: 30,
    trackingUrl: 'https://app.captodesk.com/t/abc123',
  })
  assert.strictEqual(
    soloMsg,
    "Hi Karl Marx, Shanta M from Shanta M's Business is en route to your location. ETA ~30 mins. Track live: https://app.captodesk.com/t/abc123"
  )

  const multiCrewMsg = renderSituationAwareText('customer_en_route', {
    operationMode: 'multi_crew',
    customerName: 'karl Marx',
    businessName: "Shanta M's Business",
    technicianName: 'Van #2',
    etaMinutes: 45,
  })
  assert.strictEqual(
    multiCrewMsg,
    "Hi Karl Marx, your technician Van #2 from Shanta M's Business is en route to your location. ETA ~45 mins."
  )
})

test('updateJobStatus(en_route) selects provisioning status, preserves tracking_token on fallback, and respects notifyCustomer', async () => {
  const origMockDispatch = process.env.TELNYX_MOCK_DISPATCH
  const origApiKey = process.env.TELNYX_API_KEY
  const origAppUrl = process.env.NEXT_PUBLIC_APP_URL
  const origFetch = globalThis.fetch

  const capturedPayloads = []
  delete process.env.TELNYX_MOCK_DISPATCH
  process.env.TELNYX_API_KEY = 'KEY_UNIT_TEST_EN_ROUTE'
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.captodesk.com'
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('/v2/messages')) {
      capturedPayloads.push(JSON.parse(String(init?.body || '{}')))
      return new Response(JSON.stringify({ data: { id: `telnyx_msg_${capturedPayloads.length}` } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return origFetch(url, init)
  }

  try {
    // 1. Trial / pending provisioning org + missing optional schema columns + null tracking_token
    const dbPending = createJobStatusMockDb(
      {
        organizations: [
          {
            id: 'org-pending-1',
            name: "Shanta M's Business",
            telnyx_phone_number: '+15125550199',
            phone_provisioning_status: 'pending_number',
            plan_id: 'solo',
            subscription_status: 'active',
            operation_mode: 'solo',
          },
        ],
        contacts: [{ id: 'contact-1', name: 'karl Marx', phone: '+18688904567' }],
        jobs: [
          {
            id: 'job-1',
            org_id: 'org-pending-1',
            contact_id: 'contact-1',
            status: 'scheduled',
            job_number: 'JOB-2026-000003',
            title: 'Water Heater Diagnostic & Flush - karl Marx',
            tracking_token: null,
          },
        ],
      },
      { failFirstOptionalJobUpdate: true }
    )

    const resPending = await updateJobStatus(dbPending, {
      orgId: 'org-pending-1',
      jobId: 'job-1',
      newStatus: 'en_route',
      technicianName: 'Shanta M',
      etaMinutes: 30,
      notifyCustomer: true,
    })

    assert.strictEqual(resPending.success, true)
    assert.ok(resPending.job.tracking_token, 'fallback update must still persist generated tracking_token')
    assert.strictEqual(capturedPayloads.length, 1)
    assert.strictEqual(capturedPayloads[0].from, PLATFORM_TOLL_FREE_NUMBER)
    assert.strictEqual(capturedPayloads[0].to, '+18688904567')
    assert.ok(capturedPayloads[0].text.startsWith("Hi Karl Marx, Shanta M from Shanta M's Business is en route"))
    assert.ok(
      capturedPayloads[0].text.includes(`https://app.captodesk.com/t/${resPending.job.tracking_token}`),
      'SMS tracking link must match persisted DB tracking_token'
    )

    // 2. Active dedicated DID org sends from dedicated DID
    const dbActive = createJobStatusMockDb({
      organizations: [
        {
          id: 'org-paid-1',
          name: 'Apex Plumbing',
          telnyx_phone_number: '+15125550199',
          phone_provisioning_status: 'active',
          plan_id: 'solo',
          subscription_status: 'active',
          operation_mode: 'solo',
        },
      ],
      contacts: [{ id: 'contact-2', name: 'robert redford', phone: '+15125550111' }],
      jobs: [
        {
          id: 'job-2',
          org_id: 'org-paid-1',
          contact_id: 'contact-2',
          status: 'scheduled',
          job_number: 'JOB-2026-000004',
          title: 'Main Drain Clearing - robert redford',
          tracking_token: 'tok_existing_123',
        },
      ],
    })

    const resPaid = await updateJobStatus(dbActive, {
      orgId: 'org-paid-1',
      jobId: 'job-2',
      newStatus: 'en_route',
      technicianName: 'Mike',
      etaMinutes: 15,
      notifyCustomer: true,
    })

    assert.strictEqual(resPaid.success, true)
    assert.strictEqual(capturedPayloads.length, 2)
    assert.strictEqual(capturedPayloads[1].from, '+15125550199')
    assert.ok(capturedPayloads[1].text.includes('Hi Robert Redford, Mike from Apex Plumbing'))

    // 3. notifyCustomer: false must NOT send SMS
    const resSilent = await updateJobStatus(dbActive, {
      orgId: 'org-paid-1',
      jobId: 'job-2',
      newStatus: 'en_route',
      technicianName: 'Mike',
      etaMinutes: 45,
      notifyCustomer: false,
    })
    assert.strictEqual(resSilent.success, true)
    assert.strictEqual(capturedPayloads.length, 2, 'must not send SMS when notifyCustomer is false')
  } finally {
    globalThis.fetch = origFetch
    if (origMockDispatch !== undefined) process.env.TELNYX_MOCK_DISPATCH = origMockDispatch
    else delete process.env.TELNYX_MOCK_DISPATCH
    if (origApiKey !== undefined) process.env.TELNYX_API_KEY = origApiKey
    else delete process.env.TELNYX_API_KEY
    if (origAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = origAppUrl
    else delete process.env.NEXT_PUBLIC_APP_URL
  }
})

test('EnRouteModal and all dispatch callers enforce UI, preview parity, phone guard, and error retention', () => {
  const modalSource = fs.readFileSync(path.join(ROOT_DIR, 'src/components/jobs/en-route-modal.tsx'), 'utf8')
  const scheduleSource = fs.readFileSync(
    path.join(ROOT_DIR, 'src/components/schedule/schedule-dispatch-hub.tsx'),
    'utf8'
  )
  const fieldSource = fs.readFileSync(path.join(ROOT_DIR, 'src/app/client/field/page.tsx'), 'utf8')
  const dashboardSource = fs.readFileSync(path.join(ROOT_DIR, 'src/app/client/dashboard/page.tsx'), 'utf8')

  // EnRouteModal guarantees
  assert.ok(!modalSource.includes('break-all'), 'must not break words mid-word in SMS preview')
  assert.ok(!modalSource.includes('Or send free native SMS from your phone'), 'confusing native SMS link removed')
  assert.ok(modalSource.includes('[overflow-wrap:anywhere]'), 'long URLs wrap cleanly without word splits')
  assert.ok(modalSource.includes("renderSituationAwareText('customer_en_route'"), 'uses shared backend SMS template')
  assert.ok(modalSource.includes('ETA_PRESETS = [15, 30, 45, 60]'), 'uses 15-min ETA presets')
  assert.ok(modalSource.includes('min-h-[44px]'), 'uses mobile-friendly 44px touch targets')
  assert.ok(modalSource.includes('Start Travel Only'), 'dynamic CTA reflects SMS toggle state')
  assert.ok(modalSource.includes('Send Text & Start Travel'), 'dynamic CTA reflects active SMS toggle')
  assert.ok(modalSource.includes('setSubmitError('), 'surfaces inline submission error when onConfirm fails')

  // Caller consistency & error propagation guarantees
  assert.ok(scheduleSource.includes('techSuggestions='), 'schedule passes crew/team tech suggestions')
  assert.ok(
    scheduleSource.includes('Marked En Route (status updated without SMS).'),
    'schedule toast distinguishes non-SMS updates'
  )
  assert.ok(
    scheduleSource.includes("throw new Error(result.error || 'Failed to update job status.')"),
    'schedule keeps EnRouteModal open on failure'
  )

  assert.ok(fieldSource.includes('techSuggestions='), 'field passes crew suggestions to EnRouteModal')
  assert.ok(
    fieldSource.includes('Marked En Route (status updated without SMS).'),
    'field toast distinguishes non-SMS updates'
  )
  assert.ok(fieldSource.includes('throw new Error(errMsg)'), 'field keeps EnRouteModal open on failure')

  assert.ok(
    dashboardSource.includes('Marked En Route (status updated without SMS).'),
    'dashboard toast distinguishes non-SMS updates'
  )
  assert.ok(dashboardSource.includes('throw new Error(errMsg)'), 'dashboard keeps EnRouteModal open on error')
})
