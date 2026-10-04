# CaptoDesk Incident Response Plan & Runbooks

**System:** CaptoDesk Multi-Tenant SaaS Platform  
**Target:** Incident Commanders, Lead Engineers, Operations Staff  
**Document Version:** 1.0.0  

---

## 1. Incident Severity Classification

| Severity | Definition | Target Response (MTTA) | Target Resolution (MTTR) | Examples |
| :--- | :--- | :--- | :--- | :--- |
| **P0 - Critical** | Catastrophic outage affecting all tenants; cross-tenant data leak; complete telephony or database failure. | **< 15 minutes** | **< 2 hours** | Supabase database down; Telnyx webhooks dropped globally; IDOR vulnerability detected. |
| **P1 - Major** | Core feature degraded for multiple tenants; payment checkout broken; SMS delivery failure rate > 10%. | **< 30 minutes** | **< 4 hours** | Stripe checkout session failure; automation worker halted; missed-call auto-replies delayed > 5 mins. |
| **P2 - Moderate** | Non-critical workflow failure; single tenant affected; workarounds available. | **< 2 hours** | **< 24 hours** | Review requests not sending for 1 tenant; export CSV timing out; analytics chart rendering bug. |
| **P3 - Minor** | Cosmetic UI defect; typo; minor documentation error. | **< 1 business day** | Next release cycle | Button alignment issue; label discrepancy in client portal. |

---

## 2. Incident Response Team Roles

- **Incident Commander (IC):** Drives the incident lifecycle, manages war room, assigns tasks, approves communications.
- **Technical Lead (TL):** Leads root cause investigation, logs analysis, code inspection, and rollback/patch implementation.
- **Communications Lead (CL):** Drafts and posts customer status page notices and email updates.

---

## 3. Provider-Specific Outage Playbooks

### Playbook A: Telnyx Telephony / SMS Outage
**Symptoms:** Call webhooks not arriving, SMS delivery status `failed`, delivery rate dropping below 90%.
1. Check [Telnyx Status Page](https://status.telnyx.com).
2. Inspect `/admin/events` filtered by provider `telnyx` to verify webhook receipt timestamps.
3. Test connectivity via `/api/admin/diagnostics` (action: `ping_telnyx`).
4. If Telnyx is experiencing carrier-level outages:
   - Post customer status notification: *"We are currently experiencing SMS delivery delays due to an upstream carrier network event. Inbound calls are logged and will be re-processed upon carrier restoration."*
   - Enable dead-letter queuing to ensure no missed-call leads are permanently lost.

### Playbook B: Stripe Webhook & Invoicing Degradation
**Symptoms:** Customers paying invoices online, but status remains `sent` instead of `paid`.
1. Check [Stripe Status Page](https://status.stripe.com).
2. Go to **Stripe Dashboard** -> **Developers** -> **Webhooks** -> Select endpoint -> Inspect **Failed Attempts**.
3. Verify `STRIPE_WEBHOOK_SECRET` is matching in Vercel environment variables.
4. If webhooks failed due to temporary endpoint downtime:
   - In Stripe Dashboard, click **Resend Failed Events**.
   - Idempotency guard (`processed_events` table) ensures re-sent events process safely with zero duplicate charges or notices.

### Playbook C: Supabase Database Connectivity Loss
**Symptoms:** `/api/health` returns HTTP 503; client portal shows 500 error; connection pool exhausted.
1. Check [Supabase Status](https://status.supabase.com).
2. Check Supabase Dashboard -> **Database** -> **Connection Pooling** (PgBouncer).
3. Verify connection pool count is not hitting max limit (standard: 60 connections).
4. Restart connection pool if connections are stale.
5. If primary instance has hardware failure, promote read-replica or trigger PITR restore.

### Playbook D: Cross-Tenant Data Isolation (IDOR) Alarm
**Symptoms:** Any report or log showing Business A accessing Business B contact, appointment, quote, or invoice.
1. **IMMEDIATE ACTION (P0):** Engage kill switch on affected endpoint or revert to last known clean commit.
2. Isolate the affected tenant organizations and revoke active sessions.
3. Run forensic SQL audit on `activity_logs` and `processed_events` for cross-tenant access.
4. Verify RLS policies on all affected tables.
5. Notify compliance and legal officer within 24 hours in compliance with state data protection laws.

---

## 4. Post-Incident Review (PIR) Template

Every P0 or P1 incident requires a PIR completed within 48 hours:
- **Incident Summary:** Date, duration, affected tenants, business impact.
- **Timeline:** Sequence of events from onset to detection, diagnosis, mitigation, and resolution.
- **Root Cause Analysis (5 Whys):** The fundamental technical or organizational breakdown.
- **What Went Well:** Effective alarms, quick runbook responses.
- **Action Items:** Preventative code fixes, test additions, or architectural changes with assigned owners and deadlines.
