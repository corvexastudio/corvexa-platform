import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getStripeClient } from '@/lib/payments/stripe-adapter'

export const dynamic = 'force-dynamic'

/**
 * POST: Generates a secure single-use login link to the contractor's Stripe Express Dashboard
 */
export async function POST() {
  const tenant = await getTenantContext('org:update')
  if (!tenant.ok) return tenant.response

  const { orgId, supabase } = tenant
  const stripe = getStripeClient()

  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_account_id, stripe_account_status')
      .eq('id', orgId)
      .single()

    if (orgError || !org || !org.stripe_account_id) {
      return NextResponse.json({ error: 'Stripe account is not connected' }, { status: 400 })
    }

    if (!stripe) {
      return NextResponse.json({ url: 'https://dashboard.stripe.com/test' })
    }

    const loginLink = await stripe.accounts.createLoginLink(org.stripe_account_id)
    return NextResponse.json({ url: loginLink.url })
  } catch (err: any) {
    console.error('[STRIPE_CONNECT_DASHBOARD_ERROR]', err)
    return NextResponse.json({ error: err.message || 'Failed to generate Stripe dashboard link' }, { status: 500 })
  }
}
