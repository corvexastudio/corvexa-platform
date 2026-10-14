import { NextResponse } from 'next/server.js'
import { createAdminClient } from '../../../lib/supabase/admin.ts'
import { validateEnvironment } from '../../../lib/config/env.ts'
import { telemetryStore } from '../../../lib/observability/telemetry-store.ts'
import { alertManager } from '../../../lib/observability/alerts/alert-manager.ts'

export const dynamic = 'force-dynamic'

/**
 * Public Liveness Health Endpoint (P1-OBS-01)
 * Returns minimal operational status only for external uptime monitoring.
 * Strictly guarantees:
 * - Lightweight execution (single indexed query)
 * - Zero secrets, database credentials, or tenant info exposed
 * - Zero internal stack traces exposed
 * - Dispatches alerts safely if system becomes unhealthy
 */
export interface HealthRouteDependencies {
  customSupabase?: any
}

export async function GET(
  request?: Request,
  contextOrDeps?: any,
  deps?: HealthRouteDependencies
) {
  const actualDeps: HealthRouteDependencies | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)

  const envValidation = validateEnvironment()

  let dbStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  try {
    const supabase = actualDeps?.customSupabase || createAdminClient()
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

  // Alert on persistent application or database health failure
  if (overallStatus === 'unhealthy') {
    alertManager.sendAlert({
      category: dbStatus === 'unhealthy' ? 'database_connectivity_failure' : 'application_health_failure',
      severity: 'critical',
      dedupKey: 'application_health_failure',
      title: 'Application Health Probe Unhealthy',
      description: `Liveness probe failed: dbStatus=${dbStatus}, envValid=${envValidation.ok}, errorRate=${errorRate}%`
    }).catch(() => {})
  } else if (overallHealthy && alertManager.isAlertActive('application_health_failure')) {
    alertManager.sendRecovery('application_health_failure', {
      title: 'Application Health Probe Restored',
      description: 'Application health probe returned healthy status.'
    }).catch(() => {})
  }

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
