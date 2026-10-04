import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'

export async function POST(request: NextRequest) {
  // Requirement 9: Rate limit public onboarding requests per IP
  const clientIp = extractClientIp(request)
  const rateLimit = checkRateLimit(`ip:${clientIp}:onboard`, RATE_LIMITS.ONBOARDING)
  const rateHeaders = getRateLimitHeaders(rateLimit)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded: Too many onboarding attempts. Please try again shortly.' },
      { status: 429, headers: rateHeaders }
    )
  }

  try {
    let response = NextResponse.json({ success: true }, { headers: rateHeaders })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const body = await request.json()
    const { businessName, phone } = body

    if (!businessName || !businessName.trim()) {
      return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
    }

    // Generate unique slug
    const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`

    const telnyxNumber = process.env.TELNYX_PHONE_NUMBER || '+16823808060'

    // 1. Create Organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: businessName.trim(),
        slug: uniqueSlug,
        owner_phone: phone ? phone.trim() : null,
        telnyx_phone_number: telnyxNumber,
        is_missed_call_active: true,
        is_review_engine_active: true,
      })
      .select()
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: orgError?.message || 'Failed to create organization.' }, { status: 500 })
    }

    // 2. Link Profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        org_id: org.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || businessName.trim(),
        phone: phone ? phone.trim() : null,
        role: 'owner',
      })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 3. Create Automation Settings
    await supabase
      .from('automation_settings')
      .insert({
        org_id: org.id,
        module_key: 'missed_call_recovery',
        is_enabled: true,
        config: {
          cooldown_hours: 24,
          min_call_duration_seconds: 3,
        }
      })

    // Requirement 10: Audit Logging
    await logAuditEvent(supabase, {
      org_id: org.id,
      event_type: 'security.login',
      description: `Organization '${businessName.trim()}' created by ${user.email}`,
      metadata: {
        actor_id: user.id,
        org_id: org.id,
        action: 'tenant_onboarded',
        slug: uniqueSlug
      }
    })

    return NextResponse.json({ success: true, org_id: org.id })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error.' }, { status: 500 })
  }
}
