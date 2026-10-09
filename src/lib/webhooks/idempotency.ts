/**
 * CaptoDesk Webhook Idempotency & Lifecycle Manager
 * 
 * Enforces atomic state transitions (processing -> completed / failed),
 * crash/stale-lock recovery, and safe retry semantics across all incoming webhooks
 * (Stripe, Telnyx SMS, Telnyx Voice).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type WebhookClaimAction =
  | 'claimed'
  | 'completed'
  | 'reclaimed_retry'
  | 'reclaimed_stale'
  | 'concurrent_active'

export interface WebhookClaimResult {
  action: WebhookClaimAction
  status: 'processing' | 'completed' | 'failed'
  attemptCount: number
}

export interface ClaimWebhookOptions {
  eventId: string
  provider: 'stripe' | 'telnyx' | string
  eventType: string
  staleTimeoutSeconds?: number
}

/**
 * Atomically claims an incoming webhook event.
 * 
 * Uses PostgreSQL claim_webhook_event RPC (with SELECT FOR UPDATE) to guarantee:
 * - Brand new events are claimed with status 'processing'.
 * - Previously completed events return action 'completed' and are safely skipped.
 * - Previously failed events return action 'reclaimed_retry' and are granted re-execution.
 * - Crashed workers exceeding staleTimeoutSeconds are reclaimed with action 'reclaimed_stale'.
 * - Active concurrent workers return action 'concurrent_active' and are prevented from duplicate execution.
 */
export async function claimWebhookEvent(
  supabase: SupabaseClient,
  options: ClaimWebhookOptions
): Promise<WebhookClaimResult> {
  const { eventId, provider, eventType, staleTimeoutSeconds = 60 } = options

  // 1. Primary: Use PostgreSQL RPC
  if (typeof (supabase as any)?.rpc === 'function') {
    try {
      const { data, error } = await (supabase as any).rpc('claim_webhook_event', {
        p_event_id: eventId,
        p_provider: provider,
        p_event_type: eventType,
        p_stale_timeout_seconds: staleTimeoutSeconds
      })

      if (!error && Array.isArray(data) && data.length > 0) {
        const row = data[0]
        return {
          action: row.action as WebhookClaimAction,
          status: row.status as 'processing' | 'completed' | 'failed',
          attemptCount: Number(row.attempt_count) || 1
        }
      }
    } catch {
      // Fall through to atomic client queries
    }
  }

  // 2. Client-level Atomic Query Fallback (for unit tests / mock DBs without the RPC installed):
  const now = new Date()
  const nowIso = now.toISOString()
  const staleLimitMs = now.getTime() - staleTimeoutSeconds * 1000

  // Optimistic insert
  const { error: insertError } = await supabase.from('processed_events').insert({
    id: eventId,
    provider,
    provider_event_id: eventId,
    event_type: eventType,
    status: 'processing',
    locked_at: nowIso,
    attempt_count: 1,
    created_at: nowIso
  })

  if (!insertError) {
    return {
      action: 'claimed',
      status: 'processing',
      attemptCount: 1
    }
  }

  // Row exists: Inspect existing state
  const { data: existing, error: selectError } = await supabase
    .from('processed_events')
    .select('id, status, locked_at, attempt_count')
    .eq('id', eventId)
    .maybeSingle()

  if (selectError || !existing) {
    // If we cannot read the row, assume safe duplicate or insert conflict
    return {
      action: 'concurrent_active',
      status: 'processing',
      attemptCount: 1
    }
  }

  const currentStatus = existing.status || 'completed'
  const currentAttempts = Number(existing.attempt_count) || 1

  // Case A: Already completed -> Skip
  if (currentStatus === 'completed') {
    return {
      action: 'completed',
      status: 'completed',
      attemptCount: currentAttempts
    }
  }

  // Case B: Currently processing -> Check stale lock
  if (currentStatus === 'processing') {
    const lockedMs = existing.locked_at ? new Date(existing.locked_at).getTime() : 0
    const isStale = lockedMs <= staleLimitMs

    if (!isStale) {
      return {
        action: 'concurrent_active',
        status: 'processing',
        attemptCount: currentAttempts
      }
    }

    // Stale lock recovered
    await supabase
      .from('processed_events')
      .update({
        status: 'processing',
        locked_at: nowIso,
        attempt_count: currentAttempts + 1,
        last_error: 'Stale lock recovered'
      })
      .eq('id', eventId)

    return {
      action: 'reclaimed_stale',
      status: 'processing',
      attemptCount: currentAttempts + 1
    }
  }

  // Case C: Status is 'failed' -> Reclaim for retry
  await supabase
    .from('processed_events')
    .update({
      status: 'processing',
      locked_at: nowIso,
      attempt_count: currentAttempts + 1
    })
    .eq('id', eventId)

  return {
    action: 'reclaimed_retry',
    status: 'processing',
    attemptCount: currentAttempts + 1
  }
}

/**
 * Marks a claimed webhook as successfully completed.
 */
export async function completeWebhookEvent(
  supabase: SupabaseClient,
  eventId: string,
  metadata?: Record<string, any>
): Promise<boolean> {
  if (typeof (supabase as any)?.rpc === 'function') {
    try {
      const { error } = await (supabase as any).rpc('complete_webhook_event', {
        p_event_id: eventId,
        p_metadata: metadata || null
      })
      if (!error) return true
    } catch {
      // Fall through
    }
  }

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('processed_events')
    .update({
      status: 'completed',
      completed_at: nowIso,
      locked_at: null,
      last_error: null,
      metadata: metadata || {}
    })
    .eq('id', eventId)

  return !error
}

/**
 * Marks a claimed webhook as failed, clearing its lock so the provider can safely retry.
 */
export async function failWebhookEvent(
  supabase: SupabaseClient,
  eventId: string,
  errorMessage: string
): Promise<boolean> {
  if (typeof (supabase as any)?.rpc === 'function') {
    try {
      const { error } = await (supabase as any).rpc('fail_webhook_event', {
        p_event_id: eventId,
        p_error: errorMessage
      })
      if (!error) return true
    } catch {
      // Fall through
    }
  }

  const { error } = await supabase
    .from('processed_events')
    .update({
      status: 'failed',
      locked_at: null,
      last_error: errorMessage
    })
    .eq('id', eventId)

  return !error
}

/**
 * Resolves concurrent webhook requests by waiting briefly if another worker is actively processing.
 * If the concurrent worker finishes within the wait window, returns true (completed).
 */
export async function waitForConcurrentWebhookCompletion(
  supabase: SupabaseClient,
  eventId: string,
  maxWaitMs = 1500,
  pollIntervalMs = 300
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    const { data } = await supabase
      .from('processed_events')
      .select('status')
      .eq('id', eventId)
      .maybeSingle()

    if (data?.status === 'completed') {
      return true
    }
  }
  return false
}
