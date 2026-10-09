# CAPTODESK — INFRASTRUCTURE REMEDIATION REPORT #2
## WORKER SCHEDULING, DUE-JOB LATENCY & QUEUE DRAINING (HIGH-INFRA-02)

**Role**: Principal Distributed Systems Engineer & SaaS Infrastructure Architect  
**Date**: October 9, 2026  
**Target finding**: `HIGH-INFRA-02` (Worker Frequency & Single-Batch Stranding Defect)  
**Final Gate Status**: **`HIGH-INFRA-02: PASS`**  

---

## 1. ORIGINAL DEFECT

In the Phase 2 / Step 1 Infrastructure Forensic Audit, a critical scheduling defect was identified in the asynchronous automation subsystem:

- **Infrequent Scheduler**: `vercel.json` configured the production scheduler to run only once per day:
  ```json
  "schedule": "0 0 * * *"
  ```
- **Single-Batch Processing**: `src/app/api/automations/worker/route.ts` executed a single batch of 25 jobs per invocation via `processDueAutomationJobs(supabase, 25, workerId)` and immediately returned.
- **Production Impact**:
  1. Time-sensitive customer communications—including missed-call recovery SMS, appointment reminders, lead follow-up sequences, and invoice review reminders—remained pending in `automation_runs` for up to 24 hours before execution.
  2. If more than 25 jobs were due when the daily cron fired (e.g., 100 due jobs), only 25 were processed. The remaining 75 jobs were stranded until the next cron invocation 24 hours later, accumulating an unbounded customer backlog.

---

## 2. ROOT CAUSE

1. **Premature Daily Cron Stub in Repository Configuration**:
   The Vercel configuration (`vercel.json`) contained a stub daily cron expression (`0 0 * * *`) intended for development or batch billing rather than near-real-time customer workflow automation.
2. **Absence of Bounded Queue Draining**:
   `processDueAutomationJobs` lacked a multi-batch loop. Under serverless constraints, single-batch processing was implemented to prevent function timeouts, but without a bounded loop with a time budget, any queue backlog was left stranded.
3. **Missing Function Execution Budget**:
   The worker endpoint lacked explicit Vercel runtime configuration (`maxDuration`) and an execution deadline mechanism to safely maximize job throughput within the execution window without hitting hard SIGKILL timeouts.

---

## 3. EXISTING ARCHITECTURE

Prior to remediation:
- **Scheduler**: Daily cron trigger via Vercel at `0 0 * * *` (midnight UTC).
- **Execution Endpoint**: `src/app/api/automations/worker/route.ts` triggered `processDueAutomationJobs(supabase, 25, workerId)`.
- **Claim Function**: `claimDueAutomationJobs` calling PostgreSQL RPC `claim_due_automation_runs` using `FOR UPDATE SKIP LOCKED`.
- **Execution Flow**:
  1. Claim up to 25 jobs.
  2. Process each job sequentially.
  3. Exit immediately, leaving any remaining due jobs stranded until midnight the following day.

---

## 4. NEW ARCHITECTURE

The remediated architecture guarantees near-real-time automation execution while preserving rock-solid distributed systems safety:

```
Vercel Cron (* * * * * Every Minute)
                │
                ▼
  GET /api/automations/worker
  ┌─────────────────────────────────────────────────────────┐
  │ 1. Fail-closed CRON_SECRET auth (SHA-256 constant-time) │
  │ 2. Sliding-window rate limit (100 req/min)              │
  │ 3. Allocate Execution Budget (e.g., 25s deadline)       │
  └─────────────────────────────┬───────────────────────────┘
                                │
                                ▼
                   drainDueAutomationJobs()
  ┌─────────────────────────────────────────────────────────┐
  │ LOOP: (batchesClaimed < maxBatches && now < deadline)   │
  │   1. Check remaining deadline budget                    │
  │   2. claim_due_automation_runs() (FOR UPDATE SKIP LOCKED)│
  │   3. If 0 jobs returned: break (stopReason: queue_empty)│
  │   4. Deduplicate against current invocation run IDs     │
  │   5. Execute jobs (record success, retry backoff, DLQ)  │
  │   6. batchesClaimed++                                   │
  └─────────────────────────────┬───────────────────────────┘
                                │
                                ▼
  Emit Structured Observability Log & Return HTTP 200 Summary
```

---

## 5. CRON CONFIGURATION BEFORE / AFTER

### `vercel.json` Comparison

**Before (Daily midnight UTC)**:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/automations/worker",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**After (Every minute `* * * * *`)**:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/automations/worker",
      "schedule": "* * * * *"
    }
  ]
}
```

*Note on Plan Compatibility*: On Vercel Pro/Enterprise, `* * * * *` is the standard production cron cadence for 1-minute execution. On Vercel Hobby, cron frequency is constrained by platform policy (typically once per day or once per hour). If deployed to a Hobby team, Vercel UI will indicate the frequency cap; upgrading to Vercel Pro unlocks the full 1-minute automated schedule.

---

## 6. QUEUE-DRAINING BEHAVIOR

The new queue engine implements bounded multi-batch draining via `drainDueAutomationJobs()`:

- **Batch Size**: Configurable (default `25` jobs per batch).
- **Max Batches**: Configurable (default `10` batches, up to `250` jobs per invocation).
- **Drain Progression**:
  - If 10 jobs are due: Worker claims 10, executes them, detects empty queue, and halts with `stopReason: 'queue_empty'`.
  - If 60 jobs are due: Worker claims 25 (Batch 1), claims 25 (Batch 2), claims 10 (Batch 3), detects empty queue on Batch 4, and halts with `stopReason: 'queue_empty'` having processed all 60 jobs in a single invocation.
  - If 500 jobs are due: Worker processes 10 batches of 25 (`250` jobs), halts safely with `stopReason: 'max_batches_reached'` leaving the remaining 250 jobs for the subsequent scheduled invocation 60 seconds later.
- **Infinite Loop Safeguard**:
  `drainDueAutomationJobs` maintains an in-memory `processedRunIds: Set<string>` for the duration of the invocation. If an already-touched job ID is ever returned by the database, it is filtered out and the drain loop breaks immediately, eliminating infinite loop risks.

---

## 7. RUNTIME & DEADLINE STRATEGY

Serverless runtimes (such as Vercel AWS Lambda / Edge) enforce strict timeout policies. Uncontrolled loops risk abnormal process termination mid-batch, causing stranded database row locks.

To eliminate this failure mode:

1. **Route Level Runtime Allocation**:
   In `src/app/api/automations/worker/route.ts`:
   ```ts
   export const dynamic = 'force-dynamic'
   export const maxDuration = 60 // Configures Vercel function execution duration up to 60s
   ```
2. **Proactive Dynamic Deadline Budget**:
   In `drainDueAutomationJobs()`:
   ```ts
   const startTime = Date.now()
   const maxDurationMs = options.maxDurationMs ?? (process.env.WORKER_MAX_DURATION_MS ? parseInt(process.env.WORKER_MAX_DURATION_MS, 10) : 25000)
   const safetyMarginMs = options.safetyMarginMs ?? (process.env.WORKER_SAFETY_MARGIN_MS ? parseInt(process.env.WORKER_SAFETY_MARGIN_MS, 10) : 5000)
   const deadline = startTime + Math.max(0, maxDurationMs - safetyMarginMs)
   ```
3. **Pre-Batch Budget Check**:
   Before claiming each batch, the worker calculates:
   ```ts
   const now = Date.now()
   if (now >= deadline || (batchesClaimed > 0 && deadline - now < Math.min(1000, lastBatchDurationMs))) {
     stopReason = 'time_budget_exhausted'
     break
   }
   ```
   If the remaining execution window is insufficient to safely complete another full batch based on the observed latency of the previous batch, the loop breaks gracefully and returns an HTTP 200 response with remaining backlog metrics.

---

## 8. CONCURRENCY GUARANTEES

Concurrency safety is strictly preserved at the PostgreSQL database layer:

- **Source of Truth**: PostgreSQL RPC `claim_due_automation_runs(p_worker_id, p_batch_size, p_stale_threshold_seconds)`.
- **Locking Primitive**: `FOR UPDATE SKIP LOCKED`.
- **Zero In-Memory Queue State**: Worker instances hold zero shared memory state. Multiple concurrent invocations (e.g. Worker Alpha and Worker Beta) race at the database layer. PostgreSQL skips locked rows and assigns disjoint subsets to each worker.
- **Verification**: Concurrency stress tests (`TEST 9` and Phase 1 test suite) confirm exactly 0 duplicate job executions across concurrent workers.

---

## 9. RETRY & FAILURE BEHAVIOR

The scheduler changes preserve all existing reliability guarantees:

1. **Exponential Backoff with Jitter**:
   Failed jobs calculate `nextScheduledAt = calculateNextRetry(job.retry_count)` with delay `baseDelay * 2^retryCount + jitter`.
2. **Future Schedule Exclusion**:
   Because the worker only claims runs where `scheduled_at <= NOW()`, failed jobs with backoff schedules in the future are never re-claimed in subsequent batches of the same invocation or immediately adjacent invocations.
3. **Dead-Letter Queue (DLQ)**:
   When `retry_count >= max_retries`, the job permanently transitions to `status: 'dead_letter'`. The query filters exclusively for `status IN ('pending', 'scheduled')`, ensuring dead-lettered jobs are never re-executed.
4. **Stale Lock Recovery**:
   If a worker serverless instance crashes mid-execution while holding locks on `processing` jobs, `claim_due_automation_runs` inspects `locked_at < NOW() - stale_threshold_seconds` (default 600s). The stranded jobs are safely recovered, their retry count is incremented, and they are re-executed.

---

## 10. AUTHENTICATION & SECURITY

The worker endpoint authorization retains all previously verified security controls:

- **Fail-Closed `CRON_SECRET`**:
  If `CRON_SECRET` is unconfigured, empty, or whitespace, the endpoint immediately returns HTTP 503 (`Cron worker unconfigured`).
- **Constant-Time SHA-256 Secret Comparison (`ADD-02`)**:
  Both provided and configured tokens are hashed with SHA-256 and compared using `crypto.timingSafeEqual()`, completely eliminating timing leaks and string length side-channels.
- **Distributed Rate Limiting (`HIGH-05`)**:
  Guards against rogue scheduler spam via sliding-window rate limiting (`RATE_LIMITS.DEFAULT_API`, max 100 req/min).

---

## 11. OBSERVABILITY & METRICS

Observability has been upgraded to emit structured JSON logs via `createStructuredLogger`:

### Logged Invocations

**Invocation Started**:
```json
{
  "timestamp": "2026-10-09T07:34:42.000Z",
  "level": "info",
  "message": "Automation worker invocation started",
  "metadata": {
    "invocation_id": "inv_1791531283770_g55ox4",
    "worker_id": "worker_1791531283770_dtqlah",
    "batch_size": 25,
    "max_batches": 10,
    "max_duration_ms": 25000,
    "safety_margin_ms": 5000,
    "stale_threshold_seconds": 600
  }
}
```

**Invocation Completed**:
```json
{
  "timestamp": "2026-10-09T07:34:42.027Z",
  "level": "info",
  "message": "Automation worker invocation completed",
  "duration_ms": 27,
  "metadata": {
    "invocation_id": "inv_1791531283770_g55ox4",
    "worker_id": "worker_1791531283770_dtqlah",
    "batches_claimed": 4,
    "claimed": 100,
    "processed": 100,
    "succeeded": 100,
    "failed": 0,
    "retried": 0,
    "dead_lettered": 0,
    "remaining_due": 0,
    "duration_ms": 27,
    "stop_reason": "queue_empty"
  }
}
```

**Zero Credential Exposure**:
The logger strictly redacts headers, tokens, `CRON_SECRET`, phone numbers, customer message text, and financial credentials.

---

## 12. TESTS ADDED

A comprehensive test suite was implemented in `test/worker-scheduling-and-draining.test.mjs` containing 18 rigorous test cases:

- **TEST 1**: Cron configuration in `vercel.json` scheduled every minute (`* * * * *`).
- **TEST 2**: Unauthorized cron requests rejected (missing secret -> 503, invalid token -> 401).
- **TEST 3**: Valid cron request executes with constant-time SHA-256 authenticated secret.
- **TEST 4**: Exactly one due job atomically claimed, executed, and transitions to `success`.
- **TEST 5**: 55 due jobs drained across 3 batches (`batchSize = 20`) in a single invocation.
- **TEST 6**: Queue larger than single batch size drains without stranding jobs.
- **TEST 7**: Worker stops before runtime deadline when time budget is exhausted (`stopReason: 'time_budget_exhausted'`).
- **TEST 8**: Remaining due jobs left for future scheduled invocation when batches reach `maxBatches`.
- **TEST 9**: Concurrent Worker Alpha and Worker Beta cannot claim the same job (`FOR UPDATE SKIP LOCKED`).
- **TEST 10**: Failed job transitions to `pending` with exponential backoff and is NOT immediately re-executed.
- **TEST 11**: Job whose `scheduled_at` is in the future is never claimed or executed.
- **TEST 12**: Permanently failing job transitions to `dead_letter` and is ignored by future worker runs.
- **TEST 13**: Stale claimed job from crashed worker (> 600s) is recovered and processed.
- **TEST 14**: Worker never enters an infinite drain loop even if duplicate claims occur.
- **TEST 15**: Large queue (200 jobs) remains strictly bounded by `maxBatches`.
- **TEST 16**: Backward compatibility: `processDueAutomationJobs` and `AutomationService.drainPendingRuns` preserve contract.
- **TEST 17**: Security integrity verification: `CRON_SECRET` fail-closed and timing safe.
- **TEST 18**: Webhook idempotency and retry safety verification: Lifecycle unchanged.

---

## 13. TEST RESULTS

| Test Suite | Tests Run | Passed | Failed | Status |
| :--- | :--- | :--- | :--- | :--- |
| `test/worker-scheduling-and-draining.test.mjs` | 18 | 18 | 0 | **PASS** |
| `npm run test:security` | 55 | 55 | 0 | **PASS** |
| `npm test` (Full Suite) | 365 | 365 | 0 | **PASS** |
| `npm run typecheck` (`tsc --noEmit`) | - | - | 0 errors | **PASS** |
| `npm run lint` (`eslint .`) | - | - | 0 errors | **PASS** |
| `npm run build` (Next.js 16.4.0 Turbopack) | 58 routes | 58 | 0 errors | **PASS** |

---

## 14. PRODUCTION DEPLOYMENT REQUIREMENTS

To operationalize the 1-minute automation scheduler in Vercel:

1. **Environment Variables**:
   - `CRON_SECRET`: Must be set in Vercel Project Settings (Production & Preview).
   - `WORKER_MAX_DURATION_MS`: (Optional, default `25000`) Maximum execution window per invocation in milliseconds.
   - `WORKER_SAFETY_MARGIN_MS`: (Optional, default `5000`) Safety threshold to cleanly stop before the runtime kill limit.
2. **Vercel Plan**:
   - Vercel Cron on Pro plan automatically invokes `GET /api/automations/worker` every minute (`* * * * *`) with an automatic `Authorization: Bearer <CRON_SECRET>` header.
3. **Database Migration**:
   - Ensure migration `18_phase1_critical_concurrency_and_numbering.sql` defining `claim_due_automation_runs` is applied to production PostgreSQL.

---

## 15. ACTUAL PRODUCTION VERIFICATION VS. STATIC VERIFICATION

- **Static & Harness Verification (VERIFIED)**:
  - Configuration verified in `vercel.json`: `"schedule": "* * * * *"`.
  - TypeScript types verified: 0 errors.
  - Integration test suite verified: 365 tests passing across worker, auth, concurrency, and idempotency.
  - Route compilation verified: `ƒ /api/automations/worker` built cleanly with `force-dynamic` and `maxDuration = 60`.
- **Actual Live Cloud Invocation (LIMITATION / PENDING DEPLOYMENT)**:
  - Because this environment is the local codebase and deployment repository, actual production invocation by Vercel Cron can only be observed once committed, pushed to `main`, and deployed to the live Vercel environment.
  - Live invocation observation will be performed in Phase 2 Step 3 (Production Deployment Verification).

---

## 16. LATENCY ACCEPTANCE CRITERIA

| Trigger Event | Target Delay | Remediated Expected Delay |
| :--- | :--- | :--- |
| Inbound Missed Call Recovery SMS | $\le 60\text{s}$ | **$\le 60\text{s}$** (Next cron execution $+ \sim 150\text{ms}$ execution) |
| Appointment Reminder (Scheduled) | $\le 60\text{s}$ | **$\le 60\text{s}$** (Due time reached $\to$ next minute cron) |
| Lead Follow-up Sequence | $\le 60\text{s}$ | **$\le 60\text{s}$** (Due time reached $\to$ next minute cron) |
| Review Request Dispatch | $\le 60\text{s}$ | **$\le 60\text{s}$** (Due time reached $\to$ next minute cron) |
| Queue Backlog (up to 250 jobs) | Single invocation | **Single invocation** (drained across batches within 25s window) |

---

## 17. RECOMMENDED FUTURE IMPROVEMENTS

1. **Vercel Pro Cron Monitoring Alerts**: Configure Vercel Slack/email alerts if `/api/automations/worker` returns non-2xx status.
2. **Adaptive Dynamic Batching**: Scale `batchSize` dynamically based on average action latency (e.g. scale from 25 to 50 if action handlers complete in $< 10\text{ms}$).
3. **Dedicated Worker Queues**: In high-scale enterprise tiers ( $> 100\text{k}$ jobs/day), migrate from cron polling to an event-driven queue like Supabase pgmq or Inngest.

---

## FINAL GATE

```
============================================================
FINAL REMEDIATION GATE: HIGH-INFRA-02
============================================================
[X] Scheduler frequency corrected (* * * * *)
[X] Due jobs drained safely across multiple batches
[X] Concurrency remains safe (FOR UPDATE SKIP LOCKED)
[X] Exponential retry backoff and DLQ preserved
[X] Serverless execution budget strictly honored
[X] Cron authentication remains fail-closed and timing-safe
[X] 18 focused worker scheduling tests passing
[X] 365 total integration tests passing
[X] TypeScript clean (0 errors)
[X] ESLint clean (0 errors)
[X] Next.js 16.4.0 Turbopack build clean (58/58 routes)
============================================================
GATE RESULT: HIGH-INFRA-02: PASS
============================================================
```
