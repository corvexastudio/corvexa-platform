import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fs from 'fs';

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const res = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim().replace(/['"]/g, '');
      res[k] = v;
    }
  }
  return res;
}

const env = parseEnv('C:\\Users\\mskar\\captodesk\\.env.local');
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const adminClient = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false }
});

async function httpGet(urlStr) {
  return new Promise((resolve) => {
    try {
      const url = new URL(urlStr);
      https.get(url, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data: body });
        });
      }).on('error', err => resolve({ error: err.message }));
    } catch (e) {
      resolve({ error: e.message });
    }
  });
}

async function runStorageProbe() {
  console.log('====================================================');
  console.log(' LIVE SUPABASE STORAGE VERIFICATION PROBE');
  console.log(' Target:', supabaseUrl);
  console.log('====================================================\n');

  // TEST 1: Inspect Bucket Configuration
  console.log('--- TEST 1: Bucket Verification ---');
  const { data: buckets, error: bucketError } = await adminClient.storage.listBuckets();
  if (bucketError) {
    console.error('Failed to list buckets:', bucketError.message);
    return;
  }
  const photoBucket = buckets.find(b => b.id === 'job-photos');
  console.log('job-photos bucket found:', !!photoBucket);
  console.log('job-photos public flag:', photoBucket?.public, '(Expected: false)');
  console.log('job-photos file_size_limit:', photoBucket?.file_size_limit, '(Expected: 10485760)');
  console.log('job-photos allowed_mime_types:', photoBucket?.allowed_mime_types);

  // TEST 2: Upload Harmless Probe Object
  console.log('\n--- TEST 2: Upload Probe Object ---');
  const probePath = `_verification_probe/probe_${Date.now()}.png`;
  // Minimal valid 1x1 PNG bytes
  const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  
  const { error: uploadError } = await adminClient.storage
    .from('job-photos')
    .upload(probePath, png1x1, { contentType: 'image/png', upsert: true });

  if (uploadError) {
    console.error('Probe upload failed:', uploadError.message);
    return;
  }
  console.log('Probe object uploaded safely to:', probePath);

  try {
    // TEST 3: Unauthenticated Public URL Access
    console.log('\n--- TEST 3: Unauthenticated Public URL Access ---');
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/job-photos/${probePath}`;
    const publicRes = await httpGet(publicUrl);
    console.log('Public URL status:', publicRes.status);
    console.log('Public response sample:', publicRes.data?.slice(0, 150));
    const publicBlocked = publicRes.status === 400 || publicRes.status === 404;
    console.log('Is unauthenticated public access BLOCKED?:', publicBlocked ? 'YES (PASS)' : 'NO (FAIL)');

    // TEST 4: Authorized Signed URL Access
    console.log('\n--- TEST 4: Authorized Signed URL Access ---');
    const { data: signedData, error: signError } = await adminClient.storage
      .from('job-photos')
      .createSignedUrl(probePath, 60);

    if (signError || !signedData?.signedUrl) {
      console.error('Signed URL generation failed:', signError?.message);
    } else {
      console.log('Signed URL generated successfully (length):', signedData.signedUrl.length);
      const signedRes = await httpGet(signedData.signedUrl);
      console.log('Signed URL access status:', signedRes.status, signedRes.status === 200 ? 'PASS (HTTP 200 OK)' : 'FAIL');
      console.log('Bytes received:', signedRes.data?.length);

      // TEST 5: Invalid Signed URL Access (Tampered Token)
      console.log('\n--- TEST 5: Tampered Signed URL Access ---');
      const tamperedUrl = signedData.signedUrl.replace(/token=([^&]+)/, 'token=invalidsignaturetoken123');
      const tamperedRes = await httpGet(tamperedUrl);
      console.log('Tampered URL access status:', tamperedRes.status);
      console.log('Tampered response sample:', tamperedRes.data?.slice(0, 150));
      const tamperedBlocked = tamperedRes.status === 400 || tamperedRes.status === 403 || tamperedRes.status === 404;
      console.log('Is tampered signed URL BLOCKED?:', tamperedBlocked ? 'YES (PASS)' : 'NO (FAIL)');
    }

    // TEST 6: Expired Signed URL Access
    console.log('\n--- TEST 6: Expired Signed URL Access ---');
    const { data: expiredData } = await adminClient.storage
      .from('job-photos')
      .createSignedUrl(probePath, 1); // 1 second expiry

    if (expiredData?.signedUrl) {
      console.log('Waiting 2500ms for signed URL to expire...');
      await new Promise(r => setTimeout(r, 2500));
      const expiredRes = await httpGet(expiredData.signedUrl);
      console.log('Expired URL access status:', expiredRes.status);
      console.log('Expired response sample:', expiredRes.data?.slice(0, 150));
      const expiredBlocked = expiredRes.status === 400 || expiredRes.status === 403 || expiredRes.status === 404;
      console.log('Is expired signed URL BLOCKED?:', expiredBlocked ? 'YES (PASS)' : 'NO (FAIL)');
    }

  } finally {
    // CLEANUP: Immediately delete the probe object
    console.log('\n--- CLEANUP: Removing Probe Object ---');
    const { error: removeError } = await adminClient.storage
      .from('job-photos')
      .remove([probePath]);
    if (removeError) {
      console.error('Failed to cleanup probe object:', removeError.message);
    } else {
      console.log('Probe object removed cleanly. Zero leftover data.');
    }
  }

  console.log('\n====================================================');
  console.log(' LIVE STORAGE PROBE COMPLETE');
  console.log('====================================================');
}

runStorageProbe();
