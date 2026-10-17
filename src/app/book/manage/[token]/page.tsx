'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  RefreshCw,
  CalendarDays,
  ChevronRight,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'

interface AppointmentDetail {
  id: string
  title: string
  serviceType: string
  startTime: string
  endTime?: string | null
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'scheduled'
  cancellationReason?: string | null
  confirmedAt?: string | null
  notes?: string | null
  business: {
    name: string
    slug: string
    phone?: string | null
    timezone: string
  }
  customer: {
    name?: string | null
    phone: string
    email?: string | null
    address?: string | null
  }
  service?: {
    name: string
    durationMinutes: number
    price?: number | null
  } | null
}

interface AvailableSlot {
  startTime: string
  endTime: string
  displayTime: string
  date: string
}

export default function CustomerManageAppointmentPage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apt, setApt] = useState<AppointmentDetail | null>(null)

  // Reschedule state
  const [showReschedule, setShowReschedule] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleError, setRescheduleError] = useState<string | null>(null)

  // Cancel state
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // 1. Fetch appointment details
  const loadAppointment = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/book/manage/${token}`)
      if (!res.ok) {
        setError('Appointment not found or link has expired.')
        return
      }
      const data = await res.json()
      setApt(data.appointment)
    } catch {
      setError('Unable to load appointment details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAppointment()
  }, [token])

  // Selectable dates for rescheduling (next 14 days)
  const selectableDates = useMemo(() => {
    const dates: Array<{ dateStr: string; label: string; dayOfWeek: string }> = []
    const today = new Date()
    for (let i = 0; i < 14; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      dates.push({
        dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' })
      })
    }
    return dates
  }, [])

  // When opening reschedule, default to tomorrow
  useEffect(() => {
    if (showReschedule && selectableDates.length > 1 && !selectedDate) {
      setSelectedDate(selectableDates[1].dateStr)
    }
  }, [showReschedule, selectableDates, selectedDate])

  // Fetch slots for reschedule
  useEffect(() => {
    if (!showReschedule || !apt?.business?.slug || !selectedDate) return

    async function fetchRescheduleSlots() {
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        const res = await fetch(`/api/book/${apt?.business.slug}/slots?date=${selectedDate}`)
        if (res.ok) {
          const data = await res.json()
          setAvailableSlots(data.slots || [])
        } else {
          setAvailableSlots([])
        }
      } catch {
        setAvailableSlots([])
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchRescheduleSlots()
  }, [showReschedule, apt?.business?.slug, selectedDate])

  // 2. Submit Reschedule
  const handleRescheduleSubmit = async () => {
    if (!selectedSlot) return
    setRescheduling(true)
    setRescheduleError(null)

    try {
      const res = await fetch(`/api/book/manage/${token}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newStartTime: selectedSlot.startTime })
      })

      const data = await res.json()
      if (!res.ok) {
        setRescheduleError(data.error || 'Failed to reschedule. Please choose another time.')
        return
      }

      setShowReschedule(false)
      await loadAppointment()
    } catch {
      setRescheduleError('A network error occurred. Please try again.')
    } finally {
      setRescheduling(false)
    }
  }

  // 3. Submit Cancel
  const handleCancelSubmit = async () => {
    setCancelling(true)
    setCancelError(null)

    try {
      const res = await fetch(`/api/book/manage/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason })
      })

      const data = await res.json()
      if (!res.ok) {
        setCancelError(data.error || 'Failed to cancel appointment.')
        return
      }

      setShowCancel(false)
      await loadAppointment()
    } catch {
      setCancelError('A network error occurred. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent" />
          <p className="text-xs text-slate-500 dark:text-zinc-400">Loading your appointment...</p>
        </div>
      </div>
    )
  }

  if (error || !apt) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Appointment Not Found</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{error || 'This appointment link is invalid or has expired.'}</p>
        </div>
      </div>
    )
  }

  const startDate = new Date(apt.startTime)
  const isCancelled = apt.status === 'cancelled'
  const isCompleted = apt.status === 'completed'
  const isActionable = !isCancelled && !isCompleted

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-8 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Business Branding */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">Appointment Manager</p>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">{apt.business.name}</h1>
          {apt.business.phone && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-center gap-1">
              <Phone className="h-3 w-3 text-blue-600 dark:text-blue-400" />
              <span>{apt.business.phone}</span>
            </p>
          )}
        </div>

        {/* Status Alert Banner */}
        <div className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
          apt.status === 'confirmed'
            ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            : apt.status === 'requested'
            ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
            : apt.status === 'cancelled'
            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300'
            : 'bg-slate-100 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300'
        }`}>
          {apt.status === 'confirmed' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          {apt.status === 'requested' && <Clock className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />}
          {apt.status === 'cancelled' && <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-red-400" />}
          {apt.status === 'completed' && <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />}

          <div>
            <span className="font-bold block capitalize text-sm">
              Status: {apt.status}
            </span>
            <span className="text-[11px] opacity-90">
              {apt.status === 'confirmed' && 'Your appointment is confirmed and booked on the schedule.'}
              {apt.status === 'requested' && 'Your request has been received and is waiting for owner approval.'}
              {apt.status === 'cancelled' && (apt.cancellationReason ? `Cancelled: ${apt.cancellationReason}` : 'This appointment has been cancelled.')}
              {apt.status === 'completed' && 'This service appointment has been marked completed.'}
            </span>
          </div>
        </div>

        {/* Appointment Card */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4 shadow-sm">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">{apt.serviceType || apt.title}</h2>
              {apt.service?.durationMinutes && (
                <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  {apt.service.durationMinutes} minutes
                </p>
              )}
            </div>
            {apt.service?.price !== null && apt.service?.price !== undefined && (
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                ${apt.service.price.toFixed(2)}
              </span>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center gap-3 text-slate-700 dark:text-zinc-300">
              <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                {startDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            <div className="flex items-center gap-3 text-slate-700 dark:text-zinc-300">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span>
                {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} ({apt.business.timezone})
              </span>
            </div>

            {apt.customer.address && (
              <div className="flex items-center gap-3 text-slate-700 dark:text-zinc-300">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>{apt.customer.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* Add to Calendar Sync Buttons */}
        {apt.status !== 'cancelled' && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/90 p-4 space-y-2.5 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider block">
              Sync to Calendar
            </span>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={generateGoogleCalendarUrl({
                  title: `${apt.title || 'Service'} with ${apt.business.name}`,
                  description: `Appointment with ${apt.business.name}.\nManage appointment: ${typeof window !== 'undefined' ? window.location.href : ''}`,
                  location: apt.customer.address || undefined,
                  startTime: apt.startTime,
                  endTime: apt.endTime || undefined,
                  url: typeof window !== 'undefined' ? window.location.href : undefined,
                })}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/90 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>Google Calendar</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  downloadIcsFile({
                    title: `${apt.title || 'Service'} with ${apt.business.name}`,
                    description: `Appointment with ${apt.business.name}.\nManage appointment: ${window.location.href}`,
                    location: apt.customer.address || undefined,
                    startTime: apt.startTime,
                    endTime: apt.endTime || undefined,
                    url: window.location.href,
                  }, `appointment-${token.substring(0, 8)}.ics`)
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/90 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Apple / Outlook</span>
              </button>
            </div>
          </div>
        )}

        {/* Customer Action Buttons */}
        {isActionable && !showReschedule && !showCancel && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setShowReschedule(true)}
              className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reschedule Time</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="py-3 px-4 rounded-xl border border-rose-200 dark:border-red-500/30 bg-rose-50 dark:bg-red-500/10 hover:bg-rose-100 dark:hover:bg-red-500/20 text-rose-700 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel Appointment</span>
            </button>
          </div>
        )}

        {/* RESCHEDULE FLOW MODAL / INLINE VIEW */}
        {showReschedule && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-500/40 p-5 space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Choose a New Date & Time
              </h3>
              <button
                type="button"
                onClick={() => setShowReschedule(false)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Close
              </button>
            </div>

            {rescheduleError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-500/10 border border-rose-200 dark:border-red-500/20 text-rose-600 dark:text-red-400 text-xs">
                {rescheduleError}
              </div>
            )}

            {/* Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Select Date</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {selectableDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[65px] py-2.5 px-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white font-bold'
                          : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-[10px] uppercase">{item.dayOfWeek}</span>
                      <span className="text-xs font-black mt-0.5">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time Slot Grid */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Select Available Time</label>
              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2 py-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-9 rounded-xl bg-slate-200 dark:bg-zinc-800/40 animate-pulse" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-zinc-500 py-4 text-center">No available slots for this date.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        {slot.displayTime}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReschedule(false)}
                className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!selectedSlot || rescheduling}
                onClick={handleRescheduleSubmit}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        )}

        {/* CANCEL FLOW CONFIRMATION */}
        {showCancel && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-red-500/40 p-5 space-y-4 shadow-md">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-600 dark:text-red-400" />
              Cancel Appointment
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>

            {cancelError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-red-500/10 border border-rose-200 dark:border-red-500/20 text-rose-600 dark:text-red-400 text-xs">
                {cancelError}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                Reason for cancellation <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Schedule conflict, service no longer needed, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs focus:outline-hidden focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="py-2.5 px-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Keep Appointment
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelSubmit}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}

        {/* If Cancelled: Link to re-book */}
        {isCancelled && apt.business.slug && (
          <div className="text-center pt-2">
            <a
              href={`/book/${apt.business.slug}`}
              className="inline-flex items-center gap-2 py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <span>Book a New Appointment</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        )}

        <div className="text-center text-[11px] text-slate-400 dark:text-zinc-500 flex items-center justify-center gap-1.5 pt-4">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
          <span>Secure direct link powered by CaptoDesk</span>
        </div>

      </div>
    </div>
  )
}
