import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { getCustomerProfile360 } from '@/lib/crm/customer-manager'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const tenantResult = await getTenantContext('contacts:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult

  const result = await getCustomerProfile360(supabase, {
    orgId,
    contactId: id
  })

  if (!result.success || !result.profile) {
    return NextResponse.json({ error: result.error || 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json(result.profile)
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params
  const tenantResult = await getTenantContext('contacts:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const body = await request.json()

  const allowedUpdates: Record<string, any> = {
    updated_at: new Date().toISOString()
  }

  if (typeof body.name === 'string') allowedUpdates.name = body.name.trim()
  if (typeof body.phone === 'string') allowedUpdates.phone = body.phone.trim()
  if (typeof body.email === 'string') allowedUpdates.email = body.email.trim()
  if (typeof body.address === 'string') allowedUpdates.address = body.address.trim()
  if (typeof body.notes === 'string') allowedUpdates.notes = body.notes.trim()
  if (Array.isArray(body.tags)) allowedUpdates.tags = body.tags
  if (typeof body.serviceFrequencyDays === 'number') {
    allowedUpdates.service_frequency_days = Math.max(7, body.serviceFrequencyDays)
  }

  const { data: updatedContact, error } = await supabase
    .from('contacts')
    .update(allowedUpdates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, contact: updatedContact })
}
