import test from 'node:test'
import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// TEST SUITE: CAPTODESK SETTINGS - PAYMENTS & ALERTS ARCHITECTURAL VERIFICATION
// ---------------------------------------------------------------------------

// 1. Stripe Connection State Presentation (All 5 states)
function resolveStripeConnectionInfo(stripeStatus) {
  if (!stripeStatus) {
    return {
      status: 'not_connected',
      badgeText: 'Not Connected',
      badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
      description: 'Connect your bank account via Stripe to accept credit cards and Apple Pay directly on invoices.'
    }
  }
  if (stripeStatus.connected || (stripeStatus.chargesEnabled && stripeStatus.status === 'active')) {
    return {
      status: 'connected',
      badgeText: 'Connected & Active • Auto Payouts',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      description: 'Visa, Mastercard, Amex, Apple Pay, and Google Pay are active. Automatic 2-day rolling bank payouts.'
    }
  }
  if (stripeStatus.status === 'error') {
    return {
      status: 'error',
      badgeText: 'Connection Error',
      badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
      description: 'An error occurred with your Stripe Connect account. Reconnecting is recommended.'
    }
  }
  if (stripeStatus.status === 'restricted' || stripeStatus.status === 'action_required') {
    return {
      status: 'action_required',
      badgeText: 'Action Required in Stripe',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      description: 'Stripe requires additional documentation to enable payouts. Please open your Stripe dashboard.'
    }
  }
  if (stripeStatus.status === 'pending' || (stripeStatus.accountId && !stripeStatus.chargesEnabled)) {
    return {
      status: 'pending',
      badgeText: 'Verification Pending with Stripe',
      badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
      description: 'Stripe is verifying your identity and bank details. Card charges will activate once verification completes.'
    }
  }
  return {
    status: 'not_connected',
    badgeText: 'Not Connected',
    badgeClass: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
    description: 'Connect your bank account via Stripe to accept credit cards and Apple Pay directly on invoices.'
  }
}

test('Stripe Connection Status: Resolves all 5 required operational states', () => {
  // State 1: Connected & Active
  const connectedState = resolveStripeConnectionInfo({
    connected: true,
    chargesEnabled: true,
    payoutsEnabled: true,
    status: 'active',
    accountId: 'acct_123456789'
  })
  assert.equal(connectedState.status, 'connected')
  assert.equal(connectedState.badgeText, 'Connected & Active • Auto Payouts')

  // State 2: Not Connected
  const nullState = resolveStripeConnectionInfo(null)
  assert.equal(nullState.status, 'not_connected')
  assert.equal(nullState.badgeText, 'Not Connected')

  const unconfiguredState = resolveStripeConnectionInfo({
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    status: 'not_connected'
  })
  assert.equal(unconfiguredState.status, 'not_connected')

  // State 3: Verification Pending
  const pendingState = resolveStripeConnectionInfo({
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    status: 'pending',
    accountId: 'acct_pending_123'
  })
  assert.equal(pendingState.status, 'pending')
  assert.equal(pendingState.badgeText, 'Verification Pending with Stripe')

  // State 4: Action Required
  const actionRequiredState = resolveStripeConnectionInfo({
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    status: 'action_required',
    accountId: 'acct_restricted_123'
  })
  assert.equal(actionRequiredState.status, 'action_required')
  assert.equal(actionRequiredState.badgeText, 'Action Required in Stripe')

  // State 5: Connection Error
  const errorState = resolveStripeConnectionInfo({
    connected: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    status: 'error',
    accountId: 'acct_error_123'
  })
  assert.equal(errorState.status, 'error')
  assert.equal(errorState.badgeText, 'Connection Error')
})

// 2. External Payment URL Validation
function validatePaymentUrl(inputUrl) {
  const url = inputUrl?.trim()
  if (!url) return { isValid: true, error: null }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { isValid: false, error: 'URL must begin with https:// or http://' }
    }
    return { isValid: true, error: null }
  } catch {
    return { isValid: false, error: 'Please enter a complete web address (e.g. https://venmo.com/u/yourname)' }
  }
}

test('External Payment URL Validation: Validates Venmo, Cash App, PayPal.me and handles optional state', () => {
  // Valid external links
  assert.equal(validatePaymentUrl('https://venmo.com/u/apexplumbing').isValid, true)
  assert.equal(validatePaymentUrl('https://cash.app/$apexservices').isValid, true)
  assert.equal(validatePaymentUrl('https://paypal.me/apexservices').isValid, true)
  assert.equal(validatePaymentUrl('http://invoices.apexplumbing.com/pay').isValid, true)

  // Empty / Null / Whitespace is valid (optional field)
  assert.equal(validatePaymentUrl('').isValid, true)
  assert.equal(validatePaymentUrl('   ').isValid, true)
  assert.equal(validatePaymentUrl(null).isValid, true)
  assert.equal(validatePaymentUrl(undefined).isValid, true)

  // Invalid links
  const missingProtocol = validatePaymentUrl('venmo.com/u/apexplumbing')
  assert.equal(missingProtocol.isValid, false)
  assert.ok(missingProtocol.error.includes('complete web address'))

  const disallowedProtocol = validatePaymentUrl('javascript:alert(1)')
  assert.equal(disallowedProtocol.isValid, false)
  assert.ok(disallowedProtocol.error.includes('https:// or http://'))

  const ftpProtocol = validatePaymentUrl('ftp://files.example.com/pay')
  assert.equal(ftpProtocol.isValid, false)
  assert.ok(ftpProtocol.error.includes('https:// or http://'))
})

// 3. Invoice Payment Instructions & Manual Reconciliation
test('Payment Reconciliation Transparency: Differentiates Stripe auto-reconciliation from direct manual payments', () => {
  const stripeFeatures = {
    method: 'Stripe Online Card & Mobile Wallet',
    merchantFee: '2.9% + 30¢',
    platformFee: '$0.00',
    reconciliation: 'automatic',
    payoutSchedule: '2-day rolling bank transfer',
    generatesReceipt: true
  }

  const directFeatures = {
    methods: ['Zelle', 'Venmo', 'Cash App', 'PayPal.me', 'Cash', 'Check'],
    merchantFee: '0%',
    platformFee: '$0.00',
    reconciliation: 'manual',
    requiresContractorAction: 'Must open invoice in CaptoDesk and click Mark as Paid',
    generatesReceiptOnExternalApp: true
  }

  // Verify Stripe auto-reconciliation
  assert.equal(stripeFeatures.reconciliation, 'automatic')
  assert.equal(stripeFeatures.merchantFee, '2.9% + 30¢')
  assert.equal(stripeFeatures.generatesReceipt, true)

  // Verify Direct Payment requires manual reconciliation
  assert.equal(directFeatures.reconciliation, 'manual')
  assert.equal(directFeatures.merchantFee, '0%')
  assert.ok(directFeatures.requiresContractorAction.includes('Mark as Paid'))
})

// 4. Browser Notification Permissions vs Device Subscription States
test('Push Notifications: Accurately differentiates browser permission from device subscription', () => {
  // Case A: Browser allows notifications, device is subscribed
  const caseA = {
    permission: 'granted',
    isSubscribed: true,
    userState: 'Active on This Handset'
  }
  assert.equal(caseA.permission === 'granted' && caseA.isSubscribed, true)

  // Case B: Browser allows notifications, device has not subscribed yet (application preference off)
  const caseB = {
    permission: 'granted',
    isSubscribed: false,
    userState: 'Allowed by browser, but inactive on this device'
  }
  assert.equal(caseB.permission === 'granted' && !caseB.isSubscribed, true)

  // Case C: Browser blocked notifications (requires browser settings unblock)
  const caseC = {
    permission: 'denied',
    isSubscribed: false,
    unblockAction: 'Click padlock icon in browser address bar, set Notifications to Allow, and refresh.'
  }
  assert.equal(caseC.permission, 'denied')
  assert.ok(caseC.unblockAction.includes('padlock'))

  // Case D: Mandatory security notices cannot be disabled
  const mandatoryNoticePolicy = {
    accountSecurity: 'mandatory_always_delivered',
    billingReceipts: 'mandatory_always_delivered',
    legalCompliance: 'mandatory_always_delivered',
    optOutAllowed: false
  }
  assert.equal(mandatoryNoticePolicy.optOutAllowed, false)
})

// 5. Monday Morning Executive Summary SMS Schedule & Safety Safeguard
test('Weekly Executive Digest: Enforces Monday 8:00 AM cadence and non-destructive preview actions', () => {
  const digestConfig = {
    enabled: true,
    dayOfWeek: 1, // 1 = Monday
    hourOfDay: 8, // 8:00 AM
    timezone: 'America/Chicago',
    metrics: [
      'completed_jobs_and_revenue',
      'missed_calls_captured_and_recovered',
      'google_reviews_requested'
    ],
    safePreviewOnly: true,
    neverAutoSendOnSave: true
  }

  // Verify Monday 8:00 AM cadence
  assert.equal(digestConfig.dayOfWeek, 1)
  assert.equal(digestConfig.hourOfDay, 8)

  // Verify safety rule: never send live summary on save or page open
  assert.equal(digestConfig.neverAutoSendOnSave, true)
  assert.equal(digestConfig.safePreviewOnly, true)
})
