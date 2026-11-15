import { NextRequest, NextResponse } from 'next/server'
import { getAgencyPortfolioOverview } from '@/lib/agency/agency-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agencySlug = searchParams.get('agency') || 'lokal-media-house'

    const overview = await getAgencyPortfolioOverview(agencySlug)

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
