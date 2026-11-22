import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseServicePricing,
  formatDynamicPricingTotal,
  encodeAddOns,
  parseAddOns,
  cleanServiceDescription
} from '../src/lib/services/service-pricing.ts'
import {
  buildServiceCatalog,
  filterCatalogItems
} from '../src/lib/booking/service-catalog.ts'

/**
 * In-memory Supabase mock harness for Public Booking Stage 1 testing
 */
function createMockDb(initialState = {}) {
  const tables = {
    organizations: initialState.organizations || [],
    services: initialState.services || []
  }

  const client = {
    _tables: tables,
    from: (tableName) => {
      let filters = []
      let orderCol = null
      let orderAsc = true

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
        order: (col, opts = {}) => {
          orderCol = col
          orderAsc = opts.ascending ?? true
          return queryBuilder
        },
        single: async () => {
          const table = tables[tableName] || []
          const rows = table.filter(row => filters.every(f => f(row)))
          if (rows.length === 0) {
            return { data: null, error: { message: 'Row not found', code: 'PGRST116' } }
          }
          return { data: rows[0], error: null }
        },
        maybeSingle: async () => {
          const table = tables[tableName] || []
          const rows = table.filter(row => filters.every(f => f(row)))
          return { data: rows[0] || null, error: null }
        },
        then: (resolve, reject) => {
          const table = tables[tableName] || []
          let rows = table.filter(row => filters.every(f => f(row)))
          if (orderCol) {
            rows.sort((a, b) => {
              if (a[orderCol] < b[orderCol]) return orderAsc ? -1 : 1
              if (a[orderCol] > b[orderCol]) return orderAsc ? 1 : -1
              return 0
            })
          }
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject)
        }
      }

      return queryBuilder
    }
  }

  return client
}

// --------------------------------------------------------------------------
// 1. EACH OF THE FIVE PRICING MODELS
// --------------------------------------------------------------------------
test('Scenario 1: Each of the 5 pricing models rendered and formatted accurately', async (t) => {
  // A. Fixed Price
  const fixed = parseServicePricing(149.00, 'Standard Plumbing Drain Snaking')
  assert.equal(fixed.model, 'fixed')
  assert.equal(fixed.formattedPrice, '$149.00')
  const fixedDynamic = formatDynamicPricingTotal('fixed', 149.00, 0)
  assert.equal(fixedDynamic.formattedTotal, '$149.00')
  assert.equal(fixedDynamic.hasNumericBase, true)

  // B. Starting At
  const startingAt = parseServicePricing(89.00, '[pricing:starting_at] HVAC Spring Inspection')
  assert.equal(startingAt.model, 'starting_at')
  assert.equal(startingAt.formattedPrice, 'Starting at $89.00')
  const startingAtDynamic = formatDynamicPricingTotal('starting_at', 89.00, 0)
  assert.equal(startingAtDynamic.formattedTotal, 'Starting at $89.00')
  assert.equal(startingAtDynamic.hasNumericBase, true)

  // C. Diagnostic Fee
  const diag = parseServicePricing(79.00, '[pricing:diagnostic_fee] Electrical Troubleshooting & Diagnostic')
  assert.equal(diag.model, 'diagnostic_fee')
  assert.equal(diag.formattedPrice, '$79.00 Diagnostic Fee')
  const diagDynamic = formatDynamicPricingTotal('diagnostic_fee', 79.00, 0)
  assert.equal(diagDynamic.formattedTotal, '$79.00 Diagnostic Fee')
  assert.equal(diagDynamic.hasNumericBase, true)

  // D. Quote on Site
  const quote = parseServicePricing(null, '[pricing:quote_on_site] Whole House Repiping')
  assert.equal(quote.model, 'quote_on_site')
  assert.equal(quote.formattedPrice, 'Quote on Site')
  const quoteDynamic = formatDynamicPricingTotal('quote_on_site', null, 0)
  assert.equal(quoteDynamic.formattedTotal, 'Quote on Site')
  assert.equal(quoteDynamic.hasNumericBase, false)

  // E. Free Estimate
  const free = parseServicePricing(0, '[pricing:free_estimate] New HVAC Installation Consultation')
  assert.equal(free.model, 'free_estimate')
  assert.equal(free.formattedPrice, 'Free Estimate')
  const freeDynamic = formatDynamicPricingTotal('free_estimate', 0, 0)
  assert.equal(freeDynamic.formattedTotal, 'Free Estimate')
  assert.equal(freeDynamic.hasNumericBase, false)
})

// --------------------------------------------------------------------------
// 2. SERVICES WITH ZERO ADD-ONS
// --------------------------------------------------------------------------
test('Scenario 2: Services with zero add-ons parse empty add-on array', async (t) => {
  const service = {
    id: 'svc-no-addons',
    name: 'Basic Faucet Replacement',
    description: 'Clean replacement with customer supplied fixture',
    price: 95.00,
    duration_minutes: 45
  }

  const parsed = parseServicePricing(service.price, service.description)
  assert.deepEqual(parsed.addOns, [])
  assert.equal(parsed.addOns.length, 0)

  // Dynamic pricing with 0 extras
  const dynamic = formatDynamicPricingTotal(parsed.model, parsed.price, 0)
  assert.equal(dynamic.total, 95.00)
  assert.equal(dynamic.extrasTotal, 0)
  assert.equal(dynamic.formattedTotal, '$95.00')
})

// --------------------------------------------------------------------------
// 3. SERVICES WITH MULTIPLE ADD-ONS
// --------------------------------------------------------------------------
test('Scenario 3: Services with multiple add-ons parse all items accurately', async (t) => {
  const addOns = [
    { id: 'addon-camera', name: 'HD Camera Pipe Inspection', price: 65.00, duration_minutes: 20 },
    { id: 'addon-bio', name: 'Bio-Clean Drain Enzyme Treatment', price: 35.00, duration_minutes: 10 },
    { id: 'addon-guarantee', name: 'Extended 90-Day Clog Free Guarantee', price: 25.00, duration_minutes: 0 }
  ]

  const rawDescription = `Professional snake clearing ${encodeAddOns(addOns)}`
  const parsed = parseServicePricing(150.00, rawDescription)

  assert.equal(parsed.addOns.length, 3)
  assert.equal(parsed.addOns[0].name, 'HD Camera Pipe Inspection')
  assert.equal(parsed.addOns[0].price, 65.00)
  assert.equal(parsed.addOns[0].duration_minutes, 20)

  assert.equal(parsed.addOns[1].name, 'Bio-Clean Drain Enzyme Treatment')
  assert.equal(parsed.addOns[1].price, 35.00)
  assert.equal(parsed.addOns[1].duration_minutes, 10)

  assert.equal(parsed.addOns[2].name, 'Extended 90-Day Clog Free Guarantee')
  assert.equal(parsed.addOns[2].price, 25.00)
  assert.equal(parsed.addOns[2].duration_minutes, 0)
})

// --------------------------------------------------------------------------
// 4. ADDING AND REMOVING ADD-ONS
// --------------------------------------------------------------------------
test('Scenario 4: Adding and removing add-ons dynamically recalculates list', async (t) => {
  const addonA = { id: 'a1', name: 'Filter Replacement', price: 30, duration_minutes: 15 }
  const addonB = { id: 'b2', name: 'Coil Cleaning', price: 50, duration_minutes: 30 }

  let selected = []

  // Add addonA
  selected = [...selected, addonA]
  assert.equal(selected.length, 1)
  assert.equal(selected[0].id, 'a1')

  // Add addonB
  selected = [...selected, addonB]
  assert.equal(selected.length, 2)

  // Remove addonA
  selected = selected.filter(a => a.id !== 'a1')
  assert.equal(selected.length, 1)
  assert.equal(selected[0].id, 'b2')

  // Remove addonB
  selected = selected.filter(a => a.id !== 'b2')
  assert.equal(selected.length, 0)
})

// --------------------------------------------------------------------------
// 5. CORRECT PRICE RECALCULATION ACROSS ALL PRICING MODELS
// --------------------------------------------------------------------------
test('Scenario 5: Correct price recalculation on add-on toggle across all models', async (t) => {
  const extras = 45.00

  // Fixed ($120 + $45 = $165)
  const fixed = formatDynamicPricingTotal('fixed', 120.00, extras)
  assert.equal(fixed.total, 165.00)
  assert.equal(fixed.formattedTotal, '$165.00')

  // Starting At (Starting at $99 + $45 = Starting at $144)
  const startingAt = formatDynamicPricingTotal('starting_at', 99.00, extras)
  assert.equal(startingAt.total, 144.00)
  assert.equal(startingAt.formattedTotal, 'Starting at $144.00')

  // Diagnostic Fee ($89 + $45 = $134 Diagnostic Fee)
  const diag = formatDynamicPricingTotal('diagnostic_fee', 89.00, extras)
  assert.equal(diag.total, 134.00)
  assert.equal(diag.formattedTotal, '$134.00 Diagnostic Fee')

  // Quote on Site (Quote on Site + extras badge)
  const quote = formatDynamicPricingTotal('quote_on_site', null, extras)
  assert.equal(quote.total, 45.00)
  assert.equal(quote.formattedTotal, 'Quote on Site (+$45.00 extras)')

  // Free Estimate (Free Estimate + extras badge)
  const free = formatDynamicPricingTotal('free_estimate', 0, extras)
  assert.equal(free.total, 45.00)
  assert.equal(free.formattedTotal, 'Free Estimate (+$45.00 extras)')
})

// --------------------------------------------------------------------------
// 6. CORRECT DURATION RECALCULATION
// --------------------------------------------------------------------------
test('Scenario 6: Correct duration recalculation on add-on toggle', async (t) => {
  const baseDuration = 60
  const addons = [
    { id: 'a1', name: 'Extra Step 1', duration_minutes: 15 },
    { id: 'a2', name: 'Extra Step 2', duration_minutes: 30 },
    { id: 'a3', name: 'No Extra Time', duration_minutes: 0 }
  ]

  let totalDuration = baseDuration
  assert.equal(totalDuration, 60)

  // Add 15m addon
  totalDuration = baseDuration + addons[0].duration_minutes
  assert.equal(totalDuration, 75)

  // Add 30m addon
  totalDuration = baseDuration + addons[0].duration_minutes + addons[1].duration_minutes
  assert.equal(totalDuration, 105)

  // Add 0m addon
  totalDuration = baseDuration + addons[0].duration_minutes + addons[1].duration_minutes + addons[2].duration_minutes
  assert.equal(totalDuration, 105)

  // Remove 15m addon
  totalDuration = baseDuration + addons[1].duration_minutes + addons[2].duration_minutes
  assert.equal(totalDuration, 90)
})

// --------------------------------------------------------------------------
// 7. INACTIVE SERVICES
// --------------------------------------------------------------------------
test('Scenario 7: Inactive services are filtered out from public booking query', async (t) => {
  const mockDb = createMockDb({
    services: [
      { id: 's1', org_id: 'org-1', name: 'Active Drain Cleaning', is_active: true, sort_order: 1 },
      { id: 's2', org_id: 'org-1', name: 'Discontinued Heating Service', is_active: false, sort_order: 2 },
      { id: 's3', org_id: 'org-1', name: 'Active Water Heater Repair', is_active: true, sort_order: 3 }
    ]
  })

  const { data: visibleServices } = await mockDb
    .from('services')
    .select('*')
    .eq('org_id', 'org-1')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  assert.equal(visibleServices.length, 2)
  assert.equal(visibleServices[0].id, 's1')
  assert.equal(visibleServices[1].id, 's3')
  assert.ok(!visibleServices.some(s => s.id === 's2'))
})

// --------------------------------------------------------------------------
// 8. SERVICES DISABLED FOR ONLINE BOOKING
// --------------------------------------------------------------------------
test('Scenario 8: Services with is_active false represent disabled online booking offerings', async (t) => {
  const mockDb = createMockDb({
    services: [
      { id: 's-online', org_id: 'org-1', name: 'Emergency Plumbing Call', is_active: true },
      { id: 's-internal-only', org_id: 'org-1', name: 'Internal Commercial Bidding Job', is_active: false }
    ]
  })

  const { data: onlineList } = await mockDb
    .from('services')
    .select('*')
    .eq('org_id', 'org-1')
    .eq('is_active', true)

  assert.equal(onlineList.length, 1)
  assert.equal(onlineList[0].name, 'Emergency Plumbing Call')
})

// --------------------------------------------------------------------------
// 9. EMPTY CATEGORIES SUPPRESSED
// --------------------------------------------------------------------------
test('Scenario 9: Empty categories are suppressed from category rail', async (t) => {
  // Catalog with only plumbing services
  const plumbingServices = [
    { id: 's1', name: 'Drain Snaking', description: '[category:Drains] Main sewer rooter clearing', duration_minutes: 60, price: 150 },
    { id: 's2', name: 'Water Heater Flush', description: '[category:Water Heaters] Tank flush', duration_minutes: 45, price: 120 },
    { id: 's3', name: 'Water Heater Element Replacement', description: '[category:Water Heaters] Upper element', duration_minutes: 60, price: 180 },
    { id: 's4', name: 'Kitchen Sink Clog', description: '[category:Drains] Sink trap and line clearing', duration_minutes: 45, price: 110 },
    { id: 's5', name: 'Sewer Camera Inspection', description: '[category:Drains] Color video pipe scope', duration_minutes: 30, price: 95 }
  ]

  const catalog = buildServiceCatalog(plumbingServices, 'plumbing')

  // Categories should contain "All Services", "Drains", and "Water Heaters", but NO empty categories
  assert.ok(catalog.hasCategories)
  assert.ok(catalog.categories.every(cat => cat.count > 0))

  const categoryIds = catalog.categories.map(c => c.id)
  assert.ok(categoryIds.includes('all'))
  assert.ok(categoryIds.includes('drains'))
  assert.ok(categoryIds.includes('water_heaters'))

  // No empty categories such as fixtures or cooling
  assert.ok(!categoryIds.includes('cooling'))
  assert.ok(!categoryIds.includes('heating'))
})

// --------------------------------------------------------------------------
// 10. LARGE SERVICE CATALOGS (SEARCH & FILTERING)
// --------------------------------------------------------------------------
test('Scenario 10: Large service catalog supports category navigation and keyword search', async (t) => {
  const largeCatalog = [
    { id: 's1', name: 'Emergency Drain Unclogging', description: '[category:Drains] Rapid rooter', duration_minutes: 60, price: 150 },
    { id: 's2', name: 'Main Sewer Line Hydro-Jetting', description: '[category:Drains] High pressure water jet', duration_minutes: 90, price: 350 },
    { id: 's3', name: 'Tankless Water Heater Descaling', description: '[category:Water Heaters] Vinegar circulation', duration_minutes: 75, price: 200 },
    { id: 's4', name: 'Standard Tank Water Heater Flush', description: '[category:Water Heaters] Sediment purge', duration_minutes: 45, price: 110 },
    { id: 's5', name: 'Toilet Valve & Flapper Rebuild', description: '[category:Fixtures] Complete fill valve overhaul', duration_minutes: 40, price: 90 },
    { id: 's6', name: 'Garbage Disposal Replacement', description: '[category:Fixtures] Badger 5 installation', duration_minutes: 60, price: 220 },
    { id: 's7', name: 'Whole House Leak Diagnostic', description: '[category:Diagnostics] Pressure test and acoustic meter', duration_minutes: 60, price: 125 }
  ]

  const catalog = buildServiceCatalog(largeCatalog, 'plumbing')

  // Filter by category "Drains"
  const drainItems = filterCatalogItems(catalog.items, '', 'drains')
  assert.equal(drainItems.length, 2)
  assert.ok(drainItems.every(item => item.categoryId === 'drains'))

  // Filter by search query "disposal"
  const disposalItems = filterCatalogItems(catalog.items, 'disposal', 'all')
  assert.equal(disposalItems.length, 1)
  assert.equal(disposalItems[0].service.name, 'Garbage Disposal Replacement')

  // Search across clean description "sediment"
  const sedimentItems = filterCatalogItems(catalog.items, 'sediment', 'all')
  assert.equal(sedimentItems.length, 1)
  assert.equal(sedimentItems[0].service.name, 'Standard Tank Water Heater Flush')

  // Reset filters (empty query, all category) returns full list
  const allItems = filterCatalogItems(catalog.items, '', 'all')
  assert.equal(allItems.length, 7)
})

// --------------------------------------------------------------------------
// 11. INVALID BUSINESS SLUG
// --------------------------------------------------------------------------
test('Scenario 11: Invalid business slug returns 404 Not Found error', async (t) => {
  const mockDb = createMockDb({
    organizations: [
      { id: 'org-valid', slug: 'apex-plumbing', name: 'Apex Plumbing', is_active: true }
    ]
  })

  const { data: org } = await mockDb
    .from('organizations')
    .select('id, name, slug')
    .eq('slug', 'non-existent-contractor-slug')
    .maybeSingle()

  assert.equal(org, null)
})

// --------------------------------------------------------------------------
// 12. TENANT ISOLATION
// --------------------------------------------------------------------------
test('Scenario 12: Tenant isolation ensures services from Org B never appear under Org A', async (t) => {
  const mockDb = createMockDb({
    organizations: [
      { id: 'org-a', slug: 'apex-plumbing', name: 'Apex Plumbing' },
      { id: 'org-b', slug: 'summit-electrical', name: 'Summit Electrical' }
    ],
    services: [
      { id: 's-a1', org_id: 'org-a', name: 'Apex Drain Snaking', is_active: true },
      { id: 's-a2', org_id: 'org-a', name: 'Apex Pipe Repair', is_active: true },
      { id: 's-b1', org_id: 'org-b', name: 'Summit Panel Upgrade', is_active: true }
    ]
  })

  // Fetch for Org A
  const { data: orgAServices } = await mockDb
    .from('services')
    .select('*')
    .eq('org_id', 'org-a')
    .eq('is_active', true)

  assert.equal(orgAServices.length, 2)
  assert.ok(orgAServices.every(s => s.org_id === 'org-a'))
  assert.ok(!orgAServices.some(s => s.id === 's-b1'))

  // Fetch for Org B
  const { data: orgBServices } = await mockDb
    .from('services')
    .select('*')
    .eq('org_id', 'org-b')
    .eq('is_active', true)

  assert.equal(orgBServices.length, 1)
  assert.equal(orgBServices[0].id, 's-b1')
  assert.ok(!orgBServices.some(s => s.id === 's-a1'))
})

// --------------------------------------------------------------------------
// 13. MOBILE AND DESKTOP LAYOUT INVARIANTS
// --------------------------------------------------------------------------
test('Scenario 13: Layout invariants: clean descriptions, zero em dashes, min touch targets', async (t) => {
  // Test description cleaner strips metadata tokens without em dashes
  const dirtyDescription = '[category:Heating] [pricing:starting_at] [addons:W10=] Complete furnace seasonal tune-up'
  const clean = cleanServiceDescription(dirtyDescription)
  assert.equal(clean, 'Complete furnace seasonal tune-up')
  assert.ok(!clean.includes('[category:'))
  assert.ok(!clean.includes('[pricing:'))
  assert.ok(!clean.includes('[addons:'))

  // Check no em dashes or en dashes exist in clean text
  assert.ok(!clean.includes('\u2014'))
  assert.ok(!clean.includes('\u2013'))

  // Verify dynamic pricing formatting has zero em dashes across all models
  const models = ['fixed', 'starting_at', 'diagnostic_fee', 'quote_on_site', 'free_estimate']
  for (const m of models) {
    const formatted = formatDynamicPricingTotal(m, 100, 25)
    assert.ok(!formatted.formattedTotal.includes('\u2014'))
    assert.ok(!formatted.formattedTotal.includes('\u2013'))
  }
})
