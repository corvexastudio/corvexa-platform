'use client'

import React from 'react'
import Image from 'next/image'
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Star,
  Truck,
  User,
  Phone,
  CreditCard,
  ChevronRight,
  Navigation,
  Check
} from 'lucide-react'

interface HeroSectionProps {
  onOpenClaim: () => void
}

export function HeroSection({ onOpenClaim }: HeroSectionProps) {
  return (
    <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Background Subtle Ambient Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(37,99,235,0.08),rgba(255,255,255,0))] pointer-events-none" />

      {/* Main Copy Block */}
      <div className="text-center max-w-4xl mx-auto space-y-6 relative z-10">
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="font-bold tracking-wide uppercase">
            Online Booking and Live Arrival Tracking for Local Crews
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
          Turn Google Searches Into{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500">
            Booked Service Calls.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Give customers a simple way to book your services from Google and Instagram. Keep them informed about their appointment and let them know when your technician is on the way.
        </p>

        {/* CTAs */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
          <button
            type="button"
            onClick={onOpenClaim}
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer"
          >
            <span>Get Your Free Booking Link</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </button>
          <a
            href="#how-it-works"
            className="w-full sm:w-auto px-6 py-4 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm sm:text-base border border-slate-300 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>See How It Works</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </a>
        </div>

        {/* Trust Badges */}
        <div className="pt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 2-Minute Setup
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Keep Your Existing Phone Number
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> No App Downloads for Customers
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> First 3 Completed Jobs Free
          </span>
        </div>
      </div>

      {/* Hero Visual: Realistic Dual-Interface Demonstration */}
      <div className="mt-12 sm:mt-16 max-w-5xl mx-auto">
        <div className="rounded-3xl border border-slate-200/90 bg-slate-900 text-white p-4 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Backlight */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar with Status indicator */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                Live Field Workflow Demonstration
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span>Customer Booking</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span>Contractor Dispatch</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-emerald-400 font-bold">Arrival Tracking</span>
            </div>
          </div>

          {/* Dual Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
            
            {/* Left Panel: Customer Mobile Booking View (5 Cols) */}
            <div className="lg:col-span-5 bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block">
                    Customer Mobile View
                  </span>
                  <p className="text-xs font-bold text-slate-900">book.captodesk.com/proflow</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Instant Schedule
                </span>
              </div>

              {/* Service Details */}
              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold text-blue-950">Emergency Main Drain Clearing</p>
                  <span className="text-xs font-mono font-extrabold text-blue-900">$195</span>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>90 minute service window</span>
                </p>
              </div>

              {/* Selected Window */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                  Requested Arrival Window
                </span>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Today: 2:00 PM to 4:00 PM</span>
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>742 Evergreen Terrace, Dallas TX</span>
                </p>
              </div>

              {/* Action Button */}
              <div className="pt-1">
                <div className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Booking Confirmed</span>
                </div>
                <p className="text-[10px] text-slate-400 text-center mt-1.5">
                  Confirmation SMS and live tracker texted to customer
                </p>
              </div>
            </div>

            {/* Right Panel: Contractor Dispatch Board View (7 Cols) */}
            <div className="lg:col-span-7 bg-slate-950 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                    Contractor Dispatch Console
                  </span>
                  <p className="text-xs font-bold text-white">ProFlow Plumbing &bull; Today&apos;s Schedule</p>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Job #1042
                </span>
              </div>

              {/* Job Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-white">Marcus T. (Technician Assigned)</p>
                    <p className="text-[11px] text-slate-400">Customer: Sarah Jenkins &bull; (214) 555-0192</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    En Route
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4 text-emerald-400" />
                    <span className="text-slate-300">Live GPS Tracker:</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">ETA 14 Minutes</span>
                </div>
              </div>

              {/* Action Buttons available on phone in truck */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/50">
                  <span className="text-[10px] font-mono text-blue-400 uppercase block font-bold">1. Tap When Leaving</span>
                  <p className="font-bold text-white mt-0.5">&quot;On My Way&quot;</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Texts live tracking link</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase block font-bold">2. Tap When Finished</span>
                  <p className="font-bold text-white mt-0.5">&quot;Complete Job&quot;</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Texts invoice &amp; Apple Pay</p>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80">
                <span>Customer payment method: Apple Pay / Card</span>
                <span className="text-emerald-400 font-mono font-semibold">Automatic 5-Star Review Request Ready</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
