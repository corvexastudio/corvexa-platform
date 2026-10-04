import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { validateEnvironment } from '@/lib/config/env'
import { telemetryStore } from '@/lib/observability/telemetry-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = performance.now()
  const envValidation = validateEnvironment()

  // 1. Database Health Check
  let dbStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  let dbLatencyMs = 0
  let dbError: string | undefined

  try {
    const dbStart = performance.now()
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )

    const { error } = await supabase.from('organizations').select('id').limit(1)
    dbLatencyMs = Math.round(performance.now() - dbStart)

    if (error) {
      dbStatus = 'degraded'
      dbError = error.message
    }
  } catch (err: any) {
    dbStatus = 'unhealthy'
    dbError = err.message || 'Failed to connect to database'
  }

  // 2. Telemetry and Error Rate Check
  const apiSummary = telemetryStore.getApiSummary()
  const errorRate = apiSummary.errorRate

  // 3. Overall System Health Determination
  const overallHealthy = dbStatus === 'healthy' && envValidation.ok && errorRate < 25
  const overallStatus = overallHealthy ? 'healthy' : (dbStatus === 'unhealthy' ? 'unhealthy' : 'degraded')
  const totalDurationMs = Math.round(performance.now() - startTime)

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      durationMs: totalDurationMs,
      environment: envValidation.tier,
      checks: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          ...(dbError ? { error: dbError } : {})
        },
        configuration: {
          valid: envValidation.ok,
          errorsCount: envValidation.errors.length,
          warningsCount: envValidation.warnings.length
        },
        services: {
          telnyx: envValidation.config.hasTelnyxApiKey ? 'configured' : 'simulated',
          stripe: envValidation.config.stripeMode,
          cronProtection: envValidation.config.hasCronSecret ? 'active' : 'unprotected'
        },
        telemetry: {
          totalRequests: apiSummary.totalRequests,
          errorRatePercent: errorRate,
          avgLatencyMs: apiSummary.avgLatencyMs,
          p95LatencyMs: apiSummary.p95LatencyMs
        }
      }
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
