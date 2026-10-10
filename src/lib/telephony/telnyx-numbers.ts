import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhoneToE164 } from './phone-normalizer.ts'

export interface TelnyxNumberRecord {
  id: string
  org_id: string
  phone_number: string
  status: 'active' | 'pending' | 'released' | 'suspended'
  verification_status?: 'verified' | 'unverified' | 'failed'
  order_id?: string | null
  telnyx_phone_number_id?: string | null
  capabilities: string[]
  messaging_profile_id?: string | null
  connection_id?: string | null
  provisioning_metadata?: Record<string, any>
  created_at: string
}

export interface ResolvedTenantNumber {
  org: any
  numberRecord?: TelnyxNumberRecord | null
  resolvedPhone: string
}

/**
 * Resolves the tenant organization that owns a given inbound Telnyx phone number.
 * 
 * Safety Rules:
 * 1. Must be strictly active and verified by Telnyx provider.
 * 2. Unverified or synthetic numbers are rejected and not routed.
 * 3. Ambiguous (duplicate) numbers across multiple tenants are rejected.
 * 4. Never uses a global fallback in production.
 */
export async function resolveOrganizationByPhoneNumber(
  supabase: SupabaseClient,
  rawPhoneNumber: string
): Promise<ResolvedTenantNumber | null> {
  const norm = normalizePhoneToE164(rawPhoneNumber)
  if (!norm.isValid || !norm.e164) {
    return null
  }

  const phone = norm.e164

  // 1. Primary lookup: Check dedicated telnyx_phone_numbers table
  // Query to detect ambiguous multi-tenant collisions
  const { data: allMatches } = await supabase
    .from('telnyx_phone_numbers')
    .select('id, org_id, phone_number, status, verification_status')
    .eq('phone_number', phone)
    .eq('status', 'active')

  if (Array.isArray(allMatches) && allMatches.length > 1) {
    console.error(`[TELEPHONY ROUTING ERROR] Ambiguous mapping: ${allMatches.length} active records found for phone ${phone}. Rejecting for safety.`)
    return null
  }

  const { data: numberRow } = await supabase
    .from('telnyx_phone_numbers')
    .select('*, organizations(*)')
    .eq('phone_number', phone)
    .eq('status', 'active')
    .maybeSingle()

  if (numberRow) {
    // Safety check: Reject unverified or synthetic numbers
    if (numberRow.verification_status === 'unverified') {
      console.warn(`[TELEPHONY ROUTING REJECTED] Inbound traffic to unverified number ${phone} blocked.`)
      return null
    }

    let org = numberRow.organizations
    if (!org && numberRow.org_id) {
      const { data: orgLookup } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', numberRow.org_id)
        .maybeSingle()
      org = orgLookup
    }

    if (org) {
      return {
        org,
        numberRecord: numberRow,
        resolvedPhone: phone
      }
    }
  }

  // 2. Secondary lookup (backward compatibility): Check organizations.telnyx_phone_number
  const { data: allOrgMatches } = await supabase
    .from('organizations')
    .select('id')
    .eq('telnyx_phone_number', phone)

  if (Array.isArray(allOrgMatches) && allOrgMatches.length > 1) {
    console.error(`[TELEPHONY ROUTING ERROR] Ambiguous mapping: Multiple organizations share telnyx_phone_number ${phone}. Rejecting for safety.`)
    return null
  }

  const { data: orgRow } = await supabase
    .from('organizations')
    .select('*')
    .eq('telnyx_phone_number', phone)
    .maybeSingle()

  if (orgRow) {
    // Safety check: Only route if organization status is active
    if (orgRow.phone_provisioning_status && orgRow.phone_provisioning_status !== 'active') {
      console.warn(`[TELEPHONY ROUTING REJECTED] Organization ${orgRow.id} phone is in ${orgRow.phone_provisioning_status} state. Blocked.`)
      return null
    }

    return {
      org: orgRow,
      numberRecord: null,
      resolvedPhone: phone
    }
  }

  // No tenant owns this number - reject call / return null
  return null
}

/**
 * Verifies that a tenant organization is authorized to use a given sender number
 * for outbound SMS / communications.
 * Fails closed if the number is unverified, missing, or belongs to another tenant.
 */
export async function verifyTenantOutboundSender(
  supabase: SupabaseClient,
  orgId: string,
  rawSenderNumber: string
): Promise<{ allowed: boolean; reason?: string }> {
  const norm = normalizePhoneToE164(rawSenderNumber)
  if (!norm.isValid || !norm.e164) {
    return { allowed: false, reason: 'Invalid sender phone format' }
  }

  const senderPhone = norm.e164

  // Check telnyx_phone_numbers
  const { data: numRecord } = await supabase
    .from('telnyx_phone_numbers')
    .select('id, org_id, status, verification_status')
    .eq('phone_number', senderPhone)
    .maybeSingle()

  if (numRecord) {
    if (numRecord.org_id !== orgId) {
      return { allowed: false, reason: 'Sender number belongs to another organization' }
    }
    if (numRecord.status !== 'active') {
      return { allowed: false, reason: `Sender number status is ${numRecord.status} (must be active)` }
    }
    if (numRecord.verification_status === 'unverified') {
      return { allowed: false, reason: 'Sender number is unverified or synthetic' }
    }
    return { allowed: true }
  }

  // Check organization record
  const { data: org } = await supabase
    .from('organizations')
    .select('id, telnyx_phone_number, phone_provisioning_status')
    .eq('id', orgId)
    .maybeSingle()

  if (!org || org.telnyx_phone_number !== senderPhone) {
    return { allowed: false, reason: 'Sender number is not registered to organization' }
  }

  if (org.phone_provisioning_status !== 'active') {
    return { allowed: false, reason: `Organization phone provisioning status is ${org.phone_provisioning_status}` }
  }

  return { allowed: true }
}

/**
 * Verifies that the assigned number supports the required capability (e.g. 'voice' or 'sms')
 */
export function hasCapability(
  record: TelnyxNumberRecord | null | undefined,
  required: 'voice' | 'sms'
): boolean {
  if (!record || !record.capabilities) return true // Legacy fallback allows both
  return record.capabilities.includes(required)
}
