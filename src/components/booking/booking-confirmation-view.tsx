'use client'

import { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Calendar,
  MapPin,
  Truck,
  Navigation,
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronRight,
  Copy,
  Check,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  User,
  Sparkles
} from 'lucide-react'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'
import { formatTimeInTz, getFriendlyTimezoneLabel } from '@/lib/temporal/timezone'
import { combineStreetAndUnit } from '@/lib/booking/customer-input-formatter'
import { cn } from '@/lib/utils'

export interface BookingConfirmationViewProps {
  org: {
    id: string
    name: string
    slug: string
    phone?: string | null
    timezone?: string
    booking_mode?: string
  }
  service: {
    id: string
    name: string
    duration_minutes: number
    price?: number | null
    pricing_model?: string
    description?: string | null
  }
  selectedAddOns: Array<{
    id: string
    name: string
    price?: number | null
    duration_minutes?: number
  }>
  selectedSlot: {
    startTime: string
    endTime: string
    displayTime: string
    date: string
  }
  formData: {
    firstName?: string
    lastName?: string
    name?: string
    phone: string
    email?: string
    address?: string
    streetAddress?: string
    unit?: string
    city?: string
    state?: string
    zip?: string
    notes?: string
    accessInfo?: string
  }
  confirmedBooking: {
    success?: boolean
    appointment?: any
    manageToken: string
    manageUrl?: string
    trackingToken?: string | null
    trackingUrl?: string | null
    status: string
    smsStatus?: 'sent' | 'failed' | 'suppressed_starter' | 'suppressed_trial' | 'opt_out' | 'no_phone' | 'compliance_blocked' | 'none'
    smsError?: string | null
  }
  dynamicPricing?: {
    total: number
    formattedTotal: string
    hasNumericBase?: boolean
    hasPrice?: boolean
  } | null
}

export function BookingConfirmationView({
  org,
  service,
  selectedAddOns = [],
  selectedSlot,
  formData,
  confirmedBooking,
  dynamicPricing
}: BookingConfirmationViewProps) {
  const [copiedLink, setCopiedLink] = useState(false)
  const isInstant = confirmedBooking.status === 'confirmed'
  const timezone = org.timezone || 'America/Chicago'

  const startDate = new Date(selectedSlot.startTime)
  const endDate = new Date(selectedSlot.endTime)
  const formattedStartTime = formatTimeInTz(startDate, timezone)
  const formattedEndTime = formatTimeInTz(endDate, timezone)
  const tzLabel = getFriendlyTimezoneLabel(timezone, startDate)

  // Confirmation reference code
  const aptId = confirmedBooking.appointment?.id || ''
  const referenceCode = aptId ? `#APT-${aptId.substring(0, 8).toUpperCase()}` : '#APT-CONFIRMED'

  // Manage Link
  const manageUrl = typeof window !== 'undefined'
    ? (window.location.hostname.startsWith('book.')
        ? `${window.location.origin}/manage/${confirmedBooking.manageToken}`
        : `${window.location.origin}/book/manage/${confirmedBooking.manageToken}`)
    : `/book/manage/${confirmedBooking.manageToken}`

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(manageUrl).then(() => {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2500)
      })
    }
  }

  // Model-specific pricing description
  const pricingModel = service.pricing_model || 'fixed'
  const isStartingAt = pricingModel === 'starting_at'
  const isQuoteOnSite = pricingModel === 'quote_on_site'
  const isDiagnosticFee = pricingModel === 'diagnostic_fee'
  const isFreeEstimate = pricingModel === 'free_estimate'

  // SMS status breakdown
  const smsStatus = confirmedBooking.smsStatus || 'sent'
  const isSmsDelivered = smsStatus === 'sent'
  const isSmsOptOut = smsStatus === 'opt_out'
  const isSmsNoticeRequired = !isSmsDelivered && !isSmsOptOut

  // Address assembly
  const displayAddress = formData.address || (formData.streetAddress ? combineStreetAndUnit(formData.streetAddress, formData.unit) : '')

  return (
    <div className="space-y-6 pt-2 text-left">
      {/* 1. HERO STATUS CARD */}
      <div className={cn(
        "rounded-3xl p-6 text-center border shadow-xs transition-all space-y-4",
        isInstant
          ? "bg-gradient-to-b from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/30"
          : "bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30"
      )}>
        <div className={cn(
          "h-16 w-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm",
          isInstant
            ? "bg-emerald-600 text-white"
            : "bg-amber-500 text-slate-950"
        )}>
          {isInstant ? (
            <CheckCircle2 className="h-9 w-9 stroke-[2.2]" />
          ) : (
            <Clock className="h-9 w-9 stroke-[2.2]" />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <span className={cn(
              "px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider",
              isInstant
                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
            )}>
              {isInstant ? "Instant Confirmation" : "Booking Request Received"}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {isInstant ? "You're All Booked!" : "Request Successfully Received!"}
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
            {isInstant
              ? `Your appointment with ${org.name} is confirmed and reserved on their calendar.`
              : `We have received your booking request for ${org.name}. Their team will review and confirm your slot shortly.`}
          </p>

          <p className="font-mono text-xs text-slate-500 dark:text-zinc-500 font-bold tracking-wider pt-1">
            Reference: {referenceCode}
          </p>
        </div>
      </div>

      {/* 2. ACCURATE SMS COMMUNICATION STATUS BANNER */}
      {isSmsDelivered && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
          <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">
              SMS Confirmation Sent
            </span>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
              A text message with your appointment summary and self-service management link was sent to <strong>{formData.phone}</strong>.
            </p>
          </div>
        </div>
      )}

      {isSmsNoticeRequired && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">
              Appointment Committed in System
            </span>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
              Your appointment is fully secured. Automated SMS notifications are temporarily unavailable for this booking. Please bookmark this page or copy your direct self-service link below.
            </p>
          </div>
        </div>
      )}

      {isSmsOptOut && (
        <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 flex items-start gap-3 text-xs text-slate-700 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-zinc-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block">
              SMS Updates Disabled (Opted Out)
            </span>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
              You chose not to receive text reminders. Use the secure link below to check status or reschedule anytime.
            </p>
          </div>
        </div>
      )}

      {/* 3. ITEMIZED APPOINTMENT & PRICING BREAKDOWN CARD */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
              Service Details
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {service.name}
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            {service.duration_minutes} mins
          </span>
        </div>

        {/* Add-ons line items */}
        {selectedAddOns.length > 0 && (
          <div className="space-y-2 py-1 border-b border-slate-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
              Selected Add-ons ({selectedAddOns.length})
            </span>
            <div className="space-y-1.5">
              {selectedAddOns.map((addon) => (
                <div key={addon.id || addon.name} className="flex items-center justify-between text-xs text-slate-700 dark:text-zinc-300">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                    <span>{addon.name}</span>
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {addon.price && Number(addon.price) > 0 ? `+$${Number(addon.price).toFixed(2)}` : 'Included'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canonical Pricing Model Presentation */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-700/80 space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-600 dark:text-zinc-400">
              {isStartingAt ? "Pricing Model (Starting Rate)" :
               isQuoteOnSite ? "Pricing Model (Custom Assessment)" :
               isDiagnosticFee ? "Pricing Model (Diagnostic Fee)" :
               isFreeEstimate ? "Pricing Model (Free Estimate)" :
               "Pricing (Fixed Amount)"}
            </span>
            <span className="font-black text-sm text-slate-900 dark:text-white">
              {dynamicPricing?.formattedTotal || (service.price ? `$${Number(service.price).toFixed(2)}` : '$0.00')}
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            {isStartingAt && "Base price covers standard arrival and inspection. Exact final total will be confirmed on-site before any additional work starts."}
            {isQuoteOnSite && "$0 due at online booking. A clear written proposal will be provided on-site before any paid service is performed."}
            {isDiagnosticFee && "Diagnostic fee covers comprehensive inspection and troubleshooting. The fee is credited toward your repair if work is approved."}
            {isFreeEstimate && "$0.00 complimentary on-site consultation. No obligation or payment required."}
            {pricingModel === 'fixed' && "All inclusive fixed rate for this scheduled service."}
          </p>
        </div>

        {/* Visit Window & Location */}
        <div className="space-y-2.5 text-xs pt-1">
          <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                {selectedSlot.date}
              </span>
              <span className="text-slate-500 dark:text-zinc-400">
                {formattedStartTime} - {formattedEndTime} ({tzLabel})
              </span>
            </div>
          </div>

          {displayAddress && (
            <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300">
              <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Service Property Address
                </span>
                <span className="text-slate-500 dark:text-zinc-400">
                  {displayAddress}
                </span>
              </div>
            </div>
          )}

          {formData.accessInfo && (
            <div className="flex items-start gap-3 text-slate-700 dark:text-zinc-300 pt-1 border-t border-slate-100 dark:border-zinc-800">
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">
                  Property Access Instructions
                </span>
                <span className="text-slate-500 dark:text-zinc-400 text-[11px]">
                  Securely stored for assigned technician dispatch.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. WHAT HAPPENS NEXT ROADMAP */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 space-y-3.5 shadow-xs">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          What Happens Next?
        </h3>

        <div className="space-y-3 text-xs">
          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-black shrink-0">
              1
            </span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                {isInstant ? "Technician Assignment & Preparation" : "Contractor Schedule Verification"}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                {isInstant
                  ? `${org.name} reviews your job details, equipment tag notes, and assigns the appropriate technician.`
                  : `${org.name} verifies their crew availability for your requested window and confirms via phone or SMS.`}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center text-[10px] font-black shrink-0">
              2
            </span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Service Day Live Tracking
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                When the technician departs for your property, you will receive a real-time tracking link with live GPS map and exact arrival ETA.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="h-5 w-5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 flex items-center justify-center text-[10px] font-black shrink-0">
              3
            </span>
            <div>
              <span className="font-bold text-slate-900 dark:text-white block">
                Service Completion &amp; Receipt
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                After work is performed to your satisfaction, you receive high-resolution verification photos and an itemized digital invoice.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 5. LIVE SERVICE TRACKER PREVIEW CARD */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50/70 via-white to-sky-50/40 dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-900 border border-blue-200/80 dark:border-blue-900/50 p-4 text-left space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shrink-0">
              <Navigation className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                Live Technician Tracker
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Real-time GPS arrival map on service day
              </p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
            Included
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
          On the day of your appointment, you can watch your service vehicle drive to your location with minute-by-minute updates.
        </p>

        <a
          href={confirmedBooking.trackingToken ? `/t/${confirmedBooking.trackingToken}` : manageUrl}
          className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-750 text-slate-800 dark:text-zinc-100 text-xs font-bold transition-colors shadow-2xs cursor-pointer"
        >
          <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Open Live Arrival Tracker</span>
          <ChevronRight className="h-3.5 w-3.5 ml-auto text-slate-400" />
        </a>
      </div>

      {/* 6. ADD TO CALENDAR SYNC */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 space-y-2.5 shadow-xs">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500 uppercase tracking-wider block">
          Add to Your Calendar
        </span>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={generateGoogleCalendarUrl({
              title: `${service.name} with ${org.name}`,
              description: `Appointment with ${org.name}.\nManage or reschedule: ${manageUrl}`,
              location: displayAddress || undefined,
              startTime: selectedSlot.startTime,
              endTime: selectedSlot.endTime,
              url: manageUrl
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
                title: `${service.name} with ${org.name}`,
                description: `Appointment with ${org.name}.\nManage or reschedule: ${manageUrl}`,
                location: displayAddress || undefined,
                startTime: selectedSlot.startTime,
                endTime: selectedSlot.endTime,
                url: manageUrl
              }, `appointment-${referenceCode.replace('#', '')}.ics`)
            }}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
          >
            <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Apple / Outlook</span>
          </button>
        </div>
      </div>

      {/* 7. SELF-SERVICE ACTION CENTER & BOOKMARKING */}
      <div className="space-y-2.5 pt-1">
        <a
          href={manageUrl}
          className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <span>Manage or Reschedule Appointment</span>
          <ChevronRight className="h-4 w-4" />
        </a>

        <button
          type="button"
          onClick={handleCopyLink}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          {copiedLink ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Appointment Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-500 dark:text-zinc-400" />
              <span>Copy Direct Appointment Link</span>
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-400 dark:text-zinc-500">
          No login required. Keep this link to review details or adjust your time.
        </p>
      </div>

      {/* 8. LIVE INTERACTIVE DEMO (Demo Org Only) */}
      {(org.id === '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7' || org.slug?.includes('demo')) && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 p-4 text-left space-y-2.5 mt-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-amber-500 text-[11px] font-black uppercase tracking-wider">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>⚡ Live Interactive Demo</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            See what the contractor sees in their dashboard
          </h3>
          <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
            Your booking was just committed in real time! Click below to enter the live business owner dashboard (no login required) to see your booked appointment on the schedule, SMS thread in the inbox, and technician route.
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
    </div>
  )
}
