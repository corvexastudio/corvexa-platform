'use client'

import React, { useState } from 'react'
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
  Check,
  Wrench,
  Flame,
  Zap,
  Home,
  Car
} from 'lucide-react'

interface HeroSectionProps {
  onOpenClaim: () => void
}

interface TradePreview {
  id: string
  name: string
  company: string
  slug: string
  service: string
  price: string
  duration: string
  window: string
  tech: string
  techInitials: string
  techVehicle: string
  eta: number
  customer: string
  address: string
  icon: React.ComponentType<{ className?: string }>
}

const HERO_TRADES: TradePreview[] = [
  {
    id: 'plumbing',
    name: 'Plumbing',
    company: 'ProFlow Plumbing & Rooter',
    slug: 'proflow',
    service: 'Emergency Main Drain Clearing',
    price: '$195',
    duration: '90 mins',
    window: 'Today: 2:00 PM to 4:00 PM',
    tech: 'Marcus Turner',
    techInitials: 'MT',
    techVehicle: 'Service Van #3',
    eta: 12,
    customer: 'Sarah Jenkins',
    address: '742 Evergreen Terrace, Dallas TX',
    icon: Wrench
  },
  {
    id: 'hvac',
    name: 'HVAC',
    company: 'ComfortAir Heating & Air',
    slug: 'comfortair',
    service: '24-Point AC Seasonal Tune-Up',
    price: '$119',
    duration: '60 mins',
    window: 'Tomorrow: 8:30 AM to 10:30 AM',
    tech: 'David Miller',
    techInitials: 'DM',
    techVehicle: 'Rapid Response Truck #1',
    eta: 18,
    customer: 'Robert Vance',
    address: '1428 Elm Creek Parkway, Fort Worth TX',
    icon: Flame
  },
  {
    id: 'electrical',
    name: 'Electrical',
    company: 'VoltLine Electrical & EV',
    slug: 'voltline',
    service: 'Level 2 Universal EV Charger Install',
    price: '$695',
    duration: '3.0 hrs',
    window: 'Today: 4:00 PM to 6:00 PM',
    tech: 'Jason Cole',
    techInitials: 'JC',
    techVehicle: 'Electrician Van #2',
    eta: 8,
    customer: 'Elena Rostova',
    address: '883 Meadow Lark Lane, Plano TX',
    icon: Zap
  },
  {
    id: 'roofing',
    name: 'Roofing',
    company: 'LoneStar Roofing & Gutters',
    slug: 'lonestar',
    service: '18-Point Storm Damage Inspection',
    price: '$0 Free',
    duration: '60 mins',
    window: 'Tomorrow: 1:00 PM to 3:00 PM',
    tech: 'Carlos Vega',
    techInitials: 'CV',
    techVehicle: 'Inspection Truck #4',
    eta: 22,
    customer: 'Michael Scott',
    address: '314 Oak Ridge Boulevard, Arlington TX',
    icon: Home
  },
  {
    id: 'detailing',
    name: 'Auto Detailing',
    company: 'Apex Mobile Detailing & Ceramic',
    slug: 'apex',
    service: 'Full Interior & Exterior Detail',
    price: '$249',
    duration: '2.5 hrs',
    window: 'Today: 2:30 PM to 5:00 PM',
    tech: 'Brian Keller',
    techInitials: 'BK',
    techVehicle: 'Mobile Detailing Trailer',
    eta: 15,
    customer: 'Amanda Lewis',
    address: '512 Northside Drive, Frisco TX',
    icon: Car
  }
]

export function HeroSection({ onOpenClaim }: HeroSectionProps) {
  const [selectedTrade, setSelectedTrade] = useState<string>('plumbing')
  const [mobileView, setMobileView] = useState<'customer' | 'contractor'>('customer')

  const activeTrade = HERO_TRADES.find((t) => t.id === selectedTrade) || HERO_TRADES[0]

  return (
    <section className="relative pt-10 pb-16 sm:pt-18 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Background Subtle Ambient Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-96 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,rgba(37,99,235,0.08),rgba(255,255,255,0))] pointer-events-none" />

      {/* Main Copy Block */}
      <div className="text-center max-w-4xl mx-auto space-y-6 relative z-10">
        
        {/* Eyebrow Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="font-bold tracking-wide uppercase">
            Dedicated Online Booking &amp; Arrival Tracking Software
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.14]">
          The Direct Booking Link and Live Arrival Tracker for{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500">
            Trade Contractors.
          </span>
        </h1>

        {/* Subheadline */}
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Add one simple link to your Google Business Profile and Instagram bio. Let homeowners book available arrival windows without phone tag, track your technician live on a map, and pay on site via Apple Pay.
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
        <div className="pt-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 2-Minute Setup
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Keep Your Existing Phone Number
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Zero Customer App Downloads
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> First 3 Completed Jobs Free
          </span>
        </div>

        {/* Quick Trade Selector */}
        <div className="pt-3">
          <p className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-2">
            Select your trade to preview your live system:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {HERO_TRADES.map((t) => {
              const isSelected = t.id === selectedTrade
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTrade(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Hero Visual: Realistic Dual-Interface Demonstration */}
      <div className="mt-10 sm:mt-14 max-w-5xl mx-auto">
        <div className="rounded-3xl border border-slate-200/90 bg-slate-900 text-white p-4 sm:p-7 shadow-2xl relative overflow-hidden">
          {/* Subtle Ambient Backlights */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar with Live Workflow Status & Mobile View Toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-800 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-mono font-bold text-slate-200 uppercase tracking-wider">
                Live Field System Preview &bull; {activeTrade.company}
              </span>
            </div>

            {/* Mobile View Toggle (visible on small screens only) */}
            <div className="flex lg:hidden items-center bg-slate-800 p-1 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMobileView('customer')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mobileView === 'customer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Customer Phone
              </button>
              <button
                type="button"
                onClick={() => setMobileView('contractor')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  mobileView === 'contractor'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Contractor Dispatch
              </button>
            </div>

            {/* Desktop Stage Indicator */}
            <div className="hidden lg:flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span>1. Customer Books</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span>2. Crew Dispatched</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-emerald-400 font-bold">3. Live GPS Arrival</span>
            </div>
          </div>

          {/* Dual Panel Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
            
            {/* Left Panel: Customer Mobile Booking View (5 Cols) */}
            <div
              className={`lg:col-span-5 bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-lg border border-slate-200 space-y-4 ${
                mobileView === 'contractor' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-wider block">
                    What Homeowners See
                  </span>
                  <p className="text-xs font-bold text-slate-900">
                    book.captodesk.com/{activeTrade.slug}
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Instant Schedule
                </span>
              </div>

              {/* Service Details */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1">
                <div className="flex justify-between items-start">
                  <p className="text-xs font-bold text-blue-950">{activeTrade.service}</p>
                  <span className="text-xs font-mono font-extrabold text-blue-900">{activeTrade.price}</span>
                </div>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-600" />
                  <span>Duration: {activeTrade.duration}</span>
                </p>
              </div>

              {/* Selected Window */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">
                  Requested Arrival Window
                </span>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>{activeTrade.window}</span>
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeTrade.address}</span>
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
            <div
              className={`lg:col-span-7 bg-slate-950 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-4 ${
                mobileView === 'customer' ? 'hidden lg:block' : 'block'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                    Contractor Dispatch Console
                  </span>
                  <p className="text-xs font-bold text-white">
                    {activeTrade.company} &bull; Today&apos;s Route
                  </p>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Active Call
                </span>
              </div>

              {/* Job Card */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-white">{activeTrade.tech} (Assigned Tech)</p>
                    <p className="text-[11px] text-slate-400">
                      Customer: {activeTrade.customer} &bull; {activeTrade.techVehicle}
                    </p>
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
                  <span className="font-mono text-emerald-400 font-bold">
                    ETA {activeTrade.eta} Minutes
                  </span>
                </div>
              </div>

              {/* Action Buttons available on phone in truck */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/50">
                  <span className="text-[10px] font-mono text-blue-400 uppercase block font-bold">1. Tap When Leaving</span>
                  <p className="font-bold text-white mt-0.5">&quot;On My Way&quot;</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Texts live GPS link</p>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/50">
                  <span className="text-[10px] font-mono text-emerald-400 uppercase block font-bold">2. Tap When Finished</span>
                  <p className="font-bold text-white mt-0.5">&quot;Complete Job&quot;</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Collects Apple Pay on site</p>
                </div>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 gap-1">
                <span>Customer payment method: Apple Pay / Card</span>
                <span className="text-emerald-400 font-mono font-semibold">Automatic 5-Star Review Request Ready</span>
              </div>
            </div>

          </div>

          {/* Safety & Google Compliance Bottom Strip */}
          <div className="mt-5 pt-4 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>100% Google Business Profile Safe: Uses standard Booking URL field without API access or passwords.</span>
            </div>
            <button
              type="button"
              onClick={onOpenClaim}
              className="text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Claim this link for your business</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>
    </section>
  )
}
