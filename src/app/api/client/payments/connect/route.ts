import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'
import { getStripeClient } from '../../../../../lib/payments/stripe-adapter.ts'

export const dynamic = 'force-dynamic'

/**
 * GET: Retrieves latest Stripe Connect onboarding and payout status
 */
export async function GET(
  request?: Request,
  context?: { params?: Promise<Record<string, string | string[] | undefined>>; customSupabase?: any }
) {
  const tenant = await getTenantContext('payments:read', context?.customSupabase)
  if (!tenant.ok) return tenant.response

  const { orgId, supabase } = tenant

  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_onboarded_at')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const stripe = getStripeClient()

    // If account exists and real Stripe client is configured, sync live capabilities
    if (stripe && org.stripe_account_id && org.stripe_account_id.startsWith('acct_')) {
      try {
        const account = await stripe.accounts.retrieve(org.stripe_account_id)
        const isChargesEnabled = Boolean(account.charges_enabled)
        const isPayoutsEnabled = Boolean(account.payouts_enabled)
        const status = isChargesEnabled ? 'active' : 'pending'

        if (
          org.stripe_charges_enabled !== isChargesEnabled ||
          org.stripe_payouts_enabled !== isPayoutsEnabled ||
          org.stripe_account_status !== status
        ) {
          await supabase
            .from('organizations')
            .update({
              stripe_charges_enabled: isChargesEnabled,
              stripe_payouts_enabled: isPayoutsEnabled,
              stripe_account_status: status,
              stripe_onboarded_at: isChargesEnabled ? new Date().toISOString() : org.stripe_onboarded_at
            })
            .eq('id', orgId)

          org.stripe_charges_enabled = isChargesEnabled
          org.stripe_payouts_enabled = isPayoutsEnabled
          org.stripe_account_status = status
        }
      } catch (stripeErr: any) {
        console.warn('[STRIPE_CONNECT_SYNC_WARNING]', stripeErr.message)
      }
    }

    return NextResponse.json({
      connected: Boolean(org.stripe_account_id && org.stripe_charges_enabled),
      accountId: org.stripe_account_id,
      status: org.stripe_account_status || 'not_connected',
      chargesEnabled: Boolean(org.stripe_charges_enabled),
      payoutsEnabled: Boolean(org.stripe_payouts_enabled),
      onboardedAt: org.stripe_onboarded_at
    })
  } catch (err: any) {
    console.error('[STRIPE_CONNECT_GET_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error checking Stripe Connect status' }, { status: 500 })
  }
}

/**
 * POST: Initiates Stripe Connect Express Onboarding Link
 */
export async function POST(
  request: Request,
  context?: { params?: Promise<Record<string, string | string[] | undefined>>; customSupabase?: any }
) {
  const tenant = await getTenantContext('payments:manage', context?.customSupabase)
  if (!tenant.ok) return tenant.response

  const { orgId, supabase } = tenant
  const stripe = getStripeClient()

  try {
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, stripe_account_id')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const refreshUrl = `${baseUrl}/client/settings?connect=refresh`
    const returnUrl = `${baseUrl}/client/settings?connect=success`

    // Simulation mode when Stripe API key is not configured
    if (!stripe) {
      console.info('[STRIPE SIMULATED CONNECT] Generating simulated onboarding response')
      const mockAccountId = `acct_sim_${Date.now()}`
      await supabase
        .from('organizations')
        .update({
          stripe_account_id: mockAccountId,
          stripe_account_status: 'active',
          stripe_charges_enabled: true,
          stripe_payouts_enabled: true,
          stripe_onboarded_at: new Date().toISOString()
        })
        .eq('id', orgId)

      return NextResponse.json({
        url: `${baseUrl}/client/settings?connect=simulated_success&account_id=${mockAccountId}`
      })
    }

    let stripeAccountId = org.stripe_account_id

    // 1. Create express account if not already created
    if (!stripeAccountId || !stripeAccountId.startsWith('acct_')) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_profile: {
          name: org.name || 'CaptoDesk Business'
        },
        metadata: {
          org_id: orgId
        }
      })
      stripeAccountId = account.id

      await supabase
        .from('organizations')
        .update({
          stripe_account_id: stripeAccountId,
          stripe_account_status: 'pending'
        })
        .eq('id', orgId)
    }

    // 2. Generate secure Account Onboarding Link
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    })

    return NextResponse.json({ url: accountLink.url })
  } catch (err: any) {
    console.error('[STRIPE_CONNECT_POST_ERROR]', err)
    return NextResponse.json({ error: err.message || 'Failed to initiate Stripe onboarding' }, { status: 500 })
  }
}
