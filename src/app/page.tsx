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
  ExternalLink,
  Flame,
  Award,
  Layers,
  Wrench,
  DollarSign
} from 'lucide-react'
import { DualPhoneSimulator } from '@/components/landing/dual-phone-simulator'
import { RevenueCalculator } from '@/components/landing/revenue-calculator'
import { FaqSection } from '@/components/landing/faq-section'
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
    <div className="min-h-screen bg-[#090A0F] text-zinc-100 selection:bg-emerald-500 selection:text-white font-[var(--font-sans)] antialiased overflow-x-hidden">
      {/* ── 1. Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#090A0F]/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-extrabold text-base shadow-md shadow-emerald-600/30 group-hover:bg-emerald-500 transition-colors">
              C
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5">
                CaptoDesk
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider hidden sm:inline">
                  PRO
                </span>
              </span>
              <span className="text-[9.5px] font-medium text-zinc-500 tracking-wide uppercase font-mono -mt-1 hidden sm:block">
                For Trade Contractors
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs sm:text-sm font-semibold text-zinc-300">
            <a href="#demo" className="hover:text-emerald-400 transition-colors">
              Live Simulator
            </a>
            <a href="#calculator" className="hover:text-emerald-400 transition-colors">
              Revenue Bleed
            </a>
            <a href="#features" className="hover:text-emerald-400 transition-colors">
              4 Core Engines
            </a>
            <a href="#comparison" className="hover:text-emerald-400 transition-colors">
              Comparison
            </a>
            <a href="#pricing" className="hover:text-emerald-400 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/client/dashboard"
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
              >
                <span>Open Dashboard</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/client/login"
                  className="px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/client/login"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-800 bg-zinc-950 px-4 py-4 space-y-3 text-sm font-semibold">
            <a
              href="#demo"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-zinc-300 hover:text-emerald-400"
            >
              Live Simulator
            </a>
            <a
              href="#calculator"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-zinc-300 hover:text-emerald-400"
            >
              Revenue Bleed Calculator
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-zinc-300 hover:text-emerald-400"
            >
              4 Core Engines
            </a>
            <a
              href="#comparison"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-zinc-300 hover:text-emerald-400"
            >
              Why CaptoDesk
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-zinc-300 hover:text-emerald-400"
            >
              Pricing
            </a>
            <a
              href="#faq"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-zinc-300 hover:text-emerald-400"
            >
              FAQ
            </a>
            <div className="pt-3 border-t border-zinc-800 flex flex-col gap-2">
              <Link
                href="/client/login"
                className="w-full text-center py-2 text-xs font-semibold text-zinc-300 bg-zinc-900 rounded-lg"
              >
                Sign In
              </Link>
              <Link
                href="/client/login"
                className="w-full text-center py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg shadow"
              >
                Get Started Today
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Glow Effects */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="text-center max-w-4xl mx-auto space-y-6">
          {/* Pre-Header Reality Check Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/25">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>62% of calls to contractors go straight to voicemail. Competitors answer them.</span>
          </div>

          {/* Main Headline (Zero AI Cliches) */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Stop Losing $1,500 Jobs Every Time Your Phone Rings on a Ladder.
          </h1>

          {/* Punchy Sub-Headline */}
          <p className="text-base sm:text-xl text-zinc-300 max-w-3xl mx-auto leading-relaxed">
            CaptoDesk catches unanswered calls in <strong>8 seconds</strong> with an instant two-way text, tracks jobs live like Uber so customers stop calling you for updates, and collects payment with Apple Pay for just <strong>0.5% flat</strong>.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/client/login"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <span>Get CaptoDesk Pro</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="#demo"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all"
            >
              <span>Watch 15-Sec Live Simulator</span>
              <ChevronRight className="w-4 h-4 text-emerald-400" />
            </a>
          </div>

          {/* Trust Guarantee Strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> 2-Minute Setup
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Keeps your existing business number
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Dedicated Phone Line Included
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" /> Zero customer app downloads
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Infrastructure & Trade Authority Strip ── */}
      <section className="border-y border-zinc-850 bg-zinc-950/60 py-6 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-400 block">8.2s</span>
            <span className="text-xs text-zinc-400 font-medium">Average Automated Text Response</span>
          </div>
          <div className="p-3">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold text-white block">0.5% Flat</span>
            <span className="text-xs text-zinc-400 font-medium">Platform Fee (Half of Jobber / ServiceTitan)</span>
          </div>
          <div className="p-3">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold text-cyan-400 block">0 Apps</span>
            <span className="text-xs text-zinc-400 font-medium">Zero Downloads Needed for Homeowners</span>
          </div>
          <div className="p-3">
            <span className="font-mono text-2xl sm:text-3xl font-extrabold text-amber-400 block">48 Hours</span>
            <span className="text-xs text-zinc-400 font-medium">Rolling Direct Bank Deposits via Stripe</span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-zinc-900 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-mono text-zinc-500">
          <span>✓ TELNYX TIER-1 TELECOM RAILS</span>
          <span>✓ STRIPE CONNECT VERIFIED</span>
          <span>✓ 10DLC CARRIER REGISTERED</span>
          <span>✓ 99.9% UPTIME CLOUD</span>
        </div>
      </section>

      {/* ── 4. The Interactive Revenue Bleed Calculator ── */}
      <section id="calculator" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <RevenueCalculator />
      </section>

      {/* ── 5. The Star Centerpiece: Interactive Dual-Phone Simulator ── */}
      <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-zinc-900/20 border-y border-zinc-850">
        <DualPhoneSimulator />
      </section>

      {/* ── 6. The 4 Core Revenue Engines (Deep Dive) ── */}
      <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Zap className="w-3.5 h-3.5" />
            <span>BUILT EXCLUSIVELY FOR HOME SERVICE TRADES</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            The 4 Engines That Stop Revenue Leaks
          </h2>
          <p className="text-sm sm:text-base text-zinc-400">
            Every feature is engineered to put money directly into your bank account and keep homeowners from calling competitors.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Engine 1: Missed Call Catch */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <PhoneMissed className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              1. The 8-Second AI Missed-Call Catch
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              When you are in an attic, under a sink, or driving with both hands on the wheel, you can&apos;t answer. CaptoDesk instantly fires an intelligent, conversational two-way text that asks what their emergency is, captures their address, and stops them from calling the next plumber or HVAC tech on Google.
            </p>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850 text-xs text-zinc-300 font-mono">
              <span className="text-emerald-400 font-bold block mb-1">CONTRACTOR RESULT:</span>
              &quot;Saved 3 HVAC replacement calls last month while on a roof. That&apos;s $14,000 in work I would have completely lost.&quot;
            </div>
          </div>

          {/* Engine 2: Live Job Tracker */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-4 hover:border-amber-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Navigation className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              2. Domino&apos;s-Style Live Job Tracking (/t/[token])
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Homeowners hate waiting around with a 4-hour window. When you tap &quot;On My Way&quot;, they get a live mobile tracking link showing your technician photo, truck info, live ETA, and tap-to-call buttons. Kills the endless &quot;Where are you?&quot; phone calls so you can focus on driving.
            </p>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850 text-xs text-zinc-300 font-mono">
              <span className="text-amber-400 font-bold block mb-1">CONTRACTOR RESULT:</span>
              Zero phone interruptions. Customers feel like they are getting white-glove service from a Fortune 500 company.
            </div>
          </div>

          {/* Engine 3: 0.5% Invoicing & Checkout */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-4 hover:border-emerald-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              3. 0.5% Flat Mobile Invoicing & Bank Payouts
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              The moment work is finished, the invoice card renders straight on the customer&apos;s tracking link. Homeowners tap Apple Pay or credit card right in front of you. CaptoDesk charges a clean 0.5% platform fee—saving you thousands compared to other platforms taking 1% to 2% markups.
            </p>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850 text-xs text-zinc-300 font-mono">
              <span className="text-emerald-400 font-bold block mb-1">CONTRACTOR RESULT:</span>
              Get paid on the spot. No paper checks, no check fraud, and 99.5% of the money deposits straight to your bank account.
            </div>
          </div>

          {/* Engine 4: Google Review Shield */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 space-y-4 hover:border-cyan-500/40 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <Star className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-white">
              4. The Smart 5-Star Google Review Shield
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Automated review prompt fires 5 minutes after payment. 4 and 5-star ratings route straight to your Google Maps listing to push you to #1 in local search. 1 to 3-star ratings are silently intercepted into a private owner-feedback form so you can resolve issues before anyone writes a public complaint.
            </p>
            <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-850 text-xs text-zinc-300 font-mono">
              <span className="text-cyan-400 font-bold block mb-1">CONTRACTOR RESULT:</span>
              More 5-star Google reviews every single week with an automatic shield against vindictive 1-star reviews.
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Direct Comparison Table: CaptoDesk vs The Alternatives ── */}
      <section id="comparison" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Why Contractors Are Ditching Clunky Software
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Compare CaptoDesk against legacy enterprise software and pen & paper.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60 font-semibold text-zinc-300">
                <th className="p-4 sm:p-5">Capability</th>
                <th className="p-4 sm:p-5 text-zinc-500">Pen, Paper & Voicemail</th>
                <th className="p-4 sm:p-5 text-zinc-400">Jobber / ServiceTitan</th>
                <th className="p-4 sm:p-5 bg-emerald-950/40 text-emerald-300 border-x border-emerald-500/30">
                  CaptoDesk
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850 text-zinc-300">
              <tr>
                <td className="p-4 sm:p-5 font-semibold text-white">Missed Call Response</td>
                <td className="p-4 sm:p-5 text-zinc-500">Call back 2 hours later (lead gone)</td>
                <td className="p-4 sm:p-5 text-zinc-400">Basic or requires expensive add-on</td>
                <td className="p-4 sm:p-5 bg-emerald-950/20 font-bold text-emerald-400 border-x border-emerald-500/20">
                  ✓ Instant 2-Way Text in 8 Seconds
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold text-white">Live Customer Tracker</td>
                <td className="p-4 sm:p-5 text-zinc-500">None (customer calls you 3 times)</td>
                <td className="p-4 sm:p-5 text-zinc-400">Requires clunky portal or login</td>
                <td className="p-4 sm:p-5 bg-emerald-950/20 font-bold text-emerald-400 border-x border-emerald-500/20">
                  ✓ 1-Tap Domino&apos;s Web Stepper (/t/[token])
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold text-white">Customer App Download</td>
                <td className="p-4 sm:p-5 text-zinc-500">None</td>
                <td className="p-4 sm:p-5 text-zinc-400">Often forces app download or password</td>
                <td className="p-4 sm:p-5 bg-emerald-950/20 font-bold text-emerald-400 border-x border-emerald-500/20">
                  ✓ Zero App Downloads (Mobile Web)
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold text-white">Invoicing Platform Fee</td>
                <td className="p-4 sm:p-5 text-zinc-500">Paper checks / slow bank clearing</td>
                <td className="p-4 sm:p-5 text-zinc-400">1.0% to 2.5% platform markup</td>
                <td className="p-4 sm:p-5 bg-emerald-950/20 font-bold text-emerald-400 border-x border-emerald-500/20">
                  ✓ 0.5% Flat Platform Fee
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold text-white">Setup Time</td>
                <td className="p-4 sm:p-5 text-zinc-500">Instant (but bleeds money)</td>
                <td className="p-4 sm:p-5 text-zinc-400">2 to 4 weeks onboarding calls</td>
                <td className="p-4 sm:p-5 bg-emerald-950/20 font-bold text-emerald-400 border-x border-emerald-500/20">
                  ✓ 2 Minutes (Simple *62 Forwarding)
                </td>
              </tr>
              <tr>
                <td className="p-4 sm:p-5 font-semibold text-white">Contract / Lock-In</td>
                <td className="p-4 sm:p-5 text-zinc-500">None</td>
                <td className="p-4 sm:p-5 text-zinc-400">Often 1-year annual lock-in</td>
                <td className="p-4 sm:p-5 bg-emerald-950/20 font-bold text-emerald-400 border-x border-emerald-500/20">
                  ✓ Month-to-Month, Cancel Anytime
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 8. "Built for Boots, Not Desks" ── */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 to-zinc-950 p-6 sm:p-12 text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
          <Wrench className="w-6 h-6" />
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          Software Built for Work Gloves and Dusty Trucks
        </h2>
        <p className="text-sm sm:text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed">
          You don&apos;t have time to sit in your truck typing paragraphs of notes into complex software while sweating in the summer heat. CaptoDesk is engineered with massive hit targets: advance a job from booked to paid with just <strong>two thumb taps</strong>.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-left">
          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
            <span className="font-bold text-white text-xs sm:text-sm block">1-Tap State Changes</span>
            <p className="text-zinc-400 text-xs">Massive buttons you can tap even with dirty work gloves on.</p>
          </div>
          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
            <span className="font-bold text-white text-xs sm:text-sm block">Keeps Existing Number</span>
            <p className="text-zinc-400 text-xs">No reprinting business cards or truck wraps. Uses simple carrier call forwarding.</p>
          </div>
          <div className="p-4 bg-zinc-950/80 border border-zinc-850 rounded-xl space-y-1">
            <span className="font-bold text-white text-xs sm:text-sm block">No Long Training</span>
            <p className="text-zinc-400 text-xs">If your technicians know how to send a text, they already know how to use CaptoDesk.</p>
          </div>
        </div>
      </section>

      {/* ── 9. Straightforward Pricing ── */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <DollarSign className="w-3.5 h-3.5" />
            <span>TRANSPARENT CONTRACTOR PRICING</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
            Simple Pricing. Zero Contracts.
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            One extra booked job covers your entire year of CaptoDesk. Choose the tier that matches your business size.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center p-1.5 bg-zinc-900 border border-zinc-800 rounded-2xl gap-2 mt-4">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-zinc-800 text-white shadow-md border border-zinc-700'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                billingCycle === 'annual'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-400/40 text-[10px] font-extrabold uppercase">
                2 Months Free
              </span>
            </button>
          </div>

          {/* Setup Fee Transparency Pill */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span><strong>One-Time $199 White-Glove Setup Fee:</strong> Includes custom business DID provisioning, carrier 10DLC TCR compliance registration, and 1-on-1 Zoom call-forwarding setup.</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Solo Operator ($99/mo or $990/yr) */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-xl relative flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                  SOLO OPERATOR
                </span>
                <span className="text-xs text-zinc-500 font-mono">1 Truck / Van</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white">CaptoDesk Solo</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Built for solo owner-operators. Capture missed calls, manage routes, and get paid on site.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-850">
                <span className="text-lg font-bold text-zinc-500 line-through decoration-rose-500 decoration-2">
                  {billingCycle === 'monthly' ? '$149' : '$1,188'}
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold text-white font-mono">
                  ${billingCycle === 'monthly' ? '99' : '82.50'}
                </span>
                <span className="text-zinc-400 text-sm font-medium">/ month</span>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono">
                {billingCycle === 'monthly'
                  ? '✓ Standard monthly ($99/mo) + $199 one-time setup'
                  : '✓ $990 billed yearly (Pay for 10 months, get 2 FREE) + $199 setup'}
              </p>

              <div className="space-y-2.5 text-xs text-zinc-300 pt-2 border-t border-zinc-850">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>1 Owner-Operator User</strong> included</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated local phone line (10DLC verified)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Instant 8-second AI missed-call recovery SMS</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Public booking link & calendar scheduling</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Mobile Field Portal (GPS maps & photo capture)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Apple Pay & Card Invoicing at <strong>0.5% flat</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Domino&apos;s customer live tracking links</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Automated 5-star Google review booster</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-850">
              <Link
                href="/client/login"
                className="w-full py-3.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all border border-zinc-700"
              >
                <span>
                  {billingCycle === 'monthly'
                    ? 'Get Started with Solo ($99/mo)'
                    : 'Get Started with Solo ($990/yr — 2 Mo Free)'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Card 2: Multi-Crew Fleet ($199/mo or $1,990/yr) */}
          <div className="rounded-3xl border-2 border-emerald-500 bg-zinc-950 p-6 sm:p-8 shadow-2xl relative flex flex-col justify-between space-y-6">
            <div className="absolute top-0 right-0 px-4 py-1.5 bg-emerald-600 text-white font-bold text-xs uppercase font-mono tracking-wider rounded-bl-xl shadow-md">
              MOST POPULAR FOR TEAMS
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  GROWING FLEET
                </span>
                <span className="text-xs text-zinc-400 font-mono">Up to 5 Technicians</span>
              </div>

              <div>
                <h3 className="text-2xl font-bold text-white">CaptoDesk Multi-Crew</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  For service businesses with helpers, crews, or technicians. Keep every truck dispatched and busy.
                </p>
              </div>

              <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-850">
                <span className="text-lg font-bold text-zinc-500 line-through decoration-rose-500 decoration-2">
                  {billingCycle === 'monthly' ? '$299' : '$2,388'}
                </span>
                <span className="text-4xl sm:text-5xl font-extrabold text-white font-mono">
                  ${billingCycle === 'monthly' ? '199' : '165.80'}
                </span>
                <span className="text-zinc-400 text-sm font-medium">/ month</span>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono">
                {billingCycle === 'monthly'
                  ? '✓ Standard monthly ($199/mo) + $199 one-time setup'
                  : '✓ $1,990 billed yearly (Pay for 10 months, get 2 FREE) + $199 setup'}
              </p>

              <div className="space-y-2.5 text-xs text-zinc-200 pt-2 border-t border-zinc-850">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Up to 5 Crew Members & Technicians</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span><strong>Everything in Solo Plan</strong>, plus:</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Multi-crew live dispatch board & team schedule</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Restricted technician mobile portal (zero financial visibility)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Role permissions (Owner, Admin, Dispatcher, Field Tech)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dynamic job routing by crew or vehicle</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Priority carrier message routing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Dedicated white-glove onboarding & setup call</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-850">
              <Link
                href="/client/login"
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all"
              >
                <span>
                  {billingCycle === 'monthly'
                    ? 'Get Started with Multi-Crew ($199/mo)'
                    : 'Get Started with Multi-Crew ($1,990/yr — 2 Mo Free)'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-500">
          All plans include 30-day money-back guarantee • $199 one-time setup fee • Keep your existing phone number
        </p>
      </section>

      {/* ── 10. Frequently Asked Questions ── */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-zinc-850">
        <FaqSection />
      </section>

      {/* ── 11. Final High-Converting Call to Action ── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-zinc-950 via-emerald-950/20 to-[#090A0F] border-t border-zinc-850 text-center space-y-6">
        <div className="max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
            Stop Donating Jobs to the Next Guy on Google.
          </h2>
          <p className="text-sm sm:text-base text-zinc-300 max-w-xl mx-auto">
            Activate CaptoDesk on your next 20 service calls. If you don&apos;t save at least two jobs that would have slipped through the cracks, we will refund 100% of your software fee.
          </p>
          <div className="pt-2">
            <Link
              href="/client/login"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-xl shadow-emerald-600/30 transition-all transform hover:-translate-y-0.5"
            >
              <span>Activate CaptoDesk Pro →</span>
            </Link>
          </div>
          <p className="text-xs text-zinc-500 font-mono">
            Takes 2 minutes to set up • Keep your existing number
          </p>
        </div>
      </section>

      {/* ── 12. Footer ── */}
      <footer className="border-t border-zinc-850 bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-xs">
              C
            </div>
            <span className="font-bold text-zinc-300 text-sm">CaptoDesk</span>
            <span className="text-zinc-600">•</span>
            <span>The Field Growth System for Trade Contractors</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/client/login" className="hover:text-zinc-300 transition-colors">
              Contractor Login
            </Link>
            <a href="#demo" className="hover:text-zinc-300 transition-colors">
              Live Simulator
            </a>
            <a href="#pricing" className="hover:text-zinc-300 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-zinc-300 transition-colors">
              FAQ
            </a>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-600">
          <p>© {new Date().getFullYear()} CaptoDesk Platform. All rights reserved. 10DLC & TCPA Compliant Carrier Architecture.</p>
          <div className="flex gap-4">
            <span>Powered by Telnyx & Stripe Connect</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
