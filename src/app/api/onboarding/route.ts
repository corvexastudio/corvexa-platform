import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

import { checkRateLimitAsync, RATE_LIMITS, getRateLimitHeaders, extractClientIp } from '@/lib/security/rate-limiter'
import { logAuditEvent } from '@/lib/security/audit-logger'
import { provisionOrganizationPhoneNumber } from '@/lib/telephony/provisioning'

export async function POST(request: NextRequest) {
  // Requirement 9 & HIGH-05: Distributed Rate limit public onboarding requests per IP
  const clientIp = extractClientIp(request)
  const rateLimit = await checkRateLimitAsync(`onboard:ip:${clientIp}`, RATE_LIMITS.ONBOARDING)
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

    let user = (await supabase.auth.getUser()).data.user
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null

    if (!user && bearerToken) {
      const { createClient } = await import('@supabase/supabase-js')
      const tokenClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } }
      )
      const tokenUserRes = await tokenClient.auth.getUser(bearerToken)
      if (tokenUserRes.data?.user) {
        user = tokenUserRes.data.user
      }
    }

    if (!user) {
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
    let adminAvailable = false
    try {
      const { createAdminClient } = await import('@/lib/supabase/admin')
      const adminClient = createAdminClient()
      const { error: testErr } = await adminClient.from('organizations').select('id').limit(1)
      if (!testErr) {
        dbClient = adminClient
        adminAvailable = true
      }
    } catch {
      adminAvailable = false
    }

    if (!adminAvailable && bearerToken) {
      const { createClient } = await import('@supabase/supabase-js')
      dbClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
          auth: { persistSession: false }
        }
      )
    }

    // Generate deterministic UUID and unique slug
    const orgId = crypto.randomUUID()
    const baseSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company'
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 7)}`

    const requestedNumber = body.requestedNumber || body.telnyxPhoneNumber || null

    // Format phone numbers to satisfy potential NOT NULL or UNIQUE constraints on organizations.phone_number
    const rawPhone = typeof phone === 'string' ? phone.trim() : ''
    const cleanDigits = rawPhone.replace(/\D/g, '')
    const randomSuffix = Math.floor(1000000 + Math.random() * 9000000).toString()
    const fallbackPhone = cleanDigits.length >= 10
      ? (cleanDigits.length === 10 ? `+1${cleanDigits}` : `+${cleanDigits}`)
      : `+1999${randomSuffix}`

    const baseOrgPayload: Record<string, any> = {
      id: orgId,
      name: businessName,
      slug: uniqueSlug,
      owner_phone: rawPhone || fallbackPhone,
      telnyx_phone_number: requestedNumber || null,
      phone_provisioning_status: requestedNumber ? 'provisioning' : 'pending_number',
      is_missed_call_active: true,
      is_review_engine_active: true,
    }

    // 1. Create Organization with pre-generated UUID (satisfies PostgreSQL NOT NULL constraint on phone_number)
    let { error: orgError } = await dbClient
      .from('organizations')
      .insert({
        ...baseOrgPayload,
        phone_number: fallbackPhone,
      })

    // Fallback A: If column "phone_number" does not exist in schema (error 42703), retry without it
    if (
      orgError &&
      (orgError.code === '42703' ||
        (orgError.message?.toLowerCase().includes('phone_number') &&
          orgError.message?.toLowerCase().includes('does not exist')))
    ) {
      const retryRes = await dbClient.from('organizations').insert(baseOrgPayload)
      orgError = retryRes.error
    }

    // Fallback B: If phone_number had a unique constraint violation (code 23505), retry with a random unique phone
    if (orgError && orgError.code === '23505' && orgError.message?.toLowerCase().includes('phone_number')) {
      const freshRandom = `+1999${Math.floor(1000000 + Math.random() * 9000000)}`
      const retryRes = await dbClient
        .from('organizations')
        .insert({
          ...baseOrgPayload,
          phone_number: freshRandom,
        })
      orgError = retryRes.error
    }

    if (orgError) {
      console.error('[ONBOARDING] Failed to create organization:', orgError)
      return NextResponse.json(
        { error: orgError.message || 'Failed to create organization.' },
        { status: 500 }
      )
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
    let { error: profileError } = await dbClient
      .from('profiles')
      .upsert({
        id: user.id,
        org_id: orgId,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || businessName,
        phone: rawPhone || fallbackPhone,
        role: 'owner',
      })

    // If "phone" column does not exist on profiles (error 42703), retry upsert without phone
    if (
      profileError &&
      (profileError.code === '42703' ||
        (profileError.message?.toLowerCase().includes('phone') &&
          profileError.message?.toLowerCase().includes('does not exist')))
    ) {
      const retryProfile = await dbClient
        .from('profiles')
        .upsert({
          id: user.id,
          org_id: orgId,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || businessName,
          role: 'owner',
        })
      profileError = retryProfile.error
    }

    if (profileError) {
      console.error('[ONBOARDING] Failed to link profile:', profileError)
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
