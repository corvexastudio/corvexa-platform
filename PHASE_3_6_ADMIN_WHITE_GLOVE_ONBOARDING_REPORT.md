# CAPTODESK — PHASE 3.6: ADMIN WHITE-GLOVE ONBOARDING, PHONE-FIRST 1-TAP CLAIM LINKS & 10DLC CARRIER COMPLIANCE

**Status:** Complete & Verified  
**Date:** 2026-10-26  
**Scope:** Admin Portal White-Glove Onboarding, Carrier/Line-Type Detection, 1-Tap Cryptographic Claim Links, In-App Claim Credential Capture, and 10DLC Registration for Paying Members.

---

## 1. Executive Summary & Problem Remediation

During cold calls and live outreach, contractors on Google Maps or in the field cannot spell complex email addresses, create passwords, or fill out multi-step forms while driving or working on a job site. Forcing them through `/client/onboarding` or asking for Federal EIN and corporate legal paperwork during a 90-second conversation causes catastrophic friction and lead drop-off.

Phase 3.6 establishes **90-Second White-Glove (Done-For-You) Concierge Onboarding** directly in the Super Admin Portal (`/admin/organizations`), paired with phone-first cryptographic 1-tap claim links and automated 10DLC carrier compliance gating for paying members.

---

## 2. Architectural Components Implemented

### A. Phone-First 1-Tap Claim Token Engine (`src/lib/security/claim-token.ts`)
- **HMAC-SHA256 URL-Safe Token Generator (`createClaimToken`)**:
  - Encodes payload `{ userId, email, orgId, exp }` in base64url and signs it with platform secrets (`SUPABASE_SERVICE_ROLE_KEY` / `CRON_SECRET`).
  - Constant-time verification (`crypto.timingSafeEqual`) in `verifyClaimToken` prevents timing attacks.
  - Generates stateless, tamper-proof 30-day claim tokens requiring **zero schema changes or database migrations**.
- **1-Tap Claim Route (`src/app/claim/[token]/route.ts`)**:
  - Resolves token, requests a Supabase Auth magic link via `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })`, extracts hashed token, and calls `verifyOtp` on the server.
  - Automatically sets authentication cookies on the 303 redirect response to `/client/dashboard`.
  - Contractors tapping the link on mobile Safari or Chrome are instantly logged in without entering any credentials.

### B. Mobile vs. Landline Phone Lookup (`src/lib/telephony/carrier-lookup.ts` & `src/app/api/admin/phone-lookup/route.ts`)
- **Carrier & Line-Type Categorization**:
  - Normalizes phone numbers to E.164 via `phone-normalizer.ts`.
  - Queries Telnyx Number Lookup API (`GET https://api.telnyx.com/v2/number_lookup/${e164}`) with a 4-second timeout.
  - Classifies line types into `'mobile'`, `'landline'`, `'voip'`, or `'unknown'`.
  - Infers carrier preset (`'verizon'`, `'att'`, `'tmobile'`, `'other'`) from carrier naming conventions (e.g., Cellco, Cingular, Cricket, Sprint, Metro).
  - Displays explicit warning when a contractor phone is a landline, preventing admins from sending SMS claim links to non-SMS numbers.

### C. Done-For-You White-Glove Onboarding Engine (`src/lib/admin/white-glove-onboarding.ts` & `/api/admin/organizations/onboard`)
- **Phone-First Auth User & Workspace Priming**:
  - Accepts business name, trade catalog, owner cell phone, carrier preset, timezone, and optional shop phone.
  - If `ownerEmail` is omitted, generates a deterministic phone-first placeholder email: `phone.{digits}@claim.captodesk.com`.
  - Creates the Supabase Auth user, tenant organization, and owner profile with `role: 'owner'`.
  - Seeds 3 trade-specific starter services with market pricing from `INDUSTRY_PRESETS`.
  - Seeds an interactive sandbox practice job (`🧪 [PRACTICE] Water Heater Diagnostic ($89.00)`) and contact (`[PRACTICE] Alex Homeowner`) so the contractor lands on a live, functional dispatch board.
  - Returns public booking link (`/book/[slug]`), 1-tap claim URL (`/claim/[token]`), and pre-written ready-to-send welcome SMS.

### D. 10DLC Carrier Compliance for Paying Members
- **Onboarding Boxes Left Blank**:
  - During white-glove onboarding and self-onboarding, legal business entity name, Federal EIN, and physical address boxes are left blank (null), ensuring zero-friction instant activation.
- **Paying User Gating & In-App Alerts**:
  - When a user becomes a paying subscriber (`subscription_status === 'active'` or paid tier `'solo'`, `'fleet'`, `'multi_crew'`, etc.):
    - Automated missed-call text-backs on their dedicated line require A2P 10DLC brand registration under US carrier rules (The Campaign Registry - TCR).
    - If 10DLC fields are incomplete:
      1. **Client Layout Banner (`src/app/client/layout.tsx`)**: Prominent callout alerting owners/admins to complete their legal business name, EIN (or Sole Prop), and address.
      2. **Client Dashboard Attention Queue (`src/lib/dashboard/dashboard-service.ts`)**: Surfaces a high-priority retention action item with direct deep-link.
      3. **Plan & Billing Page (`src/app/client/billing/page.tsx`)**: Displays 10DLC Carrier Registration status and prompt.
      4. **Client Settings (`src/app/client/settings/page.tsx`)**: Deep-links via `?tab=retention`, explains that CaptoDesk covers TCR filing fees, and marks status as `'pending'` upon save.
      5. **Admin Portal (`src/app/admin/organizations/page.tsx`)**: Allows 1-click batch activation (`verifyAndRegisterOrganization10Dlc`) with Telnyx.

### E. In-App "Save Your Real Email & Password" Banner (`src/app/client/layout.tsx` & `/api/client/account/claim`)
- When an owner claims their account via phone-first link, an in-app banner displays:
  - "Welcome to your pre-built CaptoDesk workspace! Tap below to save your real email & password for future logins."
  - Form fields use `autoComplete="email"` and `autoComplete="new-password"`, enabling one-tap mobile keyboard autofill.
  - Endpoint `POST /api/client/account/claim` updates the Supabase Auth user email and password using `adminClient.auth.admin.updateUserById`, updates the profile, and logs `security.account_claimed`.

---

## 3. Verification Pipeline Results

| Step | Command | Status | Details |
|------|---------|--------|---------|
| **1. Typecheck** | `npm run typecheck` | ✅ PASSED | Zero TypeScript errors across entire repo |
| **2. ESLint** | `npm run lint` | ✅ PASSED | Zero lint errors |
| **3. Test Suites** | `npm test` | ✅ PASSED | **231/231 tests passing** (including 12 new Phase 3.6 tests) |
| **4. Next.js Build** | `npm run build` | ✅ PASSED | All 67 static and dynamic pages compiled with Turbopack |

---

## 4. Key Files Created & Modified

### Created:
- `src/lib/security/claim-token.ts`
- `src/lib/telephony/carrier-lookup.ts`
- `src/lib/admin/white-glove-onboarding.ts`
- `src/app/api/admin/phone-lookup/route.ts`
- `src/app/api/admin/organizations/onboard/route.ts`
- `src/app/api/admin/organizations/[id]/claim/route.ts`
- `src/app/claim/[token]/route.ts`
- `src/app/api/client/account/claim/route.ts`
- `test/phase3-6-admin-white-glove-onboarding.test.mjs`

### Modified:
- `src/app/admin/organizations/page.tsx`
- `src/app/client/layout.tsx`
- `src/app/client/settings/page.tsx`
- `src/app/client/billing/page.tsx`
- `src/app/client/dashboard/page.tsx`
- `src/app/api/client/billing/route.ts`
- `src/app/api/client/organization/route.ts`
- `src/lib/dashboard/dashboard-service.ts`
- `src/lib/security/audit-logger.ts`
- `package.json`
