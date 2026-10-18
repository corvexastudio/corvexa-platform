import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveReferralByCode, recordReferralClick } from '@/lib/referrals/referral-manager'
import { checkRateLimit, extractClientIp, getRateLimitHeaders } from '@/lib/security/rate-limiter'

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ code: string }> }
) {
  const clientIp = extractClientIp(request)
  const rateLimitResult = checkRateLimit(`ref_redirect:${clientIp}`, { max: 30, windowMs: 60 * 1000 })
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(rateLimitResult) }
    )
  }

  const { code } = await props.params

  if (!code || !code.trim()) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  try {
    const supabase = createAdminClient()
    const { success, referral, org } = await resolveReferralByCode(supabase, code)

    if (!success || !referral || !org?.slug) {
      // Fallback redirect to homepage if referral not found
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Record the referral link click asynchronously
    await recordReferralClick(supabase, code)

    // Build the redirect URL to the organization's public booking page with ref param
    const destinationUrl = new URL(`/book/${org.slug}`, request.url)
    destinationUrl.searchParams.set('ref', referral.referral_code)

    const response = NextResponse.redirect(destinationUrl, { status: 307 })

    // Set 30-day attribution cookie so booking even later remembers the referrer
    response.cookies.set('capto_ref', referral.referral_code, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      httpOnly: false, // Accessible to client-side booking wizard
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    })

    return response
  } catch (err) {
    console.error('[REFERRAL_REDIRECT_ERR]', err)
    return NextResponse.redirect(new URL('/', request.url))
  }
}
