'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
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
    // Use the auth/callback route so the PKCE code can be exchanged server-side
    const callbackUrl = `${window.location.origin}/auth/callback?next=/dashboard`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    })
    setLoading(false)
    if (error) toast.error(error.message)
    else setSent(true)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel — brand (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-zinc-950 px-14 py-12">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center">
            <span className="text-zinc-950 font-bold text-sm">C</span>
          </div>
          <span className="text-white text-lg font-semibold tracking-tight">Corvexa</span>
        </div>

        <div>
          <p className="text-5xl font-bold text-white leading-tight tracking-tight mb-6">
            Stop losing leads<br />
            to missed calls.<br />
            <span className="text-zinc-400">Get more reviews.</span>
          </p>
          <p className="text-zinc-500 text-lg leading-relaxed max-w-sm">
            Your missed-call texts, review requests, and lead alerts run on their own while you work.
          </p>
        </div>

        <div className="flex gap-8">
          <div>
            <p className="text-2xl font-bold text-white">87%</p>
            <p className="text-zinc-500 text-sm mt-0.5">of missed calls never call back</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">3×</p>
            <p className="text-zinc-500 text-sm mt-0.5">more reviews with automated follow-up</p>
          </div>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 bg-zinc-50 min-h-screen">

        {/* Mobile brand mark */}
        <div className="flex items-center gap-2.5 mb-10 lg:hidden">
          <div className="h-10 w-10 rounded-xl bg-zinc-950 flex items-center justify-center">
            <span className="text-white font-bold text-sm">C</span>
          </div>
          <span className="text-zinc-950 text-xl font-semibold tracking-tight">Corvexa</span>
        </div>

        <div className="w-full max-w-sm">
          {!sent ? (
            <>
              <h1 className="text-3xl font-bold text-zinc-950 mb-2 tracking-tight">Sign in to Corvexa</h1>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                Enter your email and we'll send you a sign-in link. No password. Works for new and existing accounts.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1.5" htmlFor="email">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@yourbusiness.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="email"
                    required
                    className="w-full h-12 rounded-xl border border-zinc-200 bg-white px-4 text-base text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white text-base font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending link...</>
                  ) : (
                    <>Send me a link <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-zinc-950 mb-2 tracking-tight">Check your inbox</h2>
                <p className="text-zinc-500 leading-relaxed">
                  We sent a sign-in link to<br />
                  <strong className="text-zinc-950">{email}</strong>
                </p>
              </div>
              <p className="text-sm text-zinc-400">Tap the link in the email to sign in.</p>
              <button
                onClick={() => setSent(false)}
                className="text-sm text-zinc-400 hover:text-zinc-600 underline underline-offset-4 transition-colors mt-2"
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
