'use client'

import React, { useState, useEffect } from 'react'
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
    <div className="w-full max-w-6xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 sm:p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header controls & step picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              LIVE INTERACTIVE SIMULATOR
            </span>
            <span className="text-xs text-zinc-500 font-mono hidden sm:inline">15-SECOND TEST DRIVE</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white mt-1.5 tracking-tight">
            Watch a $650 Job Get Saved, Tracked, and Paid
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Compare what you see in your truck vs what the homeowner sees on their phone in real time.
          </p>
        </div>

        {/* Auto-Play Toggle */}
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isPlaying
              ? 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:text-white'
              : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30'
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-zinc-400" />
              <span>Pause Auto-Play</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
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
            color: 'text-rose-400',
            border: 'border-rose-500/30'
          },
          {
            stage: 2 as DemoStage,
            number: '02',
            title: '1-Tap Live Tracker',
            desc: "Domino's-style ETA sent to customer via SMS",
            icon: Navigation,
            color: 'text-amber-400',
            border: 'border-amber-500/30'
          },
          {
            stage: 3 as DemoStage,
            number: '03',
            title: '0.5% Mobile Payment',
            desc: 'Homeowner taps Apple Pay on the spot',
            icon: CreditCard,
            color: 'text-emerald-400',
            border: 'border-emerald-500/30'
          },
          {
            stage: 4 as DemoStage,
            number: '04',
            title: '5-Star Review Booster',
            desc: 'Directs positive feedback straight to Google',
            icon: Star,
            color: 'text-cyan-400',
            border: 'border-cyan-500/30'
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
                setIsPlaying(false) // Pause auto-play if user manually clicks
              }}
              className={`p-3 sm:p-4 rounded-xl text-left border transition-all relative ${
                isActive
                  ? 'bg-zinc-900 border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-t-xl" />
              )}
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold text-zinc-500">{step.number}</span>
                <Icon className={`w-4 h-4 ${step.color}`} />
              </div>
              <p className={`text-xs sm:text-sm font-bold ${isActive ? 'text-white' : 'text-zinc-300'}`}>
                {step.title}
              </p>
              <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{step.desc}</p>
            </button>
          )
        })}
      </div>

      {/* The Dual Phone Mockups */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 pb-4">
        {/* Phone 1: Contractor's View (Your Truck) */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 bg-zinc-900/80 rounded-lg border border-zinc-800 text-xs">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400" />
              Contractor Dashboard (Your Truck)
            </span>
            <span className="text-[11px] text-zinc-500 font-mono">1-TAP CONTROLS</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[340px] rounded-[2.2rem] border-4 border-zinc-800 bg-zinc-950 p-3 shadow-2xl relative overflow-hidden">
            {/* Phone Speaker Notch */}
            <div className="w-24 h-4 bg-zinc-900 rounded-full mx-auto mb-3 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-zinc-800" />
            </div>

            {/* Contractor Screen Content by Stage */}
            <div className="min-h-[390px] flex flex-col justify-between text-xs">
              {activeStage === 1 && (
                <div className="space-y-3">
                  <div className="bg-rose-950/40 border border-rose-500/30 rounded-xl p-3 text-rose-200">
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

                  <div className="bg-zinc-900 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Auto-Text Dispatched
                      </span>
                      <span className="font-mono text-zinc-400">in 6.2s</span>
                    </div>
                    <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 text-zinc-300 text-[11px] leading-relaxed">
                      &quot;Hey Sarah, Mike here with Apex Plumbing. I&apos;m finishing up a job site right now—how can we help with your leak?&quot;
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-2.5">
                    <span className="text-[10px] text-zinc-500 block mb-1 uppercase font-mono">Customer Responded (30s later)</span>
                    <p className="text-zinc-200 text-xs italic">&quot;Water heater is leaking into my basement! Can you come today?&quot;</p>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                  >
                    <span>✓ Book Diagnostic Visit for 3:30 PM</span>
                  </button>
                </div>
              )}

              {activeStage === 2 && (
                <div className="space-y-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Active Job • #JOB-2026-084</span>
                    <h4 className="font-bold text-white text-sm">Sarah Jenkins</h4>
                    <p className="text-zinc-400 text-[11px]">742 Evergreen Terrace • Water Heater</p>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-amber-200 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                      <span className="flex items-center gap-1">
                        <Navigation className="w-3.5 h-3.5 animate-bounce" />
                        En Route Status Active
                      </span>
                      <span className="font-mono">ETA 14m</span>
                    </div>
                    <p className="text-[11px] text-zinc-300">
                      Homeowner has been texted their live tracking link. They see your ETA and truck info.
                    </p>
                  </div>

                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                    <span className="text-[10px] text-zinc-500 font-mono uppercase block">Technician Controls</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        className="py-2 px-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium text-[11px] flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3 h-3 text-blue-400" />
                        Call Sarah
                      </button>
                      <button
                        type="button"
                        className="py-2 px-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-medium text-[11px] flex items-center justify-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3 text-emerald-400" />
                        Text Sarah
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <span>Tap When Arrived: &quot;Start Work&quot;</span>
                  </button>
                </div>
              )}

              {activeStage === 3 && (
                <div className="space-y-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Invoice Generation</span>
                    <h4 className="font-bold text-white text-sm">Sarah Jenkins • #INV-2026-084</h4>
                    <p className="text-zinc-400 text-[11px]">Water Heater Relief Valve & Flush</p>
                  </div>

                  <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                      <span>Total Due</span>
                      <span className="font-mono text-base font-bold text-white">$385.00</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800">
                      <span>CaptoDesk Platform Fee (0.5%):</span>
                      <span className="font-mono text-zinc-300">-$1.93</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-300">
                      <span>Depositing to your bank:</span>
                      <span className="font-mono text-emerald-400">$383.07</span>
                    </div>
                  </div>

                  <div className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-center space-y-1">
                    <span className="text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Paid via Apple Pay (Just now)
                    </span>
                    <p className="text-[10px] text-zinc-500">Funds rolling to your linked bank account via Stripe Connect.</p>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1"
                  >
                    <span>✓ Job Complete & Receipt Sent</span>
                  </button>
                </div>
              )}

              {activeStage === 4 && (
                <div className="space-y-3">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1">Review Booster Feed</span>
                    <h4 className="font-bold text-white text-sm">Automated Review Request</h4>
                    <p className="text-zinc-400 text-[11px]">SMS sent 5 minutes after payment</p>
                  </div>

                  <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-cyan-400">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Reputation Shield Active
                      </span>
                      <span className="font-mono text-[11px]">Google Maps</span>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">
                      4 & 5-star ratings route straight to your Google Maps listing. 1 to 3-star ratings are intercepted privately so you can fix issues first.
                    </p>
                  </div>

                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Your Google Rating:</span>
                      <span className="font-bold text-amber-400 flex items-center gap-0.5">
                        ★ 4.9 <span className="text-zinc-500 font-normal">(184 reviews)</span>
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <span>View All Reviews in Dashboard</span>
                  </button>
                </div>
              )}

              {/* Bottom Phone Bar */}
              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-600">
                <span>CaptoDesk Contractor App</span>
                <span className="font-mono text-emerald-500">Connected</span>
              </div>
            </div>
          </div>
        </div>

        {/* Phone 2: Homeowner's View (Your Customer) */}
        <div className="flex flex-col items-center">
          <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 bg-emerald-950/40 rounded-lg border border-emerald-500/30 text-xs">
            <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Homeowner&apos;s Mobile Screen (Sarah)
            </span>
            <span className="text-[11px] text-emerald-400 font-mono">ZERO APP INSTALL</span>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[340px] rounded-[2.2rem] border-4 border-zinc-800 bg-zinc-950 p-3 shadow-2xl relative overflow-hidden">
            {/* Phone Speaker Notch */}
            <div className="w-24 h-4 bg-zinc-900 rounded-full mx-auto mb-3 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-zinc-800" />
            </div>

            {/* Homeowner Screen Content by Stage */}
            <div className="min-h-[390px] flex flex-col justify-between text-xs">
              {activeStage === 1 && (
                <div className="space-y-3">
                  <div className="bg-zinc-900 p-2.5 rounded-lg border border-zinc-800 text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                    <span>Messages • Apex Plumbing</span>
                    <span className="text-emerald-400">Now</span>
                  </div>

                  <div className="space-y-2">
                    {/* Incoming SMS from Contractor */}
                    <div className="max-w-[85%] bg-zinc-800 text-zinc-200 p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow">
                      <p className="font-semibold text-emerald-400 text-[11px] mb-0.5">Mike from Apex Plumbing</p>
                      Hey Sarah! I missed your call because I was finishing up a job. What&apos;s going on with your plumbing?
                    </div>

                    {/* Customer Reply */}
                    <div className="max-w-[85%] ml-auto bg-emerald-600 text-white p-3 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow">
                      Water heater is leaking into my basement! Can you come today?
                    </div>

                    {/* Instant Confirmation Link */}
                    <div className="max-w-[85%] bg-zinc-800 text-zinc-200 p-3 rounded-2xl rounded-tl-sm text-xs leading-relaxed shadow">
                      Got it! I have you down for 3:30 PM today. You can track my truck live here:
                      <span className="block mt-1 font-mono text-[11px] text-cyan-400 underline">
                        captodesk.com/t/apex-7821
                      </span>
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-900/40 rounded-lg text-center text-[10px] text-zinc-500">
                    Sarah stopped searching Google. Job locked in under 60 seconds.
                  </div>
                </div>
              )}

              {activeStage === 2 && (
                <div className="space-y-2.5">
                  {/* Live Tracker Page /t/token */}
                  <div className="p-2 bg-zinc-900/90 rounded-lg border border-zinc-800 flex items-center justify-between">
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
                  <div className="bg-zinc-900/70 border border-zinc-800 p-3 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-zinc-300">
                      <span>Status:</span>
                      <span className="text-amber-400 font-semibold">Mike is On The Way</span>
                    </div>
                    {/* Stepper Dots */}
                    <div className="grid grid-cols-4 gap-1">
                      <div className="h-1.5 rounded-full bg-emerald-500" />
                      <div className="h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      <div className="h-1.5 rounded-full bg-zinc-800" />
                      <div className="h-1.5 rounded-full bg-zinc-800" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>Booked</span>
                      <span className="text-amber-400 font-bold">En Route</span>
                      <span>Working</span>
                      <span>Done</span>
                    </div>
                  </div>

                  {/* Technician Card */}
                  <div className="p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300">
                        👨‍🔧
                      </div>
                      <div>
                        <p className="font-bold text-white text-xs">Mike R.</p>
                        <p className="text-[10px] text-zinc-400">ETA: ~14 Minutes</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="p-1.5 bg-zinc-800 rounded-lg text-emerald-400">
                        <Phone className="w-3.5 h-3.5" />
                      </div>
                      <div className="p-1.5 bg-zinc-800 rounded-lg text-blue-400">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  <div className="text-center p-2 bg-zinc-900/30 rounded text-[10px] text-zinc-500">
                    Sarah never called the office asking &quot;Where are you?&quot;
                  </div>
                </div>
              )}

              {activeStage === 3 && (
                <div className="space-y-2.5">
                  {/* Job Completed & Invoice Card */}
                  <div className="bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-xl text-center">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 mb-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Service Completed
                    </span>
                    <p className="text-zinc-300 text-xs font-medium">Water Heater Relief Valve Replaced</p>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400">Amount Due:</span>
                      <span className="text-base font-bold font-mono text-white">$385.00</span>
                    </div>
                    <div className="space-y-1 text-[11px] text-zinc-400 pt-2 border-t border-zinc-800">
                      <div className="flex justify-between">
                        <span>Diagnostic & Parts:</span>
                        <span className="font-mono text-zinc-300">$385.00</span>
                      </div>
                      <div className="flex justify-between text-zinc-500 text-[10px]">
                        <span>Secure Checkout powered by Stripe:</span>
                        <span>0.5% standard fee</span>
                      </div>
                    </div>

                    {/* Apple Pay Button */}
                    <button
                      type="button"
                      className="w-full py-2.5 bg-white hover:bg-zinc-100 text-zinc-950 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                    >
                      <span>Pay $385.00 with</span>
                      <span className="font-extrabold text-sm tracking-tighter">Pay</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-zinc-500 text-center">
                    Customer paid before contractor backed out of the driveway.
                  </p>
                </div>
              )}

              {activeStage === 4 && (
                <div className="space-y-2.5">
                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-center space-y-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                      <Star className="w-4 h-4 fill-amber-400" />
                    </div>
                    <h4 className="font-bold text-white text-xs">How was your service with Mike?</h4>
                    <p className="text-[11px] text-zinc-400">Tap a star to rate Apex Plumbing</p>

                    {/* Star Rating Interactive Selector */}
                    <div className="flex justify-center gap-2 py-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setSimulatedRating(star)}
                          className="focus:outline-none transition-transform hover:scale-125"
                        >
                          <Star
                            className={`w-5 h-5 ${
                              star <= simulatedRating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-zinc-700'
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
                        <p className="text-[10px] text-zinc-400 leading-tight">
                          4–5 stars automatically routes Sarah to your Google listing to boost your local SEO.
                        </p>
                      </div>
                    ) : (
                      <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-[11px] text-rose-300 text-left space-y-1">
                        <div className="font-bold flex items-center gap-1 text-rose-400">
                          <ShieldCheck className="w-3 h-3" />
                          Intercepted Privately
                        </div>
                        <p className="text-[10px] text-zinc-400 leading-tight">
                          1–3 stars sends private feedback to your dashboard so you can fix it before it hurts your rating!
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-zinc-500 text-center">
                    Try tapping 2 stars vs 5 stars above to test the reputation shield.
                  </p>
                </div>
              )}

              {/* Bottom Phone Bar */}
              <div className="pt-2 border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-600">
                <span>Safari Mobile Web</span>
                <span className="font-mono text-zinc-500">Secure SSL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Walkthrough Summary Banner */}
      <div className="mt-4 p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
            ✓
          </div>
          <div>
            <span className="font-bold text-white text-sm block">Total Time Required from Contractor: 2 Thumb Taps</span>
            <span className="text-zinc-400">
              No typing on a laptop, no clunky software, no lost leads, and no chasing unpaid invoices.
            </span>
          </div>
        </div>

        <a
          href="/client/login"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs whitespace-nowrap shadow-md shadow-emerald-600/20 transition-all"
        >
          <span>Get Started Today</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}
