import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerCancelBooking } from '@/lib/booking/booking-manager'
import {
  checkRateLimitAsync,
  RATE_LIMITS,
  getRateLimitHeaders,
  extractClientIp,
  PRIVATE_CACHE_HEADERS
} from '@/lib/security/rate-limiter'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  let rateHeaders: Record<string, string> | undefined
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing management token' }, { status: 400 })
    }

    // IP-based rate limiting on cancellation requests (10 req/min)
    const clientIp = extractClientIp(request)
    const rateLimit = await checkRateLimitAsync(`manage:cancel:${clientIp}`, RATE_LIMITS.MANAGE_ACTION)
    rateHeaders = getRateLimitHeaders(rateLimit)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many cancellation requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    const body = await request.json().catch(() => ({}))
    const reason = body.reason?.trim() || 'Cancelled by customer'

    const supabase = createAdminClient()

    const result = await customerCancelBooking(supabase, token, reason)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cancel appointment' },
        {
          status: 400,
          headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Appointment successfully cancelled',
        appointment: result.appointment
      },
      {
        status: 200,
        headers: { ...PRIVATE_CACHE_HEADERS, ...rateHeaders }
      }
    )
  } catch (err: any) {
    console.error('[BOOKING_CANCEL_ERROR]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: { ...PRIVATE_CACHE_HEADERS, ...(rateHeaders || {}) }
      }
    )
  }
}
