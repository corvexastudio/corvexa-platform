# CaptoDesk Environment Configuration Reference

**System:** CaptoDesk Multi-Tenant Platform  
**Document Owner:** Senior Release Engineer & Security Architect  
**Version:** 1.0.0  

---

## 1. Environment Tier Separation Matrix

| Configuration Variable | Development (`local`) | Staging (`stage`) | Production (`prod`) |
| :--- | :--- | :--- | :--- |
| **`APP_ENV`** | `development` | `staging` | `production` |
| **`NODE_ENV`** | `development` | `production` | `production` |
| **`NEXT_PUBLIC_APP_URL`** | `http://localhost:3000` | `https://staging.corvexastudio.com` | `https://app.corvexastudio.com` |
| **`NEXT_PUBLIC_SUPABASE_URL`** | Local Supabase / Dev Project | Staging Supabase Project | Dedicated Production Supabase Instance |
| **`NEXT_PUBLIC_SUPABASE_ANON_KEY`** | Dev Anon Key | Staging Anon Key | Production Anon Key |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Dev Service Key | Staging Service Key | Production Service Key (Protected) |
| **`TELNYX_API_KEY`** | Optional (Simulation Mode) | Test / Sandbox Sub-Account | Live Production Key (`KEY...`) |
| **`TELNYX_PUBLIC_KEY`** | Optional | Staging Public Key | Production Ed25519 Public Key |
| **`STRIPE_SECRET_KEY`** | Optional (Simulation Mode) | Test Mode (`sk_test_...`) | Live Mode (`sk_live_...`) |
| **`STRIPE_WEBHOOK_SECRET`** | Optional | Test Webhook (`whsec_...`) | Live Webhook (`whsec_...`) |
| **`CRON_SECRET`** | Optional | 32-Byte Secret | 32-Byte Cryptographic Secret |
| **`SUPER_ADMIN_EMAILS`** | Local Dev Email | QA / Staging Admin Emails | Authoritative Platform Owners Only |

---

## 2. Environment Variable Dictionary

### `APP_ENV` & `NODE_ENV`
- **Type:** String (`'development' | 'staging' | 'production' | 'test'`)
- **Required:** Yes
- **Purpose:** Controls runtime safety policies, strict key format validations, and quiet hours enforcement.

### `NEXT_PUBLIC_SUPABASE_URL`
- **Type:** HTTPS URL
- **Required:** Yes
- **Purpose:** Supabase REST & GraphQL API endpoint URL.

### `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Type:** JWT String
- **Required:** Yes
- **Purpose:** Client-safe public key used by `@supabase/ssr` for session authentication. RLS enforces all security.

### `SUPABASE_SERVICE_ROLE_KEY`
- **Type:** JWT Secret
- **Required:** Production & Staging
- **Purpose:** Bypasses RLS strictly for server-side background automations, webhook ingestion, and cron processing.
- **Security Rule:** Never prefix with `NEXT_PUBLIC_` or expose in client-side code.

### `NEXT_PUBLIC_APP_URL`
- **Type:** HTTPS URL
- **Required:** Production
- **Purpose:** Canonical domain used in SMS links (booking links, quote approvals, invoice payment links, and review redirects).

### `TELNYX_API_KEY`
- **Type:** Secret String (`KEY...`)
- **Required:** Production
- **Purpose:** Authenticates outbound voice and SMS API requests to Telnyx.

### `TELNYX_PUBLIC_KEY`
- **Type:** Base64 RSA/Ed25519 Public Key
- **Required:** Production
- **Purpose:** Validates inbound webhook signatures on `/api/webhooks/telnyx/*` preventing spoofed webhooks.

### `STRIPE_SECRET_KEY`
- **Type:** Secret String (`sk_live_...` in Prod)
- **Required:** Production
- **Purpose:** Creates Stripe Checkout sessions for customer invoice payments.

### `STRIPE_WEBHOOK_SECRET`
- **Type:** Secret String (`whsec_...`)
- **Required:** Production
- **Purpose:** Cryptographically verifies webhook payloads arriving at `/api/webhooks/stripe`.

### `CRON_SECRET`
- **Type:** Hex String (32 bytes)
- **Required:** Production
- **Purpose:** Authenticates Vercel Cron triggers at `/api/automations/worker`.

### `SUPER_ADMIN_EMAILS`
- **Type:** Comma-separated email list
- **Required:** Production
- **Purpose:** Strict server-side whitelist for accessing `/admin` cockpit and internal diagnostics.

---

## 3. Secret Rotation Protocols

### Telnyx API Key Rotation
1. Generate new API Key in **Telnyx Mission Control** -> **API Keys**.
2. Update `TELNYX_API_KEY` in Vercel Production Environment Variables.
3. Redeploy or restart Vercel production deployment.
4. Verify outbound SMS test in `/admin/simulator`.
5. Revoke old API key in Telnyx portal.

### Stripe Webhook Secret Rotation
1. In Stripe Dashboard -> **Webhooks** -> Select Endpoint -> Click **Roll Key**.
2. Stripe provides a 24-hour expiration window where both old and new keys remain valid.
3. Update `STRIPE_WEBHOOK_SECRET` in Vercel immediately.
4. Test with a mock webhook or $1 test invoice payment.
