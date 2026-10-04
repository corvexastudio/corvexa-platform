import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { processDueAutomationJobs } from '@/lib/automations/worker'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'

export async function POST(request: Request) {
  const clientIp = extractClientIp(request)
  const rateLimit = checkRateLimit(`worker:${clientIp}`, RATE_LIMITS.DEFAULT_API)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429, headers: rateHeaders })
  }

  // Use service role key to process cross-tenant background jobs safely
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )

  try {
    const summary = await processDueAutomationJobs(supabase, 25)
    return NextResponse.json({
      success: true,
      ...summary
    })
  } catch (err: any) {
    console.error('[AUTOMATION WORKER ENDPOINT ERROR]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
