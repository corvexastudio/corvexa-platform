import test from 'node:test'
import assert from 'node:assert/strict'
import { buildServiceCatalog, filterCatalogItems } from '../src/lib/booking/service-catalog.ts'

test('buildServiceCatalog categorizes plumbing services accurately', () => {
  const plumbingServices = [
    { id: '1', name: 'Plumbing Diagnostic & Leak Inspection', duration_minutes: 45, price: null, sort_order: 1 },
    { id: '2', name: 'Main Drain & Sewer Rooter Clearing', duration_minutes: 60, price: null, sort_order: 2 },
    { id: '3', name: 'Water Heater Diagnostic & Flush', duration_minutes: 60, price: null, sort_order: 3 },
    { id: '4', name: 'Toilet Rebuild & Valve Replacement', duration_minutes: 45, price: 150, sort_order: 4 },
    { id: '5', name: 'Hydro-Jetting High-Pressure Sewer Scrub', duration_minutes: 90, price: null, sort_order: 5 }
  ]

  const catalog = buildServiceCatalog(plumbingServices, 'plumbing')

  assert.equal(catalog.totalCount, 5)
  assert.equal(catalog.hasCategories, true)
  assert.ok(catalog.categories.length >= 3, 'Must have All, Popular, and specific categories')

  // Check specific categories
  const drainItems = catalog.items.filter(i => i.categoryId === 'drains')
  assert.equal(drainItems.length, 2, 'Main Drain and Hydro-Jetting must be categorized as drains')

  const waterHeaterItems = catalog.items.filter(i => i.categoryId === 'water_heaters')
  assert.equal(waterHeaterItems.length, 1, 'Water Heater Diagnostic must be categorized as water_heaters')

  const leakItems = catalog.items.filter(i => i.categoryId === 'leaks')
  assert.equal(leakItems.length, 1, 'Plumbing Diagnostic must be categorized as leaks')
})

test('buildServiceCatalog categorizes HVAC services across heating, cooling, and tune-ups', () => {
  const hvacServices = [
    { id: '1', name: 'AC Diagnostic & Refrigerant Inspection', duration_minutes: 45, sort_order: 1 },
    { id: '2', name: 'Furnace Inspection & Heat Exchanger Check', duration_minutes: 60, sort_order: 2 },
    { id: '3', name: 'Seasonal HVAC Precision Tune-Up', duration_minutes: 60, sort_order: 3 },
    { id: '4', name: 'Emergency Heating & AC Repair Service', duration_minutes: 60, sort_order: 4 },
    { id: '5', name: 'Thermostat Replacement & Smart Install', duration_minutes: 30, sort_order: 5 }
  ]

  const catalog = buildServiceCatalog(hvacServices, 'hvac')
  assert.equal(catalog.hasCategories, true)

  const cooling = catalog.items.find(i => i.service.id === '1')
  assert.equal(cooling.categoryId, 'cooling')

  const heating = catalog.items.find(i => i.service.id === '2')
  assert.equal(heating.categoryId, 'heating')

  const tuneUp = catalog.items.find(i => i.service.id === '3')
  assert.equal(tuneUp.categoryId, 'maintenance')
})

test('buildServiceCatalog respects explicit [category:Custom Name] tags', () => {
  const customServices = [
    { id: '1', name: 'Emergency Board-Up', description: '[category:Disaster Recovery] 24/7 board-up', duration_minutes: 60 },
    { id: '2', name: 'Water Extraction', description: '[category:Disaster Recovery] High volume extraction', duration_minutes: 120 },
    { id: '3', name: 'Mold Remediation', description: '[category:Environmental] Full remediation', duration_minutes: 180 },
    { id: '4', name: 'Air Quality Test', description: '[category:Environmental] Spore test', duration_minutes: 45 },
    { id: '5', name: 'General Consultation', description: 'Standard consult', duration_minutes: 30 }
  ]

  const catalog = buildServiceCatalog(customServices, 'general')
  const disasterItems = catalog.items.filter(i => i.categoryId === 'disaster_recovery')
  assert.equal(disasterItems.length, 2)
  assert.equal(disasterItems[0].categoryLabel, 'Disaster Recovery')
})

test('filterCatalogItems filters by query and active category accurately', () => {
  const services = [
    { id: '1', name: 'Main Drain & Sewer Rooter', duration_minutes: 60, sort_order: 1 },
    { id: '2', name: 'Water Heater Flush', duration_minutes: 60, sort_order: 2 },
    { id: '3', name: 'Toilet Leak Diagnostic', duration_minutes: 45, sort_order: 3 },
    { id: '4', name: 'Garbage Disposal Replacement', duration_minutes: 45, sort_order: 4 },
    { id: '5', name: 'Hydro-Jet Sewer Scrub', duration_minutes: 90, sort_order: 5 }
  ]

  const catalog = buildServiceCatalog(services, 'plumbing')

  // Search by query "sewer"
  const sewerResults = filterCatalogItems(catalog.items, 'sewer', 'all')
  assert.equal(sewerResults.length, 2, 'Must match Main Drain & Sewer Rooter and Hydro-Jet Sewer Scrub')

  // Search by query "heater"
  const heaterResults = filterCatalogItems(catalog.items, 'heater', 'all')
  assert.equal(heaterResults.length, 1)
  assert.equal(heaterResults[0].service.id, '2')

  // Filter by category "drains"
  const drainCategoryResults = filterCatalogItems(catalog.items, '', 'drains')
  assert.equal(drainCategoryResults.length, 2)

  // Combined category and query: drains category + query "hydro"
  const combined = filterCatalogItems(catalog.items, 'hydro', 'drains')
  assert.equal(combined.length, 1)
  assert.equal(combined[0].service.id, '5')
})

test('Small catalogs (<5 services) gracefully adapt without category clutter', () => {
  const threeServices = [
    { id: '1', name: 'Plumbing Diagnostic', duration_minutes: 45 },
    { id: '2', name: 'Water Heater Diagnostic', duration_minutes: 60 },
    { id: '3', name: 'Main Drain Clearing', duration_minutes: 60 }
  ]

  const catalog = buildServiceCatalog(threeServices, 'plumbing')
  assert.equal(catalog.totalCount, 3)
  assert.equal(catalog.hasCategories, false, 'Catalogs under 5 items must not show category clutter')
})
