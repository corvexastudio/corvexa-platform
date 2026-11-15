import { NextRequest, NextResponse } from 'next/server'
import { updateAgencySubscriptionTier } from '@/lib/agency/agency-service'
import { AgencyTier } from '@/lib/agency/agency-types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agencyId = 'lokal-media-house', tier } = body

    if (!tier) {
      return NextResponse.json(
        { error: 'Tier is required (starter_3, growth_10, scale_25, dominance_50)' },
        { status: 400 }
      )
    }

    const updatedOverview = await updateAgencySubscriptionTier(agencyId, tier as AgencyTier)

    return NextResponse.json({
      success: true,
      message: `Successfully switched to ${tier}`,
      overview: updatedOverview
    })
  } catch (error: any) {
    console.error('[AGENCY TIER SELECTION API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to update agency subscription tier' },
      { status: 422 }
    )
  }
}
