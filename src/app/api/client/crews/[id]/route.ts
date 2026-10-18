import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { updateCrew, deleteCrew } from '@/lib/crews/crew-manager'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('crews:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id } = await params

  try {
    const body = await request.json()
    const result = await updateCrew(supabase, orgId, id, body)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update crew' }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Invalid request' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('crews:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { orgId, supabase } = tenantResult
  const { id } = await params

  try {
    const result = await deleteCrew(supabase, orgId, id)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to delete crew' }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Crew deactivated successfully' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to delete crew' }, { status: 500 })
  }
}
