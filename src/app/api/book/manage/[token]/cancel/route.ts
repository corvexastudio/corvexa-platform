import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { customerCancelBooking } from '@/lib/booking/booking-manager'

export async function POST(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params

    if (!token) {
      return NextResponse.json({ error: 'Missing management token' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const reason = body.reason?.trim() || 'Cancelled by customer'

    const supabase = createAdminClient()

    const result = await customerCancelBooking(supabase, token, reason)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to cancel appointment' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment successfully cancelled',
      appointment: result.appointment
    })
  } catch (err: any) {
    console.error('[BOOKING_CANCEL_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
