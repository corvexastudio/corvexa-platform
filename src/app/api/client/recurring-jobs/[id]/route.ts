import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import {
  updateRecurringTemplate,
  deleteRecurringTemplate
} from '@/lib/jobs/recurring-manager'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await props.params
  const { orgId, supabase } = tenantResult
  const body = await request.json().catch(() => ({}))

  const result = await updateRecurringTemplate(supabase, id, orgId, body)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, template: result.template })
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id } = await props.params
  const { orgId, supabase } = tenantResult

  const result = await deleteRecurringTemplate(supabase, id, orgId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
