import type { SupabaseClient } from '@supabase/supabase-js'

export const PRACTICE_JOB_NUMBER = 'PRACTICE-101'
export const PRACTICE_JOB_TITLE = '🧪 [PRACTICE] Water Heater Diagnostic ($89.00)'
export const PRACTICE_JOB_NOTES = 'SANDBOX_PRACTICE_JOB: This is a safe practice job to test 1-tap automations. Real customer bookings will appear here automatically.'

/**
 * Accurately determines if a job or appointment is the sandbox practice job.
 */
export function isPracticeJob(job: {
  notes?: string | null
  title?: string | null
  job_number?: string | null
} | null | undefined): boolean {
  if (!job) return false
  const notes = job.notes || ''
  const title = job.title || ''
  const num = job.job_number || ''
  return (
    notes.includes('SANDBOX_PRACTICE_JOB') ||
    title.includes('[PRACTICE]') ||
    title.includes('🧪 [PRACTICE]') ||
    num.startsWith('PRACTICE')
  )
}

/**
 * Seeds a sandbox practice customer and job for a newly onboarded organization.
 * Idempotent: Does not insert duplicates if a practice job already exists.
 */
export async function seedPracticeJobIfMissing(
  supabase: SupabaseClient,
  orgId: string,
  options?: {
    ownerPhone?: string | null
    ownerName?: string | null
  }
): Promise<{ success: boolean; practiceJobId?: string }> {
  try {
    // Check if practice job already exists
    const { data: existingJobs } = await supabase
      .from('jobs')
      .select('id, job_number, notes')
      .eq('org_id', orgId)
      .limit(5)

    const hasPractice = existingJobs?.some(isPracticeJob)
    if (hasPractice) {
      return { success: true }
    }

    // Create sandbox contact
    const contactId = crypto.randomUUID()
    const practicePhone = options?.ownerPhone || '+15550199999'

    await supabase.from('contacts').insert({
      id: contactId,
      org_id: orgId,
      name: '🧪 [PRACTICE] Alex Miller (Test Customer)',
      phone: practicePhone,
      address: '123 Practice Lane, Suite 100, Austin, TX 78701',
      lifecycle_status: 'active',
      tags: ['practice', 'sandbox']
    })

    const practiceJobId = crypto.randomUUID()
    const now = new Date()
    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000)

    await supabase.from('jobs').insert({
      id: practiceJobId,
      org_id: orgId,
      contact_id: contactId,
      job_number: PRACTICE_JOB_NUMBER,
      title: PRACTICE_JOB_TITLE,
      status: 'scheduled',
      scheduled_start: now.toISOString(),
      scheduled_end: inOneHour.toISOString(),
      notes: PRACTICE_JOB_NOTES
    })

    return { success: true, practiceJobId }
  } catch (err: any) {
    console.warn('[SEED_PRACTICE_JOB_WARNING]', err?.message)
    return { success: false }
  }
}
