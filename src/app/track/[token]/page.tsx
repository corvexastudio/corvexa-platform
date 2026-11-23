'use client'

import { useEffect, useState, useRef, use, useCallback } from 'react'
import {
  CheckCircle2,
  Clock,
  Navigation,
  Wrench,
  Star,
  Phone,
  MessageSquare,
  ShieldCheck,
  CreditCard,
  MapPin,
  Calendar,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  ExternalLink,
  ChevronRight,
  Gift,
  Copy,
  Check,
  Share2,
  Camera,
  X,
  Truck,
  ArrowRight,
  Sparkles,
  Receipt,
  RotateCcw
} from 'lucide-react'
import Link from 'next/link'
import { PoweredByBadge } from '@/components/brand/powered-by-badge'
import { formatDateInTz, formatTimeInTz, getShortTzAbbreviation, getFriendlyTimezoneLabel } from '@/lib/temporal/timezone'
import { cn } from '@/lib/utils'

interface TrackingPayload {
  job: {
    id: string
    jobNumber: string
    title: string
    description?: string | null
    status: 'scheduled' | 'confirmed' | 'en_route' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
    scheduledStart: string
    scheduledEnd?: string | null
    enRouteAt?: string | null
    arrivedAt?: string | null
    startedAt?: string | null
    completedAt?: string | null
    technicianName?: string | null
    etaMinutes?: number | null
    notes?: string | null
    trackingToken: string
  }
  crew?: {
    name?: string | null
    colorCode?: string | null
  } | null
  org: {
    id: string
    name: string
    slug?: string | null
    industry?: string | null
    phone?: string | null
    logoUrl?: string | null
    licenseNumber?: string | null
    timezone?: string | null
  }
  contact?: {
    name?: string | null
    address?: string | null
  } | null
  service?: {
    name: string
    durationMinutes: number
    price?: number | null
  } | null
  invoice?: {
    id?: string
    invoiceNumber: string
    title?: string | null
    total: number
    amountPaid: number
    amountDue: number
    status: string
    financialStatus?: 'unpaid' | 'partially_paid' | 'paid' | 'partially_refunded' | 'fully_refunded' | 'voided'
    totalRefunded?: number
    receiptUrl?: string | null
    pdfUrl?: string | null
    manageToken: string
    hasMultipleInvoices?: boolean
    multipleInvoicesCount?: number
    paidAt?: string | null
  } | null
  reviewUrl?: string | null
  referral?: {
    code: string
    url: string
    rewardAmount: number
    discountAmount: number
  } | null
  photos?: {
    id: string
    photo_type: 'before' | 'after' | 'progress' | 'completion'
    url: string
    caption?: string | null
    created_at: string
  }[]
}

const STAGES = [
  { id: 'scheduled', label: 'Scheduled', icon: Calendar, desc: 'Appointment confirmed' },
  { id: 'en_route', label: 'En Route', icon: Truck, desc: 'Technician on the way' },
  { id: 'arrived', label: 'Arrived', icon: MapPin, desc: 'Arrived on-site' },
  { id: 'in_progress', label: 'Working', icon: Wrench, desc: 'Service underway' },
  { id: 'completed', label: 'Done', icon: CheckCircle2, desc: 'Service complete' }
]

export default function CustomerJobTrackerPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TrackingPayload | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const inFlightRef = useRef(false)

  // Review interaction state
  const [selectedRating, setSelectedRating] = useState<number | null>(null)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  // Referral link state
  const [copiedReferral, setCopiedReferral] = useState(false)
  const handleCopyReferral = () => {
    if (!data?.referral?.url) return
    navigator.clipboard.writeText(data.referral.url)
    setCopiedReferral(true)
    setTimeout(() => setCopiedReferral(false), 3000)
  }

  const handleShareReferral = async () => {
    if (!data?.referral?.url) return
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: data.org.name,
          text: `I recommend ${data.org.name} for home service. Check them out here:`,
          url: data.referral.url
        })
        return
      } catch {
        // User cancelled or failed share; fall back to copy
      }
    }
    handleCopyReferral()
  }

  // Work photo proof lightbox state
  const [activePreviewPhoto, setActivePreviewPhoto] = useState<any | null>(null)
  const [photoFilter, setPhotoFilter] = useState<'all' | 'before' | 'after'>('all')

  // Lightbox keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activePreviewPhoto) {
        setActivePreviewPhoto(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePreviewPhoto])

  const handleFeedbackSubmit = async () => {
    if (!selectedRating || !token) return
    setSubmittingFeedback(true)
    setFeedbackError(null)

    try {
      const res = await fetch(`/api/track/${token}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: selectedRating,
          feedbackText: feedbackText.trim()
        })
      })
      const json = await res.json()
      if (res.ok) {
        setFeedbackSent(true)
      } else {
        setFeedbackError(json.error || 'Failed to submit feedback.')
      }
    } catch {
      setFeedbackError('Network error submitting feedback. Please try again.')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  const fetchTracking = useCallback(async (isPoll = false) => {
    if (!token) return
    if (isPoll && inFlightRef.current) return
    if (!isPoll) setLoading(true)
    inFlightRef.current = true

    try {
      const res = await fetch(`/api/track/${token}`, { cache: 'no-store' })
      if (!res.ok) {
        if (!isPoll) setError('We could not find this service tracking link. It may have expired.')
        return
      }
      const json = await res.json()
      setData(json)
      setLastUpdated(new Date())
      setError(null)
    } catch {
      if (!isPoll) setError('Network error loading live job tracking. Please check your connection.')
    } finally {
      inFlightRef.current = false
      if (!isPoll) setLoading(false)
    }
  }, [token])

  // Initial load
  useEffect(() => {
    fetchTracking()
  }, [fetchTracking])

  // Terminal state check to avoid polling completed, cancelled, or no-show jobs
  const isTerminal = Boolean(
    data && (
      ['completed', 'cancelled', 'no_show'].includes(data.job.status) ||
      Boolean(data.job.completedAt)
    )
  )

  // Live real-time polling every 8 seconds, pausing on terminal state and background tab
  useEffect(() => {
    if (!token || error || isTerminal) return

    let intervalId: NodeJS.Timeout | null = null

    const startPolling = () => {
      if (!intervalId && document.visibilityState === 'visible') {
        intervalId = setInterval(() => {
          fetchTracking(true)
        }, 8000)
      }
    }

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTracking(true)
        startPolling()
      } else {
        stopPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [token, error, isTerminal, fetchTracking])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-zinc-100">
        <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
        <p className="text-slate-600 dark:text-zinc-400 text-sm font-medium">Connecting to live service tracker...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-zinc-100">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-zinc-100">Tracking Link Unavailable</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
            {error || 'This service tracking link is inactive or has expired.'}
          </p>
        </div>
      </div>
    )
  }

  const { job, org, contact, service, invoice, reviewUrl } = data

  // Accurate stage progression calculation (0 to 4)
  const isCancelled = job.status === 'cancelled'
  const isNoShow = job.status === 'no_show'
  const isCompleted = job.status === 'completed' || Boolean(job.completedAt)
  const isInProgress = !isCompleted && !isCancelled && !isNoShow && (job.status === 'in_progress' || Boolean(job.startedAt))
  const isArrived = !isCompleted && !isCancelled && !isNoShow && !isInProgress && (job.status === 'arrived' || (Boolean(job.arrivedAt) && !job.startedAt))
  const isEnRoute = !isCompleted && !isCancelled && !isNoShow && !isInProgress && !isArrived && (job.status === 'en_route' || Boolean(job.enRouteAt))
  const isScheduled = !isCompleted && !isCancelled && !isNoShow && !isInProgress && !isArrived && !isEnRoute

  const getStageIndex = () => {
    if (isCompleted) return 4
    if (isInProgress) return 3
    if (isArrived) return 2
    if (isEnRoute) return 1
    return 0
  }

  const currentStageIndex = getStageIndex()

  // Technician / Crew identification
  const techName = job.technicianName || data.crew?.name || null
  const techInitials = techName
    ? techName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : org.name.slice(0, 2).toUpperCase()

  // Operational timezone resolution (service address local time)
  const orgTz = org.timezone || 'America/Chicago'
  const tzAbbr = getShortTzAbbreviation(orgTz, job.scheduledStart)
  const tzFriendly = getFriendlyTimezoneLabel(orgTz)

  // ETA Clock Time Calculation & Stale Detection
  let etaDisplay: string | null = null
  let etaClockTime: string | null = null
  let isEtaStale = false

  if (isEnRoute && job.etaMinutes && job.etaMinutes > 0) {
    if (job.enRouteAt) {
      const departure = new Date(job.enRouteAt).getTime()
      const now = Date.now()
      const elapsedMinutes = (now - departure) / 60000
      if (elapsedMinutes > job.etaMinutes + 15) {
        isEtaStale = true
      } else {
        const estimatedArrival = new Date(departure + job.etaMinutes * 60000)
        etaClockTime = formatTimeInTz(estimatedArrival, orgTz)
      }
    }

    if (isEtaStale) {
      etaDisplay = 'Arrival pending'
    } else {
      etaDisplay = `~${job.etaMinutes} min${job.etaMinutes === 1 ? '' : 's'}`
    }
  }

  const formattedDate = formatDateInTz(job.scheduledStart, orgTz, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  const formattedStartTime = formatTimeInTz(job.scheduledStart, orgTz)
  const formattedEndTime = job.scheduledEnd ? formatTimeInTz(job.scheduledEnd, orgTz) : null
  const arrivalWindowText = formattedEndTime
    ? `${formattedStartTime} to ${formattedEndTime}${tzAbbr ? ` (${tzAbbr})` : ''}`
    : `${formattedStartTime}${tzAbbr ? ` (${tzAbbr})` : ''}`

  // Milestone timestamp resolution
  const stageTimestamps = [
    formatTimeInTz(job.scheduledStart, orgTz),
    job.enRouteAt ? formatTimeInTz(job.enRouteAt, orgTz) : null,
    job.arrivedAt ? formatTimeInTz(job.arrivedAt, orgTz) : null,
    job.startedAt ? formatTimeInTz(job.startedAt, orgTz) : null,
    job.completedAt ? formatTimeInTz(job.completedAt, orgTz) : null
  ]

  const handleRatingClick = (stars: number) => {
    setSelectedRating(stars)
    setFeedbackError(null)
  }

  // Filtered photos
  const filteredPhotos = data.photos
    ? data.photos.filter((p) => photoFilter === 'all' || p.photo_type === photoFilter)
    : []

  const beforePhotosCount = data.photos?.filter((p) => p.photo_type === 'before').length || 0
  const afterPhotosCount = data.photos?.filter((p) => p.photo_type === 'after').length || 0

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-between selection:bg-slate-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">

        {/* ================================================================= */}
        {/* SECTION 1: BUSINESS IDENTITY HEADER                               */}
        {/* ================================================================= */}
        <header className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {org.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={org.logoUrl}
                  alt={org.name}
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-contain border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-1 shrink-0 shadow-2xs"
                />
              ) : (
                <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-slate-900 dark:bg-zinc-800 text-white dark:text-zinc-100 border border-slate-800 dark:border-zinc-700 flex items-center justify-center font-black text-xl shrink-0 shadow-2xs">
                  {org.name.slice(0, 1).toUpperCase()}
                </div>
              )}

              <div className="space-y-0.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {org.name}
                  </h1>
                  {org.industry && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 shrink-0">
                      {org.industry}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    Live Service Tracker
                  </span>
                  <span className="text-slate-300 dark:text-zinc-700">&bull;</span>
                  <span className="font-mono text-slate-600 dark:text-zinc-300 font-bold">
                    Job #{job.jobNumber}
                  </span>
                </div>
              </div>
            </div>

            {/* Direct 1-Tap Company Contact Actions */}
            {org.phone && (
              <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
                <a
                  href={`sms:${org.phone}`}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  title="Text Service Provider"
                  aria-label="Text Service Provider"
                >
                  <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Text Office</span>
                </a>
                <a
                  href={`tel:${org.phone}`}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  title="Call Service Provider"
                  aria-label="Call Service Provider"
                >
                  <Phone className="w-4 h-4 text-white dark:text-zinc-900" />
                  <span>Call Office</span>
                </a>
              </div>
            )}
          </div>
        </header>

        {/* ================================================================= */}
        {/* RESPONSIVE TWO-COLUMN GRID (Desktop 1024px+ / Single-Col Mobile)  */}
        {/* ================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">

          {/* --------------------------------------------------------------- */}
          {/* MAIN COLUMN (lg:col-span-8)                                     */}
          {/* --------------------------------------------------------------- */}
          <main className="lg:col-span-8 space-y-6">

            {/* ============================================================= */}
            {/* SECTION 2: STATE-AWARE STATUS HERO (7 Lifecycle States)       */}
            {/* ============================================================= */}
            <section
              aria-label="Service Status"
              className={cn(
                "rounded-3xl border p-5 sm:p-6 shadow-xs transition-all relative overflow-hidden",
                isCancelled
                  ? "bg-gradient-to-br from-rose-50/90 via-white to-white dark:from-rose-950/20 dark:via-zinc-900 dark:to-zinc-900 border-rose-200 dark:border-rose-900/40"
                  : isNoShow
                  ? "bg-gradient-to-br from-amber-50/90 via-orange-50/30 to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900 border-amber-200 dark:border-amber-900/40"
                  : isCompleted
                  ? "bg-gradient-to-br from-slate-50 via-emerald-50/30 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-900 border-slate-200 dark:border-zinc-800"
                  : isInProgress
                  ? "bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-zinc-900 dark:to-zinc-900 border-emerald-300 dark:border-emerald-800/60 ring-2 ring-emerald-500/20"
                  : isArrived
                  ? "bg-gradient-to-br from-amber-50/90 via-orange-50/30 to-white dark:from-amber-950/20 dark:via-zinc-900 dark:to-zinc-900 border-amber-300 dark:border-amber-800/60 ring-2 ring-amber-500/20"
                  : isEnRoute
                  ? "bg-gradient-to-br from-blue-50/90 via-sky-50/40 to-white dark:from-blue-950/30 dark:via-zinc-900 dark:to-zinc-900 border-blue-300 dark:border-blue-800/60 ring-2 ring-blue-500/20"
                  : "bg-gradient-to-br from-blue-50/70 via-white to-white dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-900 border-blue-200/80 dark:border-blue-900/40"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "p-3 rounded-2xl text-white shadow-2xs shrink-0 mt-0.5",
                    isCancelled ? "bg-rose-600" :
                    isNoShow ? "bg-amber-600" :
                    isCompleted ? "bg-emerald-600" :
                    isInProgress ? "bg-emerald-600" :
                    isArrived ? "bg-amber-500" :
                    isEnRoute ? "bg-blue-600 animate-pulse" :
                    "bg-blue-600"
                  )}
                >
                  {isCancelled ? <XCircle className="h-6 w-6" /> :
                   isNoShow ? <AlertTriangle className="h-6 w-6" /> :
                   isCompleted ? <CheckCircle2 className="h-6 w-6" /> :
                   isInProgress ? <Wrench className="h-6 w-6" /> :
                   isArrived ? <MapPin className="h-6 w-6" /> :
                   isEnRoute ? <Truck className="h-6 w-6" /> :
                   <CheckCircle2 className="h-6 w-6" />}
                </div>

                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border bg-white/80 dark:bg-zinc-800/80 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700">
                      {isCancelled ? 'Appointment Cancelled' :
                       isNoShow ? 'Missed Visit' :
                       isCompleted ? 'Service Complete' :
                       isInProgress ? 'Work In Progress' :
                       isArrived ? 'Arrived On-Site' :
                       isEnRoute ? 'Technician En Route' :
                       'Confirmed Appointment'}
                    </span>

                    {/* ETA callout inside hero header when en route */}
                    {isEnRoute && etaDisplay && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-600 text-white shadow-2xs animate-pulse">
                        <Clock className="h-3 w-3" />
                        <span>{isEtaStale ? 'Arrival pending' : `ETA ${etaDisplay}`}</span>
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isCancelled
                      ? 'Service Cancelled'
                      : isNoShow
                      ? 'Technician Unable to Complete Visit'
                      : isCompleted
                      ? 'Work Finished and Verified'
                      : isInProgress
                      ? 'Service Underway on Your Property'
                      : isArrived
                      ? (techName ? `${techName} Has Arrived On-Site` : 'Technician Has Arrived On-Site')
                      : isEnRoute
                      ? (techName ? `${techName} is heading your way` : 'Technician is heading your way')
                      : 'Your Appointment is Confirmed'}
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed">
                    {isCancelled
                      ? (job.notes || 'This service appointment has been cancelled. If you need to rebook or have questions, please reach out to our team.')
                      : isNoShow
                      ? 'Our technician arrived at the scheduled time but was unable to access the property or connect. Please call our office to arrange a new visit.'
                      : isCompleted
                      ? 'All tasks have been completed. Thank you for choosing us for your home service!'
                      : isInProgress
                      ? 'Your technician is actively performing service on-site. Feel free to speak with them directly if needed.'
                      : isArrived
                      ? 'Your technician has arrived at your address. Please ensure front access or gates are open.'
                      : isEnRoute
                      ? (techName ? `${techName} is driving to your service address.` : 'Your technician is in transit to your property.')
                      : `Scheduled for ${formattedDate} between ${arrivalWindowText}. We look forward to serving you.`}
                  </p>
                </div>
              </div>

              {/* ============================================================= */}
              {/* SECTION 3: TECHNICIAN-UPDATED MANUAL ETA EXPERIENCE           */}
              {/* ============================================================= */}
              {isEnRoute && (
                <div className="mt-4 pt-4 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 block">
                        Technician-Reported ETA
                      </span>
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                        {isEtaStale
                          ? 'Technician reported transit time. Arrival pending.'
                          : etaClockTime
                          ? `Expected arrival by ${etaClockTime} ${tzAbbr || ''}`
                          : etaDisplay
                          ? `Estimated arrival in ${etaDisplay}`
                          : `Scheduled arrival window: ${arrivalWindowText}`}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs font-mono font-bold text-blue-950 dark:text-blue-100 block">
                      {isEtaStale ? 'Pending Arrival' : (etaDisplay || 'In Transit')}
                    </span>
                    <span className="text-[10px] text-blue-700 dark:text-blue-400">
                      Manual technician update
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* ============================================================= */}
            {/* SECTION 4: PROGRESS TIMELINE (5 Milestones or State Cards)    */}
            {/* ============================================================= */}
            {isCancelled ? (
              <section className="bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800/60 rounded-3xl p-5 sm:p-6 space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Appointment Cancelled
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      This visit has been removed from the active dispatch schedule.
                    </p>
                  </div>
                </div>

                {job.notes && (
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
                    <span className="font-semibold block text-slate-800 dark:text-zinc-200">Cancellation Note:</span>
                    <p className="mt-0.5">{job.notes}</p>
                  </div>
                )}

                <p className="text-xs text-slate-600 dark:text-zinc-400 pt-1">
                  If you wish to schedule a new appointment, please contact {org.name} directly.
                </p>
              </section>
            ) : isNoShow ? (
              <section className="bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-5 sm:p-6 space-y-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Missed Service Visit
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Technician was unable to access property or establish contact.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-400 pt-1">
                  Please call {org.name} directly to confirm access instructions and arrange a new visit.
                </p>
              </section>
            ) : (
              <section className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xs">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                      Service Progress
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Milestone Checkpoints
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200/80 dark:border-zinc-700">
                    Live Auto-Update
                  </span>
                </div>

                {/* Milestone Stepper */}
                <div className="relative flex justify-between items-start px-2 pt-2 pb-2">
                  {/* Background Track Line */}
                  <div className="absolute left-8 right-8 top-[26px] h-0.5 bg-slate-200 dark:bg-zinc-800 -z-0" />

                  {/* Progress Fill Line */}
                  <div
                    className="absolute left-8 top-[26px] h-0.5 bg-slate-900 dark:bg-zinc-100 transition-all duration-500 -z-0"
                    style={{
                      width: `${(currentStageIndex / (STAGES.length - 1)) * 88}%`
                    }}
                  />

                  {STAGES.map((stage, idx) => {
                    const isPast = idx < currentStageIndex
                    const isCurrent = idx === currentStageIndex
                    const Icon = stage.icon
                    const stageTime = stageTimestamps[idx]

                    return (
                      <div key={stage.id} className="relative z-10 flex flex-col items-center text-center max-w-[72px]">
                        <div
                          className={cn(
                            "w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-2xs",
                            isPast
                              ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                              : isCurrent
                              ? isCompleted
                                ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20"
                                : isArrived
                                ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                                : isInProgress
                                ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20"
                                : isEnRoute
                                ? "bg-blue-600 text-white ring-4 ring-blue-500/20 animate-pulse"
                                : "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 ring-4 ring-slate-900/15 dark:ring-zinc-100/15"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700"
                          )}
                        >
                          {isPast ? <Check className="w-5 h-5 stroke-[2.5]" /> : <Icon className="w-5 h-5" />}
                        </div>

                        <span
                          className={cn(
                            "text-xs font-bold mt-2.5 tracking-tight line-clamp-1",
                            isCurrent
                              ? "text-slate-900 dark:text-zinc-100"
                              : isPast
                              ? "text-slate-700 dark:text-zinc-300"
                              : "text-slate-400 dark:text-zinc-500"
                          )}
                        >
                          {stage.label}
                        </span>

                        {stageTime ? (
                          <span className="text-[10px] font-mono text-slate-500 dark:text-zinc-400 mt-0.5">
                            {stageTime}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 dark:text-zinc-600 mt-0.5">
                            {isCurrent ? 'Now' : 'Pending'}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 7: COMPLETED-WORK DOCUMENTATION (Photo Verification)  */}
            {/* ============================================================= */}
            {data.photos && data.photos.length > 0 && (
              <section className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Work Photo Verification
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Live photo proof captured on-site by your service technician
                      </p>
                    </div>
                  </div>

                  {/* Filter Pills */}
                  {beforePhotosCount > 0 && afterPhotosCount > 0 && (
                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setPhotoFilter('all')}
                        className={cn(
                          "px-3 py-1 rounded-lg transition-all cursor-pointer",
                          photoFilter === 'all'
                            ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs"
                            : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                        )}
                      >
                        All ({data.photos.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilter('before')}
                        className={cn(
                          "px-3 py-1 rounded-lg transition-all cursor-pointer",
                          photoFilter === 'before'
                            ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs"
                            : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                        )}
                      >
                        Before ({beforePhotosCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFilter('after')}
                        className={cn(
                          "px-3 py-1 rounded-lg transition-all cursor-pointer",
                          photoFilter === 'after'
                            ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                            : "text-slate-500 hover:text-slate-900 dark:text-zinc-400"
                        )}
                      >
                        After ({afterPhotosCount})
                      </button>
                    </div>
                  )}
                </div>

                {/* Photo Gallery Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  {filteredPhotos.map((photo) => (
                    <div
                      key={photo.id}
                      onClick={() => setActivePreviewPhoto(photo)}
                      className="group relative rounded-2xl overflow-hidden border border-slate-200/80 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 aspect-square cursor-pointer shadow-2xs transition-all hover:shadow-md"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || `${photo.photo_type} verification photo`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Photo Type Badge */}
                      <span
                        className={cn(
                          "absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shadow-xs",
                          photo.photo_type === 'before'
                            ? "bg-amber-600 text-white"
                            : photo.photo_type === 'after'
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-900 text-white"
                        )}
                      >
                        {photo.photo_type}
                      </span>

                      {photo.caption && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-xs text-white truncate">
                          {photo.caption}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 6: APPOINTMENT & SERVICE DETAILS CARD                 */}
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
                    {service?.name || job.title}
                  </h3>
                  {job.description && (
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed max-w-lg">
                      {job.description}
                    </p>
                  )}
                </div>

                {service?.price != null && (
                  <div className="text-left sm:text-right shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                      Service Rate
                    </span>
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      ${Number(service.price).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              {/* Schedule and Location Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                    <Calendar className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold">Date &amp; Arrival Window</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {formattedDate}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300">
                    {arrivalWindowText}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 space-y-1">
                  <div className="flex items-center gap-2 text-slate-500 dark:text-zinc-400">
                    <MapPin className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold">Service Property</span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {contact?.address ? contact.address.split(',')[0] : 'Customer Property'}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 truncate">
                    {contact?.address || 'Address provided upon appointment booking'}
                  </p>
                </div>
              </div>
            </section>

            {/* ============================================================= */}
            {/* SECTION 9: CUSTOMER FEEDBACK & REVIEWS (Dual-Track)           */}
            {/* ============================================================= */}
            {isCompleted && (
              <section className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-3xl p-5 sm:p-6 text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto shadow-2xs">
                  <Star className="w-6 h-6 fill-amber-400" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    How was your service experience?
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                    Tap below to rate your visit with {org.name}. Your feedback helps our team maintain the highest standard of service.
                  </p>
                </div>

                {/* 5-Star Interactive Selector */}
                <div className="flex justify-center gap-2 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => handleRatingClick(star)}
                      className={cn(
                        "p-3 rounded-2xl border transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center",
                        selectedRating && selectedRating >= star
                          ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-600 text-amber-500 dark:text-amber-400 shadow-2xs"
                          : "bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
                      )}
                      aria-label={`${star} star rating`}
                    >
                      <Star className={cn("w-6 h-6", selectedRating && selectedRating >= star ? "fill-amber-400" : "")} />
                    </button>
                  ))}
                </div>

                {/* Private Feedback Form (Available for all ratings without gating) */}
                {selectedRating && !feedbackSent && (
                  <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 rounded-2xl text-xs space-y-3 text-left animate-in fade-in max-w-lg mx-auto">
                    <p className="font-semibold text-slate-800 dark:text-zinc-200">
                      {selectedRating >= 4
                        ? 'Thank you! What did our team do well today?'
                        : 'We want to make this right. What could our team have done better?'}
                    </p>
                    <textarea
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="Optional: share details directly with the business owner..."
                      rows={3}
                      className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:border-slate-500 resize-none"
                    />
                    {feedbackError && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{feedbackError}</p>
                    )}
                    <button
                      type="button"
                      disabled={submittingFeedback}
                      onClick={handleFeedbackSubmit}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-900 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs min-h-[44px]"
                    >
                      {submittingFeedback ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <span>Submit Rating &amp; Feedback</span>
                      )}
                    </button>
                  </div>
                )}

                {feedbackSent && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in space-y-1 text-left max-w-lg mx-auto">
                    <p className="font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Thank you for letting us know</span>
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                      Your feedback has been delivered directly to the business owner. Management will review your experience and follow up promptly.
                    </p>
                  </div>
                )}

                {/* Google Maps Review Link (Unconditional, Non-Gated) */}
                {reviewUrl && (
                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 text-center space-y-2 max-w-md mx-auto">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      You can also share your review publicly on Google Maps:
                    </p>
                    <a
                      href={reviewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 font-bold text-xs transition-colors cursor-pointer shadow-2xs"
                    >
                      <span>Review on Google Maps</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </section>
            )}

          </main>

          {/* --------------------------------------------------------------- */}
          {/* SIDEBAR COLUMN (lg:col-span-4)                                  */}
          {/* --------------------------------------------------------------- */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">

            {/* ============================================================= */}
            {/* SECTION 5: TECHNICIAN & CREW INFORMATION CARD                 */}
            {/* ============================================================= */}
            <section
              aria-label="Service Team"
              className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                  Service Professional
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-[10px] font-bold border border-slate-200/80 dark:border-zinc-700">
                  {techName ? 'Assigned' : 'Dispatch Team'}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-base flex items-center justify-center shrink-0 shadow-2xs"
                  style={data.crew?.colorCode ? { borderColor: data.crew.colorCode } : undefined}
                >
                  {techInitials}
                </div>
                <div className="space-y-0.5 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                    {techName || 'Assigned Service Professional'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                    {techName ? `Field Specialist &bull; ${org.name}` : `Field Team &bull; ${org.name}`}
                  </p>
                </div>
              </div>

              {/* Factual Trade License Display */}
              {org.licenseNumber ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Trade License
                      </span>
                      <span className="text-xs font-mono text-slate-700 dark:text-zinc-300 font-bold">
                        #{org.licenseNumber}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                      Registered contractor license with {org.name}.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Company Contact Direct Actions */}
              {org.phone && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={`tel:${org.phone}`}
                    className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Office</span>
                  </a>
                  <a
                    href={`sms:${org.phone}`}
                    className="min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send SMS</span>
                  </a>
                </div>
              )}
            </section>

            {/* ============================================================= */}
            {/* SECTION 8: AUTHORITATIVE INVOICE & PAYMENT SUMMARY CARD       */}
            {/* ============================================================= */}
            {invoice && (
              <section
                aria-label="Invoice & Payment"
                className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-xs"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Invoice #{invoice.invoiceNumber}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      invoice.financialStatus === 'paid' || (!invoice.financialStatus && invoice.status === 'paid')
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                        : invoice.financialStatus === 'partially_paid'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                        : invoice.financialStatus === 'fully_refunded' || invoice.financialStatus === 'partially_refunded'
                        ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/40'
                        : invoice.financialStatus === 'voided'
                        ? 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                        : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/30'
                    )}
                  >
                    {(invoice.financialStatus || invoice.status).replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-zinc-400">Invoice Total:</span>
                    <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                      ${invoice.total.toFixed(2)}
                    </span>
                  </div>

                  {invoice.financialStatus === 'paid' || (!invoice.financialStatus && invoice.status === 'paid') ? (
                    <div className="space-y-3 pt-1">
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span className="font-semibold">Invoice paid in full. Thank you!</span>
                      </div>
                      {(invoice.receiptUrl || invoice.pdfUrl) && (
                        <a
                          href={invoice.receiptUrl || invoice.pdfUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full min-h-[44px] py-2 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                        >
                          <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>View Payment Receipt</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ) : invoice.financialStatus === 'fully_refunded' ? (
                    <div className="space-y-3 pt-1">
                      <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-800 dark:text-purple-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <RotateCcw className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span>Payment Refunded in Full</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          Total refunded: ${(invoice.totalRefunded ?? invoice.amountPaid).toFixed(2)}. The payment was credited back to your original payment method.
                        </p>
                      </div>
                      {(invoice.receiptUrl || invoice.pdfUrl) && (
                        <a
                          href={invoice.receiptUrl || invoice.pdfUrl || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full min-h-[44px] py-2 px-3 rounded-xl border border-purple-200 dark:border-purple-800/40 bg-purple-50/50 dark:bg-purple-950/20 hover:bg-purple-100/50 text-purple-800 dark:text-purple-300 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <span>View Refund Receipt</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ) : invoice.financialStatus === 'partially_refunded' ? (
                    <div className="space-y-3 pt-1">
                      <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-xs text-purple-800 dark:text-purple-300">
                        <span className="font-bold block">Partially Refunded</span>
                        <p className="text-[11px] mt-0.5">
                          Amount refunded: ${(invoice.totalRefunded ?? 0).toFixed(2)}.
                        </p>
                      </div>
                    </div>
                  ) : invoice.financialStatus === 'voided' ? (
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-400">
                      This invoice was voided by the contractor. No balance is due.
                    </div>
                  ) : invoice.amountDue > 0 ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                        <span>Balance Due:</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400 font-mono text-base">
                          ${invoice.amountDue.toFixed(2)}
                        </span>
                      </div>
                      {invoice.manageToken ? (
                        <Link
                          href={`/invoice/${invoice.manageToken}`}
                          className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                        >
                          <span>Pay Balance (${invoice.amountDue.toFixed(2)}) Online</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {invoice.hasMultipleInvoices && (
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 pt-1 border-t border-slate-100 dark:border-zinc-800">
                    Note: {invoice.multipleInvoicesCount} invoices are linked to this service. Primary invoice #{invoice.invoiceNumber} is displayed.
                  </p>
                )}
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 10: CUSTOMER REFERRAL AREA (Active Campaigns Only)   */}
            {/* ============================================================= */}
            {isCompleted && data.referral && data.referral.url && (
              <section
                aria-label="Referral Program"
                className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-4 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-700/50">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Refer a Neighbor - Recommend {org.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Share with neighbors, family, or friends
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  Love our service? Share your personal recommendation link with neighbors, family, or friends to easily book and schedule service with {org.name}.
                </p>

                {/* Link Copy Box */}
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/80 dark:border-zinc-800 rounded-2xl p-1.5 pl-3">
                  <span className="text-xs font-mono text-slate-700 dark:text-zinc-300 truncate flex-1 select-all">
                    {data.referral.url}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    {copiedReferral ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Share Actions */}
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleShareReferral}
                    className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Link</span>
                  </button>

                  <a
                    href={`sms:?&body=${encodeURIComponent(`Hey! I recommend ${org.name} for home service. Check them out here: ${data.referral.url}`)}`}
                    className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Text Friend</span>
                  </a>
                </div>
              </section>
            )}

            {/* ============================================================= */}
            {/* SECTION 11: DIRECT COMPANY CONTACT & SUPPORT CARD            */}
            {/* ============================================================= */}
            <section
              aria-label="Customer Support"
              className="rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 p-5 sm:p-6 space-y-3.5 shadow-xs"
            >
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
                  Questions or Changes?
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Direct Contractor Support
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Have gate access instructions, property details, or timing questions? Contact our dispatch team directly.
                </p>
              </div>

              {org.phone ? (
                <div className="space-y-2 pt-1">
                  <a
                    href={`tel:${org.phone}`}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call {org.phone}</span>
                  </a>
                  <a
                    href={`sms:${org.phone}`}
                    className="w-full min-h-[44px] py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Send SMS Message</span>
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
                  Contact information available on your original booking confirmation.
                </p>
              )}
            </section>

          </aside>
        </div>

        {/* ================================================================= */}
        {/* FOOTER & LIVE UPDATED TIMESTAMP                                   */}
        {/* ================================================================= */}
        <footer className="pt-6 pb-4 text-center text-xs text-slate-400 dark:text-zinc-600 space-y-2">
          <PoweredByBadge source="tracking" />
          <p className="font-mono text-[10px] text-slate-400 dark:text-zinc-600">
            Live Status Updated: {lastUpdated.toLocaleTimeString()} &bull; {tzFriendly}
          </p>
        </footer>

      </div>

      {/* =================================================================== */}
      {/* ACCESSIBLE WORK PHOTO LIGHTBOX MODAL                                */}
      {/* =================================================================== */}
      {activePreviewPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo Preview"
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in cursor-pointer"
          onClick={() => setActivePreviewPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActivePreviewPhoto(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Close photo preview"
            >
              <X className="w-6 h-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePreviewPhoto.url}
              alt={activePreviewPhoto.caption || 'Work verification'}
              className="max-h-[75vh] w-auto rounded-2xl object-contain shadow-2xl"
            />
            {activePreviewPhoto.caption && (
              <p className="mt-3 text-xs sm:text-sm text-white font-medium text-center bg-black/60 px-4 py-1.5 rounded-full">
                {activePreviewPhoto.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
