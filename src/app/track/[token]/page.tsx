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
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'

interface TrackingPayload {
  job: {
    id: string
    jobNumber: string
    title: string
    description?: string | null
    status: 'scheduled' | 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
    scheduledStart: string
    scheduledEnd?: string | null
    enRouteAt?: string | null
    startedAt?: string | null
    completedAt?: string | null
    notes?: string | null
    trackingToken: string
  }
  org: {
    id: string
    name: string
    phone?: string | null
    logoUrl?: string | null
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
}

const STAGES = [
  { id: 'confirmed', label: 'Confirmed', icon: Calendar, desc: 'Appointment booked' },
  { id: 'en_route', label: 'En Route', icon: Navigation, desc: 'Technician on the way' },
  { id: 'in_progress', label: 'In Progress', icon: Wrench, desc: 'Work underway on-site' },
  { id: 'completed', label: 'Completed', icon: CheckCircle2, desc: 'Job finished' }
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
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-white">
        <Loader2 className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mb-3" />
        <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Connecting to live job pulse...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-slate-900 dark:text-white">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
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

  // Calculate current stage index
  const getStageIndex = (status: string) => {
    switch (status) {
      case 'scheduled':
      case 'confirmed':
        return 0
      case 'en_route':
        return 1
      case 'in_progress':
        return 2
      case 'completed':
        return 3
      default:
        return 0
    }
  }

  const currentStageIndex = getStageIndex(job.status)
  const isCompleted = job.status === 'completed'
  const isEnRoute = job.status === 'en_route'
  const isInProgress = job.status === 'in_progress'

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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex justify-center selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-lg min-h-screen flex flex-col justify-between p-4 sm:p-6 space-y-6">

        {/* Top Header Card */}
        <header className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400 text-lg">
                {org.name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-zinc-100 tracking-tight">{org.name}</h1>
                <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Live Job Tracker &bull; Job #{job.jobNumber}
                </p>
              </div>
            </div>

            {/* Quick Contact Buttons */}
            {org.phone && (
              <div className="flex items-center gap-1.5">
                <a
                  href={`sms:${org.phone}`}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs"
                  title="Text Business"
                >
                  <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </a>
                <a
                  href={`tel:${org.phone}`}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850 text-slate-700 dark:text-zinc-200 transition-colors shadow-xs"
                  title="Call Business"
                >
                  <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </a>
              </div>
            )}
          </div>

          {/* Dynamic Status Banner */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isCompleted
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              : isEnRoute
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-500/40 text-amber-800 dark:text-amber-200'
              : isInProgress
              ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-500/40 text-sky-800 dark:text-sky-200'
              : 'bg-white dark:bg-zinc-900/90 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 shadow-xs'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${
                isCompleted
                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : isEnRoute
                  ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  : isInProgress
                  ? 'bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400'
                  : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
              }`}>
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : isEnRoute ? (
                  <Navigation className="w-5 h-5 animate-bounce" />
                ) : isInProgress ? (
                  <Wrench className="w-5 h-5 animate-pulse" />
                ) : (
                  <Clock className="w-5 h-5" />
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-sm font-bold uppercase tracking-wider">
                  {isCompleted
                    ? 'Job Successfully Completed'
                    : isEnRoute
                    ? 'Technician Is En Route!'
                    : isInProgress
                    ? 'Work Underway On-Site'
                    : 'Appointment Confirmed'}
                </h2>
                <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
                  {isCompleted
                    ? 'All work has been finished. Thank you for your business!'
                    : isEnRoute
                    ? 'Your technician is on their way to your location. Please ensure access is clear.'
                    : isInProgress
                    ? 'Your technician is actively working on your service right now.'
                    : `Scheduled for ${formattedDate} at ${formattedTime}. We look forward to seeing you.`}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Visual Progress Stepper (Domino's / Uber style) */}
        <section className="bg-white dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-zinc-400 pb-2 border-b border-slate-100 dark:border-zinc-800/60">
            <span>Service Progress</span>
            <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">Auto-refreshing</span>
          </div>

          <div className="relative flex justify-between items-center px-1">
            {/* Connecting Track Line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 dark:bg-zinc-800 -z-0" />
            <div
              className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-indigo-600 dark:bg-indigo-500 transition-all duration-700 -z-0"
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
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : isCurrent
                        ? isCompleted
                          ? 'bg-emerald-600 dark:bg-emerald-500 text-white ring-4 ring-emerald-500/20'
                          : 'bg-indigo-600 dark:bg-indigo-500 text-white ring-4 ring-indigo-500/20 animate-pulse'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <span
                    className={`text-[10px] font-bold mt-2 tracking-tight ${
                      isCurrent
                        ? 'text-indigo-600 dark:text-indigo-300'
                        : isPast
                        ? 'text-slate-800 dark:text-zinc-200'
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

        {/* Service Details Card */}
        <section className="bg-white dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 rounded-2xl p-5 space-y-3.5 shadow-xs text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-400">Appointment Details</h3>
          
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-400 text-[11px] block">Date &amp; Time</span>
                <span className="text-slate-900 dark:text-zinc-100 font-semibold">{formattedDate} at {formattedTime}</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Wrench className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 dark:text-zinc-400 text-[11px] block">Service</span>
                <span className="text-slate-900 dark:text-zinc-100 font-semibold">
                  {service?.name || job.title}
                  {service?.price ? ` • $${service.price}` : ''}
                </span>
                {job.description && (
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px] mt-0.5">{job.description}</p>
                )}
              </div>
            </div>

            {contact?.address && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-400 dark:text-zinc-400 text-[11px] block">Service Location</span>
                  <span className="text-slate-900 dark:text-zinc-100 font-medium">{contact.address}</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Invoice & Payment Card (When Invoice is Ready) */}
        {invoice && (
          <section className="bg-white dark:bg-zinc-900/90 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">Invoice #{invoice.invoiceNumber}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                invoice.status === 'paid'
                  ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30'
              }`}>
                {invoice.status.replace('_', ' ')}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-zinc-400">Total Amount:</span>
              <span className="text-base font-bold text-slate-900 dark:text-zinc-100">${invoice.total.toFixed(2)}</span>
            </div>

            {invoice.status !== 'paid' && invoice.amountDue > 0 ? (
              <Link
                href={`/invoice/${invoice.manageToken}`}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-md shadow-indigo-600/20 cursor-pointer"
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

        {/* 5-Star Review Prompt (When Job is Completed) */}
        {isCompleted && (
          <section className="bg-white dark:bg-zinc-900/90 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 text-center space-y-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Star className="w-5 h-5 fill-amber-400" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">How was your experience today?</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Tap below to rate your service with {org.name}:</p>
            </div>

            {/* Interactive 5-Star Selector */}
            <div className="flex justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingClick(star)}
                  className={`p-2 rounded-xl border transition-all cursor-pointer ${
                    selectedRating && selectedRating >= star
                      ? 'bg-amber-50 dark:bg-amber-500/20 border-amber-300 dark:border-amber-500/50 text-amber-500 dark:text-amber-400 scale-105'
                      : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                  }`}
                >
                  <Star className={`w-5 h-5 ${selectedRating && selectedRating >= star ? 'fill-amber-400' : ''}`} />
                </button>
              ))}
            </div>

            {/* Smart Review Handling */}
            {selectedRating && selectedRating >= 4 && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 space-y-2 animate-in fade-in">
                <p className="font-semibold">Thank you for the 5-star rating! 🎉</p>
                {reviewUrl ? (
                  <a
                    href={reviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors cursor-pointer"
                  >
                    <span>Share on Google Maps</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <p className="text-slate-500 dark:text-zinc-400 text-[11px]">We appreciate your business!</p>
                )}
              </div>
            )}

            {selectedRating && selectedRating < 4 && !feedbackSent && (
              <div className="p-3.5 bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 rounded-xl text-xs space-y-2.5 text-left animate-in fade-in">
                <p className="font-semibold text-slate-800 dark:text-zinc-200">We want to make this right. What could we have done better?</p>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Tell us what happened so management can follow up..."
                  rows={3}
                  className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:outline-hidden focus:border-indigo-500 resize-none"
                />
                {feedbackError && (
                  <p className="text-[11px] text-red-600 dark:text-red-400 font-medium">{feedbackError}</p>
                )}
                <button
                  type="button"
                  disabled={submittingFeedback || !feedbackText.trim()}
                  onClick={handleFeedbackSubmit}
                  className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
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
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in space-y-1 text-left">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Thank you for letting us know</span>
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400/90 leading-relaxed">
                  Your feedback has been delivered directly to the business owner. Management will review your experience and follow up with you promptly.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Footer */}
        <footer className="pt-4 text-center text-[11px] text-slate-400 dark:text-zinc-600 space-y-1">
          <p>Live Job Pulse powered by <span className="font-semibold text-slate-600 dark:text-zinc-400">CaptoDesk</span></p>
          <p className="font-mono text-[9px] text-slate-400 dark:text-zinc-700">Updated: {lastUpdated.toLocaleTimeString()}</p>
        </footer>

      </div>
    </div>
  )
}
