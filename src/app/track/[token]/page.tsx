'use client'

import { useEffect, useState, use } from 'react'
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
  Loader2,
  ExternalLink,
  ChevronRight,
  Gift,
  Copy,
  Check,
  Share2,
  Camera,
  X,
  BadgeCheck,
  UserCheck
} from 'lucide-react'
import Link from 'next/link'

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
    role?: string | null
    phone?: string | null
    avatarUrl?: string | null
  } | null
  org: {
    id: string
    name: string
    phone?: string | null
    logoUrl?: string | null
    licenseNumber?: string | null
    trackingMode?: 'milestone' | 'geofence_live' | null
    trackingGeofenceMiles?: number | null
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
    invoiceNumber: string
    total: number
    amountPaid: number
    amountDue: number
    status: string
    manageToken: string
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
  { id: 'en_route', label: 'En Route', icon: Navigation, desc: 'Technician on the way' },
  { id: 'arrived', label: 'Arrived', icon: MapPin, desc: 'Arrived on-site' },
  { id: 'in_progress', label: 'Working', icon: Wrench, desc: 'Service underway' },
  { id: 'completed', label: 'Done', icon: CheckCircle2, desc: 'Service completed' }
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

  // Work photo proof lightbox state
  const [activePreviewPhoto, setActivePreviewPhoto] = useState<any | null>(null)
  const [photoFilter, setPhotoFilter] = useState<'all' | 'before' | 'after'>('all')

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim() || !selectedRating || !token) return
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

  const fetchTracking = async (isPoll = false) => {
    if (!token) return
    if (!isPoll) setLoading(true)

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
      if (!isPoll) setError('Network error loading job tracking. Please check your connection.')
    } finally {
      if (!isPoll) setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchTracking()
  }, [token])

  // Live real-time polling every 8 seconds
  useEffect(() => {
    if (!token || error) return
    const interval = setInterval(() => {
      fetchTracking(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [token, error])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-zinc-100">
        <Loader2 className="w-8 h-8 text-slate-700 dark:text-zinc-300 animate-spin mb-3" />
        <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Connecting to live service tracker...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-zinc-100">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
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
  const getStageIndex = (currentJob: TrackingPayload['job']) => {
    if (currentJob.status === 'completed' || Boolean(currentJob.completedAt)) return 4
    if (currentJob.status === 'arrived' || (Boolean(currentJob.arrivedAt) && !currentJob.startedAt)) return 2
    if (currentJob.status === 'in_progress' || Boolean(currentJob.startedAt)) return 3
    if (currentJob.status === 'en_route' || Boolean(currentJob.enRouteAt)) return 1
    return 0
  }

  const currentStageIndex = getStageIndex(job)
  const isCompleted = currentStageIndex === 4
  const isInProgress = currentStageIndex === 3
  const isArrived = currentStageIndex === 2
  const isEnRoute = currentStageIndex === 1
  const isScheduled = currentStageIndex === 0

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

  // ETA Clock Time Calculation
  let etaDisplay: string | null = null
  let etaClockTime: string | null = null

  if (isEnRoute && job.etaMinutes && job.etaMinutes > 0) {
    etaDisplay = `~${job.etaMinutes} min${job.etaMinutes === 1 ? '' : 's'}`
    if (job.enRouteAt) {
      const departure = new Date(job.enRouteAt)
      const estimatedArrival = new Date(departure.getTime() + job.etaMinutes * 60000)
      etaClockTime = estimatedArrival.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      })
    }
  }

  const formattedDate = new Date(job.scheduledStart).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })

  const formattedTime = new Date(job.scheduledStart).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

  const handleRatingClick = (stars: number) => {
    setSelectedRating(stars)
    if (stars >= 4 && reviewUrl) {
      window.open(reviewUrl, '_blank')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex justify-center selection:bg-slate-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <div className="w-full max-w-lg min-h-screen flex flex-col justify-between p-4 sm:p-6 space-y-5">

        {/* Company Header Card */}
        <header className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900 text-white dark:bg-zinc-800 dark:text-zinc-100 border border-slate-800 dark:border-zinc-700 flex items-center justify-center font-bold text-base shadow-xs">
                {org.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{org.name}</h1>
                  <BadgeCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  Live Service Tracker &bull; Job #{job.jobNumber}
                </p>
              </div>
            </div>

            {/* Quick Contact Buttons */}
            {org.phone && (
              <div className="flex items-center gap-1.5">
                <a
                  href={`sms:${org.phone}`}
                  className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs"
                  title="Text Contractor"
                  aria-label="Text Contractor"
                >
                  <MessageSquare className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                </a>
                <a
                  href={`tel:${org.phone}`}
                  className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs"
                  title="Call Contractor"
                  aria-label="Call Contractor"
                >
                  <Phone className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                </a>
              </div>
            )}
          </div>

          {/* Senior Craft Arrival & Status Hero Card */}
          <div
            className={`p-5 rounded-2xl border bg-white dark:bg-zinc-900 shadow-xs transition-all ${
              isCompleted
                ? 'border-l-4 border-l-emerald-600 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800'
                : isInProgress
                ? 'border-l-4 border-l-sky-600 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800'
                : isArrived
                ? 'border-l-4 border-l-amber-500 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800'
                : isEnRoute
                ? 'border-l-4 border-l-blue-600 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800'
                : 'border-l-4 border-l-slate-400 border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-l-zinc-600 dark:border-t-zinc-800 dark:border-r-zinc-800 dark:border-b-zinc-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                      isCompleted
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50'
                        : isInProgress
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50'
                        : isArrived
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50'
                        : isEnRoute
                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCompleted
                          ? 'bg-emerald-600'
                          : isInProgress
                          ? 'bg-sky-600'
                          : isArrived
                          ? 'bg-amber-500'
                          : isEnRoute
                          ? 'bg-blue-600'
                          : 'bg-slate-400'
                      }`}
                    />
                    {isCompleted
                      ? 'Service Complete'
                      : isInProgress
                      ? 'Work In Progress'
                      : isArrived
                      ? 'Arrived On-Site'
                      : isEnRoute
                      ? 'En Route'
                      : 'Confirmed'}
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">
                  {isCompleted
                    ? 'Work Finished & Verified'
                    : isInProgress
                    ? 'Service Underway on Your Property'
                    : isArrived
                    ? (techName ? `${techName} Has Arrived On-Site` : 'Technician Has Arrived On-Site')
                    : isEnRoute
                    ? (techName ? `${techName} is heading your way` : 'Technician is heading your way')
                    : 'Your Appointment is Confirmed'}
                </h2>

                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {isCompleted
                    ? 'All tasks have been completed. Thank you for choosing us for your home service!'
                    : isInProgress
                    ? 'Your technician is actively performing service on-site. Feel free to speak with them directly if needed.'
                    : isArrived
                    ? 'Your technician has arrived at your address. Please ensure front access or gates are open.'
                    : isEnRoute
                    ? (techName ? `${techName} is driving to your service address.` : 'Your technician is in transit to your property.')
                    : `Scheduled for ${formattedDate} at ${formattedTime}. We look forward to serving you.`}
                </p>
              </div>

              {/* ETA Highlight Badge when En Route */}
              {isEnRoute && etaDisplay && (
                <div className="shrink-0 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl px-3 py-2 text-right">
                  <span className="block text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                    ETA
                  </span>
                  <span className="block text-lg font-bold text-blue-900 dark:text-blue-100 font-mono">
                    {etaDisplay}
                  </span>
                  {etaClockTime && (
                    <span className="block text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      by {etaClockTime}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Geofence Live Proximity Radar (When enabled by contractor) */}
            {isEnRoute && org.trackingMode === 'geofence_live' && (
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  Live Geofence Active &bull; Vehicle is within {org.trackingGeofenceMiles || 5} miles of your property
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Domino's 5-Stage Smart Milestone Stepper */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400 pb-2 border-b border-slate-100 dark:border-zinc-800">
            <span>Service Milestones</span>
            <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">Live Auto-Update</span>
          </div>

          <div className="relative flex justify-between items-center px-2 pt-1 pb-1">
            {/* Background Track Line */}
            <div className="absolute left-6 right-6 top-[18px] h-0.5 bg-slate-200 dark:bg-zinc-800 -z-0" />

            {/* Progress Fill Line */}
            <div
              className="absolute left-6 top-[18px] h-0.5 bg-slate-900 dark:bg-zinc-100 transition-all duration-500 -z-0"
              style={{
                width: `${(currentStageIndex / (STAGES.length - 1)) * 88}%`
              }}
            />

            {STAGES.map((stage, idx) => {
              const isPast = idx < currentStageIndex
              const isCurrent = idx === currentStageIndex
              const Icon = stage.icon

              return (
                <div key={stage.id} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isPast
                        ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-xs'
                        : isCurrent
                        ? isCompleted
                          ? 'bg-emerald-600 text-white ring-3 ring-emerald-500/20'
                          : isArrived
                          ? 'bg-amber-500 text-white ring-3 ring-amber-500/20'
                          : isInProgress
                          ? 'bg-sky-600 text-white ring-3 ring-sky-500/20'
                          : isEnRoute
                          ? 'bg-blue-600 text-white ring-3 ring-blue-500/20'
                          : 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 ring-3 ring-slate-900/15 dark:ring-zinc-100/15'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    {isPast ? <Check className="w-4 h-4 stroke-[2.5]" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span
                    className={`text-[10px] font-bold mt-2 tracking-tight ${
                      isCurrent
                        ? 'text-slate-900 dark:text-zinc-100'
                        : isPast
                        ? 'text-slate-700 dark:text-zinc-300'
                        : 'text-slate-400 dark:text-zinc-500'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Technician & Safety Verification Card */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 font-bold text-base flex items-center justify-center shrink-0">
                {techInitials}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    {techName || `${org.name} Specialist`}
                  </h3>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  {techName ? `Assigned Technician &bull; ${org.name}` : `Certified Specialist &bull; ${org.name}`}
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800/40">
              Identity Verified
            </span>
          </div>

          {/* Trade License Verification Badge */}
          {org.licenseNumber ? (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-900 dark:text-zinc-100">
                    State Certified Trade License
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    #{org.licenseNumber}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                  Registered, bonded &amp; insured contractor for customer safety.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Certified service provider &bull; Insured and background verified.</span>
            </div>
          )}

          {/* 1-Tap Technician Contact Buttons */}
          {org.phone && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`tel:${org.phone}`}
                className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Company</span>
              </a>
              <a
                href={`sms:${org.phone}`}
                className="min-h-[44px] py-2 px-3 rounded-xl bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Send SMS</span>
              </a>
            </div>
          )}
        </section>

        {/* Appointment & Service Details Card */}
        <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3.5 shadow-xs text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400">
            Appointment Details
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-400 text-[11px] block">Date &amp; Arrival Window</span>
                <span className="text-slate-900 dark:text-zinc-100 font-semibold">
                  {formattedDate} at {formattedTime}
                </span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Wrench className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-400 text-[11px] block">Service</span>
                <span className="text-slate-900 dark:text-zinc-100 font-semibold">
                  {service?.name || job.title}
                  {service?.price ? ` &bull; $${service.price}` : ''}
                </span>
                {job.description && (
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5 leading-relaxed">
                    {job.description}
                  </p>
                )}
              </div>
            </div>

            {contact?.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-slate-500 dark:text-zinc-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 dark:text-zinc-400 text-[11px] block">Service Location</span>
                  <span className="text-slate-900 dark:text-zinc-100 font-medium">{contact.address}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Work Photo Proof (Before & After Visual Transformation) */}
        {data.photos && data.photos.length > 0 && (
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                    Work Photo Verification
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                    Live photos captured on-site by your technician
                  </p>
                </div>
              </div>

              {/* Quick filter pills */}
              {data.photos.some((p) => p.photo_type === 'before') &&
                data.photos.some((p) => p.photo_type === 'after') && (
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setPhotoFilter('all')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        photoFilter === 'all'
                          ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                      }`}
                    >
                      All ({data.photos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoFilter('before')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        photoFilter === 'before'
                          ? 'bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                      }`}
                    >
                      Before
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoFilter('after')}
                      className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                        photoFilter === 'after'
                          ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900 dark:text-zinc-400'
                      }`}
                    >
                      After
                    </button>
                  </div>
                )}
            </div>

            {/* Photo Gallery Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {data.photos
                .filter((p) => photoFilter === 'all' || p.photo_type === photoFilter)
                .map((photo) => (
                  <div
                    key={photo.id}
                    onClick={() => setActivePreviewPhoto(photo)}
                    className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-800 aspect-square cursor-pointer shadow-2xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption || `${photo.photo_type} photo`}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />

                    {/* Badge */}
                    <span
                      className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider shadow-xs ${
                        photo.photo_type === 'before'
                          ? 'bg-amber-600 text-white'
                          : photo.photo_type === 'after'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 text-white'
                      }`}
                    >
                      {photo.photo_type}
                    </span>

                    {photo.caption && (
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-1.5 text-[10px] text-white truncate">
                        {photo.caption}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Invoice & Online Payment Card */}
        {invoice && (
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-700 dark:text-zinc-300" />
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Invoice #{invoice.invoiceNumber}
                </span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  invoice.status === 'paid'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                }`}
              >
                {invoice.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Total Amount:</span>
              <span className="text-base font-bold text-slate-900 dark:text-zinc-100 font-mono">
                ${invoice.total.toFixed(2)}
              </span>
            </div>

            {invoice.status !== 'paid' && invoice.amountDue > 0 ? (
              <Link
                href={`/invoice/${invoice.manageToken}`}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
              >
                <span>Pay Balance (${invoice.amountDue.toFixed(2)}) Online</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Invoice paid in full. Thank you!</span>
              </div>
            )}
          </section>
        )}

        {/* 5-Star Direct Google Review Prompt (When Job is Completed) */}
        {isCompleted && (
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-center space-y-3.5 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">How was your service today?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Tap below to rate your experience with {org.name}:</p>
            </div>

            {/* Interactive 5-Star Selector */}
            <div className="flex justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingClick(star)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                    selectedRating && selectedRating >= star
                      ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-600 text-amber-500 dark:text-amber-400'
                      : 'bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                  }`}
                  aria-label={`${star} star rating`}
                >
                  <Star className={`w-5 h-5 ${selectedRating && selectedRating >= star ? 'fill-amber-400' : ''}`} />
                </button>
              ))}
            </div>

            {/* Direct Google Maps Review Link when 4 or 5 stars */}
            {selectedRating && selectedRating >= 4 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 space-y-2 animate-in fade-in">
                <p className="font-semibold">Thank you for the 5-star rating! We appreciate you.</p>
                {reviewUrl ? (
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer"
                  >
                    <span>Post Review on Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px]">We appreciate your business!</p>
                )}
              </div>
            )}

            {/* Private Feedback Form when 1-3 stars */}
            {selectedRating && selectedRating < 4 && !feedbackSent && (
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs space-y-2.5 text-left animate-in fade-in">
                <p className="font-semibold text-slate-800 dark:text-zinc-200">
                  We want to make this right. What could we have done better?
                </p>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what happened so the owner can follow up directly..."
                  rows={3}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:border-slate-500 resize-none"
                />
                {feedbackError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{feedbackError}</p>
                )}
                <button
                  type="button"
                  disabled={submittingFeedback || !feedbackText.trim()}
                  onClick={handleFeedbackSubmit}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-900 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {submittingFeedback ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending to Owner...</span>
                    </>
                  ) : (
                    <span>Submit Private Feedback</span>
                  )}
                </button>
              </div>
            )}

            {feedbackSent && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in space-y-1 text-left">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Thank you for letting us know</span>
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Your feedback has been delivered directly to the business owner. Management will review your experience and follow up promptly.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Neighbor Referral Engine ("Give $25, Get $25") */}
        {isCompleted && data.referral && (
          <section className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center shrink-0 border border-slate-200 dark:border-zinc-700">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  Give ${data.referral.discountAmount}, Get ${data.referral.rewardAmount}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Share your link with neighbors, family, or friends
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              When friends book with your link, they receive <strong>${data.referral.discountAmount} off</strong> their first service, and you get a <strong>${data.referral.rewardAmount} credit</strong> toward your next visit.
            </p>

            {/* Link Copy Box */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 rounded-xl p-1.5 pl-3">
              <span className="text-xs font-mono text-slate-700 dark:text-zinc-300 truncate flex-1 select-all">
                {data.referral.url}
              </span>
              <button
                type="button"
                onClick={handleCopyReferral}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
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

            {/* Quick Share Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <a
                href={`sms:?&body=${encodeURIComponent(`Hey! Check out ${org.name} - here is $${data.referral.discountAmount} off your service: ${data.referral.url}`)}`}
                className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Text a Friend</span>
              </a>

              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Hey! Check out ${org.name} - here is $${data.referral.discountAmount} off your service: ${data.referral.url}`)}`}
                target="_blank"
                rel="noreferrer"
                className="min-h-[44px] py-2 px-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 pb-2 text-center text-[11px] text-slate-400 dark:text-zinc-600 space-y-1">
          <p>
            Service Tracker powered by <span className="font-semibold text-slate-600 dark:text-zinc-400">CaptoDesk</span>
          </p>
          <p className="font-mono text-[9px] text-slate-400 dark:text-zinc-700">
            Updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </footer>

      </div>

      {/* Lightbox Photo Preview Modal */}
      {activePreviewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in cursor-pointer"
          onClick={() => setActivePreviewPhoto(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setActivePreviewPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
              aria-label="Close photo preview"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activePreviewPhoto.url}
              alt={activePreviewPhoto.caption || 'Work verification'}
              className="max-h-[75vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            {activePreviewPhoto.caption && (
              <p className="mt-3 text-xs sm:text-sm text-white font-medium text-center bg-black/50 px-3 py-1 rounded-full">
                {activePreviewPhoto.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
