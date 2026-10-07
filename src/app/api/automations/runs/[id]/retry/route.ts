import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { logAuditEvent } from '@/lib/security/audit-logger'

/**
 * Automation Run Retry Endpoint:
 * Authoritatively verifies tenant ownership and retry eligibility,
 * prevents duplicate execution races, and resets the run to 'pending'.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext()
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, user, role, supabase } = tenantResult
  const { id: runId } = await params

  if (!runId) {
    return NextResponse.json({ error: 'Missing automation run ID' }, { status: 400 })
  }

  // 1. Verify Tenant Ownership (IDOR Prevention)
  const { data: run, error: fetchError } = await supabase
    .from('automation_runs')
    .select('*')
    .eq('id', runId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (fetchError || !run) {
    return NextResponse.json(
      { error: 'Automation run not found or does not belong to your organization.' },
      { status: 404 }
    )
  }

  // 2. Prevent Duplicate Execution & Check Retry Eligibility
  const activeStatuses = ['pending', 'scheduled', 'processing', 'running']
  if (activeStatuses.includes(run.status)) {
    return NextResponse.json(
      { error: `Automation run is currently active (${run.status}) and cannot be duplicate-retried.` },
      { status: 409 }
    )
  }

  if (run.status === 'success') {
    return NextResponse.json(
      { error: 'Successful automation runs cannot be retried.' },
      { status: 400 }
    )
  }

  if (run.status === 'cancelled') {
    return NextResponse.json(
      { error: 'Cancelled automation runs cannot be retried.' },
      { status: 400 }
    )
  }

  // Eligible statuses: 'failed', 'dead_letter'
  if (run.status !== 'failed' && run.status !== 'dead_letter') {
    return NextResponse.json(
      { error: `Automation run with status '${run.status}' is not eligible for retry.` },
      { status: 400 }
    )
  }

  const nowIso = new Date().toISOString()
  const currentRetries = Number(run.retry_count || 0)
  const newMaxRetries = Math.max(Number(run.max_retries || 3), currentRetries + 1)

  // 3. Atomically enqueue automation run for worker execution
  const { data: enqueuedRun, error: updateError } = await supabase
    .from('automation_runs')
    .update({
      status: 'pending',
      scheduled_at: nowIso,
      started_at: null,
      completed_at: null,
      locked_at: null,
      locked_by: null,
      failure_reason: null,
      max_retries: newMaxRetries,
      updated_at: nowIso
    })
    .eq('id', runId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (updateError || !enqueuedRun) {
    return NextResponse.json(
      { error: 'Failed to enqueue automation run for retry.' },
      { status: 500 }
    )
  }

  // 4. Audit Logging
  await logAuditEvent(supabase, {
    org_id: orgId,
    event_type: 'automation.run_retried',
    description: `User ${user.id} manually enqueued retry for automation run ${runId}`,
    metadata: {
      actor_id: user.id,
      actor_role: role,
      run_id: runId,
      previous_status: run.status,
      new_status: 'pending'
    }
  })

  return NextResponse.json({
    success: true,
    status: 'pending',
    message: 'Automation run queued for immediate retry.',
    run: enqueuedRun
  })
}
