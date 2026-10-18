import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { reassignJobCrew, reassignAppointmentCrew, checkCrewConflict } from '@/lib/crews/crew-manager'

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const {
      jobId,
      appointmentId,
      crewId,
      notifyCrew = true,
      notifyCustomer = false,
      checkConflictOnly = false,
      startTime,
      endTime
    } = body

    if (checkConflictOnly && crewId && startTime) {
      const conflict = await checkCrewConflict(supabase, {
        orgId,
        crewId,
        startTime,
        endTime,
        excludeJobId: jobId,
        excludeAppointmentId: appointmentId
      })
      return NextResponse.json(conflict)
    }

    if (jobId) {
      const result = await reassignJobCrew(supabase, {
        orgId,
        jobId,
        crewId: crewId || null,
        notifyCrew,
        notifyCustomer
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to reassign job' }, { status: 400 })
      }

      return NextResponse.json(result)
    }

    if (appointmentId) {
      const result = await reassignAppointmentCrew(supabase, {
        orgId,
        appointmentId,
        crewId: crewId || null,
        notifyCrew
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Failed to reassign appointment' }, { status: 400 })
      }

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'jobId or appointmentId is required' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to process reassignment' }, { status: 500 })
  }
}
