import React from 'react'
import Link from 'next/link'
import { BrandIcon } from '@/components/brand/brand-logo'
import {
  FileText,
  MessageSquare,
  AlertTriangle,
  Ban,
  ArrowLeft,
  Building,
  Mail,
  Scale
} from 'lucide-react'

export const metadata = {
  title: 'Terms of Service | CaptoDesk Platform',
  description: 'Review the SaaS service agreement, subscriber obligations, acceptable use policy, and CTIA-compliant SMS terms for CaptoDesk.'
}

export default function TermsOfServicePage() {
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
                  TERMS
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
              href="/privacy"
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all shadow-2xs"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        {/* Title Header */}
        <div className="space-y-4 border-b border-slate-200 pb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-50 border border-blue-200/80 text-blue-800 text-xs font-mono font-medium">
            <FileText className="w-3.5 h-3.5 text-blue-600" />
            <span>SaaS Subscription &amp; Carrier Messaging Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900">
            Terms of Service
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
            These Terms of Service govern your access to CaptoDesk, our field service growth platform, carrier telephony routing, automated booking workflows, and electronic customer notifications.
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 font-mono pt-2">
            <span>Effective Date: {lastUpdated}</span>
            <span>•</span>
            <span>Version: 3.2</span>
          </div>
        </div>

        {/* ── CRITICAL CARRIER DISCLOSURE BOX: SMS TERMS OF SERVICE ── */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center gap-3 text-blue-900 font-bold text-sm sm:text-base">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span>Carrier Messaging Terms of Service (SMS/MMS Communications)</span>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-800 leading-relaxed font-sans">
            <p>
              By opting into SMS communications through a CaptoDesk booking link (e.g., <code>book.captodesk.com/[slug]</code>), submitting an online quote inquiry, or communicating directly with a CaptoDesk-powered telephone number, you expressly agree to the following telephony terms:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
                <span className="font-bold text-blue-900 block">1. Program Description</span>
                <span className="text-xs text-slate-600">
                  CaptoDesk provides transactional service communications, missed call auto-replies, dispatch arrival alerts, appointment management links, estimate updates, and 2-way customer service messaging on behalf of licensed trade contractors.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
                <span className="font-bold text-blue-900 block">2. Cancellation / Opt-Out (STOP)</span>
                <span className="text-xs text-slate-600">
                  You can cancel SMS notifications at any time by texting <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, <strong>CANCEL</strong>, <strong>END</strong>, or <strong>QUIT</strong> to our number. You will receive a single confirmation message, and no further messages will be sent unless you text <strong>START</strong>.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
                <span className="font-bold text-blue-900 block">3. Customer Support (HELP)</span>
                <span className="text-xs text-slate-600">
                  If you need assistance or information regarding text messages, reply with <strong>HELP</strong> or <strong>INFO</strong>, or email us at <code>support@captodesk.com</code>.
                </span>
              </div>

              <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs space-y-1">
                <span className="font-bold text-blue-900 block">4. Message Frequency &amp; Rates</span>
                <span className="text-xs text-slate-600">
                  Message frequency varies based on your appointments and active inquiries. <strong>Message and data rates may apply</strong> under your mobile carrier plan.
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-blue-200 text-xs text-slate-600 space-y-1.5 shadow-2xs">
              <span className="font-bold text-slate-900 block">Participating Carriers &amp; Carrier Liability:</span>
              <p>
                Messages are supported across major US mobile carriers, including AT&amp;T, T-Mobile, Verizon, Sprint, US Cellular, and affiliated MVNO providers. <strong>Mobile carriers are not liable for delayed or undelivered messages.</strong>
              </p>
              <p className="text-slate-500 pt-1">
                <strong>No mobile information will be shared with third parties or affiliates for marketing or promotional purposes.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 1: Agreement to Terms ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">01.</span>
            <span>Agreement to Terms</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            By creating an account, accessing the CaptoDesk contractor portal, or integrating your telephony forwarding lines, you represent that you are at least 18 years of age, have the legal authority to bind your contracting enterprise, and agree to be bound by these Terms and our Privacy Policy.
          </p>
        </section>

        {/* ── Section 2: Platform Subscriptions & Billing ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">02.</span>
            <span>Subscriptions, Billing &amp; Month-to-Month Terms</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            CaptoDesk is offered on a SaaS subscription basis (Solo Pro or Multi-Crew tiers) with either monthly or discounted annual renewal terms:
          </p>

          <div className="space-y-3 pt-2 text-xs sm:text-sm text-slate-600">
            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Payment Methods</span>
              <span>Subscriptions are billed automatically via PayPal Recurring Billing or Stripe credit card transactions. All fees are in US Dollars.</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Month-to-Month Freedom &amp; Transparent Billing</span>
              <span>Paid subscriptions operate on a month-to-month basis with zero long-term commitments. Telephony usage charges or carrier setup fees are non-refundable once provisioned with carriers.</span>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1">
              <span className="font-bold text-slate-900 block">Graceful Cancellation &amp; Downgrade</span>
              <span>You may cancel your subscription at any time via your Settings &amp; Billing dashboard or PayPal billing agreement. Upon cancellation, your account transitions to the Free tier, preserving your historical customer records and public booking URL without surprise fees.</span>
            </div>
          </div>
        </section>

        {/* ── Section 3: Telephony & Call Forwarding Responsibilities ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">03.</span>
            <span>Telephony Routing &amp; Emergency Services Disclaimer</span>
          </h2>

          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 text-xs sm:text-sm text-amber-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>IMPORTANT: No 911 or Emergency Calling Services</span>
            </div>
            <p>
              CaptoDesk provides automated business dispatching and SMS text-back services. <strong>CaptoDesk is NOT a traditional dial tone telecommunications provider and does NOT provide access to 911, E911, or emergency public safety answering points.</strong> You must ensure that your primary business phone lines maintain access to emergency calling independent of CaptoDesk.
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
            Contractors are solely responsible for configuring call forwarding codes with their mobile carrier (e.g. T-Mobile, AT&amp;T, Verizon, Mint Mobile). Carrier codes may vary depending on your carrier plan.
          </p>
        </section>

        {/* ── Section 4: Acceptable Use Policy ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">04.</span>
            <span>Acceptable Use Policy (AUP)</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            You agree not to misuse the CaptoDesk platform. Prohibited activities strictly include:
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-700">
            <li className="flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>Sending unsolicited bulk spam or purchasing consumer phone lists</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>Impersonating other contractors or forging caller ID metadata</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>High-risk financial schemes, predatory lending, or cannabis messaging</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
              <Ban className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>Harassment, threatening language, or violating TCPA quiet hours</span>
            </li>
          </ul>
        </section>

        {/* ── Section 5: Intellectual Property & Data Ownership ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">05.</span>
            <span>Customer Data Ownership &amp; Intellectual Property</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            You retain 100% intellectual property ownership of your customer lists, trade pricing, uploaded diagnostic photos, quotes, and branding assets. CaptoDesk owns all rights, title, and interest in and to the platform software, algorithms, recovery engines, and user interfaces.
          </p>
        </section>

        {/* ── Section 6: Limitation of Liability ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">06.</span>
            <span>Limitation of Liability &amp; Warranty Disclaimer</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CAPTODESK IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND. CAPTODESK SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, MISSED SERVICE JOBS, OR CARRIER TELEPHONY INTERRUPTIONS, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES. IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY EXCEED THE TOTAL AMOUNT PAID BY YOU TO CAPTODESK DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        {/* ── Section 7: Governing Law & Contact ── */}
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <span className="text-blue-600 font-mono text-base">07.</span>
            <span>Governing Law &amp; Legal Contact</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of the United States. If you have questions regarding these Terms or carrier regulatory requirements, please contact:
          </p>

          <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Building className="w-4 h-4 text-blue-600" />
              <span>CaptoDesk Platform Legal &amp; Carrier Relations</span>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="w-4 h-4 text-slate-400" />
              <span>Email: <a href="mailto:legal@captodesk.com" className="text-blue-600 font-medium hover:underline">legal@captodesk.com</a></span>
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
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
