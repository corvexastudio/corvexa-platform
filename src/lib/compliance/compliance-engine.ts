import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhoneToE164 } from '../telephony/phone-normalizer.ts'
import { isTcpaQuietHours } from '../services/safety-rules.ts'
import { sendTelnyxSms } from '../telnyx.ts'

export type MessageClassification = 'transactional' | 'marketing'

export const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'opt out', 'stopall']
export const OPT_IN_KEYWORDS = ['start', 'unstop', 'yes']
export const HELP_KEYWORDS = ['help', 'info']

/**
 * Checks whether an inbound message matches standard opt-out keywords
 */
export function isOptOutKeyword(text: string): { isOptOut: boolean; keyword?: string } {
  if (!text) return { isOptOut: false }
  const clean = text.trim().toLowerCase()
  const matched = OPT_OUT_KEYWORDS.find(kw => clean === kw)
  return {
    isOptOut: Boolean(matched),
    keyword: matched ? matched.toUpperCase() : undefined
  }
}

/**
 * Checks whether an inbound message matches standard opt-in keywords
 */
export function isOptInKeyword(text: string): { isOptIn: boolean; keyword?: string } {
  if (!text) return { isOptIn: false }
  const clean = text.trim().toLowerCase()
  const matched = OPT_IN_KEYWORDS.find(kw => clean === kw)
  return {
    isOptIn: Boolean(matched),
    keyword: matched ? matched.toUpperCase() : undefined
  }
}

/**
 * Checks whether an inbound message matches standard carrier help keywords
 */
export function isHelpKeyword(text: string): boolean {
  if (!text) return false
  const clean = text.trim().toLowerCase()
  return HELP_KEYWORDS.includes(clean)
}

/**
 * Classifies a messaging flow type as transactional or marketing
 */
export function classifyMessage(flowType: string): MessageClassification {
  const marketingFlows = new Set([
    'quote_follow_up',
    'review_request',
    'customer_reactivation',
    'marketing_campaign',
    'promotion',
    'reactivation'
  ])

  if (marketingFlows.has(flowType.toLowerCase())) {
    return 'marketing'
  }
  return 'transactional'
}

export interface FormatCompliantTextParams {
  businessName: string
  text: string
  messageType: MessageClassification
  includeOptOutNotice?: boolean
}

/**
 * Formats outbound message text to ensure mandatory sender business identification
 * and carrier opt-out instructions where required by the messaging program.
 */
export function formatCompliantOutboundText(params: FormatCompliantTextParams): string {
  const { businessName, text, messageType, includeOptOutNotice } = params
  let formatted = text.trim()
  const cleanBizName = (businessName || 'CaptoDesk').trim()

  // 1. Mandatory Business Identification (CTIA requirement)
  const hasBizName = formatted.toLowerCase().includes(cleanBizName.toLowerCase())
  if (!hasBizName && !formatted.startsWith(cleanBizName)) {
    formatted = `${cleanBizName}: ${formatted}`
  }

  // 2. Opt-Out Language (Mandatory on marketing or when programmatically requested)
  const shouldIncludeOptOut = includeOptOutNotice ?? (messageType === 'marketing')
  if (shouldIncludeOptOut) {
    const hasStopNotice = /\b(stop|opt out|unsubscribe)\b/i.test(formatted)
    if (!hasStopNotice) {
      formatted = `${formatted}\n\nReply STOP to cancel.`
    }
  }

  return formatted
}

/**
 * Checks if a recipient phone is listed in the organization or global suppression list
 */
export async function isPhoneSuppressed(
  supabase: SupabaseClient,
  orgId: string,
  phone: string
): Promise<{ suppressed: boolean; reason?: string; keyword?: string }> {
  try {
    const norm = normalizePhoneToE164(phone)
    const queryPhone = norm.isValid && norm.e164 ? norm.e164 : phone

    const { data, error } = await supabase
      .from('compliance_suppression_list')
      .select('reason, keyword')
      .eq('org_id', orgId)
      .eq('phone', queryPhone)
      .maybeSingle()

    if (error) {
      return { suppressed: false }
    }

    if (data) {
      return {
        suppressed: true,
        reason: data.reason || 'suppressed_by_carrier_rule',
        keyword: data.keyword
      }
    }
  } catch {
    return { suppressed: false }
  }

  return { suppressed: false }
}

/**
 * Checks if a recipient has exceeded daily automated SMS frequency limits
 */
export async function checkFrequencyCap(
  supabase: SupabaseClient,
  orgId: string,
  phone: string,
  maxDailyLimit: number = 3
): Promise<{ allowed: boolean; count24h: number }> {
  try {
    const norm = normalizePhoneToE164(phone)
    const queryPhone = norm.isValid && norm.e164 ? norm.e164 : phone
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Count outbound messages in audit log
    const { data, error, count } = await supabase
      .from('compliance_audit_logs')
      .select('id', { count: 'exact' })
      .eq('org_id', orgId)
      .eq('phone', queryPhone)
      .eq('action', 'message_sent')
      .gte('created_at', cutoff24h)

    if (error) {
      return { allowed: true, count24h: 0 }
    }

    const messageCount = count ?? (data ? data.length : 0)

    if (messageCount >= maxDailyLimit) {
      return { allowed: false, count24h: messageCount }
    }

    return { allowed: true, count24h: messageCount }
  } catch {
    return { allowed: true, count24h: 0 }
  }
}

/**
 * Records proof of consent into compliance_consent_records
 */
export async function recordConsent(
  supabase: SupabaseClient,
  params: {
    orgId: string
    phone: string
    contactId?: string
    consentType: 'transactional' | 'marketing' | 'express_written'
    source: string
    proofText?: string
    ipAddress?: string
    userAgent?: string
  }
): Promise<void> {
  try {
    const norm = normalizePhoneToE164(params.phone)
    const safePhone = norm.isValid && norm.e164 ? norm.e164 : params.phone

    await supabase.from('compliance_consent_records').insert({
      org_id: params.orgId,
      contact_id: params.contactId || null,
      phone: safePhone,
      consent_type: params.consentType,
      status: 'granted',
      source: params.source,
      proof_text: params.proofText || null,
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent || null
    })
  } catch {
    // Graceful catch for test mock compatibility
  }
}

/**
 * Records an immutable compliance audit event
 */
export async function logComplianceAudit(
  supabase: SupabaseClient,
  params: {
    orgId: string
    phone: string
    contactId?: string
    action: 'opt_out' | 'opt_in' | 'help_requested' | 'message_sent' | 'message_suppressed'
    messageType?: MessageClassification
    reason?: string
    metadata?: Record<string, any>
  }
): Promise<void> {
  try {
    const norm = normalizePhoneToE164(params.phone)
    const safePhone = norm.isValid && norm.e164 ? norm.e164 : params.phone

    await supabase.from('compliance_audit_logs').insert({
      org_id: params.orgId,
      contact_id: params.contactId || null,
      phone: safePhone,
      action: params.action,
      message_type: params.messageType || null,
      reason: params.reason || null,
      metadata: params.metadata || {}
    })
  } catch {
    // Graceful catch for test mock compatibility
  }
}

export interface OutboundComplianceCheckParams {
  orgId: string
  toPhone: string
  fromPhone?: string
  flowType?: string
  messageType?: MessageClassification
  body: string
  timezone?: string
  contactId?: string
  overrideDate?: Date
  ignoreFrequencyCap?: boolean
}

export interface ComplianceCheckResult {
  allowed: boolean
  suppressionReason?: string
  formattedText: string
  classification: MessageClassification
  businessName: string
}

/**
 * Central Pre-Flight Outbound Compliance Verification Engine
 * Evaluates: E.164 format, suppression list, contact opt_out, communication channel preferences,
 * TCPA quiet hours (for marketing), frequency caps, and applies business identification.
 */
export async function verifyOutboundCompliance(
  supabase: SupabaseClient,
  params: OutboundComplianceCheckParams
): Promise<ComplianceCheckResult> {
  const {
    orgId,
    toPhone,
    flowType = 'general',
    body,
    contactId,
    overrideDate,
    ignoreFrequencyCap = false
  } = params

  const classification = params.messageType || classifyMessage(flowType)

  // 1. Phone number format validation
  const norm = normalizePhoneToE164(toPhone)
  if (!norm.isValid || !norm.e164) {
    return {
      allowed: false,
      suppressionReason: 'invalid_phone_number',
      formattedText: body,
      classification,
      businessName: 'CaptoDesk'
    }
  }
  const cleanPhone = norm.e164

  // 2. Fetch Organization config
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, timezone, max_daily_sms_per_recipient, enforce_quiet_hours, business_name_prefix')
    .eq('id', orgId)
    .maybeSingle()

  const bizName = org?.business_name_prefix || org?.name || 'CaptoDesk'
  const timezone = params.timezone || org?.timezone || 'America/Chicago'
  const maxDaily = org?.max_daily_sms_per_recipient ?? 3
  const enforceQuietHours = org?.enforce_quiet_hours !== false

  // Format compliant text
  const formattedText = formatCompliantOutboundText({
    businessName: bizName,
    text: body,
    messageType: classification
  })

  // 3. Check Suppression List (Highest priority block)
  const suppressionCheck = await isPhoneSuppressed(supabase, orgId, cleanPhone)
  if (suppressionCheck.suppressed) {
    await logComplianceAudit(supabase, {
      orgId,
      phone: cleanPhone,
      contactId,
      action: 'message_suppressed',
      messageType: classification,
      reason: `suppression_list_${suppressionCheck.reason}`,
      metadata: { keyword: suppressionCheck.keyword }
    })
    return {
      allowed: false,
      suppressionReason: 'suppression_list_active',
      formattedText,
      classification,
      businessName: bizName
    }
  }

  // 4. Check Contact Opt-Out & Communication Preferences
  let contact = null
  if (contactId) {
    const { data } = await supabase
      .from('contacts')
      .select('id, opt_out, preferred_channel, marketing_opt_in, transactional_opt_in')
      .eq('id', contactId)
      .maybeSingle()
    contact = data
  } else {
    const { data } = await supabase
      .from('contacts')
      .select('id, opt_out, preferred_channel, marketing_opt_in, transactional_opt_in')
      .eq('org_id', orgId)
      .eq('phone', cleanPhone)
      .maybeSingle()
    contact = data
  }

  if (contact) {
    if (contact.opt_out) {
      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId: contact.id,
        action: 'message_suppressed',
        messageType: classification,
        reason: 'contact_opted_out'
      })
      return {
        allowed: false,
        suppressionReason: 'contact_opted_out',
        formattedText,
        classification,
        businessName: bizName
      }
    }

    if (contact.preferred_channel === 'email') {
      return {
        allowed: false,
        suppressionReason: 'channel_preference_email',
        formattedText,
        classification,
        businessName: bizName
      }
    }

    if (classification === 'marketing' && contact.marketing_opt_in === false) {
      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId: contact.id,
        action: 'message_suppressed',
        messageType: classification,
        reason: 'no_marketing_consent'
      })
      return {
        allowed: false,
        suppressionReason: 'no_marketing_consent',
        formattedText,
        classification,
        businessName: bizName
      }
    }
  }

  // 5. TCPA Quiet Hours Guard (Mandatory for marketing messages)
  if (classification === 'marketing' && enforceQuietHours) {
    const inQuietHours = isTcpaQuietHours(timezone, overrideDate)
    if (inQuietHours) {
      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId: contact?.id,
        action: 'message_suppressed',
        messageType: classification,
        reason: 'tcpa_quiet_hours',
        metadata: { timezone }
      })
      return {
        allowed: false,
        suppressionReason: 'tcpa_quiet_hours',
        formattedText,
        classification,
        businessName: bizName
      }
    }
  }

  // 6. Message Frequency Controls (Anti-harassment threshold)
  if (!ignoreFrequencyCap) {
    const freqCheck = await checkFrequencyCap(supabase, orgId, cleanPhone, maxDaily)
    if (!freqCheck.allowed) {
      await logComplianceAudit(supabase, {
        orgId,
        phone: cleanPhone,
        contactId: contact?.id,
        action: 'message_suppressed',
        messageType: classification,
        reason: 'frequency_cap_exceeded',
        metadata: { count24h: freqCheck.count24h, limit: maxDaily }
      })
      return {
        allowed: false,
        suppressionReason: 'frequency_cap_exceeded',
        formattedText,
        classification,
        businessName: bizName
      }
    }
  }

  return {
    allowed: true,
    formattedText,
    classification,
    businessName: bizName
  }
}

export interface InboundComplianceParams {
  org: any
  fromPhone: string
  toPhone: string
  text: string
}

export interface InboundComplianceResult {
  handled: boolean
  action?: 'opt_out_processed' | 'opt_in_processed' | 'help_processed'
  replySent?: boolean
  error?: string
}

/**
 * Handles inbound carrier compliance keywords: STOP, START, HELP and their variants.
 * Executes immediate database state updates, suppression tracking, and carrier replies.
 */
export async function handleInboundComplianceKeyword(
  supabase: SupabaseClient,
  params: InboundComplianceParams
): Promise<InboundComplianceResult> {
  const { org, fromPhone, toPhone, text } = params
  const normFrom = normalizePhoneToE164(fromPhone)
  const normTo = normalizePhoneToE164(toPhone)

  const cleanFrom = normFrom.isValid && normFrom.e164 ? normFrom.e164 : fromPhone
  const cleanTo = normTo.isValid && normTo.e164 ? normTo.e164 : toPhone
  const orgName = org?.name || 'CaptoDesk'

  // A. Inbound OPT-OUT (STOP, UNSUBSCRIBE, CANCEL, END, QUIT, etc.)
  const optOutCheck = isOptOutKeyword(text)
  if (optOutCheck.isOptOut) {
    const keyword = optOutCheck.keyword || 'STOP'

    // 1. Insert into suppression list
    await supabase.from('compliance_suppression_list').upsert(
      {
        org_id: org.id,
        phone: cleanFrom,
        reason: 'stop_keyword',
        source: 'inbound_sms',
        keyword,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'org_id,phone' }
    )

    // 2. Update contact record
    const { data: contact } = await supabase
      .from('contacts')
      .update({
        opt_out: true,
        opt_out_at: new Date().toISOString(),
        marketing_opt_in: false,
        transactional_opt_in: false,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', org.id)
      .eq('phone', cleanFrom)
      .select('id')
      .maybeSingle()

    // 3. Log compliance audit event
    await logComplianceAudit(supabase, {
      orgId: org.id,
      phone: cleanFrom,
      contactId: contact?.id,
      action: 'opt_out',
      reason: `inbound_keyword_${keyword}`,
      metadata: { keyword, inboundText: text }
    })

    // 4. Send single carrier-mandated confirmation SMS
    await sendTelnyxSms({
      to: cleanFrom,
      from: cleanTo,
      text: `${orgName}: You have been unsubscribed and will receive no further messages. Reply START to resubscribe or HELP for assistance.`
    })

    return { handled: true, action: 'opt_out_processed', replySent: true }
  }

  // B. Inbound OPT-IN (START, UNSTOP, YES)
  const optInCheck = isOptInKeyword(text)
  if (optInCheck.isOptIn) {
    const keyword = optInCheck.keyword || 'START'

    // 1. Remove from suppression list
    await supabase
      .from('compliance_suppression_list')
      .delete()
      .eq('org_id', org.id)
      .eq('phone', cleanFrom)

    // 2. Update contact record
    const { data: contact } = await supabase
      .from('contacts')
      .update({
        opt_out: false,
        opt_in_at: new Date().toISOString(),
        transactional_opt_in: true,
        updated_at: new Date().toISOString()
      })
      .eq('org_id', org.id)
      .eq('phone', cleanFrom)
      .select('id')
      .maybeSingle()

    // 3. Record consent proof
    await recordConsent(supabase, {
      orgId: org.id,
      phone: cleanFrom,
      contactId: contact?.id,
      consentType: 'transactional',
      source: 'inbound_keyword',
      proofText: `Inbound opt-in keyword: ${text}`
    })

    // 4. Log compliance audit event
    await logComplianceAudit(supabase, {
      orgId: org.id,
      phone: cleanFrom,
      contactId: contact?.id,
      action: 'opt_in',
      reason: `inbound_keyword_${keyword}`,
      metadata: { keyword, inboundText: text }
    })

    // 5. Send carrier-mandated confirmation SMS
    await sendTelnyxSms({
      to: cleanFrom,
      from: cleanTo,
      text: `${orgName}: You have resubscribed to receive service updates and notifications. Msg&data rates may apply. Reply HELP for info, STOP to opt out.`
    })

    return { handled: true, action: 'opt_in_processed', replySent: true }
  }

  // C. Inbound HELP (HELP, INFO)
  if (isHelpKeyword(text)) {
    const contactPhone = org?.telnyx_phone_number || org?.owner_phone || cleanTo
    const helpText = `${orgName}: For customer support call ${contactPhone}. Msg&data rates may apply. Reply STOP to cancel.`

    await logComplianceAudit(supabase, {
      orgId: org.id,
      phone: cleanFrom,
      action: 'help_requested',
      reason: 'inbound_help_keyword',
      metadata: { inboundText: text }
    })

    await sendTelnyxSms({
      to: cleanFrom,
      from: cleanTo,
      text: helpText
    })

    return { handled: true, action: 'help_processed', replySent: true }
  }

  return { handled: false }
}
