import { NextRequest, NextResponse } from 'next/server'
import { deployClientToAgencySlot } from '@/lib/agency/agency-service'
import { getAgencyContext } from '@/lib/agency/agency-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      agencyId,
      businessName,
      industry = 'plumbing',
      ownerName,
      ownerCellPhone,
      shopPhone,
      timezone,
      googleReviewUrl
    } = body

    if (!businessName || !ownerName || !ownerCellPhone) {
      return NextResponse.json(
        { error: 'Business name, owner name, and owner mobile phone are strictly required' },
        { status: 400 }
      )
    }

    const authResult = await getAgencyContext(agencyId)
    if (!authResult.ok) {
      return authResult.response!
    }

    const { agency } = authResult

    const result = await deployClientToAgencySlot(agency.id, {
      businessName,
      industry,
      ownerName,
      ownerCellPhone,
      shopPhone,
      timezone,
      googleReviewUrl
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to deploy client slot' },
        { status: 422 }
      )
    }

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('[AGENCY DEPLOY CLIENT API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error while deploying client' },
      { status: 500 }
    )
  }
}
