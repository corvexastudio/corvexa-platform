import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../lib/security/tenant-context.ts'

export const dynamic = 'force-dynamic'

export interface NotificationsRouteContext {
  customSupabase?: any
}

/**
 * Tenant In-App Notifications API
 * Provides in-app notification center data with strict tenant isolation.
 */

export async function GET(
  request: Request,
  contextOrDeps?: any,
  deps?: NotificationsRouteContext
) {
  const actualDeps: NotificationsRouteContext | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext(undefined, actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const url = new URL(request.url)
    const unreadOnly = url.searchParams.get('unread_only') === 'true'
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10) || 25, 1), 50)

    // 1. Fetch unread count for badge
    const { count: unreadCount, error: countErr } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_read', false)

    if (countErr) {
      console.warn('[NOTIFICATIONS_GET_COUNT_WARNING]', countErr.message)
    }

    // 2. Fetch notifications list
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data: notifications, error: notifErr } = await query

    if (notifErr) {
      console.error('[NOTIFICATIONS_GET_ERROR]', notifErr)
      return NextResponse.json({ error: notifErr.message || 'Failed to load notifications' }, { status: 500 })
    }

    return NextResponse.json({
      notifications: notifications || [],
      unread_count: unreadCount || 0
    })
  } catch (err: any) {
    console.error('[NOTIFICATIONS_GET_EXCEPTION]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  contextOrDeps?: any,
  deps?: NotificationsRouteContext
) {
  const actualDeps: NotificationsRouteContext | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext(undefined, actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json().catch(() => ({}))

    // Action A: Mark all notifications as read for this tenant
    if (body.mark_all_read === true) {
      const { error: markAllErr } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('org_id', orgId)
        .eq('is_read', false)

      if (markAllErr) {
        console.error('[NOTIFICATIONS_MARK_ALL_ERROR]', markAllErr)
        return NextResponse.json({ error: markAllErr.message || 'Failed to mark all as read' }, { status: 500 })
      }

      return NextResponse.json({ success: true, marked_all_read: true })
    }

    // Action B: Mark single notification read / unread
    if (typeof body.id === 'string' && body.id.trim()) {
      const isRead = body.is_read !== false
      const { data: updated, error: updateErr } = await supabase
        .from('notifications')
        .update({ is_read: isRead })
        .eq('id', body.id.trim())
        .eq('org_id', orgId)
        .select()
        .maybeSingle()

      if (updateErr) {
        console.error('[NOTIFICATIONS_UPDATE_ERROR]', updateErr)
        return NextResponse.json({ error: updateErr.message || 'Failed to update notification' }, { status: 500 })
      }

      return NextResponse.json({ success: true, notification: updated })
    }

    return NextResponse.json({ error: 'Missing notification id or mark_all_read parameter' }, { status: 400 })
  } catch (err: any) {
    console.error('[NOTIFICATIONS_PATCH_EXCEPTION]', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  contextOrDeps?: any,
  deps?: NotificationsRouteContext
) {
  const actualDeps: NotificationsRouteContext | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext(undefined, actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    const clearAllRead = url.searchParams.get('clear_all_read') === 'true'

    if (clearAllRead) {
      const { error: clearErr } = await supabase
        .from('notifications')
        .delete()
        .eq('org_id', orgId)
        .eq('is_read', true)

      if (clearErr) {
        return NextResponse.json({ error: clearErr.message || 'Failed to clear read notifications' }, { status: 500 })
      }

      return NextResponse.json({ success: true, cleared_read: true })
    }

    if (id) {
      const { error: deleteErr } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id)
        .eq('org_id', orgId)

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message || 'Failed to delete notification' }, { status: 500 })
      }

      return NextResponse.json({ success: true, deleted_id: id })
    }

    return NextResponse.json({ error: 'Missing notification id or clear_all_read parameter' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
