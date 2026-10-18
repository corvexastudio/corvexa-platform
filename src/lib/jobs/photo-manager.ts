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
 * Retrieves all photos for a given job, categorized by photo_type.
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

  return { success: true, photos: (data as JobPhotoRecord[]) || [] }
}

/**
 * Deletes a photo record from a job.
 */
export async function deleteJobPhoto(
  supabase: SupabaseClient,
  photoId: string,
  orgId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('job_photos')
    .delete()
    .eq('id', photoId)
    .eq('org_id', orgId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Uploads a file buffer or base64 to Supabase Storage bucket 'job-photos'
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

    let publicUrl = ''

    if (uploadError) {
      // If bucket does not exist, try to create it or handle gracefully
      if (uploadError.message?.toLowerCase().includes('not found') || uploadError.message?.toLowerCase().includes('bucket')) {
        await supabase.storage.createBucket(bucketName, { public: true }).catch(() => {})
        const retry = await supabase.storage.from(bucketName).upload(storagePath, fileBuffer, {
          contentType,
          upsert: true
        })
        if (retry.error) {
          // If storage bucket creation is restricted, fallback to data url for smaller images
          if (fileBuffer.byteLength < 2 * 1024 * 1024) {
            publicUrl = `data:${contentType};base64,${Buffer.from(fileBuffer).toString('base64')}`
          } else {
            return { success: false, error: `Storage upload failed: ${retry.error.message}` }
          }
        }
      } else {
        return { success: false, error: uploadError.message }
      }
    }

    if (!publicUrl) {
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
      publicUrl = urlData.publicUrl
    }

    // 2. Persist to job_photos table
    return await addJobPhoto(supabase, {
      orgId,
      jobId,
      photoType,
      url: publicUrl,
      caption,
      uploadedBy
    })
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to upload job photo' }
  }
}
