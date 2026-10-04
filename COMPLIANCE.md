# CaptoDesk Telecommunications Compliance & Messaging Safety Guide

> **IMPORTANT NOTICE & LEGAL DISCLAIMER**:
> This document and the technical compliance mechanisms implemented within CaptoDesk are intended for engineering reference, operational consistency, and platform risk reduction. **CaptoDesk does NOT provide formal legal advice, and the software safeguards described herein do not constitute a legal conclusion or guarantee of immunity under the Telephone Consumer Protection Act (TCPA), state mini-TCPAs, or carrier regulations.**
>
> Every business entity operating on the platform must consult with qualified telecommunications legal counsel and register its brand and messaging campaigns with The Campaign Registry (TCR) through their designated A2P 10DLC provider (e.g., Telnyx).

---

## 1. Overview & Architectural Scope

CaptoDesk automates two-way SMS, missed-call auto-texts, appointment notifications, digital estimates, mobile invoicing, and customer review requests for U.S. home-service contractors.

Under U.S. mobile carrier rules (CTIA Messaging Principles and Best Practices) and federal statutory law (TCPA 47 U.S.C. § 227), Application-to-Person (A2P) messaging requires strict adherence to:
1. **Consent verification** prior to sending.
2. **Deterministic opt-out handling** (immediate suppression).
3. **Sender transparency** (explicit business identification).
4. **Time-of-day curfews** (TCPA Quiet Hours).
5. **Anti-harassment frequency controls** (rate limits).

CaptoDesk provides an automated **deterministic compliance engine** (`src/lib/compliance/compliance-engine.ts`) enforcing these boundaries before any outbound message is transmitted.

---

## 2. Inbound Keyword Handling (CTIA Mandates)

CaptoDesk listens on all inbound webhooks (`/api/webhooks/telnyx/messages`) and deterministically handles standard carrier compliance keywords:

| Keyword Group | Supported Words | State Transitions | Automated System Response |
| :--- | :--- | :--- | :--- |
| **Opt-Out (Suppression)** | `STOP`, `UNSUBSCRIBE`, `CANCEL`, `END`, `QUIT`, `OPTOUT`, `STOPALL` | 1. Upsert phone to `compliance_suppression_list`<br>2. Set `contacts.opt_out = true`<br>3. Set `contacts.marketing_opt_in = false`<br>4. Write to `compliance_audit_logs` | `"{Business Name}: You have been unsubscribed and will receive no further messages. Reply START to resubscribe or HELP for assistance."` |
| **Opt-In (Resubscribe)** | `START`, `UNSTOP`, `YES` | 1. Delete from `compliance_suppression_list`<br>2. Set `contacts.opt_out = false`<br>3. Set `contacts.transactional_opt_in = true`<br>4. Record in `compliance_consent_records`<br>5. Write to `compliance_audit_logs` | `"{Business Name}: You have resubscribed to receive service updates and notifications. Msg&data rates may apply. Reply HELP for info, STOP to opt out."` |
| **Help & Support** | `HELP`, `INFO` | 1. Log request to `compliance_audit_logs`<br>2. Preserve existing opt-in/opt-out status | `"{Business Name}: For customer support call {phone}. Msg&data rates may apply. Reply STOP to cancel."` |

*Note: Keyword matching is case-insensitive and trims extraneous leading/trailing whitespace.*

---

## 3. Real-Time Suppression List Architecture

### Table: `compliance_suppression_list`
- **Structure**: `(id, org_id, phone, reason, source, keyword, created_at, updated_at)`
- **Constraint**: `UNIQUE (org_id, phone)`
- **Enforcement**:
  - The suppression list is evaluated in real-time as the **first pre-flight gate** for every outbound message across all 6 messaging pipelines.
  - If a recipient phone exists in `compliance_suppression_list`, the message is instantly blocked with code `suppression_list_active`.
  - Background jobs (`automation_runs`), quote follow-ups, invoice reminders, and review requests halt execution immediately without calling the Telnyx API.

---

## 4. Message Classification: Transactional vs. Marketing

Carrier guidelines draw a sharp distinction between informational messages directly related to an existing customer relationship and unsolicited promotional outreach:

| Feature / Rule | Transactional Messages | Marketing Messages |
| :--- | :--- | :--- |
| **Pipeline Examples** | • Missed-call text back<br>• Appointment booking confirmation<br>• Appointment 24h & 2h reminders<br>• Initial quote delivery<br>• Invoice dispatch & payment receipts<br>• Booking cancellation notices | • Quote follow-up sequences (Day 2, Day 5)<br>• Google review request invites<br>• Customer reactivation / win-back campaigns<br>• Promotional broadcast SMS |
| **Consent Standard** | **Implied / Informational Consent** (e.g., customer called, requested estimate, or booked service) | **Prior Express Written Consent** (explicit affirmative opt-in checkbox or written agreement) |
| **TCPA Quiet Hours** | Allowed during daytime and immediate responses to inbound customer actions (e.g. caller inquiry) | **STRICTLY PROHIBITED** between 8:00 PM and 8:00 AM recipient local time |
| **Opt-Out Disclosure** | Standard assistance instructions | **MANDATORY**: Text must contain `Reply STOP to cancel` or `Reply STOP to opt out` |
| **Frequency Cap** | Evaluated for run-away loop prevention (max 3/day) | **Strictly capped** at max 1 message/day and max 3 messages/week |

---

## 5. Mandatory Business Identification

Under CTIA guidelines, every automated message must clearly disclose the business entity sending the message.

- CaptoDesk automatically formats outbound text via `formatCompliantOutboundText`.
- If the configured business name (`org.business_name_prefix` or `org.name`) is not detected in the opening greeting, the engine automatically prepends:
  `"{Business Name}: {Original Message}"`
- This eliminates carrier rejections resulting from anonymous A2P transmissions.

---

## 6. TCPA Quiet Hours Curfew

The Telephone Consumer Protection Act and various state mini-TCPAs (such as Florida, Oklahoma, and Washington) restrict automated marketing telecommunications during night hours.

- **Curfew Window**: Messages are blocked from **8:00 PM to 8:00 AM** recipient local time.
- **Timezone Derivation**: The recipient's local time is determined via organization configuration or area-code mapping.
- **Enforcement**: Any marketing message evaluated during quiet hours returns `suppressionReason: 'tcpa_quiet_hours'` and logs an audit record.

---

## 7. Anti-Harassment Message Frequency Controls

To prevent recipient fatigue, spam complaints, and runaway automation loops:
- CaptoDesk tracks outbound message counts per recipient phone in 24-hour windows.
- **Default Limit**: Maximum **3 automated messages** per 24 hours per recipient phone across all automated pipelines.
- Organizations may customize this threshold via `organizations.max_daily_sms_per_recipient`.
- Messages exceeding the limit are blocked with `suppressionReason: 'frequency_cap_exceeded'`.

---

## 8. Messaging Pipeline Compliance Matrix

| Pipeline | Manager Module | Classification | Consent Type | Quiet Hours Guard | Frequency Cap |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Missed Call Auto-Text** | `call-recovery.ts` | Transactional | Consumer inquiry | Yes (misdial/night checks) | 24-hour cooldown |
| **Appointments & Reminders** | `booking-manager.ts` | Transactional | Booking consent | Yes (reschedules) | Per appointment |
| **Quotes (Initial)** | `quote-manager.ts` | Transactional | Quote request | N/A (immediate request) | Standard |
| **Quote Follow-Ups (D2 & D5)** | `quote-manager.ts` | Marketing | Express/implied | Enforced (8AM-8PM) | Max 1/day |
| **Invoices & Receipts** | `invoice-manager.ts` | Transactional | Billing consent | N/A (transactional) | Standard |
| **Review Invitations** | `review-manager.ts` | Marketing | Service completion | Enforced (8AM-8PM) | 60-day cooldown |
| **Customer Reactivation** | `lifecycle-manager.ts`| Marketing | Prior customer | Enforced (8AM-8PM) | 30-day cooldown |

---

## 9. Immutable Compliance Audit Ledger

All compliance transitions and decisions are permanently recorded in `compliance_audit_logs`:
- `opt_out`: Caller sent STOP or admin manual suppression.
- `opt_in`: Caller sent START or admin manual opt-in.
- `help_requested`: Caller sent HELP.
- `message_sent`: Outbound message cleared all compliance gates.
- `message_suppressed`: Outbound message blocked (with specific reason: quiet hours, suppression list, frequency cap, or no consent).

---

## 10. Areas Requiring Legal & 10DLC Carrier Review

The following areas cannot be solved purely in software and require manual administrative and legal action by each operating business:

1. **A2P 10DLC Campaign Registration**:
   - Each tenant must register an Employer Identification Number (EIN) and legal business address with The Campaign Registry (TCR).
   - Telnyx messaging profiles must be linked to approved TCR Campaign IDs (e.g. *Customer Care*, *Mixed*, or *Account Notifications*).
2. **Website Opt-In Disclosures**:
   - Web forms collecting phone numbers (such as online booking or quote requests) must display compliant disclosure language:
     > *"By providing your phone number, you agree to receive text messages from [Business Name] regarding your appointment or service request. Message frequency varies. Message and data rates may apply. Reply STOP to cancel at any time. Reply HELP for info. View Privacy Policy & Terms."*
3. **Toll-Free Verification**:
   - If using Toll-Free numbers (800, 888, 877), a Toll-Free Verification application must be submitted and approved by carriers before sending traffic.
4. **State-Specific Mini-TCPAs**:
   - Certain states (e.g., Florida FTSA, Washington CUB) have stricter quiet hours (e.g., 8:00 AM – 8:00 PM EST) and lower daily attempt limits. Operators should configure `enforce_quiet_hours` accordingly.
