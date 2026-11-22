'use client'

import { useState } from 'react'
import {
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  KeyRound,
  Camera,
  X,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ChevronLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatCustomerName,
  formatAsYouTypeUsPhone,
  formatStandardUsAddress,
  getEmailDomainSuggestions
} from '@/lib/booking/customer-input-formatter'

export interface CustomerFormData {
  firstName: string
  lastName: string
  name?: string
  phone: string
  email: string
  address?: string
  streetAddress: string
  unit: string
  city: string
  state: string
  zip: string
  notes: string
  accessInfo: string
  photos: string[]
}

export interface CustomerIntakeFormProps {
  formData: CustomerFormData
  onChangeFormData: (updates: Partial<CustomerFormData>) => void
  errors: Record<string, string>
  onClearError: (field: string) => void
  requiresAddress: boolean
  isPrefilled: boolean
  smsConsent: boolean
  onToggleSmsConsent: (checked: boolean) => void
  howHeard: string
  onChangeHowHeard: (val: string) => void
  howHeardOptions?: string[]
  orgName: string
  bookingMode: 'instant' | 'request'
  formattedTotal?: string | null
  submitting: boolean
  submitError: string | null
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemovePhoto: (index: number) => void
  className?: string
}

export function CustomerIntakeForm({
  formData,
  onChangeFormData,
  errors,
  onClearError,
  requiresAddress = true,
  isPrefilled = false,
  smsConsent,
  onToggleSmsConsent,
  howHeard,
  onChangeHowHeard,
  howHeardOptions = [],
  orgName,
  bookingMode,
  formattedTotal,
  submitting,
  submitError,
  onSubmit,
  onBack,
  onPhotoUpload,
  onRemovePhoto,
  className
}: CustomerIntakeFormProps) {
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([])
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false)

  const handleEmailChange = (val: string) => {
    onChangeFormData({ email: val })
    onClearError('email')
    const suggestions = getEmailDomainSuggestions(val)
    setEmailSuggestions(suggestions)
    setShowEmailSuggestions(suggestions.length > 0)
  }

  const applyEmailDomain = (domain: string) => {
    const atIdx = formData.email.lastIndexOf('@')
    const handle = atIdx !== -1 ? formData.email.slice(0, atIdx) : formData.email
    onChangeFormData({ email: `${handle}@${domain}` })
    onClearError('email')
    setShowEmailSuggestions(false)
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn("space-y-6", className)}
      aria-label="Customer and property booking intake form"
    >
      {/* Submission Error Alert */}
      {submitError && (
        <div
          role="alert"
          className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 shadow-2xs animate-in fade-in duration-200"
        >
          <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 min-w-0 flex-1">
            <p className="font-bold text-rose-950 dark:text-rose-100">
              Booking could not be completed
            </p>
            <p className="text-[11px] text-rose-900/90 dark:text-rose-200/90 leading-relaxed">
              {submitError} All entered details have been saved.
            </p>
          </div>
        </div>
      )}

      {/* Prefill Reassurance Banner */}
      {isPrefilled && (
        <div
          role="note"
          className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2.5 shadow-2xs animate-in fade-in duration-200"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0 flex-1 text-[11px] leading-relaxed">
            <span className="font-bold text-emerald-950 dark:text-emerald-100 block">
              {formData.firstName ? `Welcome back, ${formData.firstName}!` : 'Details Prefilled'}
            </span>
            <span>
              We prefilled your contact information from your recent message. Review and submit below.
            </span>
          </div>
        </div>
      )}

      {/* SECTION 1: Customer Contact Information */}
      <section aria-labelledby="section-contact-heading" className="space-y-3">
        <div className="border-b border-slate-100 dark:border-zinc-800/80 pb-2">
          <h3
            id="section-contact-heading"
            className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>1. Contact Information</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Your contact details for booking confirmation and arrival status.
          </p>
        </div>

        {/* First & Last Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label
              htmlFor="field-first-name"
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
            >
              First Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-first-name"
              type="text"
              required
              autoComplete="given-name"
              placeholder="First name"
              value={formData.firstName}
              onChange={(e) => {
                onChangeFormData({ firstName: e.target.value })
                onClearError('firstName')
              }}
              onBlur={() => {
                if (formData.firstName) {
                  onChangeFormData({ firstName: formatCustomerName(formData.firstName) })
                }
              }}
              aria-invalid={!!errors.firstName}
              aria-describedby={errors.firstName ? 'err-first-name' : undefined}
              className={cn(
                "w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden shadow-2xs transition-colors",
                errors.firstName
                  ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                  : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
              )}
            />
            {errors.firstName && (
              <p id="err-first-name" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {errors.firstName}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label
              htmlFor="field-last-name"
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
            >
              Last Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="field-last-name"
              type="text"
              required
              autoComplete="family-name"
              placeholder="Last name"
              value={formData.lastName}
              onChange={(e) => {
                onChangeFormData({ lastName: e.target.value })
                onClearError('lastName')
              }}
              onBlur={() => {
                if (formData.lastName) {
                  onChangeFormData({ lastName: formatCustomerName(formData.lastName) })
                }
              }}
              aria-invalid={!!errors.lastName}
              aria-describedby={errors.lastName ? 'err-last-name' : undefined}
              className={cn(
                "w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden shadow-2xs transition-colors",
                errors.lastName
                  ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                  : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
              )}
            />
            {errors.lastName && (
              <p id="err-last-name" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                {errors.lastName}
              </p>
            )}
          </div>
        </div>

        {/* Mobile Phone Number */}
        <div className="space-y-1">
          <label
            htmlFor="field-phone"
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
          >
            Mobile Phone Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              id="field-phone"
              type="tel"
              required
              autoComplete="tel"
              placeholder="(555) 000-0000"
              value={formData.phone}
              onChange={(e) => {
                const formatted = formatAsYouTypeUsPhone(e.target.value)
                onChangeFormData({ phone: formatted })
                onClearError('phone')
              }}
              onBlur={() => {
                if (formData.phone) {
                  onChangeFormData({ phone: formatAsYouTypeUsPhone(formData.phone) })
                }
              }}
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'err-phone' : 'desc-phone'}
              className={cn(
                "w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden shadow-2xs transition-colors font-mono sm:font-sans",
                errors.phone
                  ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                  : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
              )}
            />
          </div>
          {errors.phone ? (
            <p id="err-phone" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
              {errors.phone}
            </p>
          ) : (
            <p id="desc-phone" className="text-[11px] text-slate-400 dark:text-zinc-500">
              Used for instant appointment confirmation and live technician arrival notices.
            </p>
          )}
        </div>

        {/* Email Address (Optional) */}
        <div className="space-y-1">
          <label
            htmlFor="field-email"
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
          >
            Email Address <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 sm:top-3 h-4 w-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <input
              id="field-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) => handleEmailChange(e.target.value)}
              onFocus={() => {
                const suggestions = getEmailDomainSuggestions(formData.email)
                setEmailSuggestions(suggestions)
                setShowEmailSuggestions(suggestions.length > 0)
              }}
              onBlur={() => {
                setTimeout(() => setShowEmailSuggestions(false), 200)
              }}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'err-email' : undefined}
              className={cn(
                "w-full pl-10 pr-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden shadow-2xs transition-colors",
                errors.email
                  ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                  : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
              )}
            />
          </div>
          {errors.email && (
            <p id="err-email" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
              {errors.email}
            </p>
          )}

          {/* 1-Tap Email Domain Autocomplete Pills */}
          {showEmailSuggestions && emailSuggestions.length > 0 && (
            <div className="pt-1.5 flex flex-wrap items-center gap-1.5 animate-in fade-in duration-150">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">Quick tap:</span>
              {emailSuggestions.map(domain => (
                <button
                  key={domain}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyEmailDomain(domain)
                  }}
                  className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 transition-colors cursor-pointer shadow-2xs"
                >
                  @{domain}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* SECTION 2: Service Property Address (if required by service) */}
      {requiresAddress && (
        <section aria-labelledby="section-address-heading" className="space-y-3">
          <div className="border-b border-slate-100 dark:border-zinc-800/80 pb-2">
            <h3
              id="section-address-heading"
              className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
            >
              <MapPin className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>2. Service Property Address</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Physical address where service will be provided.
            </p>
          </div>

          {/* Street Address & Unit */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="field-street-address"
                className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
              >
                Street Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="field-street-address"
                type="text"
                required
                autoComplete="street-address"
                placeholder="123 Main Street"
                value={formData.streetAddress}
                onChange={(e) => {
                  onChangeFormData({ streetAddress: e.target.value })
                  onClearError('streetAddress')
                }}
                onBlur={() => {
                  if (formData.streetAddress) {
                    onChangeFormData({ streetAddress: formatStandardUsAddress(formData.streetAddress) })
                  }
                }}
                aria-invalid={!!errors.streetAddress}
                aria-describedby={errors.streetAddress ? 'err-street' : undefined}
                className={cn(
                  "w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden shadow-2xs transition-colors",
                  errors.streetAddress
                    ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                    : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
                )}
              />
              {errors.streetAddress && (
                <p id="err-street" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {errors.streetAddress}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="field-unit"
                className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
              >
                Apt / Unit <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
              </label>
              <input
                id="field-unit"
                type="text"
                placeholder="Suite, Apt 4B"
                value={formData.unit}
                onChange={(e) => onChangeFormData({ unit: e.target.value })}
                className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden focus:border-blue-500 shadow-2xs transition-colors"
              />
            </div>
          </div>

          {/* City, State, ZIP */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <div className="col-span-2 sm:col-span-3 space-y-1">
              <label
                htmlFor="field-city"
                className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
              >
                City <span className="text-rose-500">*</span>
              </label>
              <input
                id="field-city"
                type="text"
                required
                autoComplete="address-level2"
                placeholder="City name"
                value={formData.city}
                onChange={(e) => {
                  onChangeFormData({ city: e.target.value })
                  onClearError('city')
                }}
                aria-invalid={!!errors.city}
                aria-describedby={errors.city ? 'err-city' : undefined}
                className={cn(
                  "w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden shadow-2xs transition-colors",
                  errors.city
                    ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                    : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
                )}
              />
              {errors.city && (
                <p id="err-city" role="alert" className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {errors.city}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="field-state"
                className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
              >
                State <span className="text-rose-500">*</span>
              </label>
              <input
                id="field-state"
                type="text"
                required
                maxLength={2}
                autoComplete="address-level1"
                placeholder="TX"
                value={formData.state}
                onChange={(e) => {
                  onChangeFormData({ state: e.target.value.toUpperCase() })
                  onClearError('state')
                }}
                aria-invalid={!!errors.state}
                aria-describedby={errors.state ? 'err-state' : undefined}
                className={cn(
                  "w-full px-3 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm text-center uppercase font-mono focus:outline-hidden shadow-2xs transition-colors",
                  errors.state
                    ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                    : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
                )}
              />
              {errors.state && (
                <p id="err-state" role="alert" className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                  {errors.state}
                </p>
              )}
            </div>

            <div className="col-span-1 sm:col-span-2 space-y-1">
              <label
                htmlFor="field-zip"
                className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
              >
                ZIP Code <span className="text-rose-500">*</span>
              </label>
              <input
                id="field-zip"
                type="text"
                required
                maxLength={10}
                autoComplete="postal-code"
                placeholder="78701"
                value={formData.zip}
                onChange={(e) => {
                  onChangeFormData({ zip: e.target.value })
                  onClearError('zip')
                }}
                aria-invalid={!!errors.zip}
                aria-describedby={errors.zip ? 'err-zip' : undefined}
                className={cn(
                  "w-full px-3 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm text-center font-mono focus:outline-hidden shadow-2xs transition-colors",
                  errors.zip
                    ? "border-rose-400 dark:border-rose-600 focus:border-rose-500 ring-1 ring-rose-400/20"
                    : "border-slate-200 dark:border-zinc-800 focus:border-blue-500"
                )}
              />
              {errors.zip && (
                <p id="err-zip" role="alert" className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                  {errors.zip}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* SECTION 3: Issue Description & Property Access */}
      <section aria-labelledby="section-details-heading" className="space-y-3">
        <div className="border-b border-slate-100 dark:border-zinc-800/80 pb-2">
          <h3
            id="section-details-heading"
            className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>3. Issue Details &amp; Property Access</span>
          </h3>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Helps the technician arrive prepared with the exact right parts and tools.
          </p>
        </div>

        {/* Problem Description */}
        <div className="space-y-1">
          <label
            htmlFor="field-notes"
            className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block"
          >
            Describe Your Issue or Service Request <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
          </label>
          <textarea
            id="field-notes"
            rows={2}
            maxLength={600}
            placeholder="e.g. Water leak under bathroom sink or AC blowing warm air since yesterday..."
            value={formData.notes}
            onChange={(e) => onChangeFormData({ notes: e.target.value })}
            className="w-full p-3 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden focus:border-blue-500 resize-none shadow-2xs transition-colors"
          />
        </div>

        {/* Optional Access Instructions */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label
              htmlFor="field-access"
              className="text-xs font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
              <span>Property Access Instructions <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span></span>
            </label>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" />
              <span>Private dispatch only</span>
            </span>
          </div>
          <input
            id="field-access"
            type="text"
            maxLength={200}
            placeholder="e.g. Gate code #1234, park in driveway, dogs secured inside"
            value={formData.accessInfo}
            onChange={(e) => onChangeFormData({ accessInfo: e.target.value })}
            className="w-full px-3.5 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus:outline-hidden focus:border-blue-500 shadow-2xs transition-colors"
          />
          <p className="text-[10.5px] text-slate-400 dark:text-zinc-500">
            Never displayed publicly. Securely shared only with the assigned technician for arrival.
          </p>
        </div>

        {/* Diagnostic Intake Photos */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
              Diagnostic Photos <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
            </label>
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 tabular-nums">
              {formData.photos.length}/4 photos
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
            Snap a photo of your equipment model tag, breaker box, or leak.
          </p>

          <div className="grid grid-cols-4 gap-2 pt-1">
            {formData.photos.map((photoUrl, idx) => (
              <div
                key={idx}
                className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-850 aspect-square shadow-2xs group"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrl}
                  alt={`Diagnostic photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(idx)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 hover:bg-rose-600 text-white transition-colors cursor-pointer"
                  title="Remove photo"
                  aria-label={`Remove photo ${idx + 1}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {formData.photos.length < 4 && (
              <label className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 bg-slate-50/60 dark:bg-zinc-900/40 hover:bg-slate-100/60 dark:hover:bg-zinc-850/60 aspect-square flex flex-col items-center justify-center gap-1 cursor-pointer transition-all text-slate-500 dark:text-zinc-400">
                <Camera className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
                <span className="text-[10px] font-semibold text-center leading-tight">
                  {formData.photos.length === 0 ? 'Add Photo' : 'Add More'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  aria-label="Upload diagnostic photos"
                  onChange={onPhotoUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>

        {/* How Did You Hear About Us? (Attribution Pills) */}
        {howHeardOptions.length > 0 && (
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
              How did you hear about us? <span className="text-slate-400 dark:text-zinc-500 font-normal">(Optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {howHeardOptions.map((option) => {
                const isSelected = howHeard === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => onChangeHowHeard(isSelected ? '' : option)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border",
                      isSelected
                        ? "bg-blue-600 border-blue-600 text-white font-bold shadow-xs"
                        : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                    )}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* SECTION 4: Carrier-Compliant SMS Opt-In Card */}
      <section
        aria-labelledby="section-disclosure-heading"
        className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/90 dark:border-zinc-800 text-[11px] text-slate-600 dark:text-zinc-400 space-y-2.5 shadow-2xs"
      >
        <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span id="section-disclosure-heading">Verified Booking &amp; Privacy Protection</span>
        </div>
        <p className="leading-relaxed text-[11px] text-slate-500 dark:text-zinc-400">
          No account registration required. A secure private link to reschedule or cancel anytime will be sent directly to your phone.
        </p>

        <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80">
          <label
            htmlFor="sms-consent-checkbox"
            className="flex items-start gap-2.5 cursor-pointer group select-none"
          >
            <input
              id="sms-consent-checkbox"
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => onToggleSmsConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-md border-slate-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 dark:bg-zinc-850 dark:checked:bg-blue-600 cursor-pointer transition-colors shrink-0"
            />
            <div className="flex-1 space-y-1">
              <span className="text-xs font-semibold text-slate-900 dark:text-white block group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Send appointment confirmation, updates, and reminders via SMS
              </span>
              <p className="text-[10.5px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                By checking this box, you authorize {orgName} to send automated service text messages regarding this appointment. Consent is not a condition of purchase. Message and data rates may apply. Reply STOP to cancel or HELP for info.
              </p>
            </div>
          </label>
        </div>
      </section>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs active:scale-[0.98] shrink-0"
        >
          <ChevronLeft className="h-4 w-4 text-slate-500" />
          <span>Back</span>
        </button>

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            "flex-1 h-12 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md select-none cursor-pointer",
            submitting
              ? "bg-emerald-600/70 text-white cursor-wait"
              : "bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-emerald-600/20"
          )}
        >
          {submitting ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Confirming Appointment...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              <span>
                {bookingMode === 'instant'
                  ? `Confirm Appointment ${formattedTotal ? `• ${formattedTotal}` : ''}`
                  : `Submit Booking Request ${formattedTotal ? `• ${formattedTotal}` : ''}`}
              </span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
