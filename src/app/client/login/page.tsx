'use client'
export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { BrandIcon } from '@/components/brand/brand-logo'
import { Loader2, CheckCircle2, ArrowRight, AlertCircle, Check, ShieldCheck, ArrowLeft } from 'lucide-react'
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
  const isSignUp = searchParams.get('mode') === 'signup'

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
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#FAFAFB] text-slate-900 font-[var(--font-sans)] antialiased">

      {/* ── Left panel — brand showcase (hidden on small mobile, visible on desktop) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-[#070D1E] via-[#0B1528] to-[#050B17] text-white p-12 lg:p-16 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <BrandIcon className="h-9 w-9 group-hover:scale-105 transition-transform" size={36} priority />
            <div className="flex flex-col">
              <span className="text-white text-xl font-extrabold tracking-tight">
                Capto<span className="text-blue-400">Desk</span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                The Field Operations System
              </span>
            </div>
          </Link>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg my-auto py-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>BUILT FOR TRADESMEN &amp; CONTRACTORS</span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
            Never lose another job while you&apos;re on a ladder.
          </h1>

          <p className="text-slate-300 text-base lg:text-lg leading-relaxed">
            Your missed calls caught in 8 seconds, appointments booked online, truck arrivals tracked live, and payment collected on site with Apple Pay.
          </p>

          <div className="space-y-3 pt-2 text-sm text-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span><strong>Free online booking link</strong> for your website, cards &amp; truck wraps</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span><strong>Works with your existing number</strong> with simple forwarding (*62)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span><strong>Zero customer app downloads</strong> or complicated passwords</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>10DLC Certified • TCPA Compliant Architecture</span>
          </div>
          <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
            <span>Back to captodesk.com</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ── Right panel — Form ── */}
      <div className="flex flex-1 flex-col justify-between p-6 sm:p-12 lg:p-16 min-h-screen">
        {/* Top bar for mobile */}
        <div className="flex items-center justify-between lg:hidden mb-8">
          <Link href="/" className="flex items-center gap-2">
            <BrandIcon className="h-8 w-8" size={32} priority />
            <span className="text-slate-900 text-lg font-extrabold tracking-tight">Capto<span className="text-blue-600">Desk</span></span>
          </Link>
          <Link href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Link>
        </div>

        <div className="w-full max-w-md mx-auto my-auto py-6">
          {!sent ? (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
              {linkError && (
                <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-xl p-4">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <p className="font-bold">That sign-in link has expired</p>
                    <p className="text-rose-700 mt-0.5 leading-snug">Sign-in links only work once and expire after 1 hour. Enter your email below to get a fresh link.</p>
                  </div>
                </div>
              )}

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {isSignUp ? 'Claim Your Free Booking Page' : 'Sign in to CaptoDesk'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed">
                  {isSignUp
                    ? 'Get your dedicated contractor booking link in 60 seconds. Zero credit card required.'
                    : 'Access your dispatch calendar, message inbox, and customer leads.'}
                </p>
              </div>

              {/* ── 1-Click Google OAuth button ── */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full h-12 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold rounded-xl border border-slate-300 hover:border-slate-400 shadow-2xs flex items-center justify-center gap-3 transition-all disabled:opacity-60 cursor-pointer"
              >
                {googleLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <GoogleIcon className="h-5 w-5 shrink-0" />
                    <span>{isSignUp ? 'Continue with Google' : 'Sign in with Google'}</span>
                  </>
                )}
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-mono font-medium">
                    Or with work email
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5" htmlFor="email">
                    Work Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="mike@apexplumbing.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="email"
                    required
                    className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all shadow-2xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white text-sm font-extrabold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-60 shadow-md shadow-blue-600/25 cursor-pointer"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Sending sign-in link...</>
                  ) : (
                    <>
                      <span>{isSignUp ? 'Claim Free Booking Link' : 'Send Sign-In Link'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Mode switch */}
              <div className="pt-2 text-center text-xs text-slate-500 border-t border-slate-100">
                {isSignUp ? (
                  <p>
                    Already have an account?{' '}
                    <Link href="/client/login" className="text-blue-600 font-bold hover:underline">
                      Sign in here
                    </Link>
                  </p>
                ) : (
                  <p>
                    New to CaptoDesk?{' '}
                    <Link href="/client/login?mode=signup" className="text-blue-600 font-bold hover:underline">
                      Claim your free booking page
                    </Link>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center text-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-slate-900 mb-2 tracking-tight">Check your email</h2>
                <p className="text-slate-600 leading-relaxed text-sm">
                  We sent a secure sign-in link to<br />
                  <strong className="text-slate-900 font-bold">{email}</strong>
                </p>
              </div>
              <p className="text-xs text-slate-500">Tap the link in your email to instantly open your dashboard.</p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-4 transition-colors mt-2 cursor-pointer"
              >
                Use a different email address
              </button>
            </div>
          )}
        </div>

        {/* Footer legal links */}
        <div className="text-center text-xs text-slate-400 py-4 flex flex-wrap items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} CaptoDesk Platform</span>
          <span>•</span>
          <Link href="/privacy" className="hover:text-slate-700 transition-colors">Privacy Policy</Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-slate-700 transition-colors">Terms of Service</Link>
          <span>•</span>
          <Link href="/contact" className="hover:text-slate-700 transition-colors">Contact Support</Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFB]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
