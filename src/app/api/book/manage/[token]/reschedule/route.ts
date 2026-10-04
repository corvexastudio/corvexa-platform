import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { customerRescheduleBooking } from '@/lib/booking/booking-manager'

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
    const { newStartTime } = body

    if (!newStartTime) {
      return NextResponse.json({ error: 'Missing required parameter: newStartTime' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const result = await customerRescheduleBooking(supabase, token, newStartTime)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to reschedule appointment' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Appointment successfully rescheduled',
      appointment: result.appointment
    })
  } catch (err: any) {
    console.error('[BOOKING_RESCHEDULE_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
