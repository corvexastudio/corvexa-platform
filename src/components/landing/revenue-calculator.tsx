'use client'

import React, { useState } from 'react'
import { DollarSign, AlertTriangle, ArrowRight, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react'

export function RevenueCalculator() {
  const [callsPerWeek, setCallsPerWeek] = useState<number>(6)
  const [avgTicket, setAvgTicket] = useState<number>(650)
  const [closeRate, setCloseRate] = useState<number>(45)

  // Math logic
  const annualCalls = callsPerWeek * 52
  const annualLostJobs = Math.round(annualCalls * (closeRate / 100))
  const annualLostRevenue = annualLostJobs * avgTicket
  const monthlyLostRevenue = Math.round(annualLostRevenue / 12)
  const projectedRecovery = Math.round(annualLostRevenue * 0.68) // 68% average recovery rate via instant SMS text-back

  return (
    <div className="w-full max-w-5xl mx-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-3">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>THE UNANSWERED CALL REVENUE BLEED</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
          How Much Are Missed Calls Costing Your Business?
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 mt-2">
          When a homeowner with an emergency reaches your voicemail, they don&apos;t wait. They hang up and call the next contractor on Google Maps. Slide the numbers below to see your leak.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Sliders Input Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Slider 1: Unanswered Calls */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="calls-per-week-slider" className="text-xs sm:text-sm font-semibold text-zinc-200">
                Unanswered calls while working or driving:
              </label>
              <span className="font-mono text-base font-bold text-rose-400">
                {callsPerWeek} <span className="text-xs font-normal text-zinc-500">calls / week</span>
              </span>
            </div>
            <input
              id="calls-per-week-slider"
              type="range"
              min={1}
              max={25}
              step={1}
              value={callsPerWeek}
              onChange={(e) => setCallsPerWeek(Number(e.target.value))}
              aria-label="Unanswered calls while working or driving"
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
              <span>1 call/wk</span>
              <span>12 calls/wk</span>
              <span>25 calls/wk</span>
            </div>
          </div>

          {/* Slider 2: Average Ticket Value */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="avg-ticket-slider" className="text-xs sm:text-sm font-semibold text-zinc-200">
                Average job ticket price:
              </label>
              <span className="font-mono text-base font-bold text-white">
                ${avgTicket.toLocaleString()} <span className="text-xs font-normal text-zinc-500">per job</span>
              </span>
            </div>
            <input
              id="avg-ticket-slider"
              type="range"
              min={150}
              max={3500}
              step={50}
              value={avgTicket}
              onChange={(e) => setAvgTicket(Number(e.target.value))}
              aria-label="Average job ticket price"
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
              <span>$150 (Service call)</span>
              <span>$1,500 (Water heater)</span>
              <span>$3,500+ (Full install)</span>
            </div>
          </div>

          {/* Slider 3: Close Rate */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="close-rate-slider" className="text-xs sm:text-sm font-semibold text-zinc-200">
                Your estimated close rate if you respond first:
              </label>
              <span className="font-mono text-base font-bold text-cyan-400">
                {closeRate}% <span className="text-xs font-normal text-zinc-500">booked</span>
              </span>
            </div>
            <input
              id="close-rate-slider"
              type="range"
              min={20}
              max={80}
              step={5}
              value={closeRate}
              onChange={(e) => setCloseRate(Number(e.target.value))}
              aria-label="Your estimated close rate if you respond first"
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
              <span>20% (Low)</span>
              <span>45% (Industry avg)</span>
              <span>80% (High referrals)</span>
            </div>
          </div>
        </div>

        {/* Calculated Results Card */}
        <div className="lg:col-span-5 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 sm:p-7 rounded-2xl border-2 border-rose-500/30 shadow-xl space-y-6">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase text-rose-400 tracking-wider block mb-1">
              Estimated Revenue Leaked to Competitors
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-5xl font-extrabold text-white font-mono tracking-tight">
                ${monthlyLostRevenue.toLocaleString()}
              </span>
              <span className="text-xs sm:text-sm text-zinc-400 font-medium">/ month</span>
            </div>
            <p className="text-xs text-rose-400/90 mt-1 font-mono font-semibold">
              ≈ ${annualLostRevenue.toLocaleString()} / year in lost jobs
            </p>
          </div>

          {/* Projected Recovery with CaptoDesk */}
          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Projected CaptoDesk Recovery
              </span>
              <span className="font-mono text-white text-sm font-bold">
                +${Math.round(projectedRecovery / 12).toLocaleString()}/mo
              </span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
              <p className="leading-relaxed">
                By responding in <strong>8 seconds</strong> via automated 2-way SMS, you keep approximately{' '}
                <strong className="text-white underline decoration-emerald-500">
                  ${projectedRecovery.toLocaleString()} / year
                </strong>{' '}
                that currently goes straight to your competitors.
              </p>
            </div>
          </div>

          <a
            href="/client/login"
            className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <span>Stop Leaking Revenue — Start Free</span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <span>14-day free trial • 2-minute setup • No credit card</span>
          </div>
        </div>
      </div>
    </div>
  )
}
