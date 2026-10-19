import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { assertE2ETestSafety } from './safety-guard.mjs';

const content = fs.readFileSync('.env.local', 'utf8');
const env = {};
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

const mergedEnv = { ...env, ...process.env };

// Fail-closed safety guard: Block execution if target is unconfigured or unsafe
assertE2ETestSafety(mergedEnv, { exitOnError: true, argv: process.argv });

const orgId = '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7';
// Strict invariant: Never mutate records outside CaptoDesk Demo Services
if (orgId !== '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7') {
  throw new Error('SAFETY HALT: setup-test-job is strictly locked to demo org 26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7!');
}

const supabase = createClient(mergedEnv.NEXT_PUBLIC_SUPABASE_URL, mergedEnv.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function setup() {
  const { data: contacts } = await supabase.from('contacts').select('id, name, phone, address').eq('org_id', orgId);
  let contact = contacts?.[0];
  if (!contact) {
    const { data: newContact, error: cErr } = await supabase.from('contacts').insert({
      org_id: orgId,
      name: 'Alex Johnson (Synthetic Test)',
      phone: '+15552345678',
      address: '123 Main St, Austin, TX 78701'
    }).select().single();
    if (cErr) throw cErr;
    contact = newContact;
  } else if (!contact.address) {
    await supabase.from('contacts').update({ address: '123 Main St, Austin, TX 78701' }).eq('id', contact.id);
    contact.address = '123 Main St, Austin, TX 78701';
  }

  // Check if today already has a job
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const { data: existingJobs } = await supabase
    .from('jobs')
    .select('id, title, scheduled_start')
    .eq('org_id', orgId)
    .gte('scheduled_start', startOfDay)
    .lte('scheduled_start', endOfDay);

  if (!existingJobs || existingJobs.length === 0) {
    const scheduledStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0, 0).toISOString();
    const scheduledEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 0, 0).toISOString();

    const { data: newJob, error: jErr } = await supabase.from('jobs').insert({
      org_id: orgId,
      contact_id: contact.id,
      title: 'Water Heater Replacement & Diagnostic',
      description: 'Customer reports low water pressure and heating failure on second floor.',
      status: 'scheduled',
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      job_number: 'JOB-901'
    }).select().single();

    if (jErr) throw jErr;
    console.log('Created synthetic test job for today:', newJob.id, newJob.title);
  } else {
    console.log('Existing synthetic job found for today:', existingJobs[0].id);
  }
}

setup().catch(console.error);
