# CAPTODESK — P1-OPS-02 REMEDIATION REPORT
## Client Service Catalog Management Interface & API Hardening

**Date:** 2026-10-10  
**Remediation Target:** P1-OPS-02 — Missing Service Catalog Management for Client Organizations  
**Scope:** Client portal service management interface, CRUD API endpoints, tenant boundary enforcement, input validation, duplicate handling, and historical booking data protection.

---

## 1. Root Cause

Prior to this remediation, newly onboarded tenants received a generic default `"General Service"` (created via Migration 31) so public booking pages would render at least one selectable service. However:
1. **Missing Management UI:** The client portal lacked a dedicated Service Catalog interface where business owners could configure actual trade services (e.g., "AC Maintenance — $89 — 60 min", "Emergency Service Call — $149 — 60 min", "Drain Cleaning — $129 — 90 min").
2. **Missing Granular API Endpoints:** While `/api/client/services` supported bulk reading and creation, individual service modification and safe deactivation/deletion (`/api/client/services/[id]`) did not exist.
3. **Data Loss Risk on Deletion:** Database foreign keys on `appointments.service_id`, `jobs.service_id`, and `quotes.service_id` utilize `ON DELETE SET NULL`. If a business owner hard-deleted a service that had been booked by past customers, historical appointment, quote, and job records would have their service associations erased.

---

## 2. Existing Service Architecture

- **Database Table:** `public.services`
  - Columns: `id UUID`, `org_id UUID`, `name TEXT`, `description TEXT`, `duration_minutes INT DEFAULT 60 CHECK (duration_minutes > 0)`, `price NUMERIC(10,2)`, `requires_address BOOLEAN DEFAULT true`, `is_active BOOLEAN DEFAULT true`, `sort_order INT DEFAULT 0`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.
  - Database Constraints: `uq_services_org_id_name UNIQUE (org_id, name)` (Migration 31).
  - Indexes: `idx_services_org_active_sort (org_id, is_active, sort_order)`.
  - RLS Policies: Tenant isolation strictly enforced on `services` table for authenticated tenant members and super admins (`Migration 26`).
- **Booking Integration:**
  - Public booking `/api/book/[slug]` queries active services only: `.eq('org_id', org.id).eq('is_active', true).order('sort_order', { ascending: true })`.
  - `createBooking` in `src/lib/booking/booking-manager.ts` validates that the selected `serviceId` belongs to `orgId`, is active, and persists `service_id: activeService.id` directly to the `appointments` row.

---

## 3. Implementation

### A. Backend Route Hardening & Creation
1. **`src/app/api/client/services/route.ts`**:
   - **`GET`**: Authenticates user via `getTenantContext('appointments:read')`. Returns `{ config, services }` scoped strictly to `orgId`.
   - **`POST`**:
     - Enforces RBAC with `getTenantContext('org:update')` (owner and admin permitted; members rejected with `403 Forbidden`; unauthenticated rejected with `401 Unauthorized`).
     - Validates `name` (required, non-empty, max 100 characters).
     - Validates `duration_minutes` (positive integer between 1 and 1440 minutes, default 60).
     - Validates `price` (non-negative number rounded to 2 decimal places, or `null` for custom quotes/free consultations).
     - Validates `requires_address` (boolean, default true) and `is_active` (boolean, default true).
     - Checks for duplicate service names within tenant (case-insensitive check + catches Postgres constraint `23505` / `uq_services_org_id_name`), returning `409 Conflict` with `"A service with this name already exists"`.
   - **`PUT`**: Preserved for backward-compatible booking configuration updates.

2. **`src/app/api/client/services/[id]/route.ts`**:
   - **`GET`**: Returns single service with tenant isolation verification (`404` if nonexistent or cross-tenant).
   - **`PATCH`**:
     - Requires `'org:update'`.
     - Validates ID and verifies tenant boundary (IDOR protection).
     - Updates `name`, `duration_minutes`, `price`, `description`, `is_active`, `requires_address`, and `sort_order`.
     - Performs duplicate name collision check excluding current record (returns `409 Conflict`).
     - Updates `updated_at`.
   - **`DELETE`**:
     - Requires `'org:update'`.
     - Verifies tenant boundary.
     - **Historical Data Safety:** Queries `appointments`, `jobs`, and `quotes` using head count queries for `service_id = id`.
       - If references exist: Performs **soft-deactivation** (`is_active = false`), preserving foreign keys and historical reporting integrity. Returns `{ success: true, deactivated: true, message: '...' }`.
       - If unreferenced: Safely hard-deletes the row.

### B. Client Portal UI
1. **`src/app/client/layout.tsx`**:
   - Added `{ href: '/client/services', label: 'Services', icon: Wrench }` under the `Management` navigation section.
2. **`src/app/client/services/page.tsx`**:
   - Responsive client portal page matching CaptoDesk dark-theme design system.
   - Header with quick link to public booking page (`/book/[slug]`) and primary "Add Service" CTA.
   - **Default Onboarding Banner:** Displays intelligent banner when the auto-generated `"General Service"` exists, giving business owners a 1-click pathway to customize or deactivate it once their custom offerings are configured.
   - **Status Tabs & Search Filter:** Live filtering by All, Active, Inactive, plus instant full-text search by title or description.
   - **Service Grid Cards:**
     - Status badges: Active (green/emerald) vs Inactive (zinc/muted).
     - Detail chips: Duration (`X min` with clock), Price (`$X.XX` or `Custom Quote`), and Address requirement (`Address required` vs `Remote / No address`).
     - One-click quick toggle switch for instant activation/deactivation.
     - Edit modal and Remove confirmation dialog with historical protection disclosure.
   - **Create / Edit Modal:**
     - Preset buttons for common durations (30m, 60m, 90m, 120m) plus arbitrary integer input.
     - Form validation with inline error banners (including 409 duplicate name handling).

---

## 4. API Changes Summary

| Method | Endpoint | Authorization | Behavior |
|---|---|---|---|
| `GET` | `/api/client/services` | `appointments:read` / `org:view` | Returns tenant config and all services for tenant. |
| `POST` | `/api/client/services` | `org:update` (Owner / Admin) | Validates input, checks name uniqueness, creates service. Returns 201. |
| `PUT` | `/api/client/services` | `org:update` (Owner / Admin) | Updates organization booking rules (hours, buffers, notices). |
| `GET` | `/api/client/services/[id]` | `appointments:read` / `org:view` | Returns single service record; fails 404 on cross-tenant ID. |
| `PATCH` | `/api/client/services/[id]` | `org:update` (Owner / Admin) | Updates service fields; verifies tenant boundary; 409 on name duplicate. |
| `DELETE` | `/api/client/services/[id]` | `org:update` (Owner / Admin) | Soft-deactivates if referenced by appointments/jobs; deletes if unreferenced. |

---

## 5. UI Changes Summary

- **Navigation:** Added `Services` item with `Wrench` icon to `Management` section in `src/app/client/layout.tsx`.
- **Management Page:** Created `src/app/client/services/page.tsx` with:
  - Service grid with status pills, durations, prices, address requirements.
  - Active/Inactive tab filter with live count counters.
  - Search bar.
  - Onboarding banner for default "General Service".
  - Add & Edit service modals with duration presets and validation.
  - Historical data-preserving remove dialog.

---

## 6. Authorization & Tenant Isolation

- Role `member` attempting mutation receives `403 Forbidden: Role 'member' lacks permission for 'org:update'`.
- Unauthenticated requests receive `401 Unauthorized`.
- Cross-tenant requests (e.g. Tenant A attempting to read, modify, or delete a service belonging to Tenant B) return `404 Not Found` (fail-closed IDOR prevention).
- Organization ID is derived strictly from server-authenticated session profile, never trusted from client payloads.

---

## 7. Historical Data Safety

- Foreign key constraints on `appointments.service_id`, `jobs.service_id`, and `quotes.service_id` are configured with `ON DELETE SET NULL`.
- If a service has been used in past appointments or jobs, attempting to remove it triggers an automatic soft-deactivation (`is_active = false`) instead of row deletion.
- All historical appointment records, invoice line items, and analytics retain their original `service_id` associations without data corruption.

---

## 8. Public Booking Integration

- `/api/book/[slug]` continues querying active services (`is_active = true`).
- Inactive services are immediately removed from customer selection.
- `createBooking` validates that the selected `serviceId` is active and belongs to the booking organization, and persists the UUID in `appointments.service_id`.

---

## 9. Tests Added

A dedicated test suite was created in `test/p1-ops-service-catalog.test.mjs` verifying all 16 prompt requirements:

1. **TEST 1:** Create service with name, price, duration, description, and address requirement (status 201).
2. **TEST 2:** Read services for tenant in sorted order.
3. **TEST 3:** Update service details via PATCH (status 200).
4. **TEST 4:** Deactivate service (`is_active = false`) via PATCH.
5. **TEST 5:** Unauthorized user rejected (`member` receives 403 on POST, PATCH, DELETE; unauthenticated receives 401).
6. **TEST 6:** Cross-tenant access rejected (Tenant A cannot read, update, or delete Tenant B services — status 404).
7. **TEST 7:** Invalid name rejected (empty string, whitespace, > 100 characters receive 400).
8. **TEST 8:** Invalid duration rejected (<= 0, non-integer, > 1440 receive 400).
9. **TEST 9:** Invalid price rejected (negative numbers receive 400; valid decimals rounded cleanly to 2 decimal places).
10. **TEST 10:** Duplicate service rejected cleanly (case-insensitive name collision returns 409).
11. **TEST 11:** Concurrent duplicate creation handled safely (database constraint violation caught and returns 409).
12. **TEST 12:** Public booking sees active service.
13. **TEST 13:** Public booking excludes inactive service.
14. **TEST 14:** Appointment creation stores correct service UUID.
15. **TEST 15:** Historical records remain safe on deactivation (deleting service with appointment history soft-deactivates).
16. **TEST 16:** General Service behavior (default onboarding service can be renamed, repriced, or deactivated without error).

---

## 10. Regression Results

- **Unit & Control-Plane Tests (`npm test`):** **468 / 468 PASS** (16 new tests, 0 failures)
- **Security Tests (`npm run test:security`):** **55 / 55 PASS**
- **Integration Tests (`npm run test:integration`):** **15 / 15 PASS**
- **TypeScript Typecheck (`npm run typecheck`):** **PASS** (0 errors)
- **ESLint (`npm run lint`):** **PASS** (0 errors)
- **Production Build (`npm run build`):** **PASS** (59 static & dynamic routes compiled)

---

## 11. Files Changed

- `src/app/api/client/services/route.ts` — Hardened POST with RBAC `org:update`, validation, duplicate handling (409), and optional test dependency injection.
- `src/app/api/client/services/[id]/route.ts` — Created endpoint with GET, PATCH, and DELETE handlers, tenant isolation, and historical reference protection.
- `src/app/client/layout.tsx` — Added `Services` navigation item under `Management`.
- `src/app/client/services/page.tsx` — Created responsive Service Catalog management page.
- `test/p1-ops-service-catalog.test.mjs` — Created comprehensive 16-test verification suite.
- `package.json` — Added `test/p1-ops-service-catalog.test.mjs` to `scripts.test`.

---

## 12. Remaining Limitations

- Real Telnyx DID provisioning continues to defer live phone number purchases until the first paying customer (`LIVE TELNYX PROVIDER VERIFICATION: DEFERRED`).
- Drag-and-drop manual re-ordering (`sort_order`) in the UI is slated for future UX enhancement (currently sorted by `sort_order` then creation date).
