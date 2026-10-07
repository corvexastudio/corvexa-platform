import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { processDueAutomationJobs } from '@/lib/automations/worker'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'

export const dynamic = 'force-dynamic'

async function handleWorkerExecution(request: Request) {
  const clientIp = extractClientIp(request)

  // 1. Check CRON_SECRET authorization if configured
  const configuredCronSecret = process.env.CRON_SECRET
  if (configuredCronSecret) {
    const authHeader = request.headers.get('authorization')
    const xCronSecret = request.headers.get('x-cron-secret')
    const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    const providedSecret = bearerSecret || xCronSecret
    if (!providedSecret || providedSecret !== configuredCronSecret) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or missing cron secret' },
        { status: 401 }
      )
    }
  } else {
    // Fall back to IP rate limiting if CRON_SECRET is not configured (local dev/test)
    const rateLimit = checkRateLimit(`worker:${clientIp}`, RATE_LIMITS.DEFAULT_API)
    const rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateHeaders })
    }
  }

  // 2. Use service role key via createAdminClient to process cross-tenant background jobs safely
  let supabase
  try {
    supabase = createAdminClient()
  } catch (err: any) {
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 500 })
  }

  try {
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const summary = await processDueAutomationJobs(supabase, 25, workerId)
    return NextResponse.json({
      success: true,
      workerId,
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
