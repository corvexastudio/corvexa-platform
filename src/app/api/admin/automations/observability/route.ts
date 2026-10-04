import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { listAutomationRunsObservability, inspectAutomationRun } from '@/lib/automations/observability'

export async function GET(request: Request) {
  // Enforce authentication & role check
  const tenant = await getTenantContext()
  if (!tenant.ok) {
    return tenant.response
  }

  const { searchParams } = new URL(request.url)
  const runId = searchParams.get('runId')
  const status = searchParams.get('status') || undefined
  const targetOrgId = tenant.isSuperAdmin ? searchParams.get('orgId') || undefined : tenant.orgId

  if (runId) {
    const inspection = await inspectAutomationRun(tenant.supabase, runId)
    if (!inspection) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    }
    // Tenant isolation check
    if (!tenant.isSuperAdmin && inspection.automation.tenantId !== tenant.orgId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }
    return NextResponse.json({ run: inspection })
  }

  const runs = await listAutomationRunsObservability(tenant.supabase, {
    orgId: targetOrgId,
    status,
    limit: 50
  })

  return NextResponse.json({
    total: runs.length,
    runs
  })
}
