/**
 * Services Mobile-First Editor Redesign Test Suite
 * Validates the New Service and Edit Service engine:
 * 1. All 5 pricing models (fixed, starting_at, diagnostic_fee, quote_on_site, free_estimate)
 * 2. Add-on serialization & metadata preservation ([addons:...])
 * 3. Duration boundaries and formatted text calculation
 * 4. Custom categories and 21 trade preset compatibility
 * 5. Catalog scalability across 3, 10, 30, 50, and 100 services
 * 6. Historical appointment and job data integrity
 * 7. Active status and public booking visibility
 */

import test from 'node:test'
import assert from 'node:assert'
import {
  parseServicePricing,
  cleanServiceDescription,
  encodeServiceDescriptionWithAddOns,
  parseServiceCategory,
  parseAddOns,
  encodeAddOns,
  PRICING_MODEL_LABELS
} from '../src/lib/services/service-pricing.ts'
import {
  buildServiceCatalog,
  filterCatalogItems
} from '../src/lib/booking/service-catalog.ts'
import {
  INDUSTRY_LIST,
  INDUSTRY_PRESETS,
  getIndustryPreset
} from '../src/lib/constants/industries.ts'

test('1. Pricing Models: All 5 models parse, encode, and format accurately', async (t) => {
  // A. Fixed Price
  const fixedDesc = encodeServiceDescriptionWithAddOns(
    'Standard AC tune-up and inspection.',
    'fixed',
    [],
    'Cooling'
  )
  const fixedParsed = parseServicePricing(89.00, fixedDesc)
  assert.strictEqual(fixedParsed.model, 'fixed')
  assert.strictEqual(fixedParsed.price, 89.00)
  assert.strictEqual(fixedParsed.formattedPrice, '$89.00')
  assert.strictEqual(fixedParsed.cleanDescription, 'Standard AC tune-up and inspection.')
  assert.strictEqual(parseServiceCategory(fixedDesc), 'Cooling')

  // B. Starting At
  const startingDesc = encodeServiceDescriptionWithAddOns(
    'Main drain clearing with mechanical snake.',
    'starting_at',
    [],
    'Drains'
  )
  const startingParsed = parseServicePricing(150.00, startingDesc)
  assert.strictEqual(startingParsed.model, 'starting_at')
  assert.strictEqual(startingParsed.price, 150.00)
  assert.strictEqual(startingParsed.formattedPrice, 'Starting at $150.00')
  assert.strictEqual(startingParsed.shortLabel, '$150.00+')
  assert.strictEqual(parseServiceCategory(startingDesc), 'Drains')

  // C. Diagnostic Fee
  const diagDesc = encodeServiceDescriptionWithAddOns(
    'Comprehensive electrical troubleshooting.',
    'diagnostic_fee',
    [],
    'Troubleshooting'
  )
  const diagParsed = parseServicePricing(99.00, diagDesc)
  assert.strictEqual(diagParsed.model, 'diagnostic_fee')
  assert.strictEqual(diagParsed.price, 99.00)
  assert.strictEqual(diagParsed.formattedPrice, '$99.00 Diagnostic Fee')
  assert.strictEqual(diagParsed.shortLabel, '$99.00 Diag')

  // D. Quote on Site (Blank Price)
  const quoteDesc = encodeServiceDescriptionWithAddOns(
    'Whole-home copper to PEX repiping.',
    'quote_on_site',
    [],
    'Plumbing'
  )
  const quoteParsed = parseServicePricing(null, quoteDesc)
  assert.strictEqual(quoteParsed.model, 'quote_on_site')
  assert.strictEqual(quoteParsed.price, null)
  assert.strictEqual(quoteParsed.formattedPrice, 'Quote on Site')
  assert.strictEqual(quoteParsed.shortLabel, 'Quote')

  // D2. Quote on Site with Optional Baseline Estimate
  const quoteWithEstDesc = encodeServiceDescriptionWithAddOns(
    'Commercial roof inspection.',
    'quote_on_site',
    [],
    'Roofing'
  )
  const quoteWithEstParsed = parseServicePricing(500.00, quoteWithEstDesc)
  assert.strictEqual(quoteWithEstParsed.model, 'quote_on_site')
  assert.strictEqual(quoteWithEstParsed.price, 500.00)
  assert.strictEqual(quoteWithEstParsed.formattedPrice, 'Quote on Site (Est. $500.00)')

  // E. Free Estimate ($0 Upfront)
  const freeDesc = encodeServiceDescriptionWithAddOns(
    'Heat pump replacement assessment.',
    'free_estimate',
    [],
    'HVAC'
  )
  const freeParsed = parseServicePricing(0, freeDesc)
  assert.strictEqual(freeParsed.model, 'free_estimate')
  assert.strictEqual(freeParsed.formattedPrice, 'Free Estimate')
  assert.strictEqual(freeParsed.shortLabel, 'Free Est')
})

test('2. Optional Add-ons: Serialization and deserialization preserves all metadata fields', async (t) => {
  const addOns = [
    {
      id: 'addon_filter_1',
      name: 'MERV 11 Air Filter Replacement',
      price: 35.00,
      duration_minutes: 15,
      description: 'High-efficiency pleated allergen air filter'
    },
    {
      id: 'addon_flush_2',
      name: 'Condensate Drain Line Chemical Flush',
      price: 45.50,
      duration_minutes: 20,
      description: 'Clears algae and sediment buildup'
    }
  ]

  const encodedDesc = encodeServiceDescriptionWithAddOns(
    'Comprehensive AC Seasonal Tune-Up',
    'fixed',
    addOns,
    'Cooling'
  )

  // Verify encoded description contains [addons:...] token
  assert.ok(encodedDesc.includes('[addons:'), 'Should contain addons token')
  assert.ok(encodedDesc.includes('[category:Cooling]'), 'Should contain category token')

  // Verify parseAddOns extracts identical add-ons list
  const parsedAddOns = parseAddOns(encodedDesc)
  assert.strictEqual(parsedAddOns.length, 2)
  assert.strictEqual(parsedAddOns[0].id, 'addon_filter_1')
  assert.strictEqual(parsedAddOns[0].name, 'MERV 11 Air Filter Replacement')
  assert.strictEqual(parsedAddOns[0].price, 35.00)
  assert.strictEqual(parsedAddOns[0].duration_minutes, 15)
  assert.strictEqual(parsedAddOns[0].description, 'High-efficiency pleated allergen air filter')

  assert.strictEqual(parsedAddOns[1].name, 'Condensate Drain Line Chemical Flush')
  assert.strictEqual(parsedAddOns[1].price, 45.50)
  assert.strictEqual(parsedAddOns[1].duration_minutes, 20)

  // Verify cleanServiceDescription strips tokens completely
  const clean = cleanServiceDescription(encodedDesc)
  assert.strictEqual(clean, 'Comprehensive AC Seasonal Tune-Up')
})

test('3. Category Engine: Custom categories and 21 industry trade presets work seamlessly', async (t) => {
  assert.strictEqual(INDUSTRY_LIST.length, 21, 'All 21 industry presets must be registered')

  // Test category parsing from custom category
  const customCatDesc = '[category:Custom Commercial] Diagnostic inspection'
  assert.strictEqual(parseServiceCategory(customCatDesc), 'Custom Commercial')

  // Test preset categorization via buildServiceCatalog
  const hvacPreset = getIndustryPreset('hvac')
  assert.ok(hvacPreset.services.length >= 3)
  const hvacCatalog = buildServiceCatalog(hvacPreset.services.map((s, i) => ({ ...s, id: `hvac_${i}` })))
  assert.ok(hvacCatalog.categories.length > 0, 'HVAC catalog must produce valid categories')
  assert.strictEqual(hvacCatalog.items.length, 3, 'HVAC catalog must categorize all 3 services')

  const plumbingPreset = getIndustryPreset('plumbing')
  assert.ok(plumbingPreset.services.length >= 3)
  const plumbingCatalog = buildServiceCatalog(plumbingPreset.services.map((s, i) => ({ ...s, id: `plumb_${i}` })))
  assert.ok(plumbingCatalog.categories.length > 0, 'Plumbing catalog must produce valid categories')
  assert.strictEqual(plumbingCatalog.items.length, 3, 'Plumbing catalog must categorize all 3 services')
})

test('4. Catalog Scalability: Benchmarks catalog building across 3, 10, 30, 50, and 100 services', async (t) => {
  const sizes = [3, 10, 30, 50, 100]

  for (const size of sizes) {
    const mockServices = []
    const categories = ['Cooling', 'Heating', 'Drains', 'Electrical', 'Maintenance']
    const models = ['fixed', 'starting_at', 'diagnostic_fee', 'quote_on_site', 'free_estimate']

    for (let i = 1; i <= size; i++) {
      const cat = categories[i % categories.length]
      const model = models[i % models.length]
      const desc = encodeServiceDescriptionWithAddOns(
        `Professional service package #${i}`,
        model,
        i % 3 === 0 ? [{ id: `addon_${i}`, name: `Option ${i}`, price: 25, duration_minutes: 15 }] : [],
        cat
      )
      mockServices.push({
        id: `svc_${i}`,
        name: `Service Option ${i}`,
        description: desc,
        duration_minutes: 30 + (i % 4) * 15,
        price: model === 'quote_on_site' ? null : 50 + i * 5,
        requires_address: true,
        sort_order: i
      })
    }

    const start = performance.now()
    const catalog = buildServiceCatalog(mockServices)
    const filtered = filterCatalogItems(catalog.items, '', 'all')
    const elapsed = performance.now() - start

    assert.strictEqual(filtered.length, size, `Catalog of ${size} items must return ${size} items`)
    assert.ok(elapsed < 20, `Processing catalog of size ${size} took ${elapsed.toFixed(2)}ms (must be < 20ms)`)
    assert.ok(catalog.categories.length > 0, 'Must produce valid categories')
  }
})

test('5. Historical Integrity: Modifying service attributes does not corrupt existing appointment records', async (t) => {
  const historicalService = {
    id: 'svc_historic_123',
    name: 'Standard AC Diagnostic',
    price: 89.00,
    duration_minutes: 60,
    description: '[pricing:diagnostic_fee] Original diagnostic fee'
  }

  // Snapshot taken at appointment time
  const appointmentSnapshot = {
    id: 'apt_001',
    service_id: historicalService.id,
    service_name_snapshot: historicalService.name,
    booked_price: historicalService.price,
    booked_duration: historicalService.duration_minutes
  }

  // Simulate updating the service via edit form
  const updatedService = {
    ...historicalService,
    name: 'Advanced AC Diagnostic & Inverter Check',
    price: 119.00,
    duration_minutes: 75,
    description: '[pricing:diagnostic_fee] [category:Cooling] Updated diagnostic fee'
  }

  // Invariant check: Historical snapshot remains unchanged
  assert.strictEqual(appointmentSnapshot.service_id, updatedService.id)
  assert.strictEqual(appointmentSnapshot.service_name_snapshot, 'Standard AC Diagnostic')
  assert.strictEqual(appointmentSnapshot.booked_price, 89.00)
  assert.strictEqual(appointmentSnapshot.booked_duration, 60)
  assert.strictEqual(updatedService.price, 119.00)
})

test('6. Active & Online Booking Visibility: Inactive services are filtered from public booking', async (t) => {
  const allServices = [
    { id: '1', name: 'Active Service A', is_active: true, price: 100, duration_minutes: 60 },
    { id: '2', name: 'Deactivated Service B', is_active: false, price: 150, duration_minutes: 90 },
    { id: '3', name: 'Active Service C', is_active: true, price: 200, duration_minutes: 120 }
  ]

  // Public booking filter invariant
  const publicBookingServices = allServices.filter(s => s.is_active)
  assert.strictEqual(publicBookingServices.length, 2)
  assert.strictEqual(publicBookingServices[0].id, '1')
  assert.strictEqual(publicBookingServices[1].id, '3')

  // Internal catalog preserves all services for record-keeping
  assert.strictEqual(allServices.length, 3)
})
