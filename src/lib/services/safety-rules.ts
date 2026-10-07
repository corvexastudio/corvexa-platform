/**
 * Deterministic Safety Logic Engine (Blueprint §8 & §59)
 * Prevents spamming callers, checks business hours, and manages TCPA opt-outs.
 */

import { isOptOutKeyword, isOptInKeyword } from '../compliance/compliance-engine.ts'

export function isStopKeyword(text: string): boolean {
  return isOptOutKeyword(text).isOptOut
}

export function isResumeKeyword(text: string): boolean {
  return isOptInKeyword(text).isOptIn
}

export function isShortCall(durationSeconds: number): boolean {
  return durationSeconds > 0 && durationSeconds < 3
}

export function isWithinBusinessHours(
  businessHours: Record<string, { open: string; close: string; closed: boolean }> | undefined,
  timezone: string = 'America/Chicago'
): boolean {
  if (!businessHours) return true

  const now = new Date()

  try {
    // Correctly derive weekday in target business timezone rather than UTC
    const dayName = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long'
    }).format(now).toLowerCase()

    const todayConfig = businessHours[dayName]
    if (!todayConfig || todayConfig.closed) return false

    // Formatter for current time in business timezone
    const timeString = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now)

    const [nowHourRaw, nowMin] = timeString.split(':').map(Number)
    const nowHour = nowHourRaw % 24
    const [openHour, openMin] = todayConfig.open.split(':').map(Number)
    const [closeHour, closeMin] = todayConfig.close.split(':').map(Number)

    const nowTotal = nowHour * 60 + nowMin
    const openTotal = openHour * 60 + openMin
    const closeTotal = closeHour * 60 + closeMin

    return nowTotal >= openTotal && nowTotal < closeTotal
  } catch (err) {
    console.error('[TIMEZONE EVALUATION ERROR]', err)
    return true
  }
}

/**
 * TCPA Quiet Hours Compliance Guard
 * TCPA strictly prohibits unsolicited commercial messaging before 8:00 AM and after 8:00 PM local time.
 */
export function isTcpaQuietHours(timezone: string = 'America/Chicago', overrideDate?: Date): boolean {
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_TCPA_HOURS && !overrideDate) {
    return false
  }

  try {
    const timeString = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false
    }).format(overrideDate || new Date())

    const nowHour = parseInt(timeString, 10) % 24
    // Quiet hours: before 8 AM or after 8 PM (20:00)
    return nowHour < 8 || nowHour >= 20
  } catch {
    return false
  }
}
