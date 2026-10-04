import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { searchAndFilterCustomers } from '@/lib/crm/customer-manager'
import { toE164 } from '@/lib/telnyx'

export async function GET(request: Request) {
  const tenantResult = await getTenantContext('contacts:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const url = new URL(request.url)
  const query = url.searchParams.get('query') || undefined
  const status = (url.searchParams.get('status') as any) || 'all'
  const tag = url.searchParams.get('tag') || undefined
  const sortBy = (url.searchParams.get('sortBy') as any) || 'last_activity'
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? parseInt(limitParam, 10) : undefined
  const cursor = url.searchParams.get('cursor') || undefined

  const result = await searchAndFilterCustomers(supabase, {
    orgId,
    query,
    status,
    tag,
    sortBy,
    limit,
    cursor
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // Summary counts
  const all = result.customers
  const counts = {
    total: result.totalCount || all.length,
    active: all.filter(c => c.lifecycle_status === 'active').length,
    due: all.filter(c => c.lifecycle_status === 'due').length,
    overdue: all.filter(c => c.lifecycle_status === 'overdue').length,
    inactive: all.filter(c => c.lifecycle_status === 'inactive').length,
    totalLtv: Math.round(all.reduce((sum, c) => sum + (Number(c.lifetime_value) || 0), 0) * 100) / 100
  }

  return NextResponse.json({
    counts,
    customers: result.customers,
    totalCount: result.totalCount,
    nextCursor: result.nextCursor || null,
    hasMore: Boolean(result.hasMore)
  })
}

export async function POST(request: Request) {
  const tenantResult = await getTenantContext('contacts:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const body = await request.json()

  if (!body.phone) {
    return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
  }

  const cleanPhone = toE164(body.phone)

  const { data: contact, error } = await supabase
    .from('contacts')
    .insert({
      org_id: orgId,
      name: body.name ? body.name.trim() : null,
      phone: cleanPhone,
      email: body.email ? body.email.trim() : null,
      address: body.address ? body.address.trim() : null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      notes: body.notes ? body.notes.trim() : null,
      service_frequency_days: body.serviceFrequencyDays || 90,
      lifecycle_status: 'active'
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, contact })
}
