'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  XCircle,
  AlertCircle,
  Edit2,
  Trash2,
  Power,
  Loader2,
  ExternalLink,
  Sparkles,
  Info,
  Check,
  ChevronRight,
  Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const supabase = createClient()

  // State
  const [services, setServices] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  // Modals & Action States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState<ServiceItem | null>(null)
  const [deletingService, setDeletingService] = useState<ServiceItem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // 60-Second Instant Catalog Modal
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState<string>('plumbing')
  const [tradeSearch, setTradeSearch] = useState('')
  const [submittingImport, setSubmittingImport] = useState(false)

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
      // In quote on site model, price is optional/blank
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
        // PATCH
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
        // POST
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

  // Quick Toggle Active / Inactive
  const handleToggleActive = async (svc: ServiceItem) => {
    setTogglingId(svc.id)
    try {
      const nextActive = !svc.is_active
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
      // Status filter
      if (statusFilter === 'active' && !svc.is_active) return false
      if (statusFilter === 'inactive' && svc.is_active) return false

      // Search query
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
    return { total, active, inactive }
  }, [services])

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Service Catalog
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Manage your service menu, pricing models, and online booking options.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {orgSlug && (
            <Link
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white bg-white hover:bg-slate-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-lg transition-colors shadow-2xs h-9 cursor-pointer"
            >
              <span>Public Booking</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsCatalogModalOpen(true)}
            className="text-xs sm:text-sm font-medium gap-1.5 border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 h-9 shadow-2xs cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Load Trade Catalog</span>
            <span className="sm:hidden">Catalog</span>
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium gap-1.5 shadow-2xs h-9 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-zinc-900/60 border border-slate-200/80 dark:border-zinc-800/80 rounded-xl self-start">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              statusFilter === 'all'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            )}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              statusFilter === 'active'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            )}
          >
            Active ({counts.active})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer',
              statusFilter === 'inactive'
                ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-2xs'
                : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
            )}
          >
            Inactive ({counts.inactive})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="pl-9 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs h-9 text-slate-900 dark:text-zinc-200 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-blue-500 shadow-2xs"
          />
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

      {/* Services List / Cards */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-500">
          <Loader2 className="w-7 h-7 animate-spin mb-3 text-blue-500" />
          <p className="text-xs">Loading services catalog...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-8 sm:p-12 text-center bg-white/60 dark:bg-zinc-950/40 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-3 text-blue-600 dark:text-blue-400">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-zinc-100">
            {searchQuery.trim() || statusFilter !== 'all' ? 'No matching services found' : 'Your Service Catalog is Empty'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {searchQuery.trim() || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter to see other catalog entries.'
              : 'Populate your catalog in 60 seconds with pre-curated trade presets (Plumbing, HVAC, Electrical, Roofing, Painting, Landscaping, and more) or create a custom service.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              onClick={() => setIsCatalogModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm text-white font-medium gap-1.5 shadow-xs h-10 px-4 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Load Trade Starter Catalog (60s Setup)</span>
            </Button>
            <Button
              onClick={handleOpenCreate}
              variant="outline"
              className="text-xs sm:text-sm font-medium gap-1.5 border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 h-10 px-4 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Custom Service</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map(svc => {
            const pricing = parseServicePricing(svc.price, svc.description)
            return (
              <div
                key={svc.id}
                className={cn(
                  'rounded-xl border bg-white dark:bg-zinc-900/70 p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs',
                  svc.is_active ? 'border-slate-200/80 dark:border-zinc-800' : 'border-slate-200/60 dark:border-zinc-800/60 opacity-75 bg-slate-50/50 dark:bg-zinc-950/40'
                )}
              >
                <div>
                  {/* Header: Title & Badges */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 truncate" title={svc.name}>
                        {svc.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleToggleActive(svc)}
                        disabled={togglingId === svc.id}
                        className="cursor-pointer focus:outline-none"
                        title={svc.is_active ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {togglingId === svc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400 dark:text-zinc-500" />
                        ) : svc.is_active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                            <Power className="w-3 h-3" />
                            Inactive
                          </span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 line-clamp-2 min-h-[32px] leading-relaxed">
                    {pricing.cleanDescription || <span className="text-slate-400 dark:text-zinc-600 italic">No description provided</span>}
                  </p>

                  {/* Attributes: Duration, Price Badge, Address */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 text-xs">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300">
                      <Clock className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                      <span>{svc.duration_minutes} min</span>
                    </div>

                    {/* Pricing Badge formatted by Model */}
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border',
                        pricing.model === 'quote_on_site' && 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 font-semibold',
                        pricing.model === 'diagnostic_fee' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 font-semibold',
                        pricing.model === 'starting_at' && 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60 font-semibold',
                        pricing.model === 'free_estimate' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 font-medium',
                        pricing.model === 'fixed' && 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-mono font-bold'
                      )}
                    >
                      <Tag className="w-3 h-3 opacity-70" />
                      <span>{pricing.formattedPrice}</span>
                    </div>

                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                      <MapPin className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                      <span>{svc.requires_address ? 'On-Site' : 'Remote'}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenEdit(svc)}
                    className="h-8 text-xs text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeletingService(svc)}
                    className="h-8 text-xs text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 60-Second Instant Trade Catalog Setup Modal */}
      <Modal
        open={isCatalogModalOpen}
        onOpenChange={setIsCatalogModalOpen}
        title="Load Trade Starter Catalog"
        description="Select any home service trade to populate 3 pre-curated services with flexible starting prices or quote-on-site options."
        size="lg"
      >
        <div className="space-y-4 pt-1">
          {/* Trade Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={tradeSearch}
              onChange={e => setTradeSearch(e.target.value)}
              placeholder="Search 20+ trades (e.g. Plumbing, HVAC, Roofing, Painting, Locksmith, Appliance)..."
              className="pl-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs h-9 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
            />
          </div>

          {/* Trade Selector Chips */}
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50/50 dark:bg-zinc-950/50">
            {filteredTrades.map(trade => (
              <button
                key={trade.id}
                type="button"
                onClick={() => setSelectedTradeId(trade.id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-1.5',
                  selectedTradeId === trade.id
                    ? 'bg-blue-600 border-blue-600 text-white shadow-2xs font-semibold'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
                )}
              >
                <span>{trade.name}</span>
              </button>
            ))}
          </div>

          {/* Selected Trade Preview Card */}
          <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
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
                    className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-zinc-100">
                          {svc.name}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                          • {svc.duration_minutes}m
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {parsed.cleanDescription}
                      </p>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded text-[11px] font-medium border',
                          parsed.model === 'quote_on_site' && 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 font-semibold',
                          parsed.model === 'diagnostic_fee' && 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 font-semibold',
                          parsed.model === 'starting_at' && 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 font-semibold',
                          parsed.model === 'free_estimate' && 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 font-medium',
                          parsed.model === 'fixed' && 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-mono font-bold'
                        )}
                      >
                        {parsed.formattedPrice}
                      </span>
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
              className="text-xs border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
              disabled={submittingImport}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => handleImportCatalog(selectedPreset.id)}
              className="bg-blue-600 hover:bg-blue-500 text-xs text-white font-medium gap-1.5 shadow-2xs cursor-pointer"
              disabled={submittingImport}
            >
              {submittingImport ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Importing Catalog...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  Import {selectedPreset.name} Services
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create / Edit Service Modal */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingService ? 'Edit Service' : 'Add New Service'}
        description={
          editingService
            ? 'Update service pricing model, duration, or address requirements.'
            : 'Define a service available for instant customer booking or quote requests.'
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
          <div className="space-y-1.5">
            <Label htmlFor="svc-name" className="text-xs text-slate-700 dark:text-zinc-200">
              Service Name <span className="text-red-500 dark:text-red-400">*</span>
            </Label>
            <Input
              id="svc-name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g., Water Heater Flush, Hydro-Jetting, AC Diagnostic"
              className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
              required
              maxLength={100}
            />
          </div>

          {/* Pricing Structure Models */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-700 dark:text-zinc-200">
              Pricing Structure
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {(['fixed', 'starting_at', 'diagnostic_fee', 'quote_on_site', 'free_estimate'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFormPricingModel(m)}
                  className={cn(
                    'px-2 py-1.5 rounded-lg border text-xs font-medium text-center transition-colors cursor-pointer',
                    formPricingModel === m
                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300 font-semibold'
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
            <div className="space-y-1.5">
              <Label htmlFor="svc-duration" className="text-xs text-slate-700 dark:text-zinc-200">
                Duration (minutes) <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="svc-duration"
                  type="number"
                  min="5"
                  max="1440"
                  step="5"
                  value={formDuration}
                  onChange={e => setFormDuration(Number(e.target.value))}
                  className="bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100"
                  required
                />
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1 mt-1">
                {[30, 45, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormDuration(mins)}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer',
                      formDuration === mins
                        ? 'bg-blue-600/10 border-blue-500/40 text-blue-600 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="svc-price" className="text-xs text-slate-700 dark:text-zinc-200">
                {formPricingModel === 'fixed' && 'Price ($)'}
                {formPricingModel === 'starting_at' && 'Starting Price ($)'}
                {formPricingModel === 'diagnostic_fee' && 'Diagnostic Fee Amount ($)'}
                {formPricingModel === 'quote_on_site' && 'Baseline Price (Optional, $)'}
                {formPricingModel === 'free_estimate' && 'Estimated Price (Optional, $)'}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-xs">$</span>
                <Input
                  id="svc-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  placeholder={
                    formPricingModel === 'quote_on_site'
                      ? 'Blank / Quote on Site (Leave empty)'
                      : formPricingModel === 'free_estimate'
                      ? '0.00 (Free Consultation)'
                      : '89.00'
                  }
                  className="pl-7 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-zinc-500">
                {formPricingModel === 'fixed' && 'Exact price shown to customer and applied on booking'}
                {formPricingModel === 'starting_at' && 'Minimum price shown as Starting at $X.XX+'}
                {formPricingModel === 'diagnostic_fee' && 'Shown to customer as $X.XX Diagnostic Fee'}
                {formPricingModel === 'quote_on_site' && 'Shown to customer as "Quote on Site" (leave empty or enter estimate)'}
                {formPricingModel === 'free_estimate' && 'Shown as Free Estimate / Consultation (leave blank or 0)'}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="svc-desc" className="text-xs text-slate-700 dark:text-zinc-200">
              Description
            </Label>
            <textarea
              id="svc-desc"
              rows={3}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Describe what's included in this service..."
              className="w-full rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Settings / Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formRequiresAddress}
                onChange={e => setFormRequiresAddress(e.target.checked)}
                className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span className="text-xs text-slate-700 dark:text-zinc-300">
                Requires customer address during booking (on-site service)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span className="text-xs text-slate-700 dark:text-zinc-300">
                Active and visible on public booking page
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-xs text-white cursor-pointer font-medium"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Saving...
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

      {/* Delete / Deactivate Confirmation Modal */}
      <Modal
        open={!!deletingService}
        onOpenChange={open => !open && setDeletingService(null)}
        title="Remove Service"
        description={`Are you sure you want to remove "${deletingService?.name}"?`}
        size="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-slate-900 dark:text-zinc-200 font-medium">
              <Info className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
              <span>Historical Data Protection</span>
            </div>
            <p className="leading-relaxed">
              If this service is linked to existing appointments or jobs, it will be safely <strong className="text-slate-900 dark:text-zinc-200">deactivated</strong> rather than deleted so all past customer history and reporting remain intact.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingService(null)}
              className="text-xs border-slate-300 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 cursor-pointer"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-500 text-xs text-white cursor-pointer font-medium"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Processing...
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
