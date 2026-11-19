import { NextRequest, NextResponse } from 'next/server'
import { getAgencyAttributionReport } from '@/lib/agency/agency-service'
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
    const report = await getAgencyAttributionReport(agency.id)

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
