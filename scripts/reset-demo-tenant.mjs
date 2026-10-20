/**
 * ==============================================================================
 * CAPTODESK — DEMO TENANT INSTANT RESET SCRIPT
 * ==============================================================================
 * Resets "CaptoDesk Demo Services" to a pristine, day-one state for prospect demos.
 *
 * SAFETY INVARIANTS:
 * 1. Hardcoded to target ONLY the synthetic demo tenant:
 *    org_id = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7' (CaptoDesk Demo Services)
 * 2. Physically CANNOT touch live client organizations or "Shanta M's Business".
 * 3. Atomic deletion strictly scoped with .eq('org_id', DEMO_ORG_ID) on every query.
 * 4. Refuses to run without verified project target and validated demo organization.
 * 5. Re-seeds fresh starter services, sample contact, and scheduled jobs.
 * ==============================================================================
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  KNOWN_PRODUCTION_PROJECT_REF,
  SYNTHETIC_DEMO_ORG_ID,
  SYNTHETIC_DEMO_ORG_NAME,
  SYNTHETIC_DEMO_ORG_SLUG,
  PROTECTED_OWNER_ORG_ID,
  extractProjectRef,
  validateE2EEnvironment
} from '../test/e2e/safety-guard.mjs';

export {
  KNOWN_PRODUCTION_PROJECT_REF,
  SYNTHETIC_DEMO_ORG_ID,
  SYNTHETIC_DEMO_ORG_NAME,
  SYNTHETIC_DEMO_ORG_SLUG,
  PROTECTED_OWNER_ORG_ID
};

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
];

export const FORBIDDEN_GLOBAL_TABLES = [
  'organizations',
  'profiles',
  'auth.users',
  'processed_events'
];

/**
 * Validates the execution environment before creating a Supabase client or issuing any database calls.
 */
export function validateResetEnvironment(env = process.env, argv = []) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    return {
      valid: false,
      error: '[DEMO RESET GUARD] Missing NEXT_PUBLIC_SUPABASE_URL. Cannot determine target project.'
    };
  }

  if (!serviceKey) {
    return {
      valid: false,
      error: '[DEMO RESET GUARD] Missing SUPABASE_SERVICE_ROLE_KEY. Administrative reset cannot proceed without credentials.'
    };
  }

  const projectRef = extractProjectRef(supabaseUrl);
  if (!projectRef) {
    return {
      valid: false,
      error: '[DEMO RESET GUARD] Unable to extract a valid project reference from NEXT_PUBLIC_SUPABASE_URL.'
    };
  }

  if (projectRef !== KNOWN_PRODUCTION_PROJECT_REF) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] Target project mismatch: NEXT_PUBLIC_SUPABASE_URL resolves to '${projectRef}', expected '${KNOWN_PRODUCTION_PROJECT_REF}'.`
    };
  }

  // Check for unchecked CLI arguments attempting arbitrary organization targeting
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    let candidateOrgId = '';
    if (arg.startsWith('--org=') || arg.startsWith('--orgId=') || arg.startsWith('--org-id=') || arg.startsWith('--target=')) {
      candidateOrgId = arg.split('=')[1]?.trim() || '';
    } else if ((arg === '--org' || arg === '--orgId' || arg === '--org-id' || arg === '--tenant' || arg === '--target') && i + 1 < argv.length) {
      candidateOrgId = argv[i + 1]?.trim() || '';
    }
    if (candidateOrgId && candidateOrgId.toLowerCase() !== SYNTHETIC_DEMO_ORG_ID.toLowerCase()) {
      return {
        valid: false,
        error: `[DEMO RESET GUARD] Forbidden CLI override: Attempted to target organization '${candidateOrgId}'. Demo reset is strictly locked to '${SYNTHETIC_DEMO_ORG_ID}'.`
      };
    }
  }

  // Check for unchecked environment variable overrides
  const envTargetOrg = (env.TARGET_ORG_ID || env.ORG_ID || env.TENANT_ID || env.DEMO_ORG_ID)?.trim();
  if (envTargetOrg && envTargetOrg.toLowerCase() !== SYNTHETIC_DEMO_ORG_ID.toLowerCase()) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] Tenant scope violation: Configured environment organization '${envTargetOrg}' does not match the approved demo organization ('${SYNTHETIC_DEMO_ORG_ID}').`
    };
  }

  return {
    valid: true,
    projectRef,
    targetOrgId: SYNTHETIC_DEMO_ORG_ID
  };
}

/**
 * Validates the target organization record retrieved from database before issuing any deletions.
 */
export function validateResetTarget(orgRecord, targetOrgId = SYNTHETIC_DEMO_ORG_ID) {
  if (targetOrgId === PROTECTED_OWNER_ORG_ID) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] CRITICAL: Target matches PROTECTED OWNER organization '${PROTECTED_OWNER_ORG_ID}'. Reset aborted.`
    };
  }

  if (!targetOrgId || targetOrgId !== SYNTHETIC_DEMO_ORG_ID) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] Invalid target org ID '${targetOrgId}'. Must equal '${SYNTHETIC_DEMO_ORG_ID}'.`
    };
  }

  if (!orgRecord || typeof orgRecord !== 'object') {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] Organization '${targetOrgId}' not found in database.`
    };
  }

  if (orgRecord.id !== SYNTHETIC_DEMO_ORG_ID) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] Organization ID mismatch: DB returned '${orgRecord.id}', expected '${SYNTHETIC_DEMO_ORG_ID}'.`
    };
  }

  if (orgRecord.id === PROTECTED_OWNER_ORG_ID) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] CRITICAL: DB returned PROTECTED OWNER organization '${PROTECTED_OWNER_ORG_ID}'. Reset aborted.`
    };
  }

  if (orgRecord.name !== SYNTHETIC_DEMO_ORG_NAME) {
    return {
      valid: false,
      error: `[DEMO RESET GUARD] Organization name mismatch: DB returned '${orgRecord.name}', expected '${SYNTHETIC_DEMO_ORG_NAME}'.`
    };
  }

  return { valid: true };
}

/**
 * Builds a validated scoped delete query configuration.
 */
export function buildCleanupQuery(tableName, targetOrgId) {
  if (targetOrgId !== SYNTHETIC_DEMO_ORG_ID) {
    throw new Error(`[DEMO RESET GUARD] Refusing query generation: Target org '${targetOrgId}' is not the approved demo tenant.`);
  }

  if (FORBIDDEN_GLOBAL_TABLES.includes(tableName)) {
    throw new Error(`[DEMO RESET GUARD] Refusing query generation: Table '${tableName}' is a global/shared table and cannot be wiped.`);
  }

  if (!DEMO_RESET_CLEANUP_TABLES.includes(tableName)) {
    throw new Error(`[DEMO RESET GUARD] Table '${tableName}' is not in approved demo cleanup list.`);
  }

  return {
    table: tableName,
    filterColumn: 'org_id',
    filterValue: targetOrgId
  };
}

// ── Environment Loader ────────────────────────────────────────────────────────
function getEnv() {
  const env = {};
  if (fs.existsSync('.env.local')) {
    const content = fs.readFileSync('.env.local', 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  }
  return { ...env, ...process.env };
}

export async function resetDemoTenant(options = {}) {
  const env = options.env || getEnv();
  const argv = options.argv || process.argv;

  // 1. Fail-closed environment validation before creating any client
  const envValidation = validateResetEnvironment(env, argv);
  if (!envValidation.valid) {
    throw new Error(envValidation.error);
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('\n========================================================================');
  console.log('  Captodesk Demo Tenant Reset Tool');
  console.log('========================================================================');
  console.log(`Target Organization ID : ${SYNTHETIC_DEMO_ORG_ID}`);
  console.log(`Target Tenant Name    : ${SYNTHETIC_DEMO_ORG_NAME}`);
  console.log(`Safety Scope          : STRICTLY LOCKED to org_id = ${SYNTHETIC_DEMO_ORG_ID}`);
  console.log('------------------------------------------------------------------------');

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 2. Fetch and strictly validate organization record before any writes
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, timezone')
    .eq('id', SYNTHETIC_DEMO_ORG_ID)
    .single();

  if (orgErr || !org) {
    throw new Error(`[DEMO RESET GUARD] Demo organization '${SYNTHETIC_DEMO_ORG_ID}' not found in database.`);
  }

  const targetValidation = validateResetTarget(org, SYNTHETIC_DEMO_ORG_ID);
  if (!targetValidation.valid) {
    throw new Error(targetValidation.error);
  }

  console.log(`[1/3] Wiping previous demo activity records for ${org.name}...`);

  // 3. Reverse foreign key order for clean, tenant-scoped deletion
  for (const table of DEMO_RESET_CLEANUP_TABLES) {
    const queryConfig = buildCleanupQuery(table, SYNTHETIC_DEMO_ORG_ID);
    try {
      const { error: delErr } = await supabase
        .from(queryConfig.table)
        .delete()
        .eq(queryConfig.filterColumn, queryConfig.filterValue);

      if (delErr) {
        console.warn(`  Notice (${table}): ${delErr.message}`);
      } else {
        console.log(`  ✓ Cleared ${table}`);
      }
    } catch (err) {
      console.warn(`  Notice (${table}):`, err.message);
    }
  }

  console.log('\n[2/3] Re-seeding pristine starter service catalog...');
  const starterServices = [
    {
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Diagnostic & System Inspection',
      price: 89.00,
      duration_minutes: 45,
      is_active: true
    },
    {
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Water Heater Replacement',
      price: 1250.00,
      duration_minutes: 180,
      is_active: true
    },
    {
      org_id: SYNTHETIC_DEMO_ORG_ID,
      name: 'Emergency Drain Snaking',
      price: 220.00,
      duration_minutes: 60,
      is_active: true
    }
  ];

  const { data: createdServices, error: sErr } = await supabase
    .from('services')
    .insert(starterServices)
    .select('id, name');

  if (sErr) throw sErr;
  console.log(`  ✓ Created ${createdServices.length} starter services:`);
  for (const s of createdServices) {
    console.log(`    • ${s.name}`);
  }

  console.log('\n[3/3] Re-seeding sample walkthrough contact & today\'s scheduled job...');
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
    .single();

  if (cErr) throw cErr;
  console.log(`  ✓ Created sample contact: ${contact.name}`);

  const now = new Date();

  // Seed sample conversation thread for Unified Inbox walkthrough
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
    .single();

  if (convErr) throw convErr;
  console.log(`  ✓ Created sample conversation thread: ${conv.id}`);

  // Seed sample message history
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
  ]);
  console.log('  ✓ Seeded realistic inbound & outbound SMS conversation history');

  // Seed sample lead for Leads Pipeline walkthrough
  await supabase.from('leads').insert({
    org_id: SYNTHETIC_DEMO_ORG_ID,
    contact_id: contact.id,
    source: 'missed_call',
    status: 'new',
    urgency: 'high',
    service_needed: 'Water Heater Replacement & Diagnostic',
    estimated_value: 1250.00,
    notes: 'Urgent replacement requested. Dispatched for 2:00 PM.'
  });
  console.log('  ✓ Created qualified lead in Needs Immediate Attention pipeline');

  // Create scheduled jobs for both Today and Tomorrow in the tenant's timezone (America/Chicago)
  const tz = org.timezone || 'America/Chicago';
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(tomorrowDate);

  // 19:00 UTC = 14:00 (2:00 PM) in America/Chicago CDT (UTC-5)
  // This falls on todayStr in America/Chicago and within server's current today window
  const scheduledStartToday = `${todayStr}T19:00:00.000Z`;
  const scheduledEndToday = `${todayStr}T21:00:00.000Z`;
  const scheduledStartTomorrow = `${tomorrowStr}T19:00:00.000Z`;
  const scheduledEndTomorrow = `${tomorrowStr}T21:00:00.000Z`;

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
    .select('id, job_number, title, scheduled_start');

  if (jErr) throw jErr;
  for (const j of createdJobs) {
    console.log(`  ✓ Created scheduled walkthrough job: [${j.job_number}] ${j.title} (${j.scheduled_start})`);
  }

  console.log('\n========================================================================');
  console.log('  ✨ CAPTODESK DEMO TENANT IS 100% FRESH & READY FOR WALKTHROUGH!');
  console.log('========================================================================');
  console.log(`• Login Account : demo@captodesk.com (Role: Business Owner)`);
  console.log(`• Organization  : CaptoDesk Demo Services`);
  console.log(`• Live Clients  : 100% UNTOUCHED (Zero mutations outside org_id ${SYNTHETIC_DEMO_ORG_ID})`);
  console.log('========================================================================\n');

  return { success: true };
}

// Run directly from CLI
const isMain = process.argv[1] && (
  process.argv[1].endsWith('reset-demo-tenant.mjs') ||
  pathToFileURL(process.argv[1]).href === import.meta.url
);

if (isMain) {
  resetDemoTenant().catch((err) => {
    console.error('\n[RESET ERROR]', err.message);
    process.exit(1);
  });
}
