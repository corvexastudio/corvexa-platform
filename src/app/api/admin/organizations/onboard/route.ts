import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { adminOnboardTenant, AdminOnboardInput } from '@/lib/admin/white-glove-onboarding'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const adminKey = request.headers.get('x-admin-key')
  const validServiceKey = process.env.ADMIN_API_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

  let supabase: any
  let adminAuthClient: any = null

  if (adminKey && validServiceKey && adminKey === validServiceKey) {
    try {
      const adminClient = getAdminClient()
      supabase = adminClient
      adminAuthClient = adminClient.auth.admin
    } catch {
      // Offline fallback
    }
  } else {
    const tenantResult = await getTenantContext('admin:all')
    if (!tenantResult.ok) {
      return tenantResult.response
    }
    supabase = tenantResult.supabase
    try {
      const adminClient = getAdminClient()
      adminAuthClient = adminClient.auth.admin
    } catch {
      // Offline fallback
    }
  }

  try {
    const body: AdminOnboardInput = await request.json()
    const { origin } = new URL(request.url)

    const result = await adminOnboardTenant(
      supabase,
      body,
      { baseUrl: origin, adminAuthClient }
    )

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[Admin White-Glove Onboard API Error]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to onboard tenant organization' },
      { status: 400 }
    )
  }
}
