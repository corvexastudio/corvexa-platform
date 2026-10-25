# CAPTODESK — PHASE 3.4: STAFF MANAGEMENT CONTROLS & TRIAL QUOTA ENFORCEMENT REPORT

**Date:** October 25, 2026  
**Status:** COMPLETE & VERIFIED  
**Architecture Lead:** Principal SaaS Architect & Senior Next.js / Supabase Engineer  
**Scope Boundaries Enforced:** Zero schema/database migration changes, zero Supabase RLS modifications, financial permissions preserved, strictly local/in-memory test fixtures, no Vercel deployment triggered.

---

## 1. Executive Summary

Phase 3.4 successfully remediates defects **RBAC-003** (P1 — lack of staff member management controls in UI and backend API) and **BILL-001** (P2 — graceful trial quota enforcement and outbound SMS suppression).

1. **Staff Role Modification, Suspension & Member Removal (RBAC-003):**
   - Granted canonical permission `'team:manage'` and `'team:remove'` to authorized roles (`owner`, `admin`, `client_admin`, `super_admin`) while strictly denying them to `dispatcher`, `technician`, and `member`.
   - Created server-authoritative API route [`/api/team/[id]`](file:///C:/Users/mskar/captodesk/src/app/api/team/[id]/route.ts) supporting `PATCH` (role updates, full name updates) and `DELETE` (unlinking member from organization, setting role to `member`, unassigning pending field jobs, and dropping active crew assignments).
   - Enforced strict privilege escalation guards: self-demotion/self-deletion blocked (400), cross-tenant modification blocked (404), non-owners prevented from altering or deleting owners (403), and role escalation to `super_admin` or `owner` restricted to authorized roles (403).
   - Enhanced [`src/app/client/team/page.tsx`](file:///C:/Users/mskar/captodesk/src/app/client/team/page.tsx) with desktop table and mobile card action menus, "Change Role" modal, and "Remove Member" confirmation modal.

2. **Graceful Trial Quota & Outbound SMS Safety Enforcement (BILL-001):**
   - Implemented `SubscriptionService.evaluateTrialQuota(supabase, orgId)` deriving trial status from `organizations` or `saas_subscriptions`, enforcing a 3-booking cap or 14-day trial window.
   - Integrated quota check into [`src/lib/services/call-recovery.ts`](file:///C:/Users/mskar/captodesk/src/lib/services/call-recovery.ts): when a trial organization exceeds quota, outbound automated Telnyx auto-replies are suppressed (`suppressionReason: 'trial_limit_reached'`), the call is logged with `auto_reply_sent: false`, the lead is captured/updated with audit notes, and in-app upgrade notifications are dispatched.
   - Enforced **Critical Business Rule** in [`src/lib/booking/booking-manager.ts`](file:///C:/Users/mskar/captodesk/src/lib/booking/booking-manager.ts): public customer bookings on `/book/[slug]` **never fail or block the homeowner** when trial SMS credits are exhausted. The booking, appointment, linked field job, and CRM lead are saved successfully, while outbound SMS is suppressed and an in-app notice alerts the contractor.
   - Enhanced [`/api/client/dashboard`](file:///C:/Users/mskar/captodesk/src/app/api/client/dashboard/route.ts) and [`src/app/client/dashboard/page.tsx`](file:///C:/Users/mskar/captodesk/src/app/client/dashboard/page.tsx) to surface an upgrade alert banner when trial limits are reached.

---

## 2. Source Code Changes

### A. Security & Permissions (`RBAC-003`)
- [`src/lib/security/permissions.ts`](file:///C:/Users/mskar/captodesk/src/lib/security/permissions.ts):
  - Added `'team:manage'` and `'team:remove'` to canonical `Action` union.
  - Mapped `'team:manage'` and `'team:remove'` to `super_admin`, `owner`, `admin`.
  - Disallowed `'team:manage'` and `'team:remove'` for `dispatcher`, `technician`, `member`.

### B. Staff Management API Route (`RBAC-003`)
- [`src/app/api/team/[id]/route.ts`](file:///C:/Users/mskar/captodesk/src/app/api/team/[id]/route.ts):
  - **`PATCH` Handler:**
    - Authorized via `getTenantContext('team:manage')`.
    - Blocks self-modification (`id === user.id` -> 400).
    - Verifies target user belongs to caller's `org_id` (404 on cross-tenant attempts).
    - Prevents non-owners from modifying `owner` or `super_admin` accounts (403).
    - Prevents role escalation to `super_admin` or `owner` by unauthorized callers (403).
    - Updates `role` and/or `full_name`, clears server profile cache via `invalidateProfileCache(id)`, and writes an audit event.
  - **`DELETE` Handler:**
    - Authorized via `getTenantContext('team:remove')`.
    - Blocks self-deletion (`id === user.id` -> 400).
    - Verifies target user belongs to caller's `org_id` (404 on cross-tenant attempts).
    - Prevents non-owners from removing `owner` or `super_admin` accounts (403).
    - Unlinks target member by updating `profiles` (`org_id: null, role: 'member'`).
    - Cleans up active crew assignments in `crew_members`.
    - Unassigns any pending/scheduled field jobs in `jobs` (`assigned_to: null`).
    - Clears profile cache and logs `team.member_removed` audit event.

### C. Team UI Controls (`RBAC-003`)
- [`src/app/client/team/page.tsx`](file:///C:/Users/mskar/captodesk/src/app/client/team/page.tsx):
  - Fetched caller profile `role` alongside `org_id` to evaluate UI capabilities.
  - Added visual role badges (`Owner`, `Admin`, `Dispatcher`, `Technician`, `Member`) and `(You)` tag for caller's row.
  - Added "Actions" column to desktop table and quick-action buttons on mobile cards for authorized operators.
  - Protected rows: disabled edit/remove for self and for organization owners when viewed by non-owner admins.
  - Built interactive "Update Team Member Role" Dialog with role selection and loading state.
  - Built interactive "Remove Team Member" confirmation Dialog with destructive styling, safety disclosures, and loading state.

### D. Trial Quota Derivation & Enforcement (`BILL-001`)
- [`src/lib/billing/subscription-service.ts`](file:///C:/Users/mskar/captodesk/src/lib/billing/subscription-service.ts):
  - Added `TrialQuotaResult` interface: `{ isTrial, isExceeded, reason, bookedCount, maxBookings, daysRemaining, expiresAt }`.
  - Implemented `SubscriptionService.evaluateTrialQuota(supabase, orgId)`:
    - Identifies trial organizations via `organizations.subscription_status === 'trial'` or `saas_subscriptions.status IN ('trial', 'trialing')`.
    - Counts booked appointments for the organization.
    - Evaluates 14-day trial window from `saas_subscriptions.current_period_end` or `organizations.created_at`.
    - Returns `isExceeded: true` if booked appointments >= 3 or if the 14-day window has expired.
  - Added export helper `evaluateTrialQuota`.

- [`src/lib/services/call-recovery.ts`](file:///C:/Users/mskar/captodesk/src/lib/services/call-recovery.ts):
  - Prior to suppression evaluation, runs `SubscriptionService.evaluateTrialQuota(supabase, org.id)`.
  - When trial limit is exceeded:
    - Inserts suppressed call record with `auto_reply_sent: false, suppression_reason: 'trial_limit_reached'`.
    - Preserves caller contact in `contacts`.
    - Records/updates lead in `leads` so contractor does not lose customer lead.
    - Sends in-app upgrade alert notification via `notifications` table and `notifyOwner`.
    - Returns `{ success: true, action: 'suppressed_trial_limit_reached', suppressionReason: 'trial_limit_reached' }`.

- [`src/lib/booking/booking-manager.ts`](file:///C:/Users/mskar/captodesk/src/lib/booking/booking-manager.ts):
  - Prior to sending confirmation SMS, runs `SubscriptionService.evaluateTrialQuota(supabase, orgId)`.
  - When trial limit is reached:
    - Logs suppression audit in `compliance_audit_logs` (`trial_limit_reached`).
    - Dispatches contractor in-app warning notification alerting of the trial quota pause.
    - Skips outbound Telnyx SMS and reminder schedule.
    - **Preserves customer booking:** Homeowner receives immediate booking success response (`success: true, appointment, manageToken, manageUrl`), appointment is booked, linked job is created, and lead is recorded.

### E. Client Dashboard Upgrade Notification (`BILL-001`)
- [`src/app/api/client/dashboard/route.ts`](file:///C:/Users/mskar/captodesk/src/app/api/client/dashboard/route.ts):
  - Evaluates `trialStatus` and includes it in dashboard payload.
- [`src/app/client/dashboard/page.tsx`](file:///C:/Users/mskar/captodesk/src/app/client/dashboard/page.tsx):
  - Renders amber notification banner above queue when `data?.trialStatus?.isTrial && data?.trialStatus?.isExceeded`.
  - Provides direct 1-click CTA linking to `/client/billing`.

---

## 3. Test Coverage & Verification

### A. Phase 3.4 Dedicated Test Suite
Created [`test/phase3-4-staff-and-trial-enforcement.test.mjs`](file:///C:/Users/mskar/captodesk/test/phase3-4-staff-and-trial-enforcement.test.mjs) containing 13 comprehensive regression tests:
1. `RBAC-003: Permissions capability mapping correctly grants team:manage and team:remove`
2. `RBAC-003: Owner can update a technician to dispatcher via PATCH /api/team/[id]`
3. `RBAC-003: Owner can remove a member via DELETE /api/team/[id] and unassign pending jobs`
4. `RBAC-003: Self-modification and self-deletion are strictly blocked (400 Bad Request)`
5. `RBAC-003: Cross-tenant member modification/removal is rejected (404 Not Found)`
6. `RBAC-003: Privilege escalation guards block non-owners from modifying owner or escalating to super_admin`
7. `RBAC-003: Dispatchers and Technicians cannot access staff management endpoints (403 Forbidden)`
8. `BILL-001: evaluateTrialQuota correctly recognizes active paid tenants as non-trial`
9. `BILL-001: evaluateTrialQuota permits trial tenants under 3 bookings`
10. `BILL-001: evaluateTrialQuota marks trial quota exceeded when 3 or more bookings are reached`
11. `BILL-001: evaluateTrialQuota marks trial exceeded when 14-day window has expired`
12. `BILL-001: processMissedCall pauses automated SMS auto-reply when trial quota is reached but preserves lead`
13. `BILL-001: createBooking strictly preserves public customer booking success when trial limit is exceeded`

**Result:** `13/13 passing` (100%).

### B. Full Test Suite Regression Gate
Ran `npm test` across all 55 test suites in the CaptoDesk repository:
```
# tests 749
# suites 0
# pass 749
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10567.2326
```
**Result:** 749/749 tests passing (0 failures).

### C. TypeScript Typecheck Gate
Ran `npm run typecheck`:
```
> captodesk@0.1.0 typecheck
> tsc --noEmit
```
**Result:** 0 errors across the entire Next.js project.

### D. ESLint Gate
Ran `npm run lint`:
```
> captodesk@0.1.0 lint
> eslint .
✖ 946 problems (0 errors, 946 warnings)
```
**Result:** 0 lint errors.

### E. Next.js Production Build Gate
Ran `npm run build`:
```
✓ Compiled successfully in 8.1s
  Running TypeScript ...
  Finished TypeScript in 23.3s ...
  Generating static pages using 11 workers (64/64) in 1104ms
  Route /api/team/[id] successfully bundled
```
**Result:** Production build passed cleanly.

---

## 4. Verification Matrix

| Defect ID | Severity | Verification Status | Artifact / Proof |
|:---|:---:|:---:|:---|
| **RBAC-003** | P1 | RESOLVED | `test/phase3-4-staff-and-trial-enforcement.test.mjs` (Tests 1-7); `/api/team/[id]` PATCH/DELETE handlers; `src/app/client/team/page.tsx` actions & modals |
| **BILL-001** | P2 | RESOLVED | `test/phase3-4-staff-and-trial-enforcement.test.mjs` (Tests 8-13); `evaluateTrialQuota`; `processMissedCall` trial suppression; `createBooking` customer unblock rule; dashboard upgrade banner |

---

## 5. Deployment Posture

Per instructions, **no deployment to Vercel was performed**. All changes are committed locally, verified with zero errors, and ready for deployment review.
