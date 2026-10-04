import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getTenantDetail } from '@/lib/admin/admin-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await params

  try {
    const detail = await getTenantDetail(tenantResult.supabase, id)
    if (!detail) {
      return NextResponse.json({ error: 'Tenant organization not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      ...detail
    })
  } catch (err: any) {
    console.error('[Admin Tenant Detail Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to load tenant detail' }, { status: 500 })
  }
}
