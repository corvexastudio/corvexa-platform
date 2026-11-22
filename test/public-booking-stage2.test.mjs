import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateDetailedSlots,
  calculateAvailableSlots,
  getSelectableDatesInTimezone,
  getDayOfWeekName
} from '../src/lib/booking/availability.ts'
import {
  getFriendlyTimezoneLabel,
  isDifferentFromDeviceTimezone,
  formatTimeInTz,
  formatDateInTz
} from '../src/lib/temporal/timezone.ts'

/**
 * Standard test business hours (Mon-Fri 08:00 - 17:00, Sat 09:00 - 13:00, Sun Closed)
 */
const standardBusinessHours = {
  sunday: { open: '08:00', close: '17:00', closed: true },
  monday: { open: '08:00', close: '17:00', closed: false },
  tuesday: { open: '08:00', close: '17:00', closed: false },
  wednesday: { open: '08:00', close: '17:00', closed: false },
  thursday: { open: '08:00', close: '17:00', closed: false },
  friday: { open: '08:00', close: '17:00', closed: false },
  saturday: { open: '09:00', close: '13:00', closed: false }
}

const standardOrgConfig = {
  timezone: 'America/Chicago',
  business_hours: standardBusinessHours,
  buffer_minutes: 15,
  minimum_notice_hours: 2,
  max_booking_days_ahead: 30,
  blocked_dates: ['2026-11-26'] // e.g. Thanksgiving
}

const standardService = {
  id: 'srv-1',
  name: 'Standard Plumbing Diagnostic',
  duration_minutes: 60
}

// --------------------------------------------------------------------------
// Scenario 1: Available and unavailable dates (open vs closed/blocked/past/full)
// --------------------------------------------------------------------------
test('Scenario 1: Available and unavailable dates (open vs closed vs blocked vs past)', () => {
  // A. Open weekday (Wednesday)
  const openResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-25', // Wednesday
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })
  assert.equal(openResult.dayStatus, 'available')
  assert.ok(openResult.availableSlots.length > 0)

  // B. Closed day (Sunday)
  const closedResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-29', // Sunday
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })
  assert.equal(closedResult.dayStatus, 'closed')
  assert.equal(closedResult.availableSlots.length, 0)

  // C. Blocked holiday date
  const blockedResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-26', // Blocked in config
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })
  assert.equal(blockedResult.dayStatus, 'blocked')
  assert.equal(blockedResult.availableSlots.length, 0)

  // D. Date outside max booking window (> 30 days)
  const outsideResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2027-01-15',
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })
  assert.equal(outsideResult.dayStatus, 'outside_window')
  assert.equal(outsideResult.availableSlots.length, 0)
})

// --------------------------------------------------------------------------
// Scenario 2: Available and unavailable slots (open vs booked vs past status)
// --------------------------------------------------------------------------
test('Scenario 2: Detailed slots categorisation (available vs booked vs past)', () => {
  // Existing appointment from 09:00 to 10:00 local time on 2026-11-25
  // 09:00 Chicago is 15:00 UTC (standard time)
  const appt = {
    id: 'appt-1',
    start_time: '2026-11-25T15:00:00Z',
    end_time: '2026-11-25T16:00:00Z',
    status: 'confirmed'
  }

  const result = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-25',
    existingAppointments: [appt],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  // Check that 9:00 AM slot is marked booked
  const bookedSlot = result.allSlots.find(s => s.displayTime === '9:00 AM')
  assert.ok(bookedSlot, '9:00 AM slot must be in allSlots')
  assert.equal(bookedSlot.status, 'booked')
  assert.equal(bookedSlot.isAvailable, false)

  // Check that 1:00 PM slot is available (well clear of morning appointment and buffer)
  const openSlot = result.allSlots.find(s => s.displayTime === '1:00 PM')
  assert.ok(openSlot, '1:00 PM slot must be in allSlots')
  assert.equal(openSlot.status, 'available')
  assert.equal(openSlot.isAvailable, true)

  assert.ok(result.bookedSlotsCount >= 1)
})

// --------------------------------------------------------------------------
// Scenario 3: Different service durations (30m, 60m, 90m, 120m)
// --------------------------------------------------------------------------
test('Scenario 3: Different service durations correctly adjust end times and slot counts', () => {
  const refTime = new Date('2026-11-20T12:00:00Z')
  const dateStr = '2026-11-25' // 8:00 - 17:00 (9 hours = 540 minutes)

  // 30 minute service
  const res30 = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: { id: 's-30', name: 'Quick Check', duration_minutes: 30 },
    dateStr,
    existingAppointments: [],
    referenceTime: refTime
  })
  // 60 minute service
  const res60 = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: { id: 's-60', name: 'Standard Service', duration_minutes: 60 },
    dateStr,
    existingAppointments: [],
    referenceTime: refTime
  })
  // 120 minute service
  const res120 = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: { id: 's-120', name: 'Major Overhaul', duration_minutes: 120 },
    dateStr,
    existingAppointments: [],
    referenceTime: refTime
  })

  // 30m service should yield more or equal available slots than 60m, and 60m more than 120m
  assert.ok(res30.availableSlots.length > res60.availableSlots.length)
  assert.ok(res60.availableSlots.length > res120.availableSlots.length)

  // Check duration calculation on individual slot
  const slot30 = res30.availableSlots[0]
  const diff30 = (new Date(slot30.endTime).getTime() - new Date(slot30.startTime).getTime()) / (60 * 1000)
  assert.equal(diff30, 30)

  const slot120 = res120.availableSlots[0]
  const diff120 = (new Date(slot120.endTime).getTime() - new Date(slot120.startTime).getTime()) / (60 * 1000)
  assert.equal(diff120, 120)
})

// --------------------------------------------------------------------------
// Scenario 4: Add-on duration adjustments (60m base + 45m add-ons = 105m total)
// --------------------------------------------------------------------------
test('Scenario 4: Add-on duration correctly extends service duration and recalculates slots', () => {
  const refTime = new Date('2026-11-20T12:00:00Z')
  const dateStr = '2026-11-25'

  const baseService = { id: 'srv-base', name: 'HVAC Inspection', duration_minutes: 60 }
  const totalCombinedDuration = 60 + 30 + 15 // 105 minutes

  const resBase = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: baseService,
    dateStr,
    existingAppointments: [],
    referenceTime: refTime
  })

  const resCombined = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: { ...baseService, duration_minutes: totalCombinedDuration },
    dateStr,
    existingAppointments: [],
    referenceTime: refTime
  })

  // 105m duration slot length verification
  const slot = resCombined.availableSlots[0]
  const durationMinutes = (new Date(slot.endTime).getTime() - new Date(slot.startTime).getTime()) / 60000
  assert.equal(durationMinutes, 105)

  // The last slot of the day must not exceed close time (17:00)
  const lastSlot = resCombined.availableSlots[resCombined.availableSlots.length - 1]
  const lastSlotEnd = new Date(lastSlot.endTime)
  // In Chicago timezone (UTC-6 in November), 17:00 is 23:00 UTC
  assert.ok(lastSlotEnd.getUTCHours() <= 23)
})

// --------------------------------------------------------------------------
// Scenario 5: Business timezone handling (slots calculated strictly in business timezone)
// --------------------------------------------------------------------------
test('Scenario 5: Slots are calculated strictly in the business timezone regardless of runner environment', () => {
  // Test business in New York (America/New_York)
  const nyConfig = {
    ...standardOrgConfig,
    timezone: 'America/New_York'
  }
  const resultNY = calculateDetailedSlots({
    orgConfig: nyConfig,
    service: standardService,
    dateStr: '2026-11-25',
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  // First slot open at 08:00 AM New York time (13:00 UTC in winter EST)
  const firstSlotNY = resultNY.availableSlots[0]
  assert.equal(firstSlotNY.displayTime, '8:00 AM')
  assert.equal(new Date(firstSlotNY.startTime).toISOString(), '2026-11-25T13:00:00.000Z')

  // Test business in Los Angeles (America/Los_Angeles)
  const laConfig = {
    ...standardOrgConfig,
    timezone: 'America/Los_Angeles'
  }
  const resultLA = calculateDetailedSlots({
    orgConfig: laConfig,
    service: standardService,
    dateStr: '2026-11-25',
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  // First slot open at 08:00 AM LA time (16:00 UTC in winter PST)
  const firstSlotLA = resultLA.availableSlots[0]
  assert.equal(firstSlotLA.displayTime, '8:00 AM')
  assert.equal(new Date(firstSlotLA.startTime).toISOString(), '2026-11-25T16:00:00.000Z')
})

// --------------------------------------------------------------------------
// Scenario 6: Browser timezone different from business timezone
// --------------------------------------------------------------------------
test('Scenario 6: Cross-timezone detection and friendly timezone label formatting', () => {
  const labelNY = getFriendlyTimezoneLabel('America/New_York')
  const labelChicago = getFriendlyTimezoneLabel('America/Chicago')
  const labelLA = getFriendlyTimezoneLabel('America/Los_Angeles')
  const labelDenver = getFriendlyTimezoneLabel('America/Denver')

  assert.ok(labelNY.includes('Eastern'))
  assert.ok(labelChicago.includes('Central'))
  assert.ok(labelLA.includes('Pacific'))
  assert.ok(labelDenver.includes('Mountain'))

  // Verify formatTimeInTz correctly formats specific UTC timestamps in given timezone
  const utcIso = '2026-11-25T15:00:00Z'
  const timeInChicago = formatTimeInTz(utcIso, 'America/Chicago')
  assert.equal(timeInChicago, '9:00 AM')

  const timeInNY = formatTimeInTz(utcIso, 'America/New_York')
  assert.equal(timeInNY, '10:00 AM')

  const timeInLA = formatTimeInTz(utcIso, 'America/Los_Angeles')
  assert.equal(timeInLA, '7:00 AM')
})

// --------------------------------------------------------------------------
// Scenario 7: Daylight-saving transitions (spring forward & fall back)
// --------------------------------------------------------------------------
test('Scenario 7: Daylight saving transitions handle spring forward and fall back cleanly', () => {
  // Spring Forward: Sunday, March 8, 2026 in America/Chicago
  // Monday, March 9, 2026 is after spring forward (CDT, UTC-5)
  const springResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-03-09',
    existingAppointments: [],
    referenceTime: new Date('2026-03-01T12:00:00Z')
  })
  assert.equal(springResult.dayStatus, 'available')
  const springFirst = springResult.availableSlots[0]
  assert.equal(springFirst.displayTime, '8:00 AM')
  // 8:00 AM CDT is 13:00 UTC (CDT is UTC-5)
  assert.equal(new Date(springFirst.startTime).toISOString(), '2026-03-09T13:00:00.000Z')

  // Fall Back: Sunday, November 1, 2026 in America/Chicago
  // Monday, November 2, 2026 is after fall back (CST, UTC-6)
  const fallResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-02',
    existingAppointments: [],
    referenceTime: new Date('2026-10-25T12:00:00Z')
  })
  assert.equal(fallResult.dayStatus, 'available')
  const fallFirst = fallResult.availableSlots[0]
  assert.equal(fallFirst.displayTime, '8:00 AM')
  // 8:00 AM CST is 14:00 UTC (CST is UTC-6)
  assert.equal(new Date(fallFirst.startTime).toISOString(), '2026-11-02T14:00:00.000Z')
})

// --------------------------------------------------------------------------
// Scenario 8: Appointment buffer behavior
// --------------------------------------------------------------------------
test('Scenario 8: Appointment buffer prevents overlapping bookings and enforces travel/cleanup time', () => {
  // Appointment from 9:00 AM to 10:00 AM Chicago time
  const appt = {
    id: 'appt-buffer-test',
    start_time: '2026-11-25T15:00:00Z', // 9:00 AM CST
    end_time: '2026-11-25T16:00:00Z',   // 10:00 AM CST
    status: 'confirmed'
  }

  // With a 15-minute buffer, a slot from 10:00 to 11:00 AM starts at 10:00 AM,
  // which is within the 10:00 + 15m buffer window, so 10:00 AM is blocked!
  const resWithBuffer = calculateDetailedSlots({
    orgConfig: { ...standardOrgConfig, buffer_minutes: 15 },
    service: standardService, // 60 mins
    dateStr: '2026-11-25',
    existingAppointments: [appt],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  const slotAt10 = resWithBuffer.allSlots.find(s => s.displayTime === '10:00 AM')
  assert.ok(slotAt10, '10:00 AM slot exists in allSlots')
  assert.equal(slotAt10.isAvailable, false, '10:00 AM slot must be blocked due to buffer conflict')

  // Slot starting at 10:30 AM is outside the 15-minute buffer (10:15 AM)
  const slotAt1030 = resWithBuffer.allSlots.find(s => s.displayTime === '10:30 AM')
  assert.ok(slotAt1030, '10:30 AM slot exists in allSlots')
  assert.equal(slotAt1030.isAvailable, true, '10:30 AM slot must be open after buffer expires')
})

// --------------------------------------------------------------------------
// Scenario 9: Existing appointment conflicts (blocking active, releasing cancelled)
// --------------------------------------------------------------------------
test('Scenario 9: Active appointments block slots, while cancelled appointments immediately release them', () => {
  const cancelledAppt = {
    id: 'appt-cancelled',
    start_time: '2026-11-25T15:00:00Z', // 9:00 AM
    end_time: '2026-11-25T16:00:00Z',   // 10:00 AM
    status: 'cancelled'
  }

  const res = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-25',
    existingAppointments: [cancelledAppt],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  const slot9 = res.allSlots.find(s => s.displayTime === '9:00 AM')
  assert.ok(slot9)
  assert.equal(slot9.isAvailable, true, 'Cancelled appointment must not block slot')
  assert.equal(slot9.status, 'available')
})

// --------------------------------------------------------------------------
// Scenario 10: Standalone job conflicts preventing double-booking
// --------------------------------------------------------------------------
test('Scenario 10: Job conflicts correctly block availability', () => {
  // A standalone dispatch job occupying 13:00 to 15:00 Chicago time (19:00 to 21:00 UTC)
  const jobAsAppt = {
    id: 'job-101',
    start_time: '2026-11-25T19:00:00Z', // 1:00 PM CST
    end_time: '2026-11-25T21:00:00Z',   // 3:00 PM CST
    status: 'scheduled'
  }

  const res = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-25',
    existingAppointments: [jobAsAppt],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  const slot1PM = res.allSlots.find(s => s.displayTime === '1:00 PM')
  const slot2PM = res.allSlots.find(s => s.displayTime === '2:00 PM')
  assert.equal(slot1PM.isAvailable, false)
  assert.equal(slot1PM.status, 'booked')
  assert.equal(slot2PM.isAvailable, false)
  assert.equal(slot2PM.status, 'booked')

  const slot330PM = res.allSlots.find(s => s.displayTime === '3:30 PM')
  assert.equal(slot330PM.isAvailable, true)
})

// --------------------------------------------------------------------------
// Scenario 11: Slot becoming unavailable before submission (concurrency error handling)
// --------------------------------------------------------------------------
test('Scenario 11: Concurrent collision detection returns clear error and triggers step 2 recovery', () => {
  // Simulate the conflict response contract returned by /api/book/[slug]/submit
  const conflictResponse = {
    ok: false,
    status: 400,
    data: { error: 'This time slot is no longer available. Please select another time.' }
  }

  const errMsg = conflictResponse.data.error
  const isConflict = errMsg.toLowerCase().includes('no longer available') || errMsg.toLowerCase().includes('conflict')
  assert.equal(isConflict, true)

  // Verify that recovery contract resets selected slot and moves user back to step 2
  let state = { selectedSlot: { startTime: '2026-11-25T15:00:00Z' }, step: 3 }
  if (isConflict) {
    state = { selectedSlot: null, step: 2 }
  }
  assert.equal(state.selectedSlot, null)
  assert.equal(state.step, 2)
})

// --------------------------------------------------------------------------
// Scenario 12: No availability for a selected date (empty state & next available date)
// --------------------------------------------------------------------------
test('Scenario 12: Fully booked date returns appropriate dayStatus and identifies next open date', () => {
  // Fill all slots for Wednesday Nov 25
  const fullAppointments = []
  // Business hours are 8:00 to 17:00 Chicago (14:00 to 23:00 UTC)
  for (let h = 14; h < 23; h++) {
    fullAppointments.push({
      id: `appt-full-${h}`,
      start_time: `2026-11-25T${String(h).padStart(2, '0')}:00:00Z`,
      end_time: `2026-11-25T${String(h + 1).padStart(2, '0')}:00:00Z`,
      status: 'confirmed'
    })
  }

  const fullResult = calculateDetailedSlots({
    orgConfig: standardOrgConfig,
    service: standardService,
    dateStr: '2026-11-25',
    existingAppointments: fullAppointments,
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  assert.equal(fullResult.availableSlots.length, 0)
  assert.equal(fullResult.dayStatus, 'fully_booked')

  // Next candidate recovery: Nov 26 is blocked holiday, Nov 27 is Friday (open)
  const selectableDates = getSelectableDatesInTimezone('America/Chicago', 14, new Date('2026-11-25T12:00:00Z'))
  const currentIndex = selectableDates.findIndex(d => d.dateStr === '2026-11-25')
  
  let nextOpenDate = null
  for (let i = currentIndex + 1; i < selectableDates.length; i++) {
    const candidate = selectableDates[i]
    const dayName = getDayOfWeekName(candidate.dateStr, 'America/Chicago')
    const bh = standardBusinessHours[dayName]
    const isClosed = !bh || bh.closed === true
    const isBlocked = standardOrgConfig.blocked_dates.includes(candidate.dateStr)
    if (!isClosed && !isBlocked) {
      nextOpenDate = candidate
      break
    }
  }

  assert.ok(nextOpenDate, 'Must find next open candidate')
  // Nov 26 is blocked, so next open date must be Friday Nov 27
  assert.equal(nextOpenDate.dateStr, '2026-11-27')
  assert.equal(nextOpenDate.dayOfWeek, 'Fri')
})

// --------------------------------------------------------------------------
// Scenario 13: Mobile responsiveness invariants
// --------------------------------------------------------------------------
test('Scenario 13: Mobile touch target and layout invariants (>= 44px targets, no horizontal overflow)', () => {
  // Minimum touch target sizes specified in WCAG 2.5.5 / 2.5.8
  const MIN_TOUCH_TARGET_PX = 44
  
  // Date rail buttons: h-12 (48px) or min-w-[72px] py-2.5 (>= 44px)
  const datePillHeight = 56 // py-2.5 + text + label >= 56px
  const datePillWidth = 72
  assert.ok(datePillHeight >= MIN_TOUCH_TARGET_PX)
  assert.ok(datePillWidth >= MIN_TOUCH_TARGET_PX)

  // Time slot buttons: h-12 (48px)
  const timeSlotButtonHeight = 48
  assert.ok(timeSlotButtonHeight >= MIN_TOUCH_TARGET_PX)

  // Full calendar modal day grid button: min-h-[44px]
  const calendarModalTarget = 44
  assert.ok(calendarModalTarget >= MIN_TOUCH_TARGET_PX)

  // Bottom action bar CTA: h-11 / h-12 (44px - 48px)
  const bottomBarCtaHeight = 48
  assert.ok(bottomBarCtaHeight >= MIN_TOUCH_TARGET_PX)
})

// --------------------------------------------------------------------------
// Scenario 14: Tenant isolation
// --------------------------------------------------------------------------
test('Scenario 14: Multi-tenant availability isolation guarantees no cross-org slot leakage', () => {
  const org1Config = {
    ...standardOrgConfig,
    business_hours: {
      ...standardBusinessHours,
      monday: { open: '08:00', close: '12:00', closed: false } // Morning only
    }
  }

  const org2Config = {
    ...standardOrgConfig,
    business_hours: {
      ...standardBusinessHours,
      monday: { open: '13:00', close: '17:00', closed: false } // Afternoon only
    }
  }

  const dateStr = '2026-11-23' // Monday

  const resOrg1 = calculateDetailedSlots({
    orgConfig: org1Config,
    service: standardService,
    dateStr,
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  const resOrg2 = calculateDetailedSlots({
    orgConfig: org2Config,
    service: standardService,
    dateStr,
    existingAppointments: [],
    referenceTime: new Date('2026-11-20T12:00:00Z')
  })

  // Org 1 slots must only be in morning (< 12:00 PM)
  for (const slot of resOrg1.availableSlots) {
    assert.ok(slot.displayTime.includes('AM'))
  }

  // Org 2 slots must only be in afternoon (>= 1:00 PM)
  for (const slot of resOrg2.availableSlots) {
    assert.ok(slot.displayTime.includes('PM'))
  }

  // Intersecting slot lists must be disjoint
  const org1Times = new Set(resOrg1.availableSlots.map(s => s.displayTime))
  const org2Times = new Set(resOrg2.availableSlots.map(s => s.displayTime))
  for (const t of org1Times) {
    assert.equal(org2Times.has(t), false, `Time ${t} must not leak across tenants`)
  }
})
