import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import { deleteJobPhoto } from '@/lib/jobs/photo-manager'

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string; photoId: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { photoId } = await props.params
  const { orgId, supabase } = tenantResult

  const result = await deleteJobPhoto(supabase, photoId, orgId)
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true })
}
