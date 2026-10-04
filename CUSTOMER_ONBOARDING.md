# CaptoDesk Customer Onboarding & Launch Playbook

**Target:** Customer Success Managers, Onboarding Specialists, Account Executives  
**Target Customer:** U.S. Small Business Owner (Plumber, Electrician, HVAC, Roofer)  
**Time to Launch:** < 20 Minutes  
**Document Version:** 1.0.0  

---

## 1. Onboarding Journey Overview

```text
Step 1: Tenant Provisioning  (Slug, Timezone, Business Name)
   │
Step 2: Telnyx 10DLC Line   (Purchase / Assign Dedicated Number)
   │
Step 3: Call Forwarding     (Star-Code Config on Owner's Cell/Office Phone)
   │
Step 4: Business Rules      (Operating Hours, Auto-Reply Templates)
   │
Step 5: Catalog Setup       (Core Services, Durations, Buffer Times)
   │
Step 6: Google Review Sync  (Direct Review URL Setup)
   │
Step 7: Live Test Call      (Verify Inbound Ring -> SMS Recovery -> Booking)
```

---

## 2. Step-by-Step Launch Procedure

### Step 1: Provision Tenant Organization
1. Invite business owner via `/client/onboarding` or register them through `/admin/organizations`.
2. Input business legal name (e.g. *Apex Plumbing LLC*) and unique URL slug (e.g. `apex-plumbing`).
3. Set accurate local timezone (e.g. `America/Chicago`) for TCPA quiet hours and booking scheduling.

### Step 2: Assign Dedicated Telnyx Phone Number
1. In Telnyx or CaptoDesk admin, allocate a local area code number matching the business's metro area.
2. Link the number to the tenant's `organization.telnyx_phone_number`.
3. Verify the number is assigned to the registered **10DLC Campaign** (prevents carrier spam filtering).

### Step 3: Configure Conditional Call Forwarding
The business owner must forward **unanswered, busy, or unreachable** calls from their primary line to their CaptoDesk Telnyx number.

Provide the owner with their carrier-specific star code:
- **Verizon:** Dial `*71<TELNYX_NUMBER>` and press Call.
- **AT&T:** Dial `*67*<TELNYX_NUMBER>#` (busy) and `*61*<TELNYX_NUMBER>#` (no answer).
- **T-Mobile:** Dial `**004*<TELNYX_NUMBER>#` and press Call.
- **Landline / VoIP:** Set "Forward on No Answer after 4 rings" to `<TELNYX_NUMBER>` in carrier web portal.

### Step 4: Configure Auto-Reply Templates & Operating Hours
In **Settings** -> **Missed Calls**:
- **Normal Hours Template:**  
  *"Hey, this is {business_name}! We're on a job and missed your call. How can we help you today?"*
- **After-Hours Template:**  
  *"Thanks for calling {business_name}. We're closed for the evening, but received your message and will call you first thing tomorrow morning."*
- Verify business hours matches the owner's actual operating schedule.

### Step 5: Configure Services & Booking Mode
In **Settings** -> **Services**:
1. Add standard services (e.g. "Diagnostic Inspection", "Drain Clearing", "AC Maintenance").
2. Set service duration (e.g. 60 mins) and travel buffer (e.g. 15 mins).
3. Test public booking link: `https://app.corvexastudio.com/book/<slug>`.

### Step 6: Connect Google Reviews
In **Settings** -> **Reviews**:
1. Obtain the customer's Google Place Review link:
   - Go to Google Business Profile -> **Ask for reviews** -> Copy short URL.
2. Paste link into `organizations.google_review_url`.
3. Ensure Review Automation is toggled **ON** (neutral, FTC-compliant review invitation).

---

## 3. Pre-Launch Quality Verification Checklist

Execute this live test before handing over the system:
- [ ] **Test Call:** Call the business line from an external cell phone and let it ring until it forwards.
- [ ] **Recovery SMS:** Verify external cell phone receives recovery SMS within 15 seconds.
- [ ] **Lead Created:** Verify new lead card appears on `/client/leads` with phone number.
- [ ] **Two-Way Texting:** Reply "I have a leaking faucet" from cell phone; verify text appears in `/client/inbox`.
- [ ] **Booking Flow:** Follow booking link, select appointment slot, and verify confirmation SMS arrives.
- [ ] **Client Handover:** Invite owner to `/client/dashboard` and verify login credentials.
