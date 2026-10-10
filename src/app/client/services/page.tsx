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
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

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

  // Form Fields
  const [formName, setFormName] = useState('')
  const [formPrice, setFormPrice] = useState('')
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
    setFormName(svc.name)
    setFormPrice(svc.price !== null && svc.price !== undefined ? svc.price.toString() : '')
    setFormDuration(svc.duration_minutes || 60)
    setFormDescription(svc.description || '')
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
    if (formPrice.trim()) {
      const p = Number(formPrice.trim())
      if (isNaN(p) || p < 0) {
        setFormError('Please enter a valid non-negative price.')
        return
      }
      parsedPrice = Math.round(p * 100) / 100
    }

    setSubmitting(true)
    try {
      if (editingService) {
        // PATCH
        const res = await fetch(`/api/client/services/${editingService.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            description: formDescription.trim() || null,
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
            description: formDescription.trim() || null,
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

  // Detect default "General Service"
  const generalService = useMemo(() => {
    return services.find(s => s.name.trim().toLowerCase() === 'general service')
  }, [services])

  const counts = useMemo(() => {
    const total = services.length
    const active = services.filter(s => s.is_active).length
    const inactive = total - active
    return { total, active, inactive }
  }, [services])

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
                Service Catalog
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Configure bookable services, durations, and pricing displayed on your public booking page.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-center">
          {orgSlug && (
            <Link
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
            >
              <span>Booking Page</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <Button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-medium gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Service</span>
          </Button>
        </div>
      </div>

      {/* General Service Helper Banner (if General Service is present) */}
      {generalService && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-zinc-100">Default Onboarding Service</h4>
                <Badge variant={generalService.is_active ? 'default' : 'secondary'} className="text-[10px]">
                  {generalService.is_active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                The standard <span className="text-zinc-200 font-medium">"General Service"</span> was created during onboarding so your booking page would function out-of-the-box. Once you configure your custom services, you can customize its duration/pricing or deactivate it so clients only book your real services.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenEdit(generalService)}
              className="text-xs border-zinc-700 hover:bg-zinc-800 text-zinc-200"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1" />
              Customize
            </Button>
            {generalService.is_active && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleToggleActive(generalService)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              >
                Deactivate
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-lg self-start">
          <button
            onClick={() => setStatusFilter('all')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              statusFilter === 'all'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              statusFilter === 'active'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Active ({counts.active})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              statusFilter === 'inactive'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            Inactive ({counts.inactive})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="pl-9 bg-zinc-950 border-zinc-800 text-xs h-9 text-zinc-200 focus:border-zinc-700"
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
        <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center bg-zinc-950/40">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-zinc-400">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-200">
            {searchQuery.trim() || statusFilter !== 'all' ? 'No matching services found' : 'No services configured yet'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
            {searchQuery.trim() || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter to see other catalog entries.'
              : 'Add your primary business offerings like "AC Maintenance", "Service Call", or "Lawn Mowing" so clients can book them online.'}
          </p>
          <div className="mt-5">
            <Button onClick={handleOpenCreate} size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Add Your First Service
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServices.map(svc => (
            <div
              key={svc.id}
              className={cn(
                'rounded-xl border bg-zinc-900/70 p-4 sm:p-5 flex flex-col justify-between transition-all hover:border-zinc-700',
                svc.is_active ? 'border-zinc-800' : 'border-zinc-800/60 opacity-75 bg-zinc-950/40'
              )}
            >
              <div>
                {/* Header: Title & Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-zinc-100 truncate" title={svc.name}>
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
                        <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                      ) : svc.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
                          <Power className="w-3 h-3" />
                          Inactive
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-zinc-400 mt-2 line-clamp-2 min-h-[32px] leading-relaxed">
                  {svc.description || <span className="text-zinc-600 italic">No description provided</span>}
                </p>

                {/* Attributes: Duration, Price, Address */}
                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-zinc-800/80 text-xs">
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    <span>{svc.duration_minutes} min</span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-950 border border-zinc-800 font-medium text-zinc-200">
                    <DollarSign className="w-3 h-3 text-zinc-500" />
                    <span>
                      {svc.price !== null && svc.price !== undefined
                        ? `$${Number(svc.price).toFixed(2)}`
                        : 'Custom Quote'}
                    </span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-400">
                    <MapPin className="w-3 h-3 text-zinc-500" />
                    <span>{svc.requires_address ? 'Address required' : 'Remote / No address'}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-zinc-800/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(svc)}
                  className="h-8 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" />
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletingService(svc)}
                  className="h-8 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Service Modal */}
      <Modal
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        title={editingService ? 'Edit Service' : 'Add New Service'}
        description={
          editingService
            ? 'Update service pricing, duration, or address requirements.'
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
            <Label htmlFor="svc-name" className="text-xs text-zinc-200">
              Service Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="svc-name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="e.g., AC Maintenance, Drain Cleaning"
              className="bg-zinc-950 border-zinc-800 text-xs text-zinc-100"
              required
              maxLength={100}
            />
          </div>

          {/* Duration & Price Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Duration */}
            <div className="space-y-1.5">
              <Label htmlFor="svc-duration" className="text-xs text-zinc-200">
                Duration (minutes) <span className="text-red-400">*</span>
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
                  className="bg-zinc-950 border-zinc-800 text-xs text-zinc-100"
                  required
                />
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1 mt-1">
                {[30, 60, 90, 120].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setFormDuration(mins)}
                    className={cn(
                      'text-[10px] px-2 py-0.5 rounded border transition-colors',
                      formDuration === mins
                        ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="space-y-1.5">
              <Label htmlFor="svc-price" className="text-xs text-zinc-200">
                Price ($)
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">$</span>
                <Input
                  id="svc-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formPrice}
                  onChange={e => setFormPrice(e.target.value)}
                  placeholder="89.00 (optional)"
                  className="pl-7 bg-zinc-950 border-zinc-800 text-xs text-zinc-100"
                />
              </div>
              <p className="text-[10px] text-zinc-500">Leave blank for custom quotes / free</p>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="svc-desc" className="text-xs text-zinc-200">
              Description
            </Label>
            <textarea
              id="svc-desc"
              rows={3}
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              placeholder="Describe what's included in this service..."
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>

          {/* Settings / Toggles */}
          <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formRequiresAddress}
                onChange={e => setFormRequiresAddress(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span className="text-xs text-zinc-300">
                Requires customer address during booking (on-site service)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={formIsActive}
                onChange={e => setFormIsActive(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-950 text-blue-600 focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span className="text-xs text-zinc-300">
                Active and visible on public booking page
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="text-xs border-zinc-800 hover:bg-zinc-800 text-zinc-300"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-blue-600 hover:bg-blue-500 text-xs text-white"
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
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Historical Data Protection</span>
            </div>
            <p className="leading-relaxed">
              If this service is linked to existing appointments or jobs, it will be safely <strong className="text-zinc-200">deactivated</strong> rather than deleted so all past customer history and reporting remain intact.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeletingService(null)}
              className="text-xs border-zinc-800 text-zinc-300"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-500 text-xs text-white"
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
