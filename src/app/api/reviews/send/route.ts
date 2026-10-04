import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders } from '@/lib/security/rate-limiter'
import { dispatchReviewRequest } from '@/lib/reviews/review-manager'
import { toE164 } from '@/lib/telnyx'

export async function POST(request: Request) {
  // 1. Authenticate user and verify 'reviews:send' permission
  const tenantResult = await getTenantContext('reviews:send')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role, supabase } = tenantResult

  // 2. Rate Limiting per Tenant
  const rateLimit = checkRateLimit(`tenant:${orgId}:reviews`, RATE_LIMITS.REVIEWS_SEND)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded: Maximum 20 review invites per minute.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    const { name, phone, jobId, message } = await request.json()

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400, headers: rateHeaders })
    }

    const cleanPhone = toE164(phone)

    // Find or create contact
    let { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone, opt_out')
      .eq('org_id', orgId)
      .eq('phone', cleanPhone)
      .maybeSingle()

    if (!contact) {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          org_id: orgId,
          name: name || 'Valued Customer',
          phone: cleanPhone
        })
        .select('id, name, phone, opt_out')
        .single()

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 500, headers: rateHeaders })
      }
      contact = newContact
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.captodesk.com'

    // Dispatch via review manager (strictly compliant, no 5-star gating, legitimate token tracking)
    const result = await dispatchReviewRequest(supabase, {
      orgId,
      contactId: contact.id,
      jobId,
      baseUrl,
      customMessage: message,
      actorId: user.id,
      actorRole: role
    })

    if (result.suppressed) {
      return NextResponse.json(
        {
          success: false,
          suppressed: true,
          error: `Review request suppressed: ${result.reason}`
        },
        { status: 422, headers: rateHeaders }
      )
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch review invitation' },
        { status: 500, headers: rateHeaders }
      )
    }

    return NextResponse.json(
      {
        success: true,
        reviewRequest: result.reviewRequest
      },
      { headers: rateHeaders }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: rateHeaders })
  }
}
