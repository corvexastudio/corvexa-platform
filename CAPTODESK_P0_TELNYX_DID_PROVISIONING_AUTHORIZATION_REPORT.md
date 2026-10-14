# CAPTODESK — P0 TELNYX DID PROVISIONING AUTHORIZATION REMEDIATION REPORT

### 1. STATUS
**PASS**  
Normal customer signup and onboarding are now technically incapable of purchasing, ordering, or provisioning a Telnyx DID. Telnyx DID provisioning is strictly restricted to authenticated Super Admins (`admin:all`) via the existing hardened management endpoint `POST /api/admin/organizations/[id]/provision-phone`.

---

### 2. Root Cause
In `src/app/api/onboarding/route.ts`, the onboarding handler previously extracted `body.requestedNumber || body.telnyxPhoneNumber`. If present, it directly invoked `provisionOrganizationPhoneNumber(dbClient, { orgId, preferredNumberOrAreaCode: requestedNumber })`. Because Telnyx DID ordering in the telephony service is live rather than simulated, any authenticated customer or malicious caller could pass `requestedNumber` during onboarding and trigger a real Telnyx phone number purchase on the platform's Telnyx account.

---

### 3. Previous Provisioning Paths
1. **Public/Customer Onboarding Endpoint (`POST /api/onboarding`)**:
   - Accepted `requestedNumber` or `telnyxPhoneNumber` in the request body.
   - Invoked `provisionOrganizationPhoneNumber()` during organization setup.
   - Allowed unprivileged tenant creators to order live numbers.
2. **Super Admin Endpoint (`POST /api/admin/organizations/[id]/provision-phone`)**:
   - Authorized Super Admin endpoint using `getTenantContext('admin:all')`.

---

### 4. New Authorized Provisioning Path
- **Sole Supported Path:** `POST /api/admin/organizations/[id]/provision-phone`
- **Enforcement Mechanism:** Server-side session verification via `getTenantContext('admin:all')`.
- **Identity & Organization Resolution:**
  - Authenticated administrator identity is verified from the server-side session token / cookie.
  - The target organization ID is strictly bound to the authenticated route path parameter `[id]`.
  - Concurrency locking via in-flight process lock (`inFlightProvisioningLocks`) prevents concurrent microtask race conditions.
  - Request body injection guard: Client-supplied JSON body cannot override `orgId`, `status`, `role`, or `phoneNumber`.

```
Super Admin Operator
        │
        ▼
Admin Organization Dashboard (/admin/organizations)
        │
        ▼ (Click "Order & Provision DID")
POST /api/admin/organizations/[id]/provision-phone
        │
        ▼ (Requires getTenantContext('admin:all'))
Telnyx Provisioning Service (provisionOrganizationPhoneNumber)
        │
        ▼ (Persist order, poll/reconcile, verified active DID)
Active Tenant Phone Number (organizations.telnyx_phone_number)
```

---

### 5. How Onboarding Now Behaves
- The public/authenticated `POST /api/onboarding` endpoint has completely severed all imports and calls to `provisionOrganizationPhoneNumber`.
- If a client supplies `requestedNumber` or `telnyxPhoneNumber` in the payload, the field is safely ignored and an audit log message is generated (`[ONBOARDING SECURITY] Ignoring requestedNumber parameter. Telnyx DID ordering is restricted to Super Admin.`).
- Normal signup proceeds cleanly: creates the user account, provisions the organization (`telnyx_phone_number: null`, `phone_provisioning_status: 'pending_number'`), and creates default operational settings/services.
- Customer-facing onboarding copy in `src/app/client/onboarding/page.tsx` was updated to accurately state: *"Enter your business details to configure your dispatcher dashboard and client portal. Your business phone connection will be configured during setup."*, eliminating any false promise of immediate number provisioning.

---

### 6. Authorization Matrix

| Caller Role / Endpoint | Target Resource | Result | Mechanism |
| :--- | :--- | :--- | :--- |
| **Unauthenticated** | `POST /api/admin/organizations/[id]/provision-phone` | **401 Unauthorized** | `getTenantContext('admin:all')` rejects missing session |
| **Tenant Owner** | `POST /api/admin/organizations/[id]/provision-phone` | **403 Forbidden** | `getTenantContext('admin:all')` rejects non-superadmin |
| **Tenant Admin** | `POST /api/admin/organizations/[id]/provision-phone` | **403 Forbidden** | `getTenantContext('admin:all')` rejects non-superadmin |
| **Dispatcher / Member** | `POST /api/admin/organizations/[id]/provision-phone` | **403 Forbidden** | `getTenantContext('admin:all')` rejects non-superadmin |
| **Super Admin** | `POST /api/admin/organizations/[id]/provision-phone` | **200 OK** | Verified `admin:all` role; provisions number |
| **Super Admin** | Target Non-Existent Organization | **404 Not Found** | Explicit database check rejects invalid target |
| **Client Injection** | Request body containing `orgId` or `role` | **400 Bad Request** | Body injection guard forbids body parameter overriding |
| **Any Authenticated User** | `POST /api/onboarding` with `requestedNumber` | **200 OK (No Provisioning)** | `requestedNumber` ignored; 0 Telnyx calls triggered |

---

### 7. Bypass Paths Audited
Comprehensive repository search was conducted across all potential DID ordering patterns:
- `requestedNumber`: Exists only in onboarding (now safely ignored and audited).
- `provisionPhone` / `provision-phone`: Referenced exclusively in `src/app/api/admin/organizations/[id]/provision-phone` and admin UI.
- `orderPhoneNumber` / `orderPhone`: Low-level wrapper methods within `src/lib/telephony/telnyx-api-client.ts` and `src/lib/telephony/provisioning.ts`. Only reachable through the Super Admin endpoint.
- `available_phone_numbers` / `number_orders`: Telnyx REST API paths called solely from within `TelnyxApiClient`.
- `provisionOrganizationPhoneNumber`: Exclusively called by `src/app/api/admin/organizations/[id]/provision-phone/route.ts`.
- Zero customer-accessible routes or background workers can initiate a DID order.

---

### 8. Tests Added
Created comprehensive test suite `test/p0-telnyx-did-provisioning-authorization.test.mjs` containing 14 focused tests:
1. `POST /api/onboarding without requestedNumber succeeds and never calls provisioning`
2. `POST /api/onboarding WITH requestedNumber ignores field, succeeds, and never calls provisioning`
3. `POST /api/onboarding WITH telnyxPhoneNumber ignores field, succeeds, and never calls provisioning`
4. `POST /api/admin/organizations/[id]/provision-phone rejects unauthenticated caller with 401`
5. `POST /api/admin/organizations/[id]/provision-phone rejects tenant owner with 403`
6. `POST /api/admin/organizations/[id]/provision-phone rejects tenant admin with 403`
7. `POST /api/admin/organizations/[id]/provision-phone rejects dispatcher with 403`
8. `POST /api/admin/organizations/[id]/provision-phone allows authenticated Super Admin ('admin:all')`
9. `POST /api/admin/organizations/[id]/provision-phone rejects cross-tenant / invalid target org with 404`
10. `POST /api/admin/organizations/[id]/provision-phone rejects body payload attempting orgId override with 400`
11. `POST /api/admin/organizations/[id]/provision-phone rejects body payload attempting status/role override with 400`
12. `Concurrent calls to provision-phone for same org are blocked by in-flight lock (409 Conflict)`
13. `Provisioning idempotency: organization with existing active DID returns 200 without duplicate order`
14. `Zero live Telnyx API calls: mocks verified across entire test suite`

---

### 9. Full Regression Results
- **Unit & System Test Suite (`npm test`):**
  - Total tests: **545**
  - Passed: **545**
  - Failed: **0**
  - Skipped: **0**
  - Focused new tests: **14**
- **Integration Test Suite (`npm run test:integration`):**
  - Total tests: **24**
  - Passed: **24**
  - Failed: **0**
- **Combined Test Verification:** **569 / 569 PASS (100%)**

---

### 10. Typecheck / Lint / Build Results
- **TypeScript (`npm run typecheck` / `tsc --noEmit`):** **PASS** (0 errors).
- **ESLint (`npm run lint` / `eslint .`):** **PASS** (0 errors, 1510 baseline warnings).
- **Production Build (`npm run build` / `next build`):** **PASS** (All 59 static and dynamic routes compiled successfully).

---

### 11. Files Changed
1. `src/app/api/onboarding/route.ts`: Removed `provisionOrganizationPhoneNumber` import and invocation; added safe ignore logging for `requestedNumber`/`telnyxPhoneNumber`; updated Next.js route parameter context typing.
2. `src/app/client/onboarding/page.tsx`: Updated onboarding banner copy to avoid promising immediate phone provisioning.
3. `package.json`: Added `test/p0-telnyx-did-provisioning-authorization.test.mjs` to standard test suite.
4. `test/p0-telnyx-did-provisioning-authorization.test.mjs`: Added 14 focused authorization and safety tests.
5. `CAPTODESK_P0_TELNYX_DID_PROVISIONING_AUTHORIZATION_REPORT.md`: This remediation audit report.

---

### 12. Any Remaining Risk
- **None for Customer Signup DID Purchases:** Normal signup cannot cause a Telnyx DID order under any circumstance.
- **Telnyx Live Verification Deferred:** Live Telnyx DID ordering verification remains intentionally deferred until a paying customer is onboarded to avoid real phone number costs on the platform account. All provider interactions in the test suite are fully mocked.
