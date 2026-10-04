import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { inspectEventPayload } from '@/lib/admin/admin-service'

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
    const event = await inspectEventPayload(tenantResult.supabase, id)
    if (!event) {
      return NextResponse.json({ error: 'Event record not found' }, { status: 404 })
    }
    return NextResponse.json({
      success: true,
      event
    })
  } catch (err: any) {
    console.error('[Admin Event Inspection Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to inspect event' }, { status: 500 })
  }
}
