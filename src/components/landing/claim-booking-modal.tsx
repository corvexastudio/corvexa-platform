'use client'

import React, { useState, useId } from 'react'
import { useRouter } from 'next/navigation'
import { X, CheckCircle2, ArrowRight, ShieldCheck, Sparkles, Building, MapPin, Phone, Wrench } from 'lucide-react'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'

interface ClaimBookingModalProps {
  open: boolean
  onClose: () => void
}

const COMMON_TRADES = [
  { id: 'plumbing', name: 'Plumbing & Drain Cleaning' },
  { id: 'hvac', name: 'HVAC, Heating & Cooling' },
  { id: 'electrical', name: 'Electrical & Lighting' },
  { id: 'auto_detailing', name: 'Mobile Auto Detailing' },
  { id: 'pressure_washing', name: 'Pressure Washing & Exterior' },
  { id: 'junk_removal', name: 'Junk Removal & Hauling' },
  { id: 'appliance', name: 'Appliance Repair' },
  { id: 'handyman', name: 'Handyman & Home Repairs' },
  { id: 'roofing', name: 'Roofing & Gutters' },
  { id: 'other', name: 'Other Trade Service' }
]

function generateSlug(text: string): string {
  if (!text) return 'your-business'
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'your-business'
}

export function ClaimBookingModal({ open, onClose }: ClaimBookingModalProps) {
  const router = useRouter()
  const baseId = useId()
  const [businessName, setBusinessName] = useState('')
  const [trade, setTrade] = useState('plumbing')
  const [cityState, setCityState] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const liveSlug = generateSlug(businessName)

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (raw.length <= 10) {
      if (raw.length >= 7) {
        setPhone(`(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`)
      } else if (raw.length >= 4) {
        setPhone(`(${raw.slice(0, 3)}) ${raw.slice(3)}`)
      } else if (raw.length > 0) {
        setPhone(`(${raw}`)
      } else {
        setPhone('')
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!businessName.trim()) {
      setError('Please enter your business or trade name.')
      return
    }

    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length < 10) {
      setError('Please enter a valid 10-digit mobile phone number.')
      return
    }

    setSubmitting(true)

    // Store claim draft in localStorage so Onboarding inherits it automatically
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'captodesk_pending_claim',
          JSON.stringify({
            businessName: businessName.trim(),
            slug: liveSlug,
            trade,
            cityState: cityState.trim(),
            phone: digitsOnly,
            timestamp: Date.now()
          })
        )
      } catch {
        // Non-blocking
      }
    }

    // Direct user to fast signup
    const targetUrl = `/client/login?mode=signup&claim=true&name=${encodeURIComponent(businessName.trim())}&trade=${encodeURIComponent(trade)}`
    router.push(targetUrl)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-2 bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            <span>2-Minute Setup • First 3 Jobs Free</span>
          </div>
          <h2 id={`${baseId}-title`} className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Claim Your Free Booking Link
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            Generate your live booking page, real-time arrival tracker, and on-site card invoicing. No credit card or call forwarding required.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
            {error}
          </div>
        )}

        {/* 4-Field Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Field 1: Business Name */}
          <div className="space-y-1.5">
            <label htmlFor={`${baseId}-name`} className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
              Business or Trade Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id={`${baseId}-name`}
                type="text"
                required
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Apex Plumbing & Drain"
                className="w-full pl-9.5 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
            {/* Dynamic Live Booking Link Preview */}
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-zinc-400 px-1 pt-0.5">
              <span>Link Preview:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400 truncate">
                book.captodesk.com/<span className="underline">{liveSlug}</span>
              </span>
            </div>
          </div>

          {/* Field 2: Trade / Primary Service */}
          <div className="space-y-1.5">
            <label htmlFor={`${baseId}-trade`} className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
              Primary Trade / Service <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Wrench className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                id={`${baseId}-trade`}
                value={trade}
                onChange={e => setTrade(e.target.value)}
                className="w-full pl-9.5 pr-8 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 appearance-none cursor-pointer"
              >
                {COMMON_TRADES.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Field 3: City & State */}
          <div className="space-y-1.5">
            <label htmlFor={`${baseId}-city`} className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
              Service City &amp; State <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id={`${baseId}-city`}
                type="text"
                value={cityState}
                onChange={e => setCityState(e.target.value)}
                placeholder="e.g. Austin, TX"
                className="w-full pl-9.5 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
              />
            </div>
          </div>

          {/* Field 4: Mobile Phone Number */}
          <div className="space-y-1.5">
            <label htmlFor={`${baseId}-phone`} className="block text-xs font-bold text-slate-700 dark:text-zinc-300">
              Your Mobile Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id={`${baseId}-phone`}
                type="tel"
                required
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(555) 000-0000"
                className="w-full pl-9.5 pr-3.5 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 font-mono"
              />
            </div>
          </div>

          {/* 1-Line Justification */}
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal pt-1">
            Used to generate your live booking link and send your customer arrival updates. No credit card or phone forwarding required.
          </p>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <span>{submitting ? 'Generating Booking Link...' : 'Create My Free Booking Link →'}</span>
          </button>
        </form>

        {/* Micro-Trust Footnote */}
        <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-center gap-4 text-[11px] text-slate-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> First 3 completed jobs $0
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> No credit card required
          </span>
        </div>
      </div>
    </div>
  )
}
