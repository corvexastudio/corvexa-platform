import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { 
  verifyAndRegisterOrganization10Dlc, 
  verifyAndRegisterMultipleOrganizations 
} from '@/lib/telephony/telnyx-10dlc'

export const dynamic = 'force-dynamic'

/**
 * Super Admin 1-Click 10DLC Carrier & TCR Management API
 * Strictly restricted to Super Admin role ('admin:all').
 */

export async function GET(request: Request) {
  const adminResult = await getTenantContext('admin:all')
  if (!adminResult.ok) {
    return adminResult.response
  }

  const { supabase } = adminResult
  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status')

  try {
    let query = supabase
      .from('organizations')
      .select(`
        id,
        name,
        slug,
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
        tcr_campaign_id,
        subscription_status,
        monthly_rate,
        created_at
      `)
      .order('created_at', { ascending: false })

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('carrier_registration_status', statusFilter)
    }

    const { data: orgs, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      count: orgs?.length || 0,
      organizations: orgs || []
    })
  } catch (err: any) {
    console.error('[ADMIN 10DLC GET ERROR]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const adminResult = await getTenantContext('admin:all')
  if (!adminResult.ok) {
    return adminResult.response
  }

  const { supabase, user } = adminResult

  try {
    const body = await request.json()
    const { orgId, orgIds } = body

    if (!orgId && (!Array.isArray(orgIds) || orgIds.length === 0)) {
      return NextResponse.json(
        { error: 'Provide orgId (for single activation) or orgIds (for batch activation)' },
        { status: 400 }
      )
    }

    // Single Organization Activation
    if (orgId && typeof orgId === 'string') {
      const result = await verifyAndRegisterOrganization10Dlc(supabase, orgId)
      return NextResponse.json({
        success: result.success,
        result
      })
    }

    // Batch Multi-Business Activation
    if (Array.isArray(orgIds) && orgIds.length > 0) {
      const results = await verifyAndRegisterMultipleOrganizations(supabase, orgIds)
      const successCount = results.filter(r => r.success).length
      return NextResponse.json({
        success: successCount > 0,
        total: results.length,
        succeeded: successCount,
        failed: results.length - successCount,
        results
      })
    }

    return NextResponse.json({ error: 'Invalid activation payload' }, { status: 400 })
  } catch (err: any) {
    console.error('[ADMIN 10DLC POST ERROR]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
