import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { createBooking } from '@/lib/booking/booking-manager'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('appointments:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get('status')
  const dateParam = searchParams.get('date')

  let query = supabase
    .from('appointments')
    .select(`
      id, title, service_type, start_time, end_time, status, source, manage_token, notes,
      contact:contacts(id, name, phone, address),
      service:services(id, name, duration_minutes, price)
    `)
    .eq('org_id', orgId)
    .order('start_time', { ascending: true })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  if (dateParam) {
    const startOfDay = new Date(`${dateParam}T00:00:00.000Z`).toISOString()
    const endOfDay = new Date(`${dateParam}T23:59:59.999Z`).toISOString()
    query = query.gte('start_time', startOfDay).lte('start_time', endOfDay)
  }

  const { data: appointments, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ appointments: appointments || [] })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  try {
    const body = await request.json()
    const {
      serviceId,
      customerName,
      customerPhone,
      customerEmail,
      customerAddress,
      startTime,
      notes
    } = body

    if (!customerPhone || !startTime) {
      return NextResponse.json(
        { error: 'Customer phone number and start time are required.' },
        { status: 400 }
      )
    }

    const result = await createBooking(supabase, {
      orgId,
      serviceId: serviceId || undefined,
      customerName: customerName ? customerName.trim() : 'Customer',
      customerPhone: customerPhone.trim(),
      customerEmail: customerEmail ? customerEmail.trim() : undefined,
      customerAddress: customerAddress ? customerAddress.trim() : undefined,
      startTime,
      notes: notes ? notes.trim() : undefined,
      source: 'manual'
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to book appointment' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[CLIENT_CREATE_APPOINTMENT_ERROR]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
