import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLocalDayUtcBoundaries,
  zonedDateTimeToUtc,
  formatDateToIsoYmdInTz,
  normalizeTimezone
} from '../src/lib/temporal/timezone.ts'

test('Timezone Date Boundary Engine: Normalizes valid US and IANA timezones', () => {
  assert.equal(normalizeTimezone('America/Chicago'), 'America/Chicago')
  assert.equal(normalizeTimezone('america/new_york'), 'America/New_York')
  assert.equal(normalizeTimezone('America/Los_Angeles'), 'America/Los_Angeles')
  assert.equal(normalizeTimezone('UTC'), 'UTC')
  assert.equal(normalizeTimezone(null), 'America/Chicago')
  assert.equal(normalizeTimezone(''), 'America/Chicago')
})

test('Timezone Date Boundary Engine: Converts local date to exact UTC midnight boundaries', () => {
  const timezones = [
    { id: 'America/Chicago', stdOffsetHours: -6 },
    { id: 'America/New_York', stdOffsetHours: -5 },
    { id: 'America/Los_Angeles', stdOffsetHours: -8 },
    { id: 'UTC', stdOffsetHours: 0 }
  ]

  // Test winter date (Standard Time)
  const winterDate = '2026-01-15'
  for (const tz of timezones) {
    const { startUtc, endUtc, ymd } = getLocalDayUtcBoundaries(winterDate, tz.id)
    assert.equal(ymd, winterDate)

    // Formatted in the target timezone, start and end must both equal winterDate
    assert.equal(formatDateToIsoYmdInTz(startUtc, tz.id), winterDate)
    assert.equal(formatDateToIsoYmdInTz(endUtc, tz.id), winterDate)

    // Verify hour in UTC matches offset: 00:00 local - offset = UTC start
    const expectedStartHourUtc = (24 - tz.stdOffsetHours) % 24
    assert.equal(startUtc.getUTCHours(), expectedStartHourUtc)
  }
})

test('Timezone Date Boundary Engine: Handles jobs near both ends of the local calendar day (Early Morning and Late Evening)', () => {
  const timezones = ['America/Chicago', 'America/New_York', 'America/Los_Angeles', 'America/Phoenix', 'UTC']
  const testDate = '2026-11-21'

  for (const tz of timezones) {
    const { startUtc, endUtc } = getLocalDayUtcBoundaries(testDate, tz)

    // 12:00:00.000 AM local (Midnight start)
    const midnightJob = zonedDateTimeToUtc(2026, 11, 21, 0, 0, 0, 0, tz)
    assert.equal(midnightJob.getTime(), startUtc.getTime(), `${tz}: Midnight job matches startUtc`)
    assert.equal(formatDateToIsoYmdInTz(midnightJob, tz), testDate)

    // 12:05:00 AM local (Early Morning job)
    const earlyJob = zonedDateTimeToUtc(2026, 11, 21, 0, 5, 0, 0, tz)
    assert.ok(earlyJob >= startUtc && earlyJob <= endUtc, `${tz}: Early morning job is within boundaries`)
    assert.equal(formatDateToIsoYmdInTz(earlyJob, tz), testDate)

    // 11:55:00 PM local (Late Evening job)
    const lateJob = zonedDateTimeToUtc(2026, 11, 21, 23, 55, 0, 0, tz)
    assert.ok(lateJob >= startUtc && lateJob <= endUtc, `${tz}: Late evening job is within boundaries`)
    assert.equal(formatDateToIsoYmdInTz(lateJob, tz), testDate)

    // 11:59:59.999 PM local (Last millisecond of the day)
    const lastMsJob = zonedDateTimeToUtc(2026, 11, 21, 23, 59, 59, 999, tz)
    assert.equal(lastMsJob.getTime(), endUtc.getTime(), `${tz}: Last millisecond job matches endUtc`)
    assert.equal(formatDateToIsoYmdInTz(lastMsJob, tz), testDate)

    // 12:00:00.000 AM next day (Must be strictly excluded)
    const nextDayJob = zonedDateTimeToUtc(2026, 11, 22, 0, 0, 0, 0, tz)
    assert.ok(nextDayJob > endUtc, `${tz}: Next day job is strictly outside today boundaries`)
    assert.equal(formatDateToIsoYmdInTz(nextDayJob, tz), '2026-11-22')

    // 11:59:59.999 PM previous day (Must be strictly excluded)
    const prevDayJob = zonedDateTimeToUtc(2026, 11, 20, 23, 59, 59, 999, tz)
    assert.ok(prevDayJob < startUtc, `${tz}: Previous day job is strictly outside today boundaries`)
    assert.equal(formatDateToIsoYmdInTz(prevDayJob, tz), '2026-11-20')
  }
})

test('Timezone Date Boundary Engine: Handles US Daylight Saving Time (DST) transitions cleanly', () => {
  const timezones = ['America/Chicago', 'America/New_York', 'America/Los_Angeles']

  // 1. Spring-Forward Transition: Sunday, March 8, 2026 (23-hour day)
  const springDate = '2026-03-08'
  for (const tz of timezones) {
    const { startUtc, endUtc, ymd } = getLocalDayUtcBoundaries(springDate, tz)
    assert.equal(ymd, springDate)
    assert.equal(formatDateToIsoYmdInTz(startUtc, tz), springDate)
    assert.equal(formatDateToIsoYmdInTz(endUtc, tz), springDate)

    // Duration of spring forward day is 23 hours minus 1 ms
    const durationHours = (endUtc.getTime() - startUtc.getTime() + 1) / (1000 * 60 * 60)
    assert.equal(durationHours, 23, `${tz}: Spring-forward day has exactly 23 hours`)
  }

  // 2. Fall-Back Transition: Sunday, November 1, 2026 (25-hour day)
  const fallDate = '2026-11-01'
  for (const tz of timezones) {
    const { startUtc, endUtc, ymd } = getLocalDayUtcBoundaries(fallDate, tz)
    assert.equal(ymd, fallDate)
    assert.equal(formatDateToIsoYmdInTz(startUtc, tz), fallDate)
    assert.equal(formatDateToIsoYmdInTz(endUtc, tz), fallDate)

    // Duration of fall back day is 25 hours minus 1 ms
    const durationHours = (endUtc.getTime() - startUtc.getTime() + 1) / (1000 * 60 * 60)
    assert.equal(durationHours, 25, `${tz}: Fall-back day has exactly 25 hours`)
  }
})

test('Timezone Date Boundary Engine: Cross-Module Agreement between Today, Field Route, and Schedule', () => {
  const orgTimezone = 'America/Chicago'
  const activeDate = '2026-11-21'

  // Today boundaries:
  const { startUtc, endUtc } = getLocalDayUtcBoundaries(activeDate, orgTimezone)

  // Simulate 3 jobs scheduled across the day
  const job1Utc = zonedDateTimeToUtc(2026, 11, 21, 8, 0, 0, 0, orgTimezone).toISOString() // 8:00 AM CST
  const job2Utc = zonedDateTimeToUtc(2026, 11, 21, 14, 30, 0, 0, orgTimezone).toISOString() // 2:30 PM CST
  const job3Utc = zonedDateTimeToUtc(2026, 11, 21, 22, 15, 0, 0, orgTimezone).toISOString() // 10:15 PM CST

  // Next day job
  const jobNextDayUtc = zonedDateTimeToUtc(2026, 11, 22, 9, 0, 0, 0, orgTimezone).toISOString()

  const allJobs = [
    { id: '1', scheduled_start: job1Utc },
    { id: '2', scheduled_start: job2Utc },
    { id: '3', scheduled_start: job3Utc },
    { id: '4', scheduled_start: jobNextDayUtc }
  ]

  // Module 1: Today DB query filtering simulation (gte startUtc, lte endUtc)
  const todayMatchedJobs = allJobs.filter(
    j => j.scheduled_start >= startUtc.toISOString() && j.scheduled_start <= endUtc.toISOString()
  )

  // Module 2: Field Route client-side matching (format to YYYY-MM-DD in orgTimezone)
  const routeMatchedJobs = allJobs.filter(j => {
    const jDate = formatDateToIsoYmdInTz(j.scheduled_start, orgTimezone)
    return jDate === activeDate
  })

  // Module 3: Schedule Dispatch Agenda matching
  const scheduleMatchedJobs = allJobs.filter(j => {
    const jDate = formatDateToIsoYmdInTz(j.scheduled_start, orgTimezone)
    return jDate === activeDate
  })

  // All three must match exactly the 3 jobs for today and exclude the 4th
  assert.equal(todayMatchedJobs.length, 3)
  assert.equal(routeMatchedJobs.length, 3)
  assert.equal(scheduleMatchedJobs.length, 3)

  assert.deepEqual(
    todayMatchedJobs.map(j => j.id),
    routeMatchedJobs.map(j => j.id)
  )
  assert.deepEqual(
    routeMatchedJobs.map(j => j.id),
    scheduleMatchedJobs.map(j => j.id)
  )
})
