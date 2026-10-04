import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getTenantHealthList } from '@/lib/admin/admin-service'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const url = new URL(request.url)
  const query = url.searchParams.get('query') || undefined
  const status = url.searchParams.get('status') || undefined

  try {
    const tenants = await getTenantHealthList(tenantResult.supabase, { query, status })
    return NextResponse.json({
      success: true,
      count: tenants.length,
      tenants
    })
  } catch (err: any) {
    console.error('[Admin Tenants API Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to retrieve tenants' }, { status: 500 })
  }
}
