import { NextRequest, NextResponse } from 'next/server'
import { getAgencyContext } from '@/lib/agency/agency-auth'
import { updateAgencyBranding, getAgencyPortfolioOverview } from '@/lib/agency/agency-service'
import type { AgencyBrandingConfig } from '@/lib/agency/agency-types'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryAgency = searchParams.get('agency')

    const authResult = await getAgencyContext(queryAgency)
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency } = authResult
    const overview = await getAgencyPortfolioOverview(agency.id)

    return NextResponse.json({
      agencyId: agency.id,
      name: agency.name,
      slug: agency.slug,
      subscriptionTier: agency.subscription_tier,
      customDomain: agency.custom_domain || null,
      branding: agency.branding || {
        logoUrl: null,
        faviconUrl: null,
        primaryColor: null,
        accentColor: null,
        portalTitle: null,
        hidePoweredBy: false,
        customDomainStatus: 'pending_dns'
      },
      isWhiteLabelEligible: agency.subscription_tier === 'scale_25' || agency.subscription_tier === 'dominance_50'
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    })
  } catch (error: any) {
    console.error('[AGENCY BRANDING GET ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch agency branding' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const queryAgency = searchParams.get('agency')

    const authResult = await getAgencyContext(queryAgency)
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency } = authResult
    const branding: AgencyBrandingConfig = body.branding || {}
    const customDomain: string | null | undefined = body.customDomain

    const result = await updateAgencyBranding(agency.id, branding, customDomain)

    if (!result.success) {
      const isForbidden = result.error?.includes('Scale 25+')
      return NextResponse.json(
        { error: result.error },
        { status: isForbidden ? 403 : 422 }
      )
    }

    return NextResponse.json({
      success: true,
      agency: result.agency,
      message: 'Agency branding configuration saved successfully'
    })
  } catch (error: any) {
    console.error('[AGENCY BRANDING POST ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update agency branding' },
      { status: 500 }
    )
  }
}
