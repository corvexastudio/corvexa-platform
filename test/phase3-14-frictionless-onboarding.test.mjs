import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('Phase 3.14 - Frictionless Onboarding: Source code eliminates 10DLC blocker from primary path', () => {
  const onboardingFile = fs.readFileSync(path.resolve('src/app/client/onboarding/page.tsx'), 'utf-8')

  // 1. Reassuring Free 3-Job Starter Pass badge
  assert.ok(
    onboardingFile.includes('Free 3-Job Starter Pass Active'),
    'Includes Free Starter Pass reassurance badge at top of onboarding'
  )

  // 2. Eliminates nested scroll container
  assert.ok(
    !onboardingFile.includes('max-h-52 overflow-y-auto'),
    'Eliminates max-h-52 overflow-y-auto nested scrollbar trap'
  )

  // 3. 4-column responsive grid for primary trades
  assert.ok(
    onboardingFile.includes('grid-cols-2 sm:grid-cols-4'),
    'Displays primary trades in responsive 4-column layout'
  )

  // 4. Title casing helper exists
  assert.ok(
    onboardingFile.includes('function toTitleCase'),
    'Includes toTitleCase helper to avoid messy lowercase business names'
  )

  // 5. Benefit-driven mobile alert field
  assert.ok(
    onboardingFile.includes('Where should we text your booking alerts?'),
    'Reframes notification phone with high contractor benefit'
  )

  // 6. Primary CTA delivers instant value
  assert.ok(
    onboardingFile.includes('Launch Workspace &amp; Claim 3 Free Jobs') ||
    onboardingFile.includes('Launch Workspace & Claim 3 Free Jobs'),
    'Primary CTA launches workspace immediately without 10DLC roadblock'
  )

  // 7. 10DLC is optional accordion
  assert.ok(
    onboardingFile.includes('show10Dlc'),
    'Supports optional 10DLC accordion toggle without blocking 95% of contractors'
  )

  // 8. Mobile touch targets
  assert.ok(
    onboardingFile.includes('min-h-[48px]'),
    'Primary button provides minimum 48px touch ergonomic target'
  )
})
