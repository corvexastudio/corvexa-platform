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
  Truck,
  Navigation,
  Wrench,
  ExternalLink,
  User,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  Building2,
  Share2,
  Check,
  HelpCircle,
  Sparkles,
  Receipt,
  RotateCcw,
  Star
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
  cancellationNoticeHours?: number
  isWithinCancellationCutoff?: boolean
  business: {
    name: string
    slug: string
    phone?: string | null
    timezone: string
    subscriptionStatus?: string
    logoUrl?: string | null
    industry?: string | null
    googleReviewUrl?: string | null
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
    addOns?: Array<{
      id?: string
      name: string
      price: number
      durationMinutes?: number
      quantity?: number
    }>
    pricingSource?: 'historical_snapshot' | 'historical_line_items' | 'catalog_fallback' | 'unavailable'
    pricingSummary?: {
      basePrice: number
      addOnsTotal: number
      estimatedTotal: number
    }
  } | null
  invoice?: {
    id: string
    invoiceNumber: string
    title?: string | null
    status: string
    financialStatus: 'unpaid' | 'partially_paid' | 'paid' | 'partially_refunded' | 'fully_refunded' | 'voided'
    total: number
    amountDue: number
    amountPaid?: number
    totalPaid?: number
    totalRefunded: number
    dueDate?: string | null
    paidAt?: string | null
    pdfUrl?: string | null
    receiptUrl?: string | null
    manageToken?: string | null
    hasMultipleInvoices?: boolean
    multipleInvoicesCount?: number
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
  feedback?: {
    rating: number
    feedbackText?: string | null
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
  const [copiedRef, setCopiedRef] = useState(false)

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

  // In-portal Feedback State
  const [feedbackRating, setFeedbackRating] = useState<number>(0)
  const [feedbackHover, setFeedbackHover] = useState<number>(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

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
      setTimeout(() => setRescheduleSuccess(null), 6000)
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

  // 4. Feedback sync & submit
  useEffect(() => {
    if (apt?.feedback?.rating) {
      setFeedbackRating(apt.feedback.rating)
      setFeedbackComment(apt.feedback.feedbackText || '')
      setFeedbackSubmitted(true)
    }
  }, [apt?.feedback])

  const handleFeedbackSubmit = async () => {
    if (feedbackRating < 1 || feedbackRating > 5) return
    setSubmittingFeedback(true)
    setFeedbackError(null)

    try {
      const res = await fetch(`/api/book/manage/${token}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          feedbackText: feedbackComment.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setFeedbackError(data.error || 'Failed to submit feedback.')
        return
      }

      setFeedbackSubmitted(true)
    } catch {
      setFeedbackError('A network error occurred while submitting your review.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const copyReferenceCode = () => {
    if (!apt?.id) return
    const ref = `#APT-${apt.id.substring(0, 8).toUpperCase()}`
    navigator.clipboard.writeText(ref)
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3.5 max-w-sm text-center">
          <div className="relative">
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 dark:border-blue-500 border-t-transparent" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-blue-600/70 dark:text-blue-400/70" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Loading Appointment</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Retrieving your verified service details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !apt) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-2xs">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-black text-slate-900 dark:text-white">Appointment Link Not Found</h1>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {error || 'This appointment link is either invalid, expired, or has already been fulfilled.'}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-left space-y-1 text-xs text-slate-600 dark:text-zinc-400">
            <span className="font-semibold block text-slate-900 dark:text-zinc-200">What you can do:</span>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500 dark:text-zinc-400">
              <li>Check the confirmation SMS or email you received</li>
              <li>Ensure the entire URL was copied without missing characters</li>
              <li>Call the business directly to look up your booking</li>
            </ul>
          </div>
          <PoweredByBadge source="manage" className="pt-2" />
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

  const businessInitials = (apt.business.name || 'Service Company')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">

        {/* ================================================================= */}
        {/* SECTION 1: BUSINESS HEADER                                        */}
        {/* ================================================================= */}
        <header className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 sm:gap-4">
              {apt.business.logoUrl ? (
                <img
                  src={apt.business.logoUrl}
                  alt={apt.business.name}
                  className="h-13 w-13 sm:h-14 sm:w-14 rounded-2xl object-cover border border-slate-200 dark:border-zinc-800 shadow-2xs shrink-0"
                />
              ) : (
                <div className="h-13 w-13 sm:h-14 sm:w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-lg flex items-center justify-center shadow-2xs shrink-0">
                  {businessInitials}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                    {apt.business.name}
                  </h1>
                  {apt.business.industry && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                      {apt.business.industry}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                  <button
                    type="button"
                    onClick={copyReferenceCode}
                    className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-zinc-300 hover:text-blue-600 transition-colors cursor-pointer"
                    title="Click to copy booking reference"
                  >
                    <span>{referenceCode}</span>
                    {copiedRef ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <span className="text-[10px] text-slate-400">copy</span>
                    )}
                  </button>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    Verified Homeowner Booking
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {apt.business.phone && (
                <a
                  href={`tel:${apt.business.phone}`}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Call {apt.business.phone}</span>
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Reschedule Success Alert Banner */}
        {rescheduleSuccess && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-3 animate-in fade-in duration-300 shadow-xs">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="space-y-0.5">
              <span className="font-bold block text-sm">Appointment Rescheduled Successfully!</span>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">{rescheduleSuccess}</p>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* RESPONSIVE TWO-COLUMN GRID (Desktop 1024px+ / Single-Col Mobile)     */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

          {/* --------------------------------------------------------------- */}
          {/* LEFT / MAIN COLUMN (lg:col-span-8)                             */}
          {/* --------------------------------------------------------------- */}
          <main className="lg:col-span-8 space-y-6">

            {/* ============================================================= */}
            {/* SECTION 2: APPOINTMENT STATUS HERO                            */}
            {/* ============================================================= */}
            <section
              aria-label="Appointment Status"
              className={cn(
                "rounded-3xl border p-5 sm:p-6 shadow-xs transition-all relative overflow-hidden",
                isEnRoute
                  ? "bg-gradient-to-br from-blue-50/90 via-sky-50/40 to-white dark:from-blue-950/30 dark:via-zinc-900 dark:to-zinc-900 border-blue-300 dark:border-blue-800/60 ring-2 ring-blue-500/20"
                  : isInProgress
                  ? "bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border-emerald-300 dark:border-emerald-800/60 ring-2 ring-emerald-500/20"
                  : isCompleted
                  ? "bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 border-slate-200 dark:border-zinc-800"
                  : isCancelled
                  ? "bg-gradient-to-br from-rose-50/90 via-white to-white dark:from-rose-950/20 dark:via-zinc-900 dark:to-zinc-900 border-rose-200 dark:border-rose-900/40"
                  : apt.status === 'requested'
                  ? "bg-gradient-to-br from-amber-50/90 via-white to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900 border-amber-200 dark:border-amber-900/40"
                  : apt.status === 'no_show'
                  ? "bg-gradient-to-br from-amber-50/90 via-orange-50/30 to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900 border-amber-200 dark:border-amber-900/40"
                  : "bg-gradient-to-br from-blue-50/70 via-white to-white dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-900 border-blue-200/80 dark:border-blue-900/40"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "p-3 rounded-2xl text-white shadow-2xs shrink-0 mt-0.5",
                    isEnRoute ? "bg-blue-600 animate-pulse" :
                    isInProgress ? "bg-emerald-600" :
                    isCompleted ? "bg-emerald-600" :
                    isCancelled ? "bg-rose-600" :
                    apt.status === 'requested' ? "bg-amber-500" :
                    apt.status === 'no_show' ? "bg-amber-600" :
                    "bg-blue-600"
                  )}
                >
                  {isEnRoute ? <Truck className="h-6 w-6" /> :
                   isInProgress ? <Wrench className="h-6 w-6" /> :
                   isCompleted ? <CheckCircle2 className="h-6 w-6" /> :
                   isCancelled ? <XCircle className="h-6 w-6" /> :
                   apt.status === 'requested' ? <Clock className="h-6 w-6" /> :
                   apt.status === 'no_show' ? <AlertTriangle className="h-6 w-6" /> :
                   <CheckCircle2 className="h-6 w-6" />}
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-white/80 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700">
                      {isEnRoute ? 'Live Dispatch' :
                       isInProgress ? 'Service Underway' :
                       isCompleted ? 'Service Completed' :
                       isCancelled ? 'Appointment Cancelled' :
                       apt.status === 'requested' ? 'Pending Confirmation' :
                       apt.status === 'no_show' ? 'Missed Visit' :
                       'Confirmed Appointment'}
                    </span>

                    {isEnRoute && apt.tracking?.etaMinutes && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs animate-pulse">
                        <Clock className="h-3 w-3" />
                        <span>ETA ~{apt.tracking.etaMinutes} mins</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isEnRoute ? 'Your technician is on the way' :
                     isInProgress ? 'Your service is in progress' :
                     isCompleted ? 'Your service is complete' :
                     isCancelled ? 'Appointment Cancelled' :
                     apt.status === 'requested' ? 'Booking request received' :
                     apt.status === 'no_show' ? 'Missed Appointment' :
                     'Your appointment is confirmed'}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {isEnRoute ? (
                      apt.tracking?.etaMinutes
                        ? `Technician has dispatched to your service address. Estimated arrival in ~${apt.tracking.etaMinutes} minutes.`
                        : 'Technician has dispatched and is currently in transit to your property.'
                    ) : isInProgress ? (
                      'Technician has arrived on-site and service work is actively underway.'
                    ) : isCompleted ? (
                      apt.tracking?.completedAt
                        ? `Service was verified and completed on ${formatDateInTz(new Date(apt.tracking.completedAt), timezone, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
                        : 'This service appointment has been marked complete by the technician.'
                    ) : isCancelled ? (
                      apt.cancellationReason
                        ? `Reason for cancellation: ${apt.cancellationReason}. Your time slot has been released back to the schedule.`
                        : 'This appointment was cancelled. Your reserved time slot has been released back to the schedule.'
                    ) : apt.status === 'requested' ? (
                      'We have received your requested service time. The business will review their dispatch schedule and confirm your appointment.'
                    ) : apt.status === 'no_show' ? (
                      'The technician was unable to connect or gain property access at the scheduled time. Please call the office directly to arrange a new visit.'
                    ) : (
                      `Reserved for ${formattedDate} between ${formattedStartTime} and ${formattedEndTime} (${tzLabel}).`
                    )}
                  </p>
                </div>
              </div>

              {/* En Route & In Progress tracker CTA banner inside status hero */}
              {(isEnRoute || isInProgress) && apt.tracking?.url && (
                <div className="mt-4 pt-4 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                    <Navigation className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>View real-time milestone checkpoints and job notes</span>
                  </div>
                  <a
                    href={apt.tracking.url}
                    className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-md shadow-blue-500/25 transition-all cursor-pointer shrink-0"
                  >
                    <span>Open Live Service Tracker</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              )}
            </section>

            {/* ============================================================= */}
            {/* SECTION 3: PRIMARY APPOINTMENT DETAILS CARD                   */}
            {/* ============================================================= */}
            <section
              aria-label="Appointment Details"
              className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-5 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                    Scheduled Service
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {apt.serviceType || apt.title}
                  </h3>
                  {apt.service?.description && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-lg">
                      {apt.service.description}
                    </p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 pt-0.5">
                    <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{apt.durationMinutes || apt.service?.durationMinutes || 60} minutes scheduled duration</span>
                  </p>
                </div>

                {/* Pricing presentation */}
                <div className="self-start sm:self-auto sm:text-right shrink-0">
                  {apt.service?.price !== null && apt.service?.price !== undefined && Number(apt.service.price) > 0 ? (
                    <div>
                      <span className="text-base font-black text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 inline-block">
                        ${Number(apt.service.pricingSummary?.estimatedTotal ?? apt.service.price).toFixed(2)}
                      </span>
                      {isStartingAt && (
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium block mt-0.5">Starting Rate</span>
                      )}
                      {apt.service?.pricingSource && apt.service.pricingSource !== 'catalog_fallback' && (
                        <span className="text-[9px] text-slate-400 dark:text-zinc-500 block">Booked rate</span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 inline-block">
                        {isQuoteOnSite ? 'Quote On Site' : isFreeEstimate ? 'Free Estimate' : isDiagnosticFee ? 'Diagnostic Assessment' : 'Service Inspection'}
                      </span>
                      {apt.service?.pricingSource && apt.service.pricingSource !== 'catalog_fallback' && (
                        <span className="text-[9px] text-slate-400 dark:text-zinc-500 block mt-0.5">Booked terms</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Pricing terms explanation */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                {isStartingAt && 'Base rate covers standard arrival and inspection. Exact final total will be reviewed on-site before any additional work starts.'}
                {isQuoteOnSite && '$0 due online. An itemized quote will be presented on-site before work begins.'}
                {isDiagnosticFee && 'Diagnostic fee covers thorough inspection and troubleshooting, credited toward repair if approved.'}
                {isFreeEstimate && '$0.00 complimentary on-site consultation. No obligation or payment required.'}
                {pricingModel === 'fixed' && 'Inclusive fixed rate for this scheduled service appointment.'}
              </div>

              {/* Historical Booked Add-ons Breakdown */}
              {apt.service?.addOns && apt.service.addOns.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                    <span>Selected Add-ons</span>
                    {apt.service.pricingSummary && (
                      <span className="font-mono text-slate-600 dark:text-zinc-400 font-normal">
                        +${Number(apt.service.pricingSummary.addOnsTotal).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {apt.service.addOns.map((addon, idx) => (
                      <div key={addon.id || idx} className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
                        <span className="flex items-center gap-2">
                          <span className="text-blue-600 dark:text-blue-400 font-bold">+</span>
                          <span>{addon.name}</span>
                        </span>
                        <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                          ${Number(addon.price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Schedule and Location Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
                <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 shrink-0">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Service Date &amp; Window
                    </span>
                    <span className="text-slate-800 dark:text-zinc-200 font-medium block">
                      {formattedDate}
                    </span>
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px] block">
                      {formattedStartTime} - {formattedEndTime} ({tzLabel})
                    </span>
                  </div>
                </div>

                {apt.customer.address && (
                  <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 shrink-0">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        Service Property Address
                      </span>
                      <span className="text-slate-700 dark:text-zinc-300 leading-snug break-words block">
                        {apt.customer.address}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ============================================================= */}
            {/* SECTION 4: AUTHORITATIVE FINAL INVOICE & PAYMENT CARD         */}
            {/* ============================================================= */}
            {apt.invoice && (
              <section
                aria-label="Invoice & Payment"
                className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-xs"
              >
                {/* Header with invoice number and status badge */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                    <span className="text-xs font-bold text-slate-900 dark:text-zinc-100 font-mono">
                      Invoice #{apt.invoice.invoiceNumber}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      apt.invoice.financialStatus === 'paid'
                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                        : apt.invoice.financialStatus === 'partially_paid'
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40"
                        : apt.invoice.financialStatus === 'fully_refunded' || apt.invoice.financialStatus === 'partially_refunded'
                        ? "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40"
                        : apt.invoice.financialStatus === 'voided'
                        ? "bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
                        : "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30"
                    )}
                  >
                    {apt.invoice.financialStatus.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-zinc-400">Total Invoice Amount:</span>
                  <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                    ${Number(apt.invoice.total).toFixed(2)}
                  </span>
                </div>

                {/* Status-specific payment details */}
                {apt.invoice.financialStatus === 'paid' ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Invoice paid in full. Thank you!</span>
                    </div>
                    {(apt.invoice.receiptUrl || apt.invoice.pdfUrl) && (
                      <a
                        href={apt.invoice.receiptUrl || apt.invoice.pdfUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        <span>View Payment Receipt</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ) : apt.invoice.financialStatus === 'fully_refunded' ? (
                  <div className="space-y-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-800 dark:text-purple-300 space-y-1">
                      <span className="font-bold block">Payment Refunded in Full</span>
                      <p className="text-[11px] leading-relaxed">
                        Total refunded: ${Number(apt.invoice.totalRefunded).toFixed(2)}. The refund has been processed back to your original payment method.
                      </p>
                    </div>
                    {(apt.invoice.receiptUrl || apt.invoice.pdfUrl) && (
                      <a
                        href={apt.invoice.receiptUrl || apt.invoice.pdfUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                      >
                        <span>View Refund Receipt</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                ) : apt.invoice.financialStatus === 'partially_refunded' ? (
                  <div className="space-y-2 pt-1">
                    <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-800 dark:text-purple-300">
                      <span className="font-bold block">Partially Refunded</span>
                      <p className="text-[11px] mt-0.5">
                        Amount refunded: ${Number(apt.invoice.totalRefunded).toFixed(2)} (Net paid: ${(Number(apt.invoice.totalPaid || 0) - Number(apt.invoice.totalRefunded)).toFixed(2)}).
                      </p>
                    </div>
                  </div>
                ) : apt.invoice.financialStatus === 'voided' ? (
                  <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
                    This invoice has been voided by the contractor. No balance is due.
                  </div>
                ) : (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                      <span>Balance Due:</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-sm">
                        ${Number(apt.invoice.amountDue).toFixed(2)}
                      </span>
                    </div>
                    {apt.invoice.manageToken ? (
                      <a
                        href={`/invoice/${apt.invoice.manageToken}`}
                        className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Pay Balance (${Number(apt.invoice.amountDue).toFixed(2)}) Online</span>
                        <ChevronRight className="w-4 h-4" />
                      </a>
                    ) : null}
                  </div>
                )}

                {apt.invoice.hasMultipleInvoices && (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    Note: {apt.invoice.multipleInvoicesCount} invoices are associated with this service. Primary invoice #{apt.invoice.invoiceNumber} is shown.
                  </p>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 6: RESCHEDULE EXPERIENCE MODAL / PANEL                */}
            {/* ============================================================= */}
            {showReschedule && (
              <section
                aria-label="Reschedule Appointment Form"
                className="rounded-3xl bg-white dark:bg-zinc-900 border-2 border-blue-500 dark:border-blue-600 p-5 sm:p-6 space-y-5 shadow-lg animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                      Choose Your New Preferred Time
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Reschedule Appointment</span>
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowReschedule(false)}
                    className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 cursor-pointer min-h-[36px]"
                  >
                    Cancel
                  </button>
                </div>

                {/* Current appointment comparison slot */}
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 text-xs text-slate-600 dark:text-zinc-400 flex items-center justify-between">
                  <div>
                    <span className="font-semibold block text-slate-800 dark:text-zinc-200">Current Reserved Slot:</span>
                    <span>{formattedDate} at {formattedStartTime}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                    {apt.durationMinutes || 60} mins
                  </span>
                </div>

                {rescheduleError && (
                  <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-bold block">Rescheduling Notice</span>
                      <p className="text-[11px] leading-relaxed">{rescheduleError}</p>
                    </div>
                  </div>
                )}

                {/* Date Selection Rail */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                    1. Choose a Date ({tzLabel})
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
                            "flex flex-col items-center justify-center min-w-[68px] py-2.5 px-2 rounded-2xl border transition-all shrink-0 cursor-pointer min-h-[58px]",
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
                    2. Select Available Arrival Window
                  </label>

                  {loadingSlots ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="h-11 rounded-xl bg-slate-200 dark:bg-zinc-800/40 animate-pulse" />
                      ))}
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500 dark:text-zinc-400">
                      No open slots available for this date. Please pick another date above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot?.startTime === slot.startTime
                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "min-h-[44px] py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all text-center cursor-pointer",
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
                  <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-900 dark:text-blue-200 flex items-center justify-between">
                    <div>
                      <span className="font-bold block">Proposed New Window:</span>
                      <span>{selectedSlot.date} at {selectedSlot.displayTime} ({tzLabel})</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowReschedule(false)}
                    className="min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    Keep Current Slot
                  </button>
                  <button
                    type="button"
                    disabled={!selectedSlot || rescheduling}
                    onClick={handleRescheduleSubmit}
                    className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
                  >
                    {rescheduling ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Confirming New Slot...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Confirm New Appointment Time</span>
                      </>
                    )}
                  </button>
                </div>
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 7: CANCELLATION EXPERIENCE WITH 2-STEP CONFIRMATION    */}
            {/* ============================================================= */}
            {showCancel && (
              <section
                aria-label="Cancellation Form"
                className="rounded-3xl bg-white dark:bg-zinc-900 border-2 border-rose-300 dark:border-rose-700/60 p-5 sm:p-6 space-y-4 shadow-lg animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="h-10 w-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Cancel Your Appointment?
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      This will release your reserved arrival window back to the public schedule.
                    </p>
                  </div>
                </div>

                {cancelError && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 text-xs">
                    {cancelError}
                  </div>
                )}

                {apt.isWithinCancellationCutoff ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs space-y-2 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                        <Clock className="h-4 w-4" />
                        <span>Late Cancellation Notice ({apt.cancellationNoticeHours || 2}-Hour Window)</span>
                      </div>
                      <p>
                        Because your service visit is scheduled within the next {apt.cancellationNoticeHours || 2} hours, our dispatch crew is already staging materials and routing trucks. Online self-service cancellation is paused to prevent field disruptions.
                      </p>
                      <p>
                        To adjust your schedule or cancel your appointment, please call {apt.business.name} directly.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setShowCancel(false)}
                        className="min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Keep My Appointment
                      </button>
                      {apt.business.phone && (
                        <a
                          href={`tel:${apt.business.phone}`}
                          className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 cursor-pointer"
                        >
                          <Phone className="h-4 w-4" />
                          <span>Call Dispatch: {apt.business.phone}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Reason Selection Chips */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 block">
                        Please select a reason for cancellation:
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
                                "min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer",
                                isSelected
                                  ? "bg-rose-600 border-rose-600 text-white shadow-2xs"
                                  : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                              )}
                            >
                              {reason}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Optional free-form notes */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 block">
                        Additional Notes (Optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Let the business know if there is anything they can help with..."
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs focus:outline-hidden focus:border-rose-500 resize-none"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setShowCancel(false)}
                        className="min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        Keep My Appointment
                      </button>
                      <button
                        type="button"
                        disabled={cancelling}
                        onClick={handleCancelSubmit}
                        className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-rose-500/20 cursor-pointer"
                      >
                        {cancelling ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Cancelling Appointment...</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-4 w-4" />
                            <span>Confirm Cancellation</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 9: COMPLETED WORK, PROOF PHOTOS & RE-BOOK             */}
            {/* ============================================================= */}
            {isCompleted && (
              <section
                aria-label="Completed Service Details"
                className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-xs"
              >
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Completed Work &amp; Inspection
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Work has been fulfilled. You can inspect technician verification photos and your itemized receipt.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {apt.tracking?.url && (
                    <a
                      href={apt.tracking.url}
                      className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>View Work Summary &amp; Photos</span>
                    </a>
                  )}

                  {apt.business.slug && (
                    <a
                      href={`/book/${apt.business.slug}`}
                      className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Book Another Service</span>
                    </a>
                  )}
                </div>

                {/* DUAL-TRACK CUSTOMER REVIEW & FEEDBACK MODULE */}
                <div className="pt-2 space-y-3.5 border-t border-slate-100 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Service Quality &amp; Reviews
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Your feedback directly helps us maintain exceptional service standards for local homeowners.
                    </p>
                  </div>

                  {/* Track 1: Public Google Review */}
                  {apt.business.googleReviewUrl && (
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/80 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                          <span>Rate Us on Google</span>
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-300">
                          Share your experience publicly to help neighbors find quality service.
                        </p>
                      </div>
                      <a
                        href={apt.business.googleReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] shrink-0 inline-flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                      >
                        <span>Leave a Google Review</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}

                  {/* Track 2: Direct In-Portal Management Feedback */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700/80 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Direct Management Rating
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                          Rate your technician and overall service quality
                        </p>
                      </div>
                      {feedbackSubmitted && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                          <Check className="h-3 w-3" />
                          <span>Rating Recorded</span>
                        </span>
                      )}
                    </div>

                    {/* Interactive 5-Star Selector */}
                    <div className="flex items-center gap-1.5 py-0.5">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isFilled = star <= (feedbackHover || feedbackRating)
                        return (
                          <button
                            key={star}
                            type="button"
                            disabled={feedbackSubmitted || submittingFeedback}
                            onClick={() => setFeedbackRating(star)}
                            onMouseEnter={() => setFeedbackHover(star)}
                            onMouseLeave={() => setFeedbackHover(0)}
                            className="p-1 rounded-lg hover:bg-white dark:hover:bg-zinc-700 transition-colors cursor-pointer disabled:cursor-default"
                            aria-label={`Rate ${star} out of 5 stars`}
                          >
                            <Star
                              className={cn(
                                "h-6 w-6 transition-all",
                                isFilled
                                  ? "text-amber-400 fill-amber-400"
                                  : "text-slate-300 dark:text-zinc-600"
                              )}
                            />
                          </button>
                        )
                      })}
                      {feedbackRating > 0 && (
                        <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 ml-2">
                          {feedbackRating === 5 ? 'Excellent!' :
                           feedbackRating === 4 ? 'Great' :
                           feedbackRating === 3 ? 'Good' :
                           feedbackRating === 2 ? 'Fair' : 'Poor'}
                        </span>
                      )}
                    </div>

                    {/* Feedback comment & submit */}
                    {feedbackRating > 0 && !feedbackSubmitted && (
                      <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                        {feedbackError && (
                          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs">
                            {feedbackError}
                          </div>
                        )}
                        <textarea
                          rows={2}
                          placeholder="Share any comments for the business owner or management team (optional)..."
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 text-xs focus:outline-hidden focus:border-blue-500 resize-none"
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={submittingFeedback}
                            onClick={handleFeedbackSubmit}
                            className="min-h-[40px] py-2 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            {submittingFeedback ? (
                              <>
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                <span>Submitting...</span>
                              </>
                            ) : (
                              <span>Submit Direct Feedback</span>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {feedbackSubmitted && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium bg-emerald-50/70 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                        Thank you! Your feedback has been recorded and delivered directly to {apt.business.name}&apos;s management.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Cancelled Re-book Card */}
            {isCancelled && apt.business.slug && (
              <section
                aria-label="Re-book Service"
                className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 text-center space-y-3.5 shadow-xs"
              >
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Need to schedule for a future date?
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  You can browse available service offerings and select a new time on {apt.business.name}&apos;s public booking calendar.
                </p>
                <div>
                  <a
                    href={`/book/${apt.business.slug}`}
                    className="min-h-[44px] inline-flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <span>Book a New Appointment</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </section>
            )}

          </main>

          {/* --------------------------------------------------------------- */}
          {/* RIGHT / SECONDARY SIDEBAR (lg:col-span-4)                      */}
          {/* --------------------------------------------------------------- */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">

            {/* 1. Quick Self-Service Actions Card (Desktop & Actionable) */}
            {isActionable && !showReschedule && !showCancel && (
              <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 space-y-3 shadow-xs">
                <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                  Self-Service Options
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setShowReschedule(true)
                    setShowCancel(false)
                  }}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
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
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <XCircle className="h-4 w-4" />
                  <span>Cancel Appointment</span>
                </button>
              </div>
            )}

            {/* 2. LIVE SERVICE TRACKER CARD (State-Aware) */}
            {apt.status !== 'cancelled' && apt.tracking && (
              <div className={cn(
                "rounded-3xl border p-5 space-y-3 shadow-xs transition-all",
                isEnRoute
                  ? "bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent border-blue-400 dark:border-blue-700"
                  : isInProgress
                  ? "bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-400 dark:border-emerald-700"
                  : "bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800"
              )}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-lg text-white shadow-2xs shrink-0",
                      isEnRoute ? "bg-blue-600 animate-pulse" :
                      isInProgress ? "bg-emerald-600" :
                      isCompleted ? "bg-emerald-600" : "bg-slate-900 dark:bg-zinc-100 dark:text-zinc-900"
                    )}>
                      {isEnRoute ? <Truck className="h-3.5 w-3.5" /> :
                       isInProgress ? <Wrench className="h-3.5 w-3.5" /> :
                       <Navigation className="h-3.5 w-3.5" />}
                    </div>
                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Live Arrival Tracker
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    {isEnRoute ? 'Live En Route' : isInProgress ? 'On Site' : 'Active On Day'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {isEnRoute
                    ? 'Technician is actively driving to your address. Track departure milestones and arrival estimates.'
                    : isInProgress
                    ? 'Technician is currently working on site. You can view real-time photo uploads and notes.'
                    : 'Live arrival tracking and updates on service day.'}
                </p>

                <a
                  href={apt.tracking.url}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  <span>Open Live Service Tracker</span>
                  <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />
                </a>
              </div>
            )}

            {/* 3. CALENDAR SYNCHRONIZATION CARD */}
            {apt.status !== 'cancelled' && (
              <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Add to Calendar
                  </span>
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                </div>

                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Export snapshot to your calendar app. If you reschedule later, remember to re-export the updated time.
                </p>

                <div className="space-y-2">
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
                    className="w-full min-h-[44px] py-2 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                  >
                    <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span>Google Calendar</span>
                  </a>

                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`/api/book/manage/${token}/ics`}
                      download={`appointment-${referenceCode.replace('#', '')}.ics`}
                      className="min-h-[44px] py-2 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Apple iCal</span>
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
                      className="min-h-[44px] py-2 px-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Outlook</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 4. BUSINESS CONTACT CARD */}
            <div className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 space-y-3.5 shadow-xs text-xs">
              <span className="text-[11px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
                Business Information
              </span>

              <div className="space-y-1">
                <span className="font-bold text-slate-900 dark:text-white text-sm block">
                  {apt.business.name}
                </span>
                <span className="text-slate-500 dark:text-zinc-400 block text-[11px]">
                  Timezone: {tzLabel} ({timezone})
                </span>
              </div>

              {apt.business.phone && (
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800">
                  <a
                    href={`tel:${apt.business.phone}`}
                    className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-900 dark:text-zinc-100 font-semibold flex items-center gap-2 transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>{apt.business.phone}</span>
                  </a>
                </div>
              )}

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-800/40 text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                Need to speak with our dispatch team? Contact the business directly during business hours.
              </div>
            </div>

            {/* Universal Clickable Powered by CaptoDesk Badge */}
            <div className="text-center pt-2">
              <PoweredByBadge source="manage" />
            </div>

          </aside>
        </div>

      </div>
    </div>
  )
}
