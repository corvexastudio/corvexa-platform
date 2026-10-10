# CAPTODESK — PHASE 3 REMEDIATION #1
## P0-02 — ELIMINATE SYNTHETIC +1999 PHONE NUMBERS

**Date:** October 9, 2026  
**Engineer:** Principal SaaS Backend Engineer, PostgreSQL Data Integrity Engineer, Telephony Reliability Engineer  
**Target Repository:** CaptoDesk Core Repository (`c:\Users\mskar\captodesk`)  
**Remediation Status:** Complete & Verified  
**Final Gate Verdict:** `P0-02: PASS`

---

## 1. ORIGINAL DEFECT

In Phase 3 End-to-End Workflow Audit finding **P0-02**, when a business owner left the phone field blank or when an internal database conflict occurred during signup, the application synthesized arbitrary unroutable phone numbers such as:
```text
+1999XXXXXXX
```
and permanently persisted them into production database columns:
- `organizations.owner_phone`
- `organizations.phone_number`
- `profiles.phone`

This defect poisoned production data with unroutable NANP area code 999 numbers, caused carrier delivery failures when dispatches or test SMS were triggered, corrupted owner profile information, and violated core telecom compliance and data integrity standards.

---

## 2. ROOT CAUSE ANALYSIS

In `src/app/api/onboarding/route.ts`, legacy code attempted to satisfy historical database `NOT NULL` and `UNIQUE` constraints on the legacy `organizations.phone_number` column:
```typescript
// Legacy defective implementation
const rawPhone = typeof phone === 'string' ? phone.trim() : ''
const cleanDigits = rawPhone.replace(/\D/g, '')
const randomSuffix = Math.floor(1000000 + Math.random() * 9000000).toString()
const fallbackPhone = cleanDigits.length >= 10
  ? (cleanDigits.length === 10 ? `+1${cleanDigits}` : `+${cleanDigits}`)
  : `+1999${randomSuffix}`
```
Furthermore, in "Fallback C" (handling error code `23505`), the route generated yet another random `+1999` number:
```typescript
if (orgError && orgError.code === '23505' && orgError.message?.toLowerCase().includes('phone_number')) {
  const freshRandom = `+1999${Math.floor(1000000 + Math.random() * 9000000)}`
  ...
}
```
Although Migration 23 (`23_relax_organizations_phone_number_not_null.sql`) had previously dropped the `NOT NULL` constraint on `organizations.phone_number`, `onboarding/route.ts` was never refactored to eliminate the synthetic fallback generator.

---

## 3. PHONE-FIELD DATA MODEL & SEMANTICS

| Database Field | Semantic Role | Database Nullability | Valid Format | Architectural Purpose |
| :--- | :--- | :---: | :---: | :--- |
| `organizations.owner_phone` | Owner Notification Mobile | `NULLABLE` | Canonical E.164 (`+1XXXXXXXXXX`) or `NULL` | Receives owner alerts, operator notifications, and test SMS dispatches. |
| `organizations.telnyx_phone_number` | Dedicated Carrier DID | `NULLABLE` | Canonical E.164 (`+1XXXXXXXXXX`) or `NULL` | Tenant's public-facing CaptoDesk call-tracking & SMS number. |
| `organizations.phone_number` | Legacy Public Number | `NULLABLE` | Canonical E.164 (`+1XXXXXXXXXX`) or `NULL` | Legacy column relaxed in Migration 23. Retained for backwards compatibility. |
| `profiles.phone` | User Profile Phone | `NULLABLE` | Canonical E.164 (`+1XXXXXXXXXX`) or `NULL` | Personal contact phone of the authenticated user. |

---

## 4. CHOSEN POLICY: GENUINELY OPTIONAL WITH STRICT VALIDATION

CaptoDesk architecture was analyzed across schema migrations, onboarding UI, client settings, and downstream services. 

### Why the OPTIONAL (Strategy B) Policy is Architecturally Authoritative:
1. **Onboarding UI Labeling:** The onboarding wizard has always labeled the field as: `Notification Mobile Number (optional)`.
2. **Settings Flexibility:** Under `/client/settings`, `owner_phone` is an optional setting that contractors can configure or update at any time.
3. **Database Constraints:** `schema.sql` and migrations 02, 22, 23, and 29 define `owner_phone`, `phone_number`, and `profiles.phone` as nullable.
4. **Downstream Safety:** Downstream notification services (`/api/telnyx/test-sms`, `quote-manager`, `job-manager`, `invoice-manager`) already implement defensive null checks.

### Strict Enforcement Rules Implemented:
- **Blank / Whitespace / Omitted:** Stored as clean `NULL`. Absolutely no synthetic replacement or placeholder string is ever fabricated.
- **Provided:** Validated strictly using the canonical ITU-T E.164 normalizer `normalizePhoneToE164()`.
  - If valid: Normalized to canonical E.164 (e.g., `+12145550199`).
  - If invalid: Rejected immediately with HTTP 400 (`Invalid notification mobile number`). Direct API requests cannot bypass validation.

---

## 5. FILES CHANGED

1. **`src/app/api/onboarding/route.ts`:**
   - Imported canonical `normalizePhoneToE164`.
   - Eliminated `fallbackPhone`, `randomSuffix`, `freshRandom`, and all `+1999` string templates.
   - Implemented strict validation: empty or whitespace inputs resolve to `null`; non-empty inputs are normalized or rejected with HTTP 400.
   - Inserted `normalizedOwnerPhone` directly into `organizations.owner_phone`, `organizations.phone_number`, and `profiles.phone`.
   - Removed retry block "Fallback C" which previously synthesized fake numbers on 23505 collisions.

2. **`src/app/client/onboarding/page.tsx`:**
   - Updated `handleStep1Next` to validate phone length (minimum 10 digits if provided) before advancing to Step 2.
   - Updated `submitOnboarding` to pass `phone.trim() || null`.
   - Updated helper copy to: `"Used for instant owner notifications and missed-call test alerts. Leave blank if not needed."`

3. **`src/app/api/client/organization/route.ts`:**
   - Imported canonical `normalizePhoneToE164`.
   - Validates and normalizes `body.owner_phone` on update. Empty strings convert to `null`; malformed strings return HTTP 400.

4. **`src/app/api/settings/profile/route.ts`:**
   - Imported canonical `normalizePhoneToE164`.
   - Validates and normalizes `profile.phone` on PATCH. Empty strings convert to `null`; malformed strings return HTTP 400.

5. **`supabase/migrations/30_eliminate_synthetic_phone_numbers.sql`:**
   - Created dedicated database migration ensuring `owner_phone`, `phone_number`, and `profiles.phone` permit `NULL`.
   - Implemented atomic SQL cleanup to nullify existing synthetic `+1999` numbers.

6. **`package.json`:**
   - Added `test/p0-synthetic-phone-elimination.test.mjs` to the `npm test` script.

---

## 6. DATABASE CHANGES & MIGRATION 30

**File:** `supabase/migrations/30_eliminate_synthetic_phone_numbers.sql`

```sql
DO $$
BEGIN
  -- 1. Ensure organizations.owner_phone permits NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'owner_phone'
  ) THEN
    ALTER TABLE organizations ALTER COLUMN owner_phone DROP NOT NULL;
  END IF;

  -- 2. Ensure organizations.phone_number permits NULL (if column exists)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE organizations ALTER COLUMN phone_number DROP NOT NULL;
  END IF;

  -- 3. Ensure profiles.phone permits NULL
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN phone DROP NOT NULL;
  END IF;

  -- 4. Clean up any existing synthetic +1999 numbers in organizations.owner_phone
  UPDATE organizations
  SET owner_phone = NULL
  WHERE owner_phone LIKE '+1999%' 
     OR owner_phone LIKE '1999%'
     OR owner_phone LIKE '+1999________';

  -- 5. Clean up any existing synthetic +1999 numbers in organizations.phone_number (if column exists)
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'organizations' AND column_name = 'phone_number'
  ) THEN
    UPDATE organizations
    SET phone_number = NULL
    WHERE phone_number LIKE '+1999%' 
       OR phone_number LIKE '1999%'
       OR phone_number LIKE '+1999________';
  END IF;

  -- 6. Clean up any existing synthetic +1999 numbers in profiles.phone
  UPDATE profiles
  SET phone = NULL
  WHERE phone LIKE '+1999%' 
     OR phone LIKE '1999%'
     OR phone LIKE '+1999________';

END $$;
```

---

## 7. EXISTING SYNTHETIC DATA HANDLING & DIAGNOSTIC AUDIT

- **Local Codebase & Migration Audit:** 0 hardcoded `+1999` seed numbers exist in `supabase/schema.sql` or migrations.
- **Production Data Diagnostic:** In deployed PostgreSQL environments, Migration 30 safely converts all historical `+1999%` records to clean `NULL` values without touching valid real telephone numbers.
- **Status in Execution Environment:** *Production database live records could not be verified in this local audit environment.* The migration is idempotent and safe for immediate deployment.

---

## 8. DOWNSTREAM NULL & VALIDATION SAFETY AUDIT

Every consumer of `owner_phone`, `phone_number`, and `profiles.phone` was traced:

1. **Test SMS Dispatch (`/api/telnyx/test-sms`):**
   - If `owner_phone` is `NULL`, returns HTTP 400: `"Please enter your mobile phone number in Settings to receive the test SMS."` Does not attempt carrier delivery.
2. **Client Settings UI (`/client/settings`):**
   - "Send Test SMS" button is disabled when `owner_phone` is empty.
3. **Public Booking Route (`/api/book/[slug]` & `/book/manage/[token]`):**
   - Organization phone resolves to `org.telnyx_phone_number || org.owner_phone || null`. Gracefully renders without errors.
4. **Public Invoice Portal (`/invoice/[token]`):**
   - Telephone link renders only if `org.owner_phone` is truthy (`{org?.owner_phone && ...}`). Fallback text displays `"support"` safely.
5. **Field Service & Quote Notifications (`job-manager.ts`, `quote-manager.ts`):**
   - Outbound sender resolution `const senderNumber = org?.telnyx_phone_number || org?.owner_phone` checks `if (senderNumber)` before dispatching SMS. Skips safely when missing.

---

## 9. TESTS ADDED

**File:** `test/p0-synthetic-phone-elimination.test.mjs` (10 tests):

- **TEST 1:** Missing phone cannot create synthetic number; resolves to clean `NULL`.
- **TEST 2:** Whitespace-only phone cannot create synthetic number; resolves to clean `NULL`.
- **TEST 3:** Malformed phone is rejected with clear validation error.
- **TEST 4:** Valid phone is normalized correctly to canonical E.164.
- **TEST 5:** Source code static verification: `onboarding/route.ts` contains zero instances of `+1999`, `fallbackPhone`, `randomSuffix`, or `freshRandom`.
- **TEST 6:** Repository-wide scan: Zero production services in `src/` generate `+1999` fallbacks.
- **TEST 7:** Optional phone `NULL` does not crash downstream notification flows.
- **TEST 8:** Direct API request with malformed phone cannot bypass validation (returns HTTP 400).
- **TEST 9:** Existing valid phone numbers remain unchanged.
- **TEST 10:** Migration 30 correctly defines SQL cleanup for synthetic `+1999` records.

---

## 10. TEST & REGRESSION RESULTS

| Suite | Status | Execution Summary |
| :--- | :---: | :--- |
| **P0-02 Focused Tests** | **PASS** | 10 / 10 passed (`test/p0-synthetic-phone-elimination.test.mjs`, 272ms) |
| **Security Matrix Tests** | **PASS** | 55 / 55 passed (`npm run test:security`, 2.3s) |
| **Complete Unit Test Suite** | **PASS** | 375 / 375 passed (`npm test`, 4.0s) |
| **TypeScript Typecheck** | **PASS** | `tsc --noEmit` exited with code 0 (zero errors) |
| **ESLint Static Analysis** | **PASS** | `eslint .` exited with code 0 (zero errors) |
| **Next.js Production Build** | **PASS** | `next build` compiled successfully (58/58 pages generated) |

---

## 11. REPOSITORY-WIDE SYNTHETIC NUMBER SEARCH RESULTS

An automated scan of all source files in `src/` confirms:
- **`+1999` in `src/`:** **0 matches found.**
- **`fallbackPhone` in `src/`:** **0 matches found.**
- **`randomSuffix` in `src/app/`:** **0 matches found.**
*(Remaining occurrences of `1999` across the entire repo are strictly confined to security test assertions in `test/security-baseline.test.mjs` verifying rejection of malicious numbers).*

---

## 12. REMAINING LIMITATIONS & NEXT PHASES

Per instructions, the following items were kept out of scope for this focused remediation and will be addressed in subsequent milestones:
1. **P0-01:** Telnyx Number Orders API integration (`provisionOrganizationPhoneNumber`).
2. **P1-01:** Seeding default service catalog during onboarding to unblock public booking.
3. **P1-02:** PostgreSQL GiST range exclusion constraint for overlapping appointments.
4. **P2-01:** Onboarding timezone collection.

---

## 13. FINAL GATE VERDICT

```
============================================================
                  FINAL GATE: P0-02 PASS
============================================================
✔ Zero production paths can generate synthetic +1999 numbers.
✔ Missing/whitespace phone is safely stored as NULL.
✔ Valid phone numbers are normalized to canonical E.164.
✔ Malformed phone numbers are rejected with HTTP 400.
✔ Downstream notification consumers handle NULL safely.
✔ Migration 30 provides safe atomic database cleanup.
✔ 375/375 automated tests pass.
✔ Typecheck, lint, and production build pass with 0 errors.
============================================================
```
