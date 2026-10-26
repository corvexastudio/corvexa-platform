import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { PayPalService } from '@/lib/services/paypal-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('org:billing')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json().catch(() => ({}))
    const { subscriptionId, planTier = 'solo' } = body

    if (!subscriptionId) {
      return NextResponse.json({ error: 'Missing PayPal subscription ID' }, { status: 400 })
    }

    const result = await PayPalService.verifyAndActivateSubscription(supabase, {
      subscriptionId,
      orgId,
      planTier
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to verify subscription' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Your ${planTier === 'fleet' || planTier === 'multi_crew' ? 'Team & Fleet Pro' : 'Solo Pro'} subscription is now active!`,
      organization: result.organization,
      planTier
    })
  } catch (err: any) {
    console.error('[PAYPAL_VERIFY_ROUTE_ERROR]', err)
    return NextResponse.json({ error: err?.message || 'Server error verifying subscription' }, { status: 500 })
  }
}
