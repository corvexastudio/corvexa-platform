'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

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
        } else if (user.email && !businessName) {
          const prefix = user.email.split('@')[0]
          const capitalized = prefix.charAt(0).toUpperCase() + prefix.slice(1)
          setBusinessName(`${capitalized}'s Services`)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const nameToSubmit = businessName.trim()
    if (!nameToSubmit) {
      toast.error('Please enter your business name.')
      return
    }
    setSaving(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers,
        body: JSON.stringify({ businessName: nameToSubmit, phone: phone.trim() })
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        toast.error(data.error || 'Failed to complete setup. Please try again.')
        setSaving(false)
        return
      }

      toast.success(`Welcome to CaptoDesk! Workspace ready.`)
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-zinc-100">CaptoDesk</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-sm p-6">
          <h1 className="text-lg font-semibold text-zinc-100 mb-1 tracking-tight">Workspace Setup</h1>
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            Enter your business details to configure your phone line, dispatcher dashboard, and client portal.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="biz" className="text-xs text-zinc-300">Business / Company Name</Label>
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
              <p className="text-[11px] text-zinc-500">Used for dispatch notifications and real-time missed-call test alerts.</p>
            </div>
            <Button 
              type="submit" 
              className="w-full h-10 sm:h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm sm:text-xs mt-2" 
              disabled={saving}
            >
              {saving ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Initializing Workspace...</> : "Complete Workspace Setup"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
