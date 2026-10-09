# CAPTODESK — INFRASTRUCTURE REMEDIATION REPORT #1
## WEBHOOK IDEMPOTENCY & RETRY SAFETY (HIGH-INFRA-01)

**Document ID:** `CAPTODESK_WEBHOOK_IDEMPOTENCY_REMEDIATION`  
**Date:** October 9, 2026  
**Role:** Principal Distributed Systems Engineer & SaaS Webhook Reliability Architect  
**Target Repository:** `captodesk`  
**Status:** **REMEDIATED & VERIFIED**  
**Final Gate Result:** `HIGH-INFRA-01: PASS`

---

## 1. ROOT CAUSE

The production infrastructure audit identified a critical flaw in webhook processing across Stripe payments and Telnyx telephony: **Premature Idempotency Reservation**.

### The Failure Mechanism:
1. An incoming webhook passed signature verification.
2. The endpoint executed an immediate `INSERT INTO processed_events (id, ...)` before performing any downstream business logic.
3. The core business logic (`recordPayment`, `processInboundSms`, `processMissedCall`) was executed next.
4. If a transient fault occurred (database connection hiccup, timeout, or query failure), the route caught the error and returned `HTTP 500`.
5. The provider (Stripe or Telnyx) retried delivery with the identical event ID.
6. On retry, the pre-inserted record in `processed_events` caused a PostgreSQL unique key violation (`code: '23505'`).
7. The route interpreted this duplicate key error as *"Already processed (idempotent)"*, returning `HTTP 200` without re-executing the business logic.
8. **Result:** Permanent data loss. Customer payments remained unrecorded, invoices remained unpaid, and incoming messages/calls were dropped.

---

## 2. EXISTING ARCHITECTURE

```
[ Webhook Received ]
        │
        ▼
[ Verify Signature ]
        │
        ▼
[ INSERT into processed_events (id) ]  <--- Claimed as completed prematurely!
        │
        ├─► Unique constraint 23505: Return HTTP 200 (Skipped)
        ▼
[ Execute Business Logic ]
(recordPayment / processInboundSms / processMissedCall)
        │
        ▼
[ Transient Error / Throw ]
        │
        ▼
[ Return HTTP 500 ]
        │
        ▼
[ Provider Retries Webhook ]
        │
        ▼
[ INSERT into processed_events ] ──► [ Hits 23505 Duplicate! ] ──► [ Returns HTTP 200 - Ignored forever! ]
```

---

## 3. NEW ARCHITECTURE

The new architecture introduces a strict, atomic three-state lifecycle for every webhook event:
- **`processing`**: Event has been claimed by a worker instance; locked with `locked_at = NOW()`.
- **`completed`**: Event was successfully processed through all business logic. Future duplicates return `HTTP 200` without re-running business logic.
- **`failed`**: Event business logic threw an error. The lock is immediately cleared, recording `last_error`, and remaining fully retryable.

```
[ Webhook Ingress (Stripe / Telnyx) ]
                 │
                 ▼
     [ Verify Cryptographic Signature ]
                 │
                 ▼
   [ Atomic claim_webhook_event RPC ]
                 │
   ┌─────────────┼─────────────────────────────┐
   │             │                             │
   ▼             ▼                             ▼
[ completed ]  [ concurrent_active ]     [ claimed / reclaimed ]
   │             │                             │
   ▼             ▼                             ▼
Return 200     Wait up to 1.5s;          [ Execute Business Logic ]
(Duplicate     If complete -> 200         (recordPayment / sms / calls)
 skipped)      If active -> 429 Retry          │
                                         ┌─────┴─────┐
                                         │           │
                                         ▼           ▼
                                    [ Success ]   [ Failure ]
                                         │           │
                                         ▼           ▼
                           [ complete_webhook_event ]  [ fail_webhook_event ]
                           - status = 'completed'      - status = 'failed'
                           - locked_at = NULL          - locked_at = NULL
                           - completed_at = NOW()      - last_error recorded
                                 │                           │
                                 ▼                           ▼
                           Return HTTP 200             Return HTTP 500
                                                    (Provider retries safely!)
```

---

## 4. DATABASE CHANGES

A new dedicated migration was created:  
`supabase/migrations/28_webhook_idempotency_lifecycle.sql` (and mirrored in `supabase/schema.sql`).

### 4.1 Schema Alterations on `processed_events`
- `status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('processing', 'completed', 'failed'))`
- `locked_at TIMESTAMPTZ` (tracks worker active execution lock)
- `completed_at TIMESTAMPTZ` (records authoritative completion timestamp)
- `attempt_count INT NOT NULL DEFAULT 1` (tracks retry count across attempts)
- `last_error TEXT` (captures error details for debugging and telemetry)
- `metadata JSONB DEFAULT '{}'::jsonb` (retains contextual payload details)
- Partial index: `idx_processed_events_status_locked ON processed_events(status, locked_at)`
- Partial unique index on `messages`: `idx_messages_org_telnyx_id ON messages(org_id, telnyx_message_id) WHERE telnyx_message_id IS NOT NULL` (prevents semantic duplicate messages).

### 4.2 Stored PostgreSQL Functions
1. **`claim_webhook_event(p_event_id, p_provider, p_event_type, p_stale_timeout_seconds)`**:
   - Executes optimistic `INSERT ... ON CONFLICT (id) DO NOTHING`.
   - On conflict, acquires a row-level lock using `SELECT FOR UPDATE`.
   - Evaluates state:
     - `completed` $\rightarrow$ returns action `'completed'` (skip duplicate).
     - `processing` $\rightarrow$ if `locked_at` within timeout, returns action `'concurrent_active'`; if older than timeout, reclaims lock with action `'reclaimed_stale'`.
     - `failed` $\rightarrow$ reclaims lock with action `'reclaimed_retry'`, increments `attempt_count`.
2. **`complete_webhook_event(p_event_id, p_metadata)`**:
   - Atomically updates `status = 'completed'`, `completed_at = NOW()`, `locked_at = NULL`, `last_error = NULL`.
3. **`fail_webhook_event(p_event_id, p_error)`**:
   - Atomically updates `status = 'failed'`, `locked_at = NULL`, `last_error = p_error`.
4. **Permissions**:
   - `SECURITY DEFINER` enforced. `REVOKE ALL ON FUNCTION ... FROM PUBLIC`.
   - `GRANT EXECUTE ... TO service_role, postgres` exclusively.

---

## 5. STRIPE CHANGES

### Affected File: `src/app/api/webhooks/stripe/route.ts`
1. Replaced premature `insert` with `claimWebhookEvent(supabase, { eventId, provider: 'stripe', eventType })`.
2. If `claim.action === 'completed'`: logs structured info and returns `HTTP 200 { received: true, duplicate: true }`.
3. If `claim.action === 'concurrent_active'`: awaits resolution for up to 1.5 seconds. If completed, returns `HTTP 200`; if still running, returns `HTTP 429` to instruct Stripe to retry.
4. Business logic executes:
   - `checkout.session.completed` $\rightarrow$ `recordPayment()`
   - `payment_intent.succeeded` $\rightarrow$ `recordPayment()`
   - `invoice.payment_succeeded` $\rightarrow$ `recordPayment()`
5. Only after successful payment record does `completeWebhookEvent(supabase, eventId)` mark the event `completed`.
6. In `catch (err)`: `failWebhookEvent(supabase, eventId, err.message)` clears the lock and marks `failed`, returning `HTTP 500`. On Stripe retry, the event is cleanly re-executed.

---

## 6. TELNYX MESSAGING CHANGES

### Affected Files:
- `src/app/api/webhooks/telnyx/messages/route.ts`
- `src/lib/services/sms-handler.ts`

1. Webhook route claims event via `claimWebhookEvent(supabase, { eventId, provider: 'telnyx', eventType })`.
2. Completed events return `HTTP 200 { success: true, message: 'Already processed (idempotent)' }`.
3. Out-of-order monotonic delivery status callbacks check message state; if skipped due to terminal status, event is marked completed.
4. Inbound SMS (`message.received`):
   - In `sms-handler.ts`: Added semantic deduplication on `telnyxMessageId`. If a message with the identical provider message ID already exists for that tenant, it returns `{ success: true, action: 'message_already_stored' }` without duplicating rows or unread counter increments.
   - Handled PostgreSQL unique constraint `23505` gracefully on message insert.
5. In `catch (err)`: `failWebhookEvent` unlocks the event for carrier retry, returning `HTTP 500`.

---

## 7. TELNYX VOICE CHANGES

### Affected Files:
- `src/app/api/webhooks/telnyx/voice/route.ts`
- `src/lib/services/call-recovery.ts`

1. Webhook route claims voice event via `claimWebhookEvent`.
2. Intermediate call progress events (`call.initiated`, `call.ringing`, `call.answered`) are marked `completed` and acknowledged.
3. Hangup events (`call.hangup`):
   - In `call-recovery.ts`: Added semantic deduplication on `telnyx_call_control_id`. If the call was already logged for that tenant, it returns `{ success: true, action: 'call_already_processed' }`.
   - Guarded call insert against `23505` unique violations on `idx_calls_org_call_control_id`.
4. Successfully processed calls call `completeWebhookEvent`.
5. Failures call `failWebhookEvent` and return `HTTP 500`.

---

## 8. CONCURRENCY STRATEGY

When two identical webhook requests arrive simultaneously:
1. Both requests attempt `claim_webhook_event`.
2. PostgreSQL row-level locks (`SELECT FOR UPDATE` or atomic `INSERT`) guarantee that exactly **one** worker transaction successfully claims the event (`action: 'claimed'`).
3. The concurrent worker sees `status: 'processing'` with an active `locked_at` timestamp and receives `action: 'concurrent_active'`.
4. The concurrent worker does **not** execute the business logic. It invokes `waitForConcurrentWebhookCompletion()`, polling every 300ms for up to 1500ms.
5. If the first worker completes within that window, the concurrent worker returns `HTTP 200 { received: true, duplicate: true }`.
6. If the first worker takes longer, the concurrent worker returns `HTTP 429`, requesting the provider to retry.

---

## 9. RETRY STRATEGY

When business logic or database operations fail:
1. The `catch` block calls `failWebhookEvent(supabase, eventId, error)`.
2. The database updates `status = 'failed'` and clears `locked_at = NULL`.
3. The route returns `HTTP 500` to the provider.
4. When the provider retries (with exponential backoff over seconds/hours):
   - `claim_webhook_event` detects `status = 'failed'`.
   - Transitions `status = 'processing'`, increments `attempt_count`, and sets `locked_at = NOW()`.
   - Returns `action: 'reclaimed_retry'`.
   - The business logic executes again.
   - Upon success, marks `completed`.

---

## 10. CRASH RECOVERY STRATEGY

If a serverless invocation terminates abruptly (OOM, Vercel lambda timeout, network abort) while in `status: 'processing'`:
1. Neither `completeWebhookEvent` nor `failWebhookEvent` is invoked.
2. The event remains in `status: 'processing'`, but its `locked_at` timestamp is frozen.
3. When the provider retries after the timeout threshold (default `60` seconds):
   - `claim_webhook_event` evaluates `v_existing.locked_at < NOW() - INTERVAL '60 seconds'`.
   - Detects the stale lock from the crashed worker.
   - Reclaims the lock with `action: 'reclaimed_stale'`, increments `attempt_count`, and updates `locked_at = NOW()`.
   - Business processing is re-executed and completed.

---

## 11. HTTP RESPONSE BEHAVIOR

| Condition | HTTP Status | Response Body | Provider Action |
| :--- | :---: | :--- | :--- |
| **New Event Success** | `200` | `{ received: true }` / `{ success: true }` | Webhook resolved. |
| **Duplicate Completed** | `200` | `{ received: true, duplicate: true }` | Webhook acknowledged; no-op. |
| **Concurrent Active (Timed Out)** | `429` | `{ error: 'Concurrent webhook processing in progress' }` | Provider retries later. |
| **Business Logic / DB Failure** | `500` | `{ error: '...' }` | Provider retries event. |
| **Invalid Signature** | `400` / `401` | `{ error: 'Invalid webhook signature' }` | Provider does not retry. |
| **Malformed JSON** | `400` | `{ error: 'Malformed JSON payload' }` | Provider does not retry. |

---

## 12. TESTS ADDED

A new test suite was created: `test/webhook-idempotency-and-retry.test.mjs`.  
It implements all 20 required verification scenarios without relying on fragile external network dependencies:

- **TEST 1:** First Stripe event $\rightarrow$ processed once, completes in database.
- **TEST 2:** Same Stripe event repeated $\rightarrow$ recognized as duplicate, no duplicate payment.
- **TEST 3:** Stripe business logic fails $\rightarrow$ event marked failed and remains retryable.
- **TEST 4:** Stripe retry after failure $\rightarrow$ reclaims event, attempt counter incremented.
- **TEST 5:** Successful retry $\rightarrow$ records payment, transitions to completed.
- **TEST 6:** Third duplicate after successful retry $\rightarrow$ ignored safely.
- **TEST 7:** Two concurrent Stripe deliveries $\rightarrow$ exactly one execution.
- **TEST 8:** First Telnyx SMS event $\rightarrow$ one message stored, event completes.
- **TEST 9:** Duplicate Telnyx SMS event $\rightarrow$ no duplicate message, unread count unchanged.
- **TEST 10:** Telnyx SMS processing failure $\rightarrow$ event marked failed for retry.
- **TEST 11:** Telnyx SMS retry succeeds $\rightarrow$ exactly one final message stored.
- **TEST 12:** Two concurrent Telnyx SMS events $\rightarrow$ exactly one message stored.
- **TEST 13:** Telnyx voice event $\rightarrow$ missed-call recovery runs, call log created.
- **TEST 14:** Duplicate Telnyx voice event $\rightarrow$ no duplicate leads or calls.
- **TEST 15:** Crash / stale-processing recovery $\rightarrow$ stale locked event recovered after timeout.
- **TEST 16:** Invalid or missing Stripe signature $\rightarrow$ rejected fail-closed.
- **TEST 17:** Invalid or missing Telnyx Ed25519 signature $\rightarrow$ rejected fail-closed.
- **TEST 18:** Malformed JSON payload or missing event ID $\rightarrow$ rejected.
- **TEST 19:** Previously completed event $\rightarrow$ 2xx duplicate response.
- **TEST 20:** Database failure during processing $\rightarrow$ leaves event in retryable state, not permanently completed.

---

## 13. TEST RESULTS

### 13.1 Webhook Idempotency Integration Suite
```
node --experimental-strip-types --test test/webhook-idempotency-and-retry.test.mjs
# tests 20
# suites 0
# pass 20
# fail 0
# cancelled 0
# skipped 0
# duration_ms 757.71
```

### 13.2 Full Regression Verification
```
npm run typecheck
> tsc --noEmit
Exit code: 0 (0 errors)

npm run lint
> eslint .
Exit code: 0 (0 errors)

npm run test:security
# tests 55
# pass 55
# fail 0
Exit code: 0

npm test
# tests 347
# pass 347
# fail 0
Exit code: 0

npm run build
▲ Next.js 16.4.0 (Turbopack)
✓ Compiled successfully in 9.3s
✓ Generating static pages using 11 workers (58/58)
ƒ Proxy (Middleware) active
Exit code: 0
```

---

## 14. MIGRATION INSTRUCTIONS

When deploying to Supabase Production:
1. Open the **Supabase SQL Editor** (`https://supabase.com/dashboard/project/<project-id>/sql/new`).
2. Run `supabase/migrations/28_webhook_idempotency_lifecycle.sql`.
3. The script is fully idempotent:
   - Existing records are preserved and backfilled to `status = 'completed'`.
   - Security privileges (`REVOKE ALL FROM PUBLIC`, `GRANT TO service_role, postgres`) are applied automatically.

---

## 15. DEPLOYMENT CONSIDERATIONS

- **Zero-Downtime Migration:** The changes are fully backward-compatible. Legacy records without a status column are defaulted to `'completed'`.
- **Client Fallback:** If the RPC function is not yet present during a transient rolling deployment, `src/lib/webhooks/idempotency.ts` automatically executes safe atomic query fallbacks.

---

## 16. REMAINING LIMITATIONS

- **Third-Party Provider Retry Windows:** Stripe retries over a period of 72 hours, and Telnyx retries up to 48 hours. The `staleTimeoutSeconds = 60` threshold is well within this window, ensuring that any transient serverless crash is recovered on the next provider retry attempt.
- **Permanent Retention of Processed Events:** The `processed_events` table grows monotonically with webhook volume. A quarterly archiving policy (e.g. archiving completed events older than 90 days) should be scheduled in future maintenance.

---

## 17. FINAL GATE CERTIFICATION

```
========================================================================================
                               FINAL AUDIT GATE:
                               HIGH-INFRA-01: PASS
========================================================================================
```

**Demonstrated Capabilities:**
1. [x] Failed webhook can be retried safely.
2. [x] Successful webhook cannot execute twice.
3. [x] Concurrent duplicate deliveries cannot execute twice.
4. [x] Stale processing from server crashes can recover.
5. [x] Stripe payments remain idempotent.
6. [x] Telnyx SMS and voice operations remain idempotent.
7. [x] Zero regressions across all 347 automated tests.
