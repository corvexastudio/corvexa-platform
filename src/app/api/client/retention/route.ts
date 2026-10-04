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

  return NextResponse.json({
    counts,
    contacts: list
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('contacts:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.captodesk.com'

  const result = await evaluateCustomerReactivation(supabase, {
    orgId,
    baseUrl
  })

  return NextResponse.json(result)
}
