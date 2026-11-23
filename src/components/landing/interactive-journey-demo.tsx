'use client'

import React, { useState } from 'react'
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  ShieldCheck,
  Star,
  Navigation,
  CreditCard,
  Truck,
  User,
  Wrench,
  Flame,
  Zap,
  Home,
  Car
} from 'lucide-react'

export interface DemoTradeData {
  id: string
  name: string
  slug: string
  tradeParam: string
  businessName: string
  phone: string
  icon: React.ComponentType<{ className?: string }>
  serviceName: string
  servicePrice: string
  serviceDuration: string
  arrivalSlot: string
  customerName: string
  customerAddress: string
  technicianName: string
  etaMinutes: number
}

const DEMO_TRADES: DemoTradeData[] = [
  {
    id: 'plumbing',
    name: 'Plumbing & Drain',
    slug: 'plumbing',
    tradeParam: 'plumbing',
    businessName: 'ProFlow Plumbing & Rooter',
    phone: '(214) 739-1184',
    icon: Wrench,
    serviceName: 'Emergency Main Drain Clearing',
    servicePrice: '$195',
    serviceDuration: '90 mins',
    arrivalSlot: 'Today: 2:00 PM to 4:00 PM',
    customerName: 'Sarah Jenkins',
    customerAddress: '742 Evergreen Terrace, Dallas TX',
    technicianName: 'Marcus Turner',
    etaMinutes: 12
  },
  {
    id: 'hvac',
    name: 'HVAC & Heating',
    slug: 'hvac',
    tradeParam: 'hvac',
    businessName: 'ComfortAir Heating & Air',
    phone: '(817) 601-9230',
    icon: Flame,
    serviceName: '24-Point AC Seasonal Tune-Up',
    servicePrice: '$119',
    serviceDuration: '60 mins',
    arrivalSlot: 'Tomorrow: 8:30 AM to 10:30 AM',
    customerName: 'Robert Vance',
    customerAddress: '1428 Elm Creek Parkway, Fort Worth TX',
    technicianName: 'David Miller',
    etaMinutes: 18
  },
  {
    id: 'electrical',
    name: 'Electrical & EV',
    slug: 'electrical',
    tradeParam: 'electrical',
    businessName: 'VoltLine Electrical & EV',
    phone: '(469) 310-8841',
    icon: Zap,
    serviceName: 'Level 2 Universal EV Charger Install',
    servicePrice: '$695',
    serviceDuration: '3.0 hrs',
    arrivalSlot: 'Today: 4:00 PM to 6:00 PM',
    customerName: 'Elena Rostova',
    customerAddress: '883 Meadow Lark Lane, Plano TX',
    technicianName: 'Jason Cole',
    etaMinutes: 8
  },
  {
    id: 'roofing',
    name: 'Roofing & Gutters',
    slug: 'roofing',
    tradeParam: 'roofing',
    businessName: 'LoneStar Roofing & Gutters',
    phone: '(972) 419-7023',
    icon: Home,
    serviceName: '18-Point Storm & Hail Damage Inspection',
    servicePrice: '$0 Free',
    serviceDuration: '60 mins',
    arrivalSlot: 'Tomorrow: 1:00 PM to 3:00 PM',
    customerName: 'Michael Scott',
    customerAddress: '314 Oak Ridge Boulevard, Arlington TX',
    technicianName: 'Carlos Vega',
    etaMinutes: 22
  },
  {
    id: 'detailing',
    name: 'Auto Detailing',
    slug: 'auto-detailing',
    tradeParam: 'detailing',
    businessName: 'Apex Mobile Detailing & Ceramic',
    phone: '(469) 820-4102',
    icon: Car,
    serviceName: 'Full Interior & Exterior Detail',
    servicePrice: '$249',
    serviceDuration: '2.5 hrs',
    arrivalSlot: 'Today: 2:30 PM to 5:00 PM',
    customerName: 'Amanda Lewis',
    customerAddress: '512 Northside Drive, Frisco TX',
    technicianName: 'Brian Keller',
    etaMinutes: 15
  }
]

type JourneyStage = 'booking' | 'dispatch' | 'tracking' | 'completion'

export function InteractiveJourneyDemo({ onOpenClaim }: { onOpenClaim: () => void }) {
  const [selectedTrade, setSelectedTrade] = useState<string>('plumbing')
  const [activeStage, setActiveStage] = useState<JourneyStage>('booking')

  const trade = DEMO_TRADES.find((t) => t.id === selectedTrade) || DEMO_TRADES[0]

  return (
    <section id="demo" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200 scroll-mt-20">
      <div className="max-w-3xl mx-auto text-center space-y-3">
        <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-widest block">
          COMPLETE PRODUCT WALKTHROUGH
        </span>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          See How the Entire System Connects
        </h2>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Switch between trades and follow a service call through each real stage of the CaptoDesk platform.
        </p>
      </div>

      {/* Trade Selector Tabs */}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto">
        {DEMO_TRADES.map((item) => {
          const isSelected = item.id === selectedTrade
          const Icon = item.icon
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedTrade(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.name}</span>
            </button>
          )
        })}
      </div>

      {/* Journey Stage Buttons */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 max-w-4xl mx-auto">
        <button
          type="button"
          onClick={() => setActiveStage('booking')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'booking'
              ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-mono block uppercase">Stage 1</span>
          <span className="text-xs sm:text-sm">Customer Booking</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStage('dispatch')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'dispatch'
              ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-mono block uppercase">Stage 2</span>
          <span className="text-xs sm:text-sm">Contractor Dispatch</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStage('tracking')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'tracking'
              ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-mono block uppercase">Stage 3</span>
          <span className="text-xs sm:text-sm">Technician Arrival</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveStage('completion')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            activeStage === 'completion'
              ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold shadow-2xs'
              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <span className="text-[10px] font-mono block uppercase">Stage 4</span>
          <span className="text-xs sm:text-sm">Checkout &amp; Review</span>
        </button>
      </div>

      {/* Dynamic Interactive Stage Card */}
      <div className="mt-8 max-w-4xl mx-auto rounded-3xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        {/* Stage Header */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase text-blue-400 tracking-wider">
              {activeStage === 'booking' && 'Stage 1 of 4: Public Online Scheduling'}
              {activeStage === 'dispatch' && 'Stage 2 of 4: Contractor Field Dispatch'}
              {activeStage === 'tracking' && 'Stage 3 of 4: Customer Live Arrival'}
              {activeStage === 'completion' && 'Stage 4 of 4: On-Site Payment and Review Request'}
            </span>
            <h3 className="text-lg font-bold text-white mt-0.5">{trade.businessName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`https://book.captodesk.com/${trade.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5"
            >
              <span>Test Live Booking</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={`https://app.captodesk.com/demo?trade=${trade.tradeParam}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5"
            >
              <span>Test Dispatch</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Stage Body */}
        <div className="p-6 sm:p-8">
          {activeStage === 'booking' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                  How Homeowners Book
                </span>
                <h4 className="text-xl font-bold text-slate-900">
                  Customer Visits Your Dedicated Booking Page
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Homeowners access your custom link from your Google Business Profile or Instagram bio. They select their required service, view clear pricing, and pick an arrival window without creating an account.
                </p>
              </div>

              {/* Realistic Booking Interface Preview */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 max-w-lg mx-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-800">{trade.businessName}</p>
                  <span className="text-[10px] font-mono text-slate-500">book.captodesk.com/{trade.slug}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-blue-600 shadow-2xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900">{trade.serviceName}</span>
                    <span className="text-xs font-mono font-extrabold text-slate-900">{trade.servicePrice}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Estimated duration: {trade.serviceDuration}</span>
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1 text-xs">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Selected Window</span>
                  <p className="font-semibold text-slate-800">{trade.arrivalSlot}</p>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confirmed without phone tag in under 45 seconds</span>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'dispatch' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                  How Contractors Manage
                </span>
                <h4 className="text-xl font-bold text-slate-900">
                  Incoming Booking Appears Directly on Your Dispatch Schedule
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  The appointment automatically populates your schedule with the customer&apos;s address, phone number, and service details. You or your dispatcher can reassign technicians or modify notes in seconds.
                </p>
              </div>

              {/* Realistic Dispatch Console Preview */}
              <div className="rounded-2xl border border-slate-200 bg-slate-950 text-white p-4 sm:p-6 space-y-4 max-w-xl mx-auto">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <span className="text-xs font-mono text-emerald-400 font-bold">DISPATCH BOARD &bull; ACTIVE CALL</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300">CONFIRMED</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Customer:</span>
                    <span className="font-bold text-white">{trade.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Address:</span>
                    <span className="text-slate-300">{trade.customerAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Service:</span>
                    <span className="text-white font-semibold">{trade.serviceName} ({trade.servicePrice})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Assigned Tech:</span>
                    <span className="text-emerald-400 font-bold">{trade.technicianName}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Ready to depart?</span>
                  <div className="px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Tap &quot;On My Way&quot;</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'tracking' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                  How Customers Track
                </span>
                <h4 className="text-xl font-bold text-slate-900">
                  Customer Receives Live Technician Arrival Map
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  Tapping On My Way texts the customer a secure link to their tracking screen. They see the technician&apos;s name, photo, and live estimated time of arrival, eliminating anxious check-in calls.
                </p>
              </div>

              {/* Realistic Arrival Tracking Screen */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4 max-w-lg mx-auto shadow-sm">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">{trade.businessName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                    TECHNICIAN EN ROUTE
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
                      {trade.technicianName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{trade.technicianName}</p>
                      <p className="text-[11px] text-slate-500">Service Van #3 &bull; Licensed Tech</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">ETA</span>
                    <span className="text-base font-mono font-extrabold text-blue-600">
                      {trade.etaMinutes} mins
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900 flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Live arrival updates and ETA as technician approaches</span>
                </div>
              </div>
            </div>
          )}

          {activeStage === 'completion' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-blue-600 uppercase tracking-wider block">
                  How You Get Paid &amp; Reviewed
                </span>
                <h4 className="text-xl font-bold text-slate-900">
                  Driveway Checkout and Automated Review Requests
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  When the work is done, tap Complete Job on your smartphone. The customer pays immediately using Apple Pay, Google Pay, or card right from their driveway. Once settled, an automated review link is delivered.
                </p>
              </div>

              {/* Realistic Checkout & Review Interface */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6 space-y-4 max-w-lg mx-auto">
                <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-800">Job Complete &bull; Invoice #1042</span>
                    <span className="text-xs font-mono font-bold text-emerald-600">PAID $195.00</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Settled on site via Apple Pay. Digital receipt emailed and texted to customer.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>Automated Google Review Follow-Up</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    A thank-you text with your Google review link was sent to {trade.customerName}. Happy customers are guided straight to your Google profile.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom CTA bar */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-slate-600 font-medium text-center sm:text-left">
            Ready to test this workflow for your own trade business?
          </span>
          <button
            type="button"
            onClick={onOpenClaim}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors cursor-pointer"
          >
            Claim Your Free Booking Link
          </button>
        </div>
      </div>
    </section>
  )
}
