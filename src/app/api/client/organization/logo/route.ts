import { NextResponse } from 'next/server.js'
import { getTenantContext } from '../../../../../lib/security/tenant-context.ts'
import { logAuditEvent } from '../../../../../lib/security/audit-logger.ts'

export const dynamic = 'force-dynamic'

const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
  'image/gif'
]

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  try {
    const tenantResult = await getTenantContext('org:update')
    if (!tenantResult.ok) {
      return tenantResult.response
    }

    const { orgId, supabase, user } = tenantResult

    const contentTypeHeader = request.headers.get('content-type') || ''
    let fileBuffer: Buffer | null = null
    let mimeType = 'image/png'
    let fileExtension = 'png'

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: PNG, JPG, WebP, SVG, GIF.` },
          { status: 400 }
        )
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: 'File size exceeds 5MB limit. Please upload a smaller image.' },
          { status: 400 }
        )
      }

      mimeType = file.type.toLowerCase()
      const arrayBuffer = await file.arrayBuffer()
      fileBuffer = Buffer.from(arrayBuffer)

      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') fileExtension = 'jpg'
      else if (mimeType === 'image/webp') fileExtension = 'webp'
      else if (mimeType === 'image/svg+xml') fileExtension = 'svg'
      else if (mimeType === 'image/gif') fileExtension = 'gif'
    } else {
      // JSON base64 support
      const body = await request.json().catch(() => ({}))
      const dataUrl = body?.dataUrl || body?.logo_url

      if (!dataUrl || typeof dataUrl !== 'string') {
        return NextResponse.json({ error: 'Missing file or dataUrl' }, { status: 400 })
      }

      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1].toLowerCase()
        if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
          return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 })
        }
        fileBuffer = Buffer.from(match[2], 'base64')
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) fileExtension = 'jpg'
        else if (mimeType.includes('webp')) fileExtension = 'webp'
        else if (mimeType.includes('svg')) fileExtension = 'svg'
      } else if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
        // Direct remote URL assignment
        const { error: dbErr } = await supabase
          .from('organizations')
          .update({ logo_url: dataUrl.trim(), updated_at: new Date().toISOString() })
          .eq('id', orgId)

        if (dbErr) {
          return NextResponse.json({ error: dbErr.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, logo_url: dataUrl.trim() })
      } else {
        return NextResponse.json({ error: 'Invalid image format provided' }, { status: 400 })
      }
    }

    if (!fileBuffer) {
      return NextResponse.json({ error: 'Failed to process file buffer' }, { status: 400 })
    }

    const bucketName = 'organization-logos'
    const storagePath = `${orgId}/logo-${Date.now()}.${fileExtension}`
    let publicUrl: string | null = null

    // 1. Try uploading to Supabase Storage bucket
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true
      })

    if (uploadError) {
      // If bucket does not exist, try to create it as public
      if (
        uploadError.message?.toLowerCase().includes('not found') ||
        uploadError.message?.toLowerCase().includes('bucket')
      ) {
        await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {})
        const retry = await supabase.storage.from(bucketName).upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: true
        })

        if (!retry.error) {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
          publicUrl = urlData.publicUrl
        }
      }
    } else {
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
      publicUrl = urlData.publicUrl
    }

    // Fallback: If storage bucket upload failed, embed as lightweight data URI if < 1.5MB
    if (!publicUrl) {
      if (fileBuffer.length <= 1.5 * 1024 * 1024) {
        publicUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`
      } else {
        return NextResponse.json(
          { error: uploadError?.message || 'Storage upload failed. Please try a smaller image file.' },
          { status: 500 }
        )
      }
    }

    // 2. Persist to organizations.logo_url
    const { error: updateErr } = await supabase
      .from('organizations')
      .update({
        logo_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)

    if (updateErr) {
      console.error('[LOGO_UPDATE_ERROR]', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'organization.settings_updated',
      description: `Organization logo updated by ${user.email || user.id}`,
      metadata: { actor_id: user.id, storage_path: storagePath, action: 'logo_updated' }
    })

    return NextResponse.json({
      success: true,
      logo_url: publicUrl
    })
  } catch (err: any) {
    console.error('[LOGO_UPLOAD_FATAL]', err)
    return NextResponse.json({ error: err.message || 'Unexpected error uploading logo' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const tenantResult = await getTenantContext('org:update')
    if (!tenantResult.ok) {
      return tenantResult.response
    }

    const { orgId, supabase, user } = tenantResult

    const { error: updateErr } = await supabase
      .from('organizations')
      .update({
        logo_url: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    await logAuditEvent(supabase, {
      org_id: orgId,
      event_type: 'organization.settings_updated',
      description: `Organization logo removed by ${user.email || user.id}`,
      metadata: { actor_id: user.id, action: 'logo_removed' }
    })

    return NextResponse.json({ success: true, logo_url: null })
  } catch (err: any) {
    console.error('[LOGO_DELETE_FATAL]', err)
    return NextResponse.json({ error: err.message || 'Unexpected error removing logo' }, { status: 500 })
  }
}
