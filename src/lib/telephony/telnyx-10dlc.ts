import type { SupabaseClient } from '@supabase/supabase-js'
import { logAuditEvent } from '../security/audit-logger'

export interface TenDlcRegistrationResult {
  orgId: string
  orgName: string
  success: boolean
  brandId?: string | null
  campaignId?: string | null
  carrierStatus: 'unregistered' | 'pending' | 'in_review' | 'verified' | 'rejected'
  message: string
  error?: string
  isSimulated?: boolean
}

/**
 * Normalizes entity type to Telnyx / The Campaign Registry (TCR) format.
 */
function normalizeEntityType(businessType?: string | null, isSoleProprietor?: boolean): string {
  if (isSoleProprietor || businessType === 'sole_proprietorship') {
    return 'SOLE_PROPRIETOR'
  }
  if (businessType === 'non_profit') {
    return 'NON_PROFIT'
  }
  if (businessType === 'corporation') {
    return 'PUBLIC_PROFIT'
  }
  return 'PRIVATE_PROFIT'
}

/**
 * 1-Click Telnyx 10DLC Brand & Campaign Registration Engine.
 * 
 * CaptoDesk acts as the ISV software provider registering client tenant brands
 * with The Campaign Registry (TCR) via Telnyx's 10DLC REST API.
 * 
 * Supports:
 * - Live production mode (when TELNYX_API_KEY is configured)
 * - Safe simulated mode (for test environments and sandbox setups)
 * - Multi-tenant isolation (each organization gets dedicated TCR records)
 */
export async function verifyAndRegisterOrganization10Dlc(
  supabase: SupabaseClient,
  orgId: string
): Promise<TenDlcRegistrationResult> {
  // 1. Fetch Authoritative Tenant Organization Record
  const { data: org, error: fetchErr } = await supabase
    .from('organizations')
    .select(`
      id,
      name,
      owner_phone,
      telnyx_phone_number,
      legal_business_name,
      business_type,
      ein,
      is_sole_proprietor,
      address_street,
      address_city,
      address_state,
      address_postal_code,
      website_url,
      carrier_registration_status,
      tcr_brand_id,
      tcr_campaign_id
    `)
    .eq('id', orgId)
    .single()

  if (fetchErr || !org) {
    return {
      orgId,
      orgName: 'Unknown',
      success: false,
      carrierStatus: 'rejected',
      message: 'Organization not found in database',
      error: fetchErr?.message || 'Organization not found'
    }
  }

  const legalName = org.legal_business_name || org.name
  const isSoleProp = Boolean(org.is_sole_proprietor || org.business_type === 'sole_proprietorship')
  const einDigits = (org.ein || '').replace(/\D/g, '')

  // 2. Validate Minimum Required Fields for Carrier Filing
  if (!isSoleProp && einDigits.length !== 9) {
    return {
      orgId: org.id,
      orgName: org.name,
      success: false,
      carrierStatus: org.carrier_registration_status || 'unregistered',
      message: 'Invalid EIN: Standard US brands require a 9-digit Federal Tax ID (EIN). Check business registration.',
      error: 'EIN must contain exactly 9 numeric digits unless registered as a Sole Proprietor.'
    }
  }

  if (!org.address_street || !org.address_city || !org.address_state || !org.address_postal_code) {
    return {
      orgId: org.id,
      orgName: org.name,
      success: false,
      carrierStatus: org.carrier_registration_status || 'unregistered',
      message: 'Incomplete Address: Street, City, State, and ZIP are required for carrier filing.',
      error: 'Official physical business address is missing required fields.'
    }
  }

  const apiKey = process.env.TELNYX_API_KEY?.trim()
  const isLiveTelnyx = Boolean(apiKey && !apiKey.startsWith('mock') && apiKey.length > 20)

  // 3. Simulated Mode (when live Telnyx API key is not provisioned)
  if (!isLiveTelnyx) {
    const mockBrandId = org.tcr_brand_id || `tcr_brand_${org.id.replace(/-/g, '').slice(0, 12)}`
    const mockCampaignId = org.tcr_campaign_id || `tcr_camp_${org.id.replace(/-/g, '').slice(0, 12)}`
    const newStatus = 'in_review'

    await supabase
      .from('organizations')
      .update({
        carrier_registration_status: newStatus,
        tcr_brand_id: mockBrandId,
        tcr_campaign_id: mockCampaignId,
        updated_at: new Date().toISOString()
      })
      .eq('id', org.id)

    await logAuditEvent(supabase, {
      org_id: org.id,
      event_type: 'organization.10dlc_submitted',
      description: `[SIMULATED] 10DLC brand & campaign submitted for ${legalName} (Brand: ${mockBrandId})`,
      metadata: {
        mode: 'simulated',
        brandId: mockBrandId,
        campaignId: mockCampaignId,
        entityType: normalizeEntityType(org.business_type, isSoleProp)
      }
    })

    return {
      orgId: org.id,
      orgName: org.name,
      success: true,
      brandId: mockBrandId,
      campaignId: mockCampaignId,
      carrierStatus: newStatus,
      message: `10DLC Brand (${mockBrandId}) and Campaign (${mockCampaignId}) registered in review mode.`,
      isSimulated: true
    }
  }

  // 4. Live Telnyx 10DLC Production API Submission
  try {
    const telnyxHeaders = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }

    let brandId = org.tcr_brand_id

    // Step A: Register Brand if not already registered
    if (!brandId) {
      const brandPayload: Record<string, any> = {
        entityType: normalizeEntityType(org.business_type, isSoleProp),
        displayName: legalName.slice(0, 100),
        companyName: legalName.slice(0, 100),
        street: org.address_street.slice(0, 100),
        city: org.address_city.slice(0, 50),
        state: org.address_state.slice(0, 2).toUpperCase(),
        postalCode: org.address_postal_code.slice(0, 10),
        country: 'US',
        phone: org.owner_phone || org.telnyx_phone_number || '+15555555555',
        website: org.website_url || `https://${org.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        vertical: 'PROFESSIONAL'
      }

      if (!isSoleProp) {
        brandPayload.ein = einDigits
        brandPayload.einIssuingCountry = 'US'
      }

      const brandRes = await fetch('https://api.telnyx.com/v2/10dlc/brand', {
        method: 'POST',
        headers: telnyxHeaders,
        body: JSON.stringify(brandPayload)
      })

      const brandData = await brandRes.json()

      if (!brandRes.ok || (!brandData.brandId && !brandData.data?.brandId)) {
        const errorMsg = brandData.errors?.[0]?.detail || brandData.message || 'Telnyx Brand registration rejected'
        console.error('[TELNYX 10DLC BRAND ERROR]', brandData)
        return {
          orgId: org.id,
          orgName: org.name,
          success: false,
          carrierStatus: 'rejected',
          message: `Telnyx Brand registration failed: ${errorMsg}`,
          error: errorMsg
        }
      }

      brandId = brandData.brandId || brandData.data?.brandId
    }

    // Step B: Register Campaign if not already created
    let campaignId = org.tcr_campaign_id
    if (!campaignId && brandId) {
      const campaignPayload = {
        brandId,
        usecase: 'LOW_VOLUME_MIXED',
        description: `Instant missed-call recovery text-back and appointment confirmations for ${legalName}`,
        sample1: `Hi, this is ${org.name}! We are on another call and missed you. How can we help?`,
        sample2: `Hi, this is a reminder for your upcoming appointment with ${org.name}. Reply C to confirm or call us.`,
        messageFlow: `Homeowner or customer dials the business phone number. If call goes unanswered or customer texts, automated customer-care response is sent.`,
        helpMessage: `Reply HELP for support or reach ${org.name} at ${org.owner_phone || 'our main line'}.`,
        optoutMessage: `Reply STOP to unsubscribe and cease all notifications.`,
        autoRenewal: true
      }

      const campaignRes = await fetch('https://api.telnyx.com/v2/10dlc/campaign', {
        method: 'POST',
        headers: telnyxHeaders,
        body: JSON.stringify(campaignPayload)
      })

      const campaignData = await campaignRes.json()

      if (campaignRes.ok && (campaignData.campaignId || campaignData.data?.campaignId)) {
        campaignId = campaignData.campaignId || campaignData.data?.campaignId
      } else {
        console.warn('[TELNYX 10DLC CAMPAIGN WARNING]', campaignData)
      }
    }

    // Step C: Assign Telnyx Phone Number to Campaign
    if (campaignId && org.telnyx_phone_number) {
      await fetch('https://api.telnyx.com/v2/10dlc/phoneNumberCampaign', {
        method: 'POST',
        headers: telnyxHeaders,
        body: JSON.stringify({
          phoneNumber: org.telnyx_phone_number,
          campaignId
        })
      }).catch(err => {
        console.warn('[TELNYX 10DLC NUMBER ASSIGN WARNING]', err?.message)
      })
    }

    // Step D: Update Organization with Brand and Campaign Identifiers
    const newCarrierStatus = 'in_review'

    await supabase
      .from('organizations')
      .update({
        carrier_registration_status: newCarrierStatus,
        tcr_brand_id: brandId,
        tcr_campaign_id: campaignId || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', org.id)

    // Step E: Audit Log
    await logAuditEvent(supabase, {
      org_id: org.id,
      event_type: 'organization.10dlc_submitted',
      description: `10DLC brand & campaign successfully submitted to Telnyx for ${legalName}`,
      metadata: {
        brandId,
        campaignId,
        mode: 'live'
      }
    })

    return {
      orgId: org.id,
      orgName: org.name,
      success: true,
      brandId,
      campaignId,
      carrierStatus: newCarrierStatus,
      message: `Successfully filed with Telnyx 10DLC (Brand: ${brandId}${campaignId ? `, Campaign: ${campaignId}` : ''}). In carrier review.`
    }
  } catch (err: any) {
    console.error('[TELNYX 10DLC EXCEPTION]', err)
    return {
      orgId: org.id,
      orgName: org.name,
      success: false,
      carrierStatus: org.carrier_registration_status || 'unregistered',
      message: `Network failure connecting to Telnyx 10DLC API: ${err.message}`,
      error: err.message
    }
  }
}

/**
 * Batch 1-Click Multi-Business 10DLC Activation.
 * Sequentially or concurrently processes multiple organizations, ensuring
 * that an individual failure does not interrupt the rest of the batch.
 */
export async function verifyAndRegisterMultipleOrganizations(
  supabase: SupabaseClient,
  orgIds: string[]
): Promise<TenDlcRegistrationResult[]> {
  const results: TenDlcRegistrationResult[] = []

  for (const id of orgIds) {
    if (!id || typeof id !== 'string') continue
    const result = await verifyAndRegisterOrganization10Dlc(supabase, id)
    results.push(result)
  }

  return results
}
