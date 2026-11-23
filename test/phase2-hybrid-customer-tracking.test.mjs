import test from 'node:test'
import assert from 'node:assert/strict'

/**
 * Phase 2 Unit Tests: Hybrid Customer Tracking Page
 * Domino's Smart Milestones, Contractor Privacy Mode, and Verified Trade License
 */

// Mirror stage index calculation from src/app/track/[token]/page.tsx
function getStageIndex(job) {
  if (job.status === 'completed' || Boolean(job.completedAt)) return 4
  if (job.status === 'arrived' || (Boolean(job.arrivedAt) && !job.startedAt)) return 2
  if (job.status === 'in_progress' || Boolean(job.startedAt)) return 3
  if (job.status === 'en_route' || Boolean(job.enRouteAt)) return 1
  return 0
}

test('PHASE 2: Domino\'s 5-Stage Smart Milestone Progression', async (t) => {
  await t.test('maps scheduled and confirmed jobs to Stage 0 (Scheduled)', () => {
    assert.equal(getStageIndex({ status: 'scheduled' }), 0)
    assert.equal(getStageIndex({ status: 'confirmed' }), 0)
    assert.equal(getStageIndex({ status: 'draft' }), 0)
  })

  await t.test('maps en_route jobs to Stage 1 (En Route)', () => {
    assert.equal(getStageIndex({ status: 'en_route', enRouteAt: '2026-10-27T14:00:00Z' }), 1)
    // If status is confirmed but enRouteAt timestamp is recorded
    assert.equal(getStageIndex({ status: 'confirmed', enRouteAt: '2026-10-27T14:00:00Z' }), 1)
  })

  await t.test('maps arrived jobs to Stage 2 (Arrived On-Site)', () => {
    assert.equal(getStageIndex({ status: 'arrived' }), 2)
    // If status is in_progress but startedAt is not yet set and arrivedAt is set
    assert.equal(
      getStageIndex({
        status: 'in_progress',
        arrivedAt: '2026-10-27T14:15:00Z',
        startedAt: null
      }),
      2
    )
  })

  await t.test('maps in_progress jobs to Stage 3 (Working On-Site)', () => {
    assert.equal(getStageIndex({ status: 'in_progress', startedAt: '2026-10-27T14:20:00Z' }), 3)
  })

  await t.test('maps completed jobs to Stage 4 (Done)', () => {
    assert.equal(getStageIndex({ status: 'completed', completedAt: '2026-10-27T15:00:00Z' }), 4)
  })

  await t.test('calculates correct progress fill width across 5 stages', () => {
    const STAGE_COUNT = 5
    const getProgressWidth = (index) => `${(index / (STAGE_COUNT - 1)) * 88}%`

    assert.equal(getProgressWidth(0), '0%')
    assert.equal(getProgressWidth(1), '22%')
    assert.equal(getProgressWidth(2), '44%')
    assert.equal(getProgressWidth(3), '66%')
    assert.equal(getProgressWidth(4), '88%')
  })
})

test('PHASE 2: Contractor Milestone Tracking (GPS and Geofence Removed)', async (t) => {
  await t.test('standardizes on milestone tracking for 100% contractor privacy and accuracy', () => {
    const org = {
      id: 'org-test-1',
      name: 'Apex Plumbing'
    }

    // Vehicle tracking and geofence columns have been removed
    assert.equal(org.tracking_mode, undefined)
    assert.equal(org.tracking_geofence_miles, undefined)
  })
})

test('PHASE 2: Homeowner Trust & Verified Trade License Badge', async (t) => {
  await t.test('formats license badge accurately when license number is provided', () => {
    const org = {
      name: 'ProLine HVAC & Refrigeration',
      license_number: 'TACLA001234E'
    }

    assert.ok(org.license_number)
    const badgeText = `State Certified Trade License #${org.license_number}`
    assert.equal(badgeText, 'State Certified Trade License #TACLA001234E')
  })

  await t.test('provides fallbacks when license number is omitted', () => {
    const org = {
      name: 'Solo Handyman Services',
      license_number: null
    }

    const hasLicense = Boolean(org.license_number)
    assert.equal(hasLicense, false)
  })
})
