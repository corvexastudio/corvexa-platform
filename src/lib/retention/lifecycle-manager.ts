import type { SupabaseClient } from '@supabase/supabase-js'
import { sendTelnyxSms } from '../telnyx.ts'
import { logAuditEvent } from '../security/audit-logger.ts'
import { isPhoneSuppressed, formatCompliantOutboundText, logComplianceAudit } from '../compliance/compliance-engine.ts'
import { isTcpaQuietHours } from '../services/safety-rules.ts'

export type LifecycleStatus = 'active' | 'due' | 'overdue' | 'inactive'

/**
 * Computes customer lifecycle status based on elapsed days since last service
 */
export function computeLifecycleStatus(
  lastServiceDate: string | Date | null | undefined,
  serviceFrequencyDays: number = 90,
  overrideNow?: Date | number
): LifecycleStatus {
  if (!lastServiceDate) return 'active'

  const lastServiceMs = new Date(lastServiceDate).getTime()
  if (isNaN(lastServiceMs)) return 'active'

  const nowMs = typeof overrideNow === 'number'
    ? overrideNow
    : overrideNow
      ? new Date(overrideNow).getTime()
      : Date.now()

  const diffMs = nowMs - lastServiceMs
  const elapsedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (elapsedDays < serviceFrequencyDays) {
    return 'active'
  } else if (elapsedDays < serviceFrequencyDays + 30) {
    return 'due'
  } else if (elapsedDays < serviceFrequencyDays + 90) {
    return 'overdue'
  } else {
    return 'inactive'
  }
}

/**
 * Updates customer last service date when a job is marked completed
 */
export async function updateCustomerServiceDate(
  supabase: SupabaseClient,
  input: {
    contactId: string
    orgId: string
    serviceDate?: string | Date
    frequencyDays?: number
  }
): Promise<{ success: boolean; contact?: any; error?: string }> {
  const { contactId, orgId, serviceDate = new Date(), frequencyDays = 90 } = input

  const dateIso = new Date(serviceDate).toISOString()
  const nextExpectedMs = new Date(serviceDate).getTime() + frequencyDays * 24 * 60 * 60 * 1000
  const nextExpectedIso = new Date(nextExpectedMs).toISOString()

  const { data: updatedContact, error } = await supabase
    .from('contacts')
    .update({
      last_service_date: dateIso,
      service_frequency_days: frequencyDays,
      next_expected_service_date: nextExpectedIso,
      lifecycle_status: 'active',
      updated_at: new Date().toISOString()
    })
    .eq('id', contactId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, contact: updatedContact }
}

/**
 * Evaluates and dispatches customer reactivation messages for due or overdue contacts
 */
export interface CustomerReactivationInput {
  orgId: string
  baseUrl: string
  customMessage?: string
  overrideDate?: Date
  ignoreQuietHours?: boolean
}

export interface CustomerReactivationResult {
  success: boolean
  evaluatedCount: number
  reactivatedCount: number
  contactsReactivated: Array<{ contactId: string; name?: string; status: LifecycleStatus }>
  suppressedQuietHours?: boolean
  hitBatchLimit?: boolean
  message?: string
  error?: string
}

/**
 * Evaluates and dispatches customer reactivation messages for due or overdue contacts
 */
export async function evaluateCustomerReactivation(
  supabase: SupabaseClient,
  input: CustomerReactivationInput
): Promise<CustomerReactivationResult> {
  const { orgId, baseUrl, customMessage, overrideDate, ignoreQuietHours } = input

  // 1. Fetch organization settings
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select(`
      id, name, slug, timezone, reactivation_enabled,
      default_reactivation_interval_days, reactivation_cooldown_days,
      reactivation_template, reactivation_quiet_hours, reactivation_max_daily,
      telnyx_phone_number
    `)
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    return { success: false, evaluatedCount: 0, reactivatedCount: 0, contactsReactivated: [], error: 'Organization not found' }
  }

  if (org.reactivation_enabled === false) {
    return { success: true, evaluatedCount: 0, reactivatedCount: 0, contactsReactivated: [], message: 'Reactivation disabled in settings.' }
  }

  // 2. Check Quiet Hours in Organization Canonical Timezone
  const orgTimezone = org.timezone || 'America/Chicago'
  const enforceQuietHours = org.reactivation_quiet_hours === true && !ignoreQuietHours
  if (enforceQuietHours && isTcpaQuietHours(orgTimezone, overrideDate)) {
    return {
      success: true,
      evaluatedCount: 0,
      reactivatedCount: 0,
      contactsReactivated: [],
      suppressedQuietHours: true,
      message: `Reactivation suppressed: current time is within TCPA quiet hours for timezone ${orgTimezone}.`
    }
  }

  // 3. Fetch contacts with past services that haven't opted out and are not soft-deleted
  let contactQuery = supabase
    .from('contacts')
    .select('*')
    .eq('org_id', orgId)
    .eq('opt_out', false)

  if (typeof (contactQuery as any).is === 'function') {
    contactQuery = (contactQuery as any).is('deleted_at', null)
  }
  if (typeof (contactQuery as any).not === 'function') {
    contactQuery = (contactQuery as any).not('last_service_date', 'is', null)
  }

  const { data: rawContacts, error: contactsError } = await contactQuery

  if (contactsError) {
    return { success: false, evaluatedCount: 0, reactivatedCount: 0, contactsReactivated: [], error: contactsError.message }
  }

  const contacts = (rawContacts || []).filter((c: any) => !c.deleted_at && c.last_service_date)

  const businessName = org.name || 'our team'
  const bookingSlug = org.slug || org.id
  const safeBaseUrl = baseUrl.replace(/\/$/, '')
  const bookingUrl = `${safeBaseUrl}/book/${bookingSlug}`

  const reactivated: Array<{ contactId: string; name?: string; status: LifecycleStatus }> = []
  const now = overrideDate ? overrideDate.getTime() : Date.now()
  const cooldownDays = org.reactivation_cooldown_days || 30
  const reactivationCooldownMs = cooldownDays * 24 * 60 * 60 * 1000
  const maxDailyLimit = org.reactivation_max_daily || 50
  let hitBatchLimit = false

  for (const contact of contacts || []) {
    if (reactivated.length >= maxDailyLimit) {
      hitBatchLimit = true
      break
    }

    const frequency = contact.service_frequency_days || org.default_reactivation_interval_days || 90
    const computedStatus = computeLifecycleStatus(contact.last_service_date, frequency, now)

    // Check if status is due or overdue
    if (computedStatus === 'due' || computedStatus === 'overdue') {
      // Cooldown check
      if (contact.last_reactivation_sent_at) {
        const lastSentMs = new Date(contact.last_reactivation_sent_at).getTime()
        if (now - lastSentMs < reactivationCooldownMs) {
          continue
        }
      }

      // Format compliant reactivation SMS with template interpolation
      const customerName = contact.name || 'there'
      let smsText: string
      if (customMessage) {
        smsText = customMessage
      } else if (org.reactivation_template) {
        smsText = org.reactivation_template
          .replace(/\{customer_name\}/gi, customerName)
          .replace(/\{business_name\}/gi, businessName)
          .replace(/\{booking_url\}/gi, bookingUrl)
      } else {
        const nameGreeting = contact.name ? ` ${contact.name}` : ''
        smsText = `Hi${nameGreeting}, it's been a little while since your last service with ${businessName}. Would you like us to schedule your next visit? You can book online anytime: ${bookingUrl}`
      }

      // Dispatch SMS
      if (contact.phone) {
        const suppression = await isPhoneSuppressed(supabase, orgId, contact.phone)
        if (suppression.suppressed) {
          continue
        }

        const compliantText = formatCompliantOutboundText({
          businessName,
          text: smsText,
          messageType: 'marketing'
        })

        const result = await sendTelnyxSms({
          to: contact.phone,
          from: org.telnyx_phone_number,
          text: compliantText
        })

        if (result.success) {
          await supabase
            .from('contacts')
            .update({
              lifecycle_status: computedStatus,
              last_reactivation_sent_at: new Date(now).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', contact.id)

          reactivated.push({
            contactId: contact.id,
            name: contact.name || undefined,
            status: computedStatus
          })

          await logComplianceAudit(supabase, {
            orgId,
            phone: contact.phone,
            contactId: contact.id,
            action: 'message_sent',
            messageType: 'marketing',
            reason: 'customer_reactivation'
          })

          await logAuditEvent(supabase, {
            org_id: orgId,
            event_type: 'sms.outbound_dispatched',
            description: `Sent reactivation reminder to ${contact.name || contact.phone}`,
            metadata: {
              action: 'customer_reactivation',
              contact_id: contact.id,
              lifecycle_status: computedStatus
            }
          })
        }
      }
    } else if (computedStatus !== contact.lifecycle_status) {
      // Update contact status to match computed status (e.g. inactive)
      await supabase
        .from('contacts')
        .update({
          lifecycle_status: computedStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', contact.id)
    }
  }

  return {
    success: true,
    evaluatedCount: (contacts || []).length,
    reactivatedCount: reactivated.length,
    contactsReactivated: reactivated,
    hitBatchLimit
  }
}
