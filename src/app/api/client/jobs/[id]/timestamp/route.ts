import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { recordJobTimestamp } from '@/lib/jobs/job-manager'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id } = await params

  try {
    const body = await request.json()
    const { action, notes } = body

    if (!['arrived', 'started', 'completed'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be one of: "arrived", "started", "completed"' },
        { status: 400 }
      )
    }

    const result = await recordJobTimestamp(supabase, {
      orgId,
      jobId: id,
      action,
      notes
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update job timestamp' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 500 })
  }
}
