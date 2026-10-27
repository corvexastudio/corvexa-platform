'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft, 
  User, 
  Phone, 
  Mail, 
  AlertCircle,
  ShieldCheck,
  CalendarDays,
  FileText,
  Gift,
  Camera,
  X,
  Image as ImageIcon
} from 'lucide-react'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'
import { getSelectableDatesInTimezone } from '@/lib/booking/availability'
import { parseServicePricing, cleanServiceDescription } from '@/lib/services/service-pricing'

interface ServiceItem {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price?: number | null
  requires_address?: boolean
}

interface OrgInfo {
  id: string
  name: string
  slug: string
  phone?: string | null
  timezone: string
  booking_mode: 'instant' | 'request'
  business_hours: any
  minimum_notice_hours: number
  max_booking_days_ahead: number
}

interface AvailableSlot {
  startTime: string
  endTime: string
  displayTime: string
  date: string
  isAvailable?: boolean
  status?: 'available' | 'booked' | 'past'
}

export default function PublicBookingPage() {
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [bookingToken, setBookingToken] = useState<string | null>(null)

  // Booking Flow Steps: 1: Service, 2: Date & Time, 3: Details, 4: Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Selections
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [allSlots, setAllSlots] = useState<AvailableSlot[]>([])
  const [dayStatus, setDayStatus] = useState<string>('available')
  const [bookedSlotsCount, setBookedSlotsCount] = useState<number>(0)
  const [datesMeta, setDatesMeta] = useState<Record<string, { dayStatus: string; slotsCount: number; bookedCount: number }>>({})
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)

  // Customer Contact Info
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    photos: [] as string[]
  })

  // Diagnostic Photo Upload Handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const remaining = 4 - formData.photos.length
    if (remaining <= 0) return

    const filesToProcess = Array.from(files).slice(0, remaining)

    filesToProcess.forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (event) => {
        const img = document.createElement('img')
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const MAX_WIDTH = 1200
          const MAX_HEIGHT = 1200
          let width = img.width
          let height = img.height

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width
              width = MAX_WIDTH
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height
              height = MAX_HEIGHT
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx?.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8)

          setFormData((prev) => ({
            ...prev,
            photos: [...prev.photos, dataUrl]
          }))
        }
        img.src = event.target?.result as string
      }
      reader.readAsDataURL(file)
    })

    e.target.value = ''
  }

  const handleRemovePhoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index)
    }))
  }

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<{
    appointment: any
    manageToken: string
    manageUrl: string
    status: string
  } | null>(null)

  // Referral Attribution
  const [referralCode, setReferralCode] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const urlParams = new URLSearchParams(window.location.search)
    const urlRef = urlParams.get('ref')
    if (urlRef) {
      setReferralCode(urlRef.trim().toLowerCase())
      return
    }
    const match = document.cookie.match(/(?:^|;\s*)capto_ref=([^;]+)/)
    if (match && match[1]) {
      setReferralCode(decodeURIComponent(match[1]).trim().toLowerCase())
    }
  }, [])

  // 1. Fetch Organization Profile & Services
  useEffect(() => {
    if (!slug) return
    async function loadOrg() {
      setLoading(true)
      try {
        const res = await fetch(`/api/book/${slug}`)
        if (!res.ok) {
          setError('Business not found or unavailable.')
          return
        }
        const data = await res.json()
        setOrg(data.organization)
        setServices(data.services || [])
        if (data.bookingToken) {
          setBookingToken(data.bookingToken)
        }
        if (data.services?.length === 1) {
          setSelectedService(data.services[0])
        }
      } catch (err) {
        setError('Failed to load booking page. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadOrg()
  }, [slug])

  // Generate selectable dates strictly within organization US timezone
  const selectableDates = useMemo(() => {
    const tz = org?.timezone || 'America/Chicago'
    const maxDays = org?.max_booking_days_ahead || 14
    const limit = Math.min(maxDays, 14)
    return getSelectableDatesInTimezone(tz, limit)
  }, [org?.timezone, org?.max_booking_days_ahead])

  // Select initial date once selectable dates are available
  useEffect(() => {
    if (selectableDates.length > 0 && !selectedDate) {
      setSelectedDate(selectableDates[0].dateStr)
    }
  }, [selectableDates, selectedDate])

  // 2. Fetch Available Slots when Date or Service changes
  useEffect(() => {
    if (!slug || !selectedDate || !selectedService) return

    async function fetchSlots() {
      setLoadingSlots(true)
      setSelectedSlot(null)
      try {
        const res = await fetch(`/api/book/${slug}/slots?date=${selectedDate}&serviceId=${selectedService?.id || ''}`)
        if (res.ok) {
          const data = await res.json()
          const slots = data.slots || []
          const detailed = data.allSlots || slots
          const status = data.dayStatus || (slots.length > 0 ? 'available' : 'fully_booked')
          const bookedCount = data.bookedSlotsCount ?? (detailed.filter((s: any) => s.status === 'booked').length)

          setAvailableSlots(slots)
          setAllSlots(detailed)
          setDayStatus(status)
          setBookedSlotsCount(bookedCount)
          setDatesMeta(prev => ({
            ...prev,
            [selectedDate]: {
              dayStatus: status,
              slotsCount: slots.length,
              bookedCount
            }
          }))
        } else {
          setAvailableSlots([])
          setAllSlots([])
          setDayStatus('closed')
          setBookedSlotsCount(0)
        }
      } catch {
        setAvailableSlots([])
        setAllSlots([])
        setDayStatus('closed')
        setBookedSlotsCount(0)
      } finally {
        setLoadingSlots(false)
      }
    }

    fetchSlots()
  }, [slug, selectedDate, selectedService])

  // 3. Handle Submit
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedService || !selectedSlot) return

    if (!formData.name.trim() || !formData.phone.trim()) {
      setSubmitError('Please enter your full name and phone number.')
      return
    }

    if (selectedService.requires_address && !formData.address.trim()) {
      setSubmitError('Service address is required for on-site appointments.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const res = await fetch(`/api/book/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          customerName: formData.name,
          customerPhone: formData.phone,
          customerEmail: formData.email,
          customerAddress: formData.address,
          startTime: selectedSlot.startTime,
          notes: formData.notes,
          photos: formData.photos,
          bookingToken: bookingToken || undefined,
          referralCode: referralCode || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Failed to submit booking. Please try another time.')
        return
      }

      setConfirmedBooking(data)
      setStep(4)
    } catch {
      setSubmitError('A network error occurred. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent" />
          <p className="text-xs text-slate-500 dark:text-zinc-400">Loading schedule...</p>
        </div>
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-sm">
          <AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Booking Unavailable</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{error || 'This business page could not be found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-6 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Business Header */}
        <div className="text-center space-y-2 pb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Instant Online Booking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {org.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            {org.booking_mode === 'instant' ? 'Select a time for instant confirmation' : 'Submit a booking request for quick owner review'}
          </p>
        </div>

        {/* Referral Welcome Banner */}
        {referralCode && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-900 dark:text-emerald-200 shadow-sm animate-in fade-in duration-300">
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Gift className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <span className="font-bold block text-emerald-950 dark:text-emerald-100">
                Neighbor Referral Special Applied!
              </span>
              <span className="text-emerald-800 dark:text-emerald-300 text-[11px] leading-tight block">
                You have $25 off your service with promo code <strong className="font-mono uppercase">{referralCode}</strong>.
              </span>
            </div>
          </div>
        )}

        {/* Stepper Progress Bar */}
        {step < 4 && (
          <div className="flex items-center justify-between px-2 text-xs font-medium text-slate-500 dark:text-zinc-400">
            <button 
              type="button" 
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 cursor-pointer ${step === 1 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-blue-600 dark:bg-blue-500 text-white font-bold' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>1</span>
              Service
            </button>
            <div className="h-0.5 flex-1 mx-3 bg-slate-200 dark:bg-zinc-800" />
            <button 
              type="button" 
              onClick={() => selectedService && setStep(2)}
              disabled={!selectedService}
              className={`flex items-center gap-1.5 cursor-pointer ${step === 2 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-blue-600 dark:bg-blue-500 text-white font-bold' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>2</span>
              Date & Time
            </button>
            <div className="h-0.5 flex-1 mx-3 bg-slate-200 dark:bg-zinc-800" />
            <button 
              type="button" 
              onClick={() => selectedSlot && setStep(3)}
              disabled={!selectedSlot}
              className={`flex items-center gap-1.5 cursor-pointer ${step === 3 ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-blue-600 dark:bg-blue-500 text-white font-bold' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>3</span>
              Details
            </button>
          </div>
        )}

        {/* STEP 1: CHOOSE SERVICE */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              1. Choose a Service
            </h2>

            {services.length === 0 ? (
              <div className="text-center py-10 px-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800/80 space-y-4 shadow-sm">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    No Services Available
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                    No services are currently available for online booking. Please contact the business directly to schedule an appointment.
                  </p>
                </div>
                {org?.phone && (
                  <div className="pt-2">
                    <a
                      href={`tel:${org.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-900 dark:text-white text-xs font-semibold transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>Call {org.phone}</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {services.map((svc) => {
                    const isSelected = selectedService?.id === svc.id
                    const pricing = parseServicePricing(svc.price, svc.description)
                    const cleanDesc = cleanServiceDescription(svc.description)
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => setSelectedService(svc)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                            : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800/80 hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                              {svc.name}
                            </div>
                            {cleanDesc && (
                              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 line-clamp-2">
                                {cleanDesc}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-zinc-400 mt-2.5">
                              <span className="flex items-center gap-1 text-slate-700 dark:text-zinc-300">
                                <Clock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                {svc.duration_minutes} mins
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {pricing.formattedPrice}
                              </span>
                            </div>
                          </div>

                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 dark:border-zinc-700'
                          }`}>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  disabled={!selectedService}
                  onClick={() => setStep(2)}
                  className="w-full mt-4 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <span>Continue to Date & Time</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 2: CHOOSE DATE & TIME */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-blue-400" />
                2. Select Date & Time
              </h2>
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Change Service
              </button>
            </div>

            {/* Selected Service Badge */}
            <div className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs shadow-xs">
              <span className="text-slate-500 dark:text-zinc-400">Service: <strong className="text-slate-900 dark:text-white">{selectedService?.name}</strong></span>
              <div className="flex items-center gap-2">
                <span className="text-blue-600 dark:text-blue-400 font-medium">{selectedService?.duration_minutes} mins</span>
                {selectedService && (
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    {parseServicePricing(selectedService.price, selectedService.description).formattedPrice}
                  </span>
                )}
              </div>
            </div>

            {/* Date Pill Scroller */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Choose Date</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {selectableDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr
                  const meta = datesMeta[item.dateStr]
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[72px] py-2.5 px-2 rounded-xl border transition-all shrink-0 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white font-bold shadow-md shadow-blue-600/20'
                          : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-zinc-700 hover:text-slate-900 dark:hover:text-zinc-200 shadow-xs'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider">{item.dayOfWeek}</span>
                      <span className="text-sm font-extrabold mt-0.5">{item.label}</span>
                      {meta && (
                        <span className="mt-1">
                          {meta.dayStatus === 'fully_booked' ? (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-red-950/80 text-red-200 border border-red-500/30' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                            }`}>
                              Full
                            </span>
                          ) : meta.dayStatus === 'closed' ? (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-slate-800 text-zinc-300' : 'bg-slate-100 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-500'
                            }`}>
                              Closed
                            </span>
                          ) : meta.dayStatus === 'past' ? (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-slate-800 text-zinc-300' : 'bg-slate-100 dark:bg-zinc-800/40 text-slate-400 dark:text-zinc-500'
                            }`}>
                              Past
                            </span>
                          ) : meta.slotsCount > 0 ? (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500/30' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                            }`}>
                              {meta.slotsCount} open
                            </span>
                          ) : null}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Available Time Slots Grid */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Available Times ({org.timezone})</span>
                </label>
                {/* Live Slot Counts & Legend */}
                {!loadingSlots && allSlots.length > 0 && (
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      {availableSlots.length} Open
                    </span>
                    {bookedSlotsCount > 0 && (
                  <span className="flex items-center gap-1 text-slate-500 dark:text-zinc-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                    {bookedSlotsCount} Booked
                  </span>
                    )}
                  </div>
                )}
                {loadingSlots && <span className="text-[11px] text-blue-600 dark:text-blue-400 animate-pulse">Checking calendar...</span>}
              </div>

              {loadingSlots ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-4">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-11 rounded-xl bg-slate-200 dark:bg-zinc-800/50 animate-pulse" />
                  ))}
                </div>
              ) : dayStatus === 'fully_booked' || (bookedSlotsCount > 0 && availableSlots.length === 0) ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-900 dark:text-amber-200">This date is fully booked</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300/80 mt-0.5 leading-relaxed">
                        All appointment slots for this date have already been reserved. Please pick another date from the calendar above to see open times.
                      </p>
                    </div>
                  </div>

                  {/* Render the booked slots so the customer sees they are taken */}
                  {allSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-semibold">Reserved Times</span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 opacity-75">
                        {allSlots.map((slot) => (
                          <div
                            key={slot.startTime}
                            className="py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-200/60 dark:border-zinc-800/60 bg-slate-100/50 dark:bg-zinc-900/40 text-slate-400 dark:text-zinc-500 flex items-center justify-between gap-1.5 cursor-not-allowed select-none"
                            title="This slot is already booked"
                          >
                            <span className="line-through decoration-slate-400 dark:decoration-zinc-600 text-slate-400 dark:text-zinc-500">{slot.displayTime}</span>
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400/90 border border-rose-200 dark:border-rose-500/20">
                              Booked
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : dayStatus === 'past' || (availableSlots.length === 0 && allSlots.length > 0) ? (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-200 text-xs flex items-start gap-3">
                    <Clock className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-blue-900 dark:text-blue-200">Operating hours for this date have passed</p>
                      <p className="text-[11px] text-blue-700 dark:text-blue-300/80 mt-0.5 leading-relaxed">
                        Booking hours for this date in {org.timezone} have concluded. Please choose tomorrow or an upcoming date to find available times.
                      </p>
                    </div>
                  </div>
                </div>
              ) : allSlots.length === 0 ? (
                <div className="py-8 px-4 text-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2 shadow-xs">
                  <CalendarDays className="h-8 w-8 text-slate-400 dark:text-zinc-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-700 dark:text-zinc-300">
                    {dayStatus === 'closed' ? 'Closed on this date' : 'No available slots for this date'}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs mx-auto">
                    {dayStatus === 'closed'
                      ? 'Our business is closed on this day according to standard business hours. Please select another date.'
                      : 'All times are either booked, outside business hours, or within the minimum notice period. Please choose another date.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {allSlots.map((slot) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime
                    const isBooked = !slot.isAvailable && slot.status === 'booked'
                    const isPast = !slot.isAvailable && slot.status === 'past'

                    if (isBooked) {
                      return (
                        <div
                          key={slot.startTime}
                          className="py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-200/50 dark:border-zinc-800/50 bg-slate-100/40 dark:bg-zinc-950/40 text-slate-400 dark:text-zinc-500 flex items-center justify-between gap-1.5 cursor-not-allowed select-none"
                          title="This slot is already booked"
                        >
                          <span className="line-through decoration-slate-400 dark:decoration-zinc-600 text-slate-400 dark:text-zinc-500">{slot.displayTime}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400/80 border border-rose-200 dark:border-rose-500/20">
                            Booked
                          </span>
                        </div>
                      )
                    }

                    if (isPast) {
                      return (
                        <div
                          key={slot.startTime}
                          className="py-2.5 px-3 rounded-xl text-xs font-semibold border border-slate-200/40 dark:border-zinc-900 bg-slate-100/20 dark:bg-zinc-950/20 text-slate-400 dark:text-zinc-600 flex items-center justify-between gap-1.5 cursor-not-allowed select-none opacity-40"
                          title="This time has passed"
                        >
                          <span>{slot.displayTime}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200/40 dark:bg-zinc-800/40 text-slate-500 dark:text-zinc-600 border border-slate-200/40 dark:border-zinc-800/40">
                            Past
                          </span>
                        </div>
                      )
                    }

                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center flex items-center justify-between gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                            : 'bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800/80 text-slate-800 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs'
                        }`}
                      >
                        <span>{slot.displayTime}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                        }`}>
                          Available
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Continue Button */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs cursor-pointer shadow-xs"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <span>Continue to Your Details</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CUSTOMER DETAILS */}
        {step === 3 && (
          <form onSubmit={handleBookingSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                3. Your Information
              </h2>
              <button 
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Change Time
              </button>
            </div>

            {/* Booking Summary Pill */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between text-xs shadow-xs">
              <div>
                <span className="font-bold text-slate-900 dark:text-white block">{selectedService?.name}</span>
                <span className="text-slate-500 dark:text-zinc-400">{selectedSlot?.date} at {selectedSlot?.displayTime}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold">
                {org.booking_mode === 'instant' ? 'Instant Confirmation' : 'Request Mode'}
              </span>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Full Name <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-base sm:text-xs focus:outline-hidden focus:border-blue-500 shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Mobile Phone Number <span className="text-red-500 dark:text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="tel"
                    required
                    placeholder="(555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-base sm:text-xs focus:outline-hidden focus:border-blue-500 shadow-xs"
                  />
                </div>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                  We'll send you an instant SMS confirmation and reminder links.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Email Address <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-base sm:text-xs focus:outline-hidden focus:border-blue-500 shadow-xs"
                  />
                </div>
              </div>

              {selectedService?.requires_address && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                    Service Address <span className="text-red-500 dark:text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-slate-400 dark:text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="123 Main St, City, ST 12345"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-base sm:text-xs focus:outline-hidden focus:border-blue-500 shadow-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Notes / Job Details <span className="text-slate-400 dark:text-zinc-500">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Gate code, issue details, or special requests..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-base sm:text-xs focus:outline-hidden focus:border-blue-500 resize-none shadow-xs"
                />
              </div>

              {/* Diagnostic Intake Photos */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                    Diagnostic Photos of Issue <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">
                    {formData.photos.length}/4 photos
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Snap or upload a photo of your equipment label, leak, or breaker panel. Helps our technician arrive with the exact right parts.
                </p>

                {/* Upload Button & Preview Grid */}
                <div className="grid grid-cols-4 gap-2 pt-1">
                  {formData.photos.map((photoUrl, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-850 aspect-square shadow-2xs group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photoUrl}
                        alt={`Intake photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(idx)}
                        className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 hover:bg-red-600 text-white transition-colors cursor-pointer"
                        title="Remove photo"
                        aria-label="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {formData.photos.length < 4 && (
                    <label className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 bg-slate-50/60 dark:bg-zinc-900/40 hover:bg-slate-100/60 dark:hover:bg-zinc-850/60 aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-slate-500 dark:text-zinc-400">
                      <Camera className="w-5 h-5 text-slate-400 dark:text-zinc-500" />
                      <span className="text-[10px] font-semibold text-center leading-tight">
                        {formData.photos.length === 0 ? 'Add Photo' : 'Add More'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500 dark:text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>No account required. You will receive a direct link to reschedule or cancel anytime.</span>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs cursor-pointer shadow-xs"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Booking Appointment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{org.booking_mode === 'instant' ? 'Confirm Appointment' : 'Submit Booking Request'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 4: CONFIRMATION VIEW */}
        {step === 4 && confirmedBooking && (
          <div className="space-y-6 pt-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {confirmedBooking.status === 'confirmed' ? 'Appointment Confirmed!' : 'Booking Request Received!'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                {confirmedBooking.status === 'confirmed' 
                  ? `You're all set! We've dispatched a confirmation SMS with appointment management links.`
                  : `We have received your request and will notify you as soon as it's confirmed.`
                }
              </p>
            </div>

            {/* Appointment Summary Card */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 text-left space-y-3 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Business</span>
                <span className="font-bold text-slate-900 dark:text-white">{org.name}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Service</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedService?.name}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Date & Time</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{selectedSlot?.date} at {selectedSlot?.displayTime}</span>
              </div>
              {formData.address && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800 text-xs">
                  <span className="text-slate-500 dark:text-zinc-400">Location</span>
                  <span className="font-medium text-slate-700 dark:text-zinc-300 text-right">{formData.address}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-zinc-400">Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 uppercase tracking-wide">
                  {confirmedBooking.status}
                </span>
              </div>
            </div>

            {/* Add to Calendar Sync Buttons */}
            {selectedSlot && (
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider block">
                  Add to Your Calendar
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={generateGoogleCalendarUrl({
                      title: `${selectedService?.name || 'Service'} with ${org.name}`,
                      description: `Scheduled appointment with ${org.name}.\nManage booking: ${typeof window !== 'undefined' ? window.location.origin : ''}/book/manage/${confirmedBooking.manageToken}`,
                      location: formData.address || undefined,
                      startTime: selectedSlot.startTime,
                      endTime: selectedSlot.endTime,
                      url: typeof window !== 'undefined' ? `${window.location.origin}/book/manage/${confirmedBooking.manageToken}` : undefined,
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
                        title: `${selectedService?.name || 'Service'} with ${org.name}`,
                        description: `Scheduled appointment with ${org.name}.\nManage booking: ${window.location.origin}/book/manage/${confirmedBooking.manageToken}`,
                        location: formData.address || undefined,
                        startTime: selectedSlot.startTime,
                        endTime: selectedSlot.endTime,
                        url: `${window.location.origin}/book/manage/${confirmedBooking.manageToken}`,
                      }, `appointment-${confirmedBooking.manageToken.substring(0, 8)}.ics`)
                    }}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/90 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                  >
                    <CalendarIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Apple / Outlook</span>
                  </button>
                </div>
              </div>
            )}

            {/* Manage Link Button */}
            <div className="space-y-3 pt-2">
              <a
                href={`/book/manage/${confirmedBooking.manageToken}`}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20"
              >
                <span>View / Manage Appointment</span>
                <ChevronRight className="h-4 w-4" />
              </a>

              <p className="text-[11px] text-slate-400 dark:text-zinc-500">
                A copy of this link was sent to {formData.phone}
              </p>
            </div>

            {/* Live Demo Owner Dashboard Preview (Only for Demo Org) */}
            {(org.id === '26d7c79c-9b50-4acd-ba09-6c0fe2ea10a7' || org.slug?.includes('demo')) && (
              <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 p-4 text-left space-y-2.5 mt-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-amber-500 text-[11px] font-black uppercase tracking-wider">
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span>⚡ Live Interactive Demo</span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  See what the business owner sees right now
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Your booking was just received in real time! Click below to enter the business owner workspace (no login required) to see your booked job on the calendar, SMS in the inbox, and technician route.
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
        )}

      </div>
    </div>
  )
}
