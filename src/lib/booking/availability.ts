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

/**
 * Core availability engine.
 * Computes all non-overlapping available slots for a given service and date.
 */
export function calculateAvailableSlots(params: CalculateSlotsParams): AvailableSlot[] {
  const {
    orgConfig,
    service,
    dateStr,
    existingAppointments,
    referenceTime = new Date(),
    stepMinutes = 30
  } = params

  const timezone = orgConfig.timezone || 'America/Chicago'
  const bufferMinutes = orgConfig.buffer_minutes ?? 15
  const bufferMs = bufferMinutes * 60 * 1000
  const durationMinutes = service.duration_minutes || 60
  const durationMs = durationMinutes * 60 * 1000
  const minNoticeHours = orgConfig.minimum_notice_hours ?? 2
  const minNoticeMs = minNoticeHours * 60 * 60 * 1000
  const maxDaysAhead = orgConfig.max_booking_days_ahead ?? 30

  // 1. Check blocked dates
  if (orgConfig.blocked_dates && orgConfig.blocked_dates.includes(dateStr)) {
    return []
  }

  // 2. Check maximum booking window
  const startOfDayUtc = localDateTimeToUtc(dateStr, '00:00', timezone)
  const maxFutureDate = new Date(referenceTime.getTime() + maxDaysAhead * 24 * 60 * 60 * 1000)
  if (startOfDayUtc > maxFutureDate) {
    return []
  }

  // 3. Resolve business hours for this day of week
  const dayName = getDayOfWeekName(dateStr, timezone)
  const daySchedule = orgConfig.business_hours?.[dayName]

  if (!daySchedule || daySchedule.closed || !daySchedule.open || !daySchedule.close) {
    return []
  }

  const openTimeUtc = localDateTimeToUtc(dateStr, daySchedule.open, timezone)
  const closeTimeUtc = localDateTimeToUtc(dateStr, daySchedule.close, timezone)

  // 4. Filter active existing appointments that reserve time slots
  // Cancelled and no_show appointments DO NOT block time
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
  let candidateStart = openTimeUtc.getTime()
  const latestPossibleStart = closeTimeUtc.getTime() - durationMs
  const earliestAllowedTime = referenceTime.getTime() + minNoticeMs

  while (candidateStart <= latestPossibleStart) {
    const candidateEnd = candidateStart + durationMs

    // Minimum notice check
    if (candidateStart >= earliestAllowedTime) {
      // Overlap check against all active appointments
      const overlaps = activeIntervals.some((interval) =>
        doesIntervalOverlap(candidateStart, candidateEnd, interval.start, interval.end, bufferMs)
      )

      if (!overlaps) {
        const slotStartDate = new Date(candidateStart)
        const slotEndDate = new Date(candidateEnd)

        availableSlots.push({
          startTime: slotStartDate.toISOString(),
          endTime: slotEndDate.toISOString(),
          displayTime: formatSlotDisplayTime(slotStartDate, timezone),
          date: dateStr
        })
      }
    }

    candidateStart += stepMinutes * 60 * 1000
  }

  return availableSlots
}
