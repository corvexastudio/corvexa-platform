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
  ShieldCheck, 
  ArrowUpRight, 
  Sparkles, 
  SlidersHorizontal,
  X,
  Wrench, 
  Flame, 
  Zap, 
  Home, 
  Car,
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  CreditCard,
  Layers,
  ChevronRight,
  TrendingUp,
  Info,
  Smartphone,
  Star,
  Lock,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  hvac: { label: 'HVAC & AC', icon: Flame, color: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800/60' },
  roofing: { label: 'Roofing & Gutters', icon: Home, color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60' },
  electrical: { label: 'Electrical & EV', icon: Zap, color: 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800/60' },
}

interface DemoSlot {
  slot_number: number
  business_name: string
  industry: string
  slug: string
  live_booking_url: string
  demo_outreach_url: string
  contractor_dashboard_url: string
  phone: string
  owner_name: string
  month_missed_calls: number
  month_jobs_count: number
  month_revenue: number
  client_retainer: number
  wholesale_cost: number
  net_margin: number
  city: string
  is_active: boolean
}

const INITIAL_DEMO_SLOTS: DemoSlot[] = [
  {
    slot_number: 1,
    business_name: 'Apex Mobile Detailing & Ceramic',
    industry: 'detailing',
    slug: 'apex-detailing',
    live_booking_url: 'https://book.captodesk.com/auto-detailing',
    demo_outreach_url: 'https://book.captodesk.com/auto-detailing',
    contractor_dashboard_url: 'https://app.captodesk.com/demo?trade=auto-detailing',
    phone: '(469) 820-4102',
    owner_name: 'Marcus Vance',
    month_missed_calls: 42,
    month_jobs_count: 38,
    month_revenue: 7420,
    client_retainer: 149,
    wholesale_cost: 49,
    net_margin: 100,
    city: 'Dallas, TX',
    is_active: true
  },
  {
    slot_number: 2,
    business_name: 'ProFlow Plumbing & Rooter',
    industry: 'plumbing',
    slug: 'proflow-plumbing',
    live_booking_url: 'https://book.captodesk.com/plumbing',
    demo_outreach_url: 'https://book.captodesk.com/plumbing',
    contractor_dashboard_url: 'https://app.captodesk.com/demo?trade=plumbing',
    phone: '(214) 739-1184',
    owner_name: 'Dave Miller',
    month_missed_calls: 56,
    month_jobs_count: 52,
    month_revenue: 14850,
    client_retainer: 149,
    wholesale_cost: 49,
    net_margin: 100,
    city: 'Fort Worth, TX',
    is_active: true
  },
  {
    slot_number: 3,
    business_name: 'ComfortAir Heating & Air',
    industry: 'hvac',
    slug: 'comfortair-hvac',
    live_booking_url: 'https://book.captodesk.com/hvac',
    demo_outreach_url: 'https://book.captodesk.com/hvac',
    contractor_dashboard_url: 'https://app.captodesk.com/demo?trade=hvac',
    phone: '(817) 601-9230',
    owner_name: 'Carlos Reyes',
    month_missed_calls: 31,
    month_jobs_count: 41,
    month_revenue: 8920,
    client_retainer: 149,
    wholesale_cost: 49,
    net_margin: 100,
    city: 'Arlington, TX',
    is_active: true
  },
  {
    slot_number: 4,
    business_name: 'LoneStar Roofing & Gutters',
    industry: 'roofing',
    slug: 'lonestar-roofing',
    live_booking_url: 'https://book.captodesk.com/roofing',
    demo_outreach_url: 'https://book.captodesk.com/roofing',
    contractor_dashboard_url: 'https://app.captodesk.com/demo?trade=roofing',
    phone: '(972) 419-7023',
    owner_name: 'Brett Hall',
    month_missed_calls: 18,
    month_jobs_count: 15,
    month_revenue: 16200,
    client_retainer: 149,
    wholesale_cost: 49,
    net_margin: 100,
    city: 'Plano, TX',
    is_active: true
  },
  {
    slot_number: 5,
    business_name: 'VoltLine Electrical & EV',
    industry: 'electrical',
    slug: 'voltline-electric',
    live_booking_url: 'https://book.captodesk.com/electrical',
    demo_outreach_url: 'https://book.captodesk.com/electrical',
    contractor_dashboard_url: 'https://app.captodesk.com/demo?trade=electrical',
    phone: '(469) 310-8841',
    owner_name: 'James Chen',
    month_missed_calls: 24,
    month_jobs_count: 29,
    month_revenue: 9380,
    client_retainer: 149,
    wholesale_cost: 49,
    net_margin: 100,
    city: 'Frisco, TX',
    is_active: true
  }
]

export default function AgencyDemoDashboard() {
  const [slots, setSlots] = useState<DemoSlot[]>(INITIAL_DEMO_SLOTS)
  const [totalCapacitySlots] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTrade, setSelectedTrade] = useState('all')

  // Modals & Drawers
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [isOutreachModalOpen, setIsOutreachModalOpen] = useState(false)
  const [isCalculatorModalOpen, setIsCalculatorModalOpen] = useState(false)
  const [selectedSlotForEmbed, setSelectedSlotForEmbed] = useState<DemoSlot | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Embed Generator State
  const [embedType, setEmbedType] = useState<'button' | 'pill' | 'iframe'>('button')
  const [utmSource, setUtmSource] = useState('webflow-client-site')
  const [utmCampaign, setUtmCampaign] = useState('spring-promo')

  // Deploy Client Form State
  const [newClientName, setNewClientName] = useState('')
  const [newClientTrade, setNewClientTrade] = useState('detailing')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [newClientCity, setNewClientCity] = useState('Austin, TX')

  // Margin Calculator State
  const [calcClients, setCalcClients] = useState(10)
  const [calcRetainer, setCalcRetainer] = useState(149)
  const calcWholesale = 49
  const calcNetMRR = calcClients * (calcRetainer - calcWholesale)
  const calcNetARR = calcNetMRR * 12

  // Summary Metrics
  const activeSlotsCount = slots.length
  const availableSlotsCount = Math.max(0, totalCapacitySlots - activeSlotsCount)
  const occupancyRate = Math.round((activeSlotsCount / totalCapacitySlots) * 100)
  const totalCallsRecovered = slots.reduce((acc, s) => acc + s.month_missed_calls, 0)
  const totalJobsBooked = slots.reduce((acc, s) => acc + s.month_jobs_count, 0)
  const totalAttributedRevenue = slots.reduce((acc, s) => acc + s.month_revenue, 0)
  const totalNetMargin = slots.reduce((acc, s) => acc + s.net_margin, 0)

  // Copy helper
  function handleCopy(text: string, key: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    }
  }

  // Handle Deploy Simulation
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
      live_booking_url: `https://book.captodesk.com/${slug}`,
      demo_outreach_url: `https://book.captodesk.com/${newClientTrade}`,
      contractor_dashboard_url: `https://app.captodesk.com/demo?trade=${newClientTrade}`,
      phone: newClientPhone || '(512) 890-2134',
      owner_name: 'New Contractor Client',
      month_missed_calls: 4,
      month_jobs_count: 6,
      month_revenue: 1250,
      client_retainer: 149,
      wholesale_cost: 49,
      net_margin: 100,
      city: newClientCity,
      is_active: true
    }

    setSlots(prev => [...prev, newSlot])
    setIsDeployModalOpen(false)
    setNewClientName('')
    setNewClientPhone('')
  }

  // Filter slots
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

  // Active trade counts
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

  // Construct embed code for selected slot
  const currentSlotBookingUrl = selectedSlotForEmbed?.live_booking_url || 'https://book.captodesk.com/auto-detailing'
  const taggedBookingUrl = `${currentSlotBookingUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(utmCampaign)}`

  let generatedEmbedCode = ''
  if (embedType === 'button') {
    generatedEmbedCode = `<!-- CaptoDesk 1-Click Booking Button -->
<a href="${taggedBookingUrl}" 
   target="_blank" 
   class="captodesk-book-btn" 
   style="display:inline-flex;align-items:center;justify-content:center;padding:12px 24px;background:#059669;color:#ffffff;font-size:15px;font-weight:700;font-family:-apple-system,sans-serif;text-decoration:none;border-radius:8px;box-shadow:0 4px 12px rgba(5,150,105,0.25);">
  📅 Schedule Online in 45s
</a>`
  } else if (embedType === 'pill') {
    generatedEmbedCode = `<!-- CaptoDesk Floating Booking Pill (Bottom-Right) -->
<div style="position:fixed;bottom:20px;right:20px;z-index:999999;">
  <a href="${taggedBookingUrl}" 
     target="_blank" 
     style="display:flex;align-items:center;gap:8px;padding:12px 20px;background:#0f172a;color:#ffffff;border:1px solid #334155;border-radius:9999px;font-weight:700;font-size:14px;font-family:sans-serif;text-decoration:none;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
    <span style="display:inline-block;width:9px;height:9px;background:#10b981;border-radius:50%;"></span>
    Book Online Now
  </a>
</div>`
  } else {
    generatedEmbedCode = `<!-- CaptoDesk Responsive Iframe -->
<iframe src="${taggedBookingUrl}" 
        style="width:100%;max-width:680px;height:780px;border:none;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.08);display:block;margin:0 auto;" 
        title="Online Booking Portal" 
        allow="payment">
</iframe>`
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200 transition-colors">
      
      {/* DEMO NOTICE HEADER BAR */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white text-xs font-medium px-4 py-2 border-b border-emerald-500/40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white hover:bg-white/30 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border-0">
              Interactive Demo
            </Badge>
            <span>
              <strong>Agency Partner Console:</strong> You are test-driving the live agency dashboard. All client slots, booking links, and embed generators below are fully functional.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCalculatorModalOpen(true)}
              className="text-emerald-100 hover:text-white underline font-semibold text-xs flex items-center gap-1"
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Profit Calculator</span>
            </button>
            <span>•</span>
            <Link 
              href="/login" 
              className="text-white hover:text-emerald-100 font-bold underline"
            >
              Sign In to Real Console ↗
            </Link>
          </div>
        </div>
      </div>

      {/* TOPMOST CONSOLE HEADER */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Left: Agency Wordmark & Agency Selector */}
            <div className="flex items-center gap-3">
              <Link href="/demo" className="flex items-center gap-2.5 group">
                <BrandIcon className="h-8 w-8 group-hover:scale-105 transition-transform shrink-0" size={32} priority />
                <div className="flex items-center gap-2 leading-none">
                  <BrandWordmark size="text-lg" theme="auto" />
                  <span className="text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 font-semibold">
                    Agency Partner
                  </span>
                </div>
              </Link>

              <div className="hidden md:flex items-center text-slate-400 dark:text-zinc-600 mx-1">
                <ChevronRight className="h-4 w-4" />
              </div>

              {/* Active Agency Identity Pill */}
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-xs text-slate-700 dark:text-zinc-300">
                <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
                <span className="font-semibold text-slate-900 dark:text-white">
                  Summit Digital Media
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 font-bold">
                  Scale Partner (10 Slots)
                </span>
              </div>
            </div>

            {/* Right: Capacity Pill, ThemeToggle & Actions */}
            <div className="flex items-center gap-3">
              
              {/* Capacity Progress Pill */}
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
                <div className="border-l border-slate-200 dark:border-zinc-700 pl-2.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {availableSlotsCount} open
                </div>
              </div>

              {/* Contractor Software Demo Quick Jump */}
              <a
                href="https://app.captodesk.com/demo"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                title="Open sample contractor client workspace"
              >
                <span>Contractor Dashboard</span>
                <ExternalLink className="h-3 w-3 text-slate-400" />
              </a>

              <ThemeToggle />

              <a href="mailto:shanta@captodesk.com?subject=Agency%20Partner%20Inquiry%20-%20CaptoDesk">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-9 text-xs shadow-xs">
                  Become a Partner
                </Button>
              </a>
            </div>

          </div>
        </div>
      </header>

      {/* SUB-HEADER / TAB NAVIGATION BAR */}
      <div className="border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-2">
            
            <div className="flex items-center gap-1 sm:gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                <span>Clients & Slots</span>
                <span className="font-mono text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded font-extrabold">
                  {slots.length}
                </span>
              </button>

              <button 
                onClick={() => setIsOutreachModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-850"
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Outreach Trade Demos</span>
              </button>

              <button 
                onClick={() => {
                  setSelectedSlotForEmbed(slots[0])
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-850"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Client Embeds</span>
              </button>

              <button 
                onClick={() => setIsCalculatorModalOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-850"
              >
                <DollarSign className="h-3.5 w-3.5" />
                <span>Capacity & Retainer Margin</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
              <span className="hidden md:inline">Wholesale Cost:</span>
              <strong className="text-emerald-600 font-bold">$49/mo per slot</strong>
            </div>

          </div>
        </div>
      </div>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        
        {/* Page Title & Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
              <span>Client Portfolio & Slots</span>
              <Badge variant="outline" className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                Live Agency Console
              </Badge>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Monitor missed-call recovery, appointment bookings, and attributed revenue across your agency's contractor accounts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOutreachModalOpen(true)}
              className="h-9 px-3.5 text-xs font-semibold gap-1.5 rounded-lg border-slate-300 dark:border-zinc-700"
            >
              <Smartphone className="h-3.5 w-3.5 text-blue-600" />
              <span>Outreach Demo Links</span>
            </Button>

            <Button
              type="button"
              onClick={() => setIsDeployModalOpen(true)}
              className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs gap-1.5 rounded-lg cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Deploy Client Slot</span>
            </Button>
          </div>
        </div>

        {/* Retainer Defense KPI Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* KPI 1: Slot Capacity */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Slot Capacity</span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-bold">
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
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400 font-medium flex items-center justify-between">
              <span>{availableSlotsCount} slots available</span>
              <span className="text-emerald-600 font-bold">+$100/mo margin/slot</span>
            </div>
          </div>

          {/* KPI 2: Missed Calls Recovered */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Calls Auto-Recovered</span>
              <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalCallsRecovered}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
              <span>Past 30 days</span>
              <span className="text-emerald-600 font-semibold font-mono">5-sec SMS trigger</span>
            </div>
          </div>

          {/* KPI 3: Booked Jobs */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Appointments Booked</span>
              <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {totalJobsBooked}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
              <span>Direct web checkouts</span>
              <span className="text-blue-600 font-semibold font-mono">45-sec average</span>
            </div>
          </div>

          {/* KPI 4: Attributed Revenue */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
              <span>Attributed Client Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-3">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                ${totalAttributedRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center justify-between">
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-bold font-mono">
                9.4x ROI
              </span>
              <span className="text-slate-500">vs web retainers</span>
            </div>
          </div>

        </div>

        {/* Filter & Search Toolbar */}
        <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
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

          {/* Trade Filter Pills */}
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
                  <th className="py-3 px-4 w-14">Slot</th>
                  <th className="py-3 px-4">Contractor Client & Trade</th>
                  <th className="py-3 px-4">Booking Links (Live vs Demo)</th>
                  <th className="py-3 px-4 text-center">30-Day Activity</th>
                  <th className="py-3 px-4 text-right">Attributed Rev</th>
                  <th className="py-3 px-4 text-center">Webflow Embed</th>
                  <th className="py-3 px-4 text-right">Client Software</th>
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
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span>{slot.city}</span>
                            <span>•</span>
                            <span className="font-mono">{slot.phone}</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">Billed: ${slot.client_retainer}/mo (+${slot.net_margin} net)</span>
                          </div>
                        </div>
                      </td>

                      {/* Booking Links: Both Live and Outreach Demo */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          
                          {/* Live Assigned Client Link */}
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800">
                              Live
                            </Badge>
                            <a 
                              href={slot.live_booking_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                              title="Live production link assigned to this client"
                            >
                              <span>book.captodesk.com/{slot.slug}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                            <button
                              onClick={() => handleCopy(slot.live_booking_url, `live-${slot.slot_number}`)}
                              className="text-slate-400 hover:text-slate-600 p-0.5"
                              title="Copy live booking link"
                            >
                              {copiedKey === `live-${slot.slot_number}` ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>

                          {/* Outreach Pitch Demo Link */}
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                              Pitch Demo
                            </Badge>
                            <a 
                              href={slot.demo_outreach_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-[11px] text-slate-600 dark:text-zinc-400 hover:underline flex items-center gap-1"
                              title="Use on sales calls with prospects"
                            >
                              <span>book.captodesk.com/{slot.industry}</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>

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
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">MTD Verified</span>
                      </td>

                      {/* Embed Code Trigger */}
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSlotForEmbed(slot)}
                          className="h-8 px-2.5 text-xs text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 font-mono gap-1 cursor-pointer"
                          title="Get 1-click Webflow / WordPress embed snippet"
                        >
                          <Code2 className="h-3.5 w-3.5 text-purple-600" />
                          <span>Embed</span>
                        </Button>
                      </td>

                      {/* Client Software Preview (No Login Required) */}
                      <td className="py-3.5 px-4 text-right">
                        <a
                          href={slot.contractor_dashboard_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-slate-900 transition-colors shadow-2xs"
                          title="Open contractor dispatch & calendar dashboard preview"
                        >
                          <span>Client App</span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                        </a>
                      </td>

                    </tr>
                  )
                })}

                {/* Open Slots Notice & Add Client Trigger */}
                {availableSlotsCount > 0 && (
                  <tr className="bg-slate-50/50 dark:bg-zinc-850/30 border-t border-dashed border-slate-200 dark:border-zinc-800">
                    <td colSpan={6} className="py-3.5 px-4 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">
                        {availableSlotsCount} open {availableSlotsCount === 1 ? 'slot' : 'slots'} available
                      </span>
                      <span className="ml-2 text-[11px] text-slate-400 dark:text-zinc-500">
                        in your Scale (10-Slot) wholesale package.
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsDeployModalOpen(true)}
                        className="h-8 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-lg gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Deploy Client</span>
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agency Value Guarantee Banner */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Zero Dev Maintenance & Complete Client Privacy
              </h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed max-w-2xl">
                Your agency collects $100–$150/mo per client slot on autopilot. Our onboarding team configures your client's menu, Stripe account, and calendar within 24 hours, and handles all ongoing tech support.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsCalculatorModalOpen(true)}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Calculate Retainer Margin
            </button>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <a 
              href="mailto:shanta@captodesk.com?subject=Agency%20Partner%20Walkthrough"
              className="inline-flex items-center gap-1 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3.5 py-2 rounded-lg"
            >
              <span>Schedule 5-Min Walkthrough</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

      </main>

      {/* 1-CLICK WEBFLOW / WORDPRESS EMBED DRAWER */}
      <Sheet open={Boolean(selectedSlotForEmbed)} onOpenChange={(open) => !open && setSelectedSlotForEmbed(null)}>
        <SheetContent className="sm:max-w-xl bg-white dark:bg-zinc-900 border-l border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 p-6 overflow-y-auto">
          <SheetHeader className="space-y-1 pb-4 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-purple-600" />
              <SheetTitle className="text-lg font-bold text-slate-900 dark:text-white">
                Client Embed Code Generator
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Generate 1-click embed code for <strong>{selectedSlotForEmbed?.business_name}</strong> to drop onto Webflow, WordPress, Squarespace, or Wix.
            </SheetDescription>
          </SheetHeader>

          <div className="py-6 space-y-6">
            
            {/* Embed Format Switcher */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block mb-2">
                1. Select Embed Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setEmbedType('button')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    embedType === 'button'
                      ? "bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-300"
                      : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                  )}
                >
                  <span className="font-bold text-xs block">Button Link</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Recommended for navbars & hero sections</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmbedType('pill')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    embedType === 'pill'
                      ? "bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-300"
                      : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                  )}
                >
                  <span className="font-bold text-xs block">Floating Pill</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Sticks to bottom corner on mobile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEmbedType('iframe')}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all",
                    embedType === 'iframe'
                      ? "bg-purple-50 dark:bg-purple-950/50 border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-300"
                      : "bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300"
                  )}
                >
                  <span className="font-bold text-xs block">Full Iframe</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">Embedded booking container</span>
                </button>
              </div>
            </div>

            {/* Campaign UTM Attribution */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider block mb-2">
                2. Attribution Tracking (Optional)
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

            {/* Code Output Box */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                  3. Copy & Paste into CMS
                </label>
                <Button
                  size="sm"
                  onClick={() => handleCopy(generatedEmbedCode, 'drawer-code')}
                  className="h-7 px-3 text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white gap-1.5 shadow-xs"
                >
                  {copiedKey === 'drawer-code' ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
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

              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto border border-slate-800 leading-relaxed max-h-56">
                  {generatedEmbedCode}
                </pre>
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Works directly inside Webflow Embed elements, WordPress Custom HTML blocks, Squarespace Code blocks, and Wix HTML components.
              </p>
            </div>

            {/* Test Drive Button */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">Test Live Booking Experience</span>
                <span className="text-[11px] text-slate-500">Opens the actual customer checkout flow</span>
              </div>
              <a 
                href={selectedSlotForEmbed?.live_booking_url}
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

      {/* DEPLOY CLIENT SIMULATION MODAL */}
      <Dialog open={isDeployModalOpen} onOpenChange={setIsDeployModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:rounded-xl p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600" />
              <span>Deploy Client into Available Slot</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Provisions a dedicated trade booking portal, seeds trade packages, and assigns a missed-call line. Uses 1 of your {availableSlotsCount} open capacity slots.
            </DialogDescription>
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
                <option value="detailing">Auto Detailing & Mobile Wash</option>
                <option value="plumbing">Plumbing & Drain Cleaning</option>
                <option value="hvac">HVAC & Heating/Air</option>
                <option value="roofing">Roofing & Gutters</option>
                <option value="electrical">Electrical & EV Chargers</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Shop / Owner Phone
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
                  City / Market
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

            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Instant Auto-Provisioning</span>
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                When deployed, CaptoDesk automatically generates their production slug, connects missed-call SMS forwarding, and provisions their private contractor workspace.
              </p>
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
                className="h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                Simulate Client Deploy
              </Button>
            </DialogFooter>

          </form>
        </DialogContent>
      </Dialog>

      {/* OUTREACH TRADE DEMO LINKS MODAL */}
      <Dialog open={isOutreachModalOpen} onOpenChange={setIsOutreachModalOpen}>
        <DialogContent className="max-w-xl bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:rounded-xl p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-blue-600" />
              <span>Pre-Built Trade Demo Links for Sales Outreach</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Copy these ready-to-use trade previews when pitching prospective contractor clients on sales calls. They can experience the checkout flow on their phone before you even deploy a slot.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {[
              { trade: 'Auto Detailing & Wash', url: 'https://book.captodesk.com/auto-detailing', icon: Car, color: 'text-emerald-600' },
              { trade: 'Plumbing & Drain Cleaning', url: 'https://book.captodesk.com/plumbing', icon: Wrench, color: 'text-blue-600' },
              { trade: 'HVAC & AC Repair', url: 'https://book.captodesk.com/hvac', icon: Flame, color: 'text-orange-600' },
              { trade: 'Roofing & Gutters', url: 'https://book.captodesk.com/roofing', icon: Home, color: 'text-amber-600' },
              { trade: 'Electrical & EV Chargers', url: 'https://book.captodesk.com/electrical', icon: Zap, color: 'text-cyan-600' },
            ].map((item, idx) => (
              <div 
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 flex items-center justify-center">
                    <item.icon className={cn("w-4 h-4", item.color)} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">{item.trade}</span>
                    <a 
                      href={item.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
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
              onClick={() => setIsOutreachModalOpen(false)}
              className="h-8 text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RETAINER MARGIN CALCULATOR MODAL */}
      <Dialog open={isCalculatorModalOpen} onOpenChange={setIsCalculatorModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:rounded-xl p-6 shadow-xl">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span>Agency Retainer Profit Calculator</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Calculate your recurring monthly retainer profit across your contractor client roster.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            
            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span>Contractor Clients:</span>
                <span className="text-emerald-600 text-sm font-extrabold">{calcClients} Clients</span>
              </div>
              <input 
                type="range" 
                min={1} 
                max={50} 
                value={calcClients} 
                onChange={(e) => setCalcClients(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>1 client</span>
                <span>25 clients</span>
                <span>50 clients</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
                <span>Your Monthly Client Retainer:</span>
                <span className="text-emerald-600 text-sm font-extrabold">${calcRetainer} / mo</span>
              </div>
              <input 
                type="range" 
                min={99} 
                max={249} 
                step={10}
                value={calcRetainer} 
                onChange={(e) => setCalcRetainer(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
                <span>$99/mo (standard)</span>
                <span>$149/mo (popular)</span>
                <span>$249/mo (premium)</span>
              </div>
            </div>

            {/* Profit Card */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white text-center shadow-lg">
              <span className="text-[11px] uppercase tracking-wider font-extrabold text-emerald-200">
                Net Monthly Recurring Profit (MRR)
              </span>
              <div className="text-3xl sm:text-4xl font-black mt-1">
                ${calcNetMRR.toLocaleString()} <span className="text-lg font-normal text-emerald-200">/ mo</span>
              </div>
              <p className="text-emerald-100 text-xs mt-1">
                Annualized Run-Rate: <strong>${calcNetARR.toLocaleString()} / year</strong>
              </p>
              <div className="mt-3 pt-3 border-t border-emerald-500/40 text-[11px] text-emerald-100">
                Wholesale Cost: ${calcWholesale}/mo • Your Margin: +${calcRetainer - calcWholesale}/mo per client
              </div>
            </div>

          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setIsCalculatorModalOpen(false)}
              className="w-full h-9 text-xs font-bold bg-slate-900 dark:bg-zinc-100 text-white dark:text-slate-900"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
