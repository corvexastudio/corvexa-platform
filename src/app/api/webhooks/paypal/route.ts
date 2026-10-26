import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PayPalService } from '@/lib/services/paypal-service'
import { getSaasPlan } from '@/lib/billing/plans'
import { logAuditEvent } from '@/lib/security/audit-logger'
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
  waitForConcurrentWebhookCompletion
} from '@/lib/webhooks/idempotency'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  let eventId: string | undefined
  let eventType = 'unknown'

  try {
    const rawBody = await request.text()
    const headers: Record<string, string> = {}
    request.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val
    })

    // 1. Signature Verification
    const verification = await PayPalService.verifyWebhookSignature(headers, rawBody)
    if (!verification.isValid) {
      console.warn('[PAYPAL_WEBHOOK_REJECTED]', verification.error)
      return NextResponse.json({ error: verification.error || 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    eventId = event.id
    eventType = event.event_type
    const resource = event.resource || {}
    const supabase = createAdminClient()

    // 2. Idempotency Claim Check
    const claim = await claimWebhookEvent(supabase, {
      eventId: event.id,
      provider: 'paypal',
      eventType: event.event_type,
      staleTimeoutSeconds: 60
    })

    if (claim.action === 'completed') {
      return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
    }

    if (claim.action === 'concurrent_active') {
      const didComplete = await waitForConcurrentWebhookCompletion(supabase, event.id, 1500, 300)
      if (didComplete) {
        return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
      }
      return NextResponse.json(
        { error: 'Concurrent webhook processing in progress. Retry requested.' },
        { status: 429 }
      )
    }

    // 3. Process Event Lifecycle
    const now = new Date().toISOString()

    if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const subscriptionId = resource.id
      const orgId = resource.custom_id

      let targetOrgId = orgId
      if (!targetOrgId && subscriptionId) {
        const { data: matchedOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()
        targetOrgId = matchedOrg?.id
      }

      if (targetOrgId) {
        const fleetPlanId = process.env.NEXT_PUBLIC_PAYPAL_FLEET_PLAN_ID
        const isFleet = resource.plan_id === fleetPlanId
        const planTier = isFleet ? 'multi_crew' : 'solo'
        const plan = getSaasPlan(planTier)

        await supabase
          .from('organizations')
          .update({
            subscription_status: 'active',
            plan_id: planTier,
            billing_provider: 'paypal',
            paypal_subscription_id: subscriptionId,
            paypal_plan_id: resource.plan_id,
            monthly_rate: plan.amount,
            updated_at: now
          })
          .eq('id', targetOrgId)

        await supabase
          .from('saas_subscriptions')
          .upsert({
            org_id: targetOrgId,
            plan_id: planTier,
            amount: plan.amount,
            currency: 'USD',
            status: 'active',
            billing_interval: 'month',
            provider: 'paypal',
            paypal_subscription_id: subscriptionId,
            paypal_plan_id: resource.plan_id,
            updated_at: now
          }, { onConflict: 'org_id' })

        await logAuditEvent(supabase, {
          org_id: targetOrgId,
          event_type: 'billing.subscription_activated',
          description: `PayPal webhook activated subscription ${subscriptionId}`,
          metadata: { subscriptionId, planTier }
        })
      }
    } else if (eventType === 'PAYMENT.SALE.COMPLETED') {
      const subscriptionId = resource.billing_agreement_id
      const amountPaid = Number(resource.amount?.total) || 0
      const currency = resource.amount?.currency || 'USD'

      if (subscriptionId) {
        const { data: matchedOrg } = await supabase
          .from('organizations')
          .select('id, plan_id')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (matchedOrg) {
          await supabase
            .from('organizations')
            .update({ subscription_status: 'active', updated_at: now })
            .eq('id', matchedOrg.id)

          // Record payment in saas_payments table
          const periodStart = now
          const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

          await supabase.from('saas_payments').insert({
            org_id: matchedOrg.id,
            amount: amountPaid,
            currency,
            status: 'completed',
            payment_reference: resource.id,
            provider: 'paypal',
            billing_period_start: periodStart,
            billing_period_end: periodEnd,
            notes: `PayPal Recurring Sale ${resource.id}`,
            created_at: now
          })
        }
      }
    } else if (eventType === 'BILLING.SUBSCRIPTION.UPDATED') {
      const subscriptionId = resource.id
      const newPlanId = resource.plan_id
      const fleetPlanId = process.env.NEXT_PUBLIC_PAYPAL_FLEET_PLAN_ID
      const isFleet = newPlanId === fleetPlanId
      const planTier = isFleet ? 'multi_crew' : 'solo'
      const plan = getSaasPlan(planTier)

      if (subscriptionId) {
        await supabase
          .from('organizations')
          .update({
            plan_id: planTier,
            monthly_rate: plan.amount,
            paypal_plan_id: newPlanId,
            updated_at: now
          })
          .eq('paypal_subscription_id', subscriptionId)

        await supabase
          .from('saas_subscriptions')
          .update({
            plan_id: planTier,
            amount: plan.amount,
            paypal_plan_id: newPlanId,
            updated_at: now
          })
          .eq('paypal_subscription_id', subscriptionId)
      }
    } else if (
      eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ||
      eventType === 'BILLING.SUBSCRIPTION.SUSPENDED' ||
      eventType === 'BILLING.SUBSCRIPTION.EXPIRED'
    ) {
      const subscriptionId = resource.id
      if (subscriptionId) {
        // Graceful downgrade to Free tier without deleting contractor data or breaking public booking
        const { data: org } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('paypal_subscription_id', subscriptionId)
          .maybeSingle()

        if (org) {
          await supabase
            .from('organizations')
            .update({
              subscription_status: 'free',
              plan_id: 'free',
              monthly_rate: 0,
              updated_at: now
            })
            .eq('id', org.id)

          await supabase
            .from('saas_subscriptions')
            .update({
              status: 'canceled',
              canceled_at: now,
              updated_at: now
            })
            .eq('org_id', org.id)

          await logAuditEvent(supabase, {
            org_id: org.id,
            event_type: 'billing.subscription_canceled',
            description: `PayPal subscription ${subscriptionId} ended (${eventType}). Organization transitioned gracefully to Free Booking Link tier.`,
            metadata: { subscriptionId, eventType }
          })
        }
      }
    }

    await completeWebhookEvent(supabase, event.id)
    return NextResponse.json({ success: true, eventId: event.id })
  } catch (err: any) {
    console.error('[PAYPAL_WEBHOOK_EXECUTION_ERROR]', err)
    if (eventId) {
      const supabase = createAdminClient()
      await failWebhookEvent(supabase, eventId, err?.message || 'Execution error')
    }
    return NextResponse.json({ error: 'Webhook processing error' }, { status: 500 })
  }
}
