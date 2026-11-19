import { NextRequest, NextResponse } from 'next/server'
import { getAgencyPortfolioOverview } from '@/lib/agency/agency-service'
import { getAgencyContext } from '@/lib/agency/agency-auth'

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

    return NextResponse.json(overview, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('[AGENCY OVERVIEW API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch agency portfolio overview' },
      { status: 500 }
    )
  }
}
