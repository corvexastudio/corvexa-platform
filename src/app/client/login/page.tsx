'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Mail, Loader2, CheckCircle2, ArrowRight, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  )
}

function LoginContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const linkError = searchParams.get('error')

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    const redirectTo = `${window.location.origin}/client/auth/callback?next=/client/dashboard`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      toast.error(error.message)
      setGoogleLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    // Use the auth/callback route so the PKCE code can be exchanged server-side
    const callbackUrl = `${window.location.origin}/client/auth/callback?next=/client/dashboard`
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
          <span className="text-white text-lg font-semibold tracking-tight">CaptoDesk</span>
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
          <span className="text-zinc-950 text-xl font-semibold tracking-tight">CaptoDesk</span>
        </div>

        <div className="w-full max-w-sm">
          {!sent ? (
            <>
              {linkError && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">That link has expired</p>
                    <p className="text-red-600 mt-0.5">Sign-in links only work once and expire after 1 hour. Enter your email below to get a new one.</p>
                  </div>
                </div>
              )}
              <h1 className="text-3xl font-bold text-zinc-950 mb-2 tracking-tight">Sign in to CaptoDesk</h1>
              <p className="text-zinc-500 mb-6 leading-relaxed">
                Fast & easy access for contractors. New accounts get set up automatically.
              </p>

              {/* ── 1-Click Google OAuth button ── */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full h-12 bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 text-sm font-semibold rounded-xl border border-zinc-200 shadow-sm flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon className="h-5 w-5 shrink-0" />
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-zinc-50 px-3 text-zinc-400 font-medium tracking-wider">
                    Or continue with email
                  </span>
                </div>
              </div>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>}>
      <LoginContent />
    </Suspense>
  )
}
