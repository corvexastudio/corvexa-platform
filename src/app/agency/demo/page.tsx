'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  Search, 
  Plus, 
  ExternalLink, 
  Copy, 
  Check, 
  Phone, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  ArrowUpRight, 
  X,
  Wrench, 
  Flame, 
  Zap, 
  Home, 
  Car,
  Code2, 
  ChevronRight,
  Smartphone,
  CreditCard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandIcon, BrandWordmark } from '@/components/brand/brand-logo'

// Trade Icons & Color Config
const TRADE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  detailing: { label: 'Auto Detailing', icon: Car, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60' },
  plumbing: { label: 'Plumbing & Drain', icon: Wrench, color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60' },
  hvac: { label: 'HVAC', icon: Flame, color: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800/60' },
  roofing: { label: 'Roofing', icon: Home, color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60' },
  electrical: { label: 'Electrical', icon: Zap, color: 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800/60' },
}

interface DemoSlot {
  slot_number: number
  business_name: string
  industry: string
  slug: string
  phone: string
  month_missed_calls: number
  month_jobs_count: number
  month_revenue: number
  city: string
}

const INITIAL_DEMO_SLOTS: DemoSlot[] = [
  {
    slot_number: 1,
    business_name: 'Apex Mobile Detailing & Ceramic',
    industry: 'detailing',
    slug: 'auto-detailing',
    phone: '(469) 820-4102',
    month_missed_calls: 42,
    month_jobs_count: 38,
    month_revenue: 7420,
    city: 'Dallas, TX'
  },
  {
    slot_number: 2,
    business_name: 'ProFlow Plumbing & Rooter',
    industry: 'plumbing',
    slug: 'plumbing',
    phone: '(214) 739-1184',
    month_missed_calls: 56,
    month_jobs_count: 52,
    month_revenue: 14850,
    city: 'Fort Worth, TX'
  },
  {
    slot_number: 3,
    business_name: 'ComfortAir Heating & Air',
    industry: 'hvac',
    slug: 'hvac',
    phone: '(817) 601-9230',
    month_missed_calls: 31,
    month_jobs_count: 41,
    month_revenue: 8920,
    city: 'Arlington, TX'
  },
  {
    slot_number: 4,
    business_name: 'LoneStar Roofing & Gutters',
    industry: 'roofing',
    slug: 'roofing',
    phone: '(972) 419-7023',
    month_missed_calls: 18,
    month_jobs_count: 15,
    month_revenue: 16200,
    city: 'Plano, TX'
  },
  {
    slot_number: 5,
    business_name: 'VoltLine Electrical & EV',
    industry: 'electrical',
    slug: 'electrical',
    phone: '(469) 310-8841',
    month_missed_calls: 24,
    month_jobs_count: 29,
    month_revenue: 9380,
    city: 'Frisco, TX'
  }
]

export default function AgencyDemoDashboard() {
  const [slots, setSlots] = useState<DemoSlot[]>(INITIAL_DEMO_SLOTS)
  const totalCapacitySlots = 10
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTrade, setSelectedTrade] = useState('all')

  // Modals & Drawers
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false)
  const [selectedSlotForEmbed, setSelectedSlotForEmbed] = useState<DemoSlot | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Embed Generator State
  const [embedType, setEmbedType] = useState<'button' | 'pill' | 'iframe'>('button')
  const [utmSource, setUtmSource] = useState('webflow-client-site')
  const [utmCampaign, setUtmCampaign] = useState('summer-schedule')

  // Deploy Form State
  const [newClientName, setNewClientName] = useState('')
  const [newClientTrade, setNewClientTrade] = useState('detailing')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientCity, setNewClientCity] = useState('Austin, TX')

  // Metrics
  const activeSlotsCount = slots.length
  const availableSlotsCount = Math.max(0, totalCapacitySlots - activeSlotsCount)
  const occupancyRate = Math.round((activeSlotsCount / totalCapacitySlots) * 100)
  const totalCallsRecovered = slots.reduce((acc, s) => acc + s.month_missed_calls, 0)
  const totalJobsBooked = slots.reduce((acc, s) => acc + s.month_jobs_count, 0)
  const totalAttributedRevenue = slots.reduce((acc, s) => acc + s.month_revenue, 0)

  function handleCopy(text: string, key: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    }
  }

  function handleResetDemoState() {
    setSlots(INITIAL_DEMO_SLOTS)
    setSearchQuery('')
    setSelectedTrade('all')
  }

  function handleDeploySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newClientName.trim()) return

    const slug = newClientName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
    const nextSlotNum = slots.length + 1
    const newSlot: DemoSlot = {
      slot_number: nextSlotNum,
      business_name: newClientName,
      industry: newClientTrade,
      slug,
      phone: newClientPhone || '(512) 890-2134',
      month_missed_calls: 3,
      month_jobs_count: 5,
      month_revenue: 1100,
      city: newClientCity
    }

    setSlots(prev => [...prev, newSlot])
    setIsDeployModalOpen(false)
    setNewClientName('')
    setNewClientPhone('')
  }

  const filteredSlots = useMemo(() => {
    return slots.filter(slot => {
      if (selectedTrade !== 'all' && slot.industry !== selectedTrade) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        return (
          slot.business_name.toLowerCase().includes(q) ||
          slot.city.toLowerCase().includes(q) ||
          slot.phone.includes(q) ||
          slot.slug.includes(q)
        )
      }
      return true
    })
  }, [slots, selectedTrade, searchQuery])

  const tradeCounts = useMemo(() => {
    return {
      all: slots.length,
      detailing: slots.filter(s => s.industry === 'detailing').length,
      plumbing: slots.filter(s => s.industry === 'plumbing').length,
      hvac: slots.filter(s => s.industry === 'hvac').length,
      roofing: slots.filter(s => s.industry === 'roofing').length,
      electrical: slots.filter(s => s.industry === 'electrical').length,
    }
  }, [slots])

  const currentSlotBookingUrl = selectedSlotForEmbed 
    ? `https://book.captodesk.com/${selectedSlotForEmbed.slug}` 
    : 'https://book.captodesk.com/auto-detailing'
  const taggedBookingUrl = `${currentSlotBookingUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(utmCampaign)}`

  let generatedEmbedCode = ''
  if (embedType === 'button') {
    generatedEmbedCode = `<a href="${taggedBookingUrl}" target="_blank" class="captodesk-book-btn" style="display:inline-flex;align-items:center;padding:12px 24px;background:#059669;color:#ffffff;font-size:15px;font-weight:700;font-family:sans-serif;text-decoration:none;border-radius:8px;">
  Schedule Online
</a>`
  } else if (embedType === 'pill') {
    generatedEmbedCode = `<div style="position:fixed;bottom:20px;right:20px;z-index:999999;">
  <a href="${taggedBookingUrl}" target="_blank" style="display:flex;align-items:center;gap:8px;padding:12px 20px;background:#0f172a;color:#ffffff;border:1px solid #334155;border-radius:9999px;font-weight:700;font-size:14px;font-family:sans-serif;text-decoration:none;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
    <span style="display:inline-block;width:8px;height:8px;background:#10b981;border-radius:50%;"></span>
    Book Online Now
  </a>
</div>`
  } else {
    generatedEmbedCode = `<iframe
  src="${taggedBookingUrl}"
  style="width:100%;max-width:680px;height:820px;border:none;border-radius:12px;display:block;margin:0 auto;"
  title="Online Appointment Booking"
  loading="lazy"
></iframe>`
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      
      {/* TOP HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Left: Brand & Agency Identity */}
            <div className="flex items-center gap-3">
              <Link href="/demo" className="flex items-center gap-2.5 group hover:opacity-95 transition-opacity">
                <BrandIcon className="h-8 w-8 group-hover:scale-105 transition-transform shrink-0" size={32} priority />
                <div className="flex items-center gap-2 leading-none">
                  <BrandWordmark size="text-lg" theme="auto" />
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                    Agency
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center text-slate-400 dark:text-zinc-600 mx-1">
                <ChevronRight className="h-4 w-4" />
              </div>

              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-700 dark:text-zinc-300">
                <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  Summit Digital Media
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                  Scale (10 Slots)
                </span>
              </div>
            </div>

            {/* Center: Navigation */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              <span className="px-3 py-1.5 rounded-md font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white">
                Clients & Slots
              </span>
              <button 
                onClick={() => setIsOutreachModalOpen(true)}
                className="px-3 py-1.5 rounded-md text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors"
              >
                Outreach Demos
              </button>
              <button 
                onClick={() => setSelectedSlotForEmbed(slots[0])}
                className="px-3 py-1.5 rounded-md text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors"
              >
                Client Embeds
              </button>
            </nav>

            {/* Right: Slot Capacity Pill & Theme */}
            <div className="flex items-center gap-3">
              <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-zinc-850/80 border border-slate-200 dark:border-zinc-750">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] gap-4">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Slot Capacity</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                      {activeSlotsCount} / {totalCapacitySlots} Active
                    </span>
                  </div>
                  <div className="w-28 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-500 rounded-full" 
                      style={{ width: `${occupancyRate}%` }}
                    />
                  </div>
                </div>
              </div>

              <ThemeToggle />

              <Link href="/login">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white">
                  Sign In
                </Button>
              </Link>
            </div>

          </div>
        </div>
      </header>

      {/* PERSISTENT INTERACTIVE DEMO BANNER (F-AGY-13) */}
      <aside aria-label="Demo sandbox notice" className="w-full bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/20 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-200">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1">
            <span className="font-mono font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] uppercase tracking-wider shrink-0">
              Interactive Demo / Sample Data
            </span>
            <span className="leading-relaxed">
              Illustrative sandbox: Displayed contractor businesses, call recovery metrics, and revenue are synthetic sample data for demonstration. Activity operates entirely in memory and does not affect production accounts, real phone numbers, or agency analytics.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDemoState}
              className="h-7 px-3 text-[11px] font-semibold bg-white/90 dark:bg-zinc-900/90 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-950/60 shadow-2xs cursor-pointer"
            >
              Reset Demo State
            </Button>
          </div>
        </div>
      </aside>

      {/* MAIN CONSOLE BODY */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {/* Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Client Portfolio & Slots
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
              Monitor call recovery, appointment bookings, and attributed revenue across your contractor accounts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOutreachModalOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-lg border-slate-300 dark:border-zinc-700"
            >
              <Smartphone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Outreach Demos</span>
            </Button>

            <Button
              type="button"
              onClick={() => setIsDeployModalOpen(true)}
              className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs gap-1.5 rounded-lg"
            >
              <Plus className="h-4 w-4" />
              <span>Deploy Client</span>
            </Button>
          </div>
        </div>

        {/* Retainer Defense KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* KPI 1: Slot Capacity */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Slot Capacity</span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-750">
                Scale (10 Slots)
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {activeSlotsCount}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  / {totalCapacitySlots} Active
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden flex">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${occupancyRate}%` }} 
                />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400 font-medium">
              {availableSlotsCount} slots available
            </div>
          </div>

          {/* KPI 2: Missed Calls Recovered */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Sample Calls Recovered</span>
              <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalCallsRecovered}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
              Illustrative (Past 30 days)
            </div>
          </div>

          {/* KPI 3: Booked Jobs */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Sample Booked Appointments</span>
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalJobsBooked}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
              Illustrative (Past 30 days)
            </div>
          </div>

          {/* KPI 4: Attributed Revenue */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Sample Attributed Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                ${totalAttributedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-medium">
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 font-bold font-mono">
                  9.4x ROI
                </span>
                <span>vs retainers</span>
              </span>
            </div>
          </div>

        </div>

        {/* Filter & Search Bar */}
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            <Input
              type="text"
              placeholder="Filter by contractor name, phone, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: `All (${tradeCounts.all})` },
              { id: 'detailing', label: `Detailing (${tradeCounts.detailing})` },
              { id: 'plumbing', label: `Plumbing (${tradeCounts.plumbing})` },
              { id: 'hvac', label: `HVAC (${tradeCounts.hvac})` },
              { id: 'roofing', label: `Roofing (${tradeCounts.roofing})` },
              { id: 'electrical', label: `Electrical (${tradeCounts.electrical})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTrade(tab.id)}
                className={cn(
                  "px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer",
                  selectedTrade === tab.id
                    ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900 shadow-2xs"
                    : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

        </div>

        {/* Master Client Slot Table */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-850/60 text-slate-500 dark:text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 w-16">Slot</th>
                  <th className="py-3 px-4">Contractor & Trade</th>
                  <th className="py-3 px-4">Phone Line</th>
                  <th className="py-3 px-4 text-center">30-Day Activity</th>
                  <th className="py-3 px-4 text-right">Attributed Revenue</th>
                  <th className="py-3 px-4 text-center">Embeds</th>
                  <th className="py-3 px-4 text-right">Workspace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredSlots.map((slot) => {
                  const tradeMeta = TRADE_CONFIG[slot.industry] || TRADE_CONFIG.plumbing
                  const TradeIcon = tradeMeta.icon

                  return (
                    <tr 
                      key={`slot-${slot.slot_number}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-850/50 transition-colors"
                    >
                      {/* Slot Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400 dark:text-zinc-500">
                        #{slot.slot_number.toString().padStart(2, '0')}
                      </td>

                      {/* Contractor & Trade */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {slot.business_name}
                            </span>
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border",
                              tradeMeta.color
                            )}>
                              <TradeIcon className="h-3 w-3" />
                              <span>{tradeMeta.label}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <a 
                              href={`https://book.captodesk.com/${slot.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1"
                            >
                              <span>book.captodesk.com/{slot.slug}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            <button
                              onClick={() => handleCopy(`https://book.captodesk.com/${slot.slug}`, `copy-${slot.slot_number}`)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                              title="Copy link"
                            >
                              {copiedKey === `copy-${slot.slot_number}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Phone Line */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-zinc-300">
                            <Phone className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            <span>{slot.phone}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                            Missed-Call Auto-Text Active
                          </span>
                        </div>
                      </td>

                      {/* 30-Day Activity */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center gap-2 font-mono">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold" title="Missed Calls Auto-Recovered">
                            {slot.month_missed_calls} calls
                          </span>
                          <span className="text-slate-300 dark:text-zinc-600">•</span>
                          <span className="text-slate-800 dark:text-zinc-200 font-bold" title="Booked Jobs">
                            {slot.month_jobs_count} jobs
                          </span>
                        </div>
                      </td>

                      {/* Attributed Revenue */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                          ${slot.month_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">Collected MTD</span>
                      </td>

                      {/* Embed Code Button */}
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSlotForEmbed(slot)}
                          className="h-8 px-2.5 text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 font-mono gap-1 cursor-pointer"
                        >
                          <Code2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                          <span>Embed</span>
                        </Button>
                      </td>

                      {/* Workspace Preview */}
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={`https://app.captodesk.com/demo?trade=${slot.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                        >
                          <span>Workspace</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                        </a>
                      </td>

                    </tr>
                  )
                })}

                {/* Open Slots Row */}
                {availableSlotsCount > 0 && (
                  <tr className="bg-slate-50/50 dark:bg-zinc-850/30 border-t border-dashed border-slate-200 dark:border-zinc-800">
                    <td colSpan={6} className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        {availableSlotsCount} open {availableSlotsCount === 1 ? 'slot' : 'slots'} available
                      </span>
                      <span className="ml-2 text-[11px] text-slate-400 dark:text-zinc-500">
                        in your Scale (10-Slot) wholesale package.
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsDeployModalOpen(true)}
                        className="h-8 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-lg gap-1.5 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>Deploy Client</span>
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* 1-CLICK EMBED DRAWER */}
      <Sheet open={Boolean(selectedSlotForEmbed)} onOpenChange={(open) => !open && setSelectedSlotForEmbed(null)}>
        <SheetContent className="sm:max-w-xl bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-6 overflow-y-auto">
          <SheetHeader className="space-y-1 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-purple-600" />
              <SheetTitle className="text-base font-bold text-slate-900 dark:text-white">
                Client Embed Code Generator
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Generate 1-click booking embed code for <strong>{selectedSlotForEmbed?.business_name}</strong> to drop onto Webflow, WordPress, Squarespace, or Wix.
            </SheetDescription>
          </SheetHeader>

          <div className="py-6 space-y-5">
            
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
                Embed Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEmbedType('button')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    embedType === 'button'
                      ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-750 text-slate-700 dark:text-zinc-300"
                  )}
                >
                  <span className="font-bold text-xs block">Button Link</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Standard link</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmbedType('pill')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    embedType === 'pill'
                      ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-750 text-slate-700 dark:text-zinc-300"
                  )}
                >
                  <span className="font-bold text-xs block">Floating Pill</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Corner widget</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmbedType('iframe')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    embedType === 'iframe'
                      ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300"
                      : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-750 text-slate-700 dark:text-zinc-300"
                  )}
                >
                  <span className="font-bold text-xs block">Iframe</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Inline embed</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-2">
                Attribution Tracking
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">UTM Source</span>
                  <Input 
                    value={utmSource} 
                    onChange={(e) => setUtmSource(e.target.value)}
                    placeholder="webflow-client-site"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 block mb-1">UTM Campaign</span>
                  <Input 
                    value={utmCampaign} 
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="spring-schedule"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Embed Code
                </label>
                <Button
                  size="sm"
                  onClick={() => handleCopy(generatedEmbedCode, 'drawer-code')}
                  className="h-7 px-3 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-slate-900 gap-1.5"
                >
                  {copiedKey === 'drawer-code' ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </Button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed max-h-52">
                {generatedEmbedCode}
              </pre>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
              <div>
                <span className="font-semibold text-xs text-slate-900 dark:text-white block">Test Live Checkout</span>
                <span className="text-[11px] text-slate-500">Opens the booking checkout page</span>
              </div>
              <a 
                href={currentSlotBookingUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="outline" className="h-8 text-xs font-semibold gap-1">
                  <span>Open Checkout</span>
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>

          </div>
        </SheetContent>
      </Sheet>

      {/* DEPLOY CLIENT MODAL */}
      <Dialog open={isDeployModalOpen} onOpenChange={setIsDeployModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:rounded-xl p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" />
              <span>Deploy Client into Available Slot</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Provisions a dedicated trade booking portal, seeds services, and assigns a missed-call line. Uses 1 of your {availableSlotsCount} open slots.
            </DialogDescription>
            <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300">
              <span className="font-semibold">Interactive Demo Sandbox:</span> Simulated in local browser state only. Zero real provisioning calls, carrier charges, or database modifications.
            </div>
          </DialogHeader>

          <form onSubmit={handleDeploySubmit} className="space-y-4 pt-2">
            
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Contractor Business Name <span className="text-emerald-600">*</span>
              </label>
              <Input
                required
                type="text"
                placeholder="e.g. Apex Precision Detailing"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Trade Specialty <span className="text-emerald-600">*</span>
              </label>
              <select
                value={newClientTrade}
                onChange={(e) => setNewClientTrade(e.target.value)}
                className="w-full h-9 text-xs px-3 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-900 dark:text-white"
              >
                <option value="detailing">Auto Detailing</option>
                <option value="plumbing">Plumbing</option>
                <option value="hvac">HVAC</option>
                <option value="roofing">Roofing</option>
                <option value="electrical">Electrical</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Shop Phone
                </label>
                <Input
                  type="text"
                  placeholder="(512) 555-0199"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  City
                </label>
                <Input
                  type="text"
                  placeholder="Austin, TX"
                  value={newClientCity}
                  onChange={(e) => setNewClientCity(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeployModalOpen(false)}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Deploy Client
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* OUTREACH TRADE DEMOS MODAL */}
      <Dialog open={isOutreachModalOpen} onOpenChange={setIsOutreachModalOpen}>
        <DialogContent className="max-w-lg bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:rounded-xl p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Outreach Trade Demos</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Share these pre-built trade booking previews with prospective clients during sales calls.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-4">
            {[
              { trade: 'Auto Detailing', url: 'https://book.captodesk.com/auto-detailing', icon: Car },
              { trade: 'Plumbing', url: 'https://book.captodesk.com/plumbing', icon: Wrench },
              { trade: 'HVAC', url: 'https://book.captodesk.com/hvac', icon: Flame },
              { trade: 'Roofing', url: 'https://book.captodesk.com/roofing', icon: Home },
              { trade: 'Electrical', url: 'https://book.captodesk.com/electrical', icon: Zap },
            ].map((item, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-slate-700 dark:text-zinc-300">
                    <item.icon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-slate-900 dark:text-white block">{item.trade}</span>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <span>{item.url}</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(item.url, `outreach-${idx}`)}
                  className="h-7 px-2.5 text-xs font-medium gap-1"
                >
                  {copiedKey === `outreach-${idx}` ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOutreachModalOpen(false)}
              className="h-8 text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
