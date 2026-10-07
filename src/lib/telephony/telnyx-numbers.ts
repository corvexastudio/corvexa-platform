import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhoneToE164 } from './phone-normalizer.ts'

export interface TelnyxNumberRecord {
  id: string
  org_id: string
  phone_number: string
  status: 'active' | 'pending' | 'released' | 'suspended'
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
 * Never uses a global fallback in production.
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
    .select('id, org_id, phone_number, status')
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
 * Verifies that the assigned number supports the required capability (e.g. 'voice' or 'sms')
 */
export function hasCapability(
  record: TelnyxNumberRecord | null | undefined,
  required: 'voice' | 'sms'
): boolean {
  if (!record || !record.capabilities) return true // Legacy fallback allows both
  return record.capabilities.includes(required)
}
