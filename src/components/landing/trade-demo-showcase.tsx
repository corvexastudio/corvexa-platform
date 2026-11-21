'use client'

import React, { useState } from 'react'
import {
  Car,
  Wrench,
  Flame,
  Home,
  Zap,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  PhoneCall,
  Clock,
  ShieldCheck,
  Star,
  Sparkles,
  Calendar,
  Truck
} from 'lucide-react'

export interface TradeDemo {
  id: string
  name: string
  tradeLabel: string
  contractorName: string
  phone: string
  slug: string
  demoTradeParam: string
  icon: React.ComponentType<{ className?: string }>
  themeColor: string
  badgeColor: string
  stats: {
    callsRecovered: number
    jobsCompleted: number
    revenueCollected: string
  }
  services: {
    title: string
    price: string
    duration: string
    popular?: boolean
  }[]
  availableSlot: string
}

export const TRADE_DEMOS: TradeDemo[] = [
  {
    id: 'detailing',
    name: 'Auto Detailing',
    tradeLabel: 'Mobile Detailing & Ceramic',
    contractorName: 'Apex Mobile Detailing & Ceramic',
    phone: '(469) 820-4102',
    slug: 'auto-detailing',
    demoTradeParam: 'detailing',
    icon: Car,
    themeColor: 'blue',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    stats: {
      callsRecovered: 42,
      jobsCompleted: 38,
      revenueCollected: '$7,420.00'
    },
    services: [
      { title: 'Full Interior & Exterior Detail', price: '$249', duration: '2.5 hrs', popular: true },
      { title: 'Mobile Foam Wash & Spray Wax', price: '$95', duration: '1.0 hr' },
      { title: 'Paint Correction & Ceramic Coat', price: '$650', duration: '4.0 hrs' }
    ],
    availableSlot: 'Today: 2:00 PM – 4:30 PM'
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Drain',
    tradeLabel: 'Plumbing & Drain Cleaning',
    contractorName: 'ProFlow Plumbing & Rooter',
    phone: '(214) 739-1184',
    slug: 'plumbing',
    demoTradeParam: 'plumbing',
    icon: Wrench,
    themeColor: 'sky',
    badgeColor: 'bg-sky-50 text-sky-700 border-sky-200',
    stats: {
      callsRecovered: 56,
      jobsCompleted: 52,
      revenueCollected: '$14,850.00'
    },
    services: [
      { title: 'Emergency Main Drain Clearing', price: '$195', duration: '1.5 hrs', popular: true },
      { title: 'Water Heater Diagnostic & Flush', price: '$149', duration: '1.0 hr' },
      { title: 'Tankless Water Heater Installation', price: '$2,200', duration: '4.5 hrs' }
    ],
    availableSlot: 'Today: 3:30 PM – 5:30 PM'
  },
  {
    id: 'hvac',
    name: 'HVAC & Heating',
    tradeLabel: 'Heating, AC & Heat Pumps',
    contractorName: 'ComfortAir Heating & Air',
    phone: '(817) 601-9230',
    slug: 'hvac',
    demoTradeParam: 'hvac',
    icon: Flame,
    themeColor: 'amber',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
    stats: {
      callsRecovered: 31,
      jobsCompleted: 41,
      revenueCollected: '$8,920.00'
    },
    services: [
      { title: '24-Point AC Seasonal Tune-Up', price: '$119', duration: '1.0 hr', popular: true },
      { title: 'Furnace Diagnostics & Safety Check', price: '$129', duration: '1.0 hr' },
      { title: 'Heat Pump System Precision Service', price: '$285', duration: '2.0 hrs' }
    ],
    availableSlot: 'Tomorrow: 8:30 AM – 10:30 AM'
  },
  {
    id: 'roofing',
    name: 'Roofing & Gutters',
    tradeLabel: 'Roof Repair & Gutter Guards',
    contractorName: 'LoneStar Roofing & Gutters',
    phone: '(972) 419-7023',
    slug: 'roofing',
    demoTradeParam: 'roofing',
    icon: Home,
    themeColor: 'rose',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    stats: {
      callsRecovered: 18,
      jobsCompleted: 15,
      revenueCollected: '$16,200.00'
    },
    services: [
      { title: '18-Point Storm & Hail Damage Inspection', price: '$0 Free', duration: '1.0 hr', popular: true },
      { title: 'Emergency Roof Tarping & Patch', price: '$385', duration: '2.0 hrs' },
      { title: 'Seamless Gutter Clean & Guard Flush', price: '$225', duration: '1.5 hrs' }
    ],
    availableSlot: 'Tomorrow: 1:00 PM – 3:00 PM'
  },
  {
    id: 'electrical',
    name: 'Electrical & EV',
    tradeLabel: 'Panel Upgrades & EV Chargers',
    contractorName: 'VoltLine Electrical & EV',
    phone: '(469) 310-8841',
    slug: 'electrical',
    demoTradeParam: 'electrical',
    icon: Zap,
    themeColor: 'emerald',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    stats: {
      callsRecovered: 24,
      jobsCompleted: 29,
      revenueCollected: '$9,380.00'
    },
    services: [
      { title: 'Level 2 Universal EV Charger Install', price: '$695', duration: '3.0 hrs', popular: true },
      { title: 'Whole-Home Safety & Circuit Check', price: '$149', duration: '1.0 hr' },
      { title: '200A Main Breaker Panel Modernization', price: '$2,400', duration: '5.0 hrs' }
    ],
    availableSlot: 'Today: 4:00 PM – 6:00 PM'
  }
]

export function TradeDemoShowcase({ onOpenClaim }: { onOpenClaim?: () => void }) {
  const [selectedTradeId, setSelectedTradeId] = useState<string>('detailing')

  const currentTrade = TRADE_DEMOS.find((t) => t.id === selectedTradeId) || TRADE_DEMOS[0]
  const IconComponent = currentTrade.icon

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-bold">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>INTERACTIVE CONTRACTOR DEMOS</span>
        </div>
        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">
          Select Your Trade. See It Work Live.
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Test drive the real customer booking checkout flow and the contractor dispatch workspace. Zero dummy data, real working systems.
        </p>
      </div>

      {/* Trade Selector Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 p-1.5 bg-slate-100/80 border border-slate-200 rounded-2xl max-w-4xl mx-auto shadow-2xs">
        {TRADE_DEMOS.map((trade) => {
          const isSelected = trade.id === selectedTradeId
          const TabIcon = trade.icon
          return (
            <button
              key={trade.id}
              type="button"
              onClick={() => setSelectedTradeId(trade.id)}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <TabIcon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>{trade.name}</span>
            </button>
          )
        })}
      </div>

      {/* Interactive Trade Preview Container */}
      <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xl overflow-hidden">
        {/* Trade Top Bar */}
        <div className="bg-slate-900 text-white p-5 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0">
              <IconComponent className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {currentTrade.contractorName}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Live System
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Dedicated Line: <span className="text-slate-200">{currentTrade.phone}</span> &bull; Trade: {currentTrade.tradeLabel}
              </p>
            </div>
          </div>

          {/* Quick Metrics Badge Strip */}
          <div className="flex items-center gap-3 sm:gap-6 bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 sm:px-5">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Calls Recovered</span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-emerald-400">
                {currentTrade.stats.callsRecovered}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Jobs Booked</span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-white">
                {currentTrade.stats.jobsCompleted}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-700" />
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Revenue MTD</span>
              <span className="text-base sm:text-lg font-mono font-extrabold text-white">
                {currentTrade.stats.revenueCollected}
              </span>
            </div>
          </div>
        </div>

        {/* Content Body: Left Customer Booking Preview, Right Contractor Dispatch Preview */}
        <div className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Customer Booking View (6 Cols) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                  VIEW 1: CUSTOMER BOOKING FLOW
                </span>
                <h4 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  What Homeowners See on Google Maps
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                book.captodesk.com/{currentTrade.slug}
              </span>
            </div>

            {/* Simulated Booking Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 space-y-3.5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                    {currentTrade.contractorName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 leading-none">{currentTrade.contractorName}</p>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-amber-600">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      <span className="font-bold">4.9</span>
                      <span className="text-slate-400">(120+ verified reviews)</span>
                    </div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Instant Confirmation
                </span>
              </div>

              {/* Service Selection List */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono font-bold uppercase text-slate-500 block">
                  Select Requested Service:
                </span>
                {currentTrade.services.map((svc, i) => (
                  <div
                    key={svc.title}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      i === 0
                        ? 'bg-white border-blue-600 shadow-2xs'
                        : 'bg-white/80 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          i === 0 ? 'border-blue-600' : 'border-slate-300'
                        }`}
                      >
                        {i === 0 && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{svc.title}</p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{svc.duration}</span>
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-extrabold text-slate-900">{svc.price}</span>
                  </div>
                ))}
              </div>

              {/* Next Open Arrival Window */}
              <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-900 font-semibold">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Earliest Arrival Slot:</span>
                </div>
                <span className="font-mono font-bold text-blue-700">{currentTrade.availableSlot}</span>
              </div>

              {/* Direct Link to Live Customer Booking */}
              <a
                href={`https://book.captodesk.com/${currentTrade.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>Test Live Customer Booking Flow</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Right Column: Contractor Dispatch & Field View (6 Cols) */}
          <div className="lg:col-span-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-emerald-600 uppercase tracking-wider block">
                  VIEW 2: CONTRACTOR DISPATCH WORKSPACE
                </span>
                <h4 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  What You Tap From Your Work Truck
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
                app.captodesk.com/demo
              </span>
            </div>

            {/* Simulated Contractor Console Card */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-4 sm:p-5 space-y-3.5">
              {/* Dispatch Action Strip */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span>Active Dispatch &bull; Lead Locked in 5s</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                    GPS TRACKING READY
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 block font-mono">1. Tap When Rolling</span>
                    <span className="font-bold text-blue-600">&quot;On My Way&quot;</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">Texts homeowner live GPS map</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase text-slate-400 block font-mono">2. Tap When Finished</span>
                    <span className="font-bold text-emerald-600">&quot;Complete Job&quot;</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">Texts driveway Apple Pay link</p>
                  </div>
                </div>
              </div>

              {/* 3 Value Pillars */}
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Zero app downloads</strong> for customers—opens directly in mobile Safari/Chrome</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Automated 5-Star Reviews:</strong> Happy homeowners are guided to Google Business Profile</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Keep Your Phone Number:</strong> No forwarding setup required on Starter Pass</span>
                </div>
              </div>

              {/* Direct Link to Live Dispatch Workspace */}
              <a
                href={`https://app.captodesk.com/demo?trade=${currentTrade.demoTradeParam}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>Open Contractor Dispatch Workspace</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Banner inside the Showcase */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-emerald-50 border-t border-slate-200/80 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                Ready to launch this exact booking system for your business?
              </p>
              <p className="text-xs text-slate-600">
                Takes 2 minutes. Your first 3 completed jobs are 100% free with zero credit card required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenClaim}
            className="shrink-0 w-full sm:w-auto px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-extrabold shadow-sm shadow-blue-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Claim My Free Booking Link</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
