/**
 * CaptoDesk Booking Settings & Priority Engine Configurator
 * Safely parses and serializes organization-level booking customization settings.
 * Supports:
 * - Dynamic slot interval granularity (15, 30, 45, 60, 90, 120 minutes)
 * - Important Policy / Condition Disclaimer notice banner
 * - Priority service toggle, custom label, and fee
 * - Lead attribution ("How did you hear about us?")
 */

export interface BookingSettings {
  slot_interval_minutes: number
  booking_notice: string | null
  booking_notice_enabled: boolean
  priority_dispatch_enabled: boolean
  priority_dispatch_fee: number | null
  priority_dispatch_label: string
  priority_dispatch_description?: string | null
  how_heard_options: string[]
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  slot_interval_minutes: 30,
  booking_notice: 'Note: Quoted prices are estimates. Final price is confirmed on-site before work begins.',
  booking_notice_enabled: false,
  priority_dispatch_enabled: false,
  priority_dispatch_fee: null,
  priority_dispatch_label: 'Priority Service',
  priority_dispatch_description: 'Expedited technician arrival in the earliest available window.',
  how_heard_options: [
    'Google Maps / Search',
    'Instagram / Facebook',
    'Friend or Neighbor Referral',
    'Saw Your Van / Truck',
    'Repeat Customer'
  ]
}

export const ALLOWED_SLOT_INTERVALS = [15, 30, 45, 60, 90, 120] as const

/**
 * Extracts and normalizes booking settings from an organization record.
 * Checks dedicated columns first, falling back to business_hours._booking_settings.
 */
export function parseBookingSettings(org?: any): BookingSettings {
  if (!org) return { ...DEFAULT_BOOKING_SETTINGS }

  const storedSettings = org.business_hours?._booking_settings || {}

  // 1. Slot Interval
  let slotInterval = DEFAULT_BOOKING_SETTINGS.slot_interval_minutes
  const rawInterval = org.slot_interval_minutes ?? storedSettings.slot_interval_minutes
  if (rawInterval && ALLOWED_SLOT_INTERVALS.includes(Number(rawInterval) as any)) {
    slotInterval = Number(rawInterval)
  }

  // 2. Booking Notice
  const noticeEnabled = Boolean(org.booking_notice_enabled ?? storedSettings.booking_notice_enabled ?? false)
  const noticeText = (org.booking_notice ?? storedSettings.booking_notice ?? DEFAULT_BOOKING_SETTINGS.booking_notice) || null

  // 3. Priority Dispatch
  const priorityEnabled = Boolean(org.priority_dispatch_enabled ?? storedSettings.priority_dispatch_enabled ?? false)
  let priorityFee: number | null = null
  const rawFee = org.priority_dispatch_fee ?? storedSettings.priority_dispatch_fee
  if (rawFee !== undefined && rawFee !== null && rawFee !== '') {
    const parsed = parseFloat(String(rawFee))
    if (!isNaN(parsed) && parsed >= 0) {
      priorityFee = parsed
    }
  }

  const priorityLabel = (org.priority_dispatch_label ?? storedSettings.priority_dispatch_label ?? DEFAULT_BOOKING_SETTINGS.priority_dispatch_label).trim()
  const priorityDescription = org.priority_dispatch_description ?? storedSettings.priority_dispatch_description ?? DEFAULT_BOOKING_SETTINGS.priority_dispatch_description

  // 4. Attribution
  let howHeard = DEFAULT_BOOKING_SETTINGS.how_heard_options
  const rawHeard = org.how_heard_options ?? storedSettings.how_heard_options
  if (Array.isArray(rawHeard) && rawHeard.length > 0) {
    howHeard = rawHeard.filter((h: any) => typeof h === 'string' && h.trim().length > 0)
  }

  return {
    slot_interval_minutes: slotInterval,
    booking_notice: noticeText,
    booking_notice_enabled: noticeEnabled,
    priority_dispatch_enabled: priorityEnabled,
    priority_dispatch_fee: priorityFee,
    priority_dispatch_label: priorityLabel || DEFAULT_BOOKING_SETTINGS.priority_dispatch_label,
    priority_dispatch_description: priorityDescription || null,
    how_heard_options: howHeard
  }
}

/**
 * Packs updated booking settings into organization updates payload
 */
export function buildBookingSettingsUpdates(
  currentBusinessHours: any,
  settings: Partial<BookingSettings>
): Record<string, any> {
  const current = parseBookingSettings({ business_hours: currentBusinessHours })
  const merged: BookingSettings = {
    ...current,
    ...settings
  }

  const hoursCopy = { ...(currentBusinessHours || {}) }
  hoursCopy._booking_settings = {
    slot_interval_minutes: merged.slot_interval_minutes,
    booking_notice: merged.booking_notice,
    booking_notice_enabled: merged.booking_notice_enabled,
    priority_dispatch_enabled: merged.priority_dispatch_enabled,
    priority_dispatch_fee: merged.priority_dispatch_fee,
    priority_dispatch_label: merged.priority_dispatch_label,
    how_heard_options: merged.how_heard_options
  }

  return {
    business_hours: hoursCopy,
    slot_interval_minutes: merged.slot_interval_minutes,
    booking_notice: merged.booking_notice,
    booking_notice_enabled: merged.booking_notice_enabled,
    priority_dispatch_enabled: merged.priority_dispatch_enabled,
    priority_dispatch_fee: merged.priority_dispatch_fee,
    priority_dispatch_label: merged.priority_dispatch_label,
    how_heard_options: merged.how_heard_options
  }
}
