import { NextRequest, NextResponse } from 'next/server'
import { getAgencyAttributionReport } from '@/lib/agency/agency-service'
import { getAgencyContext } from '@/lib/agency/agency-auth'
import type { AttributionReportFilter, AttributionReportSummary } from '@/lib/agency/agency-types'

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

    const filter: AttributionReportFilter = {
      clientId: searchParams.get('client') || searchParams.get('clientId') || 'all',
      period: (searchParams.get('period') as any) || '30d',
      source: searchParams.get('source') || 'all',
      campaign: searchParams.get('campaign') || 'all',
      industry: searchParams.get('industry') || 'all',
      bookingStatus: searchParams.get('bookingStatus') || 'all',
      paymentStatus: searchParams.get('paymentStatus') || 'all'
    }

    const report = await getAgencyAttributionReport(agency.id, filter)

    // Calculate aggregated summary
    const totalBookings = report.reduce((sum, r) => sum + r.bookings_count, 0)
    const confirmedAppointments = report.reduce((sum, r) => sum + r.confirmed_appointments, 0)
    const completedJobs = report.reduce((sum, r) => sum + r.completed_jobs, 0)
    const totalInvoiced = report.reduce((sum, r) => sum + r.invoiced_revenue, 0)
    const netCollectedRevenue = report.reduce((sum, r) => sum + r.net_revenue, 0)
    const totalAdSpend = report.reduce((sum, r) => sum + (r.ad_spend || 0), 0)
    const totalRetainers = report.reduce((sum, r) => sum + (r.agency_retainer || 0), 0)
    const totalMarketingCosts = totalAdSpend + totalRetainers

    const roas = totalAdSpend > 0 ? Number((netCollectedRevenue / totalAdSpend).toFixed(2)) : null
    const roi = totalMarketingCosts > 0 ? Number(((netCollectedRevenue - totalMarketingCosts) / totalMarketingCosts).toFixed(2)) : null

    const summary: AttributionReportSummary = {
      totalBookings,
      confirmedAppointments,
      completedJobs,
      totalInvoiced,
      netCollectedRevenue,
      totalAdSpend: totalAdSpend > 0 ? totalAdSpend : null,
      totalRetainers: totalRetainers > 0 ? totalRetainers : null,
      roas,
      roi
    }

    return NextResponse.json({ attribution: report, summary }, {
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
