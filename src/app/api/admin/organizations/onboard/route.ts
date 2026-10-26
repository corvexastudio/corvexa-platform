import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { adminOnboardTenant, AdminOnboardInput } from '@/lib/admin/white-glove-onboarding'
import { getAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const body: AdminOnboardInput = await request.json()
    const { origin } = new URL(request.url)

    let adminAuthClient: any = null
    try {
      const adminClient = getAdminClient()
      adminAuthClient = adminClient.auth.admin
    } catch {
      // Offline / fallback if service role key is omitted
    }

    const result = await adminOnboardTenant(
      tenantResult.supabase,
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
