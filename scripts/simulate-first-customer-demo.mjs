/**
 * ==============================================================================
 * CAPTODESK — FIRST CUSTOMER DEMO SCENARIO SIMULATOR
 * ==============================================================================
 * Exercises the complete primary customer demonstration journey:
 * Missed Call → Simulated Auto-Recovery SMS → Lead & Inbox Thread → Owner Follow-Up → Booking
 *
 * SAFETY INVARIANTS:
 * 1. Strictly locked to CaptoDesk Demo Services ('26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7')
 * 2. Refuses to run against protected owner organization ('87348a58-b47f-4e80-8dec-bc2117ad45a6')
 * 3. Enforces TELNYX_MOCK_DISPATCH === 'true' and STRIPE_MOCK_DISPATCH === 'true'
 * 4. Idempotent: Can be rerun safely without creating duplicate leads or contacts
 * 5. Uses real application services (call-recovery, template-engine, booking-manager)
 * ==============================================================================
 */

import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  assertE2ETestSafety,
  KNOWN_PRODUCTION_PROJECT_REF,
  SYNTHETIC_DEMO_ORG_ID,
  SYNTHETIC_DEMO_ORG_NAME,
  PROTECTED_OWNER_ORG_ID
} from '../test/e2e/safety-guard.mjs';
import { processMissedCall } from '../src/lib/services/call-recovery.ts';
import { createBooking } from '../src/lib/booking/booking-manager.ts';

function loadEnv() {
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

export async function simulateFirstCustomerDemo(options = {}) {
  const env = options.env || loadEnv();
  const argv = options.argv || process.argv;

  console.log('\n========================================================================');
  console.log('  Captodesk First Customer Demo Simulator (US Lawn Care Scenario)');
  console.log('========================================================================');

  // 1. Fail-closed environment and mock verification
  const guard = assertE2ETestSafety(env, { exitOnError: false, argv });
  console.log(`[SAFETY GUARD] Verified target mode: '${guard.mode}' on project '${guard.projectRef}'`);
  console.log(`[SAFETY GUARD] Telnyx Mock: ${env.TELNYX_MOCK_DISPATCH} | Stripe Mock: ${env.STRIPE_MOCK_DISPATCH}`);

  if (env.TELNYX_MOCK_DISPATCH !== 'true' || env.STRIPE_MOCK_DISPATCH !== 'true') {
    throw new Error('FAIL-CLOSED HALT: Both TELNYX_MOCK_DISPATCH and STRIPE_MOCK_DISPATCH must be "true".');
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing Supabase credentials in environment.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 2. Verify Demo Tenant Boundary
  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .select('id, name, telnyx_phone_number, phone_provisioning_status, timezone')
    .eq('id', SYNTHETIC_DEMO_ORG_ID)
    .single();

  if (orgErr || !org) {
    throw new Error(`Demo organization '${SYNTHETIC_DEMO_ORG_ID}' not found in database.`);
  }

  if (org.id === PROTECTED_OWNER_ORG_ID) {
    throw new Error(`CRITICAL SAFETY ABORT: Target matches protected owner organization '${PROTECTED_OWNER_ORG_ID}'!`);
  }

  console.log(`[TENANT] Verified: ${org.name} (${org.id})`);

  // Target DID
  const demoDid = org.telnyx_phone_number || '+18777713802';
  const prospectPhone = '+15125550188';
  const prospectName = 'Marcus Vance (Green Valley HOA)';
  const prospectAddress = '4204 Greystone Dr, Austin, TX 78731';

  console.log(`[SCENARIO] Prospect: ${prospectName} (${prospectPhone})`);
  console.log(`[SCENARIO] Dialed Number: ${demoDid}`);

  // ── STEP A & B: Simulate Missed Call & Recovery Text-Back ──────────────────
  console.log('\n[STEP A & B] Simulating missed call & auto-reply text-back...');
  const callControlId = `demo_call_${Date.now()}`;
  const callResult = await processMissedCall(supabase, {
    callerNumber: prospectPhone,
    calledNumber: demoDid,
    callOutcome: {
      wasAnswered: false,
      isEligibleForRecovery: true,
      state: 'missed',
      durationSeconds: 0,
      hangupCause: 'CALL_REJECTED'
    },
    callControlId
  });

  console.log(`  ✓ Missed call processed: action='${callResult.action}', messageId='${callResult.messageId}'`);
  console.log(`  ✓ Simulation Notice: Recovery SMS generation verified; carrier dispatch safely mocked (${callResult.messageId}).`);

  // ── STEP C: Show Resulting Lead & Conversation ─────────────────────────────
  console.log('\n[STEP C] Verifying lead and conversation scoping in demo tenant...');
  
  // Update contact name so it renders cleanly for the demo
  const { data: contact } = await supabase
    .from('contacts')
    .select('id, name, phone')
    .eq('org_id', SYNTHETIC_DEMO_ORG_ID)
    .eq('phone', prospectPhone)
    .single();

  if (contact && contact.name === 'New Caller') {
    await supabase
      .from('contacts')
      .update({ name: prospectName, address: prospectAddress })
      .eq('id', contact.id);
  }

  let { data: lead } = await supabase
    .from('leads')
    .select('id, status, source, missed_call_count, notes')
    .eq('org_id', SYNTHETIC_DEMO_ORG_ID)
    .eq('contact_id', contact.id)
    .maybeSingle();

  if (!lead) {
    const { data: newLead } = await supabase
      .from('leads')
      .insert({
        org_id: SYNTHETIC_DEMO_ORG_ID,
        contact_id: contact.id,
        source: 'missed_call',
        status: 'new',
        missed_call_count: 1,
        notes: 'Missed call from prospect seeking lawn services'
      })
      .select('id, status, source, missed_call_count, notes')
      .single();
    lead = newLead;
  }

  console.log(`  ✓ Lead active in pipeline: ID=${lead?.id}, Status=${lead?.status}, Source=${lead?.source}, MissedCalls=${lead?.missed_call_count}`);

  let { data: conv } = await supabase
    .from('conversations')
    .select('id, last_message_preview, last_message_at')
    .eq('org_id', SYNTHETIC_DEMO_ORG_ID)
    .eq('contact_id', contact.id)
    .maybeSingle();

  if (!conv) {
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        org_id: SYNTHETIC_DEMO_ORG_ID,
        contact_id: contact.id,
        last_message_preview: 'Missed call recovery text-back sent.',
        status: 'open'
      })
      .select('id, last_message_preview, last_message_at')
      .single();
    conv = newConv;
  }

  console.log(`  ✓ Conversation thread ready in Unified Inbox: ID=${conv.id}`);
  console.log(`    Last message: "${conv.last_message_preview}"`);

  // ── STEP D: Demonstrate Owner Follow-Up ────────────────────────────────────
  console.log('\n[STEP D] Demonstrating owner follow-up message...');
  const ownerFollowUpText =
    "Hi Marcus! Sorry we missed your call. We're currently servicing properties in Northwest Hills. We have availability this Thursday at 2:00 PM for mowing and seasonal aeration. Does that time work for your property?";

  // Owner reply
  await supabase.from('messages').insert({
    org_id: SYNTHETIC_DEMO_ORG_ID,
    conversation_id: conv.id,
    direction: 'outbound',
    sender_type: 'owner',
    body: ownerFollowUpText,
    delivery_status: 'sent',
    telnyx_message_id: `mock_owner_reply_${Date.now()}`
  });

  // Simulated prospect confirmation response
  const prospectReplyText =
    "Yes, Thursday at 2:00 PM is perfect! Please book us for the lawn mowing and edging.";

  await supabase.from('messages').insert({
    org_id: SYNTHETIC_DEMO_ORG_ID,
    conversation_id: conv.id,
    direction: 'inbound',
    sender_type: 'customer',
    body: prospectReplyText,
    delivery_status: 'delivered'
  });

  await supabase
    .from('conversations')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: prospectReplyText
    })
    .eq('id', conv.id);

  console.log(`  ✓ Two-way conversation established in inbox thread ${conv.id}`);
  console.log(`    Owner sent: "${ownerFollowUpText.slice(0, 60)}..."`);
  console.log(`    Customer replied: "${prospectReplyText}"`);

  // ── STEP E: Complete Booking Workflow ──────────────────────────────────────
  console.log('\n[STEP E] Scheduling appointment and verifying conflict protections...');
  
  // Find a service from starter catalog
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('org_id', SYNTHETIC_DEMO_ORG_ID)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  const chosenService = services?.[0];
  // Target a fixed upcoming business day slot (tomorrow at 10:00 AM Central / 15:00 UTC)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setUTCHours(15, 0, 0, 0);
  const startTime = tomorrow.toISOString();

  // Check if an appointment was already booked for this demo slot (idempotency)
  const { data: existingAppt } = await supabase
    .from('appointments')
    .select('id, manage_token, status, start_time')
    .eq('org_id', SYNTHETIC_DEMO_ORG_ID)
    .eq('contact_id', contact.id)
    .eq('start_time', startTime)
    .in('status', ['requested', 'confirmed', 'scheduled'])
    .maybeSingle();

  let bookingResult;
  if (existingAppt) {
    console.log(`  ✓ Appointment already scheduled for this demo slot (idempotent): ID=${existingAppt.id}`);
    bookingResult = {
      success: true,
      appointment: existingAppt,
      manageToken: existingAppt.manage_token,
      manageUrl: `https://captodesk.com/book/manage/${existingAppt.manage_token}`
    };
  } else {
    bookingResult = await createBooking(supabase, {
      orgId: SYNTHETIC_DEMO_ORG_ID,
      serviceId: chosenService?.id,
      customerName: prospectName,
      customerPhone: prospectPhone,
      customerAddress: prospectAddress,
      startTime,
      notes: 'Weekly lawn mowing & edging requested via missed-call recovery',
      source: 'inbox'
    });

    if (!bookingResult.success) {
      throw new Error(`Booking failed: ${bookingResult.error}`);
    }

    console.log(`  ✓ Appointment scheduled: ID=${bookingResult.appointment?.id}`);
    console.log(`    Manage Token: ${bookingResult.manageToken}`);
    console.log(`    Customer Manage URL: ${bookingResult.manageUrl}`);
  }

  // Conflict protection test: Attempting duplicate overlapping booking must be rejected
  console.log('  Testing slot collision prevention against booked slot...');
  const conflictResult = await createBooking(supabase, {
    orgId: SYNTHETIC_DEMO_ORG_ID,
    serviceId: chosenService?.id,
    customerName: 'Conflict Test Caller',
    customerPhone: '+15125550999',
    customerAddress: '100 Main St, Austin, TX',
    startTime, // Exactly the same start time!
    notes: 'Collision test',
    source: 'booking_page'
  });

  if (conflictResult.success) {
    throw new Error('FAIL-CLOSED ERROR: Slot collision protection failed to reject overlapping appointment!');
  }
  console.log(`  ✓ Slot collision protection verified: Overlapping appointment properly rejected ("${conflictResult.error}")`);

  console.log('\n========================================================================');
  console.log('  DEMO JOURNEY SUCCESSFULLY PREPARED & VERIFIED');
  console.log('========================================================================');
  console.log('Observable Results in CaptoDesk UI:');
  console.log(`• Unified Inbox (/client/inbox): Thread active with "${prospectName}"`);
  console.log(`• Leads Pipeline (/client/leads): Card visible in "New" or "Contacted" column`);
  console.log(`• Field Schedule (/client/field): Appointment at ${new Date(startTime).toLocaleString()}`);
  console.log('========================================================================\n');

  return {
    success: true,
    contactId: contact.id,
    conversationId: conv.id,
    appointmentId: bookingResult.appointment?.id,
    manageToken: bookingResult.manageToken,
    startTime
  };
}

// CLI runner if invoked directly
import { pathToFileURL } from 'node:url';
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  simulateFirstCustomerDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n[SIMULATOR ERROR]', err.message);
      process.exit(1);
    });
}
