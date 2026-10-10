import fs from 'fs';
import path from 'path';

// Read .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf8');
  content.replace(/\r/g, '').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  });
}

function extractProjectRef(url) {
  if (!url) return null;
  const match = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1].toLowerCase() : null;
}

function extractJwtRef(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    return (payload.ref || payload.iss || '').toLowerCase() || null;
  } catch {
    return null;
  }
}

console.log('====================================================');
console.log('          CaptoDesk Environment Validation          ');
console.log('====================================================\n');

const tier = (process.env.APP_ENV || process.env.NODE_ENV || 'development').toLowerCase();
console.log(`Environment Tier: [${tier.toUpperCase()}]`);

// Supabase URL
const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sbUrlRef = extractProjectRef(sbUrl);
console.log(`Supabase URL:             ${sbUrl ? 'SET' : 'MISSING'}${sbUrlRef ? ` (Project: ${sbUrlRef})` : ''}`);

// Supabase Anon Key
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log(`Supabase Anon Key:        ${anonKey ? 'SET' : 'MISSING'}`);

// Supabase Service Role Key
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const serviceKeyRef = extractJwtRef(serviceKey);
console.log(`Supabase Service Role:    ${serviceKey ? 'SET' : 'MISSING'}${serviceKeyRef ? ` (Project Ref: ${serviceKeyRef})` : ''}`);

// Project Alignment
let projectAligned = false;
if (sbUrlRef && serviceKeyRef) {
  projectAligned = sbUrlRef === serviceKeyRef;
  console.log(`Supabase Project Match:   ${projectAligned ? 'PASS (Aligned)' : 'FAIL (MISMATCHED PROJECT)'}`);
} else if (!serviceKey) {
  console.log(`Supabase Project Match:   SKIPPED (Service key missing)`);
} else {
  console.log(`Supabase Project Match:   UNKNOWN (Custom/Local endpoint)`);
}

// CRON_SECRET
const cronSecret = process.env.CRON_SECRET;
console.log(`CRON_SECRET:              ${cronSecret ? (cronSecret.length >= 32 ? 'SET (Secure 32+ bytes)' : 'SET (Short)') : 'MISSING (Fail-closed)'}`);

// Telephony (Telnyx)
const telnyxApiKey = process.env.TELNYX_API_KEY;
const telnyxPublicKey = process.env.TELNYX_PUBLIC_KEY;
const telnyxConnectionId = process.env.TELNYX_CONNECTION_ID;
const telnyxProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
console.log(`Telnyx API Key:           ${telnyxApiKey ? 'SET' : 'INTENTIONALLY DEFERRED'}`);
console.log(`Telnyx Public Key:        ${telnyxPublicKey ? (telnyxPublicKey.trim() ? 'SET' : 'EMPTY') : 'INTENTIONALLY DEFERRED'}`);
console.log(`Telnyx Connection ID:     ${telnyxConnectionId ? 'SET' : 'INTENTIONALLY DEFERRED'}`);
console.log(`Telnyx Messaging Profile: ${telnyxProfileId ? 'SET' : 'INTENTIONALLY DEFERRED'}`);

// Stripe
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhook = process.env.STRIPE_WEBHOOK_SECRET;
console.log(`Stripe Secret Key:        ${stripeKey ? (stripeKey.startsWith('sk_live_') ? 'SET (Live mode)' : 'SET (Test mode)') : 'INTENTIONALLY DEFERRED'}`);
console.log(`Stripe Webhook Secret:    ${stripeWebhook ? 'SET' : 'INTENTIONALLY DEFERRED'}`);
console.log(`SaaS Subscription Billing: MANUAL PAYPAL (Provider-Independent Foundation)`);

// Super Admin & Base URL
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
const adminEmails = process.env.SUPER_ADMIN_EMAILS;
console.log(`App Base URL:             ${appUrl ? 'SET' : 'MISSING (Defaulting to http://localhost:3000)'}`);
console.log(`Super Admin Emails:       ${adminEmails ? 'SET' : 'MISSING'}`);

console.log('\n====================================================');
if (!projectAligned && serviceKeyRef && sbUrlRef) {
  console.log('STATUS: [FAIL] - Active environment has mismatched Supabase project credentials!');
  console.log('Action: Retrieve SUPABASE_SERVICE_ROLE_KEY from project ' + sbUrlRef + ' in Supabase Dashboard.');
  process.exit(1);
} else {
  console.log('STATUS: [PASS] - Environment validation completed successfully.');
}
console.log('====================================================\n');
