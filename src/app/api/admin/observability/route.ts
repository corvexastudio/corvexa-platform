import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { telemetryStore } from '@/lib/observability/telemetry-store'
import { getRecentStructuredLogs } from '@/lib/observability/logger'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const level = searchParams.get('level') || undefined
    const organization_id = searchParams.get('organization_id') || undefined
    const request_id = searchParams.get('request_id') || undefined
    const query = searchParams.get('query') || undefined
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 50

    // Retrieve unified observability dashboard data
    const dashboard = await telemetryStore.getDashboardData(tenantResult.supabase)

    // Apply log query filters if provided
    if (level || organization_id || request_id || query || limitParam) {
      dashboard.recentLogs = getRecentStructuredLogs({
        level,
        organization_id,
        request_id,
        query,
        limit
      })
    }

    return NextResponse.json({
      success: true,
      data: dashboard
    })
  } catch (err: any) {
    console.error('[Admin Observability API GET Error]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to retrieve observability telemetry' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('admin:all')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const action = body.action || 'snapshot'

    if (action === 'snapshot') {
      const dashboard = await telemetryStore.getDashboardData(tenantResult.supabase)
      
      const { data: snapshot, error: snapshotError } = await tenantResult.supabase
        .from('telemetry_snapshots')
        .insert({
          window_type: body.window_type || 'hourly',
          api_metrics: dashboard.api,
          webhook_metrics: dashboard.webhooks,
          job_metrics: dashboard.jobs,
          messaging_metrics: dashboard.messaging,
          automation_metrics: dashboard.automation,
          active_error_states: dashboard.errorStates
        })
        .select('*')
        .single()

      if (snapshotError) {
        console.error('[Telemetry Snapshot Insert Error]', snapshotError)
        return NextResponse.json(
          { error: 'Failed to record telemetry snapshot', details: snapshotError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Telemetry snapshot captured successfully',
        snapshot
      })
    }

    if (action === 'reset') {
      telemetryStore.reset()
      return NextResponse.json({
        success: true,
        message: 'Telemetry store in-memory metrics reset'
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (err: any) {
    console.error('[Admin Observability API POST Error]', err)
    return NextResponse.json(
      { error: err.message || 'Failed to process observability action' },
      { status: 500 }
    )
  }
}
