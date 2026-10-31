'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  PhoneMissed,
  MessageSquare,
  Navigation,
  CheckCircle2,
  Star,
  Play,
  Pause,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Phone,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react'

export type DemoStage = 1 | 2 | 3 | 4

export function DualPhoneSimulator() {
  const [activeStage, setActiveStage] = useState<DemoStage>(1)
  const [isPlaying, setIsPlaying] = useState<boolean>(true)
  const [simulatedRating, setSimulatedRating] = useState<number>(5)

  // Auto-play timer: progresses stage every 6 seconds when playing
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev === 4 ? 1 : ((prev + 1) as DemoStage)))
    }, 6000)
    return () => clearInterval(timer)
  }, [isPlaying])

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-8 shadow-[0_25px_60px_-15px_rgba(15,23,42,0.08)] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header controls & step picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              LIVE INTERACTIVE SIMULATOR
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">15-SECOND TEST DRIVE</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2 tracking-tight">
            Watch a $650 Job Get Saved, Tracked, and Paid
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Compare what you see in your truck vs what the homeowner sees on their phone in real time.
          </p>
        </div>

        {/* Auto-Play Toggle */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
            isPlaying
              ? 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-slate-500" />
              <span>Pause Auto-Play</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
              <span>Resume Auto-Play</span>
            </>
          )}
        </button>
      </div>

      {/* 4 Step Selector Buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 py-6">
        {[
          {
            stage: 1 as DemoStage,
            number: '01',
            title: '8s Missed Call Catch',
            desc: 'Auto-text fires before they call a competitor',
            icon: PhoneMissed,
            color: 'text-rose-500'
          },
          {
            stage: 2 as DemoStage,
            number: '02',
            title: 'Live Arrival Tracker',
            desc: 'Live GPS arrival tracker texted to customer',
            icon: Navigation,
            color: 'text-blue-500'
          },
          {
            stage: 3 as DemoStage,
            number: '03',
            title: '0.5% Mobile Payment',
            desc: 'Homeowner taps Apple Pay on the spot',
            icon: CreditCard,
            color: 'text-emerald-500'
          },
          {
            stage: 4 as DemoStage,
            number: '04',
            title: '5-Star Review Booster',
            desc: 'Directs positive feedback straight to Google',
            icon: Star,
            color: 'text-amber-500'
          }
        ].map((step) => {
          const Icon = step.icon
          const isActive = activeStage === step.stage
          return (
            <button
              key={step.stage}
              type="button"
              onClick={() => {
                setActiveStage(step.stage)
                setIsPlaying(false)
              }}
              className={`p-3.5 sm:p-4 rounded-2xl text-left border transition-all relative cursor-pointer ${
                isActive
                  ? 'bg-slate-900 border-slate-900 text-white shadow-md shadow-slate-900/10'
                  : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-800'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 rounded-t-2xl" />
              )}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-mono font-bold ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                  {step.number}
                </span>
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : step.color}`} />
              </div>
              <p className={`text-xs sm:text-sm font-bold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                {step.title}
              </p>
              <p className={`text-[11px] line-clamp-1 mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                {step.desc}
              </p>
            </button>
          )
        })}
      </div>

      {/* The Dual Phone Mockups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 pb-4">
        {/* Phone 1: Contractor's View (Your Truck) */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between px-3.5 py-2 mb-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Contractor Dashboard (Your Truck)
            </span>
            <span className="text-[10px] text-slate-500 font-mono font-semibold">1-TAP ACTION</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[340px] rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-950 p-3 shadow-2xl relative overflow-hidden">
            {/* Dynamic Island */}
            <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-3 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
            </div>

            {/* Contractor Screen Content by Stage */}
            <div className="min-h-[400px] flex flex-col justify-between text-xs">
              {activeStage === 1 && (
                <div className="space-y-3">
                  <div className="bg-rose-950/50 border border-rose-500/40 rounded-xl p-3 text-rose-200">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-rose-400 mb-1">
                      <span className="flex items-center gap-1">
                        <PhoneMissed className="w-3.5 h-3.5" />
                        Missed Call Detected
                      </span>
                      <span className="font-mono">2:14 PM</span>
                    </div>
                    <p className="font-bold text-white text-sm">Sarah Jenkins</p>
                    <p className="text-[11px] text-rose-300">(555) 839-2041 • Google Local Ad</p>
                  </div>

                  <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Auto-Text Dispatched
                      </span>
                      <span className="font-mono text-slate-400">in 6.2s</span>
                    </div>
                    <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                      &quot;Hey Sarah, Mike here with Apex Plumbing. Missed your call while finishing a job—how can we help you today?&quot;
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-slate-400 block mb-1 uppercase font-mono">Customer Responded (30s later)</span>
                    <p className="text-slate-200 text-xs italic">&quot;Water heater is leaking into my basement! Can you come today?&quot;</p>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5"
                  >
                    <span>✓ Book Diagnostic Visit for 3:30 PM</span>
                  </button>
                </div>
              )}

              {activeStage === 2 && (
                <div className="space-y-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Active Job • #JOB-2026-084</span>
                    <h4 className="font-bold text-white text-sm">Sarah Jenkins</h4>
                    <p className="text-slate-400 text-[11px]">742 Evergreen Terrace • Water Heater</p>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-blue-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                      <span className="flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5 animate-bounce" />
                        En Route Status Active
                      </span>
                      <span className="font-mono">ETA 14m</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Homeowner has been texted their live tracking link. They see your ETA and truck info.
                    </p>
                  </div>

                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
                    <span className="text-[10px] text-slate-400 font-mono uppercase block">Technician Controls</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-[11px] flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-blue-400" />
                        Call Sarah
                      </button>
                      <button
                        type="button"
                        className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-medium text-[11px] flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                        Text Sarah
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <span>Tap When Arrived: &quot;Start Work&quot;</span>
                  </button>
                </div>
              )}

              {activeStage === 3 && (
                <div className="space-y-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Invoice Generation</span>
                    <h4 className="font-bold text-white text-sm">Sarah Jenkins • #INV-2026-084</h4>
                    <p className="text-slate-400 text-[11px]">Water Heater Relief Valve &amp; Flush</p>
                  </div>

                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                      <span>Total Due</span>
                      <span className="font-mono text-base font-bold text-white">$385.00</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>CaptoDesk Platform Fee (0.5%):</span>
                      <span className="font-mono text-slate-300">-$1.93</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                      <span>Depositing to your bank:</span>
                      <span className="font-mono text-emerald-400">$383.07</span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center space-y-1">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Paid via Apple Pay (Just now)
                    </span>
                    <p className="text-[10px] text-slate-400">Funds rolling to your linked bank account via Stripe Connect.</p>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <span>✓ Job Complete &amp; Receipt Sent</span>
                  </button>
                </div>
              )}

              {activeStage === 4 && (
                <div className="space-y-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <span className="text-[10px] font-mono text-slate-400 uppercase block mb-1">Review Booster Feed</span>
                    <h4 className="font-bold text-white text-sm">Automated Review Request</h4>
                    <p className="text-slate-400 text-[11px]">SMS sent 5 minutes after payment</p>
                  </div>

                  <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Reputation Shield Active
                      </span>
                      <span className="font-mono text-[11px]">Google Maps</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      4 &amp; 5-star ratings route straight to your Google Maps listing. 1 to 3-star ratings are intercepted privately so you can fix issues first.
                    </p>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Your Google Rating:</span>
                      <span className="font-bold text-amber-400 flex items-center gap-0.5">
                        ★ 4.9 <span className="text-slate-500 font-normal">(184 reviews)</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <span>View All Reviews in Dashboard</span>
                  </button>
                </div>
              )}

              {/* Bottom Phone Bar */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                <span>CaptoDesk Contractor App</span>
                <span className="font-mono text-emerald-400">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phone 2: Homeowner's View (Your Customer) */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between px-3.5 py-2 mb-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs">
            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Homeowner&apos;s Mobile Screen (Sarah)
            </span>
            <span className="text-[10px] text-emerald-700 font-mono font-bold">ZERO APP INSTALL</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[340px] rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-950 p-3 shadow-2xl relative overflow-hidden">
            {/* Dynamic Island */}
            <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-3 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800" />
            </div>

            {/* Homeowner Screen Content by Stage */}
            <div className="min-h-[400px] flex flex-col justify-between text-xs">
              {activeStage === 1 && (
                <div className="space-y-3">
                  <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 font-mono flex items-center justify-between">
                    <span>Messages • Apex Plumbing</span>
                    <span className="text-emerald-400">Now</span>
                  </div>

                  <div className="space-y-2">
                    {/* Incoming SMS from Contractor */}
                    <div className="max-w-[85%] bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow-sm">
                      <p className="font-semibold text-emerald-400 text-[11px] mb-0.5">Mike from Apex Plumbing</p>
                      Hey Sarah! I missed your call because I was finishing up a job. What&apos;s going on with your plumbing?
                    </div>

                    {/* Customer Reply */}
                    <div className="max-w-[85%] ml-auto bg-blue-600 text-white p-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-sm">
                      Water heater is leaking into my basement! Can you come today?
                    </div>

                    {/* Instant Confirmation Link */}
                    <div className="max-w-[85%] bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow-sm">
                      Got it! I have you down for 3:30 PM today. You can track my truck live here:
                      <span className="block mt-1 font-mono text-[11px] text-cyan-400 underline">
                        captodesk.com/t/apex-7821
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900/60 rounded-xl text-center text-[10px] text-slate-400">
                    Sarah stopped searching Google. Job locked in under 60 seconds.
                  </div>
                </div>
              )}

              {activeStage === 2 && (
                <div className="space-y-2.5">
                  {/* Live Tracker Page /t/token */}
                  <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                        AP
                      </div>
                      <span className="font-bold text-white text-xs">Apex Plumbing</span>
                    </div>
                    <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                      LIVE PULSE
                    </span>
                  </div>

                  {/* 4-Stage Stepper Widget */}
                  <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                      <span>Status:</span>
                      <span className="text-amber-400 font-semibold">Mike is On The Way</span>
                    </div>
                    {/* Stepper Dots */}
                    <div className="grid grid-cols-4 gap-1">
                      <div className="h-1.5 rounded-full bg-emerald-500" />
                      <div className="h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <div className="h-1.5 rounded-full bg-slate-800" />
                      <div className="h-1.5 rounded-full bg-slate-800" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                      <span>Booked</span>
                      <span className="text-amber-400 font-bold">En Route</span>
                      <span>Working</span>
                      <span>Done</span>
                    </div>
                  </div>

                  {/* Technician Card */}
                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                        👨‍🔧
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">Mike R.</p>
                        <p className="text-[10px] text-slate-400">ETA: ~14 Minutes</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="p-1.5 bg-slate-800 rounded-lg text-emerald-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <div className="p-1.5 bg-slate-800 rounded-lg text-blue-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  <div className="text-center p-2 bg-slate-900/40 rounded text-[10px] text-slate-400">
                    Sarah never called the office asking &quot;Where are you?&quot;
                  </div>
                </div>
              )}

              {activeStage === 3 && (
                <div className="space-y-2.5">
                  {/* Job Completed & Invoice Card */}
                  <div className="bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Service Completed
                    </span>
                    <p className="text-slate-300 text-xs font-medium">Water Heater Relief Valve Replaced</p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Amount Due:</span>
                      <span className="text-base font-bold font-mono text-white">$385.00</span>
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                      <div className="flex justify-between">
                        <span>Diagnostic &amp; Parts:</span>
                        <span className="font-mono text-slate-300">$385.00</span>
                      </div>
                      <div className="flex justify-between text-slate-500 text-[10px]">
                        <span>Secure Checkout via Stripe:</span>
                        <span>0.5% standard fee</span>
                      </div>
                    </div>

                    {/* Apple Pay Button */}
                    <button
                      type="button"
                      className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-950 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                    >
                      <span>Pay $385.00 with</span>
                      <span className="font-extrabold text-sm tracking-tighter">Pay</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">
                    Customer paid before contractor backed out of the driveway.
                  </p>
                </div>
              )}

              {activeStage === 4 && (
                <div className="space-y-2.5">
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                      <Star className="w-4 h-4 fill-amber-400" />
                    </div>
                    <h4 className="font-bold text-white text-xs">How was your service with Mike?</h4>
                    <p className="text-[11px] text-slate-400">Tap a star to rate Apex Plumbing</p>

                    {/* Star Rating Interactive Selector */}
                    <div className="flex justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSimulatedRating(star)}
                          className="focus:outline-hidden transition-transform hover:scale-125 cursor-pointer"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= simulatedRating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-700'
                            }`}
                          />
                        </button>
                      ))}
                    </div>

                    {/* Smart Routing Preview */}
                    {simulatedRating >= 4 ? (
                      <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-300 text-left space-y-1">
                        <div className="font-bold flex items-center gap-1 text-emerald-400">
                          <ExternalLink className="w-3 h-3" />
                          Routes to Google Maps
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          4–5 stars automatically routes Sarah to your Google listing to boost your local SEO.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 text-left space-y-1">
                        <div className="font-bold flex items-center gap-1 text-rose-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Intercepted Privately
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          1–3 stars sends private feedback to your dashboard so you can fix it before it hurts your rating!
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">
                    Try tapping 2 stars vs 5 stars above to test the reputation shield.
                  </p>
                </div>
              )}

              {/* Bottom Phone Bar */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
                <span>Safari Mobile Web</span>
                <span className="font-mono text-slate-400">Secure SSL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Walkthrough Summary Banner */}
      <div className="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            ✓
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block">Total Time Required from Contractor: 2 Thumb Taps</span>
            <span className="text-slate-500">
              No typing on a laptop, no clunky software, no lost leads, and no chasing unpaid invoices.
            </span>
          </div>
        </div>

        <Link
          href="/client/login?mode=signup"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs whitespace-nowrap shadow-sm transition-all"
        >
          <span>Get Started Today</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  )
}
