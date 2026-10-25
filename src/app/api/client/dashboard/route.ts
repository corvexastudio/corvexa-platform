import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'
import { hasPermission } from '../../../../lib/security/permissions.ts'
import { getDashboardOverview, type TimeRange } from '../../../../lib/dashboard/dashboard-service.ts'

export async function GET(
  request: Request,
  context?: { params?: Promise<Record<string, string | string[] | undefined>>; customSupabase?: any }
) {
  const tenantResult = await getTenantContext('org:view', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase, profile, role } = tenantResult
  const url = new URL(request.url)
  const periodParam = url.searchParams.get('period') as TimeRange || '30d'
  const validPeriod: TimeRange = ['7d', '30d', 'all'].includes(periodParam) ? periodParam : '30d'

  try {
    const overview = await getDashboardOverview(supabase, orgId, validPeriod)

    const canViewFinancials = hasPermission(role, 'financials:read')
    const canViewQuotes = hasPermission(role, 'quotes:read')
    const canViewInvoices = hasPermission(role, 'invoices:read')

    // Restrict financial and revenue aggregates for roles lacking explicit financial permissions
    if (!canViewFinancials) {
      if (overview.outcomes) {
        overview.outcomes.paymentCollection = {
          collectedAmount: 0,
          invoicedAmount: 0,
          collectionRate: 0,
          paidInvoicesCount: 0,
          totalInvoicesCount: 0
        }
        if (overview.outcomes.bookingsFromCaptoDesk) {
          overview.outcomes.bookingsFromCaptoDesk.totalBookedValue = 0
        }
        if (overview.outcomes.quoteConversion) {
          overview.outcomes.quoteConversion.acceptedValue = 0
          overview.outcomes.quoteConversion.totalSentValue = 0
        }
      }

      if (overview.operations) {
        overview.operations.quotesAwaitingResponseValue = 0
        overview.operations.outstandingInvoicesBalance = 0
        overview.operations.paymentsReceivedAmount = 0
        overview.operations.outstandingInvoices = 0
        overview.operations.paymentsReceived = 0
      }

      if (overview.attentionQueue) {
        overview.attentionQueue = overview.attentionQueue.filter(item => item.category !== 'invoice')
      }
    }

    if (!canViewQuotes) {
      if (overview.operations) {
        overview.operations.quotesAwaitingResponse = 0
        overview.operations.quotesAwaitingResponseValue = 0
      }
      if (overview.outcomes && overview.outcomes.quoteConversion) {
        overview.outcomes.quoteConversion = {
          acceptedCount: 0,
          totalResolvedCount: 0,
          conversionRate: 0,
          acceptedValue: 0,
          totalSentValue: 0
        }
      }
      if (overview.attentionQueue) {
        overview.attentionQueue = overview.attentionQueue.filter(item => item.category !== 'quote')
      }
    }

    return NextResponse.json({
      success: true,
      orgId,
      period: validPeriod,
      profile: {
        role: profile.role,
        fullName: profile.full_name
      },
      permissions: {
        canViewFinancials,
        canViewInvoices,
        canViewQuotes
      },
      ...overview
    })
  } catch (err: any) {
    console.error('[Dashboard API Error]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to aggregate dashboard metrics' },
      { status: 500 }
    )
  }
}
