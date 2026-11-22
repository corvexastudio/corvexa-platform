'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
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
  Image as ImageIcon,
  Truck,
  Navigation,
  Search,
  Sparkles,
  Filter,
  Info,
  Zap
} from 'lucide-react'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'
import { getSelectableDatesInTimezone, getDayOfWeekName } from '@/lib/booking/availability'
import { getFriendlyTimezoneLabel, isDifferentFromDeviceTimezone, getDeviceTimezone } from '@/lib/temporal/timezone'
import { 
  parseServicePricing, 
  cleanServiceDescription, 
  formatDynamicPricingTotal,
  type ServiceAddOn,
  type PricingModel 
} from '@/lib/services/service-pricing'
import { type BookingSettings } from '@/lib/booking/booking-settings'
import { buildServiceCatalog, filterCatalogItems } from '@/lib/booking/service-catalog'
import { ContractorBrandAvatar } from '@/components/brand/contractor-brand-avatar'
import { BusinessHeader } from '@/components/booking/business-header'
import { CategoryRail } from '@/components/booking/category-rail'
import { ServiceCard } from '@/components/booking/service-card'
import { AddOnSelector } from '@/components/booking/addon-selector'
import { BookingBottomBar } from '@/components/booking/booking-bottom-bar'
import { TimezoneBanner } from '@/components/booking/timezone-banner'
import { AppointmentSummaryCard } from '@/components/booking/appointment-summary-card'
import { DatePickerRail } from '@/components/booking/date-picker-rail'
import { TimeSlotGrid } from '@/components/booking/time-slot-grid'
import { DateTimeBottomBar } from '@/components/booking/date-time-bottom-bar'
import { BookingReviewSummary } from '@/components/booking/booking-review-summary'
import { CustomerIntakeForm, type CustomerFormData } from '@/components/booking/customer-intake-form'
import { BookingConfirmationView } from '@/components/booking/booking-confirmation-view'
import { normalizePhoneToE164 } from '@/lib/telephony/phone-normalizer'
import { PoweredByBadge } from '@/components/brand/powered-by-badge'
import { cn } from '@/lib/utils'
import {
  formatCustomerName,
  formatAsYouTypeUsPhone,
  formatStandardUsAddress,
  combineStreetAndUnit,
  splitStreetAndUnit,
  getEmailDomainSuggestions
} from '@/lib/booking/customer-input-formatter'

interface ServiceItem {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price?: number | null
  requires_address?: boolean
  add_ons?: ServiceAddOn[]
  formatted_price?: string
  clean_description?: string
  pricing_model?: string
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
  industry?: string | null
  logo_url?: string | null
  blocked_dates?: string[]
  booking_settings?: BookingSettings
}

interface AvailableSlot {
  startTime: string
  endTime: string
  displayTime: string
  date: string
  isAvailable?: boolean
  status?: 'available' | 'booked' | 'past'
}

function PublicBookingPageContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [bookingToken, setBookingToken] = useState<string | null>(null)
  const [bookingSource, setBookingSource] = useState<string>('booking_page')
  const [isPrefilled, setIsPrefilled] = useState<boolean>(false)

  // Booking Flow Steps: 1: Service, 2: Date & Time, 3: Details, 4: Confirmed
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Selections
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null)
  const [selectedAddOns, setSelectedAddOns] = useState<ServiceAddOn[]>([])
  const [isPriority, setIsPriority] = useState<boolean>(false)
  const [howHeard, setHowHeard] = useState<string>('')
  const [serviceSearch, setServiceSearch] = useState('')
  const [activeServiceCategory, setActiveServiceCategory] = useState('all')

  // Calculate dynamic live total price accounting for pricing model, base price, selected add-ons, and priority fee
  const dynamicPricing = useMemo(() => {
    if (!selectedService) return null
    const basePrice = selectedService.price !== null && selectedService.price !== undefined ? Number(selectedService.price) : null
    const addOnsTotal = selectedAddOns.reduce((sum, a) => sum + (Number(a.price) || 0), 0)
    const priorityFee = isPriority ? (Number(org?.booking_settings?.priority_dispatch_fee) || 0) : 0
    const extrasTotal = addOnsTotal + priorityFee

    const model: PricingModel = (selectedService.pricing_model as PricingModel) ||
      parseServicePricing(selectedService.price, selectedService.description).model

    const formatted = formatDynamicPricingTotal(model, basePrice, extrasTotal)

    return {
      hasNumericBase: formatted.hasNumericBase,
      basePrice: formatted.basePrice,
      addOnsTotal,
      priorityFee,
      total: formatted.total,
      formattedTotal: formatted.formattedTotal
    }
  }, [selectedService, selectedAddOns, isPriority, org?.booking_settings?.priority_dispatch_fee])

  const serviceCatalog = useMemo(() => {
    return buildServiceCatalog(services, org?.industry)
  }, [services, org?.industry])

  const filteredServices = useMemo(() => {
    return filterCatalogItems(serviceCatalog.items, serviceSearch, activeServiceCategory)
  }, [serviceCatalog, serviceSearch, activeServiceCategory])

  // Total duration in minutes (service base duration + all selected add-ons duration)
  const totalDurationMinutes = useMemo(() => {
    const base = selectedService?.duration_minutes || 60
    const addOnsDuration = selectedAddOns.reduce((sum, a) => sum + (a.duration_minutes || 0), 0)
    return base + addOnsDuration
  }, [selectedService, selectedAddOns])

  // Handler for service selection (resets add-ons if switching to a different service)
  const handleSelectService = (svc: ServiceItem) => {
    setSelectedService(svc)
    if (selectedService?.id !== svc.id) {
      setSelectedAddOns([])
    }
  }

  // Handler for toggling optional add-ons
  const handleToggleAddOn = (addon: ServiceAddOn) => {
    setSelectedAddOns(prev => {
      const exists = prev.some(a => a.id === addon.id)
      return exists ? prev.filter(a => a.id !== addon.id) : [...prev, addon]
    })
  }
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [allSlots, setAllSlots] = useState<AvailableSlot[]>([])
  const [dayStatus, setDayStatus] = useState<string>('available')
  const [bookedSlotsCount, setBookedSlotsCount] = useState<number>(0)
  const [datesMeta, setDatesMeta] = useState<Record<string, { dayStatus: string; slotsCount: number; bookedCount: number }>>({})
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)

  // Customer Contact Info
  const [formData, setFormData] = useState<CustomerFormData>({
    name: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    address: '',
    streetAddress: '',
    unit: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
    accessInfo: '',
    photos: [] as string[]
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [smsConsent, setSmsConsent] = useState(true)

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
    success?: boolean
    appointment: any
    manageToken: string
    manageUrl: string
    trackingToken?: string | null
    trackingUrl?: string | null
    status: string
    smsStatus?: 'sent' | 'failed' | 'suppressed_starter' | 'suppressed_trial' | 'opt_out' | 'no_phone' | 'compliance_blocked' | 'none'
    smsError?: string | null
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

  // 1. Fetch Organization Profile & Services (with Customer Context & Prefill)
  useEffect(() => {
    if (!slug) return
    async function loadOrg() {
      setLoading(true)
      try {
        const queryStr = searchParams?.toString() ? `?${searchParams.toString()}` : ''
        const res = await fetch(`/api/book/${slug}${queryStr}`)
        if (!res.ok) {
          setError('Business not found or unavailable.')
          return
        }
        const data = await res.json()
        setOrg(data.organization)
        const loadedServices: ServiceItem[] = data.services || []
        setServices(loadedServices)

        if (data.bookingToken) {
          setBookingToken(data.bookingToken)
        }

        // Apply customer prefill if recognized from missed call or text link
        if (data.prefill) {
          const prefilledName = formatCustomerName(data.prefill.name || '')
          const nameTokens = prefilledName.trim().split(/\s+/)
          const fName = nameTokens[0] || ''
          const lName = nameTokens.slice(1).join(' ') || ''
          const { street, unit } = splitStreetAndUnit(data.prefill.address || '')

          setFormData(prev => ({
            ...prev,
            name: prefilledName || prev.name,
            firstName: fName || prev.firstName,
            lastName: lName || prev.lastName,
            phone: formatAsYouTypeUsPhone(data.prefill.phone || prev.phone),
            email: data.prefill.email || prev.email,
            address: street || formatStandardUsAddress(data.prefill.address || prev.address),
            streetAddress: street || data.prefill.address || prev.streetAddress,
            unit: unit || prev.unit,
            notes: data.prefill.notes || prev.notes
          }))

          if (data.prefill.source) {
            setBookingSource(data.prefill.source)
          }

          if (data.prefill.name || data.prefill.phone) {
            setIsPrefilled(true)
          }

          // Smart service matching from customer's request / SMS text
          if (data.prefill.serviceNeeded && loadedServices.length > 0) {
            const neededLower = data.prefill.serviceNeeded.toLowerCase()
            const matched = loadedServices.find(s => 
              s.name.toLowerCase().includes(neededLower) || 
              neededLower.includes(s.name.toLowerCase())
            )
            if (matched) {
              setSelectedService(matched)
            }
          }
        } else {
          const directSource = searchParams?.get('source')
          if (directSource) setBookingSource(directSource)
          const directPhone = searchParams?.get('phone')
          const directName = searchParams?.get('name')
          if (directPhone || directName) {
            const prefilledName = formatCustomerName(directName || '')
            const nameTokens = prefilledName.trim().split(/\s+/)
            setFormData(prev => ({
              ...prev,
              name: prefilledName || prev.name,
              firstName: nameTokens[0] || prev.firstName,
              lastName: nameTokens.slice(1).join(' ') || prev.lastName,
              phone: formatAsYouTypeUsPhone(directPhone || prev.phone)
            }))
            setIsPrefilled(true)
          }
        }

        if (loadedServices.length === 1 && !selectedService) {
          setSelectedService(loadedServices[0])
        }
      } catch (err) {
        setError('Failed to load booking page. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadOrg()
  }, [slug, searchParams])

  // Generate selectable dates strictly within organization US timezone up to configured horizon
  const selectableDates = useMemo(() => {
    const tz = org?.timezone || 'America/Chicago'
    const maxDays = org?.max_booking_days_ahead || 30
    const limit = Math.min(Math.max(maxDays, 14), 90)
    return getSelectableDatesInTimezone(tz, limit)
  }, [org?.timezone, org?.max_booking_days_ahead])

  // Selected date formatted label for bottom bar and header
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return null
    const item = selectableDates.find(d => d.dateStr === selectedDate)
    if (item) return `${item.dayOfWeek}, ${item.label}`
    return selectedDate
  }, [selectedDate, selectableDates])

  // Next available date recovery helper when selected date is full, closed, or past
  const nextAvailableCandidate = useMemo(() => {
    if (dayStatus === 'available' && availableSlots.length > 0) return null
    const currentIndex = selectableDates.findIndex(d => d.dateStr === selectedDate)
    if (currentIndex === -1) return null
    for (let i = currentIndex + 1; i < selectableDates.length; i++) {
      const candidate = selectableDates[i]
      const dayName = getDayOfWeekName(candidate.dateStr, org?.timezone || 'America/Chicago')
      const bh = org?.business_hours?.[dayName]
      const isClosed = !bh || bh.closed === true
      const isBlocked = org?.blocked_dates?.includes(candidate.dateStr)
      const meta = datesMeta[candidate.dateStr]
      if (meta && (meta.dayStatus === 'fully_booked' || meta.dayStatus === 'closed' || meta.dayStatus === 'past')) {
        continue
      }
      if (!isClosed && !isBlocked) {
        return candidate
      }
    }
    return null
  }, [selectableDates, selectedDate, dayStatus, availableSlots.length, org?.timezone, org?.business_hours, org?.blocked_dates, datesMeta])

  // Cross-timezone client device detection (smart traveler reassurance)
  const isDifferentTz = useMemo(() => {
    return isDifferentFromDeviceTimezone(org?.timezone || 'America/Chicago')
  }, [org?.timezone])

  const friendlyTz = useMemo(() => {
    return getFriendlyTimezoneLabel(org?.timezone || 'America/Chicago')
  }, [org?.timezone])

  const deviceTzFriendly = useMemo(() => {
    return getFriendlyTimezoneLabel(getDeviceTimezone())
  }, [])

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
        const priorityQuery = isPriority ? '&isPriority=true' : ''
        const addonQuery = selectedAddOns.length > 0
          ? `&addonIds=${encodeURIComponent(selectedAddOns.map(a => a.id).join(','))}`
          : ''
        const res = await fetch(`/api/book/${slug}/slots?date=${selectedDate}&serviceId=${selectedService?.id || ''}${priorityQuery}${addonQuery}`)
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
  }, [slug, selectedDate, selectedService, selectedAddOns, isPriority])

  // 3. Handle Submit with comprehensive validation and focus recovery
  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedService || !selectedSlot) return

    const errors: Record<string, string> = {}

    // First and Last Name validation
    const trimmedFirst = (formData.firstName || '').trim()
    const trimmedLast = (formData.lastName || '').trim()
    if (!trimmedFirst) {
      errors.firstName = 'First name is required'
    }
    if (!trimmedLast) {
      errors.lastName = 'Last name is required'
    }

    // Phone validation following ITU-T E.164 rules
    const trimmedPhone = (formData.phone || '').trim()
    const phoneNorm = normalizePhoneToE164(trimmedPhone)
    if (!trimmedPhone) {
      errors.phone = 'Mobile phone number is required'
    } else if (!phoneNorm.isValid) {
      errors.phone = 'Please enter a valid mobile phone number (e.g. (555) 000-0000)'
    }

    // Optional Email format validation
    const trimmedEmail = (formData.email || '').trim()
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(trimmedEmail)) {
        errors.email = 'Please enter a valid email address'
      }
    }

    // Address validation if service requires on-site visit
    const streetInput = (formData.streetAddress || formData.address || '').trim()
    if (selectedService.requires_address) {
      if (!streetInput) {
        errors.streetAddress = 'Street address is required'
      }
      // If single street line does not already contain a comma, validate city, state, zip
      if (!streetInput.includes(',')) {
        if (!(formData.city || '').trim()) {
          errors.city = 'City is required'
        }
        if (!(formData.state || '').trim()) {
          errors.state = 'State is required'
        }
        if (!(formData.zip || '').trim()) {
          errors.zip = 'ZIP code is required'
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      // Focus or scroll to the first invalid field
      const firstField = Object.keys(errors)[0]
      const fieldIdMap: Record<string, string> = {
        firstName: 'field-first-name',
        lastName: 'field-last-name',
        phone: 'field-phone',
        email: 'field-email',
        streetAddress: 'field-street-address',
        city: 'field-city',
        state: 'field-state',
        zip: 'field-zip'
      }
      const elId = fieldIdMap[firstField] || `field-${firstField}`
      const el = document.getElementById(elId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus()
      }
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    // Assemble Title Case Customer Name
    const rawFullName = trimmedFirst && trimmedLast
      ? `${trimmedFirst} ${trimmedLast}`
      : (formData.name || `${trimmedFirst} ${trimmedLast}`).trim()
    const cleanedName = formatCustomerName(rawFullName)

    // Assemble Full Standardized US Address
    let fullAddr = streetInput
    if (formData.city?.trim() && !fullAddr.includes(formData.city.trim())) {
      fullAddr += `, ${formData.city.trim()}`
    }
    if (formData.state?.trim() && !fullAddr.includes(formData.state.trim())) {
      fullAddr += `, ${formData.state.trim().toUpperCase()}`
    }
    if (formData.zip?.trim() && !fullAddr.includes(formData.zip.trim())) {
      fullAddr += ` ${formData.zip.trim()}`
    }
    const combinedAddress = combineStreetAndUnit(fullAddr, formData.unit)
    const cleanedAddress = formatStandardUsAddress(combinedAddress)

    // Keep formData.name and formData.address synchronized for Step 4 Confirmation
    setFormData(prev => ({
      ...prev,
      name: cleanedName,
      address: cleanedAddress
    }))

    // Assemble merged notes with access instructions
    const notesList: string[] = []
    if (formData.notes?.trim()) {
      notesList.push(formData.notes.trim())
    }
    if (formData.accessInfo?.trim()) {
      notesList.push(`[Access Instructions: ${formData.accessInfo.trim()}]`)
    }
    const mergedNotes = notesList.join('\n\n')

    try {
      const res = await fetch(`/api/book/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: selectedService.id,
          customerName: cleanedName,
          customerPhone: phoneNorm.e164 || trimmedPhone,
          customerEmail: trimmedEmail || undefined,
          customerAddress: cleanedAddress || undefined,
          customerUnit: formData.unit?.trim() || undefined,
          startTime: selectedSlot.startTime,
          notes: mergedNotes || undefined,
          photos: formData.photos,
          bookingToken: bookingToken || undefined,
          referralCode: referralCode || undefined,
          source: bookingSource || 'booking_page',
          smsConsent,
          isPriority,
          priorityFee: isPriority ? org?.booking_settings?.priority_dispatch_fee : undefined,
          selectedAddOns,
          addonIds: selectedAddOns.map(a => a.id),
          howHeard: howHeard.trim() || undefined
        })
      })

      const data = await res.json()

      if (!res.ok) {
        const errMsg = data.error || 'Failed to submit booking. Please try another time.'
        setSubmitError(errMsg)
        const lower = errMsg.toLowerCase()
        if (lower.includes('no longer available') || lower.includes('conflict') || lower.includes('taken') || lower.includes('slot')) {
          setSelectedSlot(null)
          setStep(2)
        }
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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pt-6 pb-28 sm:pb-32 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Business Header */}
        <BusinessHeader
          org={org}
          servicesCount={services.length}
        />

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

        {/* Important Condition / Policy Notice Banner */}
        {org.booking_settings?.booking_notice_enabled && org.booking_settings?.booking_notice && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200 shadow-2xs animate-in fade-in duration-200">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-0.5">
              <span className="font-bold block text-amber-950 dark:text-amber-100 text-[11px] tracking-wide uppercase">
                Notice
              </span>
              <p className="text-amber-900/90 dark:text-amber-200/90 text-xs leading-relaxed">
                {org.booking_settings.booking_notice}
              </p>
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
          <div className={cn("space-y-4", "pb-28 sm:pb-32")}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span>1. Choose a Service</span>
              </h2>
              {services.length > 0 && (
                <span className="text-xs text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full font-medium">
                  {services.length} {services.length === 1 ? 'service' : 'services'} available
                </span>
              )}
            </div>

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
                {/* Search & Category Filter Rail */}
                <CategoryRail
                  categories={serviceCatalog.categories}
                  activeCategory={activeServiceCategory}
                  onSelectCategory={setActiveServiceCategory}
                  searchQuery={serviceSearch}
                  onSearchChange={setServiceSearch}
                  totalServicesCount={services.length}
                  filteredServicesCount={filteredServices.length}
                  showSearch={services.length >= 4 || serviceSearch.trim().length > 0}
                  showCategories={serviceCatalog.hasCategories}
                  onResetFilters={() => {
                    setServiceSearch('')
                    setActiveServiceCategory('all')
                  }}
                />

                {/* Zero Search Results State */}
                {filteredServices.length === 0 ? (
                  <div className="text-center py-10 px-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3 shadow-xs">
                    <Search className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">
                        No services matching &ldquo;{serviceSearch}&rdquo;
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto">
                        Try a different search term or clear filters to view all services.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setServiceSearch('')
                          setActiveServiceCategory('all')
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors cursor-pointer min-h-[40px]"
                      >
                        Clear Filters
                      </button>
                      {services[0] && (
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectService(services[0])
                            setServiceSearch('')
                            setActiveServiceCategory('all')
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer min-h-[40px]"
                        >
                          Book {services[0].name.split(' ')[0]} Service
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Service Cards List */
                  <div className="space-y-3" role="radiogroup" aria-label="Available services">
                    {filteredServices.map(({ service: svc, isPopular, categoryLabel, cleanDesc }) => {
                      const isSelected = selectedService?.id === svc.id

                      return (
                        <div key={svc.id} className="space-y-2">
                          <ServiceCard
                            service={svc}
                            isSelected={isSelected}
                            onSelect={handleSelectService}
                            isPopular={isPopular}
                            categoryLabel={categoryLabel}
                            showCategoryBadge={serviceCatalog.hasCategories && activeServiceCategory === 'all'}
                            cleanDesc={cleanDesc}
                          />

                          {/* Interactive Add-on Selection Drawer (renders directly beneath selected service card) */}
                          {isSelected && svc.add_ons && svc.add_ons.length > 0 && (
                            <AddOnSelector
                              addOns={svc.add_ons}
                              selectedAddOns={selectedAddOns}
                              onToggleAddOn={handleToggleAddOn}
                              serviceName={svc.name}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Standard In-Flow Continue Button */}
                {filteredServices.length > 0 && (
                  <button
                    type="button"
                    disabled={!selectedService}
                    onClick={() => setStep(2)}
                    className="w-full mt-4 py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:pointer-events-none text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer min-h-[48px]"
                  >
                    <span>Continue to Date &amp; Time</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </>
            )}

            {/* Persistent Sticky Bottom Summary & Navigation Bar */}
            <BookingBottomBar
              selectedService={selectedService}
              selectedAddOns={selectedAddOns}
              formattedTotal={dynamicPricing?.formattedTotal}
              totalDurationMinutes={totalDurationMinutes}
              onContinue={() => setStep(2)}
              disabled={!selectedService}
            />
          </div>
        )}

        {/* STEP 2: CHOOSE DATE & TIME */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Step Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                  Step 2 of 3
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Select Date &amp; Time
                </h2>
              </div>
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Change Service
              </button>
            </div>

            {/* Concurrent Booking / Slot Conflict Warning Banner */}
            {submitError && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200"
              >
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0 flex-1">
                  <p className="font-bold text-amber-950 dark:text-amber-100">
                    Slot No Longer Available
                  </p>
                  <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                    The appointment time you requested was just reserved. Please pick another open time below. Your customer details and service selections have been saved.
                  </p>
                </div>
              </div>
            )}

            {/* Selected Service and Price Summary Card */}
            <AppointmentSummaryCard
              serviceName={selectedService?.name || 'Selected Service'}
              durationMinutes={totalDurationMinutes}
              formattedPrice={dynamicPricing?.formattedTotal || selectedService?.formatted_price || 'Price on request'}
              selectedAddOns={selectedAddOns}
              onChangeService={() => setStep(1)}
            />

            {/* Priority Service Expedited Arrival Card (if enabled by business) */}
            {org.booking_settings?.priority_dispatch_enabled && (
              <div className={cn(
                "p-3.5 rounded-2xl border transition-all",
                isPriority
                  ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20 shadow-xs"
                  : "bg-white dark:bg-zinc-900 border-slate-200/90 dark:border-zinc-800"
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Zap className="h-4 w-4 fill-amber-500/20" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {org.booking_settings.priority_dispatch_label || 'Priority Service'}
                        </span>
                        {org.booking_settings.priority_dispatch_fee !== null && org.booking_settings.priority_dispatch_fee > 0 ? (
                          <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200">
                            +${org.booking_settings.priority_dispatch_fee}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200">
                            Included
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        {org.booking_settings.priority_dispatch_description || 'Expedited arrival in the earliest available window.'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsPriority(!isPriority)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                      isPriority
                        ? "bg-amber-500 text-white shadow-xs hover:bg-amber-600"
                        : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700"
                    )}
                  >
                    {isPriority ? 'Selected' : 'Select'}
                  </button>
                </div>
              </div>
            )}

            {/* Smart Cross-Timezone Traveler Notice Banner */}
            <TimezoneBanner timezone={org.timezone || 'America/Chicago'} />

            {/* Date Selection Rail & Full Calendar Modal */}
            <DatePickerRail
              dates={selectableDates}
              selectedDate={selectedDate}
              onSelectDate={(dateStr) => {
                setSelectedDate(dateStr)
                setSelectedSlot(null)
              }}
              datesMeta={datesMeta}
              timezone={org.timezone || 'America/Chicago'}
              businessHours={org.business_hours}
              blockedDates={org.blocked_dates || []}
              maxBookingDaysAhead={org.max_booking_days_ahead || 30}
            />

            {/* Grouped Time Slots Grid with Empty States and Next Available Recovery */}
            <TimeSlotGrid
              availableSlots={availableSlots}
              allSlots={allSlots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => setSelectedSlot(slot)}
              loading={loadingSlots}
              dayStatus={dayStatus}
              selectedDate={selectedDate}
              timezone={org.timezone || 'America/Chicago'}
              appointmentDurationMinutes={totalDurationMinutes}
              onSelectNextAvailableDate={nextAvailableCandidate ? () => {
                setSelectedDate(nextAvailableCandidate.dateStr)
                setSelectedSlot(null)
              } : undefined}
              nextAvailableDateLabel={nextAvailableCandidate ? `${nextAvailableCandidate.dayOfWeek}, ${nextAvailableCandidate.label}` : null}
            />

            {/* Persistent Sticky Bottom Summary & Navigation Bar for Step 2 */}
            <DateTimeBottomBar
              selectedDate={selectedDate}
              selectedDateFormatted={selectedDateFormatted}
              selectedSlot={selectedSlot}
              formattedTotal={dynamicPricing?.formattedTotal}
              totalDurationMinutes={totalDurationMinutes}
              timezone={org.timezone || 'America/Chicago'}
              onBack={() => setStep(1)}
              onContinue={() => setStep(3)}
              disabled={!selectedSlot}
            />
          </div>
        )}

        {/* STEP 3: CUSTOMER & PROPERTY DETAILS */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">
                  Step 3 of 3
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Your Information &amp; Review
                </h2>
              </div>
              <button 
                type="button"
                onClick={() => setStep(2)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer font-medium"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Change Time
              </button>
            </div>

            {/* Authoritative Booking Summary Review Card */}
            <BookingReviewSummary
              orgName={org.name}
              bookingMode={org.booking_mode}
              serviceName={selectedService?.name || 'Selected Service'}
              category={selectedService?.pricing_model}
              pricingModel={selectedService?.pricing_model as any || 'fixed'}
              basePrice={selectedService?.price}
              formattedTotal={dynamicPricing?.formattedTotal}
              totalDurationMinutes={totalDurationMinutes}
              selectedAddOns={selectedAddOns}
              selectedDate={selectedDate}
              selectedDateFormatted={selectedDateFormatted}
              selectedSlot={selectedSlot}
              timezone={org.timezone || 'America/Chicago'}
              onChangeService={() => setStep(1)}
              onChangeSlot={() => setStep(2)}
            />

            {/* Clean Mobile-First Customer & Property Intake Form */}
            <CustomerIntakeForm
              formData={formData}
              onChangeFormData={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
              errors={formErrors}
              onClearError={(field) => setFormErrors(prev => {
                if (!prev[field]) return prev
                const next = { ...prev }
                delete next[field]
                return next
              })}
              requiresAddress={selectedService?.requires_address ?? true}
              isPrefilled={isPrefilled}
              smsConsent={smsConsent}
              onToggleSmsConsent={(checked) => setSmsConsent(checked)}
              howHeard={howHeard}
              onChangeHowHeard={(val) => setHowHeard(val)}
              howHeardOptions={org.booking_settings?.how_heard_options}
              orgName={org.name}
              bookingMode={org.booking_mode}
              formattedTotal={dynamicPricing?.formattedTotal}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleBookingSubmit}
              onBack={() => setStep(2)}
              onPhotoUpload={handlePhotoUpload}
              onRemovePhoto={handleRemovePhoto}
            />
          </div>
        )}

        {/* STEP 4: CONFIRMATION VIEW */}
        {step === 4 && confirmedBooking && selectedService && selectedSlot && (
          <BookingConfirmationView
            org={{
              id: org.id,
              name: org.name,
              slug: org.slug,
              phone: org.phone,
              timezone: org.timezone || 'America/Chicago',
              booking_mode: org.booking_mode
            }}
            service={selectedService}
            selectedAddOns={selectedAddOns}
            selectedSlot={selectedSlot}
            formData={formData}
            confirmedBooking={confirmedBooking}
            dynamicPricing={dynamicPricing}
          />
        )}

        {/* Universal Clickable Powered by CaptoDesk Badge */}
        <PoweredByBadge source="booking" className="pt-6 pb-2" />
      </div>
    </div>
  )
}

export default function PublicBookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent" />
          <p className="text-xs text-slate-500 dark:text-zinc-400">Loading schedule...</p>
        </div>
      </div>
    }>
      <PublicBookingPageContent />
    </Suspense>
  )
}
