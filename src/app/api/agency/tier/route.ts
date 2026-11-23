import { NextRequest, NextResponse } from 'next/server'
import { 
  createAgencyWholesaleCheckoutSession, 
  verifyAndApplyAgencyCheckoutSession
} from '@/lib/agency/agency-service'
import { AgencyTier, isValidAgencyTier, getAgencyTierConfig } from '@/lib/agency/agency-types'
import { getAgencyContext } from '@/lib/agency/agency-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload received' },
        { status: 400 }
      )
    }

    const { tier, verifySessionId } = body

    if (!tier || !isValidAgencyTier(tier)) {
      return NextResponse.json(
        { error: 'Valid wholesale tier is required (starter_3, growth_10, scale_25, dominance_50)' },
        { status: 400 }
      )
    }

    // 1. Enforce authentication and resolve agency strictly from session context
    const authResult = await getAgencyContext()
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency } = authResult

    // 2. Verification flow: if client provides verifySessionId, verify payment authorization before activating
    if (verifySessionId) {
      const verifyResult = await verifyAndApplyAgencyCheckoutSession(
        agency.id,
        tier as AgencyTier,
        String(verifySessionId)
      )

      if (!verifyResult.success) {
        return NextResponse.json(
          { error: verifyResult.error || 'Payment authorization could not be verified' },
          { status: 402 }
        )
      }

      const targetConfig = getAgencyTierConfig(tier)
      return NextResponse.json({
        success: true,
        message: `Successfully verified and activated subscription to ${targetConfig.name}`,
        overview: verifyResult.overview
      })
    }

    // 3. Check if already subscribed and active on target tier
    if (agency.subscription_tier === tier && agency.subscription_status === 'active') {
      return NextResponse.json(
        { error: `Agency is already subscribed to ${getAgencyTierConfig(tier).name}` },
        { status: 400 }
      )
    }

    // 4. Fail-Closed Security: Direct unverified capacity upgrades are blocked
    // Initiate legitimate Stripe checkout session for agency wholesale subscription
    const baseUrl = request.nextUrl.origin || process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com'
    const checkoutResult = await createAgencyWholesaleCheckoutSession(
      agency.id,
      tier as AgencyTier,
      baseUrl
    )

    if (!checkoutResult.success) {
      return NextResponse.json(
        { error: checkoutResult.error || 'Failed to initiate wholesale checkout session' },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      checkoutUrl: checkoutResult.checkoutUrl,
      sessionId: checkoutResult.sessionId,
      simulated: checkoutResult.simulated
    })
  } catch (error: any) {
    console.error('[AGENCY TIER SELECTION API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to process agency tier selection' },
      { status: 500 }
    )
  }
}
