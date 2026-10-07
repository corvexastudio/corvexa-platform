import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// 1. Design Tokens
import { designTokens } from '../src/lib/design-tokens.ts'

// 2. API Response Helpers
import { apiSuccess, apiError, apiPaginated } from '../src/lib/api/response.ts'

// 3. Domain Services Barrel Export
import {
  TelnyxService,
  StripeService,
  MessagingService,
  AutomationService,
  BookingService,
  InvoiceService,
  QuoteService,
  ReviewService
} from '../src/lib/services/index.ts'

test('Architecture Gate: Design Tokens expose canonical theme attributes', () => {
  // Surfaces
  assert.ok(designTokens.surfaces.app, 'Surface app exists')
  assert.ok(designTokens.surfaces.subtle, 'Surface subtle exists')
  assert.ok(designTokens.surfaces.card, 'Surface card exists')
  assert.ok(designTokens.surfaces.cardHover, 'Surface cardHover exists')
  assert.ok(designTokens.surfaces.elevated, 'Surface elevated exists')
  assert.ok(designTokens.surfaces.overlay, 'Surface overlay exists')

  // Borders
  assert.ok(designTokens.borders.subtle, 'Border subtle exists')
  assert.ok(designTokens.borders.default, 'Border default exists')
  assert.ok(designTokens.borders.hover, 'Border hover exists')
  assert.ok(designTokens.borders.focus, 'Border focus exists')
  assert.ok(designTokens.borders.danger, 'Border danger exists')

  // Brand & Semantic Colors
  assert.ok(designTokens.colors.brand.primary, 'Brand primary exists')
  assert.ok(designTokens.colors.success.default, 'Success default exists')
  assert.ok(designTokens.colors.warning.default, 'Warning default exists')
  assert.ok(designTokens.colors.danger.default, 'Danger default exists')
  assert.ok(designTokens.colors.neutral.white, 'Neutral white exists')

  // Typography, Radii, Breakpoints
  assert.ok(designTokens.typography.fontSans, 'Font fontSans exists')
  assert.ok(designTokens.radius['2xl'], 'Radius 2xl exists')
  assert.ok(designTokens.breakpoints.md, 'Breakpoint md exists')

  // Verify globals.css contains the mapped theme surface tokens
  const cssPath = path.resolve('src/app/globals.css')
  const cssContent = fs.readFileSync(cssPath, 'utf8')
  assert.ok(cssContent.includes('--color-surface-app'), 'globals.css has --color-surface-app')
  assert.ok(cssContent.includes('--color-surface-card'), 'globals.css has --color-surface-card')
  assert.ok(cssContent.includes('--color-surface-subtle'), 'globals.css has --color-surface-subtle')
  assert.ok(cssContent.includes('--color-surface-elevated'), 'globals.css has --color-surface-elevated')
})

test('Architecture Gate: Standardized API envelopes serialize compliant payloads', async () => {
  // apiSuccess
  const successRes = apiSuccess({ organizationId: 'org_123', plan: 'pro' }, 201)
  assert.equal(successRes.status, 201)
  const successBody = await successRes.json()
  assert.equal(successBody.success, true)
  assert.equal(successBody.data.organizationId, 'org_123')
  assert.equal(successBody.data.plan, 'pro')

  // apiError
  const errorRes = apiError('Unauthorized access to tenant resource', 403, 'FORBIDDEN', { resource: 'invoices' })
  assert.equal(errorRes.status, 403)
  const errorBody = await errorRes.json()
  assert.equal(errorBody.success, false)
  assert.equal(errorBody.error.message, 'Unauthorized access to tenant resource')
  assert.equal(errorBody.error.code, 'FORBIDDEN')
  assert.deepEqual(errorBody.error.details, { resource: 'invoices' })

  // apiPaginated
  const paginatedRes = apiPaginated(
    [{ id: 'msg_1', body: 'Hello' }, { id: 'msg_2', body: 'World' }],
    { hasMore: true, nextCursor: '2026-10-07T12:00:00Z', total: 42 }
  )
  assert.equal(paginatedRes.status, 200)
  const paginatedBody = await paginatedRes.json()
  assert.equal(paginatedBody.success, true)
  assert.equal(paginatedBody.data.length, 2)
  assert.equal(paginatedBody.pagination.count, 2)
  assert.equal(paginatedBody.pagination.hasMore, true)
  assert.equal(paginatedBody.pagination.nextCursor, '2026-10-07T12:00:00Z')
  assert.equal(paginatedBody.pagination.total, 42)
})

test('Architecture Gate: All 8 domain services expose their contractual boundary methods', () => {
  // 1. TelnyxService
  assert.equal(typeof TelnyxService.sendSms, 'function', 'TelnyxService.sendSms is a function')
  assert.equal(typeof TelnyxService.verifyWebhookSignature, 'function', 'TelnyxService.verifyWebhookSignature is a function')
  assert.equal(typeof TelnyxService.searchAvailableNumbers, 'function', 'TelnyxService.searchAvailableNumbers is a function')
  assert.equal(typeof TelnyxService.orderNumber, 'function', 'TelnyxService.orderNumber is a function')

  // 2. StripeService
  assert.equal(typeof StripeService.createCheckoutSession, 'function', 'StripeService.createCheckoutSession is a function')
  assert.equal(typeof StripeService.constructWebhookEvent, 'function', 'StripeService.constructWebhookEvent is a function')
  assert.equal(typeof StripeService.isConfigured, 'function', 'StripeService.isConfigured is a function')

  // 3. MessagingService
  assert.equal(typeof MessagingService.sendCompliantSms, 'function', 'MessagingService.sendCompliantSms is a function')
  assert.equal(typeof MessagingService.fetchConversationHistory, 'function', 'MessagingService.fetchConversationHistory is a function')
  assert.equal(typeof MessagingService.checkQuietHours, 'function', 'MessagingService.checkQuietHours is a function')
  assert.equal(typeof MessagingService.formatOptOutFooter, 'function', 'MessagingService.formatOptOutFooter is a function')

  // 4. AutomationService
  assert.equal(typeof AutomationService.runAutomationCycle, 'function', 'AutomationService.runAutomationCycle is a function')
  assert.equal(typeof AutomationService.getWorkerHealth, 'function', 'AutomationService.getWorkerHealth is a function')
  assert.equal(typeof AutomationService.recordDomainEvent, 'function', 'AutomationService.recordDomainEvent is a function')

  // 5. BookingService
  assert.equal(typeof BookingService.getAvailableSlots, 'function', 'BookingService.getAvailableSlots is a function')
  assert.equal(typeof BookingService.createAppointment, 'function', 'BookingService.createAppointment is a function')
  assert.equal(typeof BookingService.cancelAppointment, 'function', 'BookingService.cancelAppointment is a function')
  assert.equal(typeof BookingService.rescheduleAppointment, 'function', 'BookingService.rescheduleAppointment is a function')

  // 6. InvoiceService
  assert.equal(typeof InvoiceService.createInvoice, 'function', 'InvoiceService.createInvoice is a function')
  assert.equal(typeof InvoiceService.recordOfflinePayment, 'function', 'InvoiceService.recordOfflinePayment is a function')
  assert.equal(typeof InvoiceService.voidInvoice, 'function', 'InvoiceService.voidInvoice is a function')
  assert.equal(typeof InvoiceService.getInvoiceByToken, 'function', 'InvoiceService.getInvoiceByToken is a function')

  // 7. QuoteService
  assert.equal(typeof QuoteService.createQuote, 'function', 'QuoteService.createQuote is a function')
  assert.equal(typeof QuoteService.acceptQuote, 'function', 'QuoteService.acceptQuote is a function')
  assert.equal(typeof QuoteService.declineQuote, 'function', 'QuoteService.declineQuote is a function')
  assert.equal(typeof QuoteService.sendClarificationQuestion, 'function', 'QuoteService.sendClarificationQuestion is a function')
  assert.equal(typeof QuoteService.getQuoteByToken, 'function', 'QuoteService.getQuoteByToken is a function')

  // 8. ReviewService
  assert.equal(typeof ReviewService.sendReviewRequest, 'function', 'ReviewService.sendReviewRequest is a function')
  assert.equal(typeof ReviewService.recordReviewLinkClick, 'function', 'ReviewService.recordReviewLinkClick is a function')
  assert.equal(typeof ReviewService.triggerReactivationBatch, 'function', 'ReviewService.triggerReactivationBatch is a function')
})

test('Architecture Gate: Required UI primitives exist with expected exports', () => {
  const primitives = [
    'button.tsx',
    'input.tsx',
    'select.tsx',
    'modal.tsx',
    'drawer.tsx',
    'badge.tsx',
    'card.tsx',
    'table.tsx',
    'mobile-card.tsx',
    'empty-state.tsx',
    'error-state.tsx',
    'skeleton.tsx',
    'confirm-dialog.tsx',
    'sonner.tsx'
  ]

  for (const prim of primitives) {
    const fullPath = path.resolve('src/components/ui', prim)
    assert.ok(fs.existsSync(fullPath), `UI primitive ${prim} must exist in src/components/ui/`)
  }
})

test('Architecture Gate: Zero raw alert() or confirm() calls exist in client code', () => {
  const clientDir = path.resolve('src/app')
  
  function scanDir(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true })
    for (const f of files) {
      const full = path.join(dir, f.name)
      if (f.isDirectory()) {
        scanDir(full)
      } else if (f.name.endsWith('.tsx') || f.name.endsWith('.ts')) {
        const content = fs.readFileSync(full, 'utf8')
        // Check for raw window.confirm( or confirm(
        const hasConfirm = /(^|[^a-zA-Z0-9_$])confirm\s*\(/.test(content)
        assert.equal(hasConfirm, false, `File ${full} must not call raw confirm()`)

        // Check for raw window.alert( or alert(
        const hasAlert = /(^|[^a-zA-Z0-9_$])alert\s*\(/.test(content)
        assert.equal(hasAlert, false, `File ${full} must not call raw alert()`)
      }
    }
  }

  scanDir(clientDir)
})
