# CaptoDesk Production Operations Runbook

**System:** CaptoDesk Multi-Tenant Platform  
**Target Audience:** Site Reliability Engineers, DevOps Engineers, Platform Operators  
**Document Version:** 1.0.0  

---

## 1. Daily Operating Rhythm & Standup Checks

Perform the following operational checks every 24 hours:
1. **System Health Endpoint:** Inspect `https://app.corvexastudio.com/api/health`. Status must be `healthy` with HTTP 200.
2. **Platform Cockpit Overview:** Open `/admin` and verify:
   - Active organizations count and trial expirations.
   - Messaging delivery rate (standard: >98%).
   - Stuck jobs count (must be 0).
   - Inbound webhook failure rate (standard: <0.5%).
3. **Telemetry Logs:** Check `/admin/analytics` for any endpoints with p95 latency > 500ms or error spikes.

---

## 2. Background Automation Queue Management

The automation engine executes queued background tasks (appointment reminders, quote follow-ups, overdue invoice nudges, and customer reactivation).

### Queue Processing Mechanics
- **Frequency:** Runs every 1 minute via Vercel Cron calling `GET /api/automations/worker`.
- **Batch Size:** 25 jobs per execution.
- **Max Retries:** 3 attempts with exponential backoff (`retry_count`).
- **Dead-Letter State:** After 3 failed attempts, status transitions to `failed` with error logged.

### Diagnosing Stuck or Failed Jobs
1. Navigate to `/admin/system-health`.
2. Inspect the **Pending Automations** and **Failed Automations** tables.
3. To re-enqueue a dead-letter job:
   ```bash
   # Or use the 1-Click Re-enqueuer in /admin/system-health
   curl -X POST https://app.corvexastudio.com/api/admin/diagnostics \
     -H "Authorization: Bearer <SUPER_ADMIN_SESSION>" \
     -H "Content-Type: application/json" \
     -d '{"action": "re_enqueue_job", "jobId": "<AUTOMATION_RUN_ID>"}'
   ```

---

## 3. Database Maintenance & Backup Strategy

### Backup Schedule & Retention
- **Continuous PITR (Point-In-Time Recovery):** Enabled in Supabase Enterprise. Allows recovery to any second in the past 7 days.
- **Daily Automated Logical Backups:** Snapshot taken at 03:00 UTC daily. Retained for 30 days.
- **Manual Pre-Release Dumps:** Before major schema changes, export schema and data:
  ```bash
  supabase db dump --project-ref <PROJECT_ID> -f backup_$(date +%Y%m%d_%H%M%S).sql
  ```

### Restore Procedure
In the event of database corruption or data loss:
1. Identify target recovery timestamp (UTC).
2. In Supabase Dashboard -> **Settings** -> **Backups** -> **Point in Time**.
3. Select recovery point and initiate **Restore to new project** (prevents in-place overwriting).
4. Verify table row counts and RLS policies on restored instance.
5. Update `NEXT_PUBLIC_SUPABASE_URL` and keys in Vercel to redirect production traffic.

### Vacuuming & Index Maintenance
High-write tables (`calls`, `messages`, `automation_runs`, `processed_events`) require periodic bloat inspection:
```sql
-- Run monthly in Supabase SQL editor during low-traffic window (04:00 UTC Sunday)
VACUUM (ANALYZE) calls;
VACUUM (ANALYZE) messages;
VACUUM (ANALYZE) automation_runs;
VACUUM (ANALYZE) processed_events;
VACUUM (ANALYZE) activity_logs;
```

---

## 4. Tenant Lifecycle Management

Organization statuses:
- `trial`: New signups (14-day default). All features active.
- `active`: Paying customer with valid Stripe subscription.
- `past_due`: Payment failed on Stripe. Grace period of 3 days before suspension.
- `canceled`: Service terminated by owner or platform admin. Outbound automations halted immediately.

### Suspending a Compromised or Abusive Tenant
```bash
curl -X POST https://app.corvexastudio.com/api/admin/organizations/toggle-status \
  -H "Authorization: Bearer <SUPER_ADMIN_SESSION>" \
  -H "Content-Type: application/json" \
  -d '{"orgId": "<ORG_UUID>", "status": "canceled", "reason": "Abusive SMS spam violation"}'
```
