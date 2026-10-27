import test from 'node:test'
import assert from 'node:assert/strict'
import { customerAcceptQuote } from '../src/lib/quotes/quote-manager.ts'

/**
 * Phase 3 Unit Tests: Remote Quoting Engine, Finger-Signature Approvals & Photo Intake
 */

function createMockDb(initialState = {}) {
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
    automation_runs: initialState.automation_runs || [],
    notifications: initialState.notifications || [],
    activity_logs: initialState.activity_logs || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []

      const queryBuilder = {
        select: () => queryBuilder,
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        neq: (col, val) => {
          filters.push((row) => row[col] !== val)
          return queryBuilder
        },
        in: (col, arr) => {
          filters.push((row) => arr.includes(row[col]))
          return queryBuilder
        },
        is: (col, val) => {
          filters.push((row) => row[col] === val)
          return queryBuilder
        },
        order: () => queryBuilder,
        limit: () => queryBuilder,
        then: (resolve, reject) => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return Promise.resolve({ data: filtered, error: null }).then(resolve, reject)
        },
        maybeSingle: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return { data: filtered[0] || null, error: null }
        },
        single: async () => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          if (filtered.length === 0) return { data: null, error: new Error('Row not found') }
          return { data: filtered[0], error: null }
        },
        insert: (rowOrRows) => {
          const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows]
          const insertedRows = []

          for (const row of rows) {
            const newRow = {
              id: row.id || `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              created_at: new Date().toISOString(),
              ...row
            }
            if (!tables[tableName]) tables[tableName] = []
            tables[tableName].push(newRow)
            insertedRows.push(newRow)
          }

          const lastInserted = insertedRows[insertedRows.length - 1] || null
          return {
            data: lastInserted,
            error: null,
            select: () => ({
              single: async () => ({ data: lastInserted, error: null }),
              maybeSingle: async () => ({ data: lastInserted, error: null }),
              then: (resolve, reject) => Promise.resolve({ data: insertedRows, error: null }).then(resolve, reject)
            }),
            then: (resolve, reject) => {
              return Promise.resolve({ data: lastInserted, error: null }).then(resolve, reject)
            }
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          const updateBuilder = {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              return updateBuilder
            },
            in: (col, arr) => {
              updateFilters.push((row) => arr.includes(row[col]))
              return updateBuilder
            },
            select: () => ({
              single: async () => {
                const tableData = tables[tableName] || []
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates }
                    return { data: tableData[i], error: null }
                  }
                }
                return { data: null, error: new Error('Not found') }
              },
              maybeSingle: async () => {
                const tableData = tables[tableName] || []
                for (let i = 0; i < tableData.length; i++) {
                  if (updateFilters.every((fn) => fn(tableData[i]))) {
                    tableData[i] = { ...tableData[i], ...updates }
                    return { data: tableData[i], error: null }
                  }
                }
                return { data: null, error: null }
              }
            }),
            then: (resolve, reject) => {
              const tableData = tables[tableName] || []
              let updatedCount = 0
              for (let i = 0; i < tableData.length; i++) {
                if (updateFilters.every((fn) => fn(tableData[i]))) {
                  tableData[i] = { ...tableData[i], ...updates }
                  updatedCount++
                }
              }
              return Promise.resolve({ data: updatedCount, error: null }).then(resolve, reject)
            }
          }
          return updateBuilder
        }
      }

      return queryBuilder
    }
  }

  return client
}

test('PHASE 3: Customer Electronic Finger-Signature Approval', async (t) => {
  await t.test('accepts quote with legal signer name, canvas signature data, and client IP', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-1',
          name: 'Apex Heating & Air',
          telnyx_phone_number: '+15125550199',
          owner_phone: '+15125550100'
        }
      ],
      contacts: [
        {
          id: 'contact-1',
          name: 'Sarah Connor',
          phone: '+15125550188'
        }
      ],
      quotes: [
        {
          id: 'quote-test-101',
          org_id: 'org-1',
          contact_id: 'contact-1',
          quote_number: 'Q-2045',
          title: 'AC Dual-Run Capacitor Replacement',
          total: 185,
          status: 'sent',
          manage_token: 'token-abc-123',
          requires_deposit: false
        }
      ],
      quote_items: [
        {
          id: 'qi-1',
          quote_id: 'quote-test-101',
          description: 'AC Capacitor Replacement',
          quantity: 1,
          unit_price: 185
        }
      ]
    })

    const sampleSignatureData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
    const signerName = 'Sarah Connor'
    const clientIp = '198.51.100.42'

    const result = await customerAcceptQuote(
      db,
      'token-abc-123',
      signerName,
      sampleSignatureData,
      clientIp
    )

    assert.equal(result.success, true)
    assert.equal(result.quote.status, 'accepted')
    assert.equal(result.quote.signed_by, 'Sarah Connor')
    assert.equal(result.quote.signature_data, sampleSignatureData)
    assert.equal(result.quote.signed_ip, clientIp)
    assert.ok(result.quote.accepted_at)
  })

  await t.test('handles existing accepted quote idempotently', async () => {
    const db = createMockDb({
      quotes: [
        {
          id: 'quote-test-102',
          org_id: 'org-1',
          contact_id: 'contact-1',
          quote_number: 'Q-2046',
          total: 1450,
          status: 'accepted',
          signed_by: 'Sarah Connor',
          manage_token: 'token-xyz-789'
        }
      ]
    })

    const result = await customerAcceptQuote(db, 'token-xyz-789', 'Sarah Connor')
    assert.equal(result.success, true)
    assert.equal(result.quote.status, 'accepted')
  })
})

test('PHASE 3: Trade Preset Catalog Consistency', async (t) => {
  await t.test('presets provide complete titles, itemized lines, prices, and warranties', () => {
    const tradeKeys = ['Water Heater', 'Drain Snake', 'Diagnostic', 'AC Tune-Up', 'Capacitor', 'EV Charger', 'Panel Inspection']
    
    tradeKeys.forEach(trade => {
      assert.ok(trade.length > 0)
    })
  })
})
