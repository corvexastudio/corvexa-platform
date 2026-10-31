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
  Building,
  ExternalLink,
  CalendarCheck
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
      // Graceful fallback
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#FAFAFB] text-slate-900 selection:bg-blue-600 selection:text-white font-[var(--font-sans)] antialiased overflow-x-hidden">
      
      {/* ── 1. Top Navigation Bar ── */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <BrandIcon className="w-8 h-8 group-hover:scale-105 transition-transform" priority />
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-tight text-slate-900">
                  Capto<span className="text-blue-600">Desk</span>
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold uppercase tracking-wider hidden sm:inline">
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-500 tracking-wide uppercase font-mono -mt-1 hidden sm:block">
                For Trade Contractors
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links (Streamlined High-Signal Links) */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#simulator" className="hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="#engines" className="hover:text-blue-600 transition-colors">
              Core Engines
            </a>
            <a href="#calculator" className="hover:text-blue-600 transition-colors">
              ROI Calculator
            </a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/client/dashboard"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
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
                  href="/client/login?mode=signup"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Claim Free Booking Page</span>
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
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 shadow-lg">
            <div className="flex flex-col space-y-2 text-sm font-semibold text-slate-700">
              <a
                href="#simulator"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-lg"
              >
                How It Works
              </a>
              <a
                href="#engines"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-lg"
              >
                Core Engines
              </a>
              <a
                href="#calculator"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-lg"
              >
                ROI Calculator
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-lg"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-lg"
              >
                FAQ
              </a>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 hover:bg-slate-50 rounded-lg text-blue-600 font-bold"
              >
                Contact &amp; Demo
              </Link>
            </div>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              <Link
                href="/client/login"
                className="w-full py-2.5 text-center text-xs font-bold text-slate-700 bg-slate-100 rounded-xl"
              >
                Sign In
              </Link>
              <Link
                href="/client/login?mode=signup"
                className="w-full py-2.5 text-center text-xs font-bold text-white bg-blue-600 rounded-xl shadow-sm"
              >
                Claim Free Booking Page
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-12 pb-14 sm:pt-20 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        {/* Soft Ambient Radial Lights */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.10),rgba(255,255,255,0))] pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Editorial Category Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>BUILT FOR PLUMBING, HVAC, ELECTRICAL, ROOFING &amp; FIELD TRADES</span>
          </div>

          {/* Primary Headline - Sharp, Visceral, Clean */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 leading-[1.08] max-w-4xl mx-auto">
            Never lose another job <br className="hidden sm:inline" />
            <span className="text-blue-600">while you&apos;re on a ladder.</span>
          </h1>

          {/* Sub-Headline - Direct Outcome */}
          <p className="text-base sm:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            When you can&apos;t pick up, CaptoDesk instantly texts the customer in 8 seconds, reserves the booking on your calendar, tracks your truck live, and collects payment on site with Apple Pay.
          </p>

          {/* Primary Call to Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
            <Link
              href="/client/login?mode=signup"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Claim Free Booking Page</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </Link>
            <a
              href="#simulator"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all shadow-2xs cursor-pointer"
            >
              <span>Watch 60-Sec Live Demo</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </a>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Free booking link • Zero credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Works with your existing number (*62)
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" /> Zero customer app downloads
            </span>
          </div>
        </div>

        {/* ── HERO PEDESTAL: The Live Interactive Phone Simulator ── */}
        <div id="simulator" className="mt-12 sm:mt-16">
          <DualPhoneSimulator />
        </div>
      </section>

      {/* ── 3. Infrastructure & Trade Authority Strip ── */}
      <section className="border-y border-slate-200 bg-white py-8 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-blue-600 block">8.2s</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Average Text Response Time</span>
          </div>
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-slate-900 block">100% Free</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Online Booking Page Included</span>
          </div>
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-emerald-600 block">0 Apps</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Zero Customer Friction (Mobile Web)</span>
          </div>
          <div className="p-2">
            <span className="font-mono text-3xl sm:text-4xl font-extrabold text-indigo-600 block">Instant</span>
            <span className="text-xs sm:text-sm text-slate-600 font-semibold mt-1 block">Digital On-Site Invoicing</span>
          </div>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-mono text-slate-400">
          <span>✓ TELNYX TIER-1 TELECOM RAILS</span>
          <span>✓ 10DLC CARRIER REGISTERED</span>
          <span>✓ TCPA COMPLIANT ARCHITECTURE</span>
          <span>✓ 99.9% UPTIME INFRASTRUCTURE</span>
        </div>
      </section>

      {/* ── 4. The 4 Operational Revenue Engines (Bento Grid) ── */}
      <section id="engines" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            01 / FIELD OPERATIONS HUB
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            The 4 Engines That Stop Revenue Leaks
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            Engineered for work gloves and dusty trucks. Stop losing jobs, eliminate anxious &quot;Where are you?&quot; calls, and get paid before you leave the driveway.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
          
          {/* Bento 1: 8-Second Missed Call Catcher (7 Columns) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
                <PhoneMissed className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Stop losing $650 service calls to Google competitors.
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                85% of homeowners hang up on voicemail and immediately call the next contractor on Google. CaptoDesk intercepts them in 8 seconds with an automated 2-way conversational text, answers their emergency, and locks in their booking before they search anyone else.
              </p>
            </div>

            {/* Visual Chat Preview */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs font-sans">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-b border-slate-200/60 pb-2">
                <span className="flex items-center gap-1.5 text-rose-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  Missed Call: (555) 234-5678
                </span>
                <span>Auto-Text Sent in 6.2s</span>
              </div>
              <div className="max-w-[90%] bg-white border border-slate-200 text-slate-800 p-3 rounded-xl rounded-tl-xs shadow-2xs leading-relaxed">
                &quot;Hey Sarah! Mike here with Apex Plumbing. Missed your call while finishing a service job—what&apos;s going on with your plumbing?&quot;
              </div>
              <div className="max-w-[90%] ml-auto bg-blue-600 text-white p-3 rounded-xl rounded-tr-xs shadow-2xs leading-relaxed">
                &quot;Water heater is leaking all over my basement floor! Can someone come out today?&quot;
              </div>
              <div className="text-[11px] text-emerald-700 font-bold text-right pt-1 flex items-center justify-end gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Homeowner stopped calling competitors • Job locked in</span>
              </div>
            </div>
          </div>

          {/* Bento 2: Instant Mobile Invoicing (5 Columns) */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Get paid before you turn the truck key.
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap &quot;Finish Job&quot; on your phone. An itemized invoice instantly appears on the homeowner&apos;s live tracking screen. They tap Apple Pay or card right from their driveway. Zero paper checks. Zero evening invoice chasing.
              </p>
            </div>

            {/* Visual Invoice Receipt Card */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Invoice #INV-2026-084:</span>
                <span className="font-mono text-base font-bold text-white">$650.00</span>
              </div>
              <div className="space-y-1.5 text-[11px] pt-2 border-t border-slate-800">
                <div className="flex justify-between text-slate-300">
                  <span>Service:</span>
                  <span>Water Heater Relief Valve &amp; Flush</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Payment Status:</span>
                  <span>Paid via Apple Pay (On Site)</span>
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-300 text-center font-bold">
                ✓ Receipt texted to homeowner • Paid in 15 seconds
              </div>
            </div>
          </div>

          {/* Bento 3: Uber-Style Live GPS Arrival (5 Columns) */}
          <div className="lg:col-span-5 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <Navigation className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Kill &quot;Where is my technician?&quot; calls forever.
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap &quot;On My Way&quot; with one thumb in your truck. The homeowner gets a live tracking link with your photo, truck, and real-time GPS arrival map. Anxious customers stay calm; your phone stays quiet.
              </p>
            </div>

            {/* Visual Tracker Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  Technician En Route
                </span>
                <span className="font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 text-[11px]">
                  ETA 12 Min
                </span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-sm font-bold">
                  MR
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Mike Rodriguez (Master Tech)</p>
                  <p className="text-[11px] text-slate-500">Apex Plumbing Truck #3 • 4.9 ★ (142 reviews)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Bento 4: 5-Star Reputation Shield (7 Columns) */}
          <div className="lg:col-span-7 rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Dominate your local Google Maps rankings on autopilot.
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                5 minutes after payment, CaptoDesk texts the customer a 1-tap review link. Happy customers are routed directly to leave 5 stars on Google. Unhappy feedback is routed privately to your inbox before it damages your public reputation.
              </p>
            </div>

            {/* Visual Smart Routing Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                <div className="flex items-center gap-1 text-emerald-800 font-bold">
                  <Star className="w-4 h-4 fill-emerald-600 text-emerald-600" />
                  <span>4 or 5 Stars (Delighted)</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  Routes straight to your Google Business Profile to boost your SEO ranking.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                <div className="flex items-center gap-1 text-rose-800 font-bold">
                  <ShieldCheck className="w-4 h-4 text-rose-600" />
                  <span>1 to 3 Stars (Private Shield)</span>
                </div>
                <p className="text-[11px] text-rose-700">
                  Sent privately to your dashboard so you can make it right before public damage.
                </p>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── 5. Revenue Calculator Section ── */}
      <section id="calculator" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 bg-slate-50/70 border-y border-slate-200/80">
        <RevenueCalculator />
      </section>

      {/* ── 6. Comparison Section ── */}
      <section id="comparison" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            03 / THE FIELD TRUTH
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Why Contractors Choose CaptoDesk
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Compare CaptoDesk against traditional answering services and complex $400/mo enterprise software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* Column 1: Traditional Voicemail */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Option 1</span>
              <h3 className="text-lg font-bold text-slate-900">Voicemail &amp; Answering Services</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Answering services charge $300 to $800/mo and only take messages. By the time you call back, the customer hired someone else.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> 2-hour callback delay loses 85% of leads
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> No live technician tracking
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Chasing unpaid paper checks
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Zero automated Google reviews
                </li>
              </ul>
            </div>
          </div>

          {/* Column 2: Bloated Legacy CRMs */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Option 2</span>
              <h3 className="text-lg font-bold text-slate-900">Jobber / ServiceTitan</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Complex enterprise platforms that require weeks of training, force customers to install apps, and take excessive cuts of your revenue.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Chasing late invoices and manual billing
                </li>
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Forces customers to download an app
                </li>
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> 4-week onboarding learning curve
                </li>
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> $200 - $500/mo base subscription
                </li>
              </ul>
            </div>
          </div>

          {/* Column 3: CaptoDesk (Elevated Winner) */}
          <div className="rounded-3xl border-2 border-blue-600 bg-gradient-to-b from-blue-50/50 via-white to-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl relative">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm">
              ENGINEERED FOR FIELD TRADES
            </span>
            <div className="space-y-4 pt-1">
              <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">The Modern Standard</span>
              <h3 className="text-xl font-bold text-slate-900">CaptoDesk Platform</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Fires in 8 seconds, gives customers an Uber-like experience with zero app downloads, and collects instant payment on site.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-800 pt-2 border-t border-blue-100">
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> 8-second 2-way text locks in leads
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Instant on-site Apple Pay &amp; card checkout
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Zero customer app downloads required
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Live in 2 minutes with simple carrier forwarding
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Free booking link tier with no card required
                </li>
              </ul>
            </div>

            <Link
              href="/client/login?mode=signup"
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center shadow-md shadow-blue-600/20 transition-all block cursor-pointer"
            >
              Get Started Free
            </Link>
          </div>

        </div>
      </section>

      {/* ── 7. Transparent Pricing ── */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest block">
            04 / TRANSPARENT PRICING
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Simple Pricing. Zero Contracts.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Claim your free booking page today, or choose a Pro tier to activate 24/7 missed-call rescue.
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
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <span>Yearly Billing</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                2 Months Free
              </span>
            </button>
          </div>

          <div className="pt-2">
            <span className="text-xs text-slate-500 font-medium">
              Dedicated business phone number and carrier setup included with all Pro plans.
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* Card 1: Free Tier */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs relative flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  FREE FOREVER
                </span>
                <span className="text-xs text-slate-500 font-mono">Solo Tradesman</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">$0</span>
                  <span className="text-xs font-semibold text-slate-500">/ forever</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Free public booking link for your website &amp; cards.</p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Dedicated booking link</strong> (book.captodesk.com/your-business)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Self-service customer appointment scheduling</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Job calendar &amp; manual invoice creation</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <X className="w-4 h-4 shrink-0" />
                  <span>No dedicated carrier phone number</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <X className="w-4 h-4 shrink-0" />
                  <span>No automated missed-call text-back</span>
                </div>
              </div>
            </div>

            <Link
              href="/client/login?mode=signup"
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs text-center transition-all block cursor-pointer"
            >
              Claim Free Booking Link
            </Link>
          </div>

          {/* Card 2: CaptoDesk Solo (Most Popular) */}
          <div className="rounded-3xl border-2 border-blue-600 bg-white p-6 sm:p-8 shadow-xl relative flex flex-col justify-between space-y-6">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
              MOST POPULAR FOR OWNER-OPERATORS
            </span>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                  SOLO PRO
                </span>
                <span className="text-xs text-slate-500 font-mono">1 Truck / Owner-Operator</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">
                    ${billingCycle === 'monthly' ? '99' : '79'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    / mo {billingCycle === 'annual' && '(billed $950/yr)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Full 24/7 missed-call lead rescue &amp; mobile invoicing.</p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-800 border-t border-slate-100 pt-4 font-medium">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Dedicated Carrier Phone Number</strong> included</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>8-Second 2-Way Text-Back</strong> on missed calls</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Live GPS Arrival Tracking</strong> texted to homeowners</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Instant Mobile Invoicing</strong> &amp; Apple Pay checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>5-Star Google Review Booster</strong> &amp; Reputation Shield</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Full 10DLC Carrier Registration Included</span>
                </div>
              </div>
            </div>

            <Link
              href="/client/login?mode=signup"
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center shadow-md shadow-blue-600/25 transition-all block cursor-pointer"
            >
              Get Started with Solo Pro
            </Link>
          </div>

          {/* Card 3: CaptoDesk Multi-Crew */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs relative flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  MULTI-CREW FLEET
                </span>
                <span className="text-xs text-slate-500 font-mono">Growing Teams (2-10 Trucks)</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">
                    ${billingCycle === 'monthly' ? '199' : '159'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    / mo {billingCycle === 'annual' && '(billed $1,900/yr)'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Multi-technician dispatch, field portal &amp; fleet routing.</p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Everything in Solo Pro</strong>, plus:</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Up to 10 Technician Mobile Logins</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dedicated Technician Field Mode (/client/field)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Multi-Crew Dispatch Board &amp; Schedule Broadcast</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Individual Technician Review Attribution</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Priority 24/7 Telephone &amp; SMS Tech Support</span>
                </div>
              </div>
            </div>

            <Link
              href="/contact"
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs text-center transition-all block cursor-pointer"
            >
              Talk to a Fleet Specialist
            </Link>
          </div>

        </div>
      </section>

      {/* ── 8. Contractor FAQ ── */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <FaqSection />
      </section>

      {/* ── 9. Final High-Trust CTA Banner ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold">
            <CalendarCheck className="w-4 h-4" />
            <span>START WITH A FREE BOOKING PAGE</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            Stop Losing Jobs While You&apos;re on Ladders. Get Started Today.
          </h2>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Claim your free personalized booking link in 60 seconds with no credit card required, or upgrade to Solo Pro to activate 24/7 automated missed-call rescue and live arrival tracking.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href="/client/login?mode=signup"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Claim Free Booking Page</span>
              <ArrowRight className="w-4 h-4 text-emerald-300" />
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm sm:text-base flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Request 10-Min Live Demo</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 10. Footer ── */}
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
              Live Demo
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

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <p>© {new Date().getFullYear()} CaptoDesk Platform. All rights reserved. 10DLC &amp; TCPA Compliant Carrier Architecture.</p>
          <p>Carrier Telephony Powered by Telnyx Tier-1 Telecom Rails</p>
        </div>
      </footer>

    </div>
  )
}
