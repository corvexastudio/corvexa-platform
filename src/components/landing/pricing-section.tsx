'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Check, X, ShieldCheck, ArrowRight, Sparkles, HelpCircle } from 'lucide-react'

export function PricingSection({ onOpenClaim }: { onOpenClaim: () => void }) {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly')

  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 scroll-mt-20 space-y-12">
      
      {/* Pricing Header */}
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          TRANSPARENT PRICING
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Straightforward Pricing. Zero Contracts.
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
          Start with 3 completed jobs completely free. Upgrade anytime when you want a dedicated business phone line with 24/7 missed-call text-back and multi-crew dispatch.
        </p>

        {/* Billing Toggle */}
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
            <span>Annual Billing</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
              2 Months Free
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch max-w-6xl mx-auto">
        
        {/* Tier 1: Free Starter Pass */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
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
              <p className="text-xs text-slate-500 mt-1">
                Full online booking, live arrival tracking, and on-site payments to test with real customers.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dedicated booking link (book.captodesk.com/[your-trade])</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Unlimited homeowner online bookings</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dispatch schedule and customer CRM</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Live homeowner arrival tracking link</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Driveway Apple Pay and card invoicing</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Automated Google review follow-up</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <X className="w-4 h-4 shrink-0" />
                <span>Dedicated business carrier phone number (Solo Pro)</span>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <X className="w-4 h-4 shrink-0" />
                <span>24/7 missed-call SMS auto text-back (Solo Pro)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onOpenClaim}
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs text-center transition-all cursor-pointer"
            >
              Get Free Booking Link &rarr;
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              No credit card required. Zero setup fees.
            </p>
          </div>
        </div>

        {/* Tier 2: Solo Pro */}
        <div className="rounded-3xl border-2 border-blue-600 bg-white p-6 sm:p-8 shadow-xl relative flex flex-col justify-between space-y-6">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-blue-600 text-white text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
            RECOMMENDED FOR OWNER-OPERATORS
          </span>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
                SOLO PRO
              </span>
              <span className="text-xs text-slate-500 font-mono">1 Truck Operator</span>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'monthly' ? '99' : '79'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  / month {billingCycle === 'annual' && '(billed $950/year)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Full 24/7 missed-call recovery with dedicated carrier number and unlimited jobs.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-800 border-t border-slate-100 pt-4 font-medium">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dedicated Telnyx carrier phone number included</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>2-way 5-second SMS auto text-back on missed calls</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Unlimited completed customer jobs</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Live GPS arrival tracking texted to homeowners</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Mobile invoicing and driveway Apple Pay checkout</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Automated 5-star Google review requests</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Carrier 10DLC registration included (prevents spam flags)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={onOpenClaim}
              className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs text-center shadow-md shadow-blue-600/25 transition-all cursor-pointer"
            >
              Get Started with Solo Pro
            </button>
            <p className="text-[11px] text-slate-400 text-center">
              Month-to-month flexibility. Standard $199 one-time carrier registration.
            </p>
          </div>
        </div>

        {/* Tier 3: Multi-Crew Fleet */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                MULTI-CREW FLEET
              </span>
              <span className="text-xs text-slate-500 font-mono">2 to 5 Trucks</span>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900 font-mono">
                  ${billingCycle === 'monthly' ? '199' : '159'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  / month {billingCycle === 'annual' && '(billed $1,900/year)'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                For growing trade companies with multiple technicians and service vehicles.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-700 border-t border-slate-100 pt-4">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Everything in Solo Pro, plus:</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Up to 5 technician mobile logins</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Restricted technician field mode (hidden financial data)</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Multi-crew dispatch schedule and team broadcasts</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Individual technician review attribution</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Dedicated onboarding setup call</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Link
              href="/contact"
              className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs text-center transition-all block cursor-pointer"
            >
              Contact Fleet Specialist
            </Link>
            <p className="text-[11px] text-slate-400 text-center">
              Custom multi-vehicle configuration available upon request.
            </p>
          </div>
        </div>

      </div>

      {/* Commercial FAQ / Common Billing Questions */}
      <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-6 sm:p-8 max-w-4xl mx-auto space-y-4">
        <h4 className="text-sm font-bold text-slate-900 uppercase font-mono tracking-wider">
          Billing Transparency and FAQs
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
          <div>
            <p className="font-bold text-slate-800">Is a credit card required to start?</p>
            <p className="mt-1">
              No. You can claim your booking link and run your first 3 completed customer jobs without entering payment details.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-800">What are the transaction processing fees?</p>
            <p className="mt-1">
              Payments are processed directly via your connected Stripe or PayPal account at standard card processing rates. CaptoDesk takes zero percentage of your revenue.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-800">Can I change or cancel my plan at any time?</p>
            <p className="mt-1">
              Yes. All plans are month-to-month with zero long-term commitments. You can upgrade, downgrade, or cancel anytime from your settings.
            </p>
          </div>
          <div>
            <p className="font-bold text-slate-800">What is the carrier registration fee on paid plans?</p>
            <p className="mt-1">
              US mobile carriers require 10DLC business registration to ensure your automated texts are delivered reliably without being filtered as spam.
            </p>
          </div>
        </div>
      </div>

    </section>
  )
}
