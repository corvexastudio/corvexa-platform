'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { DollarSign, AlertTriangle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react'

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
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden">
      {/* Decorative ambient gradient */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>REALISTIC TRADE REVENUE CALCULATOR</span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          How Much Are Missed Calls Costing Your Business?
        </h2>
        <p className="text-sm sm:text-base text-slate-600 mt-2">
          When a homeowner with an urgent service need hits voicemail, they hang up and call the next contractor on Google Maps. Adjust the numbers below to see what you could be recovering.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Sliders Input Column */}
        <div className="lg:col-span-7 space-y-6">
          {/* Slider 1: Unanswered Calls */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex justify-between items-center">
              <label htmlFor="calls-per-week-slider" className="text-xs sm:text-sm font-bold text-slate-800">
                Unanswered calls while working or driving:
              </label>
              <span className="font-mono text-base font-extrabold text-rose-600">
                {callsPerWeek} <span className="text-xs font-normal text-slate-500">calls / week</span>
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
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>1 call/wk</span>
              <span>12 calls/wk</span>
              <span>25 calls/wk</span>
            </div>
          </div>

          {/* Slider 2: Average Ticket Value */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex justify-between items-center">
              <label htmlFor="avg-ticket-slider" className="text-xs sm:text-sm font-bold text-slate-800">
                Average job ticket size:
              </label>
              <span className="font-mono text-base font-extrabold text-slate-900">
                ${avgTicket.toLocaleString()} <span className="text-xs font-normal text-slate-500">per job</span>
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
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>$150 (Service call)</span>
              <span>$1,500 (Water heater/Panel)</span>
              <span>$3,500+ (Full replacement)</span>
            </div>
          </div>

          {/* Slider 3: Close Rate */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <div className="flex justify-between items-center">
              <label htmlFor="close-rate-slider" className="text-xs sm:text-sm font-bold text-slate-800">
                Estimated booking rate if you respond immediately:
              </label>
              <span className="font-mono text-base font-extrabold text-emerald-700">
                {closeRate}% <span className="text-xs font-normal text-slate-500">booked</span>
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
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>20% (Conservative)</span>
              <span>45% (Trade average)</span>
              <span>80% (Repeat/High trust)</span>
            </div>
          </div>
        </div>

        {/* Calculated Results Card */}
        <div className="lg:col-span-5 bg-slate-900 p-6 sm:p-7 rounded-3xl text-white shadow-xl space-y-6">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase text-rose-400 tracking-wider block mb-1">
              Estimated Missed Opportunity
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-5xl font-extrabold text-white font-mono tracking-tight">
                ${monthlyLostRevenue.toLocaleString()}
              </span>
              <span className="text-xs sm:text-sm text-slate-400 font-medium">/ month</span>
            </div>
            <p className="text-xs text-rose-300/90 mt-1 font-mono font-medium">
              ≈ ${annualLostRevenue.toLocaleString()} / year in missed service work
            </p>
          </div>

          {/* Projected Recovery with CaptoDesk */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Projected Recovery via CaptoDesk
              </span>
              <span className="font-mono text-emerald-400 text-sm font-bold">
                +${Math.round(projectedRecovery / 12).toLocaleString()}/mo
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 leading-relaxed">
              By responding in <strong>8 seconds</strong> via automated 2-way SMS, you keep approximately{' '}
              <strong className="text-white font-bold underline decoration-emerald-500">
                ${projectedRecovery.toLocaleString()} / year
              </strong>{' '}
              that currently slips to competitor listings.
            </div>
          </div>

          <Link
            href="/client/login?mode=signup"
            className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-extrabold text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Claim Your Free Booking Page</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Free booking link included • Upgrade to Solo Pro anytime for 24/7 lead rescue</span>
          </div>
        </div>
      </div>
    </div>
  )
}
