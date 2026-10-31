import React from 'react'
import Link from 'next/link'
import { BrandIcon } from '@/components/brand/brand-logo'
import {
  ShieldCheck,
  Lock,
  Server,
  FileCheck,
  UserCheck,
  ArrowLeft,
  ChevronRight,
  Building,
  Mail,
  Scale
} from 'lucide-react'

export const metadata = {
  title: 'Privacy Policy | CaptoDesk Platform',
  description: 'Understand how CaptoDesk collects, uses, protects, and governs your business data and telephony information with strict carrier and regulatory compliance.'
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'October 31, 2026'

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 selection:bg-blue-600 selection:text-white font-[var(--font-sans)] antialiased">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandIcon className="w-8 h-8 group-hover:scale-105 transition-transform" priority />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                Capto<span className="text-blue-600">Desk</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-semibold uppercase tracking-wider">
                  LEGAL
                </span>
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
            <Link
              href="/terms"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all shadow-2xs"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        {/* Title Header */}
        <div className="space-y-4 border-b border-slate-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-800 text-xs font-mono font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>CTIA &amp; 10DLC Carrier Compliant Policy</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Privacy Policy
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
            This Privacy Policy details how CaptoDesk (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) governs information collection, storage, encryption, and carrier telephony compliance across our cloud software, public booking portals, and messaging infrastructure.
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono pt-2">
            <span>Effective Date: {lastUpdated}</span>
            <span>•</span>
            <span>Version: 3.2</span>
          </div>
        </div>

        {/* ── CRITICAL CARRIER DISCLOSURE BOX (CARRIER VERIFICATION HIGHLIGHT) ── */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-6 sm:p-8 space-y-4 shadow-sm">
          <div className="flex items-center gap-3 text-blue-900 font-bold text-sm sm:text-base">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <Lock className="w-5 h-5" />
            </div>
            <span>Mandatory Carrier Non-Sharing Disclosure (Mobile SMS Privacy)</span>
          </div>

          <div className="p-4 sm:p-5 rounded-xl bg-white border border-blue-200 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans space-y-2 shadow-2xs">
            <p className="font-bold text-blue-900">
              Mobile Information Sharing:
            </p>
            <p>
              <strong>
                No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties or affiliates under any circumstances.
              </strong>
            </p>
            <p className="text-slate-500 text-xs pt-1">
              Opt-in data, phone numbers collected for notification purposes, and consent records remain strictly confidential and are exclusively utilized to facilitate contracted business communications between contractors and their respective customers.
            </p>
          </div>
        </section>

        {/* ── Executive Summary Callouts ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Server className="w-4 h-4 text-blue-600" />
              <span>Multi-Tenant RLS</span>
            </div>
            <p className="text-[12px] text-slate-600 leading-snug">
              Every contractor&apos;s customer data is cryptographically isolated via PostgreSQL Row-Level Security.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <Lock className="w-4 h-4 text-blue-600" />
              <span>Encrypted Transit &amp; Rest</span>
            </div>
            <p className="text-[12px] text-slate-600 leading-snug">
              All communications are routed via TLS 1.3 in transit and AES-256 encryption at rest.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>No Ad Tracking</span>
            </div>
            <p className="text-[12px] text-slate-600 leading-snug">
              We do not sell data, host advertising pixels, or broker consumer behavior datasets.
            </p>
          </div>
        </div>

        {/* ── Section 1: Information We Collect ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">01.</span>
            <span>Information We Collect</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We collect only the data necessary to provide operational field dispatching, telephony recovery, automated appointment booking, quote generation, and customer communications:
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                A. Contractor Account &amp; Identity Data
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                When you create an account, subscribe to a tier, or configure your business profile, we collect your legal business name, trade category, contact phone number, email address, physical service territory, and billing preferences. Payment details (credit cards or PayPal credentials) are tokenized and processed authoritatively via Stripe and PayPal; CaptoDesk never stores raw cardholder data.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                B. Telephony &amp; Communication Records
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                To execute missed-call auto-replies and 2-way SMS communication, our infrastructure processes call metadata (caller phone number, timestamp, call duration, busy/unanswered status) and SMS message bodies transmitted through our carrier partner (Telnyx). Call audio is not recorded unless an explicit voicemail or forwarding configuration is activated by the contractor.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                C. End-Customer Appointment &amp; Service Data
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                When your customers book service appointments via your dedicated booking portal (e.g., <code>book.captodesk.com/[slug]</code>) or interact with SMS quotes, we store their provided full name, mobile telephone number, service address, service selection, and optional diagnostic intake photos to assist your technicians.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 2: How We Use Information ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">02.</span>
            <span>How We Use Information</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Your data is used strictly for fulfilling contracted operational purposes:
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-700">
            <li className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Dispatching automated SMS responses to missed customer inquiries</span>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Confirming appointments and providing calendar sync management links</span>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Enforcing TCPA quiet hours and anti-harassment frequency caps</span>
            </li>
            <li className="flex items-start gap-2.5 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <ChevronRight className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>Generating and tracking estimates, jobs, invoices, and customer reviews</span>
            </li>
          </ul>
        </section>

        {/* ── Section 3: Carrier Regulations & TCPA Compliance ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">03.</span>
            <span>TCPA, CTIA &amp; Carrier Messaging Compliance</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            CaptoDesk operates under strict automated adherence to the Telephone Consumer Protection Act (TCPA) and CTIA Messaging Principles:
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                <FileCheck className="w-4 h-4" />
                <span>Automated STOP / Opt-Out Processing</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an end-customer replies with <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, <strong>CANCEL</strong>, <strong>END</strong>, or <strong>QUIT</strong>, our compliance engine instantaneously suppresses their phone number across the organization. No further automated or manual messages can be dispatched to that number until the recipient explicitly replies <strong>START</strong>.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-600">
                <Clock className="w-4 h-4" />
                <span>TCPA Quiet Hours Enforcement</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Unless explicitly confirmed as an urgent service emergency, non-emergency promotional and automated review requests are restricted during local evening quiet hours (9:00 PM to 8:00 AM recipient local time) to protect consumer privacy.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 4: Data Security & Multi-Tenancy ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">04.</span>
            <span>Security Architecture &amp; Data Isolation</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            We employ bank-grade security protocols to protect contractor and consumer data against unauthorized disclosure, interception, or tampering:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-600">
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Row-Level Security (RLS)</span>
              <span>All database queries are scoped by validated cryptographic JWTs; contractors cannot query or mutate records belonging to other tenants.</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Restricted Field Tech Views</span>
              <span>Field technicians access a hardened mobile portal displaying only dispatch notes and job locations, with complete exclusion of financial pricing and billing states.</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Cryptographic Webhook Signatures</span>
              <span>Inbound telephony and billing webhooks verify Ed25519 and HMAC SHA-256 signatures before triggering downstream automation.</span>
            </div>
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Audit Logging</span>
              <span>All privileged tenant mutations, compliance updates, and billing activations produce immutable audit trail entries.</span>
            </div>
          </div>
        </section>

        {/* ── Section 5: Data Retention & User Rights ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">05.</span>
            <span>Data Retention, Portability &amp; Your Rights</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Contractors retain complete ownership of their client data. You may request an export of your customer records, appointments, and invoicing history at any time. If you choose to terminate your subscription, your data is retained for 30 days to allow for safe data migration, after which it may be permanently purged upon written verification.
          </p>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            End-consumers who have booked through a CaptoDesk contractor portal may request verification or deletion of their contact record by contacting the respective business directly or submitting a request to our privacy team.
          </p>
        </section>

        {/* ── Section 6: Contact Information ── */}
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">06.</span>
            <span>Contact &amp; Compliance Office</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            If you have questions regarding this Privacy Policy, your rights, or telephony carrier registration, please contact our compliance office:
          </p>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Building className="w-4 h-4 text-blue-600" />
              <span>CaptoDesk Platform Legal &amp; Carrier Compliance</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Email: <a href="mailto:privacy@captodesk.com" className="text-blue-600 font-medium hover:underline">privacy@captodesk.com</a></span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Scale className="w-4 h-4 text-slate-400" />
              <span>Website: <a href="https://captodesk.com" className="text-blue-600 font-medium hover:underline">https://captodesk.com</a></span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Simple Legal Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-8 px-4 text-center text-xs text-slate-500">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} CaptoDesk Platform. All rights reserved. 10DLC &amp; TCPA Carrier Certified Architecture.</p>
          <div className="flex items-center gap-4 text-slate-500 font-medium">
            <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">Terms of Service</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function Clock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}
