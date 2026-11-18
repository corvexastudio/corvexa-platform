'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Calendar,
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
  CalendarCheck,
  PhoneCall,
  Smartphone
} from 'lucide-react'
import { DualPhoneSimulator } from '@/components/landing/dual-phone-simulator'
import { FaqSection } from '@/components/landing/faq-section'
import { ClaimBookingModal } from '@/components/landing/claim-booking-modal'
import { BrandIcon, BrandWordmark } from '@/components/brand/brand-logo'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showClaimModal, setShowClaimModal] = useState(false)
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
      
      {/* ── 1. Minimal Navigation Bar ── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandIcon className="w-8 h-8 group-hover:scale-105 transition-transform" priority />
            <BrandWordmark size="text-lg" />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#preview" className="hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="#features" className="hover:text-blue-600 transition-colors">
              Features
            </a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-blue-600 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {isAuthenticated ? (
              <Link
                href="/client/dashboard"
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/client/login"
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Sign In
                </Link>
                <button
                  type="button"
                  onClick={() => setShowClaimModal(true)}
                  className="px-3.5 sm:px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-12 pb-14 sm:pt-20 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        {/* Soft Ambient Radial Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.10),rgba(255,255,255,0))] pointer-events-none" />

        <div className="space-y-6 relative z-10">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>BOOKING LINKS &amp; LIVE DISPATCH FOR FIELD CREWS</span>
          </div>

          {/* Headline (H1) */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12] max-w-4xl mx-auto">
            Turn Google Maps Visitors Into Booked Jobs—With Uber-Style Live Arrival Tracking.
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Every day without a booking link, local customers click the next crew on Google. Launch your custom booking page, live GPS arrival texts, driveway Apple Pay invoicing, and auto Google reviews in 2 minutes. Run your first 3 jobs 100% free—no credit card or phone forwarding required.
          </p>

          {/* Single Primary CTA */}
          <div className="pt-2 flex flex-col items-center justify-center gap-2 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Get My Free Booking Link (First 3 Jobs Free)</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Live in 2 minutes &bull; First 3 completed jobs $0 &bull; No phone setup required
            </span>
          </div>
        </div>

        {/* ── Visual Proof: Live Workflow Preview (Dual Phone Simulator) ── */}
        <div id="preview" className="mt-12 sm:mt-16">
          <DualPhoneSimulator onOpenClaim={() => setShowClaimModal(true)} />
        </div>
      </section>

      {/* ── 3. Three Objection-Killing Bullets (Replacing the 4-Stat Grid) ── */}
      <section className="border-y border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          
          {/* Bullet 1 */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-extrabold text-sm flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Zero Phone Forwarding or Number Changes
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Keep your current phone setup untouched. Simply paste your custom <code className="bg-slate-200/80 px-1 py-0.5 rounded text-[11px] text-slate-800 font-mono">book.captodesk.com/[your-name]</code> link onto Google Maps, Instagram, or your website.
              </p>
            </div>
          </div>

          {/* Bullet 2 */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 font-extrabold text-sm flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Built for Trucks, Not Office Desks
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Add your top services in 2 minutes, update job status in 2 thumb taps, and text homeowners a live Uber-style arrival map with zero app downloads.
              </p>
            </div>
          </div>

          {/* Bullet 3 */}
          <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 font-extrabold text-sm flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                First 3 Completed Jobs 100% Free
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Test live arrival tracking, driveway Apple Pay checkout, and automatic Google review requests on real customers before paying a dime.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ── 4. How It Works Section (4 Core Features + Upgrade Banner) ── */}
      <section id="features" className="py-20 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            BUILT FOR SOLO OPERATORS &amp; SMALL CREWS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Four Ways CaptoDesk Wins &amp; Completes More Jobs
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            Everything you need to turn profile views into booked jobs, 5-star reviews, and instant payouts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: 24/7 Booking Link */}
          <div className="p-7 sm:p-8 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                24/7 Google &amp; Instagram Booking Link
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Let homeowners pick an open time slot directly from your Google Business Profile or social bio while you&apos;re out on a job—no phone tag required.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Included Free &bull; First 3 Jobs</span>
            </div>
          </div>

          {/* Card 2: Live Technician Arrival Map */}
          <div className="p-7 sm:p-8 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
                <Navigation className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Live Technician Arrival Map
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap &quot;On My Way&quot; to text the customer your photo, truck details, and a real-time GPS arrival map with an accurate ETA—stopping &quot;Where are you?&quot; calls.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Included Free &bull; First 3 Jobs</span>
            </div>
          </div>

          {/* Card 3: Driveway Apple Pay & Card Checkout */}
          <div className="p-7 sm:p-8 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Driveway Apple Pay &amp; Card Checkout
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap &quot;Complete Job&quot; to text an itemized digital invoice. Customers pay on site in seconds via Apple Pay, Google Pay, or card.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Included Free &bull; First 3 Jobs</span>
            </div>
          </div>

          {/* Card 4: Automated Google Review Booster */}
          <div className="p-7 sm:p-8 rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Automated Google Review Booster
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Minutes after payment clears, happy customers get a 1-tap Google review link while private concerns route directly to you first.
              </p>
            </div>
            <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Included Free &bull; First 3 Jobs</span>
            </div>
          </div>

        </div>

        {/* Paid Upgrade Callout Banner */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                Need 24/7 Missed-Call Text-Back too?
              </p>
              <p className="text-xs text-slate-600">
                Upgrade to Solo Pro ($99/mo) anytime to unlock a dedicated local business number that texts missed callers back in 8 seconds.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowClaimModal(true)}
            className="shrink-0 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
          >
            Explore Plans &rarr;
          </button>
        </div>
      </section>

      {/* ── 5. Comparison Section ── */}
      <section id="comparison" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            THE COMPARISON
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Why Contractors Choose CaptoDesk
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Compare CaptoDesk against traditional answering services and complex $400/mo enterprise platforms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* Column 1: Traditional Voicemail */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Option 1</span>
              <h3 className="text-lg font-bold text-slate-900">Voicemail &amp; Call Centers</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Answering services charge $300 to $800/mo just to take messages. By the time you call back, the customer already hired someone else.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Slow callbacks lose urgent Google Maps searchers
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Costly monthly fees for basic message-taking
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Customer has to explain problem twice
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Zero live tracking or on-site checkout
                </li>
              </ul>
            </div>
          </div>

          {/* Column 2: Bloated Legacy CRMs */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Option 2</span>
              <h3 className="text-lg font-bold text-slate-900">Heavy Field CRMs (ServiceTitan, Jobber)</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Designed for large corporate fleets with dedicated office dispatchers and full-time IT staff.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> $250 - $500/mo base subscription before add-ons
                </li>
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Steep 3-week learning curve for technicians
                </li>
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Forces customers to install separate mobile apps
                </li>
                <li className="flex items-start gap-2 text-amber-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> No instant booking link setup in 2 minutes
                </li>
              </ul>
            </div>
          </div>

          {/* Column 3: CaptoDesk (Elevated Winner) */}
          <div className="rounded-3xl border-2 border-blue-600 bg-gradient-to-b from-blue-50/50 via-white to-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xl relative">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[11px] font-extrabold uppercase tracking-wider shadow-sm">
              BUILT FOR TRUCKS, NOT DESKS
            </span>
            <div className="space-y-4 pt-1">
              <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">The Modern Standard</span>
              <h3 className="text-xl font-bold text-slate-900">CaptoDesk Platform</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Gives customers a 24/7 booking link, an Uber-like live arrival screen, and instant on-site checkout.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-800 pt-2 border-t border-blue-100">
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Custom booking link live on Google Maps &amp; IG in 2 minutes
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Live GPS arrival tracking texted with zero customer app downloads
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Driveway Apple Pay &amp; card checkout before you pull away
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Zero phone forwarding or number changes required to start
                </li>
                <li className="flex items-start gap-2 font-semibold text-slate-900">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> First 3 completed jobs 100% free with zero platform fees
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center shadow-md shadow-blue-600/20 transition-all block cursor-pointer"
            >
              Get My Free Booking Link &rarr;
            </button>
          </div>

        </div>
      </section>

      {/* ── 6. Transparent Pricing ── */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-widest block">
            TRANSPARENT PRICING
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Simple Pricing. Zero Contracts.
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Run your first 3 completed jobs 100% free. Upgrade anytime to unlock unlimited jobs plus a dedicated business line with 24/7 missed-call text-back.
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
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* Card 1: Free Tier */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs relative flex flex-col justify-between space-y-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  STARTER PASS
                </span>
                <span className="text-xs text-slate-500 font-mono">Solo Tradesman</span>
              </div>

              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900 font-mono">$0</span>
                  <span className="text-xs font-semibold text-slate-500">/ first 3 jobs</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Full dispatch, mobile invoicing, and booking links to test with zero commitment.</p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Dedicated booking link</strong> (book.captodesk.com/[your-name])</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited homeowner bookings</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Visual calendar &amp; job dispatch scheduling</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Live homeowner arrival tracking link</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Mobile invoicing &amp; on-site card checkout</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Automated 5-star Google review booster</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>First 3 completed jobs included with $0 platform fees</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <X className="w-4 h-4 shrink-0" />
                  <span>Dedicated carrier line &amp; 24/7 missed-call rescue (Solo Pro)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs text-center transition-all block cursor-pointer"
            >
              Get My Free Booking Link &rarr;
            </button>
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
                  <span>Carrier Registration Included (Never Marked Spam)</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center shadow-md shadow-blue-600/25 transition-all block cursor-pointer"
            >
              Get Started with Solo Pro
            </button>
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
                  <span>Dedicated Technician Field Mode</span>
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

      {/* ── 7. Contractor FAQ ── */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <FaqSection />
      </section>

      {/* ── 8. Final Urgent CTA Banner ── */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="rounded-3xl border border-slate-200/90 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white p-8 sm:p-14 text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold">
            <CalendarCheck className="w-4 h-4" />
            <span>START FREE IN 2 MINUTES</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto leading-tight">
            Put Your Booking Link on Google Maps Before Tonight&apos;s Searches Go to Another Crew.
          </h2>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Launch your booking page, live arrival tracker, and automated Google review booster in 2 minutes. Your first 3 completed jobs are 100% free—no credit card or call forwarding required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Get My Free Booking Link (First 3 Jobs Free)</span>
              <ArrowRight className="w-4 h-4 text-emerald-300" />
            </button>
          </div>
        </div>
      </section>

      {/* ── 9. Footer ── */}
      <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <BrandIcon className="w-6 h-6 rounded-md shadow-2xs" size={24} />
            <BrandWordmark size="text-sm" />
            <span className="text-slate-300">&bull;</span>
            <span>Online Booking &amp; Live Arrival Dispatch for Field Crews</span>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link href="/client/login" className="hover:text-slate-900 transition-colors">
              Contractor Login
            </Link>
            <a href="#preview" className="hover:text-slate-900 transition-colors">
              Live Preview
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

        <div className="max-w-7xl mx-auto mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <p>&copy; {new Date().getFullYear()} CaptoDesk. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Live arrival tracking</span>
            <span>&bull;</span>
            <span>Instant mobile checkout</span>
          </div>
        </div>
      </footer>

      {/* ── 10. Claim Booking Link Modal ── */}
      <ClaimBookingModal
        open={showClaimModal}
        onClose={() => setShowClaimModal(false)}
      />

    </div>
  )
}
