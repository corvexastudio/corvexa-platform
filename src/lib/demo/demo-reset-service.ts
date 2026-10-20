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

  // 4. Re-seed sample walkthrough contact
  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .insert({
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Alex Johnson (Sample Customer)',
      phone: '+15552345678',
      email: 'alex.johnson@example.com',
      address: '123 Main St, Austin, TX 78701'
    })
    .select('id, name')
    .single()

  if (cErr) {
    console.error('[DEMO RESET] Failed to reseed sample contact:', cErr)
    throw cErr
  }

  const now = new Date()

  // 5. Seed sample conversation thread for Unified Inbox walkthrough
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({
      org_id: SYNTHETIC_DEMO_ORG_ID,
      contact_id: contact.id,
      last_message_preview: 'Hi, I have a leaking water heater on the 2nd floor, need someone today if possible.',
      last_message_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      unread_count: 0,
      status: 'open'
    })
    .select('id')
    .single()

  if (!convErr && conv) {
    await supabase.from('messages').insert([
      {
        org_id: SYNTHETIC_DEMO_ORG_ID,
        conversation_id: conv.id,
        direction: 'inbound',
        sender_type: 'customer',
        body: 'Hi, I have a leaking water heater on the 2nd floor, need someone today if possible.',
        delivery_status: 'received',
        created_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString()
      },
      {
        org_id: SYNTHETIC_DEMO_ORG_ID,
        conversation_id: conv.id,
        direction: 'outbound',
        sender_type: 'system',
        body: 'Thanks for reaching out to CaptoDesk Demo Services! We received your message and have dispatched a technician for this afternoon.',
        delivery_status: 'delivered',
        created_at: new Date(now.getTime() - 1000 * 60 * 25).toISOString()
      }
    ])
  }

  // 6. Seed sample lead for Leads Pipeline walkthrough
  await supabase.from('leads').insert({
    org_id: SYNTHETIC_DEMO_ORG_ID,
    contact_id: contact.id,
    source: 'missed_call',
    status: 'new',
    urgency: 'high',
    service_needed: 'Water Heater Replacement & Diagnostic',
    estimated_value: 1250.0,
    notes: 'Urgent replacement requested. Dispatched for 2:00 PM.'
  })

  // 7. Create scheduled walkthrough jobs for today & tomorrow
  const tz = org.timezone || 'America/Chicago'
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())

  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(tomorrowDate)

  const scheduledStartToday = `${todayStr}T19:00:00.000Z`
  const scheduledEndToday = `${todayStr}T21:00:00.000Z`
  const scheduledStartTomorrow = `${tomorrowStr}T19:00:00.000Z`
  const scheduledEndTomorrow = `${tomorrowStr}T21:00:00.000Z`

  const { data: createdJobs, error: jErr } = await supabase
    .from('jobs')
    .insert([
      {
        org_id: SYNTHETIC_DEMO_ORG_ID,
        contact_id: contact.id,
        title: 'Water Heater Replacement & Diagnostic',
        description: 'Customer reports low water pressure and heating failure on second floor.',
        status: 'scheduled',
        scheduled_start: scheduledStartToday,
        scheduled_end: scheduledEndToday,
        job_number: 'JOB-901'
      },
      {
        org_id: SYNTHETIC_DEMO_ORG_ID,
        contact_id: contact.id,
        title: 'Water Heater Replacement & Diagnostic',
        description: 'Scheduled follow-up and efficiency verification.',
        status: 'scheduled',
        scheduled_start: scheduledStartTomorrow,
        scheduled_end: scheduledEndTomorrow,
        job_number: 'JOB-902'
      }
    ])
    .select('id, job_number, title, scheduled_start')

  if (jErr) {
    console.error('[DEMO RESET] Failed to reseed jobs:', jErr)
    throw jErr
  }

  // 8. Seed matching appointment for Today
  const matchingServiceId = createdServices?.find((s) => s.name.includes('Water Heater'))?.id || createdServices?.[0]?.id
  await supabase.from('appointments').insert({
    org_id: SYNTHETIC_DEMO_ORG_ID,
    contact_id: contact.id,
    service_id: matchingServiceId,
    title: 'Water Heater Replacement',
    service_type: 'Water Heater Replacement',
    start_time: scheduledStartToday,
    end_time: scheduledEndToday,
    status: 'confirmed',
    address: '123 Main St, Austin, TX 78701',
    customer_name: 'Alex Johnson (Sample Customer)',
    customer_phone: '+15552345678',
    customer_email: 'alex.johnson@example.com'
  })

  return {
    success: true,
    message: 'CaptoDesk Demo Services has been wiped and restored to a pristine day-one state.',
    clearedTables,
    seededServicesCount: createdServices?.length || 0,
    seededJobsCount: createdJobs?.length || 0
  }
}
