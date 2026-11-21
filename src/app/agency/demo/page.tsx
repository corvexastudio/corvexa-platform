'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  ExternalLink, 
  Copy, 
  Check, 
  Layers, 
  Sparkles, 
  ShieldCheck, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  Smartphone, 
  Globe, 
  CheckCircle2, 
  Code2, 
  ArrowRight, 
  ChevronRight, 
  Wrench, 
  Flame, 
  Zap, 
  Home, 
  Car, 
  SlidersHorizontal,
  Star,
  Lock,
  Shield,
  HelpCircle,
  Clock,
  Send,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandIcon, BrandWordmark } from '@/components/brand/brand-logo'

// Pre-configured trade demo verticals
const TRADE_DEMOS = [
  {
    id: 'auto-detailing',
    name: 'Auto Detailing & Wash',
    icon: Car,
    color: 'emerald',
    badge: 'High Conversion',
    bookingUrl: 'https://book.captodesk.com/auto-detailing',
    dashboardUrl: 'https://app.captodesk.com/demo?trade=auto-detailing',
    samplePackages: 'Full Interior + Exterior, Ceramic Coating, Maintenance Wash',
    avgTicket: '$180 – $350'
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Drain Cleaning',
    icon: Wrench,
    color: 'blue',
    badge: 'High Demand',
    bookingUrl: 'https://book.captodesk.com/plumbing',
    dashboardUrl: 'https://app.captodesk.com/demo?trade=plumbing',
    samplePackages: 'Drain Clearing, Water Heater Diagnostic, Leak Detection',
    avgTicket: '$150 – $450'
  },
  {
    id: 'hvac',
    name: 'HVAC & AC Repair',
    icon: Flame,
    color: 'orange',
    badge: 'Seasonal Spikes',
    bookingUrl: 'https://book.captodesk.com/hvac',
    dashboardUrl: 'https://app.captodesk.com/demo?trade=hvac',
    samplePackages: 'Summer AC Tune-Up, Diagnostic Service Call, Filter Refresh',
    avgTicket: '$120 – $280'
  },
  {
    id: 'roofing',
    name: 'Roofing & Gutters',
    icon: Home,
    color: 'amber',
    badge: 'High Ticket',
    bookingUrl: 'https://book.captodesk.com/roofing',
    dashboardUrl: 'https://app.captodesk.com/demo?trade=roofing',
    samplePackages: 'Storm Damage Inspection, Gutter Flush, Skylight Check',
    avgTicket: '$250 – $1,200'
  },
  {
    id: 'electrical',
    name: 'Electrical & EV Chargers',
    icon: Zap,
    color: 'cyan',
    badge: 'Trending Vertical',
    bookingUrl: 'https://book.captodesk.com/electrical',
    dashboardUrl: 'https://app.captodesk.com/demo?trade=electrical',
    samplePackages: 'Level 2 EV Charger Install, Panel Diagnostic, Outlet Recalibration',
    avgTicket: '$200 – $600'
  }
]

export default function AgencyDemoPage() {
  const [selectedTrade, setSelectedTrade] = useState(TRADE_DEMOS[0])
  const [activeTab, setActiveTab] = useState<'checkout' | 'contractor' | 'agency'>('checkout')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  
  // Embed Code Generator State
  const [embedType, setEmbedType] = useState<'button' | 'pill' | 'iframe'>('button')
  const [utmSource, setUtmSource] = useState('webflow-client-site')
  const [utmCampaign, setUtmCampaign] = useState('summer-schedule')

  // Margin Calculator State
  const [clientCount, setClientCount] = useState<number>(10)
  const [clientPrice, setClientPrice] = useState<number>(149)
  const wholesaleCost = 49
  const monthlyProfitPerClient = clientPrice - wholesaleCost
  const totalMonthlyNetProfit = clientCount * monthlyProfitPerClient
  const totalAnnualNetProfit = totalMonthlyNetProfit * 12

  function handleCopy(text: string, key: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    }
  }

  // Construct dynamic embed code
  const currentBookingUrl = selectedTrade.bookingUrl
  const taggedUrl = `${currentBookingUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(utmCampaign)}`
  
  let generatedSnippet = ''
  if (embedType === 'button') {
    generatedSnippet = `<!-- CaptoDesk 1-Click Booking Button -->
<a href="${taggedUrl}" 
   target="_blank" 
   class="captodesk-book-btn" 
   style="display:inline-flex;align-items:center;justify-content:center;padding:14px 28px;background:#059669;color:#ffffff;font-size:16px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,sans-serif;text-decoration:none;border-radius:10px;box-shadow:0 4px 14px rgba(5,150,105,0.3);transition:transform 0.15s ease;">
  📅 Schedule Online in 45s
</a>`
  } else if (embedType === 'pill') {
    generatedSnippet = `<!-- CaptoDesk Floating Booking Pill (Bottom Right) -->
<div style="position:fixed;bottom:24px;right:24px;z-index:999999;">
  <a href="${taggedUrl}" 
     target="_blank" 
     style="display:flex;align-items:center;gap:10px;padding:14px 22px;background:#0f172a;color:#ffffff;border:1px solid #334155;border-radius:9999px;font-weight:700;font-size:15px;font-family:sans-serif;text-decoration:none;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);">
    <span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:50%;"></span>
    Book Online Now
  </a>
</div>`
  } else {
    generatedSnippet = `<!-- CaptoDesk Responsive Embed Container -->
<div style="width:100%;max-width:680px;margin:0 auto;overflow:hidden;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);">
  <iframe src="${taggedUrl}" 
          style="width:100%;height:780px;border:none;display:block;" 
          title="Online Booking Portal"
          allow="payment">
  </iframe>
</div>`
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200 transition-colors">
      
      {/* Topmost Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            
            {/* Left Brand & Badge */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 group">
                <BrandIcon className="w-8 h-8 transition-transform group-hover:scale-105" />
                <BrandWordmark className="text-xl" />
              </Link>
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-zinc-800">
                <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                  Agency Partner Hub
                </Badge>
              </div>
            </div>

            {/* Quick Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-zinc-400">
              <button 
                onClick={() => { setActiveTab('checkout'); document.getElementById('ecosystem-viewer')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
              >
                1. Customer Checkout
              </button>
              <button 
                onClick={() => { setActiveTab('contractor'); document.getElementById('ecosystem-viewer')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
              >
                2. Contractor Dashboard
              </button>
              <button 
                onClick={() => { setActiveTab('agency'); document.getElementById('ecosystem-viewer')?.scrollIntoView({ behavior: 'smooth' }); }}
                className="hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
              >
                3. Agency Console & Margins
              </button>
              <a 
                href="#margin-calculator" 
                className="hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
              >
                Calculator
              </a>
              <a 
                href="#agency-faq" 
                className="hover:text-slate-900 dark:hover:text-zinc-100 transition-colors"
              >
                FAQ
              </a>
            </nav>

            {/* Right CTAs */}
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href="/login">
                <Button variant="ghost" size="sm" className="font-semibold text-slate-700 dark:text-zinc-300">
                  Sign In
                </Button>
              </Link>
              <a href="mailto:shanta@captodesk.com?subject=Agency%20Partner%20Inquiry%20-%20CaptoDesk">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm shadow-emerald-600/20">
                  Become a Partner
                </Button>
              </a>
            </div>

          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 border-b border-slate-200 dark:border-zinc-800 bg-gradient-to-b from-white via-slate-50 to-slate-100 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm font-semibold mb-6">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <span>Interactive 360° Partner Overview & Demo Links</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 dark:text-white max-w-4xl mx-auto leading-tight">
            Turnkey Online Booking & Dispatch for Your Contractor Clients
          </h1>

          <p className="mt-5 text-base sm:text-lg lg:text-xl text-slate-600 dark:text-zinc-400 max-w-3xl mx-auto leading-relaxed">
            Add instant online booking and automated SMS dispatch to your Webflow, WordPress, or custom client builds in under 60 seconds. <strong className="text-slate-900 dark:text-zinc-100 font-semibold">You keep $100–$150/mo in recurring retainer profit per client</strong>, while our team handles 100% of client onboarding and tech support.
          </p>

          {/* Key Value Prop Pills */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-3 sm:gap-4 text-xs sm:text-sm font-medium">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-800 dark:text-zinc-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Wholesale: <strong>$49/mo</strong> per client</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-800 dark:text-zinc-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Recommended Retainer: <strong>$149/mo</strong></span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold shadow-sm">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>+$100/mo Net Recurring Profit per Client</span>
            </div>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-sm text-slate-800 dark:text-zinc-200">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Zero Dev Maintenance (We Support It)</span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              onClick={() => { setActiveTab('checkout'); document.getElementById('ecosystem-viewer')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="w-full sm:w-auto h-12 px-7 text-base font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-lg"
            >
              Explore 360° Ecosystem Below
              <ChevronRight className="w-5 h-5 ml-2" />
            </Button>
            <a 
              href="https://app.captodesk.com/demo" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full h-12 px-7 text-base font-semibold border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-900"
              >
                Test Drive Contractor Dashboard (No Login)
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>

        </div>
      </section>

      {/* 360 Ecosystem Navigator Section */}
      <section id="ecosystem-viewer" className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        
        <div className="text-center max-w-3xl mx-auto mb-10">
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 mb-3">
            The 3-Way Ecosystem
          </Badge>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            How the 3 Pieces Connect Together
          </h2>
          <p className="mt-3 text-slate-600 dark:text-zinc-400 text-sm sm:text-base">
            Select an ecosystem layer below to see live links, interactive previews, and code snippets.
          </p>
        </div>

        {/* Top Switcher Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-1.5 rounded-2xl bg-slate-200/80 dark:bg-zinc-900/80 border border-slate-300/80 dark:border-zinc-800 max-w-4xl mx-auto mb-10">
          
          <button
            onClick={() => setActiveTab('checkout')}
            className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'checkout'
                ? 'bg-white dark:bg-zinc-800 text-emerald-700 dark:text-emerald-400 shadow-md shadow-slate-200 dark:shadow-none'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>1. Customer Checkout</span>
          </button>

          <button
            onClick={() => setActiveTab('contractor')}
            className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'contractor'
                ? 'bg-white dark:bg-zinc-800 text-blue-700 dark:text-blue-400 shadow-md shadow-slate-200 dark:shadow-none'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>2. Contractor Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('agency')}
            className={`flex items-center justify-center gap-3 py-3 px-4 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'agency'
                ? 'bg-white dark:bg-zinc-800 text-purple-700 dark:text-purple-400 shadow-md shadow-slate-200 dark:shadow-none'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>3. Agency Console & Embeds</span>
          </button>

        </div>

        {/* TAB 1: CUSTOMER BOOKING EXPERIENCE */}
        {activeTab === 'checkout' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-10 shadow-sm animate-in fade-in duration-300">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-semibold text-xs mb-3">
                  <Smartphone className="w-3.5 h-3.5" />
                  Layer 1: What Customers See on Mobile & Desktop
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Frictionless 45-Second Direct Booking Checkout
                </h3>
                <p className="mt-2 text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl">
                  Customers pick their package, choose their driveway arrival slot, pay a deposit via Apple Pay or credit card, and receive instant SMS confirmations.
                </p>
              </div>

              {/* Trade Vertical Switcher */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-slate-50 dark:bg-zinc-950 p-2 rounded-2xl border border-slate-200 dark:border-zinc-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 pl-2">Select Trade Vertical:</span>
                <div className="flex flex-wrap gap-1.5">
                  {TRADE_DEMOS.map(trade => (
                    <button
                      key={trade.id}
                      onClick={() => setSelectedTrade(trade)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        selectedTrade.id === trade.id
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800'
                      }`}
                    >
                      <trade.icon className="w-3.5 h-3.5" />
                      <span>{trade.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Outreach Demo Link vs Live Client Link Architecture Explainer */}
            <div className="my-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-slate-50 dark:from-emerald-950/20 dark:to-zinc-900 border border-emerald-200/80 dark:border-emerald-800/40">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>1. Demo Booking Link (During Sales Outreach)</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  Send this pre-built link to prospective clients when pitching web redesigns. They can test drive the customer checkout on their phone before spending a single dollar with your agency.
                </p>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-700 dark:text-zinc-300 break-all select-all">
                  <span className="flex-1 truncate">{selectedTrade.bookingUrl}</span>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => handleCopy(selectedTrade.bookingUrl, 'demo-booking-link')}
                    className="h-7 px-2 text-xs font-medium"
                  >
                    {copiedKey === 'demo-booking-link' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Trade: <strong>{selectedTrade.name}</strong></span>
                  <a 
                    href={selectedTrade.bookingUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-1"
                  >
                    Open Demo Checkout ↗
                  </a>
                </div>
              </div>

              <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-blue-50/80 to-slate-50 dark:from-blue-950/20 dark:to-zinc-900 border border-blue-200/80 dark:border-blue-800/40">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-sm mb-2">
                  <Globe className="w-4 h-4" />
                  <span>2. Live Booking Link (When You Assign a Client)</span>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-4">
                  When you add a client slot in your Agency Console, CaptoDesk automatically provisions a production link e.g. <code className="text-blue-700 dark:text-blue-300 font-mono">book.captodesk.com/{'{client-slug}'}</code> hooked to their Stripe, real calendar, and SMS dispatch.
                </p>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-700 dark:text-zinc-300 break-all">
                  <span className="flex-1 truncate text-slate-400">https://book.captodesk.com/your-client-slug</span>
                  <Badge variant="outline" className="text-[10px] text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800">
                    Auto-Generated
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>Custom domains (e.g. book.client.com) supported</span>
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">1-Click Slot Provisioning</span>
                </div>
              </div>

            </div>

            {/* Interactive Checkout Showcase */}
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    Live Checkout Feature Matrix ({selectedTrade.name})
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    What happens under the hood when a homeowner or vehicle owner books:
                  </p>
                </div>

                <a 
                  href={selectedTrade.bookingUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 shadow-sm">
                    Open Full Checkout (New Tab)
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center font-bold text-sm mb-3">1</div>
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Instant Package Picker</h5>
                  <p className="text-xs text-slate-500">Configured with your client's exact trade packages, vehicle sizes, and high-margin add-ons.</p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold text-sm mb-3">2</div>
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Real-Time Driveway Slots</h5>
                  <p className="text-xs text-slate-500">Live calendar sync prevents double bookings and enforces drive-time travel buffers automatically.</p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 flex items-center justify-center font-bold text-sm mb-3">3</div>
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Stripe Deposit / Card Vault</h5>
                  <p className="text-xs text-slate-500">Collects upfront deposits or vaults cards to eliminate no-shows. 0% CaptoDesk fee on jobs.</p>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center font-bold text-sm mb-3">4</div>
                  <h5 className="font-bold text-sm text-slate-900 dark:text-white mb-1">Instant SMS Notifications</h5>
                  <p className="text-xs text-slate-500">Homeowner gets booking confirmation and technician gets address & dispatch details instantly.</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: CONTRACTOR CLIENT DASHBOARD */}
        {activeTab === 'contractor' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-10 shadow-sm animate-in fade-in duration-300">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 font-semibold text-xs mb-3">
                  <Calendar className="w-3.5 h-3.5" />
                  Layer 2: What Your Contractor Client Receives
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Turnkey Dispatch, Calendar & Payment Software
                </h3>
                <p className="mt-2 text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl">
                  When you sign a contractor, they get access to their private workspace at <code className="text-blue-600 dark:text-blue-400 font-mono text-xs sm:text-sm">app.captodesk.com</code> where bookings turn into dispatched jobs, invoices, and 5-star Google reviews.
                </p>
              </div>

              {/* Direct Demo Entry CTA */}
              <a 
                href={selectedTrade.dashboardUrl} 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <Button size="lg" className="bg-blue-600 hover:bg-blue-500 text-white font-bold gap-2 shadow-md shadow-blue-600/20">
                  Test Drive Contractor Dashboard (No Sign In)
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>

            {/* Contractor Superpowers Grid */}
            <div className="my-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Automated SMS Dispatch</h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    1-click "On My Way" button sends the homeowner a live GPS tracking link with exact technician ETA. Cuts "Where are you?" phone calls to zero.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <span>Included in every client slot</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Stripe Invoicing & Card Reader</h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    Contractors can collect final balances on-site with Apple Pay, tap-to-pay, or SMS payment links. Payments deposit directly into their bank account with 0% CaptoDesk fee.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>Direct Stripe Payouts</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                    <Star className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Automated 5-Star Reviews</h4>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                    30 minutes after a job is marked completed, CaptoDesk sends an SMS to the customer asking for feedback. Happy customers are routed straight to their Google Business profile.
                  </p>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800 text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <span>Skyrockets Local SEO for Your Agency</span>
                </div>
              </div>

            </div>

            {/* Privacy & RLS Explainer Callout */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-100 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="text-xs sm:text-sm">
                <strong className="text-slate-900 dark:text-white block font-semibold mb-1">
                  Privacy-First Architecture: Agency Console vs Contractor Client Workspace
                </strong>
                <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Homeowner addresses, private contact numbers, and bank payouts stay securely isolated inside the contractor's claimed dashboard. Your agency console receives aggregated metrics, booking counts, and campaign attribution without exposing sensitive consumer PII or needing password management.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: AGENCY PARTNER CONSOLE & EMBEDS */}
        {activeTab === 'agency' && (
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-10 shadow-sm animate-in fade-in duration-300">
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-200 dark:border-zinc-800">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 font-semibold text-xs mb-3">
                  <Code2 className="w-3.5 h-3.5" />
                  Layer 3: The Agency Command Console
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
                  Client Slots, 1-Click Embeds & Retainer Economics
                </h3>
                <p className="mt-2 text-slate-600 dark:text-zinc-400 text-sm sm:text-base max-w-2xl">
                  Manage all your contractor clients under a single login. Deploy new client booking slots in 30 seconds and copy ready-to-paste snippets for Webflow, WordPress, or Squarespace.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="font-semibold">
                    Sign In to Console
                  </Button>
                </Link>
                <a href="#margin-calculator">
                  <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-sm">
                    View Profit Calculator
                  </Button>
                </a>
              </div>
            </div>

            {/* Mock Client Slots Display */}
            <div className="my-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Sample Agency Portfolio Console (Active Slots)
                </h4>
                <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800">
                  Wholesale Rate: $49/mo per client slot
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Apex Auto Detailing</span>
                    <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Auto Detailing • Austin, TX</p>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <div className="flex justify-between">
                      <span>Monthly Bookings:</span>
                      <strong className="text-slate-900 dark:text-white">38 jobs ($7,200)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Client Retainer:</span>
                      <strong className="text-emerald-600 font-semibold">$149/mo</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Net Margin:</span>
                      <strong className="text-emerald-600 font-bold">+$100/mo net</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">ProFlow Plumbing & Rooter</span>
                    <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Plumbing • Dallas, TX</p>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <div className="flex justify-between">
                      <span>Monthly Bookings:</span>
                      <strong className="text-slate-900 dark:text-white">52 jobs ($14,500)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Client Retainer:</span>
                      <strong className="text-emerald-600 font-semibold">$149/mo</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Net Margin:</span>
                      <strong className="text-emerald-600 font-bold">+$100/mo net</strong>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">BlueSky HVAC & Air</span>
                    <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">HVAC • Fort Worth, TX</p>
                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 pt-2 border-t border-slate-200 dark:border-zinc-800">
                    <div className="flex justify-between">
                      <span>Monthly Bookings:</span>
                      <strong className="text-slate-900 dark:text-white">41 jobs ($6,800)</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Client Retainer:</span>
                      <strong className="text-emerald-600 font-semibold">$149/mo</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Your Net Margin:</span>
                      <strong className="text-emerald-600 font-bold">+$100/mo net</strong>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Interactive Embed Code Generator */}
            <div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl p-6 border border-slate-200 dark:border-zinc-800">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-purple-600" />
                    Webflow & WordPress 1-Click Embed Snippet Generator
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Select your embed format and copy clean, zero-dependency HTML code ready for Webflow, WordPress, Squarespace, or Wix.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
                  <button
                    onClick={() => setEmbedType('button')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      embedType === 'button'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Button Link
                  </button>
                  <button
                    onClick={() => setEmbedType('pill')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      embedType === 'pill'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Floating Pill
                  </button>
                  <button
                    onClick={() => setEmbedType('iframe')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      embedType === 'iframe'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Responsive Iframe
                  </button>
                </div>
              </div>

              {/* UTM Config Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">UTM Source (Attribution)</label>
                  <Input 
                    value={utmSource} 
                    onChange={(e) => setUtmSource(e.target.value)}
                    placeholder="webflow-client-site"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block mb-1">UTM Campaign</label>
                  <Input 
                    value={utmCampaign} 
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    placeholder="spring-schedule"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Code Display Area */}
              <div className="relative">
                <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 text-xs font-mono overflow-x-auto border border-slate-800 leading-relaxed">
                  {generatedSnippet}
                </pre>
                <Button
                  size="sm"
                  onClick={() => handleCopy(generatedSnippet, 'embed-code')}
                  className="absolute top-3 right-3 bg-purple-600 hover:bg-purple-500 text-white font-bold h-7 px-3 text-xs gap-1.5 shadow-md"
                >
                  {copiedKey === 'embed-code' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Snippet
                    </>
                  )}
                </Button>
              </div>

            </div>

          </div>
        )}

      </section>

      {/* Retainer Economics Calculator Section */}
      <section id="margin-calculator" className="py-16 bg-gradient-to-b from-white to-slate-50 dark:from-zinc-900 dark:to-zinc-950 border-y border-slate-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 mb-3">
              Agency Retainer Economics
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
              Calculate Your Monthly Retainer Profit
            </h2>
            <p className="mt-3 text-slate-600 dark:text-zinc-400 text-base">
              CaptoDesk charges you a flat wholesale rate of $49/mo per client slot. You set the client retainer price and pocket the difference every single month with zero maintenance.
            </p>
          </div>

          <div className="max-w-4xl mx-auto bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 sm:p-10 shadow-xl">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              
              {/* Sliders */}
              <div className="space-y-6">
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                      Contractor Client Slots:
                    </label>
                    <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      {clientCount} Clients
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min={1} 
                    max={50} 
                    value={clientCount} 
                    onChange={(e) => setClientCount(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span>1 client</span>
                    <span>15 clients</span>
                    <span>30 clients</span>
                    <span>50 clients</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="font-bold text-sm text-slate-800 dark:text-zinc-200">
                      Monthly Retainer Billed to Client:
                    </label>
                    <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                      ${clientPrice} / mo
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min={99} 
                    max={249} 
                    step={10}
                    value={clientPrice} 
                    onChange={(e) => setClientPrice(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                    <span>$99/mo (standard)</span>
                    <span>$149/mo (popular)</span>
                    <span>$249/mo (premium)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                  <div className="flex justify-between">
                    <span>CaptoDesk Wholesale Cost:</span>
                    <strong className="text-slate-800 dark:text-zinc-200">${wholesaleCost}/mo per slot</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Your Monthly Profit Margin:</span>
                    <strong className="text-emerald-600 font-bold">+${monthlyProfitPerClient}/mo per slot</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tech Support & Maintenance:</span>
                    <strong className="text-blue-600 dark:text-blue-400 font-semibold">100% Handled by CaptoDesk</strong>
                  </div>
                </div>

              </div>

              {/* Profit Display Card */}
              <div className="p-8 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-700/20 text-center flex flex-col justify-center">
                
                <span className="text-xs uppercase tracking-widest font-extrabold text-emerald-200">
                  Your Net Recurring Revenue
                </span>

                <div className="my-4">
                  <div className="text-4xl sm:text-5xl font-black tracking-tight">
                    ${totalMonthlyNetProfit.toLocaleString()}
                    <span className="text-xl sm:text-2xl font-bold text-emerald-200">/mo</span>
                  </div>
                  <p className="text-emerald-100 text-xs sm:text-sm mt-1">
                    Pure monthly retainer profit with zero engineering overhead
                  </p>
                </div>

                <div className="pt-4 border-t border-emerald-500/40 mt-2">
                  <span className="text-xs text-emerald-200 font-semibold uppercase tracking-wider">Annualized Run-Rate (ARR):</span>
                  <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
                    ${totalAnnualNetProfit.toLocaleString()} / year
                  </div>
                </div>

                <a 
                  href="mailto:shanta@captodesk.com?subject=Agency%20Partner%20Slot%20Inquiry%20-%20CaptoDesk"
                  className="mt-6"
                >
                  <Button size="lg" className="w-full bg-white text-emerald-800 hover:bg-emerald-50 font-extrabold shadow-md">
                    Claim Agency Partner Slots
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </a>

              </div>

            </div>

          </div>

        </div>
      </section>

      {/* Done-For-You Agency Workflow */}
      <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 mb-3">
            Zero Dev Maintenance
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">
            How CaptoDesk Takes the Work Off Your Plate
          </h2>
          <p className="mt-3 text-slate-600 dark:text-zinc-400 text-base">
            Web agencies love partnering with us because you never have to build booking forms from scratch or troubleshoot APIs on weekends.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white font-extrabold flex items-center justify-center mb-4">
              1
            </div>
            <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">You Close the Client</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Bundle the online booking add-on into your client's web redesign or ongoing marketing retainer for $100–$150/mo.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 font-extrabold flex items-center justify-center mb-4">
              2
            </div>
            <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">Assign Slot in Console</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Drop their business name, phone number, and trade into your partner console in under 30 seconds.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 font-extrabold flex items-center justify-center mb-4">
              3
            </div>
            <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">We Build Their Menu</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Our onboarding team configures their exact pricing, arrival windows, and calendar sync within 24 hours.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 font-extrabold flex items-center justify-center mb-4">
              4
            </div>
            <h4 className="font-bold text-base text-slate-900 dark:text-white mb-2">Paste & Collect</h4>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
              Paste the 1-line button snippet into Webflow or WordPress. If your client has tech questions, our team supports them directly.
            </p>
          </div>

        </div>

      </section>

      {/* Agency FAQ Section */}
      <section id="agency-faq" className="py-16 bg-slate-100/70 dark:bg-zinc-900/60 border-t border-slate-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              Frequently Asked Questions for Agencies
            </h2>
            <p className="mt-2 text-slate-600 dark:text-zinc-400 text-sm">
              Everything you need to know about partnering with CaptoDesk.
            </p>
          </div>

          <div className="space-y-4">
            
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Can our agency access our clients' contractor dashboard without their permission?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                No. In production, client dashboards (<code className="font-mono text-xs">app.captodesk.com</code>) hold sensitive customer information: homeowner home addresses, phone numbers, and direct Stripe bank account payouts. The contractor securely claims their dashboard via a private token. Your agency console receives high-level campaign attribution, booking volume, and UTM tracking without risking privacy violations.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                What is the difference between the demo booking link and the live booking link?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                The <strong>demo booking link</strong> (e.g. <code className="font-mono text-xs">book.captodesk.com/auto-detailing</code>) is a generic, pre-configured checkout designed for cold outreach and sales pitches to show clients how fast booking works. The <strong>live booking link</strong> (e.g. <code className="font-mono text-xs">book.captodesk.com/apex-detailing</code>) is created when you deploy a real client slot, and connects directly to their live calendar, SMS notifications, and Stripe account.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                Which website platforms and CMSs are supported?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                CaptoDesk works out of the box with <strong>Webflow, WordPress, Squarespace, Wix, Shopify, Framer, and custom React/HTML builds</strong>. Because the checkout can be embedded via a clean 1-line button, floating pill, or responsive iframe, you never run into CMS plugin conflicts or broken dependencies.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <h4 className="font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-600" />
                What if a client churns or cancels?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                Agency slots are month-to-month. If a contractor client cancels their web retainer, you can either reassign that slot to a new client immediately or pause it in your console with zero penalty.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs font-semibold px-3 py-1 mb-6">
            Get Started as an Agency Partner
          </Badge>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto">
            Ready to Offer Turnkey Booking to Your Trade Clients?
          </h2>

          <p className="mt-4 text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Book a quick 5-minute walkthrough or test drive the contractor dashboard right now with zero sign in required.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="mailto:shanta@captodesk.com?subject=Agency%20Partner%20Walkthrough%20Request"
              className="w-full sm:w-auto"
            >
              <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl shadow-emerald-600/30">
                <Send className="w-4 h-4 mr-2" />
                Schedule 5-Min Partner Walkthrough
              </Button>
            </a>

            <a 
              href="https://app.captodesk.com/demo" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base font-semibold border-zinc-700 hover:bg-zinc-800 text-white">
                Test Drive Contractor Workspace
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </div>

          <div className="mt-8 text-xs text-zinc-500">
            Have questions? Email us directly at <a href="mailto:shanta@captodesk.com" className="text-zinc-400 hover:text-white underline">shanta@captodesk.com</a>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-slate-500 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandIcon className="w-5 h-5" />
            <span className="font-semibold text-slate-700 dark:text-zinc-300">CaptoDesk Agency Partner Network</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} CaptoDesk Inc.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/login" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Agency Sign In
            </Link>
            <a href="https://captodesk.com/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="https://captodesk.com/terms" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </footer>

    </div>
  )
}
