# CaptoDesk — First Customer Demonstration Guide (US Lawn Care & Home Services)

**Target Audience:** US Lawn Care & Home-Service Business Owners (Mowing, Landscaping, Turf Care, Tree Service)  
**Tone:** Practical, direct, respectful of contractor time, value-focused  
**Target Duration:** ~15–20 minutes total (3-minute live product walkthrough, 10-minute discovery conversation, 2-minute wrap-up & trial proposal)

---

## Section A: 3-Minute Live Demonstration Script

### Presenter Preparation & Pre-Demo Setup
1. **Browser Windows Ready:**
   - Tab 1: CaptoDesk Unified Inbox (`http://localhost:3088/client/inbox` or preview URL)
   - Tab 2: Leads Pipeline (`/client/leads`)
   - Tab 3: Field Schedule (`/client/field`)
2. **Environment & Safety Check:**
   - Synthetic demo tenant active: `CaptoDesk Demo Services` (`26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7`)
   - Telnyx and Stripe mock dispatch active (`TELNYX_MOCK_DISPATCH=true`, `STRIPE_MOCK_DISPATCH=true`)
   - Scenario ready: Marcus Vance (Green Valley HOA), `+15125550188`, seeking weekly lawn maintenance & seasonal aeration.

---

### [0:00 – 0:45] Step 1: The Problem — The $60/Week Lost on the Riding Mower

> **Presenter Script:**
>
> *"Hey [Owner First Name], thanks for taking three minutes. I know you're busy running crews and keeping mowers moving, so I’ll get right to the point.*
>
> *When you’re sitting on a zero-turn mower or string-trimming an edge, your phone is in your pocket buzzing. You can’t stop the machine, take off your gloves, and answer it.*
>
> *Here’s what happens next: that homeowner doesn't leave a voicemail. They just open Google, click the next lawn care contractor on the list, and hire whoever picks up first. That single missed call just cost you a $60-a-week regular customer — which is over $1,500 for the season.*
>
> *CaptoDesk exists to solve that exact moment."*

---

### [0:45 – 1:30] Step 2: The Simulated Missed Call & Instant Auto-Recovery

> **Presenter Script:**
>
> *"Let’s watch what happens in real time when someone calls your business number while you're working.*
>
> *(Point to screen or trigger demo simulation)*
>
> *Marcus Vance, a property manager for Green Valley HOA in Austin, just called your business line. The call rang through and went unanswered.*
>
> *Within 5 seconds, CaptoDesk recognizes the missed call and triggers an automatic text-back tailored specifically for lawn care:*
>
> > **'Hi, this is CaptoDesk Lawn Services! We're currently out on a yard and couldn't grab the phone. How can we help you with your property today?'**
>
> *(Honest Disclosure Note to Prospect):*
> *'In this demonstration, our telephony carrier dispatch is safely simulated so we don’t ping a real phone carrier, but the entire messaging engine, lead creation, and timing are identical to what runs on your live business number.'*"

---

### [1:30 – 2:15] Step 3: Lead Arrives in Inbox & Owner Follow-Up

> **Presenter Script:**
>
> *(Switch to Unified Inbox tab: `/client/inbox`)*
>
> *"Now, look at your screen. You don't have to scramble through your call log or listen to garbled voicemails.*
>
> *Right here in your Unified Inbox, a dedicated conversation thread has automatically opened for Marcus Vance. His phone number and contact card are already created, and his lead is logged in your pipeline under 'New Inquiries'.*
>
> *The homeowner texts back right away:*
> > **'Hi! We need weekly lawn mowing and edging for our common areas, plus a quote for seasonal aeration. Can someone come by Thursday?'**
>
> *When you take a water break or finish your cut, you open your phone, tap Marcus's thread, and reply:*
> > **'Hi Marcus! Absolutely. We're in your neighborhood every Thursday afternoon. I have a 2:00 PM slot open for an on-site property walkthrough.'**
>
> *Zero phone tag. Zero missed business. The homeowner stopped searching because you already engaged them."*

---

### [2:15 – 3:00] Step 4: One-Click Booking & Field Scheduling

> **Presenter Script:**
>
> *(Switch to Field Schedule tab: `/client/field`)*
>
> *"To lock it in, you can book Marcus directly from the chat or let him pick an open slot from your online scheduling link.*
>
> *Notice our calendar automatically prevents double-booking. If another client tries to book that exact Thursday 2:00 PM slot, CaptoDesk instantly blocks the collision and offers the next available window.*
>
> *Once booked, Marcus receives an automated confirmation text with a self-service management link where he can see his technician arrival window, and you have his lawn service appointment pinned to your field schedule.*
>
> *You just turned a missed phone call while mowing into a contracted client before your competitor even noticed their phone rang."*

---

## Section B: Customer-Discovery Script for US Lawn Care Contractors

Keep these questions conversational, friendly, and grounded in daily fieldwork. Do not interrogate; listen actively and note their answers.

### Question 1: In-the-Field Call Handling
> *"When you're personally on a mower, or when your crews are running loud two-stroke trimmers, how do you handle incoming calls from people you don't recognize?"*
- **What to listen for:** "I let it go to voicemail," "I stop the mower and try to answer," "My spouse answers," or "I call back at 6 PM."
- **Follow-up bridge:** *"When you call back at 6 PM, what percentage of those people have already hired someone else?"*

### Question 2: The Lost Opportunity Metric
> *"In peak spring and summer season, how many calls from potential new customers do you think you miss in a typical week?"*
- **What to listen for:** "Probably 5 to 10 a week during April and May."
- **Calculation bridge:** *"If even 2 of those 5 missed calls were bi-weekly mowings or mulch jobs, that's roughly $300 to $500 in lost revenue every single week, right?"*

### Question 3: Current Follow-Up Workflow
> *"Walk me through what happens today when you finish work for the day. Do you sit at a desk with pen and paper, or are you texting people from your personal cell phone?"*
- **What to listen for:** Using personal cell, mixing personal texts with customer texts, forgetting who called first, losing customer addresses.
- **Value bridge:** *"Imagine keeping your personal cell private, having all lawn leads in one clean inbox, and knowing exactly what every customer asked for before you call them."*

### Question 4: Value and Willingness to Pay
> *"If CaptoDesk picked up every single missed call with an instant text, captured the homeowner's address and service request, and put them on your calendar — without you having to touch your phone while mowing — is that something that would pay for itself in your first week?"*
- **What to listen for:** "Yeah, if it books even one lawn, it pays for the whole year."

---

## Section C: Demo Completion & Operational Checklist

| Demo Stage | Observable Verification in CaptoDesk UI | Provider Action State | Verification Status |
| :--- | :--- | :--- | :--- |
| **1. Missed Call Recovery** | Call record logged in `/client/inbox`; automated text-back appears in conversation history. | **Mocked** (`TELNYX_MOCK_DISPATCH=true`). Zero carrier fees incurred. | **VERIFIED** |
| **2. Lead Generation** | Contact created (`Marcus Vance`); Lead card appears in `/client/leads` with status `new` and source `missed_call`. | Internal DB only. Fully real application logic. | **VERIFIED** |
| **3. Inbox Conversation** | Thread active in `/client/inbox`; shows incoming homeowner response and owner reply with timestamps. | Internal DB and WebSocket state. Carrier dispatch mocked. | **VERIFIED** |
| **4. Appointment Booking** | Appointment created in `/client/field` for requested service (`Weekly Lawn Mowing & Edging`); customer manage token issued. | Internal DB booking engine. | **VERIFIED** |
| **5. Collision Protection** | Attempted duplicate booking at identical slot rejected with `"This time slot is no longer available"`. | Database exclusion constraint & manager validation. | **VERIFIED** |

### Live Customer Pilot Prerequisites (Blockers for Real-World Rollout)
Before turning on CaptoDesk for a live customer's actual business phone line:
1. **Telnyx 10DLC Brand & Campaign Approval:** Must complete TCR (The Campaign Registry) brand registration for the contractor's legal entity to guarantee carrier SMS delivery without carrier filtering.
2. **Dedicated Inbound DID Provisioning:** Allocate and assign a clean local or toll-free number mapped to the client's organization.
3. **Call Forwarding Setup:** Provide simple dial codes (e.g., `*71` conditional call forwarding for AT&T/Verizon/T-Mobile) so when the owner doesn't answer on their cell within 4 rings, it rolls over to CaptoDesk.
4. **Stripe Connect Onboarding:** If the contractor wants to collect credit card deposits or invoice payments automatically, they must link their bank account via Stripe Connect.

---

## Section D: Commercial Follow-Up Template

### Channel: SMS (Short, High-Response)
```text
Hey [Owner First Name], great speaking with you today about [Company Name]! 

As promised, here is the link to our 14-day zero-risk trial: [Custom Onboarding Link]. 

We'll set up your dedicated forwarding number with your custom text-back ('Sorry we missed your call, we're out on a yard...') in under 10 minutes. 

Let's catch those missed lawn mowing calls this week so they stop going to your competitors.
```

### Channel: Email (Professional & Concrete)
```text
Subject: Stopping missed-call leaks for [Company Name]

Hi [Owner First Name],

Thanks for taking a few minutes to chat today about how [Company Name] handles calls when you and the crews are out in the field.

As we discussed, when you’re running mowers or managing jobs, stopping to answer an unknown number isn’t realistic — but letting that homeowner call the next contractor on Google costs real money.

Here is what we agreed to set up for your 14-day trial:
1. A dedicated business recovery line that receives your unanswered calls.
2. An instant automated text-back tailored to your business:
   "Hi, this is [Company Name]! We're currently out servicing a property and couldn't grab the phone. What service can we help you with today?"
3. Your Unified Inbox so you can see new homeowner inquiries, quote requests, and addresses right from your phone without mixing them with personal text messages.

You can activate your setup here: [Onboarding Link]

It takes about 10 minutes to configure, and you don’t need to change your existing phone number or carrier.

Looking forward to helping you lock in more yards this season.

Best regards,

[Your Name]
CaptoDesk Home Services Specialist
captodesk.com
```
