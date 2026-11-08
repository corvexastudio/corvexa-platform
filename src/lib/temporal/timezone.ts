/**
 * CaptoDesk Enterprise Temporal & Timezone Engine
 * 
 * Invariants:
 * 1. Storage & API boundary is strictly UTC (ISO 8601 with 'Z').
 * 2. Field service appointment times are ALWAYS governed by the contractor's operational timezone (service address local time).
 * 3. UI rendering NEVER relies on ambient browser timezone for appointment scheduling or dispatch.
 * 4. US Daylight Saving Time (DST) transitions (March/November) and non-DST regions (Arizona, Hawaii)
 *    are dynamically computed using IANA identifiers via JavaScript's native Intl.DateTimeFormat.
 */

export interface UsTimezoneOption {
  id: string
  label: string
  standardAbbr: string
  daylightAbbr?: string
  hasDst: boolean
  region: string
}

export const US_TIMEZONES: UsTimezoneOption[] = [
  {
    id: 'America/New_York',
    label: 'Eastern Time (US & Canada)',
    standardAbbr: 'EST',
    daylightAbbr: 'EDT',
    hasDst: true,
    region: 'East Coast, Florida, Atlanta, Ohio'
  },
  {
    id: 'America/Chicago',
    label: 'Central Time (US & Canada)',
    standardAbbr: 'CST',
    daylightAbbr: 'CDT',
    hasDst: true,
    region: 'Texas, Illinois, Midwest, Gulf Coast'
  },
  {
    id: 'America/Denver',
    label: 'Mountain Time (US & Canada)',
    standardAbbr: 'MST',
    daylightAbbr: 'MDT',
    hasDst: true,
    region: 'Colorado, Utah, New Mexico, Montana'
  },
  {
    id: 'America/Phoenix',
    label: 'Mountain Time - Arizona (No DST)',
    standardAbbr: 'MST',
    hasDst: false,
    region: 'Phoenix, Tucson, Scottsdale (Year-Round UTC-7)'
  },
  {
    id: 'America/Los_Angeles',
    label: 'Pacific Time (US & Canada)',
    standardAbbr: 'PST',
    daylightAbbr: 'PDT',
    hasDst: true,
    region: 'California, Washington, Oregon, Nevada'
  },
  {
    id: 'America/Anchorage',
    label: 'Alaska Time',
    standardAbbr: 'AKST',
    daylightAbbr: 'AKDT',
    hasDst: true,
    region: 'Alaska'
  },
  {
    id: 'Pacific/Honolulu',
    label: 'Hawaii Time (No DST)',
    standardAbbr: 'HST',
    hasDst: false,
    region: 'Hawaii (Year-Round UTC-10)'
  }
]

export const DEFAULT_US_TIMEZONE = 'America/Chicago'

/**
 * Normalizes any legacy or missing timezone string into a valid IANA identifier.
 */
export function normalizeTimezone(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return DEFAULT_US_TIMEZONE
  const trimmed = raw.trim()
  if (!trimmed) return DEFAULT_US_TIMEZONE

  // Check against known US timezones
  const match = US_TIMEZONES.find(t => t.id.toLowerCase() === trimmed.toLowerCase())
  if (match) return match.id

  // Validate if it is a valid IANA timezone in Intl
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed })
    return trimmed
  } catch {
    return DEFAULT_US_TIMEZONE
  }
}

/**
 * Safely parses any date input (string, Date, or timestamp number) into a valid Date.
 */
function toDate(dateInput: string | Date | number): Date | null {
  if (dateInput instanceof Date) return isNaN(dateInput.getTime()) ? null : dateInput
  const d = new Date(dateInput)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Formats a timestamp into a 12-hour time string (e.g. "2:00 PM") strictly in the target timezone.
 */
export function formatTimeInTz(
  dateInput: string | Date | number,
  timezone: string = DEFAULT_US_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toDate(dateInput)
  if (!d) return ''
  const tz = normalizeTimezone(timezone)

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      ...options
    }).format(d)
  } catch {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
}

/**
 * Formats a timestamp into a date string (e.g. "Thu, Nov 12" or "Thursday, November 12, 2026") strictly in the target timezone.
 */
export function formatDateInTz(
  dateInput: string | Date | number,
  timezone: string = DEFAULT_US_TIMEZONE,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = toDate(dateInput)
  if (!d) return ''
  const tz = normalizeTimezone(timezone)

  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      month: 'short',
      day: 'numeric',
      ...options
    }).format(d)
  } catch {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

/**
 * Formats a timestamp into "YYYY-MM-DD" strictly in the target timezone.
 * Replaces risky `new Date().toLocaleDateString('en-CA')` which leaks ambient browser time.
 */
export function formatDateToIsoYmdInTz(
  dateInput: string | Date | number,
  timezone: string = DEFAULT_US_TIMEZONE
): string {
  const d = toDate(dateInput)
  if (!d) return ''
  const tz = normalizeTimezone(timezone)

  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

/**
 * Formats date and time combined (e.g. "Thu, Nov 12 at 2:00 PM") in the target timezone.
 */
export function formatDateTimeInTz(
  dateInput: string | Date | number,
  timezone: string = DEFAULT_US_TIMEZONE
): string {
  const d = toDate(dateInput)
  if (!d) return ''
  const tz = normalizeTimezone(timezone)

  const datePart = formatDateInTz(d, tz, { weekday: 'short', month: 'short', day: 'numeric' })
  const timePart = formatTimeInTz(d, tz)
  return `${datePart} at ${timePart}`
}

/**
 * Dynamic resolution of the 3-4 letter timezone abbreviation (e.g. "CDT", "CST", "MST", "PDT")
 * accounting for the exact instant's Daylight Saving Time status.
 */
export function getShortTzAbbreviation(
  timezone: string = DEFAULT_US_TIMEZONE,
  dateInput: string | Date | number = new Date()
): string {
  const d = toDate(dateInput) || new Date()
  const tz = normalizeTimezone(timezone)

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'short'
    }).formatToParts(d)
    return parts.find(p => p.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

/**
 * Converts a technical IANA timezone string (e.g. "America/Chicago") into a human-friendly label
 * with live DST abbreviation (e.g. "Central Time (CDT)" or "Arizona Time (MST)").
 */
export function getFriendlyTimezoneLabel(
  timezone: string = DEFAULT_US_TIMEZONE,
  dateInput: string | Date | number = new Date()
): string {
  const tz = normalizeTimezone(timezone)
  const abbr = getShortTzAbbreviation(tz, dateInput)

  const baseNames: Record<string, string> = {
    'America/New_York': 'Eastern Time',
    'America/Chicago': 'Central Time',
    'America/Denver': 'Mountain Time',
    'America/Phoenix': 'Arizona Time',
    'America/Los_Angeles': 'Pacific Time',
    'America/Anchorage': 'Alaska Time',
    'Pacific/Honolulu': 'Hawaii Time'
  }

  const base = baseNames[tz] || tz.replace(/_/g, ' ').split('/').pop() || tz
  return abbr ? `${base} (${abbr})` : base
}

/**
 * Resolves the client browser's local timezone (client-side only).
 */
export function getDeviceTimezone(): string {
  if (typeof window === 'undefined') return DEFAULT_US_TIMEZONE
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_US_TIMEZONE
  } catch {
    return DEFAULT_US_TIMEZONE
  }
}

/**
 * Checks whether the viewer's device timezone differs from the business/service timezone.
 * Used to display a traveler reassurance banner during booking.
 */
export function isDifferentFromDeviceTimezone(targetTimezone: string = DEFAULT_US_TIMEZONE): boolean {
  if (typeof window === 'undefined') return false
  try {
    const deviceTz = getDeviceTimezone()
    const target = normalizeTimezone(targetTimezone)
    return deviceTz.toLowerCase() !== target.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Infers an initial US IANA timezone from a 3-digit phone area code during onboarding.
 */
export function inferTimezoneFromAreaCode(phoneOrAreaCode?: string | null): string {
  if (!phoneOrAreaCode) return DEFAULT_US_TIMEZONE

  // Extract first 3 digits of NANPA number
  const digits = phoneOrAreaCode.replace(/\D/g, '')
  const areaCode = digits.length >= 10 ? digits.slice(digits.length - 10, digits.length - 7) : digits.slice(0, 3)

  if (!/^[2-9]\d{2}$/.test(areaCode)) return DEFAULT_US_TIMEZONE

  const code = parseInt(areaCode, 10)

  // Arizona Area Codes (No DST - America/Phoenix)
  if ([480, 520, 602, 623, 928].includes(code)) {
    return 'America/Phoenix'
  }

  // Hawaii Area Code (America/Honolulu)
  if (code === 808) {
    return 'Pacific/Honolulu'
  }

  // Alaska Area Code (America/Anchorage)
  if (code === 907) {
    return 'America/Anchorage'
  }

  // Pacific Time Area Codes (California, Washington, Oregon, Nevada)
  if (
    (code >= 206 && code <= 213) ||
    [253, 310, 323, 360, 408, 415, 425, 442, 503, 509, 510, 530, 541, 559, 562, 564, 619, 626, 628, 650, 657, 661, 669, 702, 707, 714, 725, 747, 760, 775, 805, 818, 831, 858, 909, 916, 925, 949, 951, 971].includes(code)
  ) {
    return 'America/Los_Angeles'
  }

  // Mountain Time Area Codes (Colorado, Utah, New Mexico, Montana, Idaho, Wyoming)
  if (
    [303, 307, 385, 406, 435, 505, 575, 719, 720, 801, 970].includes(code)
  ) {
    return 'America/Denver'
  }

  // Eastern Time Area Codes (New York, Florida, Georgia, Ohio, Carolinas, DC, Massachusetts, etc.)
  if (
    [201, 202, 203, 207, 212, 215, 216, 229, 239, 240, 267, 272, 301, 302, 305, 315, 321, 330, 336, 339, 347, 351, 352, 386, 401, 404, 407, 410, 412, 413, 419, 434, 440, 443, 445, 470, 475, 484, 508, 516, 518, 540, 551, 561, 570, 585, 603, 607, 609, 610, 614, 617, 631, 646, 678, 680, 703, 704, 706, 716, 717, 718, 724, 727, 732, 740, 754, 757, 770, 772, 774, 781, 786, 802, 803, 804, 813, 814, 828, 838, 843, 845, 848, 856, 857, 860, 862, 863, 864, 878, 904, 908, 910, 914, 917, 919, 929, 937, 941, 954, 959, 973, 978, 980, 984].includes(code)
  ) {
    return 'America/New_York'
  }

  // Default Central Time Area Codes (Texas, Illinois, Wisconsin, Minnesota, Missouri, Louisiana, etc.)
  return 'America/Chicago'
}
