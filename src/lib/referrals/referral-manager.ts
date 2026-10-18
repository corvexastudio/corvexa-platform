import { SupabaseClient } from '@supabase/supabase-js'

export interface ReferralLinkRecord {
  id: string
  org_id: string
  contact_id?: string | null
  referral_code: string
  reward_amount: number
  discount_amount: number
  clicks_count: number
  conversions_count: number
  created_at: string
  updated_at: string
}

export interface GetOrCreateReferralResult {
  success: boolean
  referral?: ReferralLinkRecord
  referralUrl?: string
  error?: string
}

/**
 * Generates a URL-friendly, memorable referral slug based on customer first name
 * e.g., "sarah-482" or "mike-819"
 */
function generateReferralCode(contactName?: string | null): string {
  const cleanFirst = (contactName || '')
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const prefix = cleanFirst && cleanFirst.length >= 2 ? cleanFirst : 'friend'
  const randomSuffix = Math.floor(100 + Math.random() * 900)
  return `${prefix}-${randomSuffix}`
}

/**
 * Retrieves an existing referral link for a contact or provisions a new one.
 */
export async function getOrCreateReferralLink(
  supabase: SupabaseClient,
  params: {
    orgId: string
    contactId: string
    contactName?: string | null
    rewardAmount?: number
    discountAmount?: number
  }
): Promise<GetOrCreateReferralResult> {
  const { orgId, contactId, contactName, rewardAmount = 25, discountAmount = 25 } = params
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.corvexastudio.com'

  try {
    // 1. Look for existing referral link for this contact & org
    const { data: existing, error: findError } = await supabase
      .from('referral_links')
      .select('*')
      .eq('org_id', orgId)
      .eq('contact_id', contactId)
      .maybeSingle()

    if (existing && !findError) {
      return {
        success: true,
        referral: existing as ReferralLinkRecord,
        referralUrl: `${appBaseUrl}/ref/${existing.referral_code}`
      }
    }

    // 2. Generate a unique code with collision safety
    let code = generateReferralCode(contactName)
    let isUnique = false
    let attempts = 0

    while (!isUnique && attempts < 5) {
      const { data: conflict } = await supabase
        .from('referral_links')
        .select('id')
        .eq('referral_code', code)
        .maybeSingle()

      if (!conflict) {
        isUnique = true
      } else {
        attempts++
        code = `${generateReferralCode(contactName)}${Math.floor(10 + Math.random() * 90)}`
      }
    }

    // 3. Insert new referral link record
    const { data: created, error: insertError } = await supabase
      .from('referral_links')
      .insert({
        org_id: orgId,
        contact_id: contactId,
        referral_code: code,
        reward_amount: rewardAmount,
        discount_amount: discountAmount,
        clicks_count: 0,
        conversions_count: 0
      })
      .select('*')
      .single()

    if (insertError || !created) {
      return { success: false, error: insertError?.message || 'Failed to create referral link' }
    }

    return {
      success: true,
      referral: created as ReferralLinkRecord,
      referralUrl: `${appBaseUrl}/ref/${created.referral_code}`
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Internal error managing referral link' }
  }
}

/**
 * Resolves referral details and target business info for a given referral code.
 */
export async function resolveReferralByCode(
  supabase: SupabaseClient,
  referralCode: string
): Promise<{
  success: boolean
  referral?: ReferralLinkRecord
  org?: { id: string; name: string; slug: string }
  error?: string
}> {
  try {
    const cleanCode = referralCode.trim().toLowerCase()
    const { data, error } = await supabase
      .from('referral_links')
      .select(`
        *,
        organizations (
          id,
          name,
          slug
        )
      `)
      .ilike('referral_code', cleanCode)
      .maybeSingle()

    if (error || !data) {
      return { success: false, error: 'Referral code not found' }
    }

    const org = (data as any).organizations

    return {
      success: true,
      referral: data as ReferralLinkRecord,
      org: org ? { id: org.id, name: org.name, slug: org.slug } : undefined
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to resolve referral code' }
  }
}

/**
 * Increments the click count when a prospect navigates through a referral link.
 */
export async function recordReferralClick(
  supabase: SupabaseClient,
  referralCode: string
): Promise<void> {
  try {
    const cleanCode = referralCode.trim().toLowerCase()
    const { data: existing } = await supabase
      .from('referral_links')
      .select('id, clicks_count')
      .ilike('referral_code', cleanCode)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('referral_links')
        .update({
          clicks_count: (existing.clicks_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    }
  } catch (err) {
    console.error('[REFERRAL_CLICK_RECORD_ERR]', err)
  }
}

/**
 * Records a successful conversion (booking or job won) attributed to a referral link.
 */
export async function recordReferralConversion(
  supabase: SupabaseClient,
  referralCode: string,
  leadId?: string
): Promise<void> {
  try {
    const cleanCode = referralCode.trim().toLowerCase()
    const { data: existing } = await supabase
      .from('referral_links')
      .select('id, contact_id, conversions_count')
      .ilike('referral_code', cleanCode)
      .maybeSingle()

    if (!existing) return

    // 1. Increment conversion counter
    await supabase
      .from('referral_links')
      .update({
        conversions_count: (existing.conversions_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)

    // 2. Attribute lead if provided
    if (leadId) {
      await supabase
        .from('leads')
        .update({
          source: 'referral',
          referral_code: cleanCode,
          referring_contact_id: existing.contact_id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
    }
  } catch (err) {
    console.error('[REFERRAL_CONVERSION_RECORD_ERR]', err)
  }
}
