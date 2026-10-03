'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
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

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim()) { toast.error('Please enter your business name.'); return }
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('Session expired. Please sign in again.'); return }

    // Create org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: businessName.trim(), phone_number: phone, onboarding_completed: true })
      .select()
      .single()

    if (orgError || !org) {
      toast.error('Something went wrong. Please try again.')
      setSaving(false)
      return
    }

    // Link profile
    await supabase.from('profiles').upsert({
      id: user.id,
      org_id: org.id,
      email: user.email,
      role: 'client_admin',
    })

    toast.success(`Welcome to CaptoDesk, ${businessName}!`)
    router.push('/client/dashboard')
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
