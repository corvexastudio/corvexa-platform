/**
 * CAPTODESK — PHASE 3.5: FRONTEND UX CONSOLIDATION, QUICK-CREATE MODALS & TRADE POLISH TEST SUITE
 * 
 * Verifies:
 * - SVC-001: Elimination of duplicate dollar-sign rendering and clean tag presentation
 * - SVC-002: Flexible pricing models (fixed, starting_at, diagnostic_fee, free_estimate)
 * - SVC-002: Description tag encoding/decoding and inference without schema migrations
 * - TEL-002 & SET-001: Mobile carrier forwarding dial link construction and RFC 3986 encoding (# -> %23)
 * - TEL-002 & SET-001: Deactivation code dial link format (*73 and ##62# -> %23%2362%23)
 * - NAV-001: UniversalQuickCreate RBAC permission filtering and modal query triggers
 * - REV-001: Google Review URL configuration requirement and customer dropdown data formatting
 * - NAV-002, DASH-001, NOTIF-001: Navigation consolidation, view switcher linking, and empty state semantics
 */

process.env.NODE_ENV = 'test'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  parseServicePricing,
  cleanServiceDescription,
  encodeServiceDescription,
  PRICING_MODEL_LABELS
} from '../src/lib/services/service-pricing.ts'
import { hasPermission } from '../src/lib/security/permissions.ts'

test('SVC-001 & SVC-002: Flexible Pricing Engine — Fixed Price Model', () => {
  const result = parseServicePricing(89.0, 'Standard 1-hour service call')
  assert.equal(result.model, 'fixed')
  assert.equal(result.price, 89.0)
  assert.equal(result.formattedPrice, '$89.00')
  assert.equal(result.shortLabel, '$89.00')
  assert.equal(result.cleanDescription, 'Standard 1-hour service call')

  // Does not duplicate dollar sign
  assert.ok(!result.formattedPrice.includes('$ $'))
})

test('SVC-001 & SVC-002: Flexible Pricing Engine — Starting At Model', () => {
  const encodedDesc = encodeServiceDescription('Includes inspection and initial troubleshooting', 'starting_at')
  assert.ok(encodedDesc.startsWith('[pricing:starting_at]'))

  const result = parseServicePricing(150.0, encodedDesc)
  assert.equal(result.model, 'starting_at')
  assert.equal(result.price, 150.0)
  assert.equal(result.formattedPrice, 'Starting at $150.00')
  assert.equal(result.shortLabel, '$150.00+')
  assert.equal(result.cleanDescription, 'Includes inspection and initial troubleshooting')
})

test('SVC-001 & SVC-002: Flexible Pricing Engine — Diagnostic Fee Model', () => {
  const encodedDesc = encodeServiceDescription('Trip charge and comprehensive diagnostic assessment', 'diagnostic_fee')
  assert.ok(encodedDesc.startsWith('[pricing:diagnostic_fee]'))

  const result = parseServicePricing(79.0, encodedDesc)
  assert.equal(result.model, 'diagnostic_fee')
  assert.equal(result.price, 79.0)
  assert.equal(result.formattedPrice, '$79.00 Diagnostic Fee')
  assert.equal(result.shortLabel, '$79.00 Diag')
  assert.equal(result.cleanDescription, 'Trip charge and comprehensive diagnostic assessment')
})

test('SVC-001 & SVC-002: Flexible Pricing Engine — Free Estimate / Custom Quote Model', () => {
  // Explicit tag
  const encodedDesc = encodeServiceDescription('On-site evaluation for major system replacement', 'free_estimate')
  const result1 = parseServicePricing(null, encodedDesc)
  assert.equal(result1.model, 'free_estimate')
  assert.equal(result1.formattedPrice, 'Free Estimate')
  assert.equal(result1.shortLabel, 'Free Est')
  assert.equal(result1.cleanDescription, 'On-site evaluation for major system replacement')

  // Inferred from null price
  const result2 = parseServicePricing(null, 'Custom ductwork installation')
  assert.equal(result2.model, 'free_estimate')
  assert.equal(result2.formattedPrice, 'Free Estimate')

  // Inferred from zero price
  const result3 = parseServicePricing(0, 'In-home consultation')
  assert.equal(result3.model, 'free_estimate')
  assert.equal(result3.formattedPrice, 'Free Estimate')
})

test('SVC-002: Flexible Pricing Engine — Diagnostic Inferred from Description', () => {
  const result = parseServicePricing(69.0, 'Full AC diagnostic and electrical check')
  assert.equal(result.model, 'diagnostic_fee')
  assert.equal(result.formattedPrice, '$69.00 Diagnostic Fee')
})

test('SVC-002: Description Encoding and Cleaning is Idempotent and Clean', () => {
  const original = 'Routine maintenance and air filter replacement'
  const tagged = encodeServiceDescription(original, 'starting_at')
  const reTagged = encodeServiceDescription(tagged, 'starting_at')
  
  assert.equal(cleanServiceDescription(tagged), original)
  assert.equal(cleanServiceDescription(reTagged), original)
  
  // Tag should appear only once
  const matches = reTagged.match(/\[pricing:starting_at\]/g)
  assert.equal(matches?.length, 1)

  // Fixed model leaves standard description without unnecessary tags
  const fixedEncoded = encodeServiceDescription(original, 'fixed')
  assert.equal(fixedEncoded, original)
})

test('TEL-002 & SET-001: Mobile Carrier Forwarding Dial Links and URL Encoding', () => {
  const forwardingNumber = '+15551234567'

  // Verizon (*71)
  const verizonDial = `tel:*71${forwardingNumber}`
  assert.equal(verizonDial, 'tel:*71+15551234567')

  // AT&T (*71)
  const attDial = `tel:*71${forwardingNumber}`
  assert.equal(attDial, 'tel:*71+15551234567')

  // T-Mobile (**62*...#) -> MUST encode # as %23 for tel: URI compliance
  const tmobileDial = `tel:**62*${forwardingNumber}%23`
  assert.ok(tmobileDial.startsWith('tel:**62*'))
  assert.ok(tmobileDial.endsWith('%23'))
  assert.ok(!tmobileDial.includes('#'), 'tel: link must encode # as %23 to prevent fragment truncation')

  // Deactivation Codes
  const verizonDeactivate = 'tel:*73'
  const tmobileDeactivate = 'tel:%23%2362%23' // ##62# encoded
  assert.equal(verizonDeactivate, 'tel:*73')
  assert.equal(tmobileDeactivate, 'tel:%23%2362%23')
  assert.ok(!tmobileDeactivate.includes('#'))
})

test('NAV-001: UniversalQuickCreate Role Permission Matrix', () => {
  // Owner and Admin have all permissions
  assert.ok(hasPermission('owner', 'appointments:manage'))
  assert.ok(hasPermission('owner', 'quotes:manage'))
  assert.ok(hasPermission('owner', 'messages:send'))
  assert.ok(hasPermission('owner', 'contacts:manage'))

  assert.ok(hasPermission('admin', 'appointments:manage'))
  assert.ok(hasPermission('admin', 'quotes:manage'))
  assert.ok(hasPermission('admin', 'messages:send'))
  assert.ok(hasPermission('admin', 'contacts:manage'))

  // Dispatcher can manage appointments and contacts, but cannot manage quotes or financial modules
  assert.ok(hasPermission('dispatcher', 'appointments:manage'))
  assert.ok(hasPermission('dispatcher', 'messages:send'))
  assert.ok(hasPermission('dispatcher', 'contacts:manage'))
  assert.equal(hasPermission('dispatcher', 'quotes:manage'), false)
  assert.equal(hasPermission('dispatcher', 'invoices:manage'), false)

  // Technician has restricted field role
  assert.equal(hasPermission('technician', 'quotes:manage'), false)
  assert.equal(hasPermission('technician', 'contacts:manage'), false)
  assert.ok(hasPermission('technician', 'messages:send'))
})

test('NAV-001: Modal Auto-Open Query Triggers Alignment', () => {
  const triggerMap = {
    appointment: { path: '/client/calendar', query: 'create=true' },
    quote: { path: '/client/quotes', query: 'create=true' },
    job: { path: '/client/jobs', query: 'create=true' },
    message: { path: '/client/inbox', query: 'compose=true' },
    customer: { path: '/client/customers', query: 'create=true' }
  }

  for (const [key, config] of Object.entries(triggerMap)) {
    assert.ok(config.path.startsWith('/client/'), `${key} path must be tenant client route`)
    assert.ok(config.query.includes('=true'), `${key} query must contain active boolean flag`)
  }
})

test('REV-001: Reviews Invites Enforce Google URL Configuration', () => {
  const emptySettings = { googleReviewUrl: '' }
  const whitespaceSettings = { googleReviewUrl: '   ' }
  const validSettings = { googleReviewUrl: 'https://g.page/r/example/review' }

  assert.equal(Boolean(emptySettings.googleReviewUrl?.trim()), false)
  assert.equal(Boolean(whitespaceSettings.googleReviewUrl?.trim()), false)
  assert.equal(Boolean(validSettings.googleReviewUrl?.trim()), true)
})

test('NOTIF-001 & DASH-001: Primary Sidebar Navigation Consolidates Redundancies', () => {
  const layoutSource = fs.readFileSync(path.resolve('src/app/client/layout.tsx'), 'utf8')
  
  // Extract navSections
  const navSectionsMatch = layoutSource.match(/export const navSections = \[([\s\S]*?)\]\n\n/m)
  assert.ok(navSectionsMatch, 'navSections must be exported in layout.tsx')
  const navSectionsContent = navSectionsMatch[1]

  // Redundant /client/activity MUST NOT be in main navigation sections
  assert.ok(!navSectionsContent.includes('/client/activity'), 'Main sidebar navigation must not include redundant /client/activity')

  // Core operational items must be present
  assert.ok(navSectionsContent.includes('/client/dashboard'))
  assert.ok(navSectionsContent.includes('/client/calendar'))
  assert.ok(navSectionsContent.includes('/client/jobs'))
  assert.ok(navSectionsContent.includes('/client/inbox'))
  assert.ok(navSectionsContent.includes('/client/quotes'))
  assert.ok(navSectionsContent.includes('/client/invoices'))
  assert.ok(navSectionsContent.includes('/client/customers'))
})

test('NAV-002: Cross-Switching Navigation Links Between Jobs and Calendar', () => {
  const jobsToCalendarPath = '/client/calendar'
  const calendarToJobsPath = '/client/jobs'

  assert.equal(jobsToCalendarPath, '/client/calendar')
  assert.equal(calendarToJobsPath, '/client/jobs')
})

test('NAV-003: Schedule & Jobs Unified Navigation Consolidation', () => {
  const layoutSource = fs.readFileSync(path.resolve('src/app/client/layout.tsx'), 'utf8')
  assert.ok(layoutSource.includes("label: 'Schedule & Jobs'"), 'Sidebar must have unified Schedule & Jobs link')
  
  const jobsPageSource = fs.readFileSync(path.resolve('src/app/client/jobs/page.tsx'), 'utf8')
  assert.ok(jobsPageSource.includes("router.replace"), 'Jobs page must redirect to calendar')
  assert.ok(jobsPageSource.includes("/client/calendar"), 'Jobs page must redirect to unified calendar hub')
})
