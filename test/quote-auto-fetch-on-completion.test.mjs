process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

import {
  selectBestAcceptedQuoteForJob,
  resolveInitialBillableAmount,
} from '../src/lib/jobs/quote-matching.ts'
import {
  hydrateJobsWithQuotes,
  updateJobStatus,
} from '../src/lib/jobs/job-manager.ts'

const ROOT_DIR = path.resolve(import.meta.dirname, '..')

function createQuoteCompletionMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    quotes: initialState.quotes || [],
    quote_items: initialState.quote_items || [],
    jobs: initialState.jobs || [],
    job_items: initialState.job_items || [],
    contacts: initialState.contacts || [],
    leads: initialState.leads || [],
    appointments: initialState.appointments || [],
    services: initialState.services || [],
    invoices: initialState.invoices || [],
    invoice_items: initialState.invoice_items || [],
    automation_runs: initialState.automation_runs || [],
    notifications: initialState.notifications || [],
    activity_logs: initialState.activity_logs || [],
    compliance_audit_logs: initialState.compliance_audit_logs || [],
    compliance_suppression_list: initialState.compliance_suppression_list || [],
    consent_records: initialState.consent_records || [],
    telnyx_phone_numbers: initialState.telnyx_phone_numbers || [],
  }

  let seq = 1

  const applyFilters = (rows, filters) =>
    rows.filter((row) => filters.every((fn) => fn(row)))

  return {
    _tables: tables,
    from(tableName) {
      if (!tables[tableName]) tables[tableName] = []
      const filters = []
      let selectOptions = null
      let limitCount = null
      let pendingAction = null
      let pendingPayload = null

      const executeSelect = () => {
        const matched = applyFilters(tables[tableName], filters)
        const limited = limitCount != null ? matched.slice(0, limitCount) : matched
        if (selectOptions?.head) {
          return { data: null, count: matched.length, error: null }
        }
        return { data: limited.map((row) => ({ ...row })), error: null }
      }

      const executeUpdate = (updateFilters) => {
        const updatedRows = []
        for (const row of tables[tableName]) {
          if (updateFilters.every((fn) => fn(row))) {
            Object.assign(row, pendingPayload)
            updatedRows.push({ ...row })
          }
        }
        return updatedRows
      }

      const executeDelete = (deleteFilters) => {
        tables[tableName] = tables[tableName].filter(
          (row) => !deleteFilters.every((fn) => fn(row))
        )
        return { data: null, error: null }
      }

      const builder = {
        select(_cols, opts) {
          selectOptions = opts || null
          if (!pendingAction) pendingAction = 'select'
          return builder
        },
        eq(col, val) {
          filters.push((row) => row[col] === val)
          return builder
        },
        neq(col, val) {
          filters.push((row) => row[col] !== val)
          return builder
        },
        in(col, vals) {
          filters.push((row) => Array.isArray(vals) && vals.includes(row[col]))
          return builder
        },
        gte(col, val) {
          filters.push((row) => new Date(row[col]) >= new Date(val))
          return builder
        },
        lte(col, val) {
          filters.push((row) => new Date(row[col]) <= new Date(val))
          return builder
        },
        order() {
          return builder
        },
        limit(n) {
          limitCount = n
          return builder
        },
        insert(payload) {
          const rows = Array.isArray(payload) ? payload : [payload]
          const inserted = rows.map((row) => {
            const nextRow = {
              id: row.id || `${tableName}_mock_${seq++}`,
              created_at: row.created_at || new Date().toISOString(),
              ...row,
            }
            tables[tableName].push(nextRow)
            return { ...nextRow }
          })
          const last = inserted[inserted.length - 1] || null

          const afterInsert = {
            select() {
              return {
                single: async () => ({ data: last, error: null }),
                maybeSingle: async () => ({ data: last, error: null }),
                then: (resolve, reject) =>
                  Promise.resolve({ data: inserted, error: null }).then(resolve, reject),
              }
            },
            then: (resolve, reject) =>
              Promise.resolve({ data: last, error: null }).then(resolve, reject),
          }
          return afterInsert
        },
        update(payload) {
          pendingAction = 'update'
          pendingPayload = payload
          const updateFilters = [...filters]
          const updateBuilder = {
            eq(col, val) {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            in(col, vals) {
              updateFilters.push((row) => Array.isArray(vals) && vals.includes(row[col]))
              return updateBuilder
            },
            select() {
              return {
                single: async () => {
                  const updated = executeUpdate(updateFilters)
                  return {
                    data: updated[0] || null,
                    error: updated.length > 0 ? null : { message: 'Not found' },
                  }
                },
                maybeSingle: async () => {
                  const updated = executeUpdate(updateFilters)
                  return { data: updated[0] || null, error: null }
                },
                then: (resolve, reject) => {
                  const updated = executeUpdate(updateFilters)
                  return Promise.resolve({ data: updated, error: null }).then(resolve, reject)
                },
              }
            },
            then: (resolve, reject) => {
              const updated = executeUpdate(updateFilters)
              return Promise.resolve({ data: updated[0] || null, error: null }).then(resolve, reject)
            },
          }
          return updateBuilder
        },
        delete() {
          const deleteFilters = [...filters]
          const deleteBuilder = {
            eq(col, val) {
              deleteFilters.push((row) => row[col] === val)
              return deleteBuilder
            },
            then: (resolve, reject) =>
              Promise.resolve(executeDelete(deleteFilters)).then(resolve, reject),
          }
          return deleteBuilder
        },
        maybeSingle: async () => {
          const res = executeSelect()
          return { data: res.data?.[0] || null, error: null }
        },
        single: async () => {
          const res = executeSelect()
          if (!res.data || res.data.length === 0) {
            return { data: null, error: { message: 'Row not found' } }
          }
          return { data: res.data[0], error: null }
        },
        then: (resolve, reject) =>
          Promise.resolve(executeSelect()).then(resolve, reject),
      }

      return builder
    },
  }
}

test('quote-matching: selectBestAcceptedQuoteForJob & resolveInitialBillableAmount handle linked, unlinked, claimed, and fallback totals', () => {
  const acceptedQuote = {
    id: 'q_accepted_1',
    contact_id: 'c_karl',
    title: 'Water Heater Diagnostic & Flush',
    status: 'accepted',
    total: 350,
    accepted_at: '2026-11-11T10:00:00.000Z',
  }
  const olderSameContactQuote = {
    id: 'q_accepted_old',
    contact_id: 'c_karl',
    title: 'Drain Clearing Special',
    status: 'accepted',
    total: 195,
    accepted_at: '2026-11-10T10:00:00.000Z',
  }
  const sentQuote = {
    id: 'q_sent_only',
    contact_id: 'c_karl',
    title: 'Water Heater Replacement',
    status: 'sent',
    total: 1800,
  }

  // 1. Direct linked accepted quote wins immediately
  const directJob = {
    id: 'job_1',
    contact_id: 'c_karl',
    quote_id: 'q_accepted_1',
    title: 'Water Heater Diagnostic & Flush',
    quote: acceptedQuote,
    service: { name: 'Water Heater Diagnostic & Flush', price: 120 },
  }
  assert.strictEqual(
    selectBestAcceptedQuoteForJob(directJob, [olderSameContactQuote, acceptedQuote])?.id,
    'q_accepted_1'
  )
  assert.strictEqual(resolveInitialBillableAmount(directJob), 350)

  // 2. Unlinked job matches highest-scoring accepted quote for same contact (title match + accepted status)
  const unlinkedJob = {
    id: 'job_3',
    contact_id: 'c_karl',
    quote_id: null,
    title: 'Water Heater Diagnostic & Flush',
    service: { name: 'Water Heater Diagnostic & Flush', price: 120 },
  }
  const matched = selectBestAcceptedQuoteForJob(
    unlinkedJob,
    [sentQuote, olderSameContactQuote, acceptedQuote],
    new Set(['q_accepted_old'])
  )
  assert.strictEqual(matched?.id, 'q_accepted_1')

  // 3. Skip claimed quote when only claimed quote exists
  const noMatchWhenClaimed = selectBestAcceptedQuoteForJob(
    unlinkedJob,
    [sentQuote, acceptedQuote],
    new Set(['q_accepted_1'])
  )
  assert.strictEqual(noMatchWhenClaimed, null)

  // 4. Fallback chain: job.items sum -> service.price -> null
  assert.strictEqual(
    resolveInitialBillableAmount({
      items: [
        { description: 'Valve', quantity: 2, unit_price: 45 },
        { description: 'Flush', quantity: 1, unit_price: 150 },
      ],
      service: { price: 120 },
    }),
    240
  )
  assert.strictEqual(
    resolveInitialBillableAmount({ service: { price: 120 } }),
    120
  )
  assert.strictEqual(resolveInitialBillableAmount({}), null)
})

test('hydrateJobsWithQuotes attaches missing service.price, missing job.quote, and unclaimed accepted quote to active job', async () => {
  const db = createQuoteCompletionMockDb({
    services: [
      { id: 'svc_wh', org_id: 'org_1', name: 'Water Heater Diagnostic & Flush', price: 145 },
    ],
    quotes: [
      {
        id: 'q_old_done',
        org_id: 'org_1',
        contact_id: 'c_karl',
        title: 'Old Sump Pump Job',
        status: 'accepted',
        total: 220,
        accepted_at: '2026-11-01T10:00:00.000Z',
        deposit_invoice_id: null,
      },
      {
        id: 'q_active_wh',
        org_id: 'org_1',
        contact_id: 'c_karl',
        title: 'Water Heater Diagnostic & Flush',
        status: 'accepted',
        total: 385,
        accepted_at: '2026-11-11T12:00:00.000Z',
        deposit_invoice_id: 'inv_dep_1',
      },
    ],
    quote_items: [
      { id: 'qi_1', quote_id: 'q_active_wh', description: 'Diagnostic & Scale Flush', quantity: 1, unit_price: 260, total: 260 },
      { id: 'qi_2', quote_id: 'q_active_wh', description: 'Anode Rod Check', quantity: 1, unit_price: 125, total: 125 },
    ],
    jobs: [
      {
        id: 'job_completed_1',
        org_id: 'org_1',
        job_number: 'JOB-2026-000001',
        contact_id: 'c_karl',
        quote_id: 'q_old_done',
        status: 'completed',
        title: 'Old Sump Pump Job',
      },
      {
        id: 'job_active_3',
        org_id: 'org_1',
        job_number: 'JOB-2026-000003',
        contact_id: 'c_karl',
        service_id: 'svc_wh',
        quote_id: null,
        status: 'in_progress',
        title: 'Water Heater Diagnostic & Flush',
      },
    ],
    invoices: [
      // Deposit invoice does NOT block q_active_wh from final job completion billing
      { id: 'inv_dep_1', org_id: 'org_1', contact_id: 'c_karl', quote_id: 'q_active_wh', status: 'paid' },
      // Non-deposit invoice DOES claim q_old_done
      { id: 'inv_final_1', org_id: 'org_1', contact_id: 'c_karl', quote_id: 'q_old_done', status: 'sent' },
    ],
  })

  // Simulate GET /api/client/jobs fallback rows where service.price and quote embed are absent
  const hydratedRows = [
    {
      id: 'job_completed_1',
      org_id: 'org_1',
      job_number: 'JOB-2026-000001',
      contact_id: 'c_karl',
      quote_id: 'q_old_done',
      status: 'completed',
      title: 'Old Sump Pump Job',
      quote: null,
    },
    {
      id: 'job_active_3',
      org_id: 'org_1',
      job_number: 'JOB-2026-000003',
      contact_id: 'c_karl',
      service_id: 'svc_wh',
      quote_id: null,
      status: 'in_progress',
      title: 'Water Heater Diagnostic & Flush',
      service: { id: 'svc_wh', name: 'Water Heater Diagnostic & Flush' },
      quote: null,
    },
  ]

  await hydrateJobsWithQuotes(db, 'org_1', hydratedRows)

  assert.strictEqual(hydratedRows[0].quote?.id, 'q_old_done')
  assert.strictEqual(hydratedRows[1].service?.price, 145)
  assert.strictEqual(hydratedRows[1].quote?.id, 'q_active_wh')
  assert.strictEqual(hydratedRows[1].quote?.total, 385)
  assert.strictEqual(hydratedRows[1].quote?.status, 'accepted')
})

test('updateJobStatus completed auto-links unlinked accepted quote, preserves quote items when amount matches, and respects manual amount edits', async () => {
  const baseSeed = () => ({
    organizations: [
      { id: 'org_1', name: "Shanta M's Business", plan_tier: 'pro', timezone: 'America/Chicago' },
    ],
    contacts: [
      { id: 'c_karl', org_id: 'org_1', name: 'karl Marx', first_name: 'karl', last_name: 'Marx', phone: '+18688904567' },
    ],
    quotes: [
      {
        id: 'q_350',
        org_id: 'org_1',
        contact_id: 'c_karl',
        quote_number: 'QT-2026-0001',
        title: 'Water Heater Diagnostic & Flush',
        status: 'accepted',
        subtotal: 350,
        tax: 0,
        discount: 0,
        total: 350,
        accepted_at: '2026-11-11T09:00:00.000Z',
      },
    ],
    quote_items: [
      { id: 'qi_a', quote_id: 'q_350', description: 'Diagnostic inspection', quantity: 1, unit_price: 120, total: 120 },
      { id: 'qi_b', quote_id: 'q_350', description: 'Tank power flush & valve service', quantity: 1, unit_price: 230, total: 230 },
    ],
    jobs: [
      {
        id: 'job_3',
        org_id: 'org_1',
        job_number: 'JOB-2026-000003',
        contact_id: 'c_karl',
        quote_id: null,
        title: 'Water Heater Diagnostic & Flush',
        description: 'Flush hot water tank',
        status: 'in_progress',
      },
    ],
  })

  // Case A: Pre-filled quote total ($350) preserves quote line items & links quote_id
  const dbA = createQuoteCompletionMockDb(baseSeed())
  const resA = await updateJobStatus(dbA, {
    jobId: 'job_3',
    orgId: 'org_1',
    newStatus: 'completed',
    notifyCustomer: false,
    finalAmount: 350,
  })
  assert.strictEqual(resA.success, true)
  assert.strictEqual(resA.invoice?.total, 350)
  assert.strictEqual(resA.invoice?.quote_id, 'q_350')
  assert.strictEqual(dbA._tables.jobs[0].quote_id, 'q_350')
  assert.strictEqual(dbA._tables.invoice_items.length, 2)
  assert.deepStrictEqual(
    dbA._tables.invoice_items.map((item) => item.unit_price),
    [120, 230]
  )

  // Case B: Technician edits Final Billable Amount ($) in modal to $425.75
  const dbB = createQuoteCompletionMockDb(baseSeed())
  const resB = await updateJobStatus(dbB, {
    jobId: 'job_3',
    orgId: 'org_1',
    newStatus: 'completed',
    notifyCustomer: false,
    finalAmount: 425.75,
    quoteId: 'q_350',
  })
  assert.strictEqual(resB.success, true)
  assert.strictEqual(resB.invoice?.total, 425.75)
  assert.strictEqual(resB.invoice?.quote_id, 'q_350')
  assert.strictEqual(dbB._tables.jobs[0].quote_id, 'q_350')
  assert.strictEqual(dbB._tables.invoice_items.length, 1)
  assert.strictEqual(dbB._tables.invoice_items[0].unit_price, 425.75)

  // Case C: 1-tap completion (e.g. Field Route) with no finalAmount auto-uses accepted quote & its items
  const dbC = createQuoteCompletionMockDb(baseSeed())
  const resC = await updateJobStatus(dbC, {
    jobId: 'job_3',
    orgId: 'org_1',
    newStatus: 'completed',
    notifyCustomer: false,
  })
  assert.strictEqual(resC.success, true)
  assert.strictEqual(resC.invoice?.total, 350)
  assert.strictEqual(resC.invoice?.quote_id, 'q_350')
  assert.strictEqual(dbC._tables.invoice_items.length, 2)
})

test('source regression guards: schedule modal, jobs API, invoices page, and field route preserve automatic approved-quote pre-fill + editable box', () => {
  const hubSource = fs.readFileSync(
    path.join(ROOT_DIR, 'src/components/schedule/schedule-dispatch-hub.tsx'),
    'utf8'
  )
  const jobsRouteSource = fs.readFileSync(
    path.join(ROOT_DIR, 'src/app/api/client/jobs/route.ts'),
    'utf8'
  )
  const statusRouteSource = fs.readFileSync(
    path.join(ROOT_DIR, 'src/app/api/client/jobs/[id]/status/route.ts'),
    'utf8'
  )
  const invoicesPageSource = fs.readFileSync(
    path.join(ROOT_DIR, 'src/app/client/invoices/page.tsx'),
    'utf8'
  )
  const fieldPageSource = fs.readFileSync(
    path.join(ROOT_DIR, 'src/app/client/field/page.tsx'),
    'utf8'
  )

  assert.match(jobsRouteSource, /hydrateJobsWithQuotes\(supabase,\s*orgId,\s*items\)/)
  assert.match(jobsRouteSource, /service:services\(id,\s*name,\s*duration_minutes,\s*price\)/)
  assert.match(jobsRouteSource, /quote:quotes!quote_id\(id,\s*quote_number,\s*title,\s*total,\s*subtotal,\s*tax,\s*discount,\s*status,\s*manage_token\)/)

  assert.match(statusRouteSource, /quoteId/)

  assert.match(hubSource, /resolveInitialBillableAmount/)
  assert.match(hubSource, /selectBestAcceptedQuoteForJob/)
  assert.match(hubSource, /completionAmountTouchedRef/)
  assert.match(hubSource, /\/api\/client\/quotes\?contact_id=/)
  assert.match(hubSource, /Use approved \(/)
  assert.match(hubSource, /setCompletionAmount\(e\.target\.value\)/)

  assert.match(invoicesPageSource, /selectBestAcceptedQuoteForJob/)
  assert.ok(
    !/\[searchParams,\s*contacts,\s*invoiceTitle,\s*handleImportQuote\]/.test(invoicesPageSource),
    'invoice quote import effect should not re-trigger on every keystroke of invoiceTitle'
  )

  assert.match(fieldPageSource, /quote\?:/)
  assert.match(fieldPageSource, /quote_id=/)
})
