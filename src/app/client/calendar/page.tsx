'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  PhoneCall, 
  Check, 
  X, 
  XCircle, 
  Sliders, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  CalendarDays,
  Plus,
  Trash2,
  Globe
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'

interface AppointmentItem {
  id: string
  title: string
  service_type?: string | null
  start_time: string
  end_time?: string | null
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'scheduled'
  source?: string | null
  manage_token?: string | null
  notes?: string | null
  contact: {
    id?: string
    name?: string | null
    phone: string
    address?: string | null
  }
}

interface ServiceItem {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price?: number | null
  requires_address: boolean
  is_active: boolean
}

function getAppointmentBadge(status: AppointmentItem['status']) {
  switch (status) {
    case 'confirmed':
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Confirmed
        </span>
      )
    case 'requested':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Pending Approval
        </span>
      )
    case 'completed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
          Completed
        </span>
      )
    case 'cancelled':
    case 'no_show':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          {status === 'no_show' ? 'No Show' : 'Cancelled'}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          {status}
        </span>
      )
  }
}

export default function CalendarPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [orgTimezone, setOrgTimezone] = useState<string>('America/Chicago')
  const [copiedLink, setCopiedLink] = useState(false)

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [bookingConfig, setBookingConfig] = useState({
    booking_mode: 'instant',
    default_duration_minutes: 60,
    buffer_minutes: 15,
    minimum_notice_hours: 2,
    max_booking_days_ahead: 30,
    blocked_dates: [] as string[]
  })
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  // New Service Form
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceDuration, setNewServiceDuration] = useState('60')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceRequiresAddress, setNewServiceRequiresAddress] = useState(true)
  const [addingService, setAddingService] = useState(false)

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setError('Authentication required to view calendar.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (profileErr || !profile) {
        setError('Failed to resolve organization profile.')
        setLoading(false)
        return
      }

      // Load Org Settings & Timezone
      const { data: org } = await supabase
        .from('organizations')
        .select('slug, timezone, booking_mode, default_duration_minutes, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates')
        .eq('id', profile.org_id)
        .single()

      if (org) {
        setOrgSlug(org.slug || '')
        if (org.timezone) setOrgTimezone(org.timezone)
        setBookingConfig({
          booking_mode: org.booking_mode || 'instant',
          default_duration_minutes: org.default_duration_minutes || 60,
          buffer_minutes: org.buffer_minutes ?? 15,
          minimum_notice_hours: org.minimum_notice_hours ?? 2,
          max_booking_days_ahead: org.max_booking_days_ahead ?? 30,
          blocked_dates: org.blocked_dates || []
        })
      }

      // Load Appointments
      const { data, error: aptsErr } = await supabase
        .from('appointments')
        .select(`
          id, title, service_type, start_time, end_time, status, source, manage_token, notes,
          contact:contacts(id, name, phone, address)
        `)
        .eq('org_id', profile.org_id)
        .order('start_time', { ascending: true })

      if (aptsErr) {
        setError('Failed to load appointments. Please retry.')
      } else if (data) {
        const enriched: AppointmentItem[] = data.map((a: any) => ({
          ...a,
          contact: Array.isArray(a.contact) ? a.contact[0] : a.contact
        }))
        setAppointments(enriched)
      }

      // Load Services
      const { data: svcs } = await supabase
        .from('services')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('sort_order', { ascending: true })

      if (svcs) {
        setServices(svcs)
      }
    } catch {
      setError('An unexpected error occurred while loading schedule.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  // Status Action Handler
  const handleUpdateStatus = async (appointmentId: string, newStatus: string) => {
    // Optimistic update
    setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus as any } : a))

    try {
      const res = await fetch(`/api/client/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        toast.error('Failed to update appointment status.')
        loadAppointments()
        return
      }

      toast.success(`Appointment marked as ${newStatus}`)
    } catch {
      toast.error('An error occurred while updating status.')
      loadAppointments()
    }
  }

  // Save Booking Rules Configuration
  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/client/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingConfig)
      })

      if (res.ok) {
        toast.success('Booking settings updated successfully')
        setShowSettings(false)
      } else {
        toast.error('Failed to save settings.')
      }
    } catch {
      toast.error('Network error saving settings.')
    } finally {
      setSavingConfig(false)
    }
  }

  // Add Blocked Date
  const handleAddBlockedDate = () => {
    if (!newBlockedDate || bookingConfig.blocked_dates.includes(newBlockedDate)) return
    setBookingConfig({
      ...bookingConfig,
      blocked_dates: [...bookingConfig.blocked_dates, newBlockedDate]
    })
    setNewBlockedDate('')
  }

  // Remove Blocked Date
  const handleRemoveBlockedDate = (dateToRemove: string) => {
    setBookingConfig({
      ...bookingConfig,
      blocked_dates: bookingConfig.blocked_dates.filter(d => d !== dateToRemove)
    })
  }

  // Create New Service
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newServiceName.trim()) return

    setAddingService(true)
    try {
      const res = await fetch('/api/client/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServiceName,
          duration_minutes: parseInt(newServiceDuration, 10),
          price: newServicePrice ? parseFloat(newServicePrice) : null,
          requires_address: newServiceRequiresAddress
        })
      })

      if (res.ok) {
        toast.success(`Service "${newServiceName}" created`)
        setNewServiceName('')
        setNewServicePrice('')
        await loadAppointments()
      } else {
        toast.error('Failed to add service.')
      }
    } catch {
      toast.error('Error creating service.')
    } finally {
      setAddingService(false)
    }
  }

  const handleCopyBookingLink = () => {
    if (!orgSlug) return
    const url = `${window.location.origin}/book/${orgSlug}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    toast.success('Public booking URL copied to clipboard')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'confirmed') return ['confirmed', 'scheduled'].includes(apt.status)
    return apt.status === statusFilter
  })

  const requestedCount = appointments.filter(a => a.status === 'requested').length

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Schedule & Bookings
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {appointments.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time calendar agenda, customer booking requests, and availability rules • <span className="text-zinc-300">{orgTimezone}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {orgSlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyBookingLink}
              className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
              )}
              <span>Copy Booking Link</span>
            </Button>
          )}

          {orgSlug && (
            <a
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-blue-400" />
              <span>Public Page</span>
            </a>
          )}

          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
          >
            <Sliders className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
            <span>Booking Rules</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'All Bookings', count: appointments.length },
          { key: 'requested', label: 'Requests', count: requestedCount, isAlert: requestedCount > 0 },
          { key: 'confirmed', label: 'Confirmed', count: appointments.filter(a => ['confirmed', 'scheduled'].includes(a.status)).length },
          { key: 'completed', label: 'Completed', count: appointments.filter(a => a.status === 'completed').length },
          { key: 'cancelled', label: 'Cancelled', count: appointments.filter(a => a.status === 'cancelled').length }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
              statusFilter === tab.key
                ? "bg-zinc-800 text-white"
                : tab.isAlert
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            )}
          >
            <span>{tab.label}</span>
            <span className={cn(
              "text-[10px] px-1 py-0.2 rounded tabular-nums",
              statusFilter === tab.key ? "bg-zinc-950 text-white" : "bg-zinc-900 text-zinc-500"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Agenda Section */}
      {error ? (
        <ErrorState
          title="Failed to load appointments"
          message={error}
          onRetry={loadAppointments}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40 bg-zinc-800" />
                  <Skeleton className="h-3 w-56 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 bg-zinc-800" />
                <Skeleton className="h-8 w-24 bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={statusFilter === 'all' ? 'No Bookings on Calendar' : `No ${statusFilter} Appointments`}
          description="Online bookings from your public scheduling page appear here automatically, respecting travel buffers and lead times."
          actionLabel={orgSlug ? 'Copy Public Booking Link' : undefined}
          onAction={orgSlug ? handleCopyBookingLink : undefined}
          secondaryActionLabel="Review Booking Rules"
          onSecondaryAction={() => setShowSettings(true)}
        />
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900 divide-y divide-zinc-800">
          {filteredAppointments.map(apt => {
            const startDate = new Date(apt.start_time)

            return (
              <div
                key={apt.id}
                className="p-4 hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Date badge */}
                  <div className="h-10 w-12 rounded border border-zinc-800 bg-zinc-950 flex flex-col items-center justify-center shrink-0 text-zinc-300">
                    <span className="text-xs font-bold tabular-nums">
                      {startDate.toLocaleDateString('en-US', { timeZone: orgTimezone, day: 'numeric' })}
                    </span>
                    <span className="text-[10px] uppercase text-zinc-500">
                      {startDate.toLocaleDateString('en-US', { timeZone: orgTimezone, month: 'short' })}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-xs text-zinc-100 truncate">
                        {apt.title}
                      </h2>
                      {getAppointmentBadge(apt.status)}
                      {apt.source && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-950 text-zinc-500 border border-zinc-800">
                          {apt.source}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                      <span className="flex items-center gap-1 text-zinc-300 font-medium tabular-nums">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {startDate.toLocaleTimeString('en-US', { timeZone: orgTimezone, hour: 'numeric', minute: '2-digit' })}
                      </span>

                      <span>• {apt.contact?.name || apt.contact?.phone}</span>

                      {apt.contact?.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(apt.contact.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 truncate max-w-xs"
                        >
                          <MapPin className="h-3 w-3 text-zinc-500 shrink-0" />
                          <span className="truncate">{apt.contact.address}</span>
                        </a>
                      )}
                    </div>

                    {apt.notes && (
                      <p className="text-xs text-zinc-500 line-clamp-1 italic pt-0.5">
                        {apt.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  {apt.status === 'requested' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                      className="h-7.5 px-3 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Approve
                    </Button>
                  )}

                  {['requested', 'confirmed', 'scheduled'].includes(apt.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(apt.id, 'completed')}
                      className="h-7.5 px-2.5 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    >
                      Complete
                    </Button>
                  )}

                  {['requested', 'confirmed', 'scheduled'].includes(apt.status) && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Cancel Booking"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}

                  {apt.contact?.phone && (
                    <a
                      href={`tel:${apt.contact.phone}`}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition-colors"
                      title="Call customer"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                    </a>
                  )}

                  {apt.manage_token && (
                    <a
                      href={`/book/manage/${apt.manage_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Open customer portal"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Booking Rules & Services Modal */}
      <Modal
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Booking Rules & Services"
        description="Configure automated slot availability, buffers, and services catalog."
        size="lg"
      >
        <div className="space-y-5">
          {/* Rules Form */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Availability Settings
            </h3>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Confirmation Mode
              </label>
              <select
                aria-label="Confirmation Mode"
                value={bookingConfig.booking_mode}
                onChange={(e) => setBookingConfig({ ...bookingConfig, booking_mode: e.target.value as any })}
                className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="instant">Instant Confirmation (Auto-confirms slot & schedules SMS reminder)</option>
                <option value="request">Booking Request (Requires approval from calendar)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Buffer Time (mins)</label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={bookingConfig.buffer_minutes}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, buffer_minutes: parseInt(e.target.value, 10) || 0 })}
                  className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Minimum Notice (hours)</label>
                <Input
                  type="number"
                  min="0"
                  value={bookingConfig.minimum_notice_hours}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, minimum_notice_hours: parseInt(e.target.value, 10) || 0 })}
                  className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Max Advance Booking (days)</label>
              <Input
                type="number"
                min="1"
                max="90"
                value={bookingConfig.max_booking_days_ahead}
                onChange={(e) => setBookingConfig({ ...bookingConfig, max_booking_days_ahead: parseInt(e.target.value, 10) || 30 })}
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
            </div>

            {/* Blackout Dates */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Blocked Blackout Dates</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddBlockedDate}
                  className="h-8.5 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                >
                  Block Date
                </Button>
              </div>

              {bookingConfig.blocked_dates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {bookingConfig.blocked_dates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300">
                      {d}
                      <button type="button" onClick={() => handleRemoveBlockedDate(d)}>
                        <X className="h-3 w-3 text-zinc-500 hover:text-rose-400" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              disabled={savingConfig}
              onClick={handleSaveConfig}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {savingConfig ? 'Saving...' : 'Save Availability Rules'}
            </Button>
          </div>

          {/* Services Catalog */}
          <div className="space-y-3 pt-3 border-t border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
              Service Catalog
            </h3>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {services.map((svc) => (
                <div key={svc.id} className="p-2.5 rounded bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-zinc-200 block">{svc.name}</span>
                    <span className="text-[11px] text-zinc-500">{svc.duration_minutes} mins {svc.price ? `• $${svc.price}` : ''}</span>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
              ))}
            </div>

            {/* Add Service Sub-Form */}
            <form onSubmit={handleAddService} className="p-3 rounded-md bg-zinc-950 border border-zinc-800 space-y-2">
              <span className="text-xs font-medium text-zinc-300 block">Add New Service Offering</span>
              <Input
                type="text"
                required
                placeholder="Service Name (e.g. Diagnostic & Tune-Up)"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="15"
                  step="15"
                  placeholder="Duration (mins)"
                  value={newServiceDuration}
                  onChange={(e) => setNewServiceDuration(e.target.value)}
                  className="h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Price ($ optional)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <input
                  type="checkbox"
                  id="reqAddr"
                  checked={newServiceRequiresAddress}
                  onChange={(e) => setNewServiceRequiresAddress(e.target.checked)}
                  className="rounded bg-zinc-900 border-zinc-700"
                />
                <label htmlFor="reqAddr">Requires service address</label>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={addingService}
                className="h-7.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {addingService ? 'Adding...' : 'Add Service'}
              </Button>
            </form>
          </div>
        </div>
      </Modal>

    </div>
  )
}
