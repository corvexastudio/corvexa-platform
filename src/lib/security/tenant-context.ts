import { NextResponse } from 'next/server.js'
import { normalizeRole, hasPermission, type CanonicalRole, type Action } from './permissions.ts'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export interface ProfileContext {
  id: string
  org_id: string
  full_name: string | null
  email: string | null
  role: CanonicalRole
}

export type TenantContextResult =
  | {
      ok: true
      user: User
      profile: ProfileContext
      orgId: string
      role: CanonicalRole
      isSuperAdmin: boolean
      supabase: SupabaseClient
    }
  | {
      ok: false
      error: string
      status: number
      response: NextResponse
    }

/**
 * Resolves the authenticated user and their tenant organization strictly server-side.
 * Never trusts client-supplied organization_id or role headers.
 */
export async function getTenantContext(
  requiredAction?: Action,
  customSupabase?: SupabaseClient
): Promise<TenantContextResult> {
  let supabase = customSupabase
  if (!supabase) {
    const { createClient } = await import('../supabase/server')
    supabase = await createClient()
  }

  let user = (await supabase.auth.getUser()).data?.user
  if (!user && !customSupabase) {
    try {
      const { headers } = await import('next/headers')
      const headerList = await headers()
      const authHeader = headerList.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        const { createClient: createRawClient } = await import('@supabase/supabase-js')
        const tokenClient = createRawClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false }
          }
        )
        const tokenUserRes = await tokenClient.auth.getUser(token)
        if (tokenUserRes.data?.user) {
          user = tokenUserRes.data.user
          supabase = tokenClient
        }
      }
    } catch {
      // Non-fatal
    }
  }

  if (!user) {
    return {
      ok: false,
      error: 'Unauthorized: Authentication required',
      status: 401,
      response: NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 })
    }
  }

  // Fetch the authoritative profile from the database
  const query = supabase
    .from('profiles')
    .select('id, org_id, full_name, email, role')
    .eq('id', user.id)

  const { data: profileData, error: profileError } = typeof (query as any).maybeSingle === 'function'
    ? await (query as any).maybeSingle()
    : await query.single()

  if (profileError || !profileData) {
    return {
      ok: false,
      error: 'Forbidden: User profile not registered',
      status: 403,
      response: NextResponse.json({ error: 'Forbidden: User profile not registered' }, { status: 403 })
    }
  }

  const role = normalizeRole(profileData.role)
  
  // SEC-02: Fail-Closed Super Admin Allowlist
  // In production, SUPER_ADMIN_EMAILS MUST be configured and contain the user's email.
  // Missing or empty allowlist in production fails closed (isSuperAdminEmail = false).
  // In dev/test, if SUPER_ADMIN_EMAILS is omitted, profile role is respected for local mock testing.
  const isProd = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production'
  const configuredSuperEmails = (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)

  const userEmail = (user.email || profileData.email || '').toLowerCase()
  const isSuperAdminEmail = isProd
    ? (configuredSuperEmails.length > 0 && userEmail.length > 0 && configuredSuperEmails.includes(userEmail))
    : (configuredSuperEmails.length > 0 ? configuredSuperEmails.includes(userEmail) : true)

  const effectiveRole: CanonicalRole = (role === 'super_admin' && !isSuperAdminEmail) ? 'owner' : role
  const isSuperAdmin = effectiveRole === 'super_admin'

  // If not super admin, an organization ID is mandatory
  if (!isSuperAdmin && !profileData.org_id) {
    return {
      ok: false,
      error: 'Forbidden: User is not linked to an organization',
      status: 403,
      response: NextResponse.json({ error: 'Forbidden: User is not linked to an organization' }, { status: 403 })
    }
  }

  // Check action-level authorization if an action was requested
  if (requiredAction && !hasPermission(effectiveRole, requiredAction)) {
    return {
      ok: false,
      error: `Forbidden: Role '${effectiveRole}' lacks permission for '${requiredAction}'`,
      status: 403,
      response: NextResponse.json(
        { error: `Forbidden: Role '${effectiveRole}' lacks permission for '${requiredAction}'` },
        { status: 403 }
      )
    }
  }

  return {
    ok: true,
    user,
    profile: {
      id: profileData.id,
      org_id: profileData.org_id,
      full_name: profileData.full_name,
      email: profileData.email,
      role
    },
    orgId: profileData.org_id,
    role,
    isSuperAdmin,
    supabase
  }
}

/**
 * Verifies that a specific database resource belongs to the tenant.
 * Prevents Insecure Direct Object Reference (IDOR) attacks.
 */
export async function verifyTenantResource<T = any>(
  supabase: SupabaseClient,
  table: string,
  resourceId: string,
  orgId: string,
  isSuperAdmin: boolean = false
): Promise<{ data: T | null; error?: string }> {
  let query = supabase.from(table).select('*').eq('id', resourceId)

  if (!isSuperAdmin) {
    query = query.eq('org_id', orgId)
  }

  const { data, error } = await query.single()

  if (error || !data) {
    return { data: null, error: `Resource not found or access denied in ${table}` }
  }

  return { data: data as T }
}
