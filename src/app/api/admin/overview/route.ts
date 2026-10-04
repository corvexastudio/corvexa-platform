import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getPlatformOverview } from '@/lib/admin/admin-service'

export async function GET() {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const overview = await getPlatformOverview(tenantResult.supabase)
    return NextResponse.json({
      success: true,
      operator: {
        id: tenantResult.user.id,
        role: tenantResult.role,
        fullName: tenantResult.profile.full_name
      },
      ...overview
    })
  } catch (err: any) {
    console.error('[Admin Overview API Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to aggregate platform overview' }, { status: 500 })
  }
}
