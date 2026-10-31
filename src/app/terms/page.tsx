import React from 'react'
import Link from 'next/link'
import { BrandIcon } from '@/components/brand/brand-logo'
import {
  FileText,
  ShieldCheck,
  MessageSquare,
  AlertTriangle,
  CreditCard,
  Ban,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
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
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 selection:bg-emerald-500 selection:text-white font-[var(--font-sans)] antialiased">
      {/* ── Top Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#090A0F]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandIcon className="w-8 h-8 rounded-xl shadow-xs group-hover:scale-105 transition-transform" priority />
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
                CaptoDesk
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                  TERMS
                </span>
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link
              href="/"
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </Link>
            <Link
              href="/privacy"
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-all"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
        {/* Title Header */}
        <div className="space-y-4 border-b border-zinc-800/80 pb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono font-medium">
            <FileText className="w-3.5 h-3.5" />
            <span>SaaS Subscription & Carrier Messaging Agreement</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
            These Terms of Service govern your access to CaptoDesk, our field service growth platform, carrier telephony routing, automated booking workflows, and electronic customer notifications.
          </p>
          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono pt-2">
            <span>Effective Date: {lastUpdated}</span>
            <span>•</span>
            <span>Version: 3.2</span>
          </div>
        </div>

        {/* ── CRITICAL CARRIER DISCLOSURE BOX: SMS TERMS OF SERVICE ── */}
        <section className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-zinc-950 to-zinc-950 p-6 sm:p-8 space-y-6 shadow-xl shadow-emerald-950/10">
          <div className="flex items-center gap-3 text-emerald-400 font-bold text-sm sm:text-base">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span>Carrier Messaging Terms of Service (SMS/MMS Communications)</span>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans">
            <p>
              By opting into SMS communications through a CaptoDesk booking link (e.g., <code>book.captodesk.com/[slug]</code>), submitting an online quote inquiry, or communicating directly with a CaptoDesk-powered telephone number, you expressly agree to the following telephony terms:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/20 space-y-1">
                <span className="font-bold text-emerald-300 block">1. Program Description</span>
                <span className="text-xs text-zinc-400">
                  CaptoDesk provides transactional service communications, missed call auto-replies, dispatch arrival alerts, appointment management links, estimate updates, and 2-way customer service messaging on behalf of licensed trade contractors.
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/20 space-y-1">
                <span className="font-bold text-emerald-300 block">2. Cancellation / Opt-Out (STOP)</span>
                <span className="text-xs text-zinc-400">
                  You can cancel SMS notifications at any time by texting <strong>STOP</strong>, <strong>UNSUBSCRIBE</strong>, <strong>CANCEL</strong>, <strong>END</strong>, or <strong>QUIT</strong> to our number. You will receive a single confirmation message, and no further messages will be sent unless you text <strong>START</strong>.
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/20 space-y-1">
                <span className="font-bold text-emerald-300 block">3. Customer Support (HELP)</span>
                <span className="text-xs text-zinc-400">
                  If you need assistance or information regarding text messages, reply with <strong>HELP</strong> or <strong>INFO</strong>, or email us at <code>support@captodesk.com</code>.
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-emerald-500/20 space-y-1">
                <span className="font-bold text-emerald-300 block">4. Message Frequency & Rates</span>
                <span className="text-xs text-zinc-400">
                  Message frequency varies based on your appointments and active inquiries. <strong>Message and data rates may apply</strong> under your mobile carrier plan.
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-1">
              <span className="font-semibold text-zinc-300 block">Participating Carriers & Carrier Liability:</span>
              <p>
                Messages are supported across major US mobile carriers, including AT&amp;T, T-Mobile, Verizon, Sprint, US Cellular, and affiliated MVNO providers. <strong>Mobile carriers are not liable for delayed or undelivered messages.</strong>
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 1: Agreement to Terms ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">01.</span>
            <span>Agreement to Terms</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            By creating an account, accessing the CaptoDesk contractor portal, or integrating your telephony forwarding lines, you represent that you are at least 18 years of age, have the legal authority to bind your contracting enterprise, and agree to be bound by these Terms and our Privacy Policy.
          </p>
        </section>

        {/* ── Section 2: Platform Subscriptions & Billing ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">02.</span>
            <span>Subscriptions, Billing & Money-Back Guarantee</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            CaptoDesk is offered on a SaaS subscription basis (Solo Pro or Team &amp; Fleet Pro tiers) with either monthly or discounted annual renewal terms:
          </p>

          <div className="space-y-3 pt-2 text-xs sm:text-sm text-zinc-400">
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-1">
              <span className="font-bold text-zinc-200 block">Payment Methods</span>
              <span>Subscriptions are billed automatically via PayPal Recurring Billing or Stripe credit card transactions. All fees are in US Dollars.</span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-1">
              <span className="font-bold text-zinc-200 block">Month-to-Month Freedom &amp; Transparent Billing</span>
              <span>Paid subscriptions operate on a month-to-month basis with zero long-term commitments. Telephony usage charges or carrier setup fees are non-refundable once provisioned with carriers.</span>
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-1">
              <span className="font-bold text-zinc-200 block">Graceful Cancellation & Downgrade</span>
              <span>You may cancel your subscription at any time via your Settings &amp; Billing dashboard or PayPal billing agreement. Upon cancellation, your account transitions to the Free tier, preserving your historical customer records and public booking URL without surprise fees.</span>
            </div>
          </div>
        </section>

        {/* ── Section 3: Telephony & Call Forwarding Responsibilities ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">03.</span>
            <span>Telephony Routing & Emergency Services Disclaimer</span>
          </h2>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-xs sm:text-sm text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>IMPORTANT: No 911 or Emergency Calling Services</span>
            </div>
            <p>
              CaptoDesk provides automated business dispatching and SMS text-back services. <strong>CaptoDesk is NOT a traditional dial tone telecommunications provider and does NOT provide access to 911, E911, or emergency public safety answering points.</strong> You must ensure that your primary business phone lines maintain access to emergency calling independent of CaptoDesk.
            </p>
          </div>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed pt-1">
            Contractors are solely responsible for configuring call forwarding codes with their mobile carrier (e.g. T-Mobile, AT&amp;T, Verizon, Mint Mobile). Carrier codes may vary depending on your carrier plan.
          </p>
        </section>

        {/* ── Section 4: Acceptable Use Policy ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">04.</span>
            <span>Acceptable Use Policy (AUP)</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            You agree not to misuse the CaptoDesk platform. Prohibited activities strictly include:
          </p>

          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-zinc-400">
            <li className="flex items-start gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>Sending unsolicited bulk spam or purchasing consumer phone lists</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>Impersonating other contractors or forging caller ID metadata</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>High-risk financial schemes, predatory lending, or cannabis messaging</span>
            </li>
            <li className="flex items-start gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-850">
              <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>Harassment, threatening language, or violating TCPA quiet hours</span>
            </li>
          </ul>
        </section>

        {/* ── Section 5: Intellectual Property & Data Ownership ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">05.</span>
            <span>Customer Data Ownership & Intellectual Property</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            You retain 100% intellectual property ownership of your customer lists, trade pricing, uploaded diagnostic photos, quotes, and branding assets. CaptoDesk owns all rights, title, and interest in and to the platform software, algorithms, recovery engines, and user interfaces.
          </p>
        </section>

        {/* ── Section 6: Limitation of Liability ── */}
        <section className="space-y-4 pt-4">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">06.</span>
            <span>Limitation of Liability & Warranty Disclaimer</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CAPTODESK IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS WITHOUT WARRANTIES OF ANY KIND. CAPTODESK SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, MISSED SERVICE JOBS, OR CARRIER TELEPHONY INTERRUPTIONS, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICES. IN NO EVENT SHALL OUR TOTAL AGGREGATE LIABILITY EXCEED THE TOTAL AMOUNT PAID BY YOU TO CAPTODESK DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        {/* ── Section 7: Governing Law & Contact ── */}
        <section className="space-y-4 pt-4 border-t border-zinc-850">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <span className="text-emerald-400 font-mono text-base">07.</span>
            <span>Governing Law & Legal Contact</span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            These Terms shall be governed by and construed in accordance with the laws of the United States. If you have questions regarding these Terms or carrier regulatory requirements, please contact:
          </p>

          <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/80 space-y-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 text-zinc-200 font-bold">
              <Building className="w-4 h-4 text-emerald-400" />
              <span>CaptoDesk Platform Legal & Carrier Relations</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Mail className="w-4 h-4 text-zinc-500" />
              <span>Email: <a href="mailto:legal@captodesk.com" className="text-emerald-400 hover:underline">legal@captodesk.com</a></span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <Scale className="w-4 h-4 text-zinc-500" />
              <span>Website: <a href="https://captodesk.com" className="text-emerald-400 hover:underline">https://captodesk.com</a></span>
            </div>
          </div>
        </section>
      </main>

      {/* ── Simple Legal Footer ── */}
      <footer className="border-t border-zinc-850 bg-zinc-950 py-8 px-4 text-center text-xs text-zinc-600">
        <p>© {new Date().getFullYear()} CaptoDesk Platform. All rights reserved. 10DLC & TCPA Carrier Certified Architecture.</p>
      </footer>
    </div>
  )
}
