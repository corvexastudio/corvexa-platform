import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../../lib/security/tenant-context.ts'
import { PayPalService, ALLOWED_PAID_PLAN_TIERS } from '../../../../../../lib/services/paypal-service.ts'
import { createAdminClient } from '../../../../../../lib/supabase/admin.ts'

export const dynamic = 'force-dynamic'

export interface PayPalVerifyRouteContext {
  params?: Promise<Record<string, string | string[] | undefined>>
  customSupabase?: any
  adminSupabase?: any
}

export async function POST(request: Request, context?: PayPalVerifyRouteContext) {
  // 1. Authenticate user and verify billing management authorization (org:billing)
  // Server strictly resolves organization identity from authenticated profile context
  const tenantResult = await getTenantContext('org:billing', context?.customSupabase)
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role } = tenantResult

  try {
    const body = await request.json().catch(() => ({}))
    const { subscriptionId, planTier } = body

    // 2. Strict Input Validation
    if (!subscriptionId || typeof subscriptionId !== 'string' || !subscriptionId.trim()) {
      return NextResponse.json({ error: 'Missing or invalid PayPal subscription ID' }, { status: 400 })
    }

    if (!planTier || typeof planTier !== 'string' || !planTier.trim()) {
      return NextResponse.json({ error: 'Missing or invalid plan tier' }, { status: 400 })
    }

    const cleanTier = planTier.trim().toLowerCase()
    if (!ALLOWED_PAID_PLAN_TIERS.includes(cleanTier as any)) {
      return NextResponse.json(
        { error: `Invalid plan tier: '${planTier}'. Allowed tiers are: ${ALLOWED_PAID_PLAN_TIERS.join(', ')}.` },
        { status: 400 }
      )
    }

    // 3. Acquire Server-Only Privileged Administrative Client
    // Avoids PostgreSQL 42501 trigger violation while keeping credentials server-only
    let adminClient: any
    try {
      adminClient = context?.adminSupabase || createAdminClient()
    } catch (adminErr: any) {
      console.error('[PAYPAL_VERIFY_ADMIN_CLIENT_CONFIG_ERROR]', adminErr?.message)
      return NextResponse.json(
        { error: 'Server database configuration error for billing operations.' },
        { status: 500 }
      )
    }

    // 4. Authoritatively verify PayPal provider subscription and activate plan
    const result = await PayPalService.verifyAndActivateSubscription(adminClient, {
      subscriptionId: subscriptionId.trim(),
      orgId,
      planTier: cleanTier,
      actorId: user.id,
      actorEmail: user.email
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to verify subscription' }, { status: 400 })
    }

    const displayTierName = result.planTier === 'multi_crew' || result.planTier === 'fleet'
      ? 'Team & Fleet Pro'
      : 'Solo Pro'

    return NextResponse.json({
      success: true,
      message: `Your ${displayTierName} subscription is now active!`,
      organization: result.organization,
      planTier: result.planTier,
      subscription_status: result.organization?.subscription_status || 'active',
      plan_id: result.organization?.plan_id || result.planTier,
      plan_tier: result.organization?.plan_tier || result.planTier,
      monthly_rate: result.organization?.monthly_rate
    })
  } catch (err: any) {
    console.error('[PAYPAL_VERIFY_ROUTE_ERROR]', err)
    return NextResponse.json({ error: err?.message || 'Server error verifying subscription' }, { status: 500 })
  }
}
