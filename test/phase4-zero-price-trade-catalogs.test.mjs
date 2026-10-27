import test from 'node:test'
import assert from 'node:assert/strict'
import {
  INDUSTRY_PRESETS,
  INDUSTRY_LIST,
  getIndustryPreset
} from '../src/lib/constants/industries.ts'
import {
  parseServicePricing,
  cleanServiceDescription,
  encodeServiceDescription,
  PRICING_MODEL_LABELS
} from '../src/lib/services/service-pricing.ts'
import { POST as importPresetHandler } from '../src/app/api/client/services/import-preset/route.ts'

// --- MOCK DATABASE HARNESS ---
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    services: initialState.services || []
  }

  return {
    auth: {
      getUser: async () => ({
        data: {
          user: {
            id: 'usr-trade-owner',
            email: 'owner@apexservices.com',
            user_metadata: { full_name: 'Alex Miller' }
          }
        },
        error: null
      })
    },
    from: (tableName) => {
      let filters = []
      let selectedCols = '*'

      const builder = {
        select: (cols) => {
          selectedCols = cols || '*'
          return builder
        },
        eq: (col, val) => {
          filters.push((row) => row[col] === val)
          return builder
        },
        insert: (records) => {
          const toInsert = Array.isArray(records) ? records : [records]
          const inserted = toInsert.map((item, idx) => ({
            id: item.id || `svc-gen-${Date.now()}-${idx}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item
          }))
          if (!tables[tableName]) tables[tableName] = []
          tables[tableName].push(...inserted)

          const result = {
            data: inserted,
            error: null
          }

          return {
            ...result,
            select: () => ({
              single: async () => ({ data: inserted[0], error: null }),
              then: (resolve) => resolve({ data: inserted, error: null })
            }),
            then: (resolve) => resolve(result)
          }
        },
        update: (updates) => {
          const updateFilters = [...filters]
          return {
            eq: (col, val) => {
              updateFilters.push((row) => row[col] === val)
              const tableData = tables[tableName] || []
              for (let i = 0; i < tableData.length; i++) {
                if (updateFilters.every((fn) => fn(tableData[i]))) {
                  tableData[i] = { ...tableData[i], ...updates }
                }
              }
              return {
                select: () => ({
                  single: async () => ({ data: tableData[0], error: null })
                }),
                then: (resolve) => resolve({ data: tableData, error: null })
              }
            }
          }
        },
        then: (resolve) => {
          const tableData = tables[tableName] || []
          const filtered = tableData.filter((row) => filters.every((fn) => fn(row)))
          return resolve({ data: filtered, error: null })
        }
      }

      return builder
    }
  }
}

// --- UNIT TESTS ---

test('PHASE 4: Industry Catalog Coverage — All 21 Home Service Trades', async (t) => {
  await t.test('registers all 21 core home service trades', () => {
    const requiredTrades = [
      'hvac',
      'plumbing',
      'electrical',
      'roofing',
      'landscaping',
      'cleaning',
      'pest_control',
      'handyman',
      'appliance_repair',
      'painting',
      'garage_doors',
      'locksmith',
      'pressure_washing',
      'carpet_cleaning',
      'tree_service',
      'fencing_decking',
      'general_contracting',
      'pool_maintenance',
      'window_services',
      'auto_detailing',
      'general'
    ]

    assert.equal(INDUSTRY_LIST.length, 21, 'Must register exactly 21 home service trades')

    requiredTrades.forEach((tradeKey) => {
      const preset = INDUSTRY_PRESETS[tradeKey]
      assert.ok(preset, `Preset '${tradeKey}' must exist`)
      assert.equal(preset.id, tradeKey)
      assert.ok(preset.name.length > 2, `Name for '${tradeKey}' must be descriptive`)
      assert.ok(preset.badge.length > 1, `Badge for '${tradeKey}' must exist`)
      assert.ok(preset.description.length > 10, `Description for '${tradeKey}' must be detailed`)
      assert.ok(preset.services.length >= 3, `Trade '${tradeKey}' must provide at least 3 curated services`)
      assert.ok(preset.templates.auto_reply.includes('{booking_url}'), `Auto-reply template for '${tradeKey}' must include {booking_url}`)
    })
  })

  await t.test('lookup helper resolves case-insensitively with general fallback', () => {
    assert.equal(getIndustryPreset('Plumbing').id, 'plumbing')
    assert.equal(getIndustryPreset('APPLIANCE_REPAIR').id, 'appliance_repair')
    assert.equal(getIndustryPreset('painting').id, 'painting')
    assert.equal(getIndustryPreset('garage_doors').id, 'garage_doors')
    assert.equal(getIndustryPreset('pressure_washing').id, 'pressure_washing')
    assert.equal(getIndustryPreset('nonexistent_trade').id, 'general')
    assert.equal(getIndustryPreset(null).id, 'general')
  })
})

test('PHASE 4: Zero-Price & Blank Price Architecture', async (t) => {
  await t.test('parses quote_on_site model with null price into clean "Quote on Site" labels', () => {
    const desc = '[pricing:quote_on_site] Main Drain Hydro-Jetting with high-pressure water'
    const result = parseServicePricing(null, desc)

    assert.equal(result.model, 'quote_on_site')
    assert.equal(result.price, null)
    assert.equal(result.formattedPrice, 'Quote on Site')
    assert.equal(result.shortLabel, 'Quote')
    assert.equal(result.cleanDescription, 'Main Drain Hydro-Jetting with high-pressure water')
  })

  await t.test('parses quote_on_site model with baseline estimated price', () => {
    const desc = '[pricing:quote_on_site] EV Charger 50A Circuit Installation'
    const result = parseServicePricing(850.0, desc)

    assert.equal(result.model, 'quote_on_site')
    assert.equal(result.price, 850.0)
    assert.equal(result.formattedPrice, 'Quote on Site (Est. $850.00)')
    assert.equal(result.shortLabel, 'Quote')
  })

  await t.test('infers quote_on_site when description mentions quote on site with null price', () => {
    const result = parseServicePricing(null, 'Tree Removal Quote on Site')
    assert.equal(result.model, 'quote_on_site')
    assert.equal(result.formattedPrice, 'Quote on Site')
  })

  await t.test('preserves diagnostic_fee model with credited note', () => {
    const desc = '[pricing:diagnostic_fee] Comprehensive water heater diagnostic'
    const result = parseServicePricing(69.0, desc)

    assert.equal(result.model, 'diagnostic_fee')
    assert.equal(result.price, 69.0)
    assert.equal(result.formattedPrice, '$69.00 Diagnostic Fee')
    assert.equal(result.shortLabel, '$69.00 Diag')
  })

  await t.test('encode and clean description handles quote_on_site tag idempotently', () => {
    const original = 'Torsion spring replacement'
    const tagged = encodeServiceDescription(original, 'quote_on_site')
    assert.equal(tagged, '[pricing:quote_on_site] Torsion spring replacement')

    const cleaned = cleanServiceDescription(tagged)
    assert.equal(cleaned, 'Torsion spring replacement')

    const reTagged = encodeServiceDescription(tagged, 'quote_on_site')
    assert.equal(reTagged, '[pricing:quote_on_site] Torsion spring replacement')
  })
})

test('PHASE 4: 60-Second Instant Catalog Setup (Import Preset API)', async (t) => {
  await t.test('imports all 3 trade starter services for an organization with 0 services', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-trade-1',
          name: 'Blue Star Plumbing',
          owner_id: 'usr-trade-owner',
          industry: null
        }
      ],
      services: []
    })

    const req = new Request('http://localhost/api/client/services/import-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'plumbing' })
    })

    // Mock tenant context authorization
    const mockDeps = {
      customSupabase: {
        auth: db.auth,
        from: (tbl) => {
          if (tbl === 'profiles') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: 'usr-trade-owner', org_id: 'org-trade-1', role: 'owner' },
                    error: null
                  })
                })
              })
            }
          }
          if (tbl === 'organization_members') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { user_id: 'usr-trade-owner', org_id: 'org-trade-1', role: 'owner' },
                    error: null
                  })
                })
              })
            }
          }
          return db.from(tbl)
        }
      }
    }

    const res = await importPresetHandler(req, undefined, mockDeps)
    assert.equal(res.status, 201)

    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.importedCount, 3)
    assert.equal(data.skippedCount, 0)
    assert.equal(data.industry, 'Plumbing & Drain Cleaning')
    assert.equal(data.services.length, 3)

    // Verify blank / null price is preserved for quote_on_site services
    const quoteService = data.services.find((s) => s.name.includes('Water Heater'))
    assert.ok(quoteService)
    assert.equal(quoteService.price, null)
  })

  await t.test('is idempotent: skips services that already exist by name', async () => {
    const db = createMockDb({
      organizations: [
        {
          id: 'org-trade-2',
          name: 'Precision HVAC',
          owner_id: 'usr-trade-owner',
          industry: 'hvac'
        }
      ],
      services: [
        {
          id: 'svc-existing-1',
          org_id: 'org-trade-2',
          name: 'Seasonal HVAC Precision Tune-Up',
          duration_minutes: 60,
          price: 99,
          sort_order: 1
        }
      ]
    })

    const req = new Request('http://localhost/api/client/services/import-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ industry: 'hvac' })
    })

    const mockDeps = {
      customSupabase: {
        auth: db.auth,
        from: (tbl) => {
          if (tbl === 'profiles' || tbl === 'organization_members') {
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { user_id: 'usr-trade-owner', org_id: 'org-trade-2', role: 'owner' },
                    error: null
                  })
                })
              })
            }
          }
          return db.from(tbl)
        }
      }
    }

    const res = await importPresetHandler(req, undefined, mockDeps)
    assert.equal(res.status, 201)

    const data = await res.json()
    assert.equal(data.success, true)
    assert.equal(data.importedCount, 2, 'Should only import the 2 un-seeded services')
    assert.equal(data.skippedCount, 1, 'Should skip the 1 existing service')
  })
})
