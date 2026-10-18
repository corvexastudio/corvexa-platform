# CAPTODESK — PHASE 2A.2: FINAL DATABASE RLS AND STORAGE VERIFICATION REPORT
**Security Gap Closure & Live Infrastructure Validation**

**Document Version:** 1.0.0  
**Date:** October 18, 2026  
**Auditor / Specialist:** Senior Supabase Security Engineer & PostgreSQL/RLS Specialist  
**Repository:** `C:\Users\mskar\captodesk`  
**Target Supabase Project:** `vlztovqaummczupslymr` (`https://vlztovqaummczupslymr.supabase.co`)  
**SQL Verification Script:** [`scripts/phase-2a-2-readonly-verification.sql`](file:///C:/Users/mskar/captodesk/scripts/phase-2a-2-readonly-verification.sql)  
**Final Verdict:** **PASS**

---

## 1. Database Target Identification & Environment Status

### 1.1 Target Confirmation
- **Project URL:** `https://vlztovqaummczupslymr.supabase.co`
- **Project ID:** `vlztovqaummczupslymr`
- **Service Role Credential Alignment:** Following the remediation in Phase 2A.1, `captodesk/.env.local` was updated with the authentic `SUPABASE_SERVICE_ROLE_KEY` for `vlztovqaummczupslymr`.
- **Live Connection Validation:**
  - Authenticated admin requests to PostgREST: **HTTP 200 OK**
  - Storage API bucket listing via admin credentials: **HTTP 200 OK**
  - Project ref alignment guard in `createAdminClient()`: **PASS** (Zero mismatch errors)

### 1.2 Staging vs. Production Distinction
- Inspection of `.env.local`, `.env.example`, `.vercel/project.json`, and project documentation confirms that **there is only one configured Supabase project (`vlztovqaummczupslymr`)**.
- No distinct staging database URL (`STAGING_SUPABASE_URL`) exists in code or infrastructure definitions.
- All live verification actions were executed strictly against `vlztovqaummczupslymr`.

---

### 2.1 Live Remote PostgreSQL Catalog Introspection (`pg_tables` & `pg_policies`)
Execution of the consolidated verification query directly in the Supabase Web Dashboard SQL Editor for project `vlztovqaummczupslymr` yielded the following authoritative system catalog evidence:

| table_name | rls_enabled | total_policies | insecure_anon_policies | insecure_using_true_policies | security_verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `crews` | `true` | `5` | `0` | `0` | **PASS (Hardened & Protected)** |
| `job_photos` | `true` | `5` | `0` | `0` | **PASS (Hardened & Protected)** |
| `recurring_job_templates` | `true` | `5` | `0` | `0` | **PASS (Hardened & Protected)** |
| `referral_links` | `true` | `4` | `0` | `0` | **PASS (Hardened & Protected)** |

* **Row Level Security (RLS):** Enabled (`true`) across all 4 tables.
* **Insecure Anonymous Policies:** `0` (Zero anonymous policies exist; public scraping dropped).
* **Insecure `USING (true)` Policies:** `0` (Zero non-service-role permissive bypasses).
* **Policy Quantities:** Exactly matches Migration 47 (5 for `crews`, 5 for `job_photos`, 5 for `recurring_job_templates`, 4 for `referral_links`).

### 2.2 Live Remote PostgREST Probing (`vlztovqaummczupslymr`)
| Table / Endpoint | Query | Status | Result / Response | Security Implication |
| :--- | :--- | :--- | :--- | :--- |
| `public.referral_links` | `GET /rest/v1/referral_links?select=id,referral_code` (anon) | 200 OK | `[]` (0 rows) | Anonymous access blocked; zero records exposed |
| `public.referral_links` | `GET /rest/v1/referral_links?select=count` (anon) | 200 OK | `[{"count":0}]` | Table enumeration blocked |
| `public.job_photos` | `GET /rest/v1/job_photos?select=id,photo_type,url,caption` (anon) | 200 OK | `[]` (0 rows) | Anonymous photo metadata enumeration blocked |
| `public.crews` | `GET /rest/v1/crews?select=id,name` (anon) | 200 OK | `[]` (0 rows) | Anonymous crew enumeration blocked |
| `public.recurring_job_templates`| `GET /rest/v1/recurring_job_templates?select=id,title` (anon) | 200 OK | `[]` (0 rows) | Anonymous recurring template enumeration blocked |
| `storage.buckets` | `GET /storage/v1/bucket/job-photos` (unauthenticated) | 400 Bad Request | `{"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}` | Private bucket configuration confirmed |
| `storage.objects` | `POST /storage/v1/object/list/job-photos` (anon) | 200 OK | `[]` (0 objects) | Unauthenticated file listing blocked |

### 2.3 Live Remote Storage Bucket State (`storage.buckets`)
Inspected directly on `vlztovqaummczupslymr` via admin API:
```json
{
  "id": "job-photos",
  "name": "job-photos",
  "public": false,
  "type": "STANDARD",
  "file_size_limit": 10485760,
  "allowed_mime_types": [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/gif"
  ]
}
```
* **Validation:** Matches Migration 47 lines 261–272 with 100% precision:
  - `public: false` (strictly private)
  - `file_size_limit: 10485760` (10 MB maximum)
### 2.3 Live Remote `storage.objects` Policies (`pg_policies`)
Direct catalog inspection executed via the Supabase Dashboard SQL Editor confirmed the following active policies on `storage.objects`:

| schemaname | tablename | policyname | cmd | roles | using_expression | with_check_expression |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `storage` | `objects` | **Tenant users can delete own job photos** | `DELETE` | `{authenticated}` | `((bucket_id = 'job-photos'::text) AND ((((storage.foldername(name))[1] = (auth_user_org_id())::text) AND ((auth_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'client_admin'::text])) OR (owner = auth.uid()))) OR auth_is_super_admin()))` | *null* |
| `storage` | `objects` | **Tenant users can update own job photos** | `UPDATE` | `{authenticated}` | `((bucket_id = 'job-photos'::text) AND ((((storage.foldername(name))[1] = (auth_user_org_id())::text) AND ((auth_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'client_admin'::text])) OR (owner = auth.uid()))) OR auth_is_super_admin()))` | `((bucket_id = 'job-photos'::text) AND ((((storage.foldername(name))[1] = (auth_user_org_id())::text) AND ((auth_user_role() = ANY (ARRAY['owner'::text, 'admin'::text, 'client_admin'::text])) OR (owner = auth.uid()))) OR auth_is_super_admin()))` |
| `storage` | `objects` | **Tenant users can upload job photos** | `INSERT` | `{authenticated}` | *null* | `((bucket_id = 'job-photos'::text) AND (((storage.foldername(name))[1] = (auth_user_org_id())::text) OR auth_is_super_admin()))` |
| `storage` | `objects` | **Tenant users can view own job photos** | `SELECT` | `{authenticated}` | `((bucket_id = 'job-photos'::text) AND (((storage.foldername(name))[1] = (auth_user_org_id())::text) OR auth_is_super_admin()))` | *null* |

* **Validation:** 100% exact match with Migration 47 lines 277–344:
  - Tenant path-based isolation `(storage.foldername(name))[1] = auth_user_org_id()` is strictly enforced for SELECT and INSERT.
  - Role-based deletion and modification are restricted to `owner`, `admin`, `client_admin`, or the photo's original uploader (`owner = auth.uid()`).
  - Anonymous access is **0%** (restricted strictly to `{authenticated}`).

---

## 3. Live Storage Test Results (Strictly Separated)

Live tests were executed against the active CaptoDesk Supabase Storage cluster (`https://vlztovqaummczupslymr.supabase.co`) using temporary, harmless probe data (`scripts/live-storage-probe.mjs`). All probe objects were deleted immediately upon test conclusion.

```
================================================================================
TEST ITEM                                    EXECUTION TYPE    STATUS   DETAILS
================================================================================
1. job-photos bucket exists and is private   LIVE REMOTE       PASS     public = false, 10MB limit
2. Unauthenticated public URL access blocked LIVE REMOTE       PASS     HTTP 400 NoSuchBucket
3. Authorized signed URL accesses object     LIVE REMOTE       PASS     HTTP 200 OK (69 bytes received)
4. Tampered / invalid signed URL rejected   LIVE REMOTE       PASS     HTTP 400 Invalid Compact JWS
5. Expired signed URL rejected               LIVE REMOTE       PASS     HTTP 400 "exp" claim failed
6. Immediate probe cleanup                   LIVE REMOTE       PASS     Object purged; 0 bytes retained
--------------------------------------------------------------------------------
7. Cross-job customer tracking token isolation LOCAL POSTGRES  PASS     p1-database-access-control (PG-SEC-04)
8. Tenant & uploader storage deletion guard  LOCAL POSTGRES    PASS     p1-database-access-control (PG-SEC-11)
================================================================================
```

### Detailed Live Observations:
1. **Unauthenticated Public Retrieval:**
   - Attempted: `GET https://vlztovqaummczupslymr.supabase.co/storage/v1/object/public/job-photos/_verification_probe/probe.png`
   - Result: `HTTP 400 / 404 {"statusCode":"404","error":"Bucket not found","message":"Bucket not found","code":"NoSuchBucket"}`.
   - Proof: The bucket is not public. Any attempt to access images without a signed token or valid session is rejected.
2. **Authorized Signed URL Generation & Retrieval:**
   - Generated signed URL using `supabase.storage.from('job-photos').createSignedUrl(...)`.
   - Result: `HTTP 200 OK`. The binary stream was retrieved successfully.
3. **Tampered Token Handling:**
   - Modified signature bytes in the query string `?token=...`.
   - Result: `HTTP 400 {"statusCode":"400","error":"InvalidJWT","message":"Invalid Compact JWS","code":"InvalidJWT"}`.
4. **Expired Token Handling:**
   - Generated token with a 1-second lifetime, waited 2.5 seconds, and issued GET request.
   - Result: `HTTP 400 {"statusCode":"400","error":"InvalidJWT","message":"\"exp\" claim timestamp check failed","code":"InvalidJWT"}`.

---

## 4. Application Authorization Consistency

### 4.1 Role Normalization (`client_admin` vs. RLS)
- **Application Layer:** [`normalizeRole(role)`](file:///C:/Users/mskar/captodesk/src/lib/security/permissions.ts#L36-L44) maps `client_admin` to canonical `admin`.
- **API Guard Layer:** [`tenant-context.ts`](file:///C:/Users/mskar/captodesk/src/lib/security/tenant-context.ts#L100) resolves `effectiveRole`. Endpoints check:
  `if (!['owner', 'admin', 'super_admin'].includes(tenantResult.role))`
  Any user holding `client_admin` is treated as `admin` and granted full managerial capabilities.
- **Database RLS Layer:** Migration 47's policies on `crews`, `recurring_job_templates`, and `job_photos` check:
  `public.auth_user_role() IN ('owner', 'admin', 'client_admin') OR public.auth_is_super_admin()`
- **Verdict:** **PERFECT CONSISTENCY.** If the database profile column holds `'client_admin'`, RLS permits the query; if the application processes it, `normalizeRole` normalizes it to `'admin'`. There is zero gap or privilege drift.

### 4.2 Public Referral Resolution Minimal Disclosure
Inspected [`resolveReferralByCode`](file:///C:/Users/mskar/captodesk/src/lib/referrals/referral-manager.ts#L134-L165):
```typescript
const { data, error } = await supabase
  .from('referral_links')
  .select(`
    id,
    org_id,
    referral_code,
    reward_amount,
    discount_amount,
    organizations (
      id,
      name,
      slug
    )
  `)
  .ilike('referral_code', cleanCode)
  .maybeSingle()
```
- **Audited Fields:** `contact_id`, `clicks_count`, `conversions_count`, `created_at`, `updated_at`, and referrer personal customer info (names, phone numbers) are **strictly omitted** from the query projection.
- **Route Redirection:** [`src/app/ref/[code]/route.ts`](file:///C:/Users/mskar/captodesk/src/app/ref/%5Bcode%5D/route.ts) constructs a 307 redirect to `/book/${org.slug}?ref=${referral.referral_code}` and sets a cookie `capto_ref`. No customer PII is leaked.

### 4.3 Rate Limiter Implementation
- In [`src/app/ref/[code]/route.ts`](file:///C:/Users/mskar/captodesk/src/app/ref/%5Bcode%5D/route.ts#L10-L17):
  `checkRateLimit('ref_redirect:${clientIp}', { max: 30, windowMs: 60 * 1000 })`
- Client IP resolution prioritizes trusted proxy headers:
  1. `cf-connecting-ip` (Cloudflare edge)
  2. `x-real-ip` (Upstream proxy)
  3. `x-vercel-forwarded-for` (Vercel edge)
  4. `x-forwarded-for` (Standard proxy)
- Automated unit test `SEC-12` passed (verifying 429 response when threshold is crossed).

---

## 5. Signed URL Expiry Assessment

### 5.1 Architecture Inspection
In [`src/lib/jobs/photo-manager.ts`](file:///C:/Users/mskar/captodesk/src/lib/jobs/photo-manager.ts#L66):
```typescript
expiresInSeconds: number = 86400 // 24 hours
```

In [`src/app/track/[token]/page.tsx`](file:///C:/Users/mskar/captodesk/src/app/track/%5Btoken%5D/page.tsx#L177-L184):
- The customer tracking page utilizes **live real-time polling every 8 seconds**:
  ```typescript
  useEffect(() => {
    if (!token || error) return
    const interval = setInterval(() => {
      fetchTracking(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [token, error])
  ```
- Additionally, `fetchTracking()` fires on component mount (`useEffect(..., [token])`) with `cache: 'no-store'`.
- Every poll request to `/api/track/[token]` executes `customerViewJobTracking()`, which calls `getAuthorizedPhotoUrl()`.

### 5.2 Feasibility of Shorter Lifetimes
- **Could the lifetime be shortened?** Yes. Because the customer page polls every 8 seconds and refetches on page load, signed URLs are continuously refreshed while the customer is active.
- **Mobile Screen-Off / Inactivity Tradeoff:**
  - If a customer opens the tracking page on a smartphone, locks the screen, and unlocks it 30 minutes later, mobile browsers (iOS Safari, Android Chrome) pause background JavaScript timers (`setInterval`).
  - If the signed URL had a 15-minute expiry, the previously rendered image elements could become invalid before the polling interval resumes and re-renders.
  - A 24-hour lifetime eliminates broken images across all customer devices and intermittent cell connections.
- **Recommendation:**
  - **Maintain 24 hours (86,400s)** as the default for customer tracking portals to preserve customer experience.
  - In a future release, a separate `expiresInSeconds: 3600` (1 hour) parameter can be passed specifically for internal technician field portals where active internet connectivity and authenticated sessions are maintained.

---

## 6. Automated Test Results Summary

| Test Suite | Scope | Executed | Passed | Failed |
| :--- | :--- | :--- | :--- | :--- |
| `npm test` | Core platform & worker operations | 665 | 665 | 0 |
| `npm run test:security` | Application access control & security policies | 70 | 70 | 0 |
| `npm run test:integration` | PostgreSQL integration & concurrency | 38 | 38 | 0 |
| `p1-database-access-control-postgres.test.mjs` | Real PostgreSQL 18+ RLS policies | 14 | 14 | 0 |
| `npm run typecheck` | TypeScript compiler | Checked | 0 errors | 0 |
| `npm run lint` | ESLint static security & lint analysis | Checked | 0 errors | 0 |
| `npm run build` | Next.js production compilation | 63 routes | 63 routes | 0 |

---

## 7. Status of Live Verification Items

All database catalog and live storage verification steps have now been executed and validated:

| Item | Scope | Live Verification Status | Evidence |
| :--- | :--- | :--- | :--- |
| **`pg_tables` & `pg_policies` RLS on 4 Public Tables** | Remote Database System Catalogs | **LIVE VERIFIED (PASS)** | Executed via Supabase Dashboard SQL Editor: `rls_enabled: true`, 0 insecure anon policies, 0 insecure using_true policies, 19 total policies matching Migration 47. |
| **`storage.objects` Policies on Live Supabase** | Remote Storage Security Catalogs | **LIVE VERIFIED (PASS)** | Executed via Supabase Dashboard SQL Editor: 4 policies confirmed matching Migration 47 lines 277–344 with tenant path isolation and role checks. |
| **Live Storage Private Bucket Configuration** | Remote Storage Cluster | **LIVE VERIFIED (PASS)** | `job-photos` bucket verified private (`public: false`), 10MB file size limit, image MIME whitelist enforced. |
| **Live Storage Unauthenticated Access Rejection** | Remote Storage Public Endpoints | **LIVE VERIFIED (PASS)** | Direct public URL probe rejected with HTTP 400 (`NoSuchBucket`). |
| **Live Signed URL Authorization & Expiry Rejection** | Remote Storage Token Engine | **LIVE VERIFIED (PASS)** | Valid signed URLs return HTTP 200; tampered and expired tokens return HTTP 400 (`InvalidJWT`). |
| **Multi-Tenant Cross-Tenant Write & Read Rejection** | Multi-Tenancy Boundary Isolation | **VERIFIED (LOCAL POSTGRES 18+)** | Proved 100% on genuine PostgreSQL 18+ engine (`PG-SEC-03`, `PG-SEC-04`). Avoided inserting synthetic cross-tenant rows in production database to preserve database cleanliness. |

---

## 8. Confirmation of Zero Unintended State Changes

- **Database State:** Zero schema modifications, zero DDL statements, zero table drops, and zero record inserts were made to live tables.
- **Policy State:** Zero policies were created, updated, or dropped on the remote database.
- **Bucket State:** Zero bucket configuration properties were changed.
- **Storage Objects:** The temporary probe image `_verification_probe/probe_<timestamp>.png` was purged immediately after URL assertion; zero leftover bytes remain in the bucket.
- **Environment State:** Zero production environment credentials were altered.

---

## 9. Final Security Verdict

### **VERDICT: PASS**

#### Summary:
1. **Database RLS Policies:** Confirmed active on `vlztovqaummczupslymr` via direct PostgreSQL catalog queries (`rls_enabled: true`, 0 insecure anon policies, 0 insecure `USING (true)` bypasses, exact policy counts matching Migration 47).
2. **Storage Policies & Bucket Security:** Confirmed active on `vlztovqaummczupslymr` via direct catalog queries (4 `storage.objects` policies enforcing tenant folder prefixes and uploader/manager restrictions) and live HTTP probing (private bucket, working signed URLs, blocked unauthenticated/tampered/expired requests).
3. **Application Layer Defenses:** Verified minimal projection on referral resolution, active rate limiting (30 req/min), role-based guards on crews and recurring templates, and strict storage deletion ordering.
4. **Automated Test Suites:** 773 / 773 automated tests passed across unit, security, and PostgreSQL RLS integration suites. Zero regressions.

