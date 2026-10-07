import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { evaluateCustomerReactivation, computeLifecycleStatus } from '@/lib/retention/lifecycle-manager'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('contacts:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  // 1. Fetch contacts
  const { data: contacts, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('org_id', orgId)
    .order('last_service_date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const list = (contacts || []).map(c => {
    const computed = computeLifecycleStatus(c.last_service_date, c.service_frequency_days || 90)
    return {
      ...c,
      lifecycle_status: computed
    }
  })

  const counts = {
    active: list.filter(c => c.lifecycle_status === 'active').length,
    due: list.filter(c => c.lifecycle_status === 'due').length,
    overdue: list.filter(c => c.lifecycle_status === 'overdue').length,
    inactive: list.filter(c => c.lifecycle_status === 'inactive').length,
    total: list.length
  }

  const { data: orgSettings } = await supabase
    .from('organizations')
    .select(`
      reactivation_enabled,
      default_reactivation_interval_days,
      reactivation_cooldown_days,
      reactivation_template,
      reactivation_quiet_hours,
      reactivation_max_daily
    `)
    .eq('id', orgId)
    .maybeSingle()

  return NextResponse.json({
    counts,
    contacts: list,
    settings: orgSettings || {
      reactivation_enabled: true,
      default_reactivation_interval_days: 90,
      reactivation_cooldown_days: 30,
      reactivation_template: "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
      reactivation_quiet_hours: true,
      reactivation_max_daily: 50
    }
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('contacts:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.captodesk.com'

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    // Body optional
  }

  const result = await evaluateCustomerReactivation(supabase, {
    orgId,
    baseUrl,
    customMessage: body.customMessage
  })

  return NextResponse.json(result)
}

export async function PUT(request: Request) {
  const tenantResult = await getTenantContext('org:update')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const body = await request.json()

  // Validate incoming configuration
  const updates: Record<string, any> = {}

  if (typeof body.reactivation_enabled === 'boolean') {
    updates.reactivation_enabled = body.reactivation_enabled
  }

  if (body.default_reactivation_interval_days !== undefined) {
    const interval = parseInt(body.default_reactivation_interval_days, 10)
    if (isNaN(interval) || interval < 14 || interval > 730) {
      return NextResponse.json(
        { error: 'Reactivation interval must be between 14 and 730 days.' },
        { status: 400 }
      )
    }
    updates.default_reactivation_interval_days = interval
  }

  if (body.reactivation_cooldown_days !== undefined) {
    const cooldown = parseInt(body.reactivation_cooldown_days, 10)
    if (isNaN(cooldown) || cooldown < 7 || cooldown > 365) {
      return NextResponse.json(
        { error: 'Reactivation cooldown must be between 7 and 365 days.' },
        { status: 400 }
      )
    }
    updates.reactivation_cooldown_days = cooldown
  }

  if (body.reactivation_template !== undefined) {
    const template = String(body.reactivation_template).trim()
    if (!template || template.length > 500) {
      return NextResponse.json(
        { error: 'Reactivation template must be between 1 and 500 characters.' },
        { status: 400 }
      )
    }
    updates.reactivation_template = template
  }

  if (typeof body.reactivation_quiet_hours === 'boolean') {
    updates.reactivation_quiet_hours = body.reactivation_quiet_hours
  }

  if (body.reactivation_max_daily !== undefined) {
    const maxDaily = parseInt(body.reactivation_max_daily, 10)
    if (isNaN(maxDaily) || maxDaily < 1 || maxDaily > 200) {
      return NextResponse.json(
        { error: 'Maximum daily dispatch limit must be between 1 and 200.' },
        { status: 400 }
      )
    }
    updates.reactivation_max_daily = maxDaily
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid reactivation settings provided.' }, { status: 400 })
  }

  const { data: updatedOrg, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', orgId)
    .select(`
      reactivation_enabled,
      default_reactivation_interval_days,
      reactivation_cooldown_days,
      reactivation_template,
      reactivation_quiet_hours,
      reactivation_max_daily
    `)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    message: 'Customer reactivation settings updated successfully.',
    settings: updatedOrg
  })
}

