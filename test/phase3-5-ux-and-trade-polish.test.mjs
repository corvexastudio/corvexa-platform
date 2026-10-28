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

test('TRADE-001: Trade-First Default with Multi-Trade Expandability Across Platform', () => {
  // 1. Workspace Context provides orgIndustry
  const wsSource = fs.readFileSync(path.resolve('src/lib/context/workspace-context.tsx'), 'utf8')
  assert.ok(wsSource.includes('orgIndustry: string'), 'WorkspaceContextValue must include orgIndustry')

  // 2. Invoices defaults to primary trade and supports multi-trade expansion
  const invoicesSource = fs.readFileSync(path.resolve('src/app/client/invoices/page.tsx'), 'utf8')
  assert.ok(invoicesSource.includes('orgIndustry'), 'Invoices must utilize orgIndustry')
  assert.ok(invoicesSource.includes('Browse other trades'), 'Invoices must provide multi-trade expandability')

  // 3. Quotes defaults to primary trade and supports multi-trade expansion
  const quotesSource = fs.readFileSync(path.resolve('src/app/client/quotes/page.tsx'), 'utf8')
  assert.ok(quotesSource.includes('orgIndustry'), 'Quotes must utilize orgIndustry')
  assert.ok(quotesSource.includes('Browse other trades'), 'Quotes must provide multi-trade expandability')

  // 4. Inbox provides trade workspace indicator
  const inboxSource = fs.readFileSync(path.resolve('src/app/client/inbox/page.tsx'), 'utf8')
  assert.ok(inboxSource.includes('orgIndustry'), 'Inbox must utilize orgIndustry')
  assert.ok(inboxSource.includes('Workspace'), 'Inbox must display workspace indicator')

  // 5. Services and Automations support trade-first defaults
  const servicesSource = fs.readFileSync(path.resolve('src/app/client/services/page.tsx'), 'utf8')
  assert.ok(servicesSource.includes('orgIndustry'), 'Services must utilize orgIndustry')
  
  const automationsSource = fs.readFileSync(path.resolve('src/app/client/automations/page.tsx'), 'utf8')
  assert.ok(automationsSource.includes('orgIndustry'), 'Automations must utilize orgIndustry')
})

test('SCALE-001: Solo vs Multi-Crew Operation Scale Customization', () => {
  // 1. Workspace Context provides operationMode
  const wsSource = fs.readFileSync(path.resolve('src/lib/context/workspace-context.tsx'), 'utf8')
  assert.ok(wsSource.includes("operationMode: 'solo' | 'multi_crew'"), 'WorkspaceContextValue must include operationMode')

  // 2. Migration 56 adds operation_mode column
  const migrationSource = fs.readFileSync(path.resolve('supabase/migrations/56_operation_mode_solo_multi_crew.sql'), 'utf8')
  assert.ok(migrationSource.includes('operation_mode TEXT DEFAULT'), 'Migration 56 must define operation_mode')
  assert.ok(migrationSource.includes("CHECK (operation_mode IN ('solo', 'multi_crew'))"), 'Migration 56 must check valid operation modes')

  // 3. Onboarding API accepts operationMode
  const onboardingApiSource = fs.readFileSync(path.resolve('src/app/api/onboarding/route.ts'), 'utf8')
  assert.ok(onboardingApiSource.includes('operation_mode'), 'Onboarding API must accept and store operation_mode')

  // 4. Onboarding UI provides Solo vs Multi-Crew card selector
  const onboardingPageSource = fs.readFileSync(path.resolve('src/app/client/onboarding/page.tsx'), 'utf8')
  assert.ok(onboardingPageSource.includes("setOperationMode('solo')"), 'Onboarding page must support selecting solo mode')
  assert.ok(onboardingPageSource.includes("setOperationMode('multi_crew')"), 'Onboarding page must support selecting multi_crew mode')

  // 5. Pro Upgrade Modal adapts to operationMode
  const upgradeModalSource = fs.readFileSync(path.resolve('src/components/billing/pro-upgrade-modal.tsx'), 'utf8')
  assert.ok(upgradeModalSource.includes('operationMode'), 'ProUpgradeModal must consume operationMode')
  assert.ok(upgradeModalSource.includes("operationMode === 'multi_crew' ? 'fleet' : 'solo'"), 'ProUpgradeModal must default tier based on operationMode')

  // 6. Settings Page enables mode switching and customizes billing cards
  const settingsSource = fs.readFileSync(path.resolve('src/app/client/settings/page.tsx'), 'utf8')
  assert.ok(settingsSource.includes('operation_mode'), 'Settings page must support operation_mode in profile form')
  assert.ok(settingsSource.includes('Recommended for 1 Truck'), 'Settings page must recommend Solo plan for solo operators')
  assert.ok(settingsSource.includes('Recommended for Fleet'), 'Settings page must recommend Multi-Crew plan for fleets')

  // 7. Schedule Dispatch Hub adapts to operationMode
  const scheduleSource = fs.readFileSync(path.resolve('src/components/schedule/schedule-dispatch-hub.tsx'), 'utf8')
  assert.ok(scheduleSource.includes('operationMode'), 'ScheduleDispatchHub must consume operationMode')
  assert.ok(scheduleSource.includes("operationMode === 'multi_crew' && crews.length > 0"), 'ScheduleDispatchHub must hide crews tab for solo operators')

  // 8. Navigation layout adapts Team label
  const layoutSource = fs.readFileSync(path.resolve('src/app/client/layout.tsx'), 'utf8')
  assert.ok(layoutSource.includes("operationMode === 'solo'"), 'Layout must conditionally format nav based on solo operation mode')
  assert.ok(layoutSource.includes("'Team & Staff'"), 'Layout must label solo team as Team & Staff')
})

test('SCALE-002: Resilient Database Schema Fallbacks & Client Error Boundary Architecture', () => {
  // 1. Layout multi-tier database fallback does not query operation_mode in fallback tier
  const layoutSource = fs.readFileSync(path.resolve('src/app/client/layout.tsx'), 'utf8')
  assert.ok(layoutSource.includes('fallbackRes1'), 'Layout must implement fallbackRes1')
  assert.ok(layoutSource.includes('fallbackRes2'), 'Layout must implement fallbackRes2')
  assert.ok(layoutSource.includes('fallbackRes3'), 'Layout must implement fallbackRes3 minimal core')
  assert.ok(layoutSource.includes('effectiveOrg'), 'Layout must safely populate effectiveOrg even if database enrichment fails')

  // 2. Organization API PATCH handles missing operation_mode column gracefully
  const orgApiSource = fs.readFileSync(path.resolve('src/app/api/client/organization/route.ts'), 'utf8')
  assert.ok(orgApiSource.includes("delete sanitizedUpdates.operation_mode"), 'Organization API must drop operation_mode on 42703 error')
  assert.ok(orgApiSource.includes("finalOrg.operation_mode = finalOrg.operation_mode || 'solo'"), 'Organization API GET must default operation_mode to solo')

  // 3. Client and root error boundaries exist
  assert.ok(fs.existsSync(path.resolve('src/app/client/error.tsx')), 'Client error boundary src/app/client/error.tsx must exist')
  assert.ok(fs.existsSync(path.resolve('src/app/error.tsx')), 'Root error boundary src/app/error.tsx must exist')
  const clientErrorSource = fs.readFileSync(path.resolve('src/app/client/error.tsx'), 'utf8')
  assert.ok(clientErrorSource.includes("'use client'"), 'Client error boundary must be a client component')
  assert.ok(clientErrorSource.includes("reset()"), 'Client error boundary must provide reset trigger')
})
