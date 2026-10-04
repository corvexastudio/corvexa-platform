import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { ownerUpdateBookingStatus } from '@/lib/booking/booking-manager'

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
    const { status, reason } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing appointment id or status' }, { status: 400 })
    }

    if (!['confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
      return NextResponse.json({ error: 'Invalid appointment status' }, { status: 400 })
    }

    const result = await ownerUpdateBookingStatus(supabase, {
      appointmentId: id,
      orgId,
      newStatus: status,
      reason
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update appointment' }, { status: 400 })
    }

    return NextResponse.json({ success: true, appointment: result.appointment })
  } catch (err: any) {
    console.error('[OWNER_UPDATE_APPT_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
