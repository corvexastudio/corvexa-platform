/**
 * Deterministic Safety Logic Engine (Blueprint §8 & §59)
 * Prevents spamming callers, checks business hours, and manages TCPA opt-outs.
 */

const STOP_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'quit', 'end', 'optout', 'opt out']
const RESUME_KEYWORDS = ['unstop', 'start']

export function isStopKeyword(text: string): boolean {
  return STOP_KEYWORDS.includes(text.trim().toLowerCase())
}

export function isResumeKeyword(text: string): boolean {
  return RESUME_KEYWORDS.includes(text.trim().toLowerCase())
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
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = days[now.getDay()]

  const todayConfig = businessHours[dayName]
  if (!todayConfig || todayConfig.closed) return false

  // Formatter for current time in business timezone
  try {
    const timeString = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now)

    const [nowHour, nowMin] = timeString.split(':').map(Number)
    const [openHour, openMin] = todayConfig.open.split(':').map(Number)
    const [closeHour, closeMin] = todayConfig.close.split(':').map(Number)

    const nowTotal = nowHour * 60 + nowMin
    const openTotal = openHour * 60 + openMin
    const closeTotal = closeHour * 60 + closeMin

    return nowTotal >= openTotal && nowTotal < closeTotal
  } catch {
    return true
  }
}
