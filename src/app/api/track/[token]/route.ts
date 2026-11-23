import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerViewJobTracking } from '@/lib/jobs/job-manager'
import {
  checkRateLimitAsync,
  RATE_LIMITS,
  getRateLimitHeaders,
  extractClientIp,
  PRIVATE_CACHE_HEADERS
} from '@/lib/security/rate-limiter'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  let rateHeaders: Record<string, string> | undefined
  try {
    const { token } = await params
    if (!token) {
      return NextResponse.json({ error: 'Tracking token is required' }, { status: 400 })
    }

    // IP-based rate limiting on public tracker views (60 req/min)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`tracking:view:${clientIp}`, RATE_LIMITS.TRACKING_VIEW)
    rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const supabase = createAdminClient()
    const result = await customerViewJobTracking(supabase, token)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Job not found' },
        {
          status: 404,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    return NextResponse.json(result, {
      status: 200,
      headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
    })
  } catch (err: any) {
    console.error('[API_JOB_TRACKING_ERROR]', err)
    return NextResponse.json(
      { error: 'Internal server error resolving job tracking' },
      {
        status: 500,
        headers: { ...PRIVATE_CACHE_HEADERS, ...(rateHeaders || {}) }
      }
    )
  }
}
