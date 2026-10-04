import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { runPlatformDiagnostic } from '@/lib/admin/admin-service'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const body = await request.json()
    const { diagnosticType, params } = body

    if (!diagnosticType) {
      return NextResponse.json({ error: 'diagnosticType is required' }, { status: 400 })
    }

    const result = await runPlatformDiagnostic(tenantResult.supabase, diagnosticType, params)
    return NextResponse.json({
      success: true,
      result
    })
  } catch (err: any) {
    console.error('[Admin Diagnostics API Error]', err)
    return NextResponse.json({ error: err.message || 'Diagnostic execution failed' }, { status: 500 })
  }
}
