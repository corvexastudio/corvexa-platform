import test from 'node:test'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { isWithinBusinessHours, isTcpaQuietHours, isStopKeyword, isResumeKeyword, isShortCall } from './src/lib/services/safety-rules.ts'
import { verifyTelnyxSignature } from './src/lib/telnyx.ts'

test('TCPA Keyword Detection', () => {
  assert.strictEqual(isStopKeyword('STOP'), true)
  assert.strictEqual(isStopKeyword('Stop '), true)
  assert.strictEqual(isStopKeyword('unsubscribe'), true)
  assert.strictEqual(isStopKeyword('CANCEL'), true)
  assert.strictEqual(isStopKeyword('hello'), false)

  assert.strictEqual(isResumeKeyword('UNSTOP'), true)
  assert.strictEqual(isResumeKeyword('start'), true)
  assert.strictEqual(isResumeKeyword('continue'), false)
})

test('Short call misdial detection', () => {
  assert.strictEqual(isShortCall(1), true)
  assert.strictEqual(isShortCall(2), true)
  assert.strictEqual(isShortCall(0), false)
  assert.strictEqual(isShortCall(3), false)
  assert.strictEqual(isShortCall(45), false)
})

test('Business Hours Timezone Evaluation', () => {
  const schedule = {
    monday: { open: '08:00', close: '18:00', closed: false },
    tuesday: { open: '08:00', close: '18:00', closed: false },
    wednesday: { open: '08:00', close: '18:00', closed: false },
    thursday: { open: '08:00', close: '18:00', closed: false },
    friday: { open: '08:00', close: '18:00', closed: false },
    saturday: { open: '09:00', close: '14:00', closed: false },
    sunday: { open: '00:00', close: '00:00', closed: true }
  }

  const cst = isWithinBusinessHours(schedule, 'America/Chicago')
  const est = isWithinBusinessHours(schedule, 'America/New_York')
  const pst = isWithinBusinessHours(schedule, 'America/Los_Angeles')
  assert.strictEqual(typeof cst, 'boolean')
  assert.strictEqual(typeof est, 'boolean')
  assert.strictEqual(typeof pst, 'boolean')
})

test('TCPA Quiet Hours Curfew Evaluation', () => {
  const quietHours = isTcpaQuietHours('America/Chicago')
  assert.strictEqual(typeof quietHours, 'boolean')
})

test('Telnyx Ed25519 Webhook Signature Verification', () => {
  // Generate real Ed25519 keypair
  const keyPair = crypto.generateKeyPairSync('ed25519')
  const rawPub = keyPair.publicKey.export({ format: 'der', type: 'spki' }).subarray(12)
  const pubBase64 = rawPub.toString('base64')

  const now = Math.floor(Date.now() / 1000)
  const rawBody = JSON.stringify({ data: { event_type: 'call.hangup', id: 'evt_123' } })
  const payloadToSign = `${now}|${rawBody}`
  const validSignature = crypto.sign(null, Buffer.from(payloadToSign), keyPair.privateKey).toString('base64')

  // 1. Valid signature passes
  const resultValid = verifyTelnyxSignature(rawBody, validSignature, String(now), pubBase64)
  assert.strictEqual(resultValid, true)

  // 2. Tampered body fails
  const tamperedBody = JSON.stringify({ data: { event_type: 'call.hangup', id: 'tampered' } })
  const resultTampered = verifyTelnyxSignature(tamperedBody, validSignature, String(now), pubBase64)
  assert.strictEqual(resultTampered, false)

  // 3. Expired timestamp (> 300s) fails replay protection
  const expiredTimestamp = String(now - 400)
  const resultExpired = verifyTelnyxSignature(rawBody, validSignature, expiredTimestamp, pubBase64)
  assert.strictEqual(resultExpired, false)

  // 4. Missing headers fail
  assert.strictEqual(verifyTelnyxSignature(rawBody, null, String(now), pubBase64), false)
  assert.strictEqual(verifyTelnyxSignature(rawBody, validSignature, null, pubBase64), false)
})
