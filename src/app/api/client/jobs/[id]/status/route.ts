import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { updateJobStatus, type JobStatus } from '@/lib/jobs/job-manager'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const { id } = await props.params
    const body = await request.json()
    const { status, notifyCustomer, notes } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing job id or status' }, { status: 400 })
    }

    const validStatuses: JobStatus[] = ['scheduled', 'confirmed', 'en_route', 'in_progress', 'completed', 'cancelled', 'no_show']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid job status' }, { status: 400 })
    }

    const result = await updateJobStatus(supabase, {
      jobId: id,
      orgId,
      newStatus: status,
      notifyCustomer: !!notifyCustomer,
      notes
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update job status' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[CLIENT_UPDATE_JOB_STATUS_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
