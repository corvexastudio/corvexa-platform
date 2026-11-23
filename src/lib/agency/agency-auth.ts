import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AgencyContextResult {
  ok: boolean
  user?: any
  agency?: any
  isSuperAdmin?: boolean
  error?: string
  status?: number
  response?: NextResponse
}

/**
 * Enforces authenticated user session and partner agency ownership.
 * Blocks unauthenticated callers and prevents IDOR cross-agency access.
 */
export async function getAgencyContext(
  requestedAgencySlugOrId?: string | null
): Promise<AgencyContextResult> {
  let user: any = null

  try {
    const supabase = await createClient()
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (!authErr && authData?.user) {
      user = authData.user
    }
  } catch (err) {
    console.warn('[AGENCY AUTH] Failed to retrieve session:', err)
  }

  if (!user) {
    return {
      ok: false,
      error: 'Unauthorized: Authentication required',
      status: 401,
      response: NextResponse.json(
        { error: 'Unauthorized: You must be signed in to access the agency workspace.' },
        { status: 401 }
      )
    }
  }

  const adminSupabase = createAdminClient()

  // Verify super admin status
  const userEmail = (user.email || '').toLowerCase()
  const defaultSuperEmails = [
    'corvexastudio@gmail.com',
    'shanta@corvexastudio.com',
    'shanta@captodesk.com',
    'admin@captodesk.com',
    'shanta.mondal11@gmail.com'
  ]
  const envSuperEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  const configuredSuperEmails = envSuperEmails.length > 0 ? envSuperEmails : defaultSuperEmails
  const isSuperAdmin = configuredSuperEmails.includes(userEmail)

  // 1. Look up agency strictly by immutable primary_owner_id
  let { data: ownedAgency } = await adminSupabase
    .from('partner_agencies')
    .select('*')
    .eq('primary_owner_id', user.id)
    .maybeSingle()

  // 2. Fallback: Only check contact_email if primary_owner_id is not yet set (unclaimed pre-seeded agency)
  // Requires email to be verified to prevent unverified email spoofing/takeovers
  if (!ownedAgency && user.email) {
    const isEmailVerified = Boolean(
      user.email_confirmed_at || 
      user.confirmed_at ||
      user.app_metadata?.provider === 'google' ||
      user.user_metadata?.email_verified === true
    )

    if (isEmailVerified) {
      const { data: unclaimedAgency } = await adminSupabase
        .from('partner_agencies')
        .select('*')
        .eq('contact_email', user.email.toLowerCase())
        .is('primary_owner_id', null)
        .maybeSingle()

      if (unclaimedAgency) {
        // Securely bind primary_owner_id to the verified authenticated user
        const { data: claimedAgency, error: claimErr } = await adminSupabase
          .from('partner_agencies')
          .update({
            primary_owner_id: user.id,
            updated_at: new Date().toISOString()
          })
          .eq('id', unclaimedAgency.id)
          .select('*')
          .single()

        if (!claimErr && claimedAgency) {
          ownedAgency = claimedAgency
        }
      }
    }
  }

  // Handle explicit requested agency identifier
  if (requestedAgencySlugOrId && requestedAgencySlugOrId !== 'default' && requestedAgencySlugOrId !== 'agency-partner') {
    if (isSuperAdmin) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedAgencySlugOrId)
      const { data: targetAgency } = await adminSupabase
        .from('partner_agencies')
        .select('*')
        .eq(isUuid ? 'id' : 'slug', requestedAgencySlugOrId)
        .maybeSingle()

      if (targetAgency) {
        return { ok: true, user, agency: targetAgency, isSuperAdmin: true }
      }
    }

    // Non-super-admins cannot view or mutate other agencies
    if (ownedAgency) {
      const isMatch = ownedAgency.id === requestedAgencySlugOrId || ownedAgency.slug === requestedAgencySlugOrId
      if (!isMatch) {
        return {
          ok: false,
          error: 'Forbidden: You do not have permission to access this agency workspace.',
          status: 403,
          response: NextResponse.json(
            { error: 'Forbidden: You do not have permission to access this agency workspace.' },
            { status: 403 }
          )
        }
      }
    }
  }

  // First-time agency partner sign-up: provision partner agency
  if (!ownedAgency) {
    const emailPrefix = user.email ? user.email.split('@')[0] : 'agency'
    const cleanName = user.user_metadata?.full_name
      ? `${user.user_metadata.full_name} Agency`
      : `${emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)} Agency`
    const baseSlug = `${emailPrefix}-agency`.toLowerCase().replace(/[^a-z0-9-]/g, '')
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

    const { data: newAgency, error: createErr } = await adminSupabase
      .from('partner_agencies')
      .insert({
        name: cleanName,
        slug: uniqueSlug,
        contact_email: user.email || 'partner@agency.com',
        primary_owner_id: user.id,
        total_slots: 0,
        subscription_tier: 'none',
        subscription_status: 'pending_subscription'
      })
      .select('*')
      .single()

    if (!createErr && newAgency) {
      ownedAgency = newAgency
    }
  }

  if (!ownedAgency) {
    return {
      ok: false,
      error: 'Agency workspace not found',
      status: 404,
      response: NextResponse.json(
        { error: 'Agency workspace not found' },
        { status: 404 }
      )
    }
  }

  return { ok: true, user, agency: ownedAgency, isSuperAdmin }
}
