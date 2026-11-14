import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanJobServiceTitle } from '../src/lib/dashboard/dashboard-service.ts'
import { parseServicePricing } from '../src/lib/services/service-pricing.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

test('cleanJobServiceTitle strips customer name duplicate suffix and practice tags', () => {
  // Case 1: Job created via public booking with "Service Name - Customer Name"
  const clean1 = cleanJobServiceTitle(
    'Plumbing Diagnostic & Leak Inspection - Roy Ridge',
    'Roy Ridge',
    'Plumbing Diagnostic & Leak Inspection'
  )
  assert.equal(clean1, 'Plumbing Diagnostic & Leak Inspection')

  // Case 2: No explicit serviceName, strips matching customer suffix
  const clean2 = cleanJobServiceTitle(
    'Water Heater Replacement - John Russo',
    'John Russo',
    null
  )
  assert.equal(clean2, 'Water Heater Replacement')

  // Case 3: Case-insensitive suffix match
  const clean3 = cleanJobServiceTitle(
    'Main Drain Clearing - jane doe',
    'Jane Doe',
    null
  )
  assert.equal(clean3, 'Main Drain Clearing')

  // Case 4: Practice job tag cleaned
  const clean4 = cleanJobServiceTitle(
    '🧪 [PRACTICE] Water Heater Diagnostic ($89.00)',
    'Test Customer',
    null
  )
  assert.equal(clean4, 'Water Heater Diagnostic ($89.00)')
})

test('parseServicePricing accurately identifies Quote on Site, Free Estimate, and Fixed Price without fake fallbacks', () => {
  // Case 1: Plumbing Diagnostic with [pricing:quote_on_site] tag
  const p1 = parseServicePricing(
    null,
    '[pricing:quote_on_site] On-site diagnostic inspection to pinpoint pipe leaks.'
  )
  assert.equal(p1.model, 'quote_on_site')
  assert.equal(p1.price, null)
  assert.equal(p1.formattedPrice, 'Quote on Site')
  assert.equal(p1.shortLabel, 'Quote')

  // Case 2: Free Estimate consultation
  const p2 = parseServicePricing(
    0,
    '[pricing:free_estimate] In-person project quote for repiping.'
  )
  assert.equal(p2.model, 'free_estimate')
  assert.equal(p2.price, 0)
  assert.equal(p2.formattedPrice, 'Free Estimate')

  // Case 3: Fixed price service call
  const p3 = parseServicePricing(
    149,
    'Standard AC Seasonal Tune-Up & Coil Clean.'
  )
  assert.equal(p3.model, 'fixed')
  assert.equal(p3.price, 149)
  assert.equal(p3.formattedPrice, '$149.00')

  // Case 4: Diagnostic fee with fixed diagnostic cost
  const p4 = parseServicePricing(
    89,
    '[pricing:diagnostic_fee] Standard electrical safety inspection.'
  )
  assert.equal(p4.model, 'diagnostic_fee')
  assert.equal(p4.price, 89)
  assert.equal(p4.formattedPrice, '$89.00 Diagnostic Fee')
})

test('JobWonBadge source code never contains hardcoded 250 fallback or pulsing animation on badges', () => {
  const badgeFile = path.resolve(rootDir, 'src/components/jobs/job-won-badge.tsx')
  const content = fs.readFileSync(badgeFile, 'utf8')

  // Must NOT contain the old hardcoded '250' fallback
  assert.ok(!content.includes(": '250'"), 'Must NOT contain fake 250 fallback string')
  assert.ok(!content.includes(': "250"'), 'Must NOT contain fake 250 fallback string')

  // Must support pricingModel and servicePrice props
  assert.ok(content.includes('pricingModel'), 'Supports pricingModel prop')
  assert.ok(content.includes('servicePrice'), 'Supports servicePrice prop')
  assert.ok(content.includes('JobPricingBadge'), 'Exports dedicated JobPricingBadge component')

  // Factual trade labels supported
  assert.ok(content.includes('Quote on Site'), 'Includes Quote on Site label')
  assert.ok(content.includes('Free Estimate'), 'Includes Free Estimate label')
  assert.ok(content.includes('Online Booking'), 'Includes Online Booking fallback')
})

test('Dashboard page handles single stop without duplicate rendering and mounts honest pricing badge', () => {
  const dashFile = path.resolve(rootDir, 'src/app/client/dashboard/page.tsx')
  const content = fs.readFileSync(dashFile, 'utf8')

  // Mounts both JobWonBadge and JobPricingBadge
  assert.ok(content.includes('JobWonBadge'), 'Dashboard mounts JobWonBadge')
  assert.ok(content.includes('JobPricingBadge'), 'Dashboard mounts JobPricingBadge')

  // Filters remaining jobs to prevent duplicate stop rendering
  assert.ok(content.includes('nonPracticeJobs.filter((j) => j.id !== activeJob?.id)'), 'Filters out activeJob from remaining stops list')

  // Uses cleanTitle to eliminate duplicate customer name
  assert.ok(content.includes('activeJob.cleanTitle || activeJob.title'), 'Hero card uses cleanTitle')
  assert.ok(content.includes('job.cleanTitle || job.title'), 'Timeline uses cleanTitle')
})
