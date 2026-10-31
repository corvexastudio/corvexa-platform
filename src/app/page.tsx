'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PhoneCall,
  PhoneMissed,
  Navigation,
  CreditCard,
  Star,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Clock,
  Zap,
  Check,
  X,
  Menu,
  ChevronRight,
  Wrench,
  DollarSign,
  Truck,
  MessageSquare,
  HelpCircle,
  Building
} from 'lucide-react'
import { DualPhoneSimulator } from '@/components/landing/dual-phone-simulator'
import { RevenueCalculator } from '@/components/landing/revenue-calculator'
import { FaqSection } from '@/components/landing/faq-section'
import { BrandIcon } from '@/components/brand/brand-logo'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  // Check if visitor is already logged in to customize CTA
  useEffect(() => {
    try {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }: { data: any }) => {
        if (data?.user) setIsAuthenticated(true)
      })
    } catch {
      // In case client initialization fails gracefully
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 selection:bg-emerald-500 selection:text-white font-[var(--font-sans)] antialiased overflow-x-hidden">
      
      {/* ── 1. Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandIcon className="w-8 h-8 rounded-xl shadow-xs group-hover:scale-105 transition-transform" priority />
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                CaptoDesk
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold uppercase tracking-wider hidden sm:inline">
                  PRO
                </span>
              </span>
              <span className="text-[9.5px] font-medium text-slate-500 tracking-wide uppercase font-mono -mt-1 hidden sm:block">
                For Trade Contractors
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600">
            <a href="#simulator" className="hover:text-emerald-700 transition-colors">
              Live Simulator
            </a>
            <a href="#calculator" className="hover:text-emerald-700 transition-colors">
              Revenue Calculator
            </a>
            <a href="#engines" className="hover:text-emerald-700 transition-colors">
              4 Core Engines
            </a>
            <a href="#comparison" className="hover:text-emerald-700 transition-colors">
              Comparison
            </a>
            <a href="#pricing" className="hover:text-emerald-700 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors">
              FAQ
            </a>
            <Link href="/contact" className="hover:text-emerald-700 transition-colors">
              Contact
            </Link>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/client/dashboard"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                <span>Open Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/client/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/contact"
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
                >
                  Book Demo
                </Link>
                <Link
                  href="/client/login?mode=signup"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-600/25 transition-all flex items-center gap-1"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-hidden"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 py-4 space-y-3 text-sm font-semibold shadow-lg">
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              Live Simulator
            </a>
            <a
              href="#calculator"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              Revenue Calculator
            </a>
            <a
              href="#engines"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              4 Core Engines
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              Why CaptoDesk
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              FAQ
            </a>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-slate-700 hover:text-emerald-600"
            >
              Talk to a Specialist
            </Link>
            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              <Link
                href="/client/login"
                className="w-full text-center py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg"
              >
                Sign In
              </Link>
              <Link
                href="/client/login?mode=signup"
                className="w-full text-center py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg shadow-sm"
              >
                Get Started Free
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Subtle background radiant wash */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="text-center max-w-4xl mx-auto space-y-6 relative z-10">
          {/* Trade Authority Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/90 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Built for Plumbing, HVAC, Electrical &amp; Roofing Contractors</span>
          </div>

          {/* Primary Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Never Miss a $1,500 Service Call While You&apos;re Working on a Ladder.
          </h1>

          {/* Sub-Headline */}
          <p className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            CaptoDesk catches unanswered calls in <strong>8 seconds</strong> with an automated 2-way text, tracks job arrivals live like Uber, and collects payment on site with Apple Pay for just <strong>0.5% flat</strong>.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/client/login?mode=signup"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>Start 30-Day Risk-Free Trial</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-2xs"
            >
              <span>Request 10-Min Walkthrough</span>
              <ChevronRight className="w-4 h-4 text-emerald-600" />
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Works with your existing business number
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Zero customer app downloads
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> 30-day money-back guarantee
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Carrier 10DLC registration included
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Infrastructure & Trade Authority Strip ── */}
      <section className="border-y border-slate-200 bg-white py-8 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-emerald-600 block">8.2s</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Average Text Response Time</span>
          </div>
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-slate-900 block">0.5% Flat</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Invoicing Take-Rate (Half of Jobber)</span>
          </div>
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-blue-600 block">0 Apps</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Frictionless Mobile Web for Customers</span>
          </div>
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-emerald-700 block">48 Hours</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Rolling Bank Payouts via Stripe</span>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-mono text-slate-400">
          <span>✓ TELNYX TIER-1 TELECOM RAILS</span>
          <span>✓ STRIPE CONNECT VERIFIED</span>
          <span>✓ 10DLC CARRIER COMPLIANT</span>
          <span>✓ 99.9% UPTIME INFRASTRUCTURE</span>
        </div>
      </section>

      {/* ── 4. The Interactive Dual-Phone Simulator ── */}
      <section id="simulator" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>INTERACTIVE PRODUCT TEST DRIVE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            See Exactly What Happens on the Job Site
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Watch how CaptoDesk stops homeowners from calling competitors while keeping you hands-free.
          </p>
        </div>
        <DualPhoneSimulator />
      </section>

      {/* ── 5. The 4 Operational Revenue Engines ── */}
      <section id="engines" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12 bg-slate-50/60 rounded-3xl border border-slate-200/80 my-8">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Wrench className="w-3.5 h-3.5 text-emerald-600" />
            <span>BUILT FOR WORK GLOVES &amp; DUSTY TRUCKS</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            The 4 Engines That Stop Revenue Leaks
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Every feature is designed to put money directly into your bank account and eliminate office friction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Engine 1: Missed Call Catch */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-xs hover:border-emerald-500/50 transition-all">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <PhoneMissed className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              1. The 8-Second Missed-Call Catch
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              When you are in an attic, under a sink, or driving, you can&apos;t answer. CaptoDesk instantly dispatches a conversational 2-way text that asks what their emergency is, captures their address, and stops them from calling the next contractor on Google Maps.
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono">
              <span className="text-emerald-700 font-bold block mb-1">PROVEN FIELD RESULT:</span>
              &quot;Saved 3 AC replacement calls last month while on a roof. That&apos;s $14,000 in work I would have completely lost.&quot;
            </div>
          </div>

          {/* Engine 2: Live Job Tracker */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-xs hover:border-amber-500/50 transition-all">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              2. Domino&apos;s-Style Live Customer Tracking
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Homeowners hate waiting around with vague 4-hour arrival windows. When you tap &quot;On My Way&quot;, they get a clean tracking link with your technician photo, truck info, live ETA, and tap-to-call buttons. Kills the &quot;Where are you?&quot; phone calls so you can focus on driving.
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono">
              <span className="text-amber-700 font-bold block mb-1">PROVEN FIELD RESULT:</span>
              Zero phone interruptions while driving. Customers feel like they are receiving premium white-glove service.
            </div>
          </div>

          {/* Engine 3: 0.5% Invoicing & Checkout */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-xs hover:border-emerald-500/50 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              3. 0.5% Flat Mobile Invoicing &amp; Payouts
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              The moment work is finished, the invoice appears directly on the customer&apos;s tracking link. Homeowners tap Apple Pay or credit card right in front of you. CaptoDesk charges a clean 0.5% platform fee—saving thousands compared to CRMs taking 1.5% to 2.5% markups.
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono">
              <span className="text-emerald-700 font-bold block mb-1">PROVEN FIELD RESULT:</span>
              Get paid on the spot. No paper checks, no check bounce risks, and funds deposit directly to your bank account.
            </div>
          </div>

          {/* Engine 4: Google Review Booster */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-4 shadow-xs hover:border-blue-500/50 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900">
              4. Automated 5-Star Google Review Booster
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Automated review prompt fires 5 minutes after payment. 4 and 5-star ratings route straight to your Google Maps profile to rank you #1 in local search. Lower ratings are intercepted into a private owner-feedback form so you can resolve issues before anyone posts publicly.
            </p>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 font-mono">
              <span className="text-blue-700 font-bold block mb-1">PROVEN FIELD RESULT:</span>
              More 5-star Google reviews every week with an automatic shield against vindictive 1-star complaints.
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Revenue Calculator Section ── */}
      <section id="calculator" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <RevenueCalculator />
      </section>

      {/* ── 7. Direct Comparison Table ── */}
      <section id="comparison" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Why Contractors Are Ditching Clunky CRMs
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Compare CaptoDesk against legacy software and traditional voicemail.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                <th className="p-4 sm:p-5">Capability</th>
                <th className="p-4 sm:p-5 text-slate-400">Pen, Paper &amp; Voicemail</th>
                <th className="p-4 sm:p-5 text-slate-500">Jobber / ServiceTitan</th>
                <th className="p-4 sm:p-5 bg-emerald-50 text-emerald-800 border-x border-emerald-200">
                  CaptoDesk
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-4 sm:p-5 font-bold text-slate-900">Missed Call Response</td>
                <td className="p-4 sm:p-5 text-slate-400">Call back 2 hours later (lead gone)</td>
                <td className="p-4 sm:p-5 text-slate-500">Basic or requires expensive add-on</td>
                <td className="p-4 sm:p-5 bg-emerald-50/50 font-bold text-emerald-700 border-x border-emerald-100">
                  ✓ Instant 2-Way Text in 8 Seconds
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-slate-900">Live Customer Tracker</td>
                <td className="p-4 sm:p-5 text-slate-400">None (customer calls you 3 times)</td>
                <td className="p-4 sm:p-5 text-slate-500">Requires clunky portal or login</td>
                <td className="p-4 sm:p-5 bg-emerald-50/50 font-bold text-emerald-700 border-x border-emerald-100">
                  ✓ 1-Tap Mobile Tracking Link
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-slate-900">Customer App Downloads</td>
                <td className="p-4 sm:p-5 text-slate-400">None</td>
                <td className="p-4 sm:p-5 text-slate-500">Often forces app download or password</td>
                <td className="p-4 sm:p-5 bg-emerald-50/50 font-bold text-emerald-700 border-x border-emerald-100">
                  ✓ Zero App Downloads (Mobile Web)
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-slate-900">Invoicing Platform Fee</td>
                <td className="p-4 sm:p-5 text-slate-400">Paper checks / slow clearing</td>
                <td className="p-4 sm:p-5 text-slate-500">1.0% to 2.5% platform markup</td>
                <td className="p-4 sm:p-5 bg-emerald-50/50 font-bold text-emerald-700 border-x border-emerald-100">
                  ✓ 0.5% Flat Platform Fee
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-slate-900">Setup Time</td>
                <td className="p-4 sm:p-5 text-slate-400">Instant (but bleeds revenue)</td>
                <td className="p-4 sm:p-5 text-slate-500">2 to 4 weeks onboarding calls</td>
                <td className="p-4 sm:p-5 bg-emerald-50/50 font-bold text-emerald-700 border-x border-emerald-100">
                  ✓ 2 Minutes (Simple *62 Forwarding)
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-bold text-slate-900">Contract / Lock-In</td>
                <td className="p-4 sm:p-5 text-slate-400">None</td>
                <td className="p-4 sm:p-5 text-slate-500">Often 1-year annual lock-in</td>
                <td className="p-4 sm:p-5 bg-emerald-50/50 font-bold text-emerald-700 border-x border-emerald-100">
                  ✓ Month-to-Month, Cancel Anytime
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 8. Straightforward Pricing ── */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>TRANSPARENT CONTRACTOR PRICING</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Simple Pricing. Zero Contracts.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            One extra booked job covers your entire year of CaptoDesk. Choose the tier that matches your business size.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center p-1.5 bg-slate-100 border border-slate-200 rounded-2xl gap-2 mt-4 shadow-2xs">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                2 Months Free
              </span>
            </button>
          </div>

          {/* Setup Fee Transparency Pill */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span><strong>Limited Launch Special:</strong> White-glove carrier 10DLC registration &amp; dedicated number fee (<span className="line-through text-slate-400">$199 - $299</span>) is <strong>100% WAIVED ($0.00)</strong> with any Pro plan!</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* Card 1: Free Tier */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs relative flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  FREE TIER
                </span>
                <span className="text-xs text-slate-500 font-mono">Solo Tradesman</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">Free Booking Tier</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Everything you need to book jobs online and organize your trade schedule. Zero contracts.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100">
                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 font-mono">
                  $0
                </span>
                <span className="text-slate-500 text-sm font-medium">/ month</span>
              </div>
              <p className="text-[11px] text-emerald-700 font-mono font-medium">
                ✓ No credit card required • Zero setup fees
              </p>

              <div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Unlimited Public Booking Link</strong> for your Google Maps &amp; cards</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>100% Unmasked</strong> customer contact names &amp; phone numbers</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Interactive Calendar &amp; Job Scheduling work orders</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Customer Directory CRM &amp; Service Catalog</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Before &amp; After Job Photo upload intake</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                href="/client/login?mode=signup&plan=free"
                className="w-full py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <span>Start Free — No Card Needed</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Solo Operator */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs relative flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                  SOLO OPERATOR
                </span>
                <span className="text-xs text-slate-500 font-mono">1 Truck / Van</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">CaptoDesk Solo</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Built for solo owner-operators. Capture missed calls, manage routes, and get paid on site.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100">
                <span className="text-lg font-bold text-slate-400 line-through decoration-rose-500 decoration-2">
                  {billingCycle === 'monthly' ? '$149' : '$1,188'}
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'monthly' ? '99' : '82.50'}
                </span>
                <span className="text-slate-500 text-sm font-medium">/ month</span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] font-mono">
                <span className="text-emerald-700 font-medium">
                  {billingCycle === 'monthly'
                    ? '✓ Standard monthly ($99/mo) • Cancel anytime'
                    : '✓ $990 billed yearly (2 Months Free)'}
                </span>
                <span className="text-slate-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                  <span>Setup &amp; Carrier Reg: <span className="line-through text-slate-400">$199.00</span> <strong>$0.00 (Waived)</strong></span>
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>1 Owner-Operator User</strong> included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dedicated local phone line (10DLC verified)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Instant 8-second missed-call recovery SMS</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mobile Field Portal with photo intake</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Apple Pay &amp; Card Invoicing at <strong>0.5% flat</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Customer live tracking links</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Automated 5-star Google review booster</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                href={`/client/login?mode=signup&plan=solo&interval=${billingCycle}`}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <span>
                  {billingCycle === 'monthly'
                    ? 'Subscribe Solo — $99/mo'
                    : 'Subscribe Solo — $990/yr'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 3: Multi-Crew Fleet */}
          <div className="rounded-3xl border-2 border-emerald-500 bg-white p-6 sm:p-8 shadow-md relative flex flex-col justify-between space-y-6">
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs uppercase font-mono tracking-wider rounded-bl-xl shadow-xs">
              MOST POPULAR FOR TEAMS
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  GROWING FLEET
                </span>
                <span className="text-xs text-slate-500 font-mono">Up to 5 Technicians</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">CaptoDesk Multi-Crew</h3>
                <p className="text-xs text-slate-500 mt-1">
                  For service businesses with helpers, crews, or technicians. Keep every truck dispatched and busy.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-slate-100">
                <span className="text-lg font-bold text-slate-400 line-through decoration-rose-500 decoration-2">
                  {billingCycle === 'monthly' ? '$299' : '$2,388'}
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'monthly' ? '199' : '165.80'}
                </span>
                <span className="text-slate-500 text-sm font-medium">/ month</span>
              </div>
              <div className="flex flex-col gap-1 text-[11px] font-mono">
                <span className="text-emerald-700 font-medium">
                  {billingCycle === 'monthly'
                    ? '✓ Standard monthly ($199/mo) • Up to 5 Techs'
                    : '✓ $1,990 billed yearly (2 Months Free)'}
                </span>
                <span className="text-slate-600 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 inline" />
                  <span>Setup &amp; Carrier Reg: <span className="line-through text-slate-400">$299.00</span> <strong>$0.00 (Waived)</strong></span>
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Up to 5 Crew Members &amp; Technicians</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Everything in Solo Plan</strong>, plus:</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Multi-crew live dispatch board &amp; team schedule</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Restricted technician mobile portal (zero financial visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Automated morning crew route broadcast via SMS</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dedicated white-glove onboarding &amp; setup call</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Link
                href={`/client/login?mode=signup&plan=fleet&interval=${billingCycle}`}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <span>
                  {billingCycle === 'monthly'
                    ? 'Subscribe Multi-Crew — $199/mo'
                    : 'Subscribe Multi-Crew — $1,990/yr'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 font-medium">
          All plans include 30-day money-back guarantee • Carrier setup fee 100% waived • Keep your existing phone number
        </p>
      </section>

      {/* ── 9. Consultation & Demo Banner (B2B Bridge) ── */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="rounded-3xl bg-slate-900 text-white p-8 sm:p-12 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Personalized Setup Assistance</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Prefer to see it live before deciding?
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm max-w-lg">
              Book a 10-minute live screen walkthrough with an operations specialist. We&apos;ll configure your trade workflow, test call forwarding, and answer all your questions.
            </p>
          </div>
          <div className="shrink-0 w-full sm:w-auto">
            <Link
              href="/contact"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
            >
              <span>Schedule 10-Min Walkthrough</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 10. Frequently Asked Questions ── */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <FaqSection />
      </section>

      {/* ── 11. Final High-Converting Call to Action ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-900 text-white text-center space-y-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
            Stop Losing Jobs to Voicemail.
          </h2>
          <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto leading-relaxed">
            Activate CaptoDesk on your next 20 service calls. If you don&apos;t save at least two jobs that would have slipped through the cracks, we will refund 100% of your software fee.
          </p>
          <div className="pt-2">
            <Link
              href="/client/login?mode=signup"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-xl shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5"
            >
              <span>Activate CaptoDesk Pro Risk-Free →</span>
            </Link>
          </div>
          <p className="text-xs text-slate-400 font-mono">
            Takes 2 minutes to set up • Keep your existing number • 30-day guarantee
          </p>
        </div>
      </section>

      {/* ── 12. Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <BrandIcon className="w-6 h-6 rounded-md shadow-2xs" size={24} />
            <span className="font-bold text-slate-800 text-sm">CaptoDesk</span>
            <span className="text-slate-300">•</span>
            <span>The Field Growth System for Trade Contractors</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/client/login" className="hover:text-slate-900 transition-colors">
              Contractor Login
            </Link>
            <a href="#simulator" className="hover:text-slate-900 transition-colors">
              Live Simulator
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">
              FAQ
            </a>
            <Link href="/contact" className="hover:text-slate-900 transition-colors">
              Contact &amp; Demo
            </Link>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-900 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} CaptoDesk Platform. All rights reserved. 10DLC &amp; TCPA Compliant Carrier Architecture.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <span>•</span>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <span>•</span>
            <span>Powered by Telnyx &amp; Stripe Connect</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
