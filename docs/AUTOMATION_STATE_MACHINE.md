# CaptoDesk Automation Lifecycle State Machine & Observability Specification

## 1. Overview
Every automated background job in CaptoDesk (missed-call SMS, booking confirmations, quote follow-ups, payment reminders, and customer reactivations) executes through a deterministic, strictly state-managed pipeline.

This specification documents:
- Permitted state transitions
- Concurrency reservation semantics
- Exponential backoff retry policies
- Stale lock detection & worker crash recovery
- Observability and structured logging

---

## 2. State Machine Definition

| State | Role | Next Permitted States |
| :--- | :--- | :--- |
| `scheduled` | Job enqueued for future trigger time (`scheduled_at > NOW`) | `pending`, `processing`, `running`, `cancelled` |
| `pending` | Job is due now and ready to be claimed | `processing`, `running`, `cancelled` |
| `processing` | Atomically claimed by worker via `FOR UPDATE SKIP LOCKED` | `running`, `completed`, `success`, `retrying`, `pending`, `failed`, `dead_letter`, `cancelled` |
| `running` | Worker is currently executing the registered action handler | `completed`, `success`, `retrying`, `pending`, `failed`, `dead_letter`, `cancelled` |
| `retrying` | Transient error occurred; backoff delay computed | `pending`, `processing`, `cancelled` |
| `completed` / `success` | Action completed successfully; audit recorded (Terminal) | *None* |
| `failed` / `dead_letter` | Max retries exceeded; job moved to dead-letter queue (Terminal) | `pending` *(Manual operator retry only)* |
| `cancelled` | Stopped by business event (e.g. quote accepted, customer booked) | *None* |

---

## 3. Concurrency Safety & Atomic Claiming
1. **PostgreSQL Row-Locking**: Workers invoke `claim_due_automation_runs()` which executes `SELECT ... FOR UPDATE SKIP LOCKED LIMIT batchSize`.
2. **Deterministic Locking**: Upon claim, rows immediately transition to `processing` with `locked_at = NOW()` and `locked_by = worker_id`.
3. **Zero Double-Processing**: Any peer worker running concurrently skips locked rows immediately.

---

## 4. Retry Backoff & Jitter Policy
When an action fails with a transient error (e.g., external Telnyx/Stripe timeout):
- **Base Backoff**: 60 seconds.
- **Formula**: `delay = baseDelay * (2 ^ retryCount) + jitter(0-15s)`.
- **Max Exponent Cap**: 6 (`2^6 = 64x`, maximum base delay ~64 minutes).
- **Max Retries**: Default is 3 attempts.
- **Dead-Letter Transition**: When `retry_count >= max_retries`, the job transitions to `dead_letter` with full failure telemetry recorded in `execution_log`.

---

## 5. Stale Lock Recovery (Crash Safety)
If a worker crashes, disconnects, or is terminated by the host while holding a lock on an active run:
- **Stale Threshold**: 600 seconds (10 minutes) by default.
- **Evaluation**:
  - If `locked_at < NOW - 600s` and `retry_count + 1 < max_retries`:
    The run is safely released, `retry_count` is incremented, and status returns to `pending`.
  - If `locked_at < NOW - 600s` and `retry_count + 1 >= max_retries`:
    The run is transitioned to `dead_letter` with `failure_reason = 'Worker lock stalled: max retries exhausted'`.

---

## 6. Observability & Worker Health
- **Endpoint**: `GET /api/health/worker`
- **Health Criteria**:
  - `healthy`: Oldest overdue job delay `< 120s`, zero stuck locks.
  - `degraded`: Oldest overdue job delay between `120s` and `600s`.
  - `unhealthy`: Oldest overdue job delay `> 600s` or stuck locks detected (`HTTP 503`).
- **Telemetry**: Emits structured logs containing `organization_id`, `automation_run_id`, `action_type`, `attempt`, `status`, and `provider_message_id`. All customer PII and credentials are sanitized.
