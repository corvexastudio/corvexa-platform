import { NextRequest, NextResponse } from 'next/server'
import { getAgencyContext } from '@/lib/agency/agency-auth'
import { recordAgencyCampaignCost, getAgencyCampaignCosts } from '@/lib/agency/agency-service'

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

    const filter = {
      organizationId: searchParams.get('client') || searchParams.get('organizationId') || undefined,
      reportingPeriod: searchParams.get('period') || searchParams.get('reportingPeriod') || undefined,
      campaignName: searchParams.get('campaign') || searchParams.get('campaignName') || undefined
    }

    const costs = await getAgencyCampaignCosts(agency.id, filter)

    return NextResponse.json({ costs }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('[AGENCY COSTS GET ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch campaign costs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryAgency = searchParams.get('agency')

    const authResult = await getAgencyContext(queryAgency)
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency, user } = authResult

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400 }
      )
    }

    const organizationId = body.organizationId || body.organization_id
    if (!organizationId || typeof organizationId !== 'string') {
      return NextResponse.json(
        { error: 'Valid contractor organization ID is required' },
        { status: 400 }
      )
    }

    const campaignName = body.campaignName || body.campaign_name
    if (!campaignName || typeof campaignName !== 'string' || !campaignName.trim()) {
      return NextResponse.json(
        { error: 'Campaign name is required' },
        { status: 400 }
      )
    }

    const costAmount = Number(body.costAmount ?? body.cost_amount)
    if (isNaN(costAmount) || costAmount < 0) {
      return NextResponse.json(
        { error: 'Cost amount must be a non-negative number' },
        { status: 400 }
      )
    }

    const costCategory = body.costCategory || body.cost_category || 'ad_spend'
    const allowedCategories = ['ad_spend', 'agency_retainer', 'other_marketing']
    if (!allowedCategories.includes(costCategory)) {
      return NextResponse.json(
        { error: `Invalid cost category. Must be one of: ${allowedCategories.join(', ')}` },
        { status: 400 }
      )
    }

    const recorded = await recordAgencyCampaignCost(agency.id, {
      organizationId,
      campaignName,
      costAmount,
      costCategory,
      reportingPeriod: body.reportingPeriod || body.reporting_period,
      utmSource: body.utmSource || body.utm_source,
      costDate: body.costDate || body.cost_date,
      currency: body.currency || 'USD',
      entrySource: 'manual',
      actingUserId: user?.id || null
    })

    return NextResponse.json({ success: true, cost: recorded }, { status: 201 })
  } catch (error: any) {
    console.error('[AGENCY COSTS POST ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to record campaign cost' },
      { status: 500 }
    )
  }
}
