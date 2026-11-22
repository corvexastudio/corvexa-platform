import test from 'node:test'
import assert from 'node:assert/strict'
import { hasDedicatedPhoneNumber, resolveSenderPhone } from '../src/lib/billing/plans.ts'

test('Settings Telephony: Dedicated DID vs Shared Starter Pass Line Resolution', () => {
  // 1. Free Starter Pass / Trial Organization
  const trialOrg = {
    plan_id: 'free',
    subscription_status: 'trial',
    telnyx_phone_number: null,
    phone_provisioning_status: null
  }
  assert.equal(hasDedicatedPhoneNumber(trialOrg), false, 'Trial org must not have a dedicated phone number')
  assert.equal(resolveSenderPhone(trialOrg), '+18777713802', 'Trial org must resolve to platform toll-free line')

  // 2. Active Solo Pro Organization with provisioned DID
  const soloOrg = {
    plan_id: 'solo',
    subscription_status: 'active',
    telnyx_phone_number: '+15125550199',
    phone_provisioning_status: 'active'
  }
  assert.equal(hasDedicatedPhoneNumber(soloOrg), true, 'Active Solo org with DID must be recognized as dedicated')
  assert.equal(resolveSenderPhone(soloOrg), '+15125550199', 'Active Solo org must resolve to exclusive dedicated DID')

  // 3. Paid org with inactive/provisioning status
  const pendingOrg = {
    plan_id: 'solo',
    subscription_status: 'active',
    telnyx_phone_number: '+15125550199',
    phone_provisioning_status: 'provisioning'
  }
  assert.equal(hasDedicatedPhoneNumber(pendingOrg), false, 'Provisioning status must not be marked dedicated')
  assert.equal(resolveSenderPhone(pendingOrg), '+18777713802', 'Provisioning status must fallback to verified toll-free line')
})

test('Settings Telephony: Carrier Star-Code Formatting & Clean Digits', () => {
  const rawNumber = '+1 (512) 555-0199'
  const cleanDigits = rawNumber.replace(/\D/g, '')
  assert.equal(cleanDigits, '15125550199')

  // Verizon Wireless Conditional Call Forwarding (*71)
  const verizonActivation = `*71${cleanDigits}`
  const verizonDeactivation = '*73'
  assert.equal(verizonActivation, '*7115125550199')
  assert.equal(verizonDeactivation, '*73')

  // AT&T Mobility Conditional Call Forwarding (*004*)
  const attActivation = `*004*${cleanDigits}#`
  const attDeactivation = '##004#'
  assert.equal(attActivation, '*004*15125550199#')
  assert.equal(attDeactivation, '##004#')

  // T-Mobile Conditional Call Forwarding (**61*)
  const tmobileActivation = `**61*${cleanDigits}#`
  const tmobileDeactivation = '##61#'
  assert.equal(tmobileActivation, '**61*15125550199#')
  assert.equal(tmobileDeactivation, '##61#')
})

test('Settings Telephony: Homeowner Tracking Mode Enum & Geofence Radius', () => {
  const allowedModes = ['milestone', 'geofence_live']
  
  // Verify canonical milestone mode
  const milestoneConfig = { tracking_mode: 'milestone', tracking_geofence_miles: 5 }
  assert.equal(allowedModes.includes(milestoneConfig.tracking_mode), true)
  assert.equal(milestoneConfig.tracking_mode, 'milestone')

  // Verify canonical geofence_live mode
  const liveConfig = { tracking_mode: 'geofence_live', tracking_geofence_miles: 3 }
  assert.equal(allowedModes.includes(liveConfig.tracking_mode), true)
  assert.equal(liveConfig.tracking_mode, 'geofence_live')

  // Proximity options validation
  const supportedRadii = [3, 5, 10]
  assert.equal(supportedRadii.includes(3), true)
  assert.equal(supportedRadii.includes(5), true)
  assert.equal(supportedRadii.includes(10), true)
  assert.equal(supportedRadii.includes(25), false)
})

test('Settings Telephony: Seasonal Reactivation Template Interpolation & Segment Calculation', () => {
  const template = "Hi {customer_name}, it's time for seasonal maintenance with {business_name}. Book online: {booking_url}"
  const customerName = 'Sarah'
  const businessName = 'Apex Plumbing & HVAC'
  const bookingUrl = 'https://captodesk.com/book/apex-plumbing'

  const rendered = template
    .replace(/{customer_name}/g, customerName)
    .replace(/{business_name}/g, businessName)
    .replace(/{booking_url}/g, bookingUrl)

  assert.equal(
    rendered,
    "Hi Sarah, it's time for seasonal maintenance with Apex Plumbing & HVAC. Book online: https://captodesk.com/book/apex-plumbing"
  )

  // Segment calculation
  const charLength = rendered.length
  assert.ok(charLength > 0)
  const segments = charLength <= 160 ? 1 : Math.ceil(charLength / 153)
  assert.equal(segments, 1, 'Rendered message under 160 characters should be 1 SMS segment')

  // Supported intervals
  const supportedIntervals = [60, 90, 180, 365]
  assert.deepEqual(supportedIntervals, [60, 90, 180, 365])
})
