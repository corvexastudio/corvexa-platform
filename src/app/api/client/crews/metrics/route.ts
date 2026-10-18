import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getCrewPerformanceMetrics } from '@/lib/crews/crew-manager'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('crews:view')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30', 10)

  try {
    const metrics = await getCrewPerformanceMetrics(supabase, orgId, days)
    return NextResponse.json({ metrics })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to calculate crew metrics' }, { status: 500 })
  }
}
