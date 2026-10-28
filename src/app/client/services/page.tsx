'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import {
  Wrench,
  Plus,
  Search,
  Clock,
  DollarSign,
  Tag,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  Loader2,
  ExternalLink,
  Sparkles,
  Info,
  Check,
  ChevronRight,
  LayoutGrid,
  List,
  X
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/context/workspace-context'
import {
  parseServicePricing,
  cleanServiceDescription,
  encodeServiceDescription,
  type PricingModel
} from '@/lib/services/service-pricing'
import { INDUSTRY_LIST, getIndustryPreset, type IndustryPreset } from '@/lib/constants/industries'

export interface ServiceItem {
  id: string
  org_id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
  requires_address: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export default function ServicesPage() {
  // State
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')

  // Modals & Action States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [deletingService, setDeletingService] = useState<ServiceItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // 60-Second Instant Catalog Modal
  const { orgIndustry } = useWorkspace()
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState<string>('hvac')
  const [showOtherTrades, setShowOtherTrades] = useState(false)
  const [tradeSearch, setTradeSearch] = useState('')
  const [submittingImport, setSubmittingImport] = useState(false)

  // Align with workspace trade
  useEffect(() => {
    if (orgIndustry && orgIndustry !== 'general') {
      setSelectedTradeId(orgIndustry)
    }
  }, [orgIndustry])

  // Form Fields
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
  const [formPricingModel, setFormPricingModel] = useState<PricingModel>('fixed')
  const [formDuration, setFormDuration] = useState<number>(60)
  const [formDescription, setFormDescription] = useState('')
  const [formRequiresAddress, setFormRequiresAddress] = useState(true)
  const [formIsActive, setFormIsActive] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  // Load Services from API
  const loadServices = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/client/services')
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/client/login'
          return
        }
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to load services')
      }

      const data = await res.json()
      setServices(data.services || [])
      if (data.config?.slug) {
        setOrgSlug(data.config.slug)
      }
      if (data.config?.industry) {
        setSelectedTradeId(data.config.industry)
      }
    } catch (err: any) {
      console.error('[SERVICES_LOAD_ERROR]', err)
      setError(err.message || 'An unexpected error occurred while loading services.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadServices()
  }, [loadServices])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingService(null)
    setFormName('')
    setFormPrice('')
    setFormPricingModel('fixed')
    setFormDuration(60)
    setFormDescription('')
    setFormRequiresAddress(true)
    setFormIsActive(true)
    setFormError(null)
    setIsModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (svc: ServiceItem) => {
    setEditingService(svc)
    const parsed = parseServicePricing(svc.price, svc.description)
    setFormName(svc.name)
    setFormPrice(parsed.price !== null ? parsed.price.toString() : '')
    setFormPricingModel(parsed.model)
    setFormDuration(svc.duration_minutes || 60)
    setFormDescription(parsed.cleanDescription)
    setFormRequiresAddress(svc.requires_address !== false)
    setFormIsActive(svc.is_active !== false)
    setFormError(null)
    setIsModalOpen(true)
  }

  // Save Service (Create or Update)
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = formName.trim()
    if (!trimmedName) {
      setFormError('Please enter a service name.')
      return
    }

    if (formDuration <= 0 || !Number.isInteger(Number(formDuration))) {
      setFormError('Duration must be a positive number of minutes.')
      return
    }

    let parsedPrice: number | null = null
    if (formPricingModel === 'free_estimate') {
      parsedPrice = formPrice.trim() ? Math.round(Number(formPrice.trim()) * 100) / 100 : 0
    } else if (formPricingModel === 'quote_on_site') {
      parsedPrice = formPrice.trim() ? Math.round(Number(formPrice.trim()) * 100) / 100 : null
    } else if (formPrice.trim()) {
      const p = Number(formPrice.trim())
      if (isNaN(p) || p < 0) {
        setFormError('Please enter a valid non-negative price.')
        return
      }
      parsedPrice = Math.round(p * 100) / 100
    }

    const encodedDescription = encodeServiceDescription(formDescription.trim() || null, formPricingModel) || null

    setSubmitting(true)
    try {
      if (editingService) {
        const res = await fetch(`/api/client/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            description: encodedDescription,
            duration_minutes: formDuration,
            price: parsedPrice,
            requires_address: formRequiresAddress,
            is_active: formIsActive
          })
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update service')
        }

        toast.success(`Updated "${trimmedName}"`)
        setIsModalOpen(false)
        await loadServices()
      } else {
        const res = await fetch('/api/client/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            description: encodedDescription,
            duration_minutes: formDuration,
            price: parsedPrice,
            requires_address: formRequiresAddress,
            is_active: formIsActive
          })
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create service')
        }

        toast.success(`Created service "${trimmedName}"`)
        setIsModalOpen(false)
        await loadServices()
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save service')
    } finally {
      setSubmitting(false)
    }
  }

  // Quick 48px Toggle Active / Inactive
  const handleToggleActive = async (svc: ServiceItem) => {
    setTogglingId(svc.id)
    const nextActive = !svc.is_active
    try {
      const res = await fetch(`/api/client/services/${svc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to toggle status')
      }

      setServices(prev =>
        prev.map(item => (item.id === svc.id ? { ...item, is_active: nextActive } : item))
      )
      toast.success(
        nextActive
          ? `Activated "${svc.name}" for public booking`
          : `Deactivated "${svc.name}"`
      )
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status')
    } finally {
      setTogglingId(null)
    }
  }

  // Delete / Safe Deactivate
  const handleConfirmDelete = async () => {
    if (!deletingService) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/client/services/${deletingService.id}`, {
        method: 'DELETE'
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove service')
      }

      if (data.deactivated) {
        toast.info(data.message || 'Service deactivated to preserve historical appointments.')
      } else {
        toast.success(`Deleted service "${deletingService.name}"`)
      }

      setDeletingService(null)
      await loadServices()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove service')
    } finally {
      setSubmitting(false)
    }
  }

  // 1-Click Import Starter Catalog
  const handleImportCatalog = async (tradeId: string) => {
    setSubmittingImport(true)
    try {
      const res = await fetch('/api/client/services/import-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: tradeId })
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to import trade catalog')
      }

      if (data.importedCount > 0) {
        toast.success(`Added ${data.importedCount} starter services for ${data.industry}!`)
      } else {
        toast.info(`Starter services for ${data.industry} are already loaded in your catalog.`)
      }

      setIsCatalogModalOpen(false)
      await loadServices()
    } catch (err: any) {
      toast.error(err.message || 'Failed to load trade catalog')
    } finally {
      setSubmittingImport(false)
    }
  }

  // Filtered Services List
  const filteredServices = useMemo(() => {
    return services.filter(svc => {
      if (statusFilter === 'active' && !svc.is_active) return false
      if (statusFilter === 'inactive' && svc.is_active) return false

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const matchName = svc.name.toLowerCase().includes(query)
        const matchDesc = svc.description?.toLowerCase().includes(query) || false
        if (!matchName && !matchDesc) return false
      }

      return true
    })
  }, [services, statusFilter, searchQuery])

  // Filtered Trades for Catalog Modal
  const filteredTrades = useMemo(() => {
    if (!tradeSearch.trim()) return INDUSTRY_LIST
    const q = tradeSearch.toLowerCase().trim()
    return INDUSTRY_LIST.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.badge.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    )
  }, [tradeSearch])

  const selectedPreset: IndustryPreset = useMemo(() => {
    return getIndustryPreset(selectedTradeId)
  }, [selectedTradeId])

  const counts = useMemo(() => {
    const total = services.length
    const active = services.filter(s => s.is_active).length
    const inactive = total - active
    const pricedServices = services.filter(s => s.price && s.price > 0)
    const avgPrice = pricedServices.length > 0 
      ? Math.round(pricedServices.reduce((sum, s) => sum + (Number(s.price) || 0), 0) / pricedServices.length) 
      : 0
    return { total, active, inactive, avgPrice }
  }, [services])

  // Standardized pricing badge renderer
  const renderPricingBadge = (pricing: ReturnType<typeof parseServicePricing>) => {
    switch (pricing.model) {
      case 'fixed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs">
            <Tag className="w-3 h-3 opacity-70" />
            <span>{pricing.formattedPrice}</span>
          </span>
        )
      case 'diagnostic_fee':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-mono">
            <span>{pricing.formattedPrice}</span>
          </span>
        )
      case 'starting_at':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 font-mono">
            <span>{pricing.formattedPrice}</span>
          </span>
        )
      case 'quote_on_site':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700">
            <span>Quote on Site</span>
          </span>
        )
      case 'free_estimate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span>Free Estimate</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            <span>{pricing.formattedPrice}</span>
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">

      {/* Page Header (Senior Designer Craft Standard) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Service Catalog &amp; Price Book
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-mono tabular-nums">
              {counts.total} services
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Configure trade offerings, diagnostic inspection fees, baseline rates, and customer public booking availability.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {orgSlug && (
            <Link
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-zinc-800 bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white transition-colors shadow-xs"
            >
              <span>Public Booking</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </Link>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsCatalogModalOpen(true)}
            className="h-9 px-3 text-xs font-semibold border-amber-300 dark:border-amber-700/60 bg-amber-50/50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-600 dark:text-amber-400" />
            <span>Load {selectedPreset ? selectedPreset.name.split('&')[0].trim() : 'Trade'} Presets</span>
          </Button>

          <Button
            onClick={handleOpenCreate}
            size="sm"
            className="h-9 px-3.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Service</span>
          </Button>
        </div>
      </div>

      {/* 4 Catalog Operational Metric Tokens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Total Services</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{loading ? '—' : counts.total}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Configured price book items</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Active for Online Booking</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{loading ? '—' : counts.active}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Live on customer booking portal</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Average Flat Rate</p>
          <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums mt-1">
            {loading ? '—' : counts.avgPrice > 0 ? `$${counts.avgPrice}` : 'Quote on Site'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Priced service average</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Draft / Inactive</p>
          <p className="text-xl font-bold text-slate-700 dark:text-zinc-300 tabular-nums mt-1">{loading ? '—' : counts.inactive}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Hidden from homeowners</p>
        </div>
      </div>

      {/* Filter, Search & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Filter Rail */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
          {[
            { id: 'all', label: 'All', count: counts.total },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'inactive', label: 'Inactive', count: counts.inactive }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id as any)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors",
                statusFilter === st.id
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              <span>{st.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono",
                statusFilter === st.id ? "bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200" : "text-slate-400 dark:text-zinc-500"
              )}>
                {st.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Grid/Table Switcher */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search services or keywords..."
              className="h-9 pl-8 pr-7 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 p-0.5 rounded-lg shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Grid View"
              className={cn(
                "p-1.5 rounded-md text-xs transition-colors",
                viewMode === 'grid'
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="Table View (Fast Editing)"
              className={cn(
                "p-1.5 rounded-md text-xs transition-colors",
                viewMode === 'table'
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl border border-red-500/20 bg-red-950/20 text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={loadServices} className="text-xs text-red-300 hover:text-red-200">
            Retry
          </Button>
        </div>
      )}

      {/* Services Content: Grid or Table */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          <p className="text-xs font-medium">Loading service catalog...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 p-8 sm:p-12 text-center bg-white/60 dark:bg-zinc-900/40 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
            {searchQuery.trim() || statusFilter !== 'all' ? 'No Matching Services Found' : 'Your Service Catalog is Empty'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
            {searchQuery.trim() || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter to see other catalog entries.'
              : 'Populate your catalog in 60 seconds with pre-curated trade presets (HVAC, Plumbing, Electrical, Roofing, Painting, Landscaping, and more) or create a custom service.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setIsCatalogModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-xs text-white font-bold h-10 px-4 shadow-xs"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-amber-300" />
              <span>Load Trade Starter Catalog (21 Trades)</span>
            </Button>
            <Button
              onClick={handleOpenCreate}
              variant="outline"
              className="text-xs font-semibold border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 h-10 px-4 shadow-xs"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              <span>Create Custom Service</span>
            </Button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* ── TABLE VIEW (Senior Designer dense utility) ── */
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800">
                <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Service Details</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Pricing Model &amp; Rate</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Duration</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Location</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Public Booking</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredServices.map(svc => {
                  const pricing = parseServicePricing(svc.price, svc.description)
                  return (
                    <TableRow key={svc.id} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="py-3 px-4">
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                          {svc.name}
                        </div>
                        {pricing.cleanDescription && (
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 max-w-sm mt-0.5">
                            {pricing.cleanDescription}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3 px-4">
                        {renderPricingBadge(pricing)}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-xs font-mono tabular-nums text-slate-600 dark:text-zinc-300">
                        {svc.duration_minutes} min
                      </TableCell>

                      <TableCell className="py-3 px-4 text-xs text-slate-600 dark:text-zinc-400">
                        {svc.requires_address ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>On-Site</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">Remote</span>
                        )}
                      </TableCell>

                      {/* 48px Touch Toggle */}
                      <TableCell className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(svc)}
                          disabled={togglingId === svc.id}
                          className="min-h-[44px] flex items-center cursor-pointer group focus:outline-none"
                          title={svc.is_active ? 'Click to deactivate' : 'Click to activate'}
                        >
                          {togglingId === svc.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : svc.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Live</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition-colors">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>Inactive</span>
                            </span>
                          )}
                        </button>
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(svc)}
                            className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5 mr-1" />
                            <span>Edit</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingService(svc)}
                            className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        /* ── GRID VIEW (Card Layout) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map(svc => {
            const pricing = parseServicePricing(svc.price, svc.description)
            return (
              <div
                key={svc.id}
                className={cn(
                  'rounded-2xl border bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs space-y-4',
                  svc.is_active ? 'border-slate-200 dark:border-zinc-800' : 'border-slate-200/60 dark:border-zinc-800/60 opacity-80 bg-slate-50/50 dark:bg-zinc-950/40'
                )}
              >
                <div className="space-y-3">
                  {/* Title & 48px Touch Toggle */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate" title={svc.name}>
                        {svc.name}
                      </h3>
                    </div>

                    {/* 48px Touch Target Status Switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleActive(svc)}
                      disabled={togglingId === svc.id}
                      className="min-h-[40px] flex items-center cursor-pointer group focus:outline-none shrink-0"
                      title={svc.is_active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {togglingId === svc.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                      ) : svc.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Live</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition-colors">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Inactive</span>
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Clean Description */}
                  <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 min-h-[32px] leading-relaxed">
                    {pricing.cleanDescription || <span className="text-slate-400 italic">No description provided</span>}
                  </p>

                  {/* Badges: Pricing Model, Duration, Location */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    {renderPricingBadge(pricing)}

                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-mono">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{svc.duration_minutes} min</span>
                    </div>

                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 text-xs">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{svc.requires_address ? 'On-Site' : 'Remote'}</span>
                    </div>
                  </div>
                </div>

                {/* 48px Truck Touch Actions Row */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(svc)}
                    className="h-9 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    <span>Edit</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingService(svc)}
                    className="h-9 px-3 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    <span>Remove</span>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 21-TRADE PRESET BROWSER MODAL (60s Instant Setup) ── */}
      <Modal
        open={isCatalogModalOpen}
        onOpenChange={setIsCatalogModalOpen}
        title="Load Trade Starter Catalog"
        description="Select any home service trade to import 3 pre-curated services with flexible starting prices, diagnostic inspection fees, and durations."
        size="lg"
      >
        <div className="space-y-4 pt-1">
          {/* Header toggle for primary vs other trades */}
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Active Trade: <strong className="text-slate-900 dark:text-zinc-100">{selectedPreset.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowOtherTrades(prev => !prev)}
              className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline cursor-pointer font-medium"
            >
              {showOtherTrades ? 'Hide Other Trades' : 'Browse Other 20 Trades'}
            </button>
          </div>

          {showOtherTrades && (
            <div className="space-y-2 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={tradeSearch}
                  onChange={e => setTradeSearch(e.target.value)}
                  placeholder="Search 21 trade presets (e.g. HVAC, Plumbing, Roofing, Electrical, Painting)..."
                  className="pl-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs h-9 text-slate-900 dark:text-zinc-100"
                />
              </div>

              {/* Trade Pills Selector */}
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-1.5 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-950">
                {filteredTrades.map(trade => (
                  <button
                    key={trade.id}
                    type="button"
                    onClick={() => setSelectedTradeId(trade.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer',
                      selectedTradeId === trade.id
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
                    )}
                  >
                    <span>{trade.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Trade Preview Box */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  {selectedPreset.badge}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  {selectedPreset.name}
                </h4>
              </div>
              <Badge variant="outline" className="text-[10px] bg-white dark:bg-zinc-900 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300">
                3 Curated Services
              </Badge>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {selectedPreset.description}
            </p>

            {/* List of 3 Services to be Imported */}
            <div className="space-y-2 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
              {selectedPreset.services.map((svc, idx) => {
                const parsed = parseServicePricing(svc.price, svc.description)
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                          {svc.name}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          · {svc.duration_minutes}m
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {parsed.cleanDescription}
                      </p>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      {renderPricingBadge(parsed)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCatalogModalOpen(false)}
              className="h-9 text-xs border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
              disabled={submittingImport}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleImportCatalog(selectedPreset.id)}
              className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-xs"
              disabled={submittingImport}
            >
              {submittingImport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Importing Catalog...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                  <span>Import {selectedPreset.name} Services</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── CREATE / EDIT SERVICE MODAL ── */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingService ? 'Edit Price Book Service' : 'Add Price Book Service'}
        description={
          editingService
            ? 'Update service pricing model, standard durations, or customer address requirements.'
            : 'Define a service available for instant customer booking or field quote dispatch.'
        }
        size="md"
      >
        <form onSubmit={handleSaveService} className="space-y-4 pt-1">
          {formError && (
            <div className="p-3 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="svc-name" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              Service Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="svc-name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g., Seasonal AC Precision Tune-Up, Water Heater Replacement"
              className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
              required
              maxLength={100}
            />
          </div>

          {/* Pricing Structure Models */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              Pricing Structure Model
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(['fixed', 'starting_at', 'diagnostic_fee', 'quote_on_site', 'free_estimate'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormPricingModel(m)}
                  className={cn(
                    'px-2 py-1.5 rounded-lg border text-xs font-semibold text-center transition-colors cursor-pointer',
                    formPricingModel === m
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                  )}
                >
                  {m === 'fixed' && 'Fixed Price'}
                  {m === 'starting_at' && 'Starting At'}
                  {m === 'diagnostic_fee' && 'Diagnostic Fee'}
                  {m === 'quote_on_site' && 'Quote on Site'}
                  {m === 'free_estimate' && 'Free Estimate'}
                </button>
              ))}
            </div>
          </div>

          {/* Duration & Price Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Duration */}
            <div className="space-y-1">
              <Label htmlFor="svc-duration" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                Duration (minutes) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="svc-duration"
                type="number"
                min="5"
                max="1440"
                step="5"
                value={formDuration}
                onChange={e => setFormDuration(Number(e.target.value))}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
                required
              />
              {/* Presets */}
              <div className="flex items-center gap-1 mt-1">
                {[30, 45, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormDuration(mins)}
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer',
                      formDuration === mins
                        ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold'
                        : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1">
              <Label htmlFor="svc-price" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                {formPricingModel === 'fixed' && 'Price ($)'}
                {formPricingModel === 'starting_at' && 'Starting Price ($)'}
                {formPricingModel === 'diagnostic_fee' && 'Diagnostic Fee ($)'}
                {formPricingModel === 'quote_on_site' && 'Baseline Estimate (Optional, $)'}
                {formPricingModel === 'free_estimate' && 'Estimated Price (Optional, $)'}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                <Input
                  id="svc-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  placeholder={
                    formPricingModel === 'quote_on_site'
                      ? 'Blank / Quote on Site'
                      : formPricingModel === 'free_estimate'
                      ? '0.00'
                      : '89.00'
                  }
                  className="h-9 pl-7 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {formPricingModel === 'fixed' && 'Exact price shown to customer and billed on booking'}
                {formPricingModel === 'starting_at' && 'Minimum price displayed as Starting at $X+'}
                {formPricingModel === 'diagnostic_fee' && 'Applied as a diagnostic call fee'}
                {formPricingModel === 'quote_on_site' && 'Shown as Quote on Site'}
                {formPricingModel === 'free_estimate' && 'Shown as Free Estimate / Consultation'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="svc-desc" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
              Service Description
            </Label>
            <textarea
              id="svc-desc"
              rows={2}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Describe what is included in this service (equipment check, filter verification)..."
              className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formRequiresAddress}
                onChange={e => setFormRequiresAddress(e.target.checked)}
                className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 h-4 w-4"
              />
              <span className="text-xs text-slate-700 dark:text-zinc-300">
                Requires customer property address during booking (on-site service)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 h-4 w-4"
              />
              <span className="text-xs text-slate-700 dark:text-zinc-300">
                Active and live on customer booking link
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="h-9 text-xs border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-9 px-4 bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-xs"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Saving...</span>
                </>
              ) : editingService ? (
                'Save Changes'
              ) : (
                'Create Service'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE / SAFE DEACTIVATE CONFIRMATION MODAL ── */}
      <Modal
        open={!!deletingService}
        onOpenChange={open => !open && setDeletingService(null)}
        title="Remove Service"
        description={`Are you sure you want to remove "${deletingService?.name}"?`}
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-900 dark:text-zinc-200 font-bold">
              <Info className="w-4 h-4 text-blue-500 shrink-0" />
              <span>Historical Data Protection</span>
            </div>
            <p className="leading-relaxed">
              If this service is linked to existing appointments or field jobs, it will be safely <strong className="text-slate-900 dark:text-zinc-200">deactivated</strong> rather than deleted so all past customer history and reporting remain intact.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingService(null)}
              className="h-9 text-xs border-slate-300 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              className="h-9 px-3.5 bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-xs"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  <span>Removing...</span>
                </>
              ) : (
                'Confirm Remove'
              )}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
