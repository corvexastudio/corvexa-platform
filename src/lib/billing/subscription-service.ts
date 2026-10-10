import type { SupabaseClient } from '@supabase/supabase-js'
import { getSaasPlan, calculatePeriodEnd, DEFAULT_SAAS_PLAN_ID } from './plans.ts'
import { logAuditEvent } from '../security/audit-logger.ts'
import type { SaasSubscription, SaasPayment, SaasSubscriptionStatus } from '../types/database.ts'

export interface ActorContext {
  id: string
  email?: string | null
  role?: string
}

export interface EntitlementResult {
  isEntitled: boolean
  status: string
  reason: string
  planId?: string
  currentPeriodStart?: string | null
  currentPeriodEnd?: string | null
  cancelAtPeriodEnd?: boolean
}

export interface ActivateSubscriptionInput {
  planId?: string
  paymentReference?: string | null
  notes?: string | null
  periodMonths?: number
  provider?: string
}

export interface RenewSubscriptionInput {
  paymentReference?: string | null
  notes?: string | null
  periodMonths?: number
  provider?: string
}

export interface CancelSubscriptionInput {
  immediate: boolean
  reason?: string | null
}

export interface RecordPaymentInput {
  amount: number
  currency?: string
  billingPeriodStart: string
  billingPeriodEnd: string
  paymentReference?: string | null
  provider?: string
  notes?: string | null
}

/**
 * SaaS Subscription & Entitlement Management Service
 * 
 * Provides server-authoritative, provider-independent subscription lifecycle
 * management, manual payment logging, idempotency checks, and audit trailing.
 */
export class SubscriptionService {
  /**
   * Retrieves the current SaaS subscription for an organization,
   * evaluating period expiry if active period has passed.
   */
  static async getSubscription(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<SaasSubscription | null> {
    const { data: sub, error } = await supabase
      .from('saas_subscriptions')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error || !sub) return null

    // Check if active subscription has elapsed without renewal
    if (sub.status === 'active' && sub.current_period_end) {
      const now = new Date()
      const end = new Date(sub.current_period_end)
      if (end < now) {
        // Transition to expired
        const expiredStatus: SaasSubscriptionStatus = 'expired'
        await supabase
          .from('saas_subscriptions')
          .update({
            status: expiredStatus,
            updated_at: now.toISOString()
          })
          .eq('id', sub.id)

        // Keep organizations table in sync
        await supabase
          .from('organizations')
          .update({ subscription_status: 'past_due' })
          .eq('id', orgId)

        await logAuditEvent(supabase, {
          org_id: orgId,
          event_type: 'billing.subscription_expired',
          description: `Subscription for organization ${orgId} has expired`,
          metadata: {
            subscription_id: sub.id,
            previous_status: 'active',
            new_status: 'expired',
            period_end: sub.current_period_end
          }
        })

        return {
          ...sub,
          status: expiredStatus,
          updated_at: now.toISOString()
        }
      }
    }

    return sub as SaasSubscription
  }

  /**
   * Evaluates server-side SaaS access entitlement.
   * Decoupled from payment provider; evaluates internal status and valid period dates.
   */
  static async getEntitlement(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<EntitlementResult> {
    const sub = await this.getSubscription(supabase, orgId)

    if (sub) {
      const now = new Date()
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null

      if (sub.status === 'active') {
        if (periodEnd && periodEnd < now) {
          return {
            isEntitled: false,
            status: 'expired',
            reason: 'Subscription period has elapsed',
            planId: sub.plan_id,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end
          }
        }
        return {
          isEntitled: true,
          status: 'active',
          reason: 'Subscription is active and within billing period',
          planId: sub.plan_id,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end
        }
      }

      if (sub.status === 'canceled') {
        // If set to cancel at period end and still within period, access remains enabled
        if (sub.cancel_at_period_end && periodEnd && periodEnd >= now) {
          return {
            isEntitled: true,
            status: 'canceled',
            reason: 'Subscription scheduled for cancellation but still within active period',
            planId: sub.plan_id,
            currentPeriodStart: sub.current_period_start,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: true
          }
        }
        return {
          isEntitled: false,
          status: 'canceled',
          reason: 'Subscription has been canceled',
          planId: sub.plan_id,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end
        }
      }

      if (sub.status === 'pending') {
        return {
          isEntitled: false,
          status: 'pending',
          reason: 'Subscription activation pending initial payment verification',
          planId: sub.plan_id,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end
        }
      }

      if (sub.status === 'past_due') {
        return {
          isEntitled: false,
          status: 'past_due',
          reason: 'Subscription is past due',
          planId: sub.plan_id,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end
        }
      }

      if (sub.status === 'expired') {
        return {
          isEntitled: false,
          status: 'expired',
          reason: 'Subscription period has expired',
          planId: sub.plan_id,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end
        }
      }
    }

    // Fallback: If no dedicated SaaS subscription record exists yet,
    // inspect organizations.subscription_status for trial or baseline state.
    const { data: org } = await supabase
      .from('organizations')
      .select('subscription_status')
      .eq('id', orgId)
      .maybeSingle()

    const orgStatus = org?.subscription_status || 'pending'
    if (orgStatus === 'trial' || orgStatus === 'active') {
      return {
        isEntitled: true,
        status: orgStatus,
        reason: orgStatus === 'trial' ? 'Onboarding trial period' : 'Organization active status'
      }
    }

    return {
      isEntitled: false,
      status: orgStatus,
      reason: `Organization status is '${orgStatus}' with no active SaaS subscription`
    }
  }

  /**
   * Activates a subscription following manual payment verification (e.g. PayPal).
   * Generates or updates the subscription, logs a payment record, and logs an audit event.
   */
  static async activateSubscription(
    supabase: SupabaseClient,
    actor: ActorContext,
    orgId: string,
    input: ActivateSubscriptionInput = {}
  ): Promise<{ subscription: SaasSubscription; payment: SaasPayment }> {
    const plan = getSaasPlan(input.planId || DEFAULT_SAAS_PLAN_ID)
    const periodMonths = input.periodMonths && input.periodMonths > 0 ? Math.floor(input.periodMonths) : 1
    const totalAmount = Math.round(plan.amount * periodMonths * 100) / 100

    const now = new Date()
    const periodEnd = calculatePeriodEnd(now, periodMonths)

    // 1. Fetch previous state for audit logging
    const previous = await this.getSubscription(supabase, orgId)

    // 2. Upsert Subscription Record
    const subPayload = {
      org_id: orgId,
      plan_id: plan.id,
      status: 'active' as SaasSubscriptionStatus,
      billing_interval: plan.billingInterval,
      amount: plan.amount,
      currency: plan.currency,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
      provider: 'manual',
      updated_at: now.toISOString()
    }

    let subscription: SaasSubscription
    if (previous) {
      const { data, error } = await supabase
        .from('saas_subscriptions')
        .update(subPayload)
        .eq('id', previous.id)
        .select('*')
        .single()
      if (error || !data) throw new Error(error?.message || 'Failed to update subscription')
      subscription = data
    } else {
      const { data, error } = await supabase
        .from('saas_subscriptions')
        .insert({
          ...subPayload,
          created_at: now.toISOString()
        })
        .select('*')
        .single()
      if (error || !data) throw new Error(error?.message || 'Failed to insert subscription')
      subscription = data
    }

    // 3. Create SaaS Payment Record
    const paymentPayload = {
      org_id: orgId,
      subscription_id: subscription.id,
      amount: totalAmount,
      currency: plan.currency,
      payment_date: now.toISOString(),
      billing_period_start: now.toISOString(),
      billing_period_end: periodEnd.toISOString(),
      provider: input.provider || 'paypal_manual',
      provider_payment_reference: input.paymentReference?.trim() || null,
      payment_status: 'completed',
      notes: input.notes?.trim() || 'Manual PayPal payment verified by administrator',
      created_by: actor.id,
      created_at: now.toISOString()
    }

    const { data: payment, error: payErr } = await supabase
      .from('saas_payments')
      .insert(paymentPayload)
      .select('*')
      .single()

    if (payErr || !payment) {
      throw new Error(payErr?.message || 'Failed to record subscription payment')
    }

    // 4. Synchronize organization status
    await supabase
      .from('organizations')
      .update({
        subscription_status: 'active',
        monthly_rate: plan.amount
      })
      .eq('id', orgId)

    // 5. Audit Logging
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'billing.subscription_activated',
      description: `Subscription activated for plan '${plan.name}' ($${plan.amount}/${plan.billingInterval})`,
      metadata: {
        actor_id: actor.id,
        actor_email: actor.email,
        subscription_id: subscription.id,
        payment_id: payment.id,
        plan_id: plan.id,
        amount: totalAmount,
        currency: plan.currency,
        provider: paymentPayload.provider,
        payment_reference: paymentPayload.provider_payment_reference,
        current_period_start: subPayload.current_period_start,
        current_period_end: subPayload.current_period_end,
        previous_status: previous?.status || 'none',
        new_status: 'active'
      }
    })

    return { subscription, payment }
  }

  /**
   * Renews an existing subscription for an additional billing period.
   * Advances the current period end safely without overlapping gaps.
   */
  static async renewSubscription(
    supabase: SupabaseClient,
    actor: ActorContext,
    orgId: string,
    input: RenewSubscriptionInput = {}
  ): Promise<{ subscription: SaasSubscription; payment: SaasPayment }> {
    const existing = await this.getSubscription(supabase, orgId)
    if (!existing) {
      throw new Error('No subscription found for this organization. Activate a subscription first.')
    }

    const plan = getSaasPlan(existing.plan_id)
    const periodMonths = input.periodMonths && input.periodMonths > 0 ? Math.floor(input.periodMonths) : 1
    const totalAmount = Math.round(plan.amount * periodMonths * 100) / 100

    const now = new Date()
    // Calculate new start: if current subscription has future period end, advance seamlessly from that end date!
    let newStart: Date
    if (existing.current_period_end && new Date(existing.current_period_end) > now) {
      newStart = new Date(existing.current_period_end)
    } else {
      newStart = now
    }

    const newEnd = calculatePeriodEnd(newStart, periodMonths)

    // Idempotency: Verify no payment record already covers this exact period
    const { data: existingPayment } = await supabase
      .from('saas_payments')
      .select('id')
      .eq('subscription_id', existing.id)
      .eq('billing_period_start', newStart.toISOString())
      .eq('billing_period_end', newEnd.toISOString())
      .maybeSingle()

    if (existingPayment) {
      throw new Error('A payment for this exact billing period has already been recorded (duplicate submission prevented)')
    }

    // 1. Update Subscription
    const { data: updatedSub, error: updateErr } = await supabase
      .from('saas_subscriptions')
      .update({
        status: 'active',
        current_period_end: newEnd.toISOString(),
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: now.toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (updateErr || !updatedSub) {
      throw new Error(updateErr?.message || 'Failed to renew subscription')
    }

    // 2. Insert Payment Record
    const paymentPayload = {
      org_id: orgId,
      subscription_id: existing.id,
      amount: totalAmount,
      currency: plan.currency,
      payment_date: now.toISOString(),
      billing_period_start: newStart.toISOString(),
      billing_period_end: newEnd.toISOString(),
      provider: input.provider || 'paypal_manual',
      provider_payment_reference: input.paymentReference?.trim() || null,
      payment_status: 'completed',
      notes: input.notes?.trim() || 'Manual renewal verified by administrator',
      created_by: actor.id,
      created_at: now.toISOString()
    }

    const { data: payment, error: payErr } = await supabase
      .from('saas_payments')
      .insert(paymentPayload)
      .select('*')
      .single()

    if (payErr || !payment) {
      throw new Error(payErr?.message || 'Failed to record renewal payment')
    }

    // 3. Keep organization status active
    await supabase
      .from('organizations')
      .update({ subscription_status: 'active' })
      .eq('id', orgId)

    // 4. Audit Log
    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'billing.subscription_renewed',
      description: `Subscription renewed through ${newEnd.toISOString()}`,
      metadata: {
        actor_id: actor.id,
        actor_email: actor.email,
        subscription_id: existing.id,
        payment_id: payment.id,
        amount: totalAmount,
        currency: plan.currency,
        previous_period_end: existing.current_period_end,
        new_period_end: newEnd.toISOString(),
        payment_reference: paymentPayload.provider_payment_reference
      }
    })

    return { subscription: updatedSub, payment }
  }

  /**
   * Cancels a subscription either immediately or at current period end.
   */
  static async cancelSubscription(
    supabase: SupabaseClient,
    actor: ActorContext,
    orgId: string,
    input: CancelSubscriptionInput
  ): Promise<SaasSubscription> {
    const existing = await this.getSubscription(supabase, orgId)
    if (!existing) {
      throw new Error('No subscription found for this organization')
    }

    const now = new Date()

    if (input.immediate) {
      // Immediate cancellation terminates access right away
      const { data, error } = await supabase
        .from('saas_subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: false,
          canceled_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error || !data) throw new Error(error?.message || 'Failed to cancel subscription')

      await supabase
        .from('organizations')
        .update({ subscription_status: 'canceled' })
        .eq('id', orgId)

      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'billing.subscription_canceled',
        description: `Subscription canceled immediately by admin (${input.reason || 'No reason specified'})`,
        metadata: {
          actor_id: actor.id,
          actor_email: actor.email,
          subscription_id: existing.id,
          immediate: true,
          reason: input.reason || null
        }
      })

      return data
    } else {
      // Cancel at period end maintains entitlement until current_period_end
      const { data, error } = await supabase
        .from('saas_subscriptions')
        .update({
          cancel_at_period_end: true,
          canceled_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (error || !data) throw new Error(error?.message || 'Failed to set cancellation')

      await logAuditEvent(supabase, {
        org_id: orgId,
        event_type: 'billing.subscription_canceled',
        description: `Subscription scheduled to cancel at period end (${existing.current_period_end})`,
        metadata: {
          actor_id: actor.id,
          actor_email: actor.email,
          subscription_id: existing.id,
          immediate: false,
          period_end: existing.current_period_end,
          reason: input.reason || null
        }
      })

      return data
    }
  }

  /**
   * Reactivates a subscription that was marked to cancel at period end.
   */
  static async reactivateSubscription(
    supabase: SupabaseClient,
    actor: ActorContext,
    orgId: string
  ): Promise<SaasSubscription> {
    const existing = await this.getSubscription(supabase, orgId)
    if (!existing) {
      throw new Error('No subscription found for this organization')
    }

    if (!existing.cancel_at_period_end && existing.status === 'active') {
      return existing
    }

    const now = new Date()

    // If period has already elapsed or was immediately canceled, requires explicit activation/renewal
    if (existing.status === 'canceled' && !existing.cancel_at_period_end) {
      throw new Error('Immediately canceled subscription cannot be automatically restored. Use activate or renew.')
    }

    const { data, error } = await supabase
      .from('saas_subscriptions')
      .update({
        status: 'active',
        cancel_at_period_end: false,
        canceled_at: null,
        updated_at: now.toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error || !data) throw new Error(error?.message || 'Failed to reactivate subscription')

    await supabase
      .from('organizations')
      .update({ subscription_status: 'active' })
      .eq('id', orgId)

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'billing.subscription_reactivated',
      description: 'Subscription reactivated; cancellation at period end cleared',
      metadata: {
        actor_id: actor.id,
        actor_email: actor.email,
        subscription_id: existing.id
      }
    })

    return data
  }

  /**
   * Records a manual SaaS payment entry with period dates and audit trailing.
   */
  static async recordPayment(
    supabase: SupabaseClient,
    actor: ActorContext,
    orgId: string,
    input: RecordPaymentInput
  ): Promise<SaasPayment> {
    const existing = await this.getSubscription(supabase, orgId)
    if (!existing) {
      throw new Error('No subscription exists for this organization. Activate subscription before recording payments.')
    }

    if (isNaN(input.amount) || input.amount <= 0) {
      throw new Error('Payment amount must be greater than zero')
    }

    const start = new Date(input.billingPeriodStart)
    const end = new Date(input.billingPeriodEnd)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      throw new Error('Invalid billing period: End date must be strictly after start date')
    }

    const now = new Date()

    // Prevent duplicate payment for identical period
    const { data: existingPay } = await supabase
      .from('saas_payments')
      .select('id')
      .eq('subscription_id', existing.id)
      .eq('billing_period_start', start.toISOString())
      .eq('billing_period_end', end.toISOString())
      .maybeSingle()

    if (existingPay) {
      throw new Error('A payment for this exact period has already been recorded')
    }

    const paymentPayload = {
      org_id: orgId,
      subscription_id: existing.id,
      amount: Math.round(input.amount * 100) / 100,
      currency: input.currency?.toUpperCase() || 'USD',
      payment_date: now.toISOString(),
      billing_period_start: start.toISOString(),
      billing_period_end: end.toISOString(),
      provider: input.provider || 'paypal_manual',
      provider_payment_reference: input.paymentReference?.trim() || null,
      payment_status: 'completed',
      notes: input.notes?.trim() || null,
      created_by: actor.id,
      created_at: now.toISOString()
    }

    const { data: payment, error } = await supabase
      .from('saas_payments')
      .insert(paymentPayload)
      .select('*')
      .single()

    if (error || !payment) {
      throw new Error(error?.message || 'Failed to record payment')
    }

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'billing.payment_recorded',
      description: `Manual payment of $${paymentPayload.amount} recorded (${paymentPayload.provider})`,
      metadata: {
        actor_id: actor.id,
        actor_email: actor.email,
        subscription_id: existing.id,
        payment_id: payment.id,
        amount: paymentPayload.amount,
        currency: paymentPayload.currency,
        reference: paymentPayload.provider_payment_reference,
        billing_period_start: paymentPayload.billing_period_start,
        billing_period_end: paymentPayload.billing_period_end
      }
    })

    return payment
  }

  /**
   * Retrieves SaaS subscription payment history for an organization.
   */
  static async getPaymentHistory(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<SaasPayment[]> {
    const { data, error } = await supabase
      .from('saas_payments')
      .select('*')
      .eq('org_id', orgId)
      .order('payment_date', { ascending: false })

    if (error || !data) return []
    return data as SaasPayment[]
  }
}
