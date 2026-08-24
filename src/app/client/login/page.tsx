'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <span className="text-primary-foreground font-bold text-sm">C</span>
          </div>
          <span className="text-xl font-semibold tracking-tight">Corvexa</span>
        </div>

        <div className="bg-background border rounded-2xl shadow-sm p-6">
          {!sent ? (
            <>
              <h1 className="text-xl font-bold mb-1">Welcome back</h1>
              <p className="text-sm text-muted-foreground mb-6">Enter your email and we'll send you a sign-in link — no password needed.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@yourbusiness.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="email"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending link...</>
                  ) : (
                    <><Mail className="mr-2 h-4 w-4" /> Send me a link</>
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold">Check your inbox</h2>
              <p className="text-sm text-muted-foreground">
                We sent a sign-in link to <strong>{email}</strong>.<br />
                Tap the link in the email to continue.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-xs text-muted-foreground underline underline-offset-2 mt-2"
              >
                Use a different email
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
