import { NextRequest, NextResponse } from 'next/server'
import { getAgencyAttributionReport } from '@/lib/agency/agency-service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agencySlug = searchParams.get('agency') || 'lokal-media-house'

    const report = await getAgencyAttributionReport(agencySlug)

    return NextResponse.json({ attribution: report }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    })
  } catch (error: any) {
    console.error('[AGENCY ATTRIBUTION API ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch agency attribution report' },
      { status: 500 }
    )
  }
}
