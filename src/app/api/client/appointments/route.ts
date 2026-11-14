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
  const crewIdParam = searchParams.get('crew_id')

  let query = supabase
    .from('appointments')
    .select(`
      id, title, service_type, start_time, end_time, status, source, manage_token, notes, crew_id,
      contact:contacts(id, name, phone, address),
      service:services(id, name, duration_minutes, price),
      jobs:jobs(id, job_number, status, technician_name, eta_minutes)
    `)
    .eq('org_id', orgId)
    .order('start_time', { ascending: true })

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter)
  }

  if (crewIdParam) {
    if (crewIdParam === 'unassigned') {
      query = query.is('crew_id', null)
    } else {
      query = query.eq('crew_id', crewIdParam)
    }
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

    // Finish-Line Sunk Cost Paywall Guard: Scheduling Job #4+ requires Pro once 3 free starter jobs are completed
    const { SubscriptionService } = await import('@/lib/billing/subscription-service')
    const entitlement = await SubscriptionService.getEntitlement(supabase, orgId).catch(() => null)
    const isPaidPro = entitlement?.isEntitled && ['solo', 'multi_crew', 'fleet', 'captodesk_standard'].includes(entitlement?.planId || '')

    if (!isPaidPro) {
      const starterUsage = await SubscriptionService.getFreeTierJobUsage(supabase, orgId).catch(() => null)
      if (starterUsage?.isLimitReached) {
        return NextResponse.json(
          {
            success: false,
            upgradeRequired: true,
            code: 'STARTER_LIMIT_REACHED',
            error: "You've completed your 3 free starter jobs. Upgrade to Pro ($99/mo) to schedule and dispatch additional jobs.",
            checkoutUrl: '/client/billing?reason=starter_limit'
          },
          { status: 402 }
        )
      }
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
