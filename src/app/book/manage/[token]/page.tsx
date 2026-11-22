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
  ChevronLeft,
  ShieldCheck,
  Truck,
  Navigation,
  Wrench,
  ExternalLink,
  User,
  Sparkles,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'
import { PoweredByBadge } from '@/components/brand/powered-by-badge'
import { formatDateInTz, formatTimeInTz, getFriendlyTimezoneLabel } from '@/lib/temporal/timezone'
import { getSelectableDatesInTimezone } from '@/lib/booking/availability'
import { cn } from '@/lib/utils'

interface AppointmentDetail {
  id: string
  title: string
  serviceType: string
  startTime: string
  endTime?: string | null
  durationMinutes?: number
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
    id?: string
    name: string
    durationMinutes: number
    price?: number | null
    pricingModel?: string
    description?: string | null
  } | null
  tracking?: {
    token: string
    url: string
    jobNumber?: string | null
    jobStatus: string
    etaMinutes?: number | null
    enRouteAt?: string | null
    arrivedAt?: string | null
    startedAt?: string | null
    completedAt?: string | null
  } | null
}

interface AvailableSlot {
  startTime: string
  endTime: string
  displayTime: string
  date: string
}

const COMMON_CANCEL_REASONS = [
  'Schedule conflict',
  'Found another provider',
  'Issue resolved itself',
  'Need different service',
  'Other reason'
]

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
  const [rescheduleSuccess, setRescheduleSuccess] = useState<string | null>(null)

  // Cancel state
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [selectedReasonChip, setSelectedReasonChip] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // 1. Fetch appointment details
  const loadAppointment = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
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
    const tz = apt?.business?.timezone || 'America/Chicago'
    return getSelectableDatesInTimezone(tz, 14)
  }, [apt?.business?.timezone])

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
      setRescheduleError(null)
      try {
        const serviceQuery = apt?.service?.id ? `&serviceId=${encodeURIComponent(apt.service.id)}` : ''
        const tokenQuery = token ? `&manageToken=${encodeURIComponent(token)}` : ''
        const res = await fetch(`/api/book/${apt?.business.slug}/slots?date=${selectedDate}${serviceQuery}${tokenQuery}`)
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
  }, [showReschedule, apt?.business?.slug, selectedDate, token, apt?.service?.id])

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
        setRescheduleError(data.error || 'Failed to reschedule. Please choose another time slot.')
        return
      }

      setShowReschedule(false)
      setRescheduleSuccess('Appointment successfully rescheduled to your new preferred time!')
      setTimeout(() => setRescheduleSuccess(null), 5000)
      await loadAppointment()
    } catch {
      setRescheduleError('A network error occurred. Your current appointment remains active. Please try again.')
    } finally {
      setRescheduling(false)
    }
  }

  // 3. Submit Cancel
  const handleCancelSubmit = async () => {
    setCancelling(true)
    setCancelError(null)

    const finalReason = selectedReasonChip
      ? (cancelReason.trim() ? `${selectedReasonChip}: ${cancelReason.trim()}` : selectedReasonChip)
      : (cancelReason.trim() || 'Cancelled by customer')

    try {
      const res = await fetch(`/api/book/manage/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason })
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
          <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">Loading your appointment details...</p>
        </div>
      </div>
    )
  }

  if (error || !apt) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 text-center space-y-4 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Appointment Link Not Found</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              {error || 'This appointment link is either invalid, expired, or has already been fulfilled.'}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500">
            Please check the text message or email you received, or contact the service provider directly.
          </p>
        </div>
      </div>
    )
  }

  const timezone = apt.business.timezone || 'America/Chicago'
  const startDate = new Date(apt.startTime)
  const endDate = apt.endTime ? new Date(apt.endTime) : new Date(startDate.getTime() + (apt.durationMinutes || 60) * 60 * 1000)
  const formattedDate = formatDateInTz(startDate, timezone, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const formattedStartTime = formatTimeInTz(startDate, timezone)
  const formattedEndTime = formatTimeInTz(endDate, timezone)
  const tzLabel = getFriendlyTimezoneLabel(timezone, startDate)

  const isCancelled = apt.status === 'cancelled'
  const isCompleted = apt.status === 'completed' || apt.tracking?.jobStatus === 'completed'
  const isEnRoute = apt.tracking?.jobStatus === 'en_route'
  const isInProgress = apt.tracking?.jobStatus === 'in_progress' || apt.tracking?.jobStatus === 'arrived'
  const isActionable = !isCancelled && !isCompleted && !isEnRoute && !isInProgress

  const referenceCode = `#APT-${apt.id.substring(0, 8).toUpperCase()}`

  // Canonical Pricing Model breakdown
  const pricingModel = apt.service?.pricingModel || 'fixed'
  const isStartingAt = pricingModel === 'starting_at'
  const isQuoteOnSite = pricingModel === 'quote_on_site'
  const isDiagnosticFee = pricingModel === 'diagnostic_fee'
  const isFreeEstimate = pricingModel === 'free_estimate'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-8 px-4 sm:px-6">
      <div className="max-w-lg mx-auto space-y-6">

        {/* 1. BUSINESS BRANDING HERO */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <ShieldCheck className="h-3 w-3" />
            <span>Secure Appointment Portal</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {apt.business.name}
          </h1>

          <div className="flex items-center justify-center gap-3 text-xs text-slate-500 dark:text-zinc-400">
            <span className="font-mono font-bold">{referenceCode}</span>
            {apt.business.phone && (
              <>
                <span>•</span>
                <a
                  href={`tel:${apt.business.phone}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Phone className="h-3 w-3" />
                  <span>{apt.business.phone}</span>
                </a>
              </>
            )}
          </div>
        </div>

        {/* Reschedule Success Alert Banner */}
        {rescheduleSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in duration-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold block">Rescheduled Successfully!</span>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">{rescheduleSuccess}</p>
            </div>
          </div>
        )}

        {/* 2. STATE-AWARE STATUS BANNER */}
        <div className={cn(
          "p-4 rounded-2xl border text-xs flex items-center gap-3 shadow-xs",
          apt.status === 'confirmed'
            ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
            : apt.status === 'requested'
            ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300"
            : apt.status === 'cancelled'
            ? "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300"
            : "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30 text-blue-800 dark:text-blue-300"
        )}>
          {apt.status === 'confirmed' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
          {apt.status === 'requested' && <Clock className="h-5 w-5 shrink-0 text-amber-500 dark:text-amber-400" />}
          {apt.status === 'cancelled' && <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />}
          {apt.status === 'completed' && <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />}

          <div className="flex-1">
            <span className="font-bold block capitalize text-sm">
              Status: {apt.status}
            </span>
            <span className="text-[11px] opacity-90 leading-relaxed block">
              {apt.status === 'confirmed' && 'Your appointment is confirmed and reserved on the schedule.'}
              {apt.status === 'requested' && 'Your booking request has been received and is waiting for contractor confirmation.'}
              {apt.status === 'cancelled' && (apt.cancellationReason ? `Cancelled: ${apt.cancellationReason}` : 'This appointment has been cancelled.')}
              {apt.status === 'completed' && 'This service appointment has been marked completed.'}
            </span>
          </div>
        </div>

        {/* 3. PRIMARY APPOINTMENT DETAILS CARD */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4 shadow-xs">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                Scheduled Service
              </span>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {apt.serviceType || apt.title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                <span>{apt.durationMinutes || apt.service?.durationMinutes || 60} minutes estimated</span>
              </p>
            </div>

            {apt.service?.price !== null && apt.service?.price !== undefined && Number(apt.service.price) > 0 ? (
              <div className="text-right">
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 px-2.5 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 block">
                  ${Number(apt.service.price).toFixed(2)}
                </span>
                {isStartingAt && (
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Starting Rate</span>
                )}
              </div>
            ) : (
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                {isQuoteOnSite ? "Quote On Site" : isFreeEstimate ? "Free Estimate" : "Assessment"}
              </span>
            )}
          </div>

          {/* Pricing description disclaimer */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
            {isStartingAt && "Base price covers standard arrival and inspection. Exact final total will be confirmed on-site before any additional work starts."}
            {isQuoteOnSite && "$0 due online. A clear written quote will be provided on-site before any work begins."}
            {isDiagnosticFee && "Diagnostic fee covers comprehensive inspection and troubleshooting, credited toward repair if approved."}
            {isFreeEstimate && "$0.00 complimentary on-site consultation. No obligation or payment required."}
            {pricingModel === 'fixed' && "All inclusive fixed rate for this scheduled service."}
          </div>

          {/* Visit Window and Location */}
          <div className="space-y-3 text-xs pt-1">
            <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
              <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  {formattedDate}
                </span>
                <span className="text-slate-500 dark:text-zinc-400">
                  {formattedStartTime} - {formattedEndTime} ({tzLabel})
                </span>
              </div>
            </div>

            {apt.customer.address && (
              <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
                <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Service Address
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400">
                    {apt.customer.address}
                  </span>
                </div>
              </div>
            )}

            {apt.customer.name && (
              <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white block">
                    Customer
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400">
                    {apt.customer.name} • {apt.customer.phone}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 4. LIVE SERVICE ARRIVAL TRACKER CARD (State-Aware) */}
        {apt.status !== 'cancelled' && apt.tracking && (
          <div className={cn(
            "rounded-2xl border p-4 sm:p-5 space-y-3 shadow-xs transition-all",
            isEnRoute
              ? "bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent border-blue-400 dark:border-blue-700 ring-2 ring-blue-500/20"
              : isInProgress
              ? "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-400 dark:border-emerald-700 ring-2 ring-emerald-500/20"
              : isCompleted
              ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60"
              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "p-2 rounded-xl text-white shadow-2xs shrink-0",
                  isEnRoute ? "bg-blue-600 animate-pulse" :
                  isInProgress ? "bg-emerald-600" :
                  isCompleted ? "bg-emerald-700" : "bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900"
                )}>
                  {isEnRoute ? <Truck className="h-4 w-4" /> :
                   isInProgress ? <Wrench className="h-4 w-4" /> :
                   isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
                   <Navigation className="h-4 w-4" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    {isEnRoute ? "Technician On The Way!" :
                     isInProgress ? "Service In Progress" :
                     isCompleted ? "Service Completed" :
                     "Live Arrival Tracking"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                    {isEnRoute && apt.tracking.etaMinutes ? `Estimated Arrival: ~${apt.tracking.etaMinutes} mins` :
                     isEnRoute ? "Technician is driving to your property" :
                     isInProgress ? "Technician is on-site performing work" :
                     isCompleted ? "Work has been completed and verified" :
                     "Real-time GPS tracking on service day"}
                  </p>
                </div>
              </div>

              {isEnRoute ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-ping" />
                  <span>En Route</span>
                </span>
              ) : isInProgress ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                  <span>On Site</span>
                </span>
              ) : isCompleted ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  Finished
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
                  Active On Day
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              {isEnRoute ? "Your service technician is in transit. Open live map to track their real-time location and arrival progress." :
               isInProgress ? "Your technician has arrived at your address and work is underway. You can view progress photos and job updates live." :
               isCompleted ? "Your service is complete. You can inspect technician before/after proof photos and view your final receipt." :
               "Once our technician dispatches to your address on your scheduled day, you can view their real-time location, live ETA, and photo updates."}
            </p>

            <a
              href={apt.tracking.url}
              className={cn(
                "w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer",
                isEnRoute
                  ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/25 ring-2 ring-blue-600/30"
                  : isInProgress
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/25"
                  : isCompleted
                  ? "bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-slate-900/10"
                  : "bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-100 border border-slate-200 dark:border-zinc-700 shadow-2xs"
              )}
            >
              {isEnRoute ? <Truck className="h-4 w-4" /> :
               isInProgress ? <Wrench className="h-4 w-4" /> :
               isCompleted ? <CheckCircle2 className="h-4 w-4" /> :
               <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              <span>
                {isEnRoute ? "Track Technician Live Arrival" :
                 isInProgress ? "View Live Work & Progress Photos" :
                 isCompleted ? "View Work Summary, Photos & Receipt" :
                 "Open Live Service Tracker"}
              </span>
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />
            </a>
          </div>
        )}

        {/* 5. ADD TO CALENDAR SYNC */}
        {apt.status !== 'cancelled' && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 space-y-2.5 shadow-xs">
            <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
              Add to Your Calendar
            </span>
            <div className="grid grid-cols-2 gap-2">
              <a
                href={generateGoogleCalendarUrl({
                  title: `${apt.title || 'Service'} with ${apt.business.name}`,
                  description: `Appointment with ${apt.business.name}.\nManage appointment: ${typeof window !== 'undefined' ? window.location.href : ''}`,
                  location: apt.customer.address || undefined,
                  startTime: apt.startTime,
                  endTime: apt.endTime || undefined,
                  url: typeof window !== 'undefined' ? window.location.href : undefined
                })}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
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
                    url: window.location.href
                  }, `appointment-${referenceCode.replace('#', '')}.ics`)
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Apple / Outlook</span>
              </button>
            </div>
          </div>
        )}

        {/* 6. COMPLETED SERVICE NOTICE */}
        {isCompleted && (
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 text-center space-y-3 shadow-xs">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Service Completed</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                This service appointment was completed by {apt.business.name}. Completed jobs cannot be rescheduled.
              </p>
            </div>
            {apt.business.slug && (
              <a
                href={`/book/${apt.business.slug}`}
                className="inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20"
              >
                Book a New Service
              </a>
            )}
          </div>
        )}

        {/* 7. EN ROUTE / IN PROGRESS SELF-SERVICE PAUSED NOTICE */}
        {(isEnRoute || isInProgress) && (
          <div className="p-4 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-200 flex items-start gap-3 shadow-2xs">
            <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block">
                {isEnRoute ? "Technician is currently en route to your property" : "Technician is currently working on-site"}
              </span>
              <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                Self-service rescheduling and cancellations are paused while field service is actively in progress. To make emergency changes, please call {apt.business.name} directly at {apt.business.phone || "the phone number above"}.
              </p>
            </div>
          </div>
        )}

        {/* 8. CUSTOMER SELF-SERVICE ACTION BUTTONS */}
        {isActionable && !showReschedule && !showCancel && (
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setShowReschedule(true)
                setShowCancel(false)
              }}
              className="flex-1 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reschedule Appointment</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowCancel(true)
                setShowReschedule(false)
              }}
              className="py-3.5 px-4 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <XCircle className="h-4 w-4" />
              <span>Cancel Appointment</span>
            </button>
          </div>
        )}

        {/* 9. RESCHEDULE EXPERIENCE */}
        {showReschedule && (
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-500/40 p-5 sm:p-6 space-y-5 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                  Select New Arrival Window
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Reschedule Appointment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReschedule(false)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Current Appointment reference banner */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-xs text-slate-600 dark:text-zinc-400 flex items-center justify-between">
              <div>
                <span className="font-semibold block text-slate-800 dark:text-zinc-200">Current Slot:</span>
                <span>{formattedDate} at {formattedStartTime}</span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                {apt.durationMinutes || 60} mins
              </span>
            </div>

            {rescheduleError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">Rescheduling Error</span>
                  <p className="text-[11px] leading-relaxed">{rescheduleError}</p>
                </div>
              </div>
            )}

            {/* Date Selection Rail */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Choose a Date
              </label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {selectableDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={cn(
                        "flex flex-col items-center justify-center min-w-[65px] py-2.5 px-2 rounded-xl border transition-all shrink-0 cursor-pointer",
                        isSelected
                          ? "bg-blue-600 border-blue-500 text-white font-bold shadow-xs"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700"
                      )}
                    >
                      <span className="text-[10px] uppercase">{item.dayOfWeek}</span>
                      <span className="text-xs font-black mt-0.5">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Available Time Slots Grid */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Select Available Time Window
              </label>

              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2 py-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-slate-200 dark:bg-zinc-800/40 animate-pulse" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500 dark:text-zinc-400">
                  No open slots available for this date. Please pick another date above.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={cn(
                          "py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer",
                          isSelected
                            ? "bg-blue-600 border-blue-500 text-white font-bold shadow-xs"
                            : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                        )}
                      >
                        {slot.displayTime}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Selected Slot Confirmation Preview */}
            {selectedSlot && (
              <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
                <div>
                  <span className="font-bold block">New Appointment Window:</span>
                  <span>{selectedSlot.date} at {selectedSlot.displayTime}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowReschedule(false)}
                className="py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Keep Current Time
              </button>
              <button
                type="button"
                disabled={!selectedSlot || rescheduling}
                onClick={handleRescheduleSubmit}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
              >
                {rescheduling ? 'Confirming New Time...' : 'Confirm New Time'}
              </button>
            </div>
          </div>
        )}

        {/* 10. CANCEL EXPERIENCE WITH 2-STEP CONFIRMATION */}
        {showCancel && (
          <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-500/40 p-5 sm:p-6 space-y-4 shadow-lg animate-in fade-in duration-200">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cancel Your Appointment?
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  This will immediately release your time slot back to the public schedule.
                </p>
              </div>
            </div>

            {cancelError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                {cancelError}
              </div>
            )}

            {/* Quick-Select Cancellation Reason Pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                Why are you cancelling?
              </label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_CANCEL_REASONS.map((reason) => {
                  const isSelected = selectedReasonChip === reason
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReasonChip(isSelected ? '' : reason)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                        isSelected
                          ? "bg-rose-600 border-rose-600 text-white"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                      )}
                    >
                      {reason}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Additional details */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block">
                Additional Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Let the team know if there is anything they can help with..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs focus:outline-hidden focus:border-rose-500 resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Keep My Appointment
              </button>
              <button
                type="button"
                disabled={cancelling}
                onClick={handleCancelSubmit}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20 cursor-pointer"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        )}

        {/* 11. IF CANCELLED: RE-BOOK BUTTON */}
        {isCancelled && apt.business.slug && (
          <div className="text-center pt-2">
            <a
              href={`/book/${apt.business.slug}`}
              className="inline-flex items-center gap-2 py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <span>Book a New Appointment</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        )}

        {/* 12. DEMO OWNER DASHBOARD PREVIEW (Demo Org Only) */}
        {apt.business.slug?.includes('demo') && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 p-4 text-left space-y-2.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-amber-500 text-[11px] font-black uppercase tracking-wider">
              <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>⚡ Live Interactive Demo</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              See what the contractor sees in their dashboard
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
              Experience the full operational cycle! Click below to enter the live CaptoDesk business owner workspace without signing in. You can inspect this booked appointment, message history, calendar schedule, and field dispatch.
            </p>
            <a
              href="/demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
            >
              <span>Open Live Owner Dashboard (No Login Needed)</span>
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        )}

        {/* Universal Clickable Powered by CaptoDesk Badge */}
        <PoweredByBadge source="manage" className="pt-4 pb-2" />

      </div>
    </div>
  )
}
