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
  FileText
} from 'lucide-react'

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
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)

  // Customer Contact Info
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [confirmedBooking, setConfirmedBooking] = useState<{
    appointment: any
    manageToken: string
    manageUrl: string
    status: string
  } | null>(null)

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

  // Generate selectable dates (next 14 days)
  const selectableDates = useMemo(() => {
    const dates: Array<{ dateStr: string; label: string; dayOfWeek: string; isToday: boolean }> = []
    const today = new Date()
    const maxDays = org?.max_booking_days_ahead || 14
    const limit = Math.min(maxDays, 14)

    for (let i = 0; i < limit; i++) {
      const d = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`
      
      dates.push({
        dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
        isToday: i === 0
      })
    }
    return dates
  }, [org])

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
          bookingToken: bookingToken || undefined
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
      <div className="min-h-screen bg-[#060911] text-zinc-200 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading schedule...</p>
        </div>
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen bg-[#060911] text-zinc-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0D1322] border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Booking Unavailable</h1>
          <p className="text-sm text-zinc-400">{error || 'This business page could not be found.'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060911] text-zinc-100 py-6 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Business Header */}
        <div className="text-center space-y-2 pb-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Instant Online Booking</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            {org.name}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {org.booking_mode === 'instant' ? 'Select a time for instant confirmation' : 'Submit a booking request for quick owner review'}
          </p>
        </div>

        {/* Stepper Progress Bar */}
        {step < 4 && (
          <div className="flex items-center justify-between px-2 text-xs font-medium text-zinc-400">
            <button 
              type="button" 
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 ${step === 1 ? 'text-blue-400 font-bold' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-blue-500 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}`}>1</span>
              Service
            </button>
            <div className="h-0.5 flex-1 mx-3 bg-zinc-800" />
            <button 
              type="button" 
              onClick={() => selectedService && setStep(2)}
              disabled={!selectedService}
              className={`flex items-center gap-1.5 ${step === 2 ? 'text-blue-400 font-bold' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-blue-500 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}`}>2</span>
              Date & Time
            </button>
            <div className="h-0.5 flex-1 mx-3 bg-zinc-800" />
            <button 
              type="button" 
              onClick={() => selectedSlot && setStep(3)}
              disabled={!selectedSlot}
              className={`flex items-center gap-1.5 ${step === 3 ? 'text-blue-400 font-bold' : ''}`}
            >
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-blue-500 text-white font-bold' : 'bg-zinc-800 text-zinc-400'}`}>3</span>
              Details
            </button>
          </div>
        )}

        {/* STEP 1: CHOOSE SERVICE */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-400" />
              1. Choose a Service
            </h2>

            {services.length === 0 ? (
              <div className="text-center py-10 px-6 rounded-2xl bg-[#0D1322] border border-zinc-800/80 space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white">
                    No Services Available
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-sm mx-auto">
                    No services are currently available for online booking. Please contact the business directly to schedule an appointment.
                  </p>
                </div>
                {org?.phone && (
                  <div className="pt-2">
                    <a
                      href={`tel:${org.phone}`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-blue-400" />
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
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => setSelectedService(svc)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-blue-500/10 border-blue-500 ring-1 ring-blue-500'
                            : 'bg-[#0D1322] border-zinc-800/80 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-white text-sm sm:text-base">
                              {svc.name}
                            </div>
                            {svc.description && (
                              <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                                {svc.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-zinc-400 mt-2.5">
                              <span className="flex items-center gap-1 text-zinc-300">
                                <Clock className="h-3 w-3 text-blue-400" />
                                {svc.duration_minutes} mins
                              </span>
                              {svc.price !== null && svc.price !== undefined && (
                                <span className="text-emerald-400 font-semibold">
                                  ${svc.price.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-zinc-700'
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
                  className="w-full mt-4 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
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
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Change Service
              </button>
            </div>

            {/* Selected Service Badge */}
            <div className="px-3.5 py-2.5 rounded-xl bg-[#0D1322] border border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Service: <strong className="text-white">{selectedService?.name}</strong></span>
              <span className="text-blue-400 font-medium">{selectedService?.duration_minutes} mins</span>
            </div>

            {/* Date Pill Scroller */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">Choose Date</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {selectableDates.map((item) => {
                  const isSelected = selectedDate === item.dateStr
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      onClick={() => setSelectedDate(item.dateStr)}
                      className={`flex flex-col items-center justify-center min-w-[70px] py-3 px-2 rounded-xl border transition-all shrink-0 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-500 text-white font-bold shadow-md shadow-blue-600/30'
                          : 'bg-[#0D1322] border-zinc-800/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-wider">{item.dayOfWeek}</span>
                      <span className="text-sm font-extrabold mt-0.5">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Available Time Slots Grid */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Available Times ({org.timezone})</span>
                {loadingSlots && <span className="text-[11px] text-blue-400 animate-pulse">Calculating available slots...</span>}
              </label>

              {loadingSlots ? (
                <div className="grid grid-cols-3 gap-2.5 py-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-zinc-800/50 animate-pulse" />
                  ))}
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="py-10 px-4 text-center rounded-2xl bg-[#0D1322] border border-zinc-800 space-y-2">
                  <CalendarDays className="h-8 w-8 text-zinc-600 mx-auto" />
                  <p className="text-xs font-medium text-zinc-300">No available slots for this date</p>
                  <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                    All times are either booked, outside business hours, or within the minimum notice period. Please choose another date.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime
                    return (
                      <button
                        key={slot.startTime}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all text-center ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/20'
                            : 'bg-[#0D1322] border-zinc-800/80 text-zinc-300 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        {slot.displayTime}
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
                className="py-3 px-4 rounded-xl border border-zinc-800 bg-[#0D1322] hover:bg-zinc-800 text-zinc-300 font-semibold text-xs"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!selectedSlot}
                onClick={() => setStep(3)}
                className="flex-1 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-500/20"
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
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400" />
                3. Your Information
              </h2>
              <button 
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Change Time
              </button>
            </div>

            {/* Booking Summary Pill */}
            <div className="p-3.5 rounded-xl bg-[#0D1322] border border-blue-500/30 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-white block">{selectedService?.name}</span>
                <span className="text-zinc-400">{selectedSlot?.date} at {selectedSlot?.displayTime}</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                {org.booking_mode === 'instant' ? 'Instant Confirmation' : 'Request Mode'}
              </span>
            </div>

            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-[#0D1322] border border-zinc-800 text-white text-base sm:text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Mobile Phone Number <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="tel"
                    required
                    placeholder="(555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-[#0D1322] border border-zinc-800 text-white text-base sm:text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">
                  We'll send you an instant SMS confirmation and reminder links.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Email Address <span className="text-zinc-500">(Optional)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-[#0D1322] border border-zinc-800 text-white text-base sm:text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {selectedService?.requires_address && (
                <div>
                  <label className="text-xs font-semibold text-zinc-300 block mb-1">
                    Service Address <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      required
                      placeholder="123 Main St, City, ST 12345"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-[#0D1322] border border-zinc-800 text-white text-base sm:text-xs focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Notes / Job Details <span className="text-zinc-500">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Gate code, issue details, or special requests..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full p-3 rounded-xl bg-[#0D1322] border border-zinc-800 text-white text-base sm:text-xs focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>No account required. You will receive a direct link to reschedule or cancel anytime.</span>
            </div>

            <div className="flex gap-3 pt-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="py-3 px-4 rounded-xl border border-zinc-800 bg-[#0D1322] hover:bg-zinc-800 text-zinc-300 font-semibold text-xs"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
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
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {confirmedBooking.status === 'confirmed' ? 'Appointment Confirmed!' : 'Booking Request Received!'}
              </h2>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {confirmedBooking.status === 'confirmed' 
                  ? `You're all set! We've dispatched a confirmation SMS with appointment management links.`
                  : `We have received your request and will notify you as soon as it's confirmed.`
                }
              </p>
            </div>

            {/* Appointment Summary Card */}
            <div className="rounded-2xl bg-[#0D1322] border border-zinc-800 p-5 text-left space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                <span className="text-zinc-400">Business</span>
                <span className="font-bold text-white">{org.name}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                <span className="text-zinc-400">Service</span>
                <span className="font-bold text-white">{selectedService?.name}</span>
              </div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                <span className="text-zinc-400">Date & Time</span>
                <span className="font-bold text-blue-400">{selectedSlot?.date} at {selectedSlot?.displayTime}</span>
              </div>
              {formData.address && (
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                  <span className="text-zinc-400">Location</span>
                  <span className="font-medium text-zinc-300 text-right">{formData.address}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Status</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wide">
                  {confirmedBooking.status}
                </span>
              </div>
            </div>

            {/* Manage Link Button */}
            <div className="space-y-3 pt-2">
              <a
                href={`/book/manage/${confirmedBooking.manageToken}`}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
              >
                <span>View / Manage Appointment</span>
                <ChevronRight className="h-4 w-4" />
              </a>

              <p className="text-[11px] text-zinc-500">
                A copy of this link was sent to {formData.phone}
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
