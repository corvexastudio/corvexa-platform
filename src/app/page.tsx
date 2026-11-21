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
  Smartphone,
  Flame,
  Car,
  Home,
  ChevronDown
} from 'lucide-react'
import { TradeDemoShowcase } from '@/components/landing/trade-demo-showcase'
import { RevenueCalculator } from '@/components/landing/revenue-calculator'
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
      
      {/* ── 0. Top Notice Banner (Subtle & High-Trust) ── */}
      <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold text-white">First 3 Completed Jobs 100% Free</span>
            <span className="text-slate-500 hidden md:inline">•</span>
            <span className="text-slate-300 hidden md:inline">No credit card required</span>
            <span className="text-slate-500 hidden md:inline">•</span>
            <span className="text-slate-300 hidden md:inline">Keep your existing phone number</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Web Agencies:</span>
            <a
              href="https://agency.captodesk.com/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 font-bold underline decoration-blue-500/50 flex items-center gap-1 transition-colors"
            >
              <span>Offer Turnkey Booking to Your Clients</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* ── 1. Navigation Bar ── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <BrandIcon className="w-8 h-8 group-hover:scale-105 transition-transform" priority />
            <BrandWordmark size="text-lg" />
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <a href="#demos" className="hover:text-blue-600 transition-colors">
              Trade Demos
            </a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">
              How It Works
            </a>
            <a href="#calculator" className="hover:text-blue-600 transition-colors">
              Revenue Calculator
            </a>
            <a href="#comparison" className="hover:text-blue-600 transition-colors">
              Comparison
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
            <a
              href="https://agency.captodesk.com/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              <span>Agency Wholesale</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

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
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Start Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* Mobile Menu Trigger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-4 space-y-3">
            <nav className="flex flex-col space-y-2 text-sm font-semibold text-slate-700">
              <a
                href="#demos"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Trade Demos
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#calculator"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Revenue Calculator
              </a>
              <a
                href="#comparison"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Comparison
              </a>
              <a
                href="#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Pricing
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                FAQ
              </a>
              <a
                href="https://agency.captodesk.com/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center justify-between"
              >
                <span>Agency Wholesale Console</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </nav>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  setShowClaimModal(true)
                }}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs text-center shadow-sm"
              >
                Claim Free Booking Link (3 Jobs $0)
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section ── */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
        {/* Soft Ambient Radial Light */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.12),rgba(255,255,255,0))] pointer-events-none" />

        <div className="space-y-6 relative z-10 max-w-4xl mx-auto">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200/80 shadow-2xs">
            <div className="flex items-center gap-0.5 text-amber-500">
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <Star className="w-3.5 h-3.5 fill-amber-500" />
              <Star className="w-3.5 h-3.5 fill-amber-500" />
            </div>
            <span className="font-bold text-slate-800">4.9/5 RATED BY 850+ TRADE CREWS</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-medium">NO CREDIT CARD REQUIRED</span>
          </div>

          {/* Headline (H1) */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
            Stop Losing Jobs to Voicemail.{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 block sm:inline">
              Turn Searchers Into Booked Jobs in 45 Seconds.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Give homeowners a dedicated 24/7 mobile booking link for Google Maps &amp; Instagram, 5-second missed-call SMS auto-recovery, live Uber-style arrival tracking, and driveway Apple Pay. Run your first 3 completed jobs 100% free with zero phone setup.
          </p>

          {/* Primary Two-Button Action Zone */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-lg mx-auto">
            <button
              type="button"
              onClick={() => setShowClaimModal(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>Claim Free Booking Link (3 Jobs $0)</span>
              <ArrowRight className="w-4 h-4 text-white" />
            </button>
            <a
              href="#demos"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm sm:text-base border border-slate-300 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Explore Live Trade Demos</span>
              <ChevronDown className="w-4 h-4 text-slate-500" />
            </a>
          </div>

          {/* Trust strip */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 2-Minute Setup
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Keep Your Phone Number
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero App Downloads for Homeowners
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> First 3 Jobs Free
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Interactive Trade Demo Showcase (The Core Conversion Engine) ── */}
      <section id="demos" className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
        <TradeDemoShowcase onOpenClaim={() => setShowClaimModal(true)} />
      </section>

      {/* ── 4. Social Proof Banner with Real Contractors ── */}
      <section className="border-y border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-1">
            <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
              TRUSTED IN THE FIELD
            </span>
            <h3 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Real Operators. Real Recovered Revenue.
            </h3>
          </div>

          {/* 3 Authentic Contractor Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                &ldquo;We added the link to our Google Business Profile on a Friday. Woke up Saturday morning to 3 booked jobs without answering a single phone call. Homeowners love picking their exact time.&rdquo;
              </p>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Marcus T.</p>
                  <p className="text-[11px] text-slate-500">ProFlow Plumbing &bull; Dallas, TX</p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  +$4,850 MTD
                </span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                &ldquo;Customers go crazy over the live arrival map. They stop calling to ask where we are, and they pay with Apple Pay right on the driveway before we pull away. Zero awkward invoicing.&rdquo;
              </p>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Brian K.</p>
                  <p className="text-[11px] text-slate-500">Apex Mobile Detailing &bull; Austin, TX</p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  +$3,420 MTD
                </span>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                &ldquo;The 5-second text-back is a game changer. When I am in an attic or panel and miss a call, it texts the homeowner immediately so they do not click the next electrician on Google.&rdquo;
              </p>
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">Dave R.</p>
                  <p className="text-[11px] text-slate-500">VoltLine Electric &bull; Fort Worth, TX</p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                  +$5,100 MTD
                </span>
              </div>
            </div>
          </div>

          {/* Photo Banner */}
          <div className="rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs">
            <img
              src="/contractors-social-proof.jpg"
              alt="Real local trade contractors using CaptoDesk in the field"
              className="w-full h-auto object-cover max-h-96"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ── 5. Bento Grid: The 5-Point Field Operations System ── */}
      <section id="how-it-works" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            THE 5-POINT FIELD OPERATIONS SYSTEM
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
            Built for Work Trucks, Not Office Desks
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
            Everything your crew needs to win urgent local searches, dispatch fast, get paid on site, and collect 5-star reviews automatically.
          </p>
        </div>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Bento Card 1: 24/7 Google Maps & Instagram Booking Link (8 Cols) */}
          <div className="md:col-span-8 p-7 sm:p-8 rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                POINT 1 &bull; 24/7 BOOKING LINK
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Turn Google Maps &amp; Instagram Profile Views Into Locked Appointments
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xl">
                Paste your custom <code className="bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded font-mono text-xs">book.captodesk.com/[your-trade]</code> link once into your Google Business Profile and Instagram bio. Homeowners choose their service, see transparent pricing, and pick an open arrival slot directly into your dispatch calendar.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Zero phone tag &bull; Homeowners book in 45 seconds</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold font-mono text-[11px]">
                INCLUDED FREE &bull; 3 JOBS $0
              </span>
            </div>
          </div>

          {/* Bento Card 2: 5-Second Missed-Call SMS Auto-Recovery (4 Cols) */}
          <div className="md:col-span-4 p-7 sm:p-8 rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 flex items-center justify-center">
                <PhoneCall className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 uppercase tracking-wider block">
                POINT 2 &bull; 5-SEC SMS RECOVERY
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Rescue Missed Calls While Working
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                When you are on a ladder or driving, missed callers receive an automated 2-way text in 5 seconds with your direct booking link before they dial the next crew.
              </p>
            </div>

            {/* Visual SMS Mockup */}
            <div className="p-3 rounded-2xl bg-slate-900 text-white space-y-2 text-xs shadow-inner">
              <div className="bg-slate-800 p-2.5 rounded-xl rounded-bl-xs text-slate-200">
                <p className="text-[11px] font-medium leading-relaxed">
                  &ldquo;Hey! This is Marcus with ProFlow. On a job right now. How can I help you?&rdquo;
                </p>
                <span className="text-[9px] text-slate-400 block mt-1 font-mono">Delivered in 4.8s</span>
              </div>
            </div>
          </div>

          {/* Bento Card 3: Live Uber-Style GPS Arrival Tracking (4 Cols) */}
          <div className="md:col-span-4 p-7 sm:p-8 rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center">
                <Navigation className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                POINT 3 &bull; LIVE GPS DISPATCH
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Uber-Style Live Arrival Tracking
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap &ldquo;On My Way&rdquo; from your truck. The homeowner instantly receives a text with your photo, truck details, and a real-time moving arrival map with live ETA.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200/80 text-xs text-blue-900 font-medium flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Stops &ldquo;Where are you?&rdquo; phone calls completely</span>
            </div>
          </div>

          {/* Bento Card 4: Driveway Apple Pay & Card Invoicing (4 Cols) */}
          <div className="md:col-span-4 p-7 sm:p-8 rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider block">
                POINT 4 &bull; DRIVEWAY CHECKOUT
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Driveway Apple Pay &amp; Card Payments
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tap &ldquo;Complete Job&rdquo; on site. An itemized invoice immediately updates on the customer&apos;s phone. They pay in 10 seconds via Apple Pay, Google Pay, or card right from their driveway.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-900 font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Get paid before you pack your tools and leave</span>
            </div>
          </div>

          {/* Bento Card 5: Automated 5-Star Google Reviews (4 Cols) */}
          <div className="md:col-span-4 p-7 sm:p-8 rounded-3xl border border-slate-200/90 bg-white shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <span className="text-xs font-mono font-bold text-amber-600 uppercase tracking-wider block">
                POINT 5 &bull; REPUTATION SHIELD
              </span>
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Automated 5-Star Google Reviews
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Minutes after payment clears, happy homeowners receive a 1-tap Google review link. Private feedback routes directly to you first to safeguard your local rating.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-xs text-amber-900 font-medium flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <span>Ranks your Google Business Profile higher locally</span>
            </div>
          </div>

        </div>

        {/* Link Placement Showcase */}
        <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 space-y-6 shadow-xs">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
              WHERE YOUR LINK LIVES
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Paste Your Link Once. Book Jobs Around the Clock.
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Contractors paste their link on their Google Business Profile, Instagram bio, and website. Homeowners click and schedule without leaving Google.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 overflow-hidden shadow-sm">
            <img
              src="/booking-placement-guide.jpg"
              alt="How CaptoDesk booking links appear on Google Business Profile and Instagram Bio"
              className="w-full h-auto object-cover"
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ── 6. Embedded Interactive Revenue Calculator ── */}
      <section id="calculator" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto scroll-mt-20">
        <RevenueCalculator onOpenClaim={() => setShowClaimModal(true)} />
      </section>

      {/* ── 7. Objection-Killing Comparison Matrix ── */}
      <section id="comparison" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-12 scroll-mt-20">
        <div className="text-center max-w-3xl mx-auto space-y-2">
          <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
            HOW WE COMPARE
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
            Why Contractors Choose CaptoDesk
          </h2>
          <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto">
            Compare CaptoDesk against outdated voicemail call centers and bloated $400/month enterprise software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          
          {/* Column 1: Traditional Voicemail & Answering Services */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Option 1</span>
              <h3 className="text-lg font-bold text-slate-900">Voicemail &amp; Call Centers</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Answering services charge $350 to $800/mo just to take notes. By the time you call back, the customer already hired the next crew on Google.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Slow callbacks lose urgent Google Maps searchers
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> High monthly retainers for basic message taking
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Customer must repeat their problem twice
                </li>
                <li className="flex items-start gap-2 text-rose-600">
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Zero live tracking or driveway Apple Pay
                </li>
              </ul>
            </div>
          </div>

          {/* Column 2: Bloated Enterprise CRMs */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-7 flex flex-col justify-between space-y-6 shadow-xs">
            <div className="space-y-4">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider block">Option 2</span>
              <h3 className="text-lg font-bold text-slate-900">Heavy Enterprise CRMs</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Built for 50-truck corporate fleets with dedicated dispatchers and full-time IT coordinators. Overwhelming for field crews.
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
                  <X className="w-4 h-4 shrink-0 mt-0.5" /> Complex setup with zero instant booking link in 2 min
                </li>
              </ul>
            </div>
          </div>

          {/* Column 3: CaptoDesk (The Clear Winner) */}
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
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> Keep your existing phone number with zero carrier changes
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

      {/* ── 8. Transparent Pricing ── */}
      <section id="pricing" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-10 scroll-mt-20">
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
                  <span><strong>Dedicated booking link</strong> (book.captodesk.com/[your-trade])</span>
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

          {/* Card 2: CaptoDesk Solo Pro (Most Popular) */}
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
                  <span><strong>5-Second 2-Way Text-Back</strong> on missed calls</span>
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

        {/* ── Agency Wholesale Spotlight ── */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900 text-white p-6 sm:p-10 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              <span>FOR WEB &amp; SEO AGENCIES</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
              Manage Multiple Contractor Clients Under One Console
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Equip your local contractor clients with turnkey Google Maps booking links, live arrival dispatch, and missed-call recovery at wholesale rates ($49/mo per slot).
            </p>
          </div>

          <a
            href="https://agency.captodesk.com/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-full md:w-auto px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Explore Agency Wholesale Console</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* ── 9. Contractor FAQ ── */}
      <section id="faq" className="py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto scroll-mt-20">
        <FaqSection />
      </section>

      {/* ── 10. Final Urgent CTA Banner ── */}
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
            Launch your booking page, live arrival tracker, and automated Google review booster in 2 minutes. Your first 3 completed jobs are 100% free with no credit card or call forwarding required.
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
            <a
              href="#demos"
              className="w-full sm:w-auto px-6 py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm sm:text-base border border-slate-700 shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>View Trade Demos</span>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </a>
          </div>
        </div>
      </section>

      {/* ── 11. Footer ── */}
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
            <a href="#demos" className="hover:text-slate-900 transition-colors">
              Trade Demos
            </a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
              How It Works
            </a>
            <a href="#calculator" className="hover:text-slate-900 transition-colors">
              Calculator
            </a>
            <a href="#pricing" className="hover:text-slate-900 transition-colors">
              Pricing
            </a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">
              FAQ
            </a>
            <a
              href="https://agency.captodesk.com/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 font-bold"
            >
              Agency Wholesale &rarr;
            </a>
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
            <span>Instant driveway checkout</span>
            <span>&bull;</span>
            <span>24/7 SMS lead rescue</span>
          </div>
        </div>
      </footer>

      {/* ── 12. Claim Booking Link Modal ── */}
      <ClaimBookingModal
        open={showClaimModal}
        onClose={() => setShowClaimModal(false)}
      />

    </div>
  )
}
