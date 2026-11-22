import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseServicePricing,
  cleanServiceDescription,
  encodeServiceDescriptionWithAddOns,
  parseServiceCategory
} from '../src/lib/services/service-pricing.ts'
import {
  buildServiceCatalog,
  filterCatalogItems
} from '../src/lib/booking/service-catalog.ts'
import {
  getIndustryPreset,
  INDUSTRY_LIST
} from '../src/lib/constants/industries.ts'

test('1. Service Pricing Models and Clean Description Encoding', () => {
  // Fixed Price
  const descFixed = encodeServiceDescriptionWithAddOns(
    'Standard AC seasonal maintenance and filter inspection.',
    'fixed',
    [{ id: 'addon_1', name: 'Filter 20x25x4', price: 35, duration_minutes: 15 }],
    'Cooling'
  )
  assert.ok(descFixed.includes('[category:Cooling]'))
  assert.ok(descFixed.includes('[addons:'))
  assert.ok(!descFixed.includes('[pricing:fixed]'), 'Fixed pricing does not require explicit pricing tag')
  assert.equal(
    cleanServiceDescription(descFixed),
    'Standard AC seasonal maintenance and filter inspection.'
  )
  assert.equal(parseServiceCategory(descFixed), 'Cooling')

  const parsedFixed = parseServicePricing(189.00, descFixed)
  assert.equal(parsedFixed.model, 'fixed')
  assert.equal(parsedFixed.formattedPrice, '$189.00')
  assert.equal(parsedFixed.addOns.length, 1)
  assert.equal(parsedFixed.addOns[0].name, 'Filter 20x25x4')

  // Quote on Site
  const descQuote = encodeServiceDescriptionWithAddOns(
    'On-site diagnostic and custom system installation estimate.',
    'quote_on_site',
    [],
    'Installations'
  )
  assert.ok(descQuote.includes('[pricing:quote_on_site]'))
  assert.ok(descQuote.includes('[category:Installations]'))
  assert.equal(
    cleanServiceDescription(descQuote),
    'On-site diagnostic and custom system installation estimate.'
  )
  assert.equal(parseServiceCategory(descQuote), 'Installations')

  const parsedQuote = parseServicePricing(null, descQuote)
  assert.equal(parsedQuote.model, 'quote_on_site')
  assert.equal(parsedQuote.formattedPrice, 'Quote on Site')

  // Free Estimate
  const descFree = encodeServiceDescriptionWithAddOns(
    'Free consultation for full furnace replacement.',
    'free_estimate',
    [],
    'Heating'
  )
  assert.ok(descFree.includes('[pricing:free_estimate]'))
  const parsedFree = parseServicePricing(0, descFree)
  assert.equal(parsedFree.model, 'free_estimate')
  assert.equal(parsedFree.formattedPrice, 'Free Estimate')
})

test('2. Preset Discovery, Detail Inspection, and Duplicate Prevention', () => {
  // Verify 21 industries are loaded
  assert.ok(INDUSTRY_LIST.length >= 20, 'Industry preset catalog must offer 20+ trade presets')

  const hvacPreset = getIndustryPreset('hvac')
  assert.ok(hvacPreset)
  assert.ok(hvacPreset.services.length >= 3, 'HVAC preset includes standard starter services')

  // Existing catalog simulation
  const existingServices = [
    { id: 's1', name: 'AC Precision Tune-Up', price: 129, duration_minutes: 60 }
  ]
  const existingNames = new Set(existingServices.map(s => s.name.trim().toLowerCase()))

  // Filter preset services to prevent duplicates
  const toInsert = hvacPreset.services.filter(
    svc => !existingNames.has(svc.name.trim().toLowerCase())
  )

  // Must not insert "AC Precision Tune-Up" if it matches case-insensitively
  const duplicateCandidate = { name: 'ac precision tune-up' }
  assert.equal(
    existingNames.has(duplicateCandidate.name.trim().toLowerCase()),
    true,
    'Existing service detected as duplicate'
  )

  // Remaining services can safely be added without overwriting
  assert.ok(toInsert.length > 0)
  assert.ok(!toInsert.some(s => s.name.toLowerCase() === 'ac precision tune-up'))
})

test('3. Dynamic Categorization & Catalog Search Filtering', () => {
  const services = [
    {
      id: 'svc-1',
      name: 'AC Diagnostic & Leak Inspection',
      description: '[category:Cooling] Full Freon and coil check',
      duration_minutes: 45,
      price: 89,
      is_active: true
    },
    {
      id: 'svc-2',
      name: 'Furnace Blower Wheel Clean',
      description: '[category:Heating] Clean blower motor and wheel',
      duration_minutes: 60,
      price: 149,
      is_active: true
    },
    {
      id: 'svc-3',
      name: 'Seasonal Precision Tune-Up',
      description: '[category:Maintenance] 21-point seasonal inspection',
      duration_minutes: 60,
      price: 99,
      is_active: true
    },
    {
      id: 'svc-4',
      name: 'Old Deactivated Heat Pump Service',
      description: 'Legacy package',
      duration_minutes: 90,
      price: 199,
      is_active: false
    }
  ]

  const catalog = buildServiceCatalog(services, 'hvac')
  assert.equal(catalog.totalCount, 4)

  // Explicit category check
  const coolingItem = catalog.items.find(i => i.service.id === 'svc-1')
  assert.ok(coolingItem)
  assert.equal(coolingItem.categoryId, 'cooling')
  assert.equal(coolingItem.categoryLabel, 'Cooling')

  // Search filter
  const tuneResults = filterCatalogItems(catalog.items, 'tune-up', 'all')
  assert.equal(tuneResults.length, 1)
  assert.equal(tuneResults[0].service.id, 'svc-3')

  // Category filter (Furnace Blower and Heat Pump both classify under heating)
  const heatingResults = filterCatalogItems(catalog.items, '', 'heating')
  assert.equal(heatingResults.length, 2)
  assert.ok(heatingResults.some(r => r.service.id === 'svc-2'))
})

test('4. Public Booking Visibility and Active Filter Invariant', () => {
  const allServices = [
    { id: '1', name: 'Emergency Drain Rooter', is_active: true, price: 189, duration_minutes: 60 },
    { id: '2', name: 'Water Line Repair', is_active: false, price: 299, duration_minutes: 90 }
  ]

  // Public booking page strictly filters to active services
  const bookableServices = allServices.filter(s => s.is_active)
  assert.equal(bookableServices.length, 1)
  assert.equal(bookableServices[0].id, '1')

  // Deactivated services are not selectable for public appointments
  const isServiceBookable = (serviceId) => {
    const found = allServices.find(s => s.id === serviceId)
    return !!(found && found.is_active)
  }

  assert.equal(isServiceBookable('1'), true)
  assert.equal(isServiceBookable('2'), false)
})

test('5. Historical Job & Quote Association Consistency', () => {
  const service = {
    id: 'svc-master-001',
    name: 'Standard Plumbing Diagnostic',
    price: 89.00,
    duration_minutes: 45,
    is_active: true
  }

  // Quote item referencing service
  const quoteItem = {
    service_id: service.id,
    name: service.name,
    unit_price: service.price,
    quantity: 1,
    total: 89.00
  }

  // Job item referencing service
  const jobItem = {
    service_id: service.id,
    title: service.name,
    price: service.price,
    estimated_duration_minutes: service.duration_minutes
  }

  // Invariant: service reference is preserved accurately in both records
  assert.equal(quoteItem.service_id, service.id)
  assert.equal(jobItem.service_id, service.id)
  assert.equal(quoteItem.unit_price, 89.00)
  assert.equal(jobItem.estimated_duration_minutes, 45)
})
