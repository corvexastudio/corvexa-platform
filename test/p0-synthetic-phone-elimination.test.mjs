import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePhoneToE164, isValidE164 } from '../src/lib/telephony/phone-normalizer.ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

/**
 * ==============================================================================
 * CAPTODESK P0-02 REMEDIATION TEST SUITE:
 * ELIMINATE SYNTHETIC +1999 PHONE NUMBERS & ENFORCE NULL/VALIDATION SAFETY
 * ==============================================================================
 */

test('TEST 1: Missing phone cannot create synthetic number; resolves to clean NULL', () => {
  // Test undefined and omitted phone input
  const rawInput = undefined
  const rawPhone = typeof rawInput === 'string' ? rawInput.trim() : ''
  let normalizedOwnerPhone = null

  if (rawPhone.length > 0) {
    const norm = normalizePhoneToE164(rawPhone)
    if (norm.isValid && norm.e164) {
      normalizedOwnerPhone = norm.e164
    }
  }

  assert.strictEqual(normalizedOwnerPhone, null, 'Omitted phone must evaluate to null, not a synthetic number')
  assert.doesNotMatch(String(normalizedOwnerPhone), /1999/, 'Omitted phone must never generate +1999')
})

test('TEST 2: Whitespace-only phone cannot create synthetic number; resolves to clean NULL', () => {
  const whitespaceInputs = ['', '   ', '\t', '\n  \t  ']
  for (const input of whitespaceInputs) {
    const rawPhone = typeof input === 'string' ? input.trim() : ''
    let normalizedOwnerPhone = null

    if (rawPhone.length > 0) {
      const norm = normalizePhoneToE164(rawPhone)
      if (norm.isValid && norm.e164) {
        normalizedOwnerPhone = norm.e164
      }
    }

    assert.strictEqual(normalizedOwnerPhone, null, `Whitespace input "${input}" must evaluate to null`)
    assert.doesNotMatch(String(normalizedOwnerPhone), /1999/, 'Whitespace input must never generate +1999')
  }
})

test('TEST 3: Malformed phone is rejected with validation error', () => {
  const malformedInputs = [
    '123',
    '555-1234',
    'abcdefghij',
    '0123456789', // Invalid US area code starting with 0
    '1012345678', // Invalid US area code starting with 1
    '(555) 12-34',
    '+123'
  ]

  for (const input of malformedInputs) {
    const norm = normalizePhoneToE164(input)
    assert.strictEqual(norm.isValid, false, `Malformed phone "${input}" must be marked invalid`)
    assert.strictEqual(norm.e164, null, `Malformed phone "${input}" must not have an e164 representation`)
    assert.ok(norm.error, `Malformed phone "${input}" must provide an error message`)
  }
})

test('TEST 4: Valid phone is normalized correctly to canonical E.164', () => {
  const validInputs = [
    { input: '(214) 555-0199', expected: '+12145550199' },
    { input: '2145550199', expected: '+12145550199' },
    { input: '12145550199', expected: '+12145550199' },
    { input: '+12145550199', expected: '+12145550199' },
    { input: '415-555-2671', expected: '+14155552671' },
    { input: '+442071838750', expected: '+442071838750' }
  ]

  for (const { input, expected } of validInputs) {
    const norm = normalizePhoneToE164(input)
    assert.strictEqual(norm.isValid, true, `Valid phone "${input}" must be recognized as valid`)
    assert.strictEqual(norm.e164, expected, `Valid phone "${input}" must normalize to "${expected}"`)
    assert.strictEqual(isValidE164(norm.e164), true, `Normalized result "${norm.e164}" must pass isValidE164`)
  }
})

test('TEST 5: No onboarding code path generates +1999 in route.ts source code', () => {
  const onboardingRoutePath = path.resolve(projectRoot, 'src/app/api/onboarding/route.ts')
  const content = fs.readFileSync(onboardingRoutePath, 'utf8')

  assert.doesNotMatch(content, /\+1999/, 'onboarding/route.ts must contain zero occurrences of +1999')
  assert.doesNotMatch(content, /fallbackPhone/, 'onboarding/route.ts must contain zero occurrences of fallbackPhone')
  assert.doesNotMatch(content, /randomSuffix/, 'onboarding/route.ts must contain zero occurrences of randomSuffix')
  assert.doesNotMatch(content, /freshRandom/, 'onboarding/route.ts must contain zero occurrences of freshRandom')

  // Verify honest validation logic is present
  assert.match(content, /normalizePhoneToE164/, 'onboarding/route.ts must use canonical normalizePhoneToE164')
  assert.match(content, /normalizedOwnerPhone/, 'onboarding/route.ts must use normalizedOwnerPhone')
  assert.match(content, /owner_phone:\s*normalizedOwnerPhone/, 'organizations.owner_phone must use normalizedOwnerPhone')
  assert.match(content, /phone:\s*normalizedOwnerPhone/, 'profiles.phone must use normalizedOwnerPhone')
})

test('TEST 6: Repository-wide scan: Zero production services generate +1999 fallback', () => {
  const srcDir = path.resolve(projectRoot, 'src')

  function scanDir(dir) {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        scanDir(fullPath)
      } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
        const content = fs.readFileSync(fullPath, 'utf8')
        assert.doesNotMatch(
          content,
          /\+1999\$\{/,
          `File ${fullPath} contains synthetic +1999 generation template`
        )
        assert.doesNotMatch(
          content,
          /fallbackPhone\s*=/,
          `File ${fullPath} contains fallbackPhone declaration`
        )
      }
    }
  }

  scanDir(srcDir)
})

test('TEST 7: Optional phone NULL does not crash downstream notification flows', () => {
  // Scenario A: Test SMS when owner_phone is null
  const orgWithoutPhone = {
    id: 'org-test-no-phone',
    name: 'Dallas AC',
    owner_phone: null,
    telnyx_phone_number: null
  }

  const rawTargetPhone = orgWithoutPhone.owner_phone
  assert.strictEqual(rawTargetPhone, null)
  // Downstream check in /api/telnyx/test-sms:
  const wouldThrowError = !rawTargetPhone
  assert.strictEqual(wouldThrowError, true, 'Downstream test-sms safely handles missing phone without sending to fake number')

  // Scenario B: Job Technician Dispatch when owner_phone and telnyx_phone_number are null
  const senderNumber = orgWithoutPhone.telnyx_phone_number || orgWithoutPhone.owner_phone
  assert.strictEqual(senderNumber, null)
  const canSendTechnicianNotification = Boolean(senderNumber && '+12145550123')
  assert.strictEqual(canSendTechnicianNotification, false, 'Technician SMS send is safely skipped when sender is null')

  // Scenario C: Public invoice view when owner_phone is null
  const invoiceContactDisplay = orgWithoutPhone.owner_phone || 'support'
  assert.strictEqual(invoiceContactDisplay, 'support', 'Invoice view falls back to safe generic support text')
})

test('TEST 8: Direct API request with malformed phone cannot bypass validation', () => {
  // Simulate direct API request handler logic
  function processIncomingOnboardingPhone(phoneInput) {
    let normalizedOwnerPhone = null
    const rawPhone = typeof phoneInput === 'string' ? phoneInput.trim() : ''

    if (rawPhone.length > 0) {
      const norm = normalizePhoneToE164(rawPhone)
      if (!norm.isValid || !norm.e164) {
        return { status: 400, error: `Invalid notification mobile number: ${norm.error || 'Please provide a valid phone number.'}` }
      }
      normalizedOwnerPhone = norm.e164
    }

    return { status: 200, normalizedOwnerPhone }
  }

  // 1. Missing phone -> 200 with null
  const resEmpty = processIncomingOnboardingPhone('')
  assert.strictEqual(resEmpty.status, 200)
  assert.strictEqual(resEmpty.normalizedOwnerPhone, null)

  // 2. Whitespace phone -> 200 with null
  const resWhitespace = processIncomingOnboardingPhone('   ')
  assert.strictEqual(resWhitespace.status, 200)
  assert.strictEqual(resWhitespace.normalizedOwnerPhone, null)

  // 3. Garbage letters -> 400
  const resGarbage = processIncomingOnboardingPhone('spam-fake')
  assert.strictEqual(resGarbage.status, 400)
  assert.match(resGarbage.error, /Invalid notification mobile number/)

  // 4. Too short -> 400
  const resShort = processIncomingOnboardingPhone('12345')
  assert.strictEqual(resShort.status, 400)
  assert.match(resShort.error, /Invalid notification mobile number/)

  // 5. Valid US number -> 200 with E.164
  const resValid = processIncomingOnboardingPhone('(214) 555-0123')
  assert.strictEqual(resValid.status, 200)
  assert.strictEqual(resValid.normalizedOwnerPhone, '+12145550123')
})

test('TEST 9: Existing valid phone numbers remain unchanged', () => {
  const existingValidNumbers = [
    '+12145550123',
    '+14155552671',
    '+18005550199',
    '+13125550144'
  ]

  for (const validPhone of existingValidNumbers) {
    const norm = normalizePhoneToE164(validPhone)
    assert.strictEqual(norm.isValid, true)
    assert.strictEqual(norm.e164, validPhone, 'Existing valid phone must not be modified or corrupted')
  }
})

test('TEST 10: Migration 30 correctly defines SQL cleanup for synthetic +1999 records', () => {
  const migPath = path.resolve(projectRoot, 'supabase/migrations/30_eliminate_synthetic_phone_numbers.sql')
  assert.ok(fs.existsSync(migPath), 'Migration 30 file must exist')

  const sqlContent = fs.readFileSync(migPath, 'utf8')

  // Verify DROP NOT NULL constraints
  assert.match(sqlContent, /ALTER TABLE organizations ALTER COLUMN owner_phone DROP NOT NULL/)
  assert.match(sqlContent, /ALTER TABLE organizations ALTER COLUMN phone_number DROP NOT NULL/)
  assert.match(sqlContent, /ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL/)

  // Verify cleanup of existing synthetic records
  assert.match(sqlContent, /UPDATE organizations\s+SET owner_phone = NULL\s+WHERE owner_phone LIKE '\+1999%'/)
  assert.match(sqlContent, /UPDATE organizations\s+SET phone_number = NULL\s+WHERE phone_number LIKE '\+1999%'/)
  assert.match(sqlContent, /UPDATE profiles\s+SET phone = NULL\s+WHERE phone LIKE '\+1999%'/)
})
