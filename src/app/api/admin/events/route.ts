import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getPlatformEventTimeline } from '@/lib/admin/admin-service'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const url = new URL(request.url)
  const category = url.searchParams.get('category') || undefined
  const orgId = url.searchParams.get('orgId') || undefined
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : 50

  try {
    const events = await getPlatformEventTimeline(tenantResult.supabase, {
      category,
      orgId,
      limit
    })
    return NextResponse.json({
      success: true,
      count: events.length,
      events
    })
  } catch (err: any) {
    console.error('[Admin Events API Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to retrieve event timeline' }, { status: 500 })
  }
}
