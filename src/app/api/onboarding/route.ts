import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { checkRateLimit, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'
import { provisionOrganizationPhoneNumber } from '@/lib/telephony/provisioning'

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

    const body = await request.json().catch(() => ({}))
    const { phone } = body
    const rawBusinessName = (body.businessName || '').trim()
    const defaultName = user.user_metadata?.full_name 
      ? `${user.user_metadata.full_name}'s Business`
      : (user.email ? `${user.email.split('@')[0]}'s Services` : 'My Business')
    const businessName = rawBusinessName || defaultName

    // 0. Check if user already has an existing profile and organization
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .maybeSingle()

    if (existingProfile?.org_id) {
      return NextResponse.json({ success: true, org_id: existingProfile.org_id })
    }

    // Determine database client: prefer adminClient if operational, fallback to user client
    let dbClient = supabase
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = createAdminClient()
      const { error: testErr } = await adminClient.from('organizations').select('id').limit(1)
      if (!testErr) {
        dbClient = adminClient
      }
    } catch {
      dbClient = supabase
    }

    // Generate deterministic UUID and unique slug
    const orgId = crypto.randomUUID()
    const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company'
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    const requestedNumber = body.requestedNumber || body.telnyxPhoneNumber || null

    // 1. Create Organization with pre-generated UUID (never chains .select() under user client to prevent RLS SELECT lockout)
    const { error: orgError } = await dbClient
      .from('organizations')
      .insert({
        id: orgId,
        name: businessName,
        slug: uniqueSlug,
        owner_phone: phone ? phone.trim() : null,
        telnyx_phone_number: null,
        phone_provisioning_status: 'pending_number',
        is_missed_call_active: true,
        is_review_engine_active: true,
      })

    if (orgError) {
      return NextResponse.json({ error: orgError.message || 'Failed to create organization.' }, { status: 500 })
    }

    // If an explicit dedicated phone number was requested during onboarding, provision it safely
    if (requestedNumber) {
      await provisionOrganizationPhoneNumber(dbClient, {
        orgId,
        preferredNumberOrAreaCode: requestedNumber
      }).catch(err => {
        console.warn('[ONBOARDING] Phone provisioning warning:', err?.message)
      })
    }

    // 2. Link Authoritative User Profile
    const { error: profileError } = await dbClient
      .from('profiles')
      .upsert({
        id: user.id,
        org_id: orgId,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || businessName,
        phone: phone ? phone.trim() : null,
        role: 'owner',
      })

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // 3. Create Automation Settings
    try {
      await dbClient
        .from('automation_settings')
        .insert({
          org_id: orgId,
          module_key: 'missed_call_recovery',
          is_enabled: true,
          config: {
            cooldown_hours: 24,
            min_call_duration_seconds: 3,
          }
        })
    } catch {
      // Automation settings default init failure is non-fatal for tenant creation
    }

    // Requirement 10: Audit Logging
    await logAuditEvent(dbClient, {
      org_id: orgId,
      event_type: 'security.login',
      description: `Organization '${businessName}' created by ${user.email}`,
      metadata: {
        actor_id: user.id,
        org_id: orgId,
        action: 'tenant_onboarded',
        slug: uniqueSlug
      }
    }).catch(() => null)

    return NextResponse.json({ success: true, org_id: orgId })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal server error.' }, { status: 500 })
  }
}
