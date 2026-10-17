/**
 * CaptoDesk Availability & Slot Engine
 * Computes available booking slots accounting for:
 * - Business hours and working days
 * - Service duration & buffer intervals
 * - Blocked dates and blackout periods
 * - Minimum notice and maximum booking window
 * - Timezone boundaries (using Intl.DateTimeFormat)
 * - Existing active appointments (requested, confirmed, scheduled)
 * - Immediate freeing of cancelled or no-show slots
 */

export interface BusinessHoursDay {
  open: string  // '08:00'
  close: string // '18:00'
  closed: boolean
}

export type BusinessHoursConfig = Record<string, BusinessHoursDay>

export interface OrganizationBookingConfig {
  timezone: string
  business_hours: BusinessHoursConfig
  buffer_minutes?: number
  minimum_notice_hours?: number
  max_booking_days_ahead?: number
  blocked_dates?: string[]
}

export interface ServiceItem {
  id: string
  name: string
  duration_minutes: number
  price?: number | null
  requires_address?: boolean
  is_active?: boolean
}

export interface ExistingAppointment {
  id: string
  start_time: string
  end_time?: string | null
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'scheduled'
}

export interface AvailableSlot {
  startTime: string // ISO UTC string
  endTime: string   // ISO UTC string
  displayTime: string // e.g. "9:00 AM"
  date: string       // "YYYY-MM-DD"
}

export interface CalculateSlotsParams {
  orgConfig: OrganizationBookingConfig
  service: Pick<ServiceItem, 'id' | 'name' | 'duration_minutes'>
  dateStr: string // "YYYY-MM-DD"
  existingAppointments: ExistingAppointment[]
  referenceTime?: Date
  stepMinutes?: number // Default: 30 minutes
  isInternal?: boolean // When true (owner dispatch), allows booking all slots for today without advance notice restriction
}

/**
 * Resolves the current "YYYY-MM-DD" date strictly within the target timezone (e.g. US timezones).
 */
export function getTodayInTimezone(timezone: string = 'America/Chicago'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
    return formatter.format(new Date())
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/**
 * Generates selectable date pills strictly calculated within the target timezone (e.g. US timezones).
 */
export function getSelectableDatesInTimezone(
  timezone: string = 'America/Chicago',
  daysCount: number = 7
): Array<{ dateStr: string; dayOfWeek: string; dayNum: string; label: string; isToday: boolean }> {
  const result: Array<{ dateStr: string; dayOfWeek: string; dayNum: string; label: string; isToday: boolean }> = []
  const now = new Date()

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(now)

    const partMap: Record<string, number> = {}
    for (const p of parts) {
      if (p.type !== 'literal') partMap[p.type] = parseInt(p.value, 10)
    }

    const baseDate = new Date(Date.UTC(partMap.year, partMap.month - 1, partMap.day, 12, 0, 0))

    for (let i = 0; i < daysCount; i++) {
      const current = new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000)

      const dateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(current)

      const dayOfWeek = i === 0 ? 'Today' : (i === 1 ? 'Tmrw' : new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(current))
      const dayNum = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'numeric', day: 'numeric' }).format(current)
      const label = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: 'short', day: 'numeric' }).format(current)

      result.push({
        dateStr,
        dayOfWeek,
        dayNum,
        label,
        isToday: i === 0
      })
    }
  } catch {
    const today = new Date()
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = d.toISOString().slice(0, 10)
      result.push({
        dateStr,
        dayOfWeek: i === 0 ? 'Today' : (i === 1 ? 'Tmrw' : d.toLocaleDateString('en-US', { weekday: 'short' })),
        dayNum: d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: i === 0
      })
    }
  }

  return result
}

/**
 * Computes the timezone offset in milliseconds for a given UTC timestamp and IANA timezone.
 */
export function getTimezoneOffsetMs(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
  const parts = formatter.formatToParts(date)
  const map: Record<string, string> = {}
  for (const p of parts) {
    map[p.type] = p.value
  }
  const year = parseInt(map.year, 10)
  const month = parseInt(map.month, 10) - 1
  const day = parseInt(map.day, 10)
  const hour = parseInt(map.hour, 10) % 24
  const minute = parseInt(map.minute, 10)
  const second = parseInt(map.second, 10)

  const targetAsUtc = Date.UTC(year, month, day, hour, minute, second)
  return targetAsUtc - date.getTime()
}

/**
 * Converts a date string "YYYY-MM-DD" and time string "HH:MM" in a specific IANA timezone
 * to a UTC Date object.
 */
export function localDateTimeToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  
  const offsetMs = getTimezoneOffsetMs(new Date(guessUtc), timezone)
  const actualUtcMs = guessUtc - offsetMs
  const refinedOffset = getTimezoneOffsetMs(new Date(actualUtcMs), timezone)
  return new Date(guessUtc - refinedOffset)
}

/**
 * Formats a Date into a 12-hour display string (e.g. "9:00 AM") in the organization's timezone.
 */
export function formatSlotDisplayTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

/**
 * Formats a Date into a localized date string (e.g. "Oct 14") strictly in the organization's timezone.
 */
export function formatSlotDisplayDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric'
  }).format(date)
}

/**
 * Combines date and time display strings strictly evaluated in the organization's timezone.
 */
export function formatSlotDisplayDateTime(date: Date, timezone: string): string {
  return `${formatSlotDisplayDate(date, timezone)} at ${formatSlotDisplayTime(date, timezone)}`
}


/**
 * Returns the lowercase weekday name ("monday", "tuesday", etc.) for a dateStr in the given timezone.
 */
export function getDayOfWeekName(dateStr: string, timezone: string): string {
  const midDay = localDateTimeToUtc(dateStr, '12:00', timezone)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long'
  }).format(midDay).toLowerCase()
}

/**
 * Checks whether two time intervals overlap, taking buffer minutes into account.
 */
export function doesIntervalOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
  bufferMs: number = 0
): boolean {
  return startA < (endB + bufferMs) && startB < (endA + bufferMs)
}

export interface DetailedSlot {
  startTime: string
  endTime: string
  displayTime: string
  date: string
  isAvailable: boolean
  status: 'available' | 'booked' | 'past'
}

export interface DetailedDaySchedule {
  date: string
  dayStatus: 'available' | 'fully_booked' | 'past' | 'closed' | 'blocked' | 'outside_window'
  availableSlots: AvailableSlot[]
  allSlots: DetailedSlot[]
  totalSlots: number
  bookedSlotsCount: number
  availableSlotsCount: number
}

/**
 * Calculates detailed slot availability, distinguishing between open, booked, and past slots.
 */
export function calculateDetailedSlots(params: CalculateSlotsParams): DetailedDaySchedule {
  const {
    orgConfig,
    service,
    dateStr,
    existingAppointments,
    referenceTime = new Date(),
    stepMinutes = 30,
    isInternal = false
  } = params

  const timezone = orgConfig.timezone || 'America/Chicago'
  const bufferMinutes = orgConfig.buffer_minutes ?? 15
  const bufferMs = bufferMinutes * 60 * 1000
  const durationMinutes = service.duration_minutes || 60
  const durationMs = durationMinutes * 60 * 1000
  const minNoticeHours = isInternal ? 0 : (orgConfig.minimum_notice_hours ?? 2)
  const minNoticeMs = minNoticeHours * 60 * 60 * 1000
  const maxDaysAhead = orgConfig.max_booking_days_ahead ?? 30

  // 1. Check blocked dates
  if (orgConfig.blocked_dates && orgConfig.blocked_dates.includes(dateStr)) {
    return {
      date: dateStr,
      dayStatus: 'blocked',
      availableSlots: [],
      allSlots: [],
      totalSlots: 0,
      bookedSlotsCount: 0,
      availableSlotsCount: 0
    }
  }

  // 2. Check maximum booking window
  const startOfDayUtc = localDateTimeToUtc(dateStr, '00:00', timezone)
  const maxFutureDate = new Date(referenceTime.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)
  if (startOfDayUtc > maxFutureDate) {
    return {
      date: dateStr,
      dayStatus: 'outside_window',
      availableSlots: [],
      allSlots: [],
      totalSlots: 0,
      bookedSlotsCount: 0,
      availableSlotsCount: 0
    }
  }

  // 3. Resolve business hours for this day of week
  const dayName = getDayOfWeekName(dateStr, timezone)
  const daySchedule = orgConfig.business_hours?.[dayName]

  if (!daySchedule || daySchedule.closed || !daySchedule.open || !daySchedule.close) {
    return {
      date: dateStr,
      dayStatus: 'closed',
      availableSlots: [],
      allSlots: [],
      totalSlots: 0,
      bookedSlotsCount: 0,
      availableSlotsCount: 0
    }
  }

  const openTimeUtc = localDateTimeToUtc(dateStr, daySchedule.open, timezone)
  const closeTimeUtc = localDateTimeToUtc(dateStr, daySchedule.close, timezone)

  // 4. Filter active existing appointments that reserve time slots
  const activeAppointments = existingAppointments.filter((apt) =>
    ['requested', 'confirmed', 'scheduled'].includes(apt.status)
  )

  const activeIntervals = activeAppointments.map((apt) => {
    const start = new Date(apt.start_time).getTime()
    const end = apt.end_time
      ? new Date(apt.end_time).getTime()
      : start + durationMs
    return { start, end }
  })

  // 5. Generate candidate slots stepped by stepMinutes
  const availableSlots: AvailableSlot[] = []
  const allSlots: DetailedSlot[] = []
  let candidateStart = openTimeUtc.getTime()
  const latestPossibleStart = closeTimeUtc.getTime() - durationMs
  const earliestAllowedTime = referenceTime.getTime() + minNoticeMs

  while (candidateStart <= latestPossibleStart) {
    const candidateEnd = candidateStart + durationMs
    const slotStartDate = new Date(candidateStart)
    const slotEndDate = new Date(candidateEnd)
    const displayTime = formatSlotDisplayTime(slotStartDate, timezone)

    // Check overlap against existing appointments
    const overlaps = activeIntervals.some((interval) =>
      doesIntervalOverlap(candidateStart, candidateEnd, interval.start, interval.end, bufferMs)
    )

    if (overlaps) {
      allSlots.push({
        startTime: slotStartDate.toISOString(),
        endTime: slotEndDate.toISOString(),
        displayTime,
        date: dateStr,
        isAvailable: isInternal, // Owner can still override
        status: 'booked'
      })
    } else if (candidateStart < earliestAllowedTime) {
      const isPast = candidateStart < referenceTime.getTime()
      if (isInternal) {
        // Business owner inside dashboard can select any slot today
        const slotObj: AvailableSlot = {
          startTime: slotStartDate.toISOString(),
          endTime: slotEndDate.toISOString(),
          displayTime,
          date: dateStr
        }
        availableSlots.push(slotObj)
        allSlots.push({
          ...slotObj,
          isAvailable: true,
          status: isPast ? 'past' : 'available'
        })
      } else {
        allSlots.push({
          startTime: slotStartDate.toISOString(),
          endTime: slotEndDate.toISOString(),
          displayTime,
          date: dateStr,
          isAvailable: false,
          status: 'past'
        })
      }
    } else {
      const slotObj: AvailableSlot = {
        startTime: slotStartDate.toISOString(),
        endTime: slotEndDate.toISOString(),
        displayTime,
        date: dateStr
      }
      availableSlots.push(slotObj)
      allSlots.push({
        ...slotObj,
        isAvailable: true,
        status: 'available'
      })
    }

    candidateStart += stepMinutes * 60 * 1000
  }

  const bookedCount = allSlots.filter(s => s.status === 'booked').length
  const pastCount = allSlots.filter(s => s.status === 'past').length
  const availableCount = availableSlots.length

  let dayStatus: DetailedDaySchedule['dayStatus'] = 'closed'
  if (availableCount > 0) {
    dayStatus = 'available'
  } else if (bookedCount > 0) {
    dayStatus = 'fully_booked'
  } else if (pastCount > 0) {
    dayStatus = 'past'
  } else if (allSlots.length > 0) {
    dayStatus = 'fully_booked'
  } else {
    dayStatus = 'closed'
  }

  return {
    date: dateStr,
    dayStatus,
    availableSlots,
    allSlots,
    totalSlots: allSlots.length,
    bookedSlotsCount: bookedCount,
    availableSlotsCount: availableSlots.length
  }
}

/**
 * Core availability engine.
 * Computes all non-overlapping available slots for a given service and date.
 */
export function calculateAvailableSlots(params: CalculateSlotsParams): AvailableSlot[] {
  return calculateDetailedSlots(params).availableSlots
}

