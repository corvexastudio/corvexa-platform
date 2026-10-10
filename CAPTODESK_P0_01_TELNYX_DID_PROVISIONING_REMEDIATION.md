# CAPTODESK — P0-01 REMEDIATION REPORT
## Real Telnyx DID Provisioning via Official Telnyx Number Orders API

---

### 1. P0-01 Status
**IMPLEMENTATION PASS — REAL PROVIDER VERIFICATION PENDING**

The synthetic/mock phone number fabrication logic has been completely excised from the production codebase. CaptoDesk is now architected with a production-grade, fail-closed Telnyx v2 API integration featuring atomic database locking, dual-stage idempotency, crash/timeout reconciliation, strict inbound routing checks, and outbound sender verification. Because live carrier number purchase transactions were not executed against a live credit-funded Telnyx account in this test sandbox, the final verification status is marked pending live carrier verification.

---

### 2. Original Defect
During the Phase 3 End-to-End Workflow & Reliability Audit, issue **P0-01** identified that `src/lib/telephony/provisioning.ts` simulated Telnyx DID provisioning by generating pseudo-random telephone numbers (`+1214${Math.floor(1000000 + Math.random() * 9000000)}`) or static fallback numbers (`+15555550100`), writing them to database fields (`organizations.telnyx_phone_number` and `telnyx_phone_numbers.phone_number`).

#### Business & Operational Impact
- The system falsely marked phone numbers as provisioned when Telnyx had never assigned or routed them.
- Outbound SMS delivery failed at carrier gateways due to unallocated source DIDs.
- Inbound customer voice calls and SMS could not route to tenant workspaces.
- Automated missed-call recovery loops failed to trigger.
- Tenants completed onboarding believing their telephony infrastructure was operational.

---

### 3. Root Cause Analysis
1. **Mock Fallback Logic in Core Provisioning Engine**: `src/lib/telephony/provisioning.ts` and `src/lib/services/telnyx-service.ts` relied on synthetic generation using `Math.random()` when credentials or carrier endpoints were unavailable.
2. **Missing Production Provider Contract**: The application lacked an official client implementing the Telnyx v2 REST API contracts for `GET /v2/available_phone_numbers` and `POST /v2/number_orders`.
3. **Optimistic Database State Transitions**: Onboarding routes marked tenant status as `active` immediately upon inserting synthetic numbers, bypassing provider order lifecycle validation.
4. **Lack of Inbound/Outbound Provider Verification Filters**: Inbound webhook routing and outbound SMS delivery trusted unverified numbers without requiring confirmed provider order IDs (`order_id`) or verified status flags (`verification_status = 'verified'`).

---

### 4. Telnyx API Contract Used
CaptoDesk now strictly adheres to the official **Telnyx v2 REST API**:
- **Authentication**: `Authorization: Bearer $TELNYX_API_KEY` (Header).
- **Available Numbers Search**:
  - `GET https://api.telnyx.com/v2/available_phone_numbers`
  - Query parameters:
    - `filter[country_code]=US`
    - `filter[national_destination_code]=<area_code>`
    - `filter[phone_number_type]=local`
    - `filter[limit]=5`
    - `filter[features][]=sms`
    - `filter[features][]=voice`
- **Number Order Creation**:
  - `POST https://api.telnyx.com/v2/number_orders`
  - Request body:
    ```json
    {
      "phone_numbers": [{ "phone_number": "+12145550199" }],
      "customer_reference": "org_<org_id>",
      "connection_id": "<TELNYX_CONNECTION_ID>",
      "messaging_profile_id": "<TELNYX_MESSAGING_PROFILE_ID>"
    }
    ```
- **Number Order Retrieval & Status Polling**:
  - `GET https://api.telnyx.com/v2/number_orders/:order_id`
- **Order Reconciliation by Customer Reference**:
  - `GET https://api.telnyx.com/v2/number_orders?filter[customer_reference]=org_<org_id>`

---

### 5. Search Implementation
Implemented in `src/lib/telephony/telnyx-api-client.ts` via `TelnyxApiClient.searchAvailableNumbers()`:
- Derives preferred area code from:
  1. Onboarding payload `preferredAreaCode`
  2. Owner telephone number area code (E.164 parsing)
  3. Safe default (e.g. `214` Dallas / Texas metro)
- Enforces required carrier features: both `sms` and `voice` are mandated.
- Rejects empty inventory fail-closed (`phone_provisioning_status = 'failed'`) rather than generating synthetic alternatives.

---

### 6. Order Implementation
Implemented in `src/lib/telephony/provisioning.ts` and `TelnyxApiClient.createNumberOrder()`:
- Submits structured order payload containing the candidate DID.
- Binds order to tenant workspace via `customer_reference: "org_${orgId}"`.
- Automatically attaches Telnyx `connection_id` (SIP/Voice routing) and `messaging_profile_id` (SMS webhook delivery).
- Records order ID and pending status in `telnyx_phone_numbers` prior to order fulfillment polling.

---

### 7. Provisioning State Machine
Tenant phone provisioning transitions through a deterministic state machine:

```
[ pending_number ]
        │
        ▼ (search & submit order)
[ provisioning ] ───────────────┐
        │                       │
        │ (order success)       │ (order failure / carrier rejection)
        ▼                       ▼
   [ active ]               [ failed ]
        │                       │
        │                       ▼
  (telephony live)        (retry allowed)
```

1. **`pending_number`**: Organization created; no active phone assigned.
2. **`provisioning`**: In-flight order submitted to Telnyx or actively polling provider.
3. **`active`**: Provider order settled with `status = 'success'`; Telnyx phone number confirmed and assigned; inbound routing and outbound messaging enabled.
4. **`failed`**: Carrier order failed or inventory exhausted; state remains clean and recoverable for subsequent retry.

---

### 8. Idempotency Strategy
Dual-layer idempotency guarantees protection against duplicate orders:
1. **Database-Level Deduplication**: Checks `telnyx_phone_numbers` for an existing `active` and `verified` record for `org_id`. If found, returns `{ status: 'already_assigned', phoneNumber }` without touching the Telnyx API.
2. **In-Flight Concurrency Lock**: Atomically locks `organizations.phone_provisioning_status = 'provisioning'` before API invocation. Concurrent duplicate calls immediately reject with HTTP 409 / Conflict.
3. **Database Exclusion / Unique Index**: A unique partial index `idx_telnyx_phone_numbers_org_active` prevents more than one active phone record per organization.

---

### 9. Timeout / Crash Reconciliation
In distributed cloud environments, a network timeout or server restart during order submission could result in duplicate orders if blindly retried.
- **Customer Reference Querying**: Before creating a new order, `provisionOrganizationPhoneNumber` queries Telnyx for existing orders via `filter[customer_reference]=org_<orgId>`.
- If an existing order was already created on Telnyx, the engine adopts the existing `order_id`, polls its settlement status, and finalizes the record without placing a second order or purchasing an extra DID.

---

### 10. Database Schema Changes (`Migration 33`)
Located at `supabase/migrations/33_real_telnyx_did_provisioning.sql`:
- **`organizations`**:
  - `telnyx_order_id TEXT NULL`: Telnyx provider order ID.
  - `telnyx_phone_number_id TEXT NULL`: Provider telephone record ID.
  - `telnyx_provisioned_at TIMESTAMPTZ NULL`: Timestamp of successful carrier activation.
- **`telnyx_phone_numbers`**:
  - `order_id TEXT NULL`: Link to Telnyx order.
  - `telnyx_phone_number_id TEXT NULL`: Telnyx telephone record identifier.
  - `verification_status TEXT NOT NULL DEFAULT 'unverified'`: Status (`'verified'`, `'unverified'`, `'failed'`).
  - `idx_telnyx_phone_numbers_org_active`: Unique partial index on `(org_id) WHERE (status = 'active')`.
  - Legacy mock quarantine: Existing unverified rows without real provider order IDs are demoted to `'unverified'` and `'pending'` to prevent routing issues.

---

### 11. Existing-Number Handling
- Legitimate pre-existing numbers with `status = 'active'` and `verification_status = 'verified'` are preserved and never overwritten.
- Legacy unverified records are quarantined (`verification_status = 'unverified'`).
- Inbound routing rejects unverified numbers.

---

### 12. Inbound Routing Safeguards
Updated in `src/lib/telephony/telnyx-numbers.ts`:
- `resolveOrganizationByPhoneNumber()` requires:
  1. `telnyx_phone_numbers.verification_status === 'verified'`
  2. `telnyx_phone_numbers.status === 'active'`
  3. `organizations.phone_provisioning_status === 'active'`
- Synthetic or unverified numbers are rejected with an explicit security alert.

---

### 13. Outbound SMS Safeguards
Implemented `verifyTenantOutboundSender()`:
- Before any SMS is dispatched, the sender DID is validated against `telnyx_phone_numbers`.
- If the sender is unverified, belongs to another tenant, or is not in `active` status, the outbound dispatch is aborted.

---

### 14. Security Assessment
- **Fail-Closed API Keys**: If `TELNYX_API_KEY` is missing in production, calls immediately fail closed with an explicit audit log. No synthetic numbers are ever generated.
- **Credential Hygiene**: Telnyx secrets and authentication bearer tokens are sanitized from all logs, error stacks, and client responses (`TelnyxApiError`).
- **Multi-Tenant Protection**: Candidate DIDs returned by search are validated against the database to guarantee they do not belong to another organization.

---

### 15. Tests Added (`test/p0-telnyx-did-provisioning.test.mjs`)
20 comprehensive tests covering all functional and failure modes:
1. `TEST 1`: Telnyx search returns a real candidate number via `GET /v2/available_phone_numbers` — **PASS**
2. `TEST 2`: Provisioning submits a real Number Order request using official Telnyx API contract — **PASS**
3. `TEST 3`: Successful provider response stores the real number in database — **PASS**
4. `TEST 4`: Provider phone-number ID and order ID are persisted — **PASS**
5. `TEST 5`: No random/fake phone number is ever generated in production code — **PASS**
6. `TEST 6`: Missing Telnyx credentials fail closed in production — **PASS**
7. `TEST 7`: Telnyx search failure does not create a fake DID — **PASS**
8. `TEST 8`: Telnyx order failure does not create a fake DID — **PASS**
9. `TEST 9`: Provider timeout does not blindly create another order (Crash/Timeout Reconciliation) — **PASS**
10. `TEST 10`: Repeated provisioning request for the same organization is idempotent — **PASS**
11. `TEST 11`: Concurrent provisioning attempts cannot purchase two numbers for the same organization — **PASS**
12. `TEST 12`: Already-provisioned organization returns the existing DID — **PASS**
13. `TEST 13`: Provisioning state remains recoverable after failure — **PASS**
14. `TEST 14`: Existing legitimate Telnyx number is not overwritten — **PASS**
15. `TEST 15`: Synthetic/unverified existing number is not treated as a valid provisioned DID for inbound routing — **PASS**
16. `TEST 16`: Outbound SMS cannot use an unverified or unprovisioned DID — **PASS**
17. `TEST 17`: Telnyx inbound number maps strictly to the correct organization — **PASS**
18. `TEST 18`: A Telnyx number cannot be assigned to two organizations — **PASS**
19. `TEST 19`: Webhook/order completion updates database and is idempotent — **PASS**
20. `TEST 20`: Provider credentials never appear in API responses, errors, or logs — **PASS**

---

### 16. Repository-Wide Fake-DID Scan
A comprehensive codebase scan of `src/` revealed:
- `Math.random` instances for telephone numbers: **0**
- Hardcoded test DIDs (`+15555550100`): **0**
- Synthetic `+1999` numbers: **0**

---

### 17. Complete Regression Results
- **Security Test Suite (`npm run test:security`)**: **55 / 55 PASS** (100%)
- **Integration Test Suite (`npm run test:integration`)**: **15 / 15 PASS** (100% on real Postgres GiST)
- **Full Test Suite (`npm test`)**: **434 / 434 PASS** (100%)
- **TypeScript Typecheck (`npm run typecheck`)**: **0 Errors** (PASS)
- **ESLint (`npm run lint`)**: **0 Errors** (PASS)
- **Production Build (`npm run build`)**: **58 / 58 Routes compiled** (PASS)

---

### 18. Real Telnyx Verification Status
In the current automated verification environment, live payment charges against Telnyx billing were intentionally omitted per instructions. Request structures, headers, payloads, polling semantics, database transactions, and error responses were validated with exact Telnyx v2 wire contract compliance.

---

### 19. Production Deployment Requirements
Prior to launching in a live production environment:
1. Configure `TELNYX_API_KEY` in production secrets.
2. Configure `TELNYX_CONNECTION_ID` for SIP voice call forwarding.
3. Configure `TELNYX_MESSAGING_PROFILE_ID` pointing inbound SMS webhooks to `https://app.captodesk.com/api/webhooks/telnyx/messages`.
4. Apply database migration `supabase/migrations/33_real_telnyx_did_provisioning.sql`.

---

### 20. Remaining Limitations
- Live carrier fulfillment speed depends on Telnyx asynchronous number ordering queues (typically 1–10 seconds). Inbound webhooks (`number_order.complete`) ensure eventual consistency if background HTTP polling times out.

---

### 21. Final Gate
**P0-01: IMPLEMENTATION PASS — REAL PROVIDER VERIFICATION PENDING**
