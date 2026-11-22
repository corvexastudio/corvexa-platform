import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileOverdueInvoices } from '@/lib/payments/invoice-manager'
import { createHash, timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Constant-time secret comparison with SHA-256 digest normalization.
 * Prevents timing attacks and length leakage.
 */
function safeCompareSecrets(provided: string, expected: string): boolean {
  try {
    if (!provided || !expected) return false
    const hashProvided = createHash('sha256').update(provided, 'utf8').digest()
    const hashExpected = createHash('sha256').update(expected, 'utf8').digest()
    return timingSafeEqual(hashProvided, hashExpected)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const configuredCronSecret = process.env.CRON_SECRET

  if (!configuredCronSecret || configuredCronSecret.trim().length === 0) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured in runtime environment' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization') || ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const xCronHeader = request.headers.get('x-cron-secret')?.trim() || ''
  const providedSecret = bearerToken || xCronHeader

  if (!providedSecret || !safeCompareSecrets(providedSecret, configuredCronSecret)) {
    return NextResponse.json(
      { error: 'Unauthorized invocation of invoices-overdue cron' },
      { status: 401 }
    )
  }

  try {
    const supabase = createAdminClient()
    const result = await reconcileOverdueInvoices(supabase)

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      checked: result.checked,
      updated: result.updated,
      invoiceIds: result.invoiceIds
    })
  } catch (error: any) {
    console.error('[CRON_INVOICES_OVERDUE_ERROR]', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to reconcile overdue invoices' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  return POST(request)
}
