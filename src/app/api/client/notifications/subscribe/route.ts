import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'

export const dynamic = 'force-dynamic'

export interface SubscribeRouteContext {
  customSupabase?: any
}

/**
 * Push Notification Subscription API
 * Manages tenant-isolated Web Push subscriptions for authenticated users.
 * 
 * Security Guarantees:
 * 1. user_id and org_id are strictly derived server-side from session.
 * 2. Client-supplied org_id/user_id in request bodies are ignored.
 * 3. Users can only register/deactivate their own browser endpoints.
 */

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null
  return NextResponse.json({
    success: true,
    vapidPublicKey: publicKey
  })
}

export async function POST(
  request: Request,
  contextOrDeps?: any,
  deps?: SubscribeRouteContext
) {
  const actualDeps: SubscribeRouteContext | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext(undefined, actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, supabase } = tenantResult

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
  }

  const { endpoint, keys, userAgent, deviceLabel } = body || {}

  if (!endpoint || typeof endpoint !== 'string' || !endpoint.startsWith('https://')) {
    return NextResponse.json({ error: 'Valid HTTPS subscription endpoint is required' }, { status: 400 })
  }

  if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
    return NextResponse.json({ error: 'Valid subscription p256dh and auth keys are required' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()

  try {
    const { data: subscription, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          org_id: orgId,
          user_id: user.id,
          endpoint: endpoint.trim(),
          p256dh_key: String(keys.p256dh).trim(),
          auth_key: String(keys.auth).trim(),
          user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
          device_label: deviceLabel ? String(deviceLabel).slice(0, 100) : null,
          is_active: true,
          last_seen_at: nowIso,
          updated_at: nowIso
        },
        { onConflict: 'endpoint' }
      )
      .select('id, org_id, user_id, endpoint, is_active, created_at')
      .single()

    if (error) {
      console.error('[PUSH SUBSCRIBE ERROR] Upsert failed:', error)
      return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      subscription
    })
  } catch (err: any) {
    console.error('[PUSH SUBSCRIBE EXCEPTION]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  contextOrDeps?: any,
  deps?: SubscribeRouteContext
) {
  const actualDeps: SubscribeRouteContext | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)
  const tenantResult = await getTenantContext(undefined, actualDeps?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, supabase } = tenantResult

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
  }

  const { endpoint } = body || {}

  if (!endpoint || typeof endpoint !== 'string') {
    return NextResponse.json({ error: 'Subscription endpoint is required' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .update({ is_active: false, updated_at: nowIso })
      .eq('endpoint', endpoint.trim())
      .eq('user_id', user.id)
      .eq('org_id', orgId)

    if (error) {
      console.error('[PUSH UNSUBSCRIBE ERROR]', error)
      return NextResponse.json({ error: 'Failed to deactivate subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[PUSH UNSUBSCRIBE EXCEPTION]', err)
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 })
  }
}
