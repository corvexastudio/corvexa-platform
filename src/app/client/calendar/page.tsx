'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  PhoneCall, 
  MessageSquare, 
  Plus, 
  CheckCircle2, 
  CalendarDays,
  Settings,
  ExternalLink,
  Check,
  X,
  XCircle,
  AlertCircle,
  Tag,
  Sliders,
  DollarSign
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'

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

export default function CalendarPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [orgId, setOrgId] = useState<string>('')
  const [orgTimezone, setOrgTimezone] = useState<string>('America/Chicago')

  // Settings Drawer / Modal State
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
      setOrgId(profile.org_id)

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
    try {
      const res = await fetch(`/api/client/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        toast.error('Failed to update appointment status.')
        return
      }

      toast.success(`Appointment marked as ${newStatus}`)
      await loadAppointments()
    } catch {
      toast.error('An error occurred while updating status.')
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
        toast.success('Booking settings updated successfully!')
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
        toast.success(`Service "${newServiceName}" added!`)
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

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'scheduled') return ['scheduled', 'confirmed'].includes(apt.status)
    return apt.status === statusFilter
  })

  const requestedCount = appointments.filter(a => a.status === 'requested').length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <CalendarIcon className="h-6 w-6 text-blue-500" />
            Appointments & Schedule
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time availability, bookings, and customer scheduling portal • <span className="text-zinc-300 font-medium">Timezone: {orgTimezone}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {orgSlug && (
            <a
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 flex items-center gap-1.5 transition-colors"
            >
              <span>Public Booking Page</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center gap-1.5 transition-colors"
          >
            <Settings className="h-3.5 w-3.5 text-zinc-400" />
            <span>Booking Rules</span>
          </button>
        </div>
      </div>

      {/* CONFIGURATION & SERVICES DRAWER */}
      {showSettings && (
        <div className="rounded-2xl border border-blue-500/30 bg-[#0D1322] p-5 sm:p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sliders className="h-4 w-4 text-blue-400" />
              Booking Rules & Service Catalog
            </h2>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-xs text-zinc-400 hover:text-white"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Booking Rules Form */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Availability Settings</h3>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Booking Confirmation Mode</label>
                <select
                  value={bookingConfig.booking_mode}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, booking_mode: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-zinc-800 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="instant">Instant Confirmation (Auto-books slot & schedules reminders)</option>
                  <option value="request">Booking Request (Requires owner approval from calendar)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Buffer Time (mins)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={bookingConfig.buffer_minutes}
                    onChange={(e) => setBookingConfig({ ...bookingConfig, buffer_minutes: parseInt(e.target.value, 10) || 0 })}
                    className="w-full p-2 rounded-xl bg-[#0B0F19] border border-zinc-800 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">Minimum Notice (hours)</label>
                  <input
                    type="number"
                    min="0"
                    value={bookingConfig.minimum_notice_hours}
                    onChange={(e) => setBookingConfig({ ...bookingConfig, minimum_notice_hours: parseInt(e.target.value, 10) || 0 })}
                    className="w-full p-2 rounded-xl bg-[#0B0F19] border border-zinc-800 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Max Booking Window (days in advance)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={bookingConfig.max_booking_days_ahead}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, max_booking_days_ahead: parseInt(e.target.value, 10) || 30 })}
                  className="w-full p-2 rounded-xl bg-[#0B0F19] border border-zinc-800 text-xs text-white"
                />
              </div>

              {/* Blocked Dates */}
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Blocked Dates (Blackouts)</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newBlockedDate}
                    onChange={(e) => setNewBlockedDate(e.target.value)}
                    className="flex-1 p-2 rounded-xl bg-[#0B0F19] border border-zinc-800 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddBlockedDate}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white"
                  >
                    Add
                  </button>
                </div>
                {bookingConfig.blocked_dates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {bookingConfig.blocked_dates.map((d) => (
                      <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-800 text-[11px] text-zinc-300">
                        {d}
                        <button type="button" onClick={() => handleRemoveBlockedDate(d)}>
                          <X className="h-3 w-3 text-red-400" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={savingConfig}
                onClick={handleSaveConfig}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                {savingConfig ? 'Saving...' : 'Save Availability Rules'}
              </button>
            </div>

            {/* Services Catalog */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Service Offerings</h3>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {services.map((svc) => (
                  <div key={svc.id} className="p-3 rounded-xl bg-[#0B0F19] border border-zinc-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-white block">{svc.name}</span>
                      <span className="text-zinc-400">{svc.duration_minutes} mins {svc.price ? `• $${svc.price}` : ''}</span>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                ))}
              </div>

              {/* Add Service Sub-Form */}
              <form onSubmit={handleAddService} className="p-3.5 rounded-xl bg-[#0B0F19] border border-zinc-800 space-y-2.5">
                <span className="text-xs font-bold text-zinc-300 block">Add New Service</span>
                <input
                  type="text"
                  required
                  placeholder="Service Name (e.g. AC Tune-Up)"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="15"
                    step="15"
                    placeholder="Duration (mins)"
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(e.target.value)}
                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price ($ optional)"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                    className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1 text-xs text-zinc-400">
                  <input
                    type="checkbox"
                    id="reqAddr"
                    checked={newServiceRequiresAddress}
                    onChange={(e) => setNewServiceRequiresAddress(e.target.checked)}
                    className="rounded bg-zinc-800 border-zinc-700"
                  />
                  <label htmlFor="reqAddr">Requires customer service address</label>
                </div>
                <button
                  type="submit"
                  disabled={addingService}
                  className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  {addingService ? 'Adding...' : 'Add Service'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* STATUS TABS */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'All Bookings', count: appointments.length },
          { key: 'requested', label: 'Requests', count: requestedCount, highlight: requestedCount > 0 },
          { key: 'confirmed', label: 'Confirmed', count: appointments.filter(a => ['confirmed', 'scheduled'].includes(a.status)).length },
          { key: 'completed', label: 'Completed', count: appointments.filter(a => a.status === 'completed').length },
          { key: 'cancelled', label: 'Cancelled', count: appointments.filter(a => a.status === 'cancelled').length }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : tab.highlight
                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                : 'bg-[#0D1322] text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-zinc-800 text-zinc-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Agenda Feed */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/70 mb-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Upcoming Bookings
          </h2>
          <span className="text-xs text-zinc-400">
            {filteredAppointments.length} matching appointments
          </span>
        </div>

        {error ? (
          <ErrorState
            title="Failed to load appointments"
            message={error}
            onRetry={loadAppointments}
            retryLabel="Retry Loading Appointments"
          />
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="rounded-xl bg-[#0B0F19] border border-zinc-800/80 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4">
                  <Skeleton className="h-12 w-12 rounded-xl bg-zinc-800 shrink-0" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48 bg-zinc-800" />
                    <Skeleton className="h-3 w-64 bg-zinc-800/60" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800" />
                  <Skeleton className="h-8 w-20 rounded-lg bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={statusFilter === 'all' ? 'No Upcoming Bookings on Calendar' : `No ${statusFilter} Appointments`}
            description="Homeowners can book service appointments online directly from your public booking page without phone tag, respecting your minimum notice hours and travel buffers."
            actionLabel={orgSlug ? 'Copy Public Booking Link' : undefined}
            onAction={
              orgSlug
                ? () => {
                    navigator.clipboard.writeText(`${window.location.origin}/book/${orgSlug}`)
                    toast.success('Public booking link copied!')
                  }
                : undefined
            }
            secondaryActionLabel="Adjust Booking Rules"
            onSecondaryAction={() => setShowSettings(true)}
            tip="Confirmed bookings automatically flow directly into your daily Jobs dispatch pipeline."
            compact
          />
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map(apt => (
              <div
                key={apt.id}
                className="rounded-xl bg-[#0B0F19] border border-zinc-800/80 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-zinc-700 transition-all shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shrink-0 text-blue-400">
                    <span className="text-xs font-black">
                      {new Date(apt.start_time).toLocaleDateString('en-US', { timeZone: orgTimezone, day: 'numeric' })}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-zinc-400">
                      {new Date(apt.start_time).toLocaleDateString('en-US', { timeZone: orgTimezone, month: 'short' })}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-white">
                        {apt.title}
                      </h3>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                        apt.status === 'confirmed' || apt.status === 'scheduled'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : apt.status === 'requested'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                          : apt.status === 'cancelled'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}>
                        {apt.status}
                      </span>
                      {apt.source && (
                        <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[9px] text-zinc-400 border border-zinc-700">
                          {apt.source}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span className="flex items-center gap-1 text-zinc-300 font-medium">
                        <Clock className="h-3 w-3 text-blue-400" />
                        {new Date(apt.start_time).toLocaleTimeString('en-US', { timeZone: orgTimezone, hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {apt.contact?.address && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <MapPin className="h-3 w-3" />
                          {apt.contact.address}
                        </span>
                      )}
                      <span>• {apt.contact?.name || apt.contact?.phone}</span>
                    </div>

                    {apt.notes && (
                      <p className="text-[11px] text-zinc-500 mt-1.5 italic">
                        Note: {apt.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Owner Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  {apt.status === 'requested' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md shadow-emerald-600/20"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {['requested', 'confirmed', 'scheduled'].includes(apt.status) && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(apt.id, 'completed')}
                      className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold"
                    >
                      Done
                    </button>
                  )}

                  {['requested', 'confirmed', 'scheduled'].includes(apt.status) && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Cancel Booking"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {apt.contact?.phone && (
                    <a
                      href={`tel:${apt.contact.phone}`}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                      title="Call customer"
                    >
                      <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                    </a>
                  )}

                  {apt.manage_token && (
                    <a
                      href={`/book/manage/${apt.manage_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                      title="Open customer portal"
                    >
                      <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
