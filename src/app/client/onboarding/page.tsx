'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Loader2, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2,
  Thermometer, 
  Droplets, 
  Zap, 
  Home, 
  Trees, 
  Sparkles, 
  Bug, 
  Car, 
  Hammer, 
  Briefcase,
  Truck,
  Users,
  Check,
  ChevronDown,
  Globe
} from 'lucide-react'
import { INDUSTRY_LIST, getIndustryPreset } from '@/lib/constants/industries'
import { BrandIcon } from '@/components/brand/brand-logo'
import { getFriendlyTimezoneLabel, DEFAULT_US_TIMEZONE } from '@/lib/temporal/timezone'

const INDUSTRY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Thermometer,
  Droplets,
  Zap,
  Home,
  Trees,
  Sparkles,
  Bug,
  Car,
  Hammer,
  Briefcase
}

const PRIMARY_TRADE_IDS = [
  'hvac',
  'plumbing',
  'electrical',
  'roofing',
  'landscaping',
  'cleaning',
  'pest_control',
  'handyman'
]

function toTitleCase(str: string): string {
  if (!str) return ''
  return str
    .trim()
    .split(/\s+/)
    .map(word => {
      if (word.toUpperCase() === word && word.length > 1) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [saving, setSaving] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Step 1: Workspace Profile
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState<string>('hvac')
  const [operationMode, setOperationMode] = useState<'solo' | 'multi_crew'>('solo')
  const [serviceOverrides, setServiceOverrides] = useState<Record<string, { price: number | null }>>({})
  const [editingServiceName, setEditingServiceName] = useState<string | null>(null)

  // Optional 10DLC Carrier & Legal Verification
  const [show10Dlc, setShow10Dlc] = useState(false)
  const [legalBusinessName, setLegalBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('llc')
  const [ein, setEin] = useState('')
  const [isSoleProprietor, setIsSoleProprietor] = useState(false)
  const [addressStreet, setAddressStreet] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressPostalCode, setAddressPostalCode] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [detectedTz, setDetectedTz] = useState<string>(DEFAULT_US_TIMEZONE)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone
        if (clientTz) setDetectedTz(clientTz)
      } catch {
        // Fallback to default
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function checkAuthAndProfile() {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser()
        if (!isMounted) return

        if (userErr || !user) {
          router.replace('/client/login')
          return
        }

        // If user is already linked to an organization, go directly to appropriate dashboard
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id, role')
          .eq('id', user.id)
          .maybeSingle()

        if (!isMounted) return

        if (profile?.org_id) {
          router.replace(profile.role === 'technician' ? '/client/field' : '/client/dashboard')
          return
        }

        // Prefill suggested Title-Cased business name from metadata or email
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name
        if (metaName && !businessName) {
          const formatted = toTitleCase(metaName)
          setBusinessName(`${formatted}'s Services`)
          setLegalBusinessName(`${formatted}'s Services`)
        } else if (user.email && !businessName) {
          const rawPrefix = user.email.split('@')[0].replace(/[._-]/g, ' ')
          const formatted = toTitleCase(rawPrefix)
          setBusinessName(`${formatted}'s Services`)
          setLegalBusinessName(`${formatted}'s Services`)
        }
      } catch (err) {
        console.warn('[ONBOARDING] Initial auth check warning:', err)
      } finally {
        if (isMounted) setCheckingAuth(false)
      }
    }

    checkAuthAndProfile()

    return () => {
      isMounted = false
    }
  }, [supabase, router, businessName])

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const handleEin = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
    if (digits.length <= 2) {
      setEin(digits)
    } else {
      setEin(`${digits.slice(0, 2)}-${digits.slice(2)}`)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const nameToSubmit = businessName.trim()
    if (!nameToSubmit) {
      toast.error('Please enter your business name.')
      return
    }

    const cleanDigits = phone.replace(/\D/g, '')
    if (phone.trim() && cleanDigits.length > 0 && cleanDigits.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number, or leave it blank.')
      return
    }

    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const payload: Record<string, any> = {
        businessName: nameToSubmit,
        phone: phone.trim() || null,
        industry: selectedIndustry,
        operationMode: operationMode,
        timezone: detectedTz,
        services: activePreset.services.map(svc => {
          const override = serviceOverrides[svc.name]
          return {
            ...svc,
            price: override !== undefined ? override.price : svc.price
          }
        })
      }

      if (show10Dlc) {
        payload.legalBusinessName = legalBusinessName.trim() || nameToSubmit
        payload.businessType = businessType
        payload.ein = isSoleProprietor ? null : ein.trim()
        payload.isSoleProprietor = isSoleProprietor
        payload.addressStreet = addressStreet.trim()
        payload.addressCity = addressCity.trim()
        payload.addressState = addressState.trim().toUpperCase()
        payload.addressPostalCode = addressPostalCode.trim()
        payload.websiteUrl = websiteUrl.trim()
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to complete setup. Please try again.')
        setSaving(false)
        return
      }

      toast.success('Welcome to CaptoDesk! Workspace ready.')
      router.replace('/client/dashboard')
    } catch {
      toast.error('Network error. Please try again.')
      setSaving(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <BrandIcon className="h-8 w-8 animate-pulse shadow-2xs" size={32} priority />
          <span className="text-xs text-slate-500 dark:text-zinc-500">Checking account...</span>
        </div>
      </div>
    )
  }

  const primaryTrades = INDUSTRY_LIST.filter(preset => PRIMARY_TRADE_IDS.includes(preset.id))
  const otherTrades = INDUSTRY_LIST.filter(preset => !PRIMARY_TRADE_IDS.includes(preset.id))
  const activePreset = getIndustryPreset(selectedIndustry)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 px-4 py-8">
      <div className="w-full max-w-2xl transition-all duration-300">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-4">
          <BrandIcon className="h-8 w-8 rounded-lg shadow-2xs" size={32} priority />
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-zinc-100">CaptoDesk</span>
        </div>

        {/* Free Starter Pass Value Badge */}
        <div className="flex items-center justify-center mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span>Free 3-Job Starter Pass Active • No credit card required</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl shadow-xs p-6 sm:p-7">
          <div className="mb-5">
            <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-1 tracking-tight">Workspace Setup</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Select your trade to set up your dispatch calendar, service catalog, and online booking link.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Business Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="biz" className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Business Name <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <Input
                id="biz"
                placeholder="e.g. Acme Heating & Air"
                value={businessName}
                onChange={e => {
                  setBusinessName(e.target.value)
                  if (!legalBusinessName) setLegalBusinessName(e.target.value)
                }}
                className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                required
              />
            </div>

            {/* Auto-detected Operational Timezone Indicator */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200/80 dark:border-zinc-800 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-300">
                <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Operating Timezone:</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {getFriendlyTimezoneLabel(detectedTz)}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium">
                Auto-detected (editable in Settings)
              </span>
            </div>

            {/* Trade Category Selector (No Inner Scroll) */}
            <div className="grid gap-2 pt-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Primary Trade <span className="text-red-500 dark:text-red-400">*</span>
              </Label>

              {/* 8 Primary Trades Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {primaryTrades.map((preset) => {
                  const IconComponent = INDUSTRY_ICON_MAP[preset.icon] || Briefcase
                  const isSelected = selectedIndustry === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedIndustry(preset.id)}
                      className={`min-h-[58px] p-2.5 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 dark:bg-blue-950/60 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/40 shadow-xs'
                          : 'bg-slate-50/60 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100/60 dark:hover:bg-zinc-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 w-full mb-1">
                        <div
                          className={`p-1.5 rounded-md shrink-0 ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-200/80 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'
                          }`}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        {isSelected && (
                          <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold truncate block">
                          {preset.name.split('&')[0].trim()}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 block truncate">
                          {preset.badge}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Additional Trades Dropdown */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-slate-500 dark:text-zinc-400 text-xs">Other trade?</span>
                <select
                  value={PRIMARY_TRADE_IDS.includes(selectedIndustry) ? '' : selectedIndustry}
                  onChange={e => {
                    if (e.target.value) setSelectedIndustry(e.target.value)
                  }}
                  className="h-8 px-2.5 text-xs rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="" disabled>Select from 13 additional trades...</option>
                  {otherTrades.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                {!PRIMARY_TRADE_IDS.includes(selectedIndustry) && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <Check className="h-3.5 w-3.5" /> Selected: {activePreset.badge}
                  </span>
                )}
              </div>

              {/* Starter Services Callout Cards */}
              <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 mt-1">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Starter services included for {activePreset.name.split('&')[0].trim()}:
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500">Tap to customize your pricing</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {activePreset.services.map((svc, i) => {
                    const currentPrice = serviceOverrides[svc.name]?.price !== undefined ? serviceOverrides[svc.name].price : svc.price
                    const isEditing = editingServiceName === svc.name

                    return (
                      <div key={i} className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-blue-100/80 dark:border-zinc-800 text-xs shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-medium text-slate-800 dark:text-zinc-200 truncate pr-1" title={svc.name}>
                            {svc.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingServiceName(isEditing ? null : svc.name)}
                            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer shrink-0"
                          >
                            {isEditing ? 'Done' : 'Edit Rate'}
                          </button>
                        </div>

                        {isEditing ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs">$</span>
                              <input
                                type="number"
                                min="0"
                                placeholder="Quote"
                                value={currentPrice === null ? '' : currentPrice}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? null : Number(e.target.value)
                                  setServiceOverrides(prev => ({
                                    ...prev,
                                    [svc.name]: { price: val }
                                  }))
                                }}
                                className="w-full pl-5 pr-2 py-1 text-xs rounded border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setServiceOverrides(prev => ({
                                  ...prev,
                                  [svc.name]: { price: null }
                                }))
                              }}
                              className={`px-2 py-1 text-[10px] font-semibold rounded border cursor-pointer ${
                                currentPrice === null
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                              }`}
                            >
                              Quote on Site
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                            <span>{currentPrice === null ? 'On-site estimate' : 'Fixed rate'}</span>
                            <span className={`font-bold ${currentPrice === null ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {currentPrice === null ? 'Quote on Site' : `$${currentPrice}`}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Operation Scale: Solo vs Multi-Crew */}
            <div className="grid gap-2 pt-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Operations Model <span className="text-red-500 dark:text-red-400">*</span>
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOperationMode('solo')}
                  className={`min-h-[58px] p-3 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    operationMode === 'solo'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/40 shadow-xs'
                      : 'bg-slate-50/60 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100/60 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${operationMode === 'solo' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block">Solo Operator</span>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">1 Truck (solo or with a helper)</span>
                      </div>
                    </div>
                    {operationMode === 'solo' && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800/60">
                    Single daily route • Direct booking
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setOperationMode('multi_crew')}
                  className={`min-h-[58px] p-3 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    operationMode === 'multi_crew'
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 text-blue-950 dark:text-blue-100 ring-2 ring-blue-500/40 shadow-xs'
                      : 'bg-slate-50/60 dark:bg-zinc-950/60 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-100/60 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5 mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${operationMode === 'multi_crew' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'}`}>
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block">Multi-Crew / Fleet</span>
                        <span className="text-[11px] text-slate-500 dark:text-zinc-400">2+ Trucks dispatched daily</span>
                      </div>
                    </div>
                    {operationMode === 'multi_crew' && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-zinc-400 pt-1.5 border-t border-slate-200/60 dark:border-zinc-800/60">
                    Multi-truck dispatch • Crew assignment
                  </div>
                </button>
              </div>
            </div>

            {/* Booking Text Alert Mobile Number */}
            <div className="grid gap-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Where should we text your booking alerts? <span className="text-slate-400 dark:text-zinc-500 font-normal">(optional)</span>
              </Label>
              <Input
                id="phone"
                placeholder="(555) 000-0000"
                value={phone}
                onChange={handlePhone}
                maxLength={14}
                className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Receive SMS notifications when customers book an appointment online or request an estimate.
              </p>
            </div>

            {/* Optional 10DLC Accordion Toggle */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setShow10Dlc(!show10Dlc)}
                className="text-xs text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center justify-between w-full py-1.5 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium">
                    {show10Dlc ? 'Hide carrier messaging verification' : 'Register EIN for carrier messaging verification (optional)'}
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${show10Dlc ? 'rotate-180' : ''}`} />
              </button>

              {show10Dlc && (
                <div className="mt-3 p-4 rounded-lg bg-slate-50 dark:bg-zinc-950/60 border border-slate-200 dark:border-zinc-800 space-y-3.5 animate-in fade-in duration-200">
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-md p-2.5 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    <strong>Carrier Registration:</strong> Optional if you want a dedicated local number. You can complete this anytime in Settings.
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="legalName" className="text-xs text-slate-700 dark:text-zinc-300">
                      Official Legal Entity Name
                    </Label>
                    <Input
                      id="legalName"
                      placeholder="e.g. Acme Plumbing LLC or John Doe"
                      value={legalBusinessName}
                      onChange={e => setLegalBusinessName(e.target.value)}
                      className="h-8.5 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="bType" className="text-xs text-slate-700 dark:text-zinc-300">Business Structure</Label>
                      <select
                        id="bType"
                        value={businessType}
                        onChange={e => setBusinessType(e.target.value)}
                        className="h-8.5 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-200 px-2.5"
                      >
                        <option value="llc">LLC (Limited Liability Co)</option>
                        <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                        <option value="sole_proprietorship">Sole Proprietorship</option>
                        <option value="partnership">Partnership</option>
                        <option value="non_profit">Non-Profit (501c3)</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label htmlFor="ein" className="text-xs text-slate-700 dark:text-zinc-300">
                        Federal EIN / Tax ID {isSoleProprietor ? '(N/A)' : ''}
                      </Label>
                      <Input
                        id="ein"
                        placeholder="12-3456789"
                        value={isSoleProprietor ? '' : ein}
                        onChange={handleEin}
                        disabled={isSoleProprietor}
                        maxLength={10}
                        className="h-8.5 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="soleProp"
                      checked={isSoleProprietor}
                      onChange={e => {
                        setIsSoleProprietor(e.target.checked)
                        if (e.target.checked) setBusinessType('sole_proprietorship')
                      }}
                      className="rounded bg-white dark:bg-zinc-950 border-slate-300 dark:border-zinc-800 text-blue-600 h-3.5 w-3.5 cursor-pointer"
                    />
                    <label htmlFor="soleProp" className="text-[11px] text-slate-600 dark:text-zinc-400 cursor-pointer select-none">
                      I operate as an individual / Sole Proprietor without an EIN
                    </label>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="street" className="text-xs text-slate-700 dark:text-zinc-300">Official Street Address</Label>
                    <Input
                      id="street"
                      placeholder="123 Main St, Suite 100"
                      value={addressStreet}
                      onChange={e => setAddressStreet(e.target.value)}
                      className="h-8.5 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1 grid gap-1">
                      <Label htmlFor="city" className="text-[11px] text-slate-500">City</Label>
                      <Input
                        id="city"
                        placeholder="Austin"
                        value={addressCity}
                        onChange={e => setAddressCity(e.target.value)}
                        className="h-8 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                      />
                    </div>
                    <div className="col-span-1 grid gap-1">
                      <Label htmlFor="state" className="text-[11px] text-slate-500">State (2-letter)</Label>
                      <Input
                        id="state"
                        placeholder="TX"
                        maxLength={2}
                        value={addressState}
                        onChange={e => setAddressState(e.target.value.toUpperCase())}
                        className="h-8 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono"
                      />
                    </div>
                    <div className="col-span-1 grid gap-1">
                      <Label htmlFor="zip" className="text-[11px] text-slate-500">ZIP</Label>
                      <Input
                        id="zip"
                        placeholder="78701"
                        maxLength={10}
                        value={addressPostalCode}
                        onChange={e => setAddressPostalCode(e.target.value)}
                        className="h-8 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="web" className="text-xs text-slate-700 dark:text-zinc-300">Website or Public Social Profile</Label>
                    <Input
                      id="web"
                      placeholder="https://acmeplumbing.com or https://facebook.com/acme"
                      value={websiteUrl}
                      onChange={e => setWebsiteUrl(e.target.value)}
                      className="h-8.5 rounded-md text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Direct High-Momentum CTA */}
            <div className="pt-2 flex flex-col gap-2.5">
              <Button
                type="submit"
                disabled={saving}
                className="w-full min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Setting up workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Launch Workspace & Claim 3 Free Jobs</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-[11px] text-center text-slate-500 dark:text-zinc-400">
                First 3 customer jobs are free with online booking, automated dispatch, and card invoicing.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
