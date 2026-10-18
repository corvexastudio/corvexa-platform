import { NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/security/tenant-context'
import {
  listJobPhotos,
  addJobPhoto,
  uploadJobPhotoFile,
  type JobPhotoType
} from '@/lib/jobs/photo-manager'

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:read')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id: jobId } = await props.params
  const { orgId, supabase } = tenantResult

  // Ensure job belongs to tenant
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const result = await listJobPhotos(supabase, jobId)
  return NextResponse.json({ photos: result.photos })
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const tenantResult = await getTenantContext('appointments:manage')
  if (!tenantResult.ok) {
    return tenantResult.response
  }

  const { id: jobId } = await props.params
  const { orgId, supabase, profile } = tenantResult

  // Ensure job belongs to tenant
  const { data: job, error: jobErr } = await supabase
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (jobErr || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  const contentType = request.headers.get('content-type') || ''

  // 1. Multipart Form Data (Direct File Upload from Camera / File Picker)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      const photoType = (formData.get('photoType') as JobPhotoType) || 'before'
      const caption = (formData.get('caption') as string) || undefined

      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const result = await uploadJobPhotoFile(supabase, {
        orgId,
        jobId,
        photoType,
        fileBuffer: buffer,
        fileName: file.name || 'photo.jpg',
        contentType: file.type || 'image/jpeg',
        caption,
        uploadedBy: profile.id
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ success: true, photo: result.photo })
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to process file upload' }, { status: 500 })
    }
  }

  // 2. JSON Body (URL reference or base64 data)
  const body = await request.json().catch(() => ({}))
  const { photoType = 'before', url, caption } = body

  if (!url || !url.trim()) {
    return NextResponse.json({ error: 'Photo URL is required' }, { status: 400 })
  }

  const result = await addJobPhoto(supabase, {
    orgId,
    jobId,
    photoType,
    url: url.trim(),
    caption: caption?.trim() || undefined,
    uploadedBy: profile.id
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, photo: result.photo })
}
