# CaptoDesk Architecture Specification
**Author:** Senior SaaS Software & Security Architect  
**Codebase:** CaptoDesk (Phase 0 Audit)  
**Date:** October 2026  
**Status:** Living Architectural Baseline  

---

## 1. System Topology & Tier Architecture

CaptoDesk is structured as a multi-tenant Next.js 16 (App Router + Turbopack) application deployed on Vercel, backed by Supabase (PostgreSQL 15+ with Row Level Security) and Telnyx (Programmable Voice & SMS).

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION & EDGE TIER                        │
│                                                                        │
│   Next.js 16 App Router (React 19, Tailwind CSS 4, shadcn/ui)         │
│   ┌───────────────────────┐       ┌────────────────────────────────┐   │
│   │ Client Portal (/client)│       │ Super Admin Cockpit (/admin)   │   │
│   └───────────┬───────────┘       └───────────────┬────────────────┘   │
└───────────────┼───────────────────────────────────┼────────────────────┘
                ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PROXY & ROUTE INTERCEPTION TIER                     │
│                                                                        │
│   src/proxy.ts (Edge NextRequest proxy / rewrite engine)               │
│   • Subdomain routing (admin.domain.com, app.domain.com)              │
│   • Auth session validation via @supabase/ssr                          │
│   • Bare client path normalization (/dashboard -> /client/dashboard)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        API & WEBHOOK SERVICES TIER                     │
│                                                                        │
│   Public / Telephony Webhooks:                                         │
│   • POST /api/webhooks/telnyx/voice                                    │
│   • POST /api/webhooks/telnyx/messages                                 │
│   • POST /api/webhooks/twilio/voice [DEPRECATED / DEAD CODE]           │
│                                                                        │
│   Authenticated Application APIs:                                      │
│   • POST /api/messages/send       • POST /api/reviews/send             │
│   • POST /api/onboarding          • POST /api/team/invite              │
│   • POST /api/admin/demo-simulator                                     │
│   • POST /api/admin/organizations/toggle-status                        │
└───────────────────┬───────────────────────────────┬────────────────────┘
                    ▼                               ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       MODULAR APPLICATION DOMAIN     │  │   EXTERNAL PROVIDER ADAPTERS │
│                                      │  │                              │
│   src/lib/services/call-recovery.ts  │  │   src/lib/telnyx.ts          │
│   src/lib/services/safety-rules.ts   │  │   (Telnyx REST API v2)       │
│   src/lib/services/sms-handler.ts    │  │                              │
└───────────────────┬──────────────────┘  └──────────────┬───────────────┘
                    ▼                                    ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│     PERSISTENCE & DATA ACCESS        │  │       EXTERNAL CLOUD         │
│                                      │  │                              │
│   Supabase PostgreSQL 15+ with RLS   │  │   • Telnyx Telephony Cloud   │
│   • 11 Core Relational Tables        │  │   • Google Cloud Identity    │
│   • Triggers & Idempotency Store     │  │   • Vercel Edge Network      │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 2. Core Data Flow Mappings

### Flow A: Inbound Missed Call & Automated Recovery
1. Homeowner calls the contractor's primary business cell / landline.
2. Contractor does not answer after 3–4 rings.
3. Carrier conditional call forwarding (`*71`) routes the unanswered call to the contractor's dedicated Telnyx tracking DID.
4. Telnyx fires a webhook (`call.hangup` or `call.initiated`) to `https://app.corvexastudio.com/api/webhooks/telnyx/voice`.
5. Webhook checks `processed_events` for idempotency using `event_id`.
6. `processMissedCall` locates the tenant in `organizations` by matching `called_number` against `telnyx_phone_number`.
7. Safety rules evaluate:
   - Accidental misdial filter (< 3s duration).
   - TCPA opt-out status on the caller's `contacts` record.
   - 24-hour cooldown suppression against previous calls.
   - Business hours check (`isWithinBusinessHours`) against tenant timezone to pick `auto_reply_template` vs `after_hours_template`.
8. Outbound SMS dispatched to caller via Telnyx REST API (`https://api.telnyx.com/v2/messages`).
9. System writes records to `calls`, `contacts`, `leads`, `conversations`, and `messages`.
10. Trigger `trg_update_conversation_on_new_message` updates `conversations.last_message_at`, preview, and unread counter.

### Flow B: Inbound SMS & 2-Way Threading
1. Caller texts back on the Telnyx tracking number (*"Yes, I need my roof inspected tomorrow"*).
2. Telnyx dispatches `message.received` webhook to `/api/webhooks/telnyx/messages`.
3. Idempotency guard records event in `processed_events`.
4. `processInboundSms` resolves tenant by recipient number.
5. Inbound text checked for TCPA keywords:
   - If `STOP`, `UNSUBSCRIBE`, etc. &rarr; sets `contacts.opt_out = true`, sends carrier compliance text, aborts thread.
   - If `UNSTOP`, `START` &rarr; sets `contacts.opt_out = false`, sends opt-in confirmation.
6. Inbound message inserted into `messages` (`direction: 'inbound'`, `sender_type: 'customer'`).
7. Message trigger increments `conversations.unread_count` and updates `last_message_preview`.
8. Contractor sees real-time unread badge in `/client/inbox` and replies manually via `/api/messages/send`.

### Flow C: 1-Click Client Onboarding & Auth
1. Contractor lands on `/client/login`, clicks **"Continue with Google"**.
2. Supabase initiates Google OAuth 2.0 PKCE flow with redirect to `/client/auth/callback`.
3. `src/proxy.ts` bypasses auth guards for `/client/auth/callback`.
4. Callback route exchanges `code` for Supabase session cookies via `@supabase/ssr`.
5. Callback inspects `profiles.org_id`:
   - If no profile/org exists &rarr; redirects to `/client/onboarding`.
   - If profile exists &rarr; redirects to `/client/dashboard`.
6. Onboarding form posts to `/api/onboarding`:
   - Creates `organizations` row with unique slug and assigned Telnyx number.
   - Upserts `profiles` linking user ID to `org_id` with `owner` role.
   - Seeds `automation_settings` module config.
   - Redirects to `/client/dashboard`.

---

## 3. Domain Entities & Database Schema Mapping

| Entity | Primary Key | Key Attributes | Relationships | Responsibilities |
|---|---|---|---|---|
| **organizations** | `id UUID` | `name`, `slug`, `owner_phone`, `telnyx_phone_number`, `auto_reply_template`, `business_hours`, `timezone`, `subscription_status` | 1:N `profiles`, 1:N `contacts`, 1:N `calls` | Primary tenant boundary. Owns forwarding number, billing status, and automation configuration. |
| **profiles** | `id UUID` (auth.users) | `org_id`, `full_name`, `email`, `phone`, `role` | N:1 `organizations` | Maps Supabase auth identity to a tenant. Roles: `super_admin`, `owner`, `dispatcher`, `client_admin`. |
| **contacts** | `id UUID` | `org_id`, `name`, `phone`, `email`, `address`, `opt_out`, `tags` | N:1 `organizations`, 1:N `leads`, 1:N `conversations` | Homeowner / customer records. Tracks TCPA opt-out status. Unique per `(org_id, phone)`. |
| **leads** | `id UUID` | `org_id`, `contact_id`, `source`, `status`, `urgency`, `service_needed`, `estimated_value` | N:1 `contacts`, N:1 `organizations` | Sales pipeline stages: `new`, `contacted`, `booked`, `lost`, `archived`. |
| **calls** | `id UUID` | `org_id`, `contact_id`, `caller_number`, `called_number`, `direction`, `status`, `duration_seconds`, `auto_reply_sent` | N:1 `organizations`, N:1 `contacts` | Immutable audit log of all inbound and forwarded telephony events. |
| **conversations** | `id UUID` | `org_id`, `contact_id`, `last_message_at`, `last_message_preview`, `unread_count`, `status` | N:1 `organizations`, N:1 `contacts`, 1:N `messages` | 2-way SMS chat threads between contractor and customer. Unique per `(org_id, contact_id)`. |
| **messages** | `id UUID` | `org_id`, `conversation_id`, `direction`, `sender_type`, `body`, `delivery_status`, `telnyx_message_id` | N:1 `conversations`, N:1 `organizations` | Individual SMS dispatches and replies. Triggers conversation preview updates. |
| **appointments** | `id UUID` | `org_id`, `contact_id`, `title`, `service_type`, `start_time`, `end_time`, `status` | N:1 `organizations`, N:1 `contacts` | Scheduled consultations, estimates, and service visits. |
| **automation_settings** | `id UUID` | `org_id`, `module_key`, `is_enabled`, `config JSONB` | N:1 `organizations` | Extension table for modular automation engines. Unique per `(org_id, module_key)`. |
| **activity_logs** | `id UUID` | `org_id`, `event_type`, `description`, `metadata JSONB` | N:1 `organizations` | Operational audit trail for review requests, system triggers, and alerts. |
| **processed_events** | `id TEXT` | `provider`, `event_type`, `created_at` | Global | Webhook idempotency guard preventing duplicate message dispatches. |

---

## 4. Architectural Weaknesses & Violations Detected

### 4.1 Schema & Configuration Divergence
- **`organizations` vs `automation_settings` Conflict:** Automation settings (`is_missed_call_active`, `auto_reply_template`, `business_hours`, `cooldown_hours`) are defined directly as columns on `organizations`, while an `automation_settings` table also exists. The UI (`/client/automations`) and recovery service (`call-recovery.ts`) read/write from `organizations`, while `/api/onboarding` attempts to insert into `automation_settings` using an invalid column name (`settings` instead of `config`).
- **`activity_logs` Schema Mismatch:** The SQL schema defines `event_type`, `description`, `metadata`. However, legacy frontend views (`/client/activity`, `/client/reviews`) query non-existent columns: `type`, `contact_name`, `contact_phone`, `delivery_status`, `retry_count`.

### 4.2 Concurrency & Race Conditions
- **Check-Then-Act Idempotency (TOCTOU):** Both webhook routes query `processed_events` before inserting. Under concurrent webhook delivery, two requests can pass the check simultaneously, resulting in duplicate SMS messages. Must be replaced with atomic insertion with conflict handling.

### 4.3 Timezone Calculation Error
- **`isWithinBusinessHours` Bug:** In `src/lib/services/safety-rules.ts`, the weekday index is computed via `now.getDay()`, which executes in server UTC. When UTC is Monday morning but local contractor time is Sunday evening, the check evaluates Monday's business hours against Sunday's time.

### 4.4 Provider Coupling
- **Lack of Telephony Abstraction:** `sendTelnyxSms` and Telnyx payload types are directly imported across API routes and services. The codebase lacks a clean `TelephonyProvider` interface (e.g., `sendSms`, `verifyWebhookSignature`), violating clean modular design.

### 4.5 Dead & Orphaned Code
- **Twilio Legacy Webhook:** `/api/webhooks/twilio/voice/route.ts` remains in the codebase with broken table and column references (`twilio_number`, `type`, `status`).
- **Duplicate Root Directory:** `c:\Users\mskar\captodesk\New folder` contains an untracked, stale snapshot of the codebase that must be archived or deleted.
