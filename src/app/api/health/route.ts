import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateEnvironment } from '@/lib/config/env'
import { telemetryStore } from '@/lib/observability/telemetry-store'

export const dynamic = 'force-dynamic'

/**
 * Public Liveness Health Endpoint (HIGH-04)
 * Returns minimal operational status only.
 * Detailed internal metrics, configurations, and diagnostics are strictly
 * restricted to authenticated admin routes (/api/admin/system-health).
 */
export async function GET() {
  const envValidation = validateEnvironment()

  let dbStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  try {
    const supabase = createAdminClient()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    if (error) {
      dbStatus = 'degraded'
    }
  } catch (err: any) {
    dbStatus = 'unhealthy'
    console.error('[HEALTH_CHECK_DB_ERROR]', err?.message)
  }

  const apiSummary = telemetryStore.getApiSummary()
  const errorRate = apiSummary.errorRate

  const overallHealthy = dbStatus === 'healthy' && envValidation.ok && errorRate < 25
  const overallStatus = overallHealthy ? 'healthy' : (dbStatus === 'unhealthy' ? 'unhealthy' : 'degraded')

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString()
    },
    {
      status: overallStatus === 'unhealthy' ? 503 : 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Service-Status': overallStatus
      }
    }
  )
}

