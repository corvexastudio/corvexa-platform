'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, ShieldCheck, ArrowRight, ArrowLeft, Building2, CheckCircle2 } from 'lucide-react'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  
  // Wizard state
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Step 1: Workspace Profile
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')

  // Step 2: 10DLC Carrier & Legal Verification
  const [legalBusinessName, setLegalBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('llc')
  const [ein, setEin] = useState('')
  const [isSoleProprietor, setIsSoleProprietor] = useState(false)
  const [addressStreet, setAddressStreet] = useState('')
  const [addressCity, setAddressCity] = useState('')
  const [addressState, setAddressState] = useState('')
  const [addressPostalCode, setAddressPostalCode] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

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

        // If user is already linked to an organization, go directly to dashboard
        const { data: profile } = await supabase
          .from('profiles')
          .select('org_id')
          .eq('id', user.id)
          .maybeSingle()

        if (!isMounted) return

        if (profile?.org_id) {
          window.location.href = '/client/dashboard'
          return
        }

        // Prefill suggested business name from metadata or email
        const metaName = user.user_metadata?.full_name || user.user_metadata?.name
        if (metaName && !businessName) {
          setBusinessName(`${metaName}'s Business`)
          setLegalBusinessName(`${metaName}'s Business`)
        } else if (user.email && !businessName) {
          const prefix = user.email.split('@')[0]
          const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1)
          setBusinessName(`${capitalized}'s Services`)
          setLegalBusinessName(`${capitalized}'s Services`)
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
  }, [supabase, router])

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

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim()) {
      toast.error('Please enter your business name.')
      return
    }
    if (!legalBusinessName.trim()) {
      setLegalBusinessName(businessName.trim())
    }
    setStep(2)
  }

  const submitOnboarding = async (include10Dlc: boolean = true) => {
    const nameToSubmit = businessName.trim()
    if (!nameToSubmit) {
      toast.error('Please enter your business name.')
      setStep(1)
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
        phone: phone.trim()
      }

      if (include10Dlc) {
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
      window.location.href = '/client/dashboard'
    } catch {
      toast.error('Network error. Please try again.')
      setSaving(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center animate-pulse">
            <span className="text-zinc-200 font-bold text-sm">C</span>
          </div>
          <span className="text-xs text-zinc-500">Checking account...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-4 py-8">
      <div className={`w-full ${step === 2 ? 'max-w-lg' : 'max-w-md'} transition-all duration-300`}>
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-zinc-100">CaptoDesk</span>
        </div>

        {/* Step Progress Pill */}
        <div className="flex items-center justify-center gap-2 mb-4 text-xs font-medium text-zinc-400">
          <span className={`px-2.5 py-1 rounded-full border ${step === 1 ? 'bg-blue-950/80 border-blue-800 text-blue-300' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
            1. Workspace Profile
          </span>
          <ArrowRight className="h-3 w-3 text-zinc-600" />
          <span className={`px-2.5 py-1 rounded-full border ${step === 2 ? 'bg-blue-950/80 border-blue-800 text-blue-300' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
            2. Carrier &amp; 10DLC Verification
          </span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm p-6 sm:p-7">
          {step === 1 ? (
            /* ──────────────── STEP 1: WORKSPACE PROFILE ──────────────── */
            <div>
              <h1 className="text-lg font-semibold text-zinc-100 mb-1 tracking-tight">Workspace Setup</h1>
              <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
                Enter your business details to configure your phone line, dispatcher dashboard, and client portal.
              </p>

              <form onSubmit={handleStep1Next} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="biz" className="text-xs text-zinc-300">
                    Business / Company Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="biz"
                    placeholder="e.g. Acme Plumbing & HVAC"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                    required
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="phone" className="text-xs text-zinc-300">
                    Notification Mobile Number <span className="text-zinc-500 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="phone"
                    placeholder="(555) 555-5555"
                    value={phone}
                    onChange={handlePhone}
                    maxLength={14}
                    className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 font-mono"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Used for instant owner notifications and missed-call test alerts.
                  </p>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <Button
                    type="submit"
                    className="w-full h-10 sm:h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm sm:text-xs flex items-center justify-center gap-1.5"
                  >
                    <span>Next: Carrier &amp; 10DLC Verification</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>

                  <button
                    type="button"
                    onClick={() => submitOnboarding(false)}
                    disabled={saving}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 text-center py-1.5 underline-offset-4 hover:underline transition-colors"
                  >
                    {saving ? 'Setting up workspace...' : 'Quick setup without carrier registration (verify later in Settings)'}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* ──────────────── STEP 2: 10DLC CARRIER VERIFICATION ──────────────── */
            <div>
              <div className="flex items-center justify-between mb-1">
                <h1 className="text-lg font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  US Carrier &amp; 10DLC Registration
                </h1>
              </div>

              <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-md p-3 mb-5 text-[11px] text-emerald-300/90 leading-relaxed">
                <strong>Why is this required?</strong> US carriers (AT&amp;T, Verizon, T-Mobile) require all automated business text messages to be pre-registered under the A2P 10DLC standard so your missed-call text-backs are verified and never flagged as spam.
              </div>

              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="legalName" className="text-xs text-zinc-300">
                    Official Legal Entity Name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="legalName"
                    placeholder="e.g. Acme Plumbing LLC or John Doe"
                    value={legalBusinessName}
                    onChange={e => setLegalBusinessName(e.target.value)}
                    className="h-9 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <p className="text-[10px] text-zinc-500">As registered with IRS or state registration documents.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="bType" className="text-xs text-zinc-300">Business Structure</Label>
                    <select
                      id="bType"
                      value={businessType}
                      onChange={e => setBusinessType(e.target.value)}
                      className="h-9 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 px-2.5 focus:outline-none focus:border-zinc-700"
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
                    <Label htmlFor="ein" className="text-xs text-zinc-300">
                      Federal EIN / Tax ID {isSoleProprietor ? '(N/A)' : <span className="text-red-400">*</span>}
                    </Label>
                    <Input
                      id="ein"
                      placeholder="12-3456789"
                      value={isSoleProprietor ? '' : ein}
                      onChange={handleEin}
                      disabled={isSoleProprietor}
                      maxLength={10}
                      className="h-9 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 font-mono disabled:opacity-50"
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
                    className="rounded bg-zinc-950 border-zinc-800 text-blue-600 h-3.5 w-3.5 cursor-pointer"
                  />
                  <label htmlFor="soleProp" className="text-[11px] text-zinc-400 cursor-pointer select-none">
                    I operate as an individual / Sole Proprietor without a Federal EIN
                  </label>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="street" className="text-xs text-zinc-300">Official Street Address</Label>
                  <Input
                    id="street"
                    placeholder="123 Main St, Suite 100"
                    value={addressStreet}
                    onChange={e => setAddressStreet(e.target.value)}
                    className="h-9 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1 grid gap-1">
                    <Label htmlFor="city" className="text-[11px] text-zinc-400">City</Label>
                    <Input
                      id="city"
                      placeholder="Austin"
                      value={addressCity}
                      onChange={e => setAddressCity(e.target.value)}
                      className="h-8.5 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                    />
                  </div>
                  <div className="col-span-1 grid gap-1">
                    <Label htmlFor="state" className="text-[11px] text-zinc-400">State (2-letter)</Label>
                    <Input
                      id="state"
                      placeholder="TX"
                      maxLength={2}
                      value={addressState}
                      onChange={e => setAddressState(e.target.value.toUpperCase())}
                      className="h-8.5 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 font-mono"
                    />
                  </div>
                  <div className="col-span-1 grid gap-1">
                    <Label htmlFor="zip" className="text-[11px] text-zinc-400">ZIP</Label>
                    <Input
                      id="zip"
                      placeholder="78701"
                      maxLength={10}
                      value={addressPostalCode}
                      onChange={e => setAddressPostalCode(e.target.value)}
                      className="h-8.5 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="web" className="text-xs text-zinc-300">Website or Public Social Profile</Label>
                  <Input
                    id="web"
                    placeholder="https://acmeplumbing.com or https://facebook.com/acme"
                    value={websiteUrl}
                    onChange={e => setWebsiteUrl(e.target.value)}
                    className="h-9 rounded-md text-xs bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
                  />
                  <p className="text-[10px] text-zinc-500">Required by US telecom carriers for online presence verification.</p>
                </div>

                <div className="pt-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      disabled={saving}
                      className="h-9 px-3 rounded-md border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 text-xs flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      <span>Back</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => submitOnboarding(true)}
                      disabled={saving}
                      className="flex-1 h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs flex items-center justify-center gap-1.5"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Submitting Registration...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Complete Setup &amp; Submit Registration</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <button
                    type="button"
                    onClick={() => submitOnboarding(false)}
                    disabled={saving}
                    className="text-[11px] text-zinc-400 hover:text-zinc-200 text-center py-1 underline-offset-4 hover:underline transition-colors"
                  >
                    Skip 10DLC verification for now (complete later in Settings)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

