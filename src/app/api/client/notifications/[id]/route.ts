import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'

export const dynamic = 'force-dynamic'

export interface SingleNotificationRouteContext {
  params: Promise<{ id: string }>
  customSupabase?: any
}

export async function PATCH(
  request: Request,
  context: SingleNotificationRouteContext
) {
  const params = await context.params
  const id = params?.id

  if (!id) {
    return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
  }

  const tenantResult = await getTenantContext(undefined, context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json().catch(() => ({}))
    const isRead = body.is_read !== false

    const { data: updated, error } = await supabase
      .from('notifications')
      .update({ is_read: isRead })
      .eq('id', id)
      .eq('org_id', orgId)
      .select()
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to update notification' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, notification: updated })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  context: SingleNotificationRouteContext
) {
  const params = await context.params
  const id = params?.id

  if (!id) {
    return NextResponse.json({ error: 'Notification ID required' }, { status: 400 })
  }

  const tenantResult = await getTenantContext(undefined, context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId)

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to delete notification' }, { status: 500 })
    }

    return NextResponse.json({ success: true, deleted_id: id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
