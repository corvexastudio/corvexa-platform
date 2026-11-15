'use client'

import { useEffect, useState, useMemo } from 'react'
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
  Loader2,
  Wrench,
  Flame,
  Zap,
  Home,
  CheckCircle2,
  AlertCircle,
  Code2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  AgencyPortfolioOverview, 
  AgencyClientSlot, 
  SlotStatus,
  getAgencyTierConfig
} from '@/lib/agency/agency-types'
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

// Trade Icons Helper
const TRADE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  plumbing: { label: 'Plumbing', icon: Wrench, color: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60' },
  hvac: { label: 'HVAC', icon: Flame, color: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800/60' },
  electrical: { label: 'Electrical', icon: Zap, color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60' },
  roofing: { label: 'Roofing', icon: Home, color: 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60' },
  general: { label: 'General Trade', icon: Building2, color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
}

export default function AgencyDashboardPage() {
  const [overview, setOverview] = useState<AgencyPortfolioOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTrade, setSelectedTrade] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Modals & Drawers state
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false)
  const [selectedSlotForEmbed, setSelectedSlotForEmbed] = useState<AgencyClientSlot | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // Deploy Client Form State
  const [deployLoading, setDeployLoading] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    businessName: '',
    industry: 'plumbing' as 'plumbing' | 'hvac' | 'electrical' | 'roofing' | 'general',
    ownerName: '',
    ownerCellPhone: '',
    shopPhone: '',
    timezone: 'America/Chicago',
    googleReviewUrl: ''
  })

  // Load agency portfolio data
  async function fetchOverview() {
    try {
      setLoading(true)
      const res = await fetch('/api/agency/overview')
      if (res.ok) {
        const data = await res.json()
        setOverview(data)
      }
    } catch (err) {
      console.error('[AGENCY DASHBOARD] Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverview()
  }, [])

  // Copy helper
  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  // Handle Client Deploy Submission
  async function handleDeploySubmit(e: React.FormEvent) {
    e.preventDefault()
    setDeployError(null)
    setDeployLoading(true)

    try {
      const res = await fetch('/api/agency/clients/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientDetails: {
            businessName: formData.businessName,
            industry: formData.industry,
            ownerName: formData.ownerName,
            ownerCellPhone: formData.ownerCellPhone,
            shopPhone: formData.shopPhone || undefined,
            timezone: formData.timezone,
            googleReviewUrl: formData.googleReviewUrl || undefined,
          }
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to deploy client into slot')
      }

      // Close modal and refresh portfolio
      setIsDeployModalOpen(false)
      setFormData({
        businessName: '',
        industry: 'plumbing',
        ownerName: '',
        ownerCellPhone: '',
        shopPhone: '',
        timezone: 'America/Chicago',
        googleReviewUrl: ''
      })
      await fetchOverview()

    } catch (err: any) {
      setDeployError(err?.message || 'Error executing client deployment')
    } finally {
      setDeployLoading(false)
    }
  }

  // Filter and search logic
  const filteredSlots = useMemo(() => {
    if (!overview?.slots) return []
    return overview.slots.filter(slot => {
      // Trade filter
      if (selectedTrade !== 'all' && slot.industry !== selectedTrade) {
        return false
      }
      // Status filter
      if (selectedStatus !== 'all' && slot.status !== selectedStatus) {
        return false
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchName = slot.business_name?.toLowerCase().includes(query)
        const matchPhone = slot.phone?.toLowerCase().includes(query) || slot.owner_phone?.toLowerCase().includes(query)
        const matchSlug = slot.slug?.toLowerCase().includes(query)
        return matchName || matchPhone || matchSlug
      }
      return true
    })
  }, [overview?.slots, selectedTrade, selectedStatus, searchQuery])

  // Count active trades for badges
  const tradeCounts = useMemo(() => {
    if (!overview?.slots) return { all: 0, plumbing: 0, hvac: 0, electrical: 0, roofing: 0 }
    const active = overview.slots.filter(s => s.status === 'active')
    return {
      all: active.length,
      plumbing: active.filter(s => s.industry === 'plumbing').length,
      hvac: active.filter(s => s.industry === 'hvac').length,
      electrical: active.filter(s => s.industry === 'electrical').length,
      roofing: active.filter(s => s.industry === 'roofing').length,
    }
  }, [overview?.slots])

  return (
    <div className="space-y-6">
      
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Client Portfolio & Slot Management</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Monitor real-time missed call recovery, direct calendar bookings, and verified invoiced revenue across your agency’s trade client roster.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={() => setIsDeployModalOpen(true)}
            className="h-10 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs gap-2 rounded-lg cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Deploy Client Slot</span>
          </Button>
        </div>
      </div>

      {/* Zero Clients Onboarding Helper Banner */}
      {overview && overview.used_slots === 0 && (
        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                All {overview.total_slots} Wholesale Capacity Slots Available
              </p>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Deploy your first contractor client to activate 5-second missed call text-back, mobile field dispatch, and closed-loop revenue defense.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setIsDeployModalOpen(true)}
            className="h-8 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1.5 cursor-pointer shrink-0 shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Deploy Client #1</span>
          </Button>
        </div>
      )}

      {/* Retainer Defense KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* KPI 1: Slot Capacity */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>Slot Allocation</span>
            <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
              {getAgencyTierConfig(overview?.agency?.subscription_tier).name}
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                {overview?.used_slots ?? 0}
              </span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                / {overview?.total_slots ?? 0} Slots Active
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full mt-2 overflow-hidden flex">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                style={{ width: `${overview?.occupancy_rate ?? 0}%` }} 
              />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>{overview?.available_slots ?? 0} open slots ready to deploy</span>
          </div>
        </div>

        {/* KPI 2: Missed Calls Recovered */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>Missed Calls Recovered</span>
            <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
              {overview?.total_30d_missed_calls_recovered ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 ml-2 font-medium">Auto-Text Bookings</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
            Within 5s of unanswered phone calls
          </div>
        </div>

        {/* KPI 3: Booked Jobs */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col justify-between transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>Booked Field Jobs</span>
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
              {overview?.total_30d_booked_jobs ?? 0}
            </span>
            <span className="text-xs text-slate-500 dark:text-zinc-400 ml-2 font-medium">30-Day Total</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-zinc-400">
            Directly attributed to agency marketing
          </div>
        </div>

        {/* KPI 4: Verified Invoiced Revenue (Retainer Defense) */}
        <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 shadow-2xs flex flex-col justify-between relative overflow-hidden transition-colors">
          <div className="flex items-center justify-between text-slate-500 dark:text-zinc-400 text-xs font-medium">
            <span>Verified Invoiced Revenue</span>
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              ${(overview?.total_30d_invoiced_revenue ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-3 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 font-bold font-mono">
              {overview?.estimated_client_retainer_roi ?? 0}x ROI
            </span>
            <span>on client retainers</span>
          </div>
        </div>

      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-colors">
        
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
          <Input
            type="text"
            placeholder="Filter by contractor name, phone, or slug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:border-emerald-500 rounded-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Trade Vertical Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: `All (${tradeCounts.all})` },
            { id: 'plumbing', label: `Plumbing (${tradeCounts.plumbing})` },
            { id: 'hvac', label: `HVAC (${tradeCounts.hvac})` },
            { id: 'electrical', label: `Electrical (${tradeCounts.electrical})` },
            { id: 'roofing', label: `Roofing (${tradeCounts.roofing})` },
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
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-850/60 text-slate-500 dark:text-zinc-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-16">Slot</th>
                <th className="py-3 px-4">Contractor & Industry</th>
                <th className="py-3 px-4">Telephony & Line</th>
                <th className="py-3 px-4 text-center">30-Day Activity</th>
                <th className="py-3 px-4 text-right">Invoiced Cash</th>
                <th className="py-3 px-4 text-center">Embed Code</th>
                <th className="py-3 px-4 text-right">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {filteredSlots.map((slot) => {
                const isAvailable = slot.status === 'available'
                const tradeMeta = TRADE_CONFIG[slot.industry || 'general'] || TRADE_CONFIG.general
                const TradeIcon = tradeMeta.icon

                if (isAvailable) {
                  return (
                    <tr 
                      key={`slot-${slot.slot_number}`}
                      className="bg-slate-50/40 dark:bg-zinc-900/40 hover:bg-slate-50/80 dark:hover:bg-zinc-850/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-400 dark:text-zinc-500">
                        #{slot.slot_number.toString().padStart(2, '0')}
                      </td>
                      <td colSpan={5} className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-600" />
                          <span className="font-semibold text-slate-600 dark:text-zinc-400">
                            Available Capacity Slot
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                            — Ready to assign to a new plumbing, HVAC, or trade client.
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setIsDeployModalOpen(true)
                          }}
                          className="h-8 px-3 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-lg gap-1.5 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Assign Client</span>
                        </Button>
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr 
                    key={`slot-${slot.slot_number}`}
                    className="hover:bg-slate-50/80 dark:hover:bg-zinc-850/50 transition-colors"
                  >
                    {/* Slot Number */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400 dark:text-zinc-500">
                      #{slot.slot_number.toString().padStart(2, '0')}
                    </td>

                    {/* Contractor & Industry */}
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
                        {slot.slug && (
                          <a 
                            href={`https://captodesk.com/book/${slot.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline flex items-center gap-1 mt-0.5"
                          >
                            <span>captodesk.com/book/{slot.slug}</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Telephony Line */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 font-mono text-slate-700 dark:text-zinc-300">
                          <Phone className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{slot.phone || 'Toll-Free Platform Line'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">
                          {slot.is_missed_call_active ? 'Missed-Call 5s Active' : 'Standby Mode'}
                        </span>
                      </div>
                    </td>

                    {/* 30-Day Activity */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-2 font-mono">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold" title="Missed Calls Auto-Recovered">
                          {slot.month_missed_calls_recovered} calls
                        </span>
                        <span className="text-slate-300 dark:text-zinc-600">•</span>
                        <span className="text-slate-800 dark:text-zinc-200 font-bold" title="Booked Jobs">
                          {slot.month_jobs_count} jobs
                        </span>
                      </div>
                    </td>

                    {/* Invoiced Cash */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                        ${slot.month_invoiced_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                        title="Get website button embed & UTM link"
                      >
                        <Code2 className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                        <span>Embed</span>
                      </Button>
                    </td>

                    {/* Management Impersonation Link */}
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/client/dashboard?tenant=${slot.organization_id || ''}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-slate-900 transition-colors shadow-2xs"
                      >
                        <span>Workspace</span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deploy Client Modal */}
      <Dialog open={isDeployModalOpen} onOpenChange={setIsDeployModalOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:rounded-xl p-6 shadow-lg">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Deploy Client into Available Slot</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-zinc-400">
              Provisions a dedicated trade booking portal, seeds services, and assigns a missed-call line. Uses 1 of your {overview?.available_slots ?? 0} open slots.
            </DialogDescription>
          </DialogHeader>

          {deployError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{deployError}</span>
            </div>
          )}

          <form onSubmit={handleDeploySubmit} className="space-y-4 pt-2">
            
            {/* Business Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Contractor Business Name <span className="text-emerald-600 dark:text-emerald-400">*</span>
              </label>
              <Input
                required
                type="text"
                placeholder="e.g. Apex Plumbing & Drain"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="h-9 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg"
              />
            </div>

            {/* Trade Vertical */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Trade Specialty <span className="text-emerald-600 dark:text-emerald-400">*</span>
              </label>
              <select
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value as any })}
                className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:border-emerald-500"
              >
                <option value="plumbing">Plumbing (Drain, Water Heater, Leak Diagnostic)</option>
                <option value="hvac">HVAC (AC Tune-Up, Furnace, Diagnostic)</option>
                <option value="electrical">Electrical (Breaker, Panel, Wiring)</option>
                <option value="roofing">Roofing (Leak Inspection, Storm Assessment)</option>
                <option value="general">General Home Services</option>
              </select>
            </div>

            {/* Owner Name & Mobile Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Owner Full Name <span className="text-emerald-600 dark:text-emerald-400">*</span>
                </label>
                <Input
                  required
                  type="text"
                  placeholder="e.g. Mark Johnson"
                  value={formData.ownerName}
                  onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                  className="h-9 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Owner Mobile Phone <span className="text-emerald-600 dark:text-emerald-400">*</span>
                </label>
                <Input
                  required
                  type="tel"
                  placeholder="e.g. (214) 555-0199"
                  value={formData.ownerCellPhone}
                  onChange={(e) => setFormData({ ...formData, ownerCellPhone: e.target.value })}
                  className="h-9 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg font-mono"
                />
              </div>
            </div>

            {/* Shop Forwarding Phone & Timezone */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Shop / Office Phone</label>
                <Input
                  type="tel"
                  placeholder="Optional forwarding #"
                  value={formData.shopPhone}
                  onChange={(e) => setFormData({ ...formData, shopPhone: e.target.value })}
                  className="h-9 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full h-9 px-3 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                >
                  <option value="America/Chicago">Central (America/Chicago)</option>
                  <option value="America/New_York">Eastern (America/New_York)</option>
                  <option value="America/Denver">Mountain (America/Denver)</option>
                  <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDeployModalOpen(false)}
                className="h-9 text-xs text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={deployLoading}
                className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-2 cursor-pointer"
              >
                {deployLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Provisioning Slot...</span>
                  </>
                ) : (
                  <span>Deploy to Active Line</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Client Embed Code Drawer */}
      <Sheet open={Boolean(selectedSlotForEmbed)} onOpenChange={(open) => !open && setSelectedSlotForEmbed(null)}>
        <SheetContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 sm:max-w-lg p-6 overflow-y-auto">
          {selectedSlotForEmbed && (
            <div className="space-y-5">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Website Embed Snippets & UTM Links</span>
                </SheetTitle>
                <SheetDescription className="text-xs text-slate-500 dark:text-zinc-400">
                  Ready-to-copy booking buttons and UTM tracking URLs for <strong className="text-slate-900 dark:text-white">{selectedSlotForEmbed.business_name}</strong>.
                </SheetDescription>
              </SheetHeader>

              {/* Direct Booking Link */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Direct Customer Booking URL</span>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={selectedSlotForEmbed.public_booking_url || ''}
                    className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400 rounded-lg select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCopy(selectedSlotForEmbed.public_booking_url || '', 'direct-url')}
                    className="h-8 px-2.5 text-xs bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === 'direct-url' ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* WordPress / Webflow HTML Button Snippet */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">WordPress / Webflow HTML Button</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const snippet = `<a href="${selectedSlotForEmbed.public_booking_url}" class="captodesk-book-btn" style="background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;">Book Diagnostic Online</a>`
                      handleCopy(snippet, 'html-btn')
                    }}
                    className="h-6 px-2 text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 gap-1 cursor-pointer"
                  >
                    {copiedKey === 'html-btn' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>Copy Snippet</span>
                  </Button>
                </div>
                <pre className="p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-700 text-[11px] font-mono text-slate-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap">
{`<a href="${selectedSlotForEmbed.public_booking_url}" class="captodesk-book-btn" style="background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;">Book Diagnostic Online</a>`}
                </pre>
              </div>

              {/* UTM Campaign URL Generator */}
              <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300">Google Ads / LSA UTM Tagged URL</span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Use this URL in your agency’s Google Ads or Local Services Ads campaigns to attribute every booked job to your agency retainer.
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    readOnly
                    value={`${selectedSlotForEmbed.public_booking_url}?utm_source=google-ads&utm_campaign=agency-retainer`}
                    className="h-8 text-[11px] font-mono bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-blue-600 dark:text-blue-400 rounded-lg select-all"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleCopy(`${selectedSlotForEmbed.public_booking_url}?utm_source=google-ads&utm_campaign=agency-retainer`, 'utm-url')}
                    className="h-8 px-2.5 text-xs bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 dark:hover:bg-zinc-600 text-slate-800 dark:text-zinc-200 cursor-pointer"
                  >
                    {copiedKey === 'utm-url' ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              {/* Webmaster Note */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 text-blue-800 dark:text-blue-300 text-xs leading-relaxed space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                  <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Webmaster Recommendation</span>
                </span>
                <p>
                  Place this booking button in the website header next to the phone number. When visitors are browsing after 6 PM, this converts 3x higher than standard contact forms.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

    </div>
  )
}
