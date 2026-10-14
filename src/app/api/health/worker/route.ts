import { NextResponse } from 'next/server.js'
import { createAdminClient } from '../../../../lib/supabase/admin.ts'
import { checkWorkerHealth } from '../../../../lib/automations/worker-health.ts'

export const dynamic = 'force-dynamic'

/**
 * Public Worker Health & Backlog Endpoint (P1-OBS-01)
 * Returns worker backlog and delay metrics.
 * Strictly sanitizes internal tenant IDs and PII.
 */
export interface WorkerHealthRouteDependencies {
  customSupabase?: any
}

export async function GET(
  request?: Request,
  contextOrDeps?: any,
  deps?: WorkerHealthRouteDependencies
) {
  const actualDeps: WorkerHealthRouteDependencies | undefined =
    deps || (contextOrDeps && typeof contextOrDeps === 'object' && 'customSupabase' in contextOrDeps ? contextOrDeps : undefined)

  try {
    const supabase = actualDeps?.customSupabase || createAdminClient()

    const url = request?.url ? new URL(request.url) : new URL('http://localhost:3000/api/health/worker')
    const degradedThresholdSeconds = url.searchParams.get('degraded_seconds')
      ? parseInt(url.searchParams.get('degraded_seconds')!, 10)
      : undefined
    const unhealthyThresholdSeconds = url.searchParams.get('unhealthy_seconds')
      ? parseInt(url.searchParams.get('unhealthy_seconds')!, 10)
      : undefined

    const health = await checkWorkerHealth(supabase, {
      degradedThresholdSeconds,
      unhealthyThresholdSeconds
    })

    const httpStatus = health.status === 'unhealthy' ? 503 : 200

    // Strict tenant isolation: Sanitize tenant IDs from public payload
    const sanitizedMetrics = {
      ...health.metrics,
      oldestScheduledRun: health.metrics.oldestScheduledRun
        ? {
            id: health.metrics.oldestScheduledRun.id,
            actionType: health.metrics.oldestScheduledRun.actionType,
            scheduledAt: health.metrics.oldestScheduledRun.scheduledAt,
            expectedExecutionTime: health.metrics.oldestScheduledRun.expectedExecutionTime
          }
        : null
    }

    return NextResponse.json(
      {
        status: health.status,
        timestamp: health.timestamp,
        metrics: sanitizedMetrics,
        message: health.message
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Worker-Status': health.status,
          'X-Worker-Delay-Seconds': String(health.metrics.currentDelaySeconds)
        }
      }
    )
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Worker health check failed'
      },
      { status: 503 }
    )
  }
}
