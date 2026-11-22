'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  X,
  FileText,
  DollarSign,
  Clock,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Info,
  TrendingUp,
  Wrench,
  Gift,
  Globe,
  MapPin,
  Loader2,
  Check,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  parseServicePricing,
  cleanServiceDescription,
  encodeServiceDescriptionWithAddOns,
  parseServiceCategory,
  parseAddOns,
  type PricingModel,
  type ServiceAddOn,
  type ParsedServicePricing,
  PRICING_MODEL_LABELS
} from '@/lib/services/service-pricing'
import { INDUSTRY_PRESETS, getIndustryPreset } from '@/lib/constants/industries'

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

export interface ServiceEditorModalProps {
  open: boolean
  onClose: () => void
  service?: ServiceItem | null
  onSaved: (savedService: ServiceItem) => void
  existingServices?: ServiceItem[]
  industry?: string | null
}

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120, 180, 240]

const PRICING_MODEL_CONFIGS: Array<{
  model: PricingModel
  title: string
  badge: string
  icon: React.ComponentType<{ className?: string }>
  summary: string
  priceFieldLabel: string
  pricePlaceholder: string
  isPriceRequired: boolean
  helperNote: string
}> = [
  {
    model: 'fixed',
    title: 'Fixed Price',
    badge: 'Flat Rate',
    icon: DollarSign,
    summary: 'Guaranteed upfront price charged to the customer.',
    priceFieldLabel: 'Price ($)',
    pricePlaceholder: '89.00',
    isPriceRequired: true,
    helperNote: 'Customer sees exact price on booking and is charged this amount.'
  },
  {
    model: 'starting_at',
    title: 'Starting At',
    badge: 'Baseline',
    icon: TrendingUp,
    summary: 'Minimum baseline starting price subject to on-site scope.',
    priceFieldLabel: 'Starting Price ($)',
    pricePlaceholder: '150.00',
    isPriceRequired: true,
    helperNote: 'Customer sees "Starting at $X" on public booking.'
  },
  {
    model: 'diagnostic_fee',
    title: 'Diagnostic Fee',
    badge: 'Trip / Service Fee',
    icon: Wrench,
    summary: 'Trip or diagnostic fee charged upon arrival to troubleshoot.',
    priceFieldLabel: 'Diagnostic Fee ($)',
    pricePlaceholder: '99.00',
    isPriceRequired: true,
    helperNote: 'Customer sees "$X Diagnostic Fee" charged upon arrival.'
  },
  {
    model: 'quote_on_site',
    title: 'Quote on Site',
    badge: 'Estimate On-Site',
    icon: FileText,
    summary: 'No upfront charge. Price is determined during on-site inspection.',
    priceFieldLabel: 'Baseline Estimate (Optional, $)',
    pricePlaceholder: 'Optional / Leave Blank',
    isPriceRequired: false,
    helperNote: 'Customer sees "Quote on Site" with no upfront charge upon scheduling.'
  },
  {
    model: 'free_estimate',
    title: 'Free Estimate',
    badge: 'Free Consultation',
    icon: Gift,
    summary: 'Zero-cost consultation or in-home estimate ($0 upfront).',
    priceFieldLabel: 'Estimated Value (Optional, $)',
    pricePlaceholder: '0.00',
    isPriceRequired: false,
    helperNote: 'Customer sees "Free Estimate" with $0 upfront cost.'
  }
]

export function ServiceEditorModal({
  open,
  onClose,
  service,
  onSaved,
  existingServices = [],
  industry
}: ServiceEditorModalProps) {
  // Form State
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [pricingModel, setPricingModel] = useState<PricingModel>('fixed')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState<number>(60)
  const [addOns, setAddOns] = useState<ServiceAddOn[]>([])
  const [requiresAddress, setRequiresAddress] = useState(true)
  const [isActive, setIsActive] = useState(true)

  // Tracking & Validation
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Initial State Reference for Dirty Tracking
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')

  // Populate or Reset Form Values
  useEffect(() => {
    if (!open) {
      setShowDiscardConfirm(false)
      setFormError(null)
      return
    }

    if (service) {
      // Edit Mode: load existing values
      const parsed = parseServicePricing(service.price, service.description)
      const parsedCat = parseServiceCategory(service.description)

      const initialName = service.name || ''
      const initialCat = parsedCat || ''
      const initialDesc = parsed.cleanDescription || ''
      const initialModel = parsed.model || 'fixed'
      const initialPrice = parsed.price !== null && parsed.price !== undefined ? parsed.price.toString() : ''
      const initialDuration = service.duration_minutes || 60
      const initialAddOns = parsed.addOns || []
      const initialReqAddr = service.requires_address !== false
      const initialActive = service.is_active !== false

      setName(initialName)
      setCategory(initialCat)
      setDescription(initialDesc)
      setPricingModel(initialModel)
      setPrice(initialPrice)
      setDuration(initialDuration)
      setAddOns(initialAddOns)
      setRequiresAddress(initialReqAddr)
      setIsActive(initialActive)
      setFormError(null)

      setInitialSnapshot(
        JSON.stringify({
          name: initialName,
          category: initialCat,
          description: initialDesc,
          pricingModel: initialModel,
          price: initialPrice,
          duration: initialDuration,
          addOns: initialAddOns,
          requiresAddress: initialReqAddr,
          isActive: initialActive
        })
      )
    } else {
      // Create Mode: set defaults
      const defaultName = ''
      const defaultCat = ''
      const defaultDesc = ''
      const defaultModel: PricingModel = 'fixed'
      const defaultPrice = ''
      const defaultDuration = 60
      const defaultAddOns: ServiceAddOn[] = []
      const defaultReqAddr = true
      const defaultActive = true

      setName(defaultName)
      setCategory(defaultCat)
      setDescription(defaultDesc)
      setPricingModel(defaultModel)
      setPrice(defaultPrice)
      setDuration(defaultDuration)
      setAddOns(defaultAddOns)
      setRequiresAddress(defaultReqAddr)
      setIsActive(defaultActive)
      setFormError(null)

      setInitialSnapshot(
        JSON.stringify({
          name: defaultName,
          category: defaultCat,
          description: defaultDesc,
          pricingModel: defaultModel,
          price: defaultPrice,
          duration: defaultDuration,
          addOns: defaultAddOns,
          requiresAddress: defaultReqAddr,
          isActive: defaultActive
        })
      )
    }
  }, [open, service])

  // Compute Dirty State
  const isDirty = useMemo(() => {
    const currentSnapshot = JSON.stringify({
      name,
      category,
      description,
      pricingModel,
      price,
      duration,
      addOns,
      requiresAddress,
      isActive
    })
    return currentSnapshot !== initialSnapshot
  }, [name, category, description, pricingModel, price, duration, addOns, requiresAddress, isActive, initialSnapshot])

  // Suggested Categories derived from existing services + trade preset
  const suggestedCategories = useMemo(() => {
    const cats = new Set<string>()

    // 1. Existing categories from tenant catalog
    for (const s of existingServices) {
      const explicit = parseServiceCategory(s.description)
      if (explicit) cats.add(explicit)
    }

    // 2. Default industry preset categories
    if (industry) {
      const preset = getIndustryPreset(industry)
      if (preset?.services) {
        for (const starter of preset.services) {
          const starterCat = parseServiceCategory(starter.description)
          if (starterCat) cats.add(starterCat)
        }
      }
    }

    // Common trade categories fallback
    if (cats.size < 3) {
      cats.add('Maintenance')
      cats.add('Repairs')
      cats.add('Diagnostics')
      cats.add('Installations')
      cats.add('Emergency')
    }

    return Array.from(cats).filter(c => c && c.toLowerCase() !== category.toLowerCase())
  }, [existingServices, industry, category])

  // Duplicate Name Check
  const duplicateActiveWarning = useMemo(() => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed || !isActive) return null

    const match = existingServices.find(s => {
      if (service && s.id === service.id) return false
      return s.is_active && s.name.trim().toLowerCase() === trimmed
    })

    if (match) {
      return `A service named "${match.name}" is already active in your catalog.`
    }
    return null
  }, [name, isActive, existingServices, service])

  // Live Customer-Facing Preview Data
  const previewPricing: ParsedServicePricing = useMemo(() => {
    let numPrice: number | null = null
    if (pricingModel === 'free_estimate') {
      numPrice = price.trim() ? Number(price.trim()) : 0
    } else if (pricingModel === 'quote_on_site') {
      numPrice = price.trim() ? Number(price.trim()) : null
    } else if (price.trim()) {
      const p = Number(price.trim())
      numPrice = !isNaN(p) && p >= 0 ? p : null
    }

    // Construct simulated description to evaluate exact output via parseServicePricing
    const simulatedDesc = encodeServiceDescriptionWithAddOns(
      description.trim() || null,
      pricingModel,
      addOns.filter(a => a.name && a.name.trim().length > 0),
      category.trim() || null
    )

    return parseServicePricing(numPrice, simulatedDesc)
  }, [price, description, pricingModel, addOns, category])

  // Duration Formatter Helper
  const formattedDurationText = useMemo(() => {
    const mins = Number(duration) || 0
    if (mins <= 0) return '0 minutes'
    const hours = Math.floor(mins / 60)
    const remMins = mins % 60
    if (hours > 0 && remMins > 0) {
      return `${hours} hr ${remMins} min (${mins} mins)`
    }
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} (${mins} mins)`
    }
    return `${mins} minutes`
  }, [duration])

  // Add-On Helpers
  const handleAddAddOn = () => {
    setAddOns(prev => [
      ...prev,
      {
        id: `addon_${Math.random().toString(36).slice(2, 9)}`,
        name: '',
        price: 0,
        duration_minutes: 15,
        description: ''
      }
    ])
  }

  const handleUpdateAddOn = (index: number, field: keyof ServiceAddOn, val: any) => {
    setAddOns(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: val }
      return next
    })
  }

  const handleRemoveAddOn = (index: number) => {
    setAddOns(prev => prev.filter((_, idx) => idx !== index))
  }

  // Close Request with Unsaved-Changes Protection
  const handleCloseAttempt = () => {
    if (isDirty && !submitting) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Service name is required.')
      return
    }

    if (trimmedName.length > 100) {
      setFormError('Service name cannot exceed 100 characters.')
      return
    }

    const numDuration = Number(duration)
    if (!Number.isInteger(numDuration) || numDuration <= 0 || numDuration > 1440) {
      setFormError('Duration must be a positive integer in minutes (maximum 1440).')
      return
    }

    let parsedPrice: number | null = null
    if (pricingModel === 'fixed' || pricingModel === 'starting_at' || pricingModel === 'diagnostic_fee') {
      if (!price.trim()) {
        setFormError(`Please enter a price for ${PRICING_MODEL_LABELS[pricingModel]}.`)
        return
      }
      const p = Number(price.trim())
      if (isNaN(p) || p < 0) {
        setFormError('Price must be a valid non-negative number.')
        return
      }
      parsedPrice = Math.round(p * 100) / 100
    } else if (pricingModel === 'free_estimate') {
      parsedPrice = price.trim() ? Math.round(Number(price.trim()) * 100) / 100 : 0
    } else if (pricingModel === 'quote_on_site') {
      parsedPrice = price.trim() ? Math.round(Number(price.trim()) * 100) / 100 : null
    }

    // Filter and sanitize add-ons
    const validAddOns: ServiceAddOn[] = addOns
      .filter(a => a.name && a.name.trim().length > 0)
      .map(a => ({
        id: a.id || `addon_${Math.random().toString(36).slice(2, 9)}`,
        name: a.name.trim(),
        price: Number(a.price) >= 0 ? Math.round(Number(a.price) * 100) / 100 : 0,
        duration_minutes: Number(a.duration_minutes) >= 0 ? Number(a.duration_minutes) : 0,
        description: a.description?.trim() || undefined
      }))

    // Encode description with Category, Pricing Model, and Add-ons metadata
    const encodedDescription = encodeServiceDescriptionWithAddOns(
      description.trim() || null,
      pricingModel,
      validAddOns,
      category.trim() || null
    ) || null

    setSubmitting(true)
    try {
      if (service) {
        // Edit Existing Service
        const res = await fetch(`/api/client/services/${service.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            description: encodedDescription,
            duration_minutes: numDuration,
            price: parsedPrice,
            requires_address: requiresAddress,
            is_active: isActive
          })
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update service.')
        }

        toast.success(`Updated "${trimmedName}"`)
        onSaved(data.service)
        onClose()
      } else {
        // Create New Service
        const res = await fetch('/api/client/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            description: encodedDescription,
            duration_minutes: numDuration,
            price: parsedPrice,
            requires_address: requiresAddress,
            is_active: isActive
          })
        })

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Failed to create service.')
        }

        toast.success(`Created service "${trimmedName}"`)
        onSaved(data.service)
        onClose()
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to save service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-0 md:p-4 overflow-hidden animate-in fade-in-0 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-editor-title"
    >
      {/* ── MAIN MODAL CONTAINER (Full-Screen on Mobile, Spacious on Desktop) ── */}
      <div
        className={cn(
          'w-full bg-slate-50 dark:bg-zinc-950 flex flex-col',
          // Mobile: Full screen height and width
          'max-md:fixed max-md:inset-0 max-md:h-screen max-md:max-h-screen max-md:rounded-none max-md:overflow-hidden',
          // Desktop: Spacious professional modal
          'md:relative md:max-w-4xl md:max-h-[92vh] md:rounded-2xl md:border md:border-slate-200 md:dark:border-zinc-800 md:shadow-2xl md:overflow-hidden'
        )}
      >
        {/* ── TOP HEADER (Sticky) ── */}
        <header className="shrink-0 h-14 px-4 sm:px-6 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
              <Wrench className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2
                id="service-editor-title"
                className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 truncate"
              >
                {service ? 'Edit Service' : 'New Service'}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate hidden sm:block">
                {service
                  ? 'Update pricing model, duration, add-ons, and booking visibility.'
                  : 'Configure a service offering for online booking and field dispatch.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge
                variant="outline"
                className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5"
              >
                Unsaved changes
              </Badge>
            )}
            <button
              type="button"
              onClick={handleCloseAttempt}
              className="h-9 w-9 min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              aria-label="Close service editor"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── SCROLLABLE FORM BODY ── */}
        <form onSubmit={handleSubmit} id="service-form" className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
            {/* Global Error Banner */}
            {formError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold">Error saving service:</span> {formError}
                </div>
              </div>
            )}

            {/* Duplicate Name Warning */}
            {duplicateActiveWarning && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5 shadow-2xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold">Duplicate Notice:</span> {duplicateActiveWarning}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* ── LEFT COLUMN: FORM SECTIONS ── */}
              <div className="lg:col-span-7 space-y-6">
                {/* ── SECTION A: BASIC INFORMATION ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      1. Basic Information
                    </h3>
                  </div>

                  {/* Service Name */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="svc-editor-name" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                        Service Name <span className="text-red-500">*</span>
                      </Label>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {name.length}/100
                      </span>
                    </div>
                    <Input
                      id="svc-editor-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. AC Tune-Up, Water Heater Replacement, Drain Clearing"
                      className="h-11 bg-slate-50/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg focus:bg-white dark:focus:bg-zinc-900"
                      required
                      maxLength={100}
                    />
                  </div>

                  {/* Category with Suggestions */}
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-editor-category" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                      Category
                    </Label>
                    <Input
                      id="svc-editor-category"
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      placeholder="e.g. Cooling, Heating, Drains, Electrical, Maintenance"
                      className="h-10 bg-slate-50/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg focus:bg-white dark:focus:bg-zinc-900"
                    />

                    {suggestedCategories.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] text-slate-400 font-medium">Quick Suggestions:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestedCategories.slice(0, 6).map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setCategory(cat)}
                              className="text-[11px] px-2 py-1 rounded-md border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                            >
                              + {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-editor-desc" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                      Service Description
                    </Label>
                    <textarea
                      id="svc-editor-desc"
                      rows={3}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Explain what is included in this service (e.g. Multi-point inspection, filter replacement, system performance testing)..."
                      className="w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950 p-3 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white dark:focus:bg-zinc-900 leading-relaxed resize-none"
                    />
                  </div>
                </section>

                {/* ── SECTION B: PRICING STRUCTURE & RATE ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      2. Pricing Model & Rate
                    </h3>
                  </div>

                  {/* 5 Pricing Models Selector */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                      Pricing Model <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PRICING_MODEL_CONFIGS.map(cfg => {
                        const Icon = cfg.icon
                        const isSelected = pricingModel === cfg.model
                        return (
                          <button
                            key={cfg.model}
                            type="button"
                            onClick={() => {
                              setPricingModel(cfg.model)
                              if (cfg.model === 'quote_on_site' && price === '0') {
                                setPrice('')
                              }
                            }}
                            className={cn(
                              'p-3 rounded-xl border text-left transition-all cursor-pointer min-h-[48px] flex flex-col justify-between',
                              isSelected
                                ? 'bg-blue-50/70 border-blue-500 dark:bg-blue-950/40 dark:border-blue-500 shadow-2xs ring-1 ring-blue-500/30'
                                : 'bg-slate-50/60 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <Icon
                                  className={cn(
                                    'w-4 h-4',
                                    isSelected
                                      ? 'text-blue-600 dark:text-blue-400'
                                      : 'text-slate-400 dark:text-zinc-500'
                                  )}
                                />
                                <span
                                  className={cn(
                                    'text-xs font-bold',
                                    isSelected
                                      ? 'text-blue-950 dark:text-blue-200'
                                      : 'text-slate-700 dark:text-zinc-300'
                                  )}
                                >
                                  {cfg.title}
                                </span>
                              </div>
                              {isSelected && (
                                <span className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 leading-snug">
                              {cfg.summary}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Adaptive Price Input based on selected model */}
                  {(() => {
                    const activeCfg = PRICING_MODEL_CONFIGS.find(c => c.model === pricingModel)!
                    return (
                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <div className="space-y-1.5">
                          <Label htmlFor="svc-editor-price" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                            {activeCfg.priceFieldLabel}{' '}
                            {activeCfg.isPriceRequired && <span className="text-red-500">*</span>}
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                              $
                            </span>
                            <Input
                              id="svc-editor-price"
                              type="number"
                              step="0.01"
                              min="0"
                              value={price}
                              onChange={e => setPrice(e.target.value)}
                              placeholder={activeCfg.pricePlaceholder}
                              className="h-11 pl-8 bg-slate-50/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-sm font-mono text-slate-900 dark:text-zinc-100 rounded-lg focus:bg-white dark:focus:bg-zinc-900"
                              required={activeCfg.isPriceRequired}
                            />
                          </div>

                          {/* Quick Price Suggestions for Fixed / Starting At / Diagnostic Fee */}
                          {activeCfg.isPriceRequired && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[10px] text-slate-400 font-medium">Quick Rates:</span>
                              {[49, 89, 129, 189, 249, 349].map(amt => (
                                <button
                                  key={amt}
                                  type="button"
                                  onClick={() => setPrice(amt.toString())}
                                  className={cn(
                                    'text-[10px] font-mono px-2 py-1 rounded-md border transition-colors cursor-pointer',
                                    price === amt.toString()
                                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-bold'
                                      : 'bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                                  )}
                                >
                                  ${amt}
                                </button>
                              ))}
                            </div>
                          )}

                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 pt-0.5">
                            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                            <span>{activeCfg.helperNote}</span>
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                </section>

                {/* ── SECTION C: DURATION ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      3. Service Duration
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="svc-editor-duration" className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
                        Estimated Duration (minutes) <span className="text-red-500">*</span>
                      </Label>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {formattedDurationText}
                      </span>
                    </div>

                    <Input
                      id="svc-editor-duration"
                      type="number"
                      min="5"
                      max="1440"
                      step="5"
                      value={duration}
                      onChange={e => setDuration(Math.max(1, Number(e.target.value)))}
                      className="h-11 bg-slate-50/50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-sm font-mono text-slate-900 dark:text-zinc-100 rounded-lg focus:bg-white dark:focus:bg-zinc-900"
                      required
                    />

                    {/* Standard Duration Steppers (All >= 44px Touch Targets) */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">Standard Trade Durations:</span>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                        {DURATION_PRESETS.map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setDuration(mins)}
                            className={cn(
                              'min-h-[44px] rounded-lg border text-xs font-mono font-semibold flex items-center justify-center transition-colors cursor-pointer',
                              duration === mins
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-500 dark:text-indigo-300 font-bold shadow-2xs'
                                : 'bg-slate-50/70 dark:bg-zinc-950/70 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                            )}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── SECTION D: OPTIONAL ADD-ONS ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                          4. Optional Add-ons ({addOns.length})
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Extras customers can select when booking online.
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddAddOn}
                      className="min-h-[44px] px-3 text-xs font-semibold border-slate-300 dark:border-zinc-700 hover:border-blue-500 text-slate-800 dark:text-zinc-200 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 mr-1 text-blue-500" />
                      <span>Add Option</span>
                    </Button>
                  </div>

                  {addOns.length === 0 ? (
                    <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center space-y-1 bg-slate-50/50 dark:bg-zinc-950/50">
                      <p className="text-xs font-medium text-slate-600 dark:text-zinc-400">
                        No add-on options configured yet.
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                        Add items like "Filter Replacement", "Drain Flush", or "Surge Protector" to increase average ticket size.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addOns.map((addon, idx) => (
                        <div
                          key={addon.id || idx}
                          className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/70 space-y-2.5 shadow-2xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Input
                                placeholder="Add-on name (e.g. Filter Replacement)"
                                value={addon.name}
                                onChange={e => handleUpdateAddOn(idx, 'name', e.target.value)}
                                className="h-10 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAddOn(idx)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer shrink-0"
                              aria-label="Remove add-on"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {/* Price */}
                            <div className="w-32 relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                                +$
                              </span>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={addon.price !== undefined && addon.price !== null ? addon.price : ''}
                                onChange={e =>
                                  handleUpdateAddOn(
                                    idx,
                                    'price',
                                    e.target.value === '' ? 0 : parseFloat(e.target.value) || 0
                                  )
                                }
                                className="h-9 pl-7 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs font-mono text-slate-900 dark:text-zinc-100 rounded-lg"
                              />
                            </div>

                            {/* Additional Duration Steppers */}
                            <div className="flex items-center gap-1">
                              {[0, 15, 30, 45, 60].map(mins => (
                                <button
                                  key={mins}
                                  type="button"
                                  onClick={() => handleUpdateAddOn(idx, 'duration_minutes', mins)}
                                  className={cn(
                                    'min-h-[36px] min-w-[36px] px-2 rounded-md border text-[10px] font-mono transition-colors cursor-pointer',
                                    (addon.duration_minutes || 0) === mins
                                      ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold'
                                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'
                                  )}
                                >
                                  +{mins}m
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Short Description */}
                          <Input
                            placeholder="Short description (optional, e.g. Premium MERV 11 filter)"
                            value={addon.description || ''}
                            onChange={e => handleUpdateAddOn(idx, 'description', e.target.value)}
                            className="h-8 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-[11px] text-slate-700 dark:text-zinc-300 rounded-lg placeholder:text-slate-400"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ── SECTION E: BOOKING AVAILABILITY & DISPATCH ── */}
                <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                      5. Booking Availability & Dispatch
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {/* Public Online Booking Visibility Toggle */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={e => setIsActive(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-blue-600 h-5 w-5 shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                          Visible on Public Booking Page
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                          When enabled, customers can select and book this service on your public booking page. When disabled, the service is hidden from online customers but preserved in your catalog for internal quotes, invoices, and dispatch.
                        </p>
                      </div>
                    </label>

                    {/* Requires Customer Property Address Toggle */}
                    <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/50 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors cursor-pointer min-h-[48px]">
                      <input
                        type="checkbox"
                        checked={requiresAddress}
                        onChange={e => setRequiresAddress(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-blue-600 h-5 w-5 shrink-0"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 block">
                          Requires Customer Property Address
                        </span>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                          Customer must provide a service property address during booking (standard for on-site trade work). Turn off for remote phone/video consultations or shop drop-offs.
                        </p>
                      </div>
                    </label>
                  </div>
                </section>
              </div>

              {/* ── RIGHT COLUMN: LIVE CUSTOMER PREVIEW CARD (Sticky on Desktop) ── */}
              <div className="lg:col-span-5 space-y-4">
                <div className="lg:sticky lg:top-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                      Live Customer Preview
                    </h3>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    This is how your service card appears to homeowners on your public booking page:
                  </p>

                  {/* Public Service Card Simulation */}
                  <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        {category.trim() && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-none"
                          >
                            {category.trim()}
                          </Badge>
                        )}
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 leading-snug">
                          {name.trim() || 'Service Name'}
                        </h4>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 block">
                          {previewPricing.formattedPrice}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-zinc-400 flex items-center justify-end gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{duration}m</span>
                        </span>
                      </div>
                    </div>

                    {description.trim() ? (
                      <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                        {description.trim()}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-zinc-600 italic">
                        No service description provided yet.
                      </p>
                    )}

                    {/* Preview Add-Ons Chips */}
                    {addOns.filter(a => a.name.trim()).length > 0 && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          Optional Add-ons:
                        </span>
                        <div className="space-y-1">
                          {addOns
                            .filter(a => a.name.trim())
                            .map((addon, idx) => (
                              <div
                                key={idx}
                                className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between"
                              >
                                <span className="font-medium text-slate-700 dark:text-zinc-300">
                                  + {addon.name}
                                </span>
                                <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                                  +${Number(addon.price || 0).toFixed(2)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <div className="w-full h-9 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center opacity-85 cursor-not-allowed">
                        <span>Select Service</span>
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </div>
                  </div>

                  {/* Booking Visibility Notice */}
                  {!isActive && (
                    <div className="p-3 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>Currently hidden from public booking (Active switch is off).</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* ── STICKY BOTTOM ACTION BAR (Thumb-Friendly, >= 44px Buttons) ── */}
        <footer className="shrink-0 p-3 sm:px-6 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3 z-10">
          <Button
            type="button"
            variant="outline"
            onClick={handleCloseAttempt}
            disabled={submitting}
            className="min-h-[44px] px-4 text-xs font-semibold border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-pointer"
          >
            Cancel
          </Button>

          <Button
            type="submit"
            form="service-form"
            disabled={submitting || !name.trim()}
            className="min-h-[44px] flex-1 sm:flex-initial sm:min-w-[160px] bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md cursor-pointer transition-all"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span>Saving Service...</span>
              </>
            ) : service ? (
              <span>Save Changes</span>
            ) : (
              <span>Create Service</span>
            )}
          </Button>
        </footer>
      </div>

      {/* ── UNSAVED CHANGES CONFIRMATION MODAL ── */}
      {showDiscardConfirm && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in-0"
          role="alertdialog"
          aria-labelledby="discard-title"
          aria-describedby="discard-desc"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 id="discard-title" className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Discard Unsaved Changes?
                </h3>
                <p id="discard-desc" className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  You have unsaved changes to this service. If you close now, your edits will be lost.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDiscardConfirm(false)}
                className="min-h-[44px] text-xs border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                Keep Editing
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setShowDiscardConfirm(false)
                  onClose()
                }}
                className="min-h-[44px] bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Discard Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
