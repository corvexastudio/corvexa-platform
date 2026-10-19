import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { chromium } from '@playwright/test';
import { assertE2ETestSafety } from './safety-guard.mjs';

function getEnv() {
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
  return { ...env, ...process.env };
}

export async function getAuthCookies(baseURL = 'http://localhost:3088') {
  const env = getEnv();

  // Fail-closed safety guard: Block execution if target is unconfigured or unsafe
  assertE2ETestSafety(env, { exitOnError: true, argv: process.argv });

  const testEmail = 'corvexastudio@gmail.com';
  // Strict invariant: Never generate test tokens for non-demo users
  if (testEmail !== 'corvexastudio@gmail.com') {
    throw new Error('SAFETY HALT: E2E auth helper is locked strictly to demo user corvexastudio@gmail.com!');
  }

  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: testEmail
  });

  if (error || !data?.properties?.hashed_token) {
    throw new Error('Failed to generate magic link for test tenant: ' + (error?.message || 'missing token'));
  }

  const tokenHash = data.properties.hashed_token;
  const callbackUrl = `${baseURL}/client/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=/client/dashboard`;

  const response = await fetch(callbackUrl, { redirect: 'manual' });
  if (response.status !== 307 && response.status !== 302) {
    throw new Error(`Auth callback returned unexpected status: ${response.status}`);
  }

  const rawCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : [response.headers.get('set-cookie')].filter(Boolean);

  const playwrightCookies = [];
  for (const raw of rawCookies) {
    const parts = raw.split(';').map(p => p.trim());
    const [nameVal, ...attrs] = parts;
    const eqIdx = nameVal.indexOf('=');
    if (eqIdx === -1) continue;
    const name = nameVal.slice(0, eqIdx);
    const value = nameVal.slice(eqIdx + 1);

    const cookieObj = {
      name,
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: attrs.some(a => a.toLowerCase() === 'httponly'),
      secure: attrs.some(a => a.toLowerCase() === 'secure'),
      sameSite: 'Lax',
    };
    playwrightCookies.push(cookieObj);
  }

  return playwrightCookies;
}

// Quick self-check if run directly
if (process.argv[1]?.endsWith('auth-helper.mjs')) {
  (async () => {
    try {
      const cookies = await getAuthCookies();
      console.log('Successfully acquired auth cookies count:', cookies.length);
      console.log('Cookie names:', cookies.map(c => c.name));

      const browser = await chromium.launch({ channel: 'msedge', headless: true });
      const context = await browser.newContext();
      await context.addCookies(cookies);
      const page = await context.newPage();

      await page.goto('http://localhost:3088/client/dashboard', { waitUntil: 'networkidle' });
      const currentUrl = page.url();
      console.log('Navigated URL:', currentUrl);
      const title = await page.title();
      console.log('Page title:', title);

      const headerText = await page.locator('h1, h2').allInnerTexts();
      console.log('Headings found:', headerText.slice(0, 5));

      await browser.close();
    } catch (err) {
      console.error('Self-check error:', err.message);
      process.exit(1);
    }
  })();
}
