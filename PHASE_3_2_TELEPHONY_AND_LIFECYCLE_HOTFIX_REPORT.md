# CAPTODESK — PHASE 3.2: TELEPHONY ECONOMICS, BRAND DOMAIN HYGIENE & QUIET-HOURS LEAD RECOVERY HOTFIX REPORT

**Date:** October 25, 2026  
**Auditor / Engineer:** Principal Backend & Telephony Engineer / Senior Next.js Architect  
**Repository:** `captodesk` (`C:\Users\mskar\captodesk`)  
**Scope:** Remediation of defects `CALL-001` (P0), `TEL-001` (P1), `FIELD-001` (P1), `LIFECYCLE-001` (P1), and `FIELD-002` (P2).

---

## 1. Executive Summary

Phase 3.2 remediates five critical telephony, SMS economics, branding, and lifecycle defects confirmed during the comprehensive production readiness audit:
1. **CALL-001 (P0 Critical):** Missed calls during TCPA quiet hours (8:00 PM – 8:00 AM local tenant time) were previously suppressed from sending immediate SMS, but were silently dropped without recording a CRM lead or scheduling a morning follow-up. This caused small business contractors to permanently lose high-intent evening prospects.
2. **TEL-001 (P1 High):** Default transactional missed-call SMS templates contained typographic Unicode em-dash characters (`—`, U+2014). In carrier SMS delivery, non-GSM-7 characters force entire messages into UCS-2 (16-bit) encoding, reducing character capacity from 160 to 70 characters per segment and doubling telecommunications billing across all tenants.
3. **FIELD-001 (P1 High):** Thirteen server and client fallback references hardcoded `https://app.corvexastudio.com`, leaking an external agency domain in customer-facing quote links, booking links, field dispatch broadcasts, and tracker URLs whenever `NEXT_PUBLIC_APP_URL` was unset or unconfigured.
4. **LIFECYCLE-001 (P1 High):** Public booking confirmations sent via Telnyx SMS did not sync into the customer's Inbox conversation thread. Business owners checking their unified communications inbox saw no record of customer booking confirmation dispatches.
5. **FIELD-002 (P2 Medium):** Outbound live technician arrival tracking SMS notifications generated long `/track/[token]` URLs rather than the compact short link route `/t/[token]`, wasting valuable SMS character budget.

All five defects have been remediated cleanly without touching database schemas, migrations, or RBAC rules. The entire test suite (726 passing tests across 56 test files), TypeScript type check (`tsc --noEmit`), ESLint, and Next.js 16.4.3 production build (`next build`) pass with zero errors.

---

## 2. Findings Verified Against Current Source

| Finding ID | Severity | Description | Initial Source State | Remediated Source State |
|---|---|---|---|---|
| **CALL-001** | **P0 Critical** | Evening missed calls dropped with zero CRM lead or morning follow-up | In `src/lib/services/call-recovery.ts`, when `suppressionReason === 'tcpa_quiet_hours'`, call record was inserted with `auto_reply_sent: false`, but no entry was created in `leads` and no delayed job was queued in `automation_runs`. | Caller contact is confirmed in `contacts`; lead is upserted in `leads` with source `'missed_call'` and quiet-hours notes; recovery job is scheduled in `automation_runs` for next 8:05 AM local tenant time with idempotency key protection (`tcpa_morning_recovery:${org.id}:${caller}:${targetDate}`). Repeat evening calls do not duplicate messages. |
| **TEL-001** | **P1 High** | Unicode em-dashes forcing UCS-2 70-char segment splitting | `DEFAULT_OPEN_TEMPLATE`, `DEFAULT_AFTER_HOURS_TEMPLATE`, and `DEFAULT_BUSY_TEMPLATE` in `src/lib/telephony/template-engine.ts` used `—` (U+2014) em-dashes. | Replaced all em-dashes with ASCII ` - `. Implemented and exported `isGsm7()` and `normalizeToGsm7()` helpers to sanitize typographic quotes (`“`, `”`, `‘`, `’`), dashes (`—`, `–`), ellipses (`…`), and non-breaking spaces before carrier dispatch. |
| **FIELD-001** | **P1 High** | Hardcoded external agency fallback domain `app.corvexastudio.com` | Hardcoded fallbacks in `template-engine.ts`, `job-manager.ts`, `crew-manager.ts`, `quote-manager.ts`, `booking-manager.ts`, `referral-manager.ts`, `weekly-digest.ts`, `env.ts`, and `automations/page.tsx`. | Cleanly replaced with `(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://captodesk.com').replace(/\/$/, '')` (and `window.location.origin` in browser contexts). Zero `corvexastudio.com` fallbacks remain in `src/`. |
| **LIFECYCLE-001** | **P1 High** | Public booking confirmation SMS absent from unified Inbox | In `src/lib/booking/booking-manager.ts`, `createBooking` sent confirmation SMS via `sendTelnyxSms` but never updated `conversations` or inserted an outbound record into `messages`. | Added automatic upsert to `conversations` (with `last_message_preview` and `last_message_at`) and inserted outbound system message into `messages` (`automation_source: 'booking_confirmation'`) with fail-safe error isolation. |
| **FIELD-002** | **P2 Medium** | En-route tracker generated `/track/[token]` instead of compact `/t/[token]` | En-route dispatch in `job-manager.ts`, preview modal in `en-route-modal.tsx`, and crew reassignment in `crew-manager.ts` built links using `/track/${trackingToken}`. | Standardized all customer tracking link generation and previews on compact `/t/${trackingToken}` route, which aliases the tracker page component. |

---

## 3. Exact Files Changed

```
package.json                           |   2 +-
src/app/client/automations/page.tsx    |   6 +-
src/components/jobs/en-route-modal.tsx |   5 +-
src/lib/booking/booking-manager.ts     |  53 +++++++++++-
src/lib/config/env.ts                  |   2 +-
src/lib/crews/crew-manager.ts          |   5 +-
src/lib/jobs/job-manager.ts            |   4 +-
src/lib/quotes/quote-manager.ts        |   2 +-
src/lib/referrals/referral-manager.ts  |   2 +-
src/lib/reporting/weekly-digest.ts     |   2 +-
src/lib/services/call-recovery.ts      | 148 +++++++++++++++++++++++++++++++--
src/lib/telephony/suppression-rules.ts |   6 +-
src/lib/telephony/template-engine.ts   |  53 ++++++++++--
test/missed-call-engine.test.mjs       |   4 +-
test/phase3-2-telephony-and-lifecycle.test.mjs | 674 ++++++++++++++++++++++++++ (new file)
```

---

## 4. Verification Details

### A. GSM-7 Template Encoding & Normalization (`TEL-001`)
- **Default Templates:** Verified that `DEFAULT_OPEN_TEMPLATE`, `DEFAULT_AFTER_HOURS_TEMPLATE`, and `DEFAULT_BUSY_TEMPLATE` contain zero `—` (U+2014) or `–` (U+2013) characters.
- **GSM-7 Character Validator:** `isGsm7(text)` validates all characters against standard GSM 03.38 Basic and Extended character sets.
- **Normalization Helper:** `normalizeToGsm7(text)` sanitizes curly quotes (`‘`, `’`, `“`, `”`), en/em-dashes (`—`, `–`), ellipses (`…`), bullets (`•`), and whitespace variants (`\u00A0`, `\u200B`, `\uFEFF`) to ASCII equivalents.
- **Automatic Template Sanitization:** `renderTemplate()` pipes rendered strings through `normalizeToGsm7()` prior to return, ensuring tenant-configured templates containing copy-pasted smart punctuation remain GSM-7 compliant and do not double carrier costs.

### B. Brand Domain Hygiene & Compact URLs (`FIELD-001`, `FIELD-002`)
- **Zero Fallback Leaks:** Grep verification across `src/` confirms 0 occurrences of `corvexastudio.com` as a domain fallback:
  - `src/lib/telephony/template-engine.ts`
  - `src/lib/booking/booking-manager.ts`
  - `src/lib/jobs/job-manager.ts`
  - `src/components/jobs/en-route-modal.tsx`
  - `src/lib/crews/crew-manager.ts`
  - `src/lib/quotes/quote-manager.ts`
  - `src/lib/referrals/referral-manager.ts`
  - `src/lib/reporting/weekly-digest.ts`
  - `src/lib/config/env.ts`
  - `src/app/client/automations/page.tsx`
- **Short Links:** Verified that en-route notifications, customer crew reassignment messages, and modal preview copy all generate `/t/${trackingToken}` URLs, resolving cleanly through `src/app/t/[token]/page.tsx`.

### C. TCPA Quiet-Hours Lead Recovery & Scheduling (`CALL-001`)
- **Strict Curfew Preservation:** Outbound auto-reply SMS is never immediately dispatched during 8:00 PM – 8:00 AM local tenant time (`suppressed_tcpa_quiet_hours`).
- **Contact & Lead Preservation:** The caller's contact is saved/verified in `contacts`, and an entry is created/updated in `leads` with source `'missed_call'` and notes noting the quiet-hours missed call.
- **Next-Morning 8:05 AM Calculation:** Helper `calculateNextMorning805(timezone, referenceDate)` deterministically computes the next 8:05:00 AM UTC timestamp and calendar date key (`YYYY-MM-DD`) for any IANA timezone (handling evening calls 20:00–23:59 and early morning calls 00:00–07:59).
- **Idempotency Protection:** Jobs in `automation_runs` are keyed by `tcpa_morning_recovery:${org.id}:${caller}:${targetDateKey}`. Repeat calls during the same night from the same caller update the lead's `missed_call_count` and append notes, but strictly avoid scheduling redundant duplicate SMS messages.
- **Hard Suppressions Untouched:** Opted-out callers (`opted_out`, `suppressed_opt_out`), spam/blocked numbers, and short misdials do NOT queue morning recovery messages.

### D. Booking Confirmation Inbox Sync (`LIFECYCLE-001`)
- **Inbox Continuity:** In `createBooking`, after Telnyx dispatches the confirmation SMS, `conversations` is upserted with `last_message_preview` and `last_message_at`, and an outbound record is inserted into `messages` (`automation_source: 'booking_confirmation'`, `delivery_status: 'sent'`, `telnyx_message_id`).
- **Fail-Safe Isolation:** Wrapped in a non-blocking `try/catch` block so unexpected communication logging errors never abort or roll back a confirmed customer appointment booking.

---

## 5. Verification Results

### 1. Dedicated Hotfix Test Suite
`node --experimental-strip-types --test test/phase3-2-telephony-and-lifecycle.test.mjs`
```
# tests 12
# suites 0
# pass 12
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 422.25
```

### 2. Full Regression Test Suite
`npm test`
```
1..726
# tests 726
# suites 0
# pass 726
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 13013.07
```

### 3. TypeScript Compilation
`npm run typecheck`
```
> captodesk@0.1.0 typecheck
> tsc --noEmit
Exit code: 0 (Zero errors)
```

### 4. ESLint
`npm run lint`
```
> captodesk@0.1.0 lint
> eslint .
Exit code: 0 (Zero errors)
```

### 5. Production Build
`npm run build`
```
▲ Next.js 16.4.3 (Turbopack)
✓ Running next.config.ts took 314ms
✓ Compiled successfully in 17.6s
  Finished TypeScript in 11.5s
✓ Generating static pages using 11 workers (64/64) in 1423ms
  Finalizing page optimization ...
Exit code: 0 (64 static and dynamic routes compiled successfully)
```

---

## 6. Scope Boundaries & Remaining Limitations

1. **Database Schema & Migrations:** No database schemas, tables, columns, migrations, or RLS policies were modified in this phase. Existing tables (`automation_runs`, `leads`, `contacts`, `conversations`, `messages`, `calls`) were utilized as designed.
2. **Financial Authorization:** No changes were made to the financial authorization model or RBAC permissions established in Phase 3.1.
3. **Queue Draining:** Morning recovery jobs queued in `automation_runs` rely on the existing automation worker (`/api/automations/worker`) running via Vercel Cron. The worker already queries and claims scheduled `automation_runs` when `scheduled_at <= NOW()`.
4. **Tenant Phone Configuration:** Automatic recovery SMS and tracking links require the tenant to have an active Telnyx number provisioned. When unprovisioned, safe fallbacks log warnings and avoid fatal unhandled exceptions.
