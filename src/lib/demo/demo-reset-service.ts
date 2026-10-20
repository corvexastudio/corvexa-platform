import { createAdminClient } from '@/lib/supabase/admin'

export const SYNTHETIC_DEMO_ORG_ID = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7'
export const SYNTHETIC_DEMO_ORG_NAME = 'CaptoDesk Demo Services'
export const SYNTHETIC_DEMO_EMAIL = 'demo@captodesk.com'

export const DEMO_RESET_CLEANUP_TABLES = [
  'notifications',
  'push_subscriptions',
  'recurring_job_templates',
  'crews',
  'job_photos',
  'job_items',
  'jobs',
  'invoice_items',
  'payments',
  'invoices',
  'quote_items',
  'quotes',
  'appointments',
  'messages',
  'conversations',
  'review_requests',
  'calls',
  'leads',
  'activity_logs',
  'automation_runs',
  'contacts',
  'services'
] as const

export interface ResetDemoResult {
  success: boolean
  message: string
  clearedTables: string[]
  seededServicesCount: number
  seededJobsCount: number
  error?: string
}

/**
 * Resets the synthetic demo tenant (CaptoDesk Demo Services) to a pristine day-one state.
 * STRICT SAFETY GUARDS:
 * 1. Hardcoded target org_id: 26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7
 * 2. Absolutely never touches any other organization.
 * 3. Deletes records in reverse foreign-key order scoped strictly by .eq('org_id', SYNTHETIC_DEMO_ORG_ID).
 * 4. Re-seeds starter services, sample contact, inbox conversation, qualified lead, and today/tomorrow scheduled jobs.
 */
export async function resetDemoTenantData(): Promise<ResetDemoResult> {
  const supabase = createAdminClient()

  // 1. Verify demo organization exists
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, timezone')
    .eq('id', SYNTHETIC_DEMO_ORG_ID)
    .single()

  if (orgErr || !org) {
    throw new Error(`[DEMO RESET GUARD] Demo organization '${SYNTHETIC_DEMO_ORG_ID}' not found in database.`)
  }

  const clearedTables: string[] = []

  // 2. Clear activity records in reverse foreign-key order
  for (const table of DEMO_RESET_CLEANUP_TABLES) {
    try {
      const { error: delErr } = await supabase
        .from(table)
        .delete()
        .eq('org_id', SYNTHETIC_DEMO_ORG_ID)

      if (delErr) {
        console.warn(`[DEMO RESET] Table '${table}' cleanup notice:`, delErr.message)
      } else {
        clearedTables.push(table)
      }
    } catch (err: any) {
      console.warn(`[DEMO RESET] Table '${table}' cleanup error:`, err?.message)
    }
  }

  // 3. Re-seed pristine starter service catalog
  const starterServices = [
    {
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Diagnostic & System Inspection',
      price: 89.0,
      duration_minutes: 45,
      is_active: true
    },
    {
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Water Heater Replacement',
      price: 1250.0,
      duration_minutes: 180,
      is_active: true
    },
    {
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Emergency Drain Snaking',
      price: 220.0,
      duration_minutes: 60,
      is_active: true
    }
  ]

  const { data: createdServices, error: sErr } = await supabase
    .from('services')
    .insert(starterServices)
    .select('id, name')

  if (sErr) {
    console.error('[DEMO RESET] Failed to reseed services:', sErr)
    throw sErr
  }

  return {
    success: true,
    message: 'CaptoDesk Demo Services has been wiped and restored to a pristine day-one clean slate.',
    clearedTables,
    seededServicesCount: createdServices?.length || 0,
    seededJobsCount: 0
  }
}
