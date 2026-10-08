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
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">CaptoDesk</span>
        </div>

        <div className="bg-background border rounded-2xl shadow-sm p-6">
          <h1 className="text-xl font-bold mb-1">One quick thing</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Tell us your business name so we can personalise your dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="biz">What's your business called?</Label>
              <Input
                id="biz"
                placeholder="e.g. Mike's Plumbing"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="phone">Your mobile number <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="phone"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={handlePhone}
                maxLength={14}
              />
              <p className="text-xs text-muted-foreground">We use this to send you test messages when you want to verify automations.</p>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting up...</> : "Let's go →"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
