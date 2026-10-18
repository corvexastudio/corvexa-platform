import { SupabaseClient } from '@supabase/supabase-js'

export type JobPhotoType = 'before' | 'after' | 'progress' | 'completion'

export interface JobPhotoRecord {
  id: string
  org_id: string
  job_id: string
  photo_type: JobPhotoType
  url: string
  caption?: string | null
  uploaded_by?: string | null
  created_at: string
}

export interface AddPhotoInput {
  orgId: string
  jobId: string
  photoType: JobPhotoType
  url: string
  caption?: string
  uploadedBy?: string
}

/**
 * Persists a photo record linked to a job.
 */
export async function addJobPhoto(
  supabase: SupabaseClient,
  input: AddPhotoInput
): Promise<{ success: boolean; photo?: JobPhotoRecord; error?: string }> {
  const { orgId, jobId, photoType, url, caption, uploadedBy } = input

  if (!url || !url.trim()) {
    return { success: false, error: 'Photo URL is required' }
  }

  const { data, error } = await supabase
    .from('job_photos')
    .insert({
      org_id: orgId,
      job_id: jobId,
      photo_type: photoType,
      url: url.trim(),
      caption: caption?.trim() || null,
      uploaded_by: uploadedBy || null
    })
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to add job photo' }
  }

  return { success: true, photo: data as JobPhotoRecord }
}

/**
 * Resolves a stored photo URL or storage path into an authorized URL.
 * If the path belongs to a private storage bucket, a short-lived signed URL (24h) is created.
 * Fallbacks cleanly for data URIs or external links.
 */
export async function getAuthorizedPhotoUrl(
  supabase: SupabaseClient,
  rawUrl: string,
  expiresInSeconds: number = 86400
): Promise<string> {
  if (!rawUrl || rawUrl.startsWith('data:')) {
    return rawUrl
  }

  try {
    // If it's already a relative storage path (e.g. orgId/jobId/filename.ext)
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      const { data, error } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(rawUrl, expiresInSeconds)
      if (!error && data?.signedUrl) {
        return data.signedUrl
      }
      return rawUrl
    }

    // If it's an existing full URL pointing to /job-photos/
    const match = rawUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/job-photos\/(.+?)(?:\?.*)?$/)
    if (match && match[1]) {
      const storagePath = decodeURIComponent(match[1])
      const { data, error } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(storagePath, expiresInSeconds)
      if (!error && data?.signedUrl) {
        return data.signedUrl
      }
    }
  } catch {
    // Graceful fallback to raw URL
  }

  return rawUrl
}

/**
 * Retrieves all photos for a given job, categorized by photo_type.
 * Resolves private storage paths to authorized signed URLs.
 */
export async function listJobPhotos(
  supabase: SupabaseClient,
  jobId: string
): Promise<{ success: boolean; photos: JobPhotoRecord[]; error?: string }> {
  const { data, error } = await supabase
    .from('job_photos')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  if (error) {
    return { success: false, photos: [], error: error.message }
  }

  const rawPhotos = (data as JobPhotoRecord[]) || []
  const photosWithSignedUrls = await Promise.all(
    rawPhotos.map(async (photo) => {
      const authorizedUrl = await getAuthorizedPhotoUrl(supabase, photo.url)
      return {
        ...photo,
        url: authorizedUrl
      }
    })
  )

  return { success: true, photos: photosWithSignedUrls }
}

/**
 * Deletes a photo record from a job and cleans up the underlying storage object.
 * Enforces DB authorization first before deleting the storage object.
 */
export async function deleteJobPhoto(
  supabase: SupabaseClient,
  photoId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Fetch photo to get storage path
  const { data: photo, error: fetchError } = await supabase
    .from('job_photos')
    .select('id, url, org_id')
    .eq('id', photoId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (fetchError || !photo) {
    return { success: false, error: 'Photo not found or inaccessible' }
  }

  // 2. Perform database deletion with RLS enforcement
  const { data: deleted, error } = await supabase
    .from('job_photos')
    .delete()
    .eq('id', photoId)
    .eq('org_id', orgId)
    .select('id')

  if (error) {
    return { success: false, error: error.message }
  }

  if (!deleted || (Array.isArray(deleted) && deleted.length === 0)) {
    return { success: false, error: 'Forbidden: Insufficient permissions to delete photo' }
  }

  // 3. Remove storage object only after successful database deletion
  if (photo.url && !photo.url.startsWith('data:')) {
    let storagePath = photo.url
    const match = photo.url.match(/\/storage\/v1\/object\/(?:public|sign)\/job-photos\/(.+?)(?:\?.*)?$/)
    if (match && match[1]) {
      storagePath = decodeURIComponent(match[1])
    }
    if (!storagePath.startsWith('http://') && !storagePath.startsWith('https://')) {
      await supabase.storage.from('job-photos').remove([storagePath]).catch(() => {})
    }
  }

  return { success: true }
}

/**
 * Updates a job photo's caption or metadata.
 * Enforces tenant boundary and role authorization via RLS.
 */
export async function updateJobPhotoCaption(
  supabase: SupabaseClient,
  photoId: string,
  orgId: string,
  caption: string
): Promise<{ success: boolean; photo?: JobPhotoRecord; error?: string }> {
  const { data, error } = await supabase
    .from('job_photos')
    .update({ caption: caption.trim() })
    .eq('id', photoId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to update photo caption' }
  }

  return { success: true, photo: data as JobPhotoRecord }
}

/**
 * Uploads a file buffer or base64 to Supabase Storage private bucket 'job-photos'
 * and records it in the database.
 */
export async function uploadJobPhotoFile(
  supabase: SupabaseClient,
  params: {
    orgId: string
    jobId: string
    photoType: JobPhotoType
    fileBuffer: Buffer | Uint8Array
    fileName: string
    contentType: string
    caption?: string
    uploadedBy?: string
  }
): Promise<{ success: boolean; photo?: JobPhotoRecord; error?: string }> {
  const { orgId, jobId, photoType, fileBuffer, fileName, contentType, caption, uploadedBy } = params
  const bucketName = 'job-photos'

  try {
    const fileExt = fileName.split('.').pop() || 'jpg'
    const safeName = `${photoType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${fileExt}`
    const storagePath = `${orgId}/${jobId}/${safeName}`

    // 1. Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, fileBuffer, {
        contentType,
        upsert: true
      })

    let photoUrl = storagePath

    if (uploadError) {
      // If bucket does not exist, create it as PRIVATE (public: false)
      if (uploadError.message?.toLowerCase().includes('not found') || uploadError.message?.toLowerCase().includes('bucket')) {
        await supabase.storage.createBucket(bucketName, { public: false }).catch(() => {})
        const retry = await supabase.storage.from(bucketName).upload(storagePath, fileBuffer, {
          contentType,
          upsert: true
        })
        if (retry.error) {
          // If storage bucket creation is restricted, fallback to data url for smaller images
          if (fileBuffer.byteLength < 2 * 1024 * 1024) {
            photoUrl = `data:${contentType};base64,${Buffer.from(fileBuffer).toString('base64')}`
          } else {
            return { success: false, error: `Storage upload failed: ${retry.error.message}` }
          }
        }
      } else {
        return { success: false, error: uploadError.message }
      }
    }

    // 2. Persist to job_photos table with private storage path
    const addResult = await addJobPhoto(supabase, {
      orgId,
      jobId,
      photoType,
      url: photoUrl,
      caption,
      uploadedBy
    })

    if (!addResult.success || !addResult.photo) {
      return addResult
    }

    // Resolve authorized URL for the immediate API response
    const authorizedUrl = await getAuthorizedPhotoUrl(supabase, addResult.photo.url)
    return {
      success: true,
      photo: {
        ...addResult.photo,
        url: authorizedUrl
      }
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload job photo' }
  }
}
