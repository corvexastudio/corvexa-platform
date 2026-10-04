import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getDashboardOverview, TimeRange } from '@/lib/dashboard/dashboard-service'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('org:view')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase, profile } = tenantResult
  const url = new URL(request.url)
  const periodParam = url.searchParams.get('period') as TimeRange || '30d'
  const validPeriod: TimeRange = ['7d', '30d', 'all'].includes(periodParam) ? periodParam : '30d'

  try {
    const overview = await getDashboardOverview(supabase, orgId, validPeriod)
    return NextResponse.json({
      success: true,
      orgId,
      period: validPeriod,
      profile: {
        role: profile.role,
        fullName: profile.full_name
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
