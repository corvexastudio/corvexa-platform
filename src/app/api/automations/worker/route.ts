import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { drainDueAutomationJobs } from '@/lib/automations/worker'
import { checkRateLimitAsync, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { createStructuredLogger } from '@/lib/observability/logger'

import { createHash, timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Constant-time secret comparison with SHA-256 digest normalization (ADD-02).
 * Normalizing both inputs through SHA-256 guarantees identical 32-byte buffer lengths,
 * completely preventing timing leaks and length leakage.
 */
function safeCompareSecrets(provided: string, expected: string): boolean {
  try {
    if (!provided || !expected) return false
    const hashProvided = createHash('sha256').update(provided, 'utf8').digest()
    const hashExpected = createHash('sha256').update(expected, 'utf8').digest()
    return timingSafeEqual(hashProvided, hashExpected)
  } catch {
    return false
  }
}

async function handleWorkerExecution(request: Request) {
  const invocationId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const clientIp = extractClientIp(request)

  // 1. Enforce fail-closed CRON_SECRET authorization (HIGH-03)
  const configuredCronSecret = process.env.CRON_SECRET

  if (!configuredCronSecret || configuredCronSecret.trim().length === 0) {
    return NextResponse.json(
      { error: 'Cron worker unconfigured: CRON_SECRET is required' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization')
  const xCronSecret = request.headers.get('x-cron-secret')
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  const providedSecret = bearerSecret || xCronSecret?.trim()

  if (!providedSecret || !safeCompareSecrets(providedSecret, configuredCronSecret.trim())) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing cron secret' },
      { status: 401 }
    )
  }

  // 2. Distributed Rate Limiting to prevent runaway schedulers (max 100 executions/min) (HIGH-05)
  const rateLimit = await checkRateLimitAsync(`worker:cron:${clientIp}`, RATE_LIMITS.DEFAULT_API)
  if (!rateLimit.allowed) {
    const rateHeaders = getRateLimitHeaders(rateLimit)
    return NextResponse.json({ error: 'Worker rate limit exceeded' }, { status: 429, headers: rateHeaders })
  }

  // 3. Use service role key via createAdminClient to process cross-tenant background jobs safely
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err: any) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 })
  }

  try {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const summary = await drainDueAutomationJobs(supabase, {
      workerId,
      invocationId,
      batchSize: 25,
      maxBatches: 10,
      maxDurationMs: process.env.WORKER_MAX_DURATION_MS ? parseInt(process.env.WORKER_MAX_DURATION_MS, 10) : 25000,
      safetyMarginMs: process.env.WORKER_SAFETY_MARGIN_MS ? parseInt(process.env.WORKER_SAFETY_MARGIN_MS, 10) : 5000
    })

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...summary
    })
  } catch (err: any) {
    console.error('[AUTOMATION WORKER ENDPOINT ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Support both GET (standard for Vercel Cron) and POST
export async function GET(request: Request) {
  return handleWorkerExecution(request)
}

export async function POST(request: Request) {
  return handleWorkerExecution(request)
}
