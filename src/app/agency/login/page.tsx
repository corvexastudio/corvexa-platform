'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Building2, 
  ShieldCheck, 
  ArrowRight, 
  Lock, 
  Mail, 
  Sparkles, 
  AlertCircle, 
  Loader2, 
  CheckCircle2 
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/theme-toggle'
import { BrandIcon } from '@/components/brand/brand-logo'

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="18" height="18">
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

export default function AgencyLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handleGoogleSignIn() {
    setGoogleLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/agency/dashboard`
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (oauthError) {
        setError(oauthError.message)
        setGoogleLoading(false)
      }
    } catch (err: any) {
      setError(err?.message || 'Google sign-in could not be completed')
      setGoogleLoading(false)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      router.push('/agency/dashboard')
    } catch (err: any) {
      setError(err?.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  async function handleMagicLink() {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid partner work email first.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/agency/dashboard`
        }
      })

      if (otpError) {
        setError(otpError.message)
        return
      }

      setMagicLinkSent(true)
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch magic link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-500/30 dark:selection:text-emerald-200 transition-colors relative">
      
      {/* Top Corner Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle className="h-9 w-9" />
      </div>

      {/* Brand Badge */}
      <div className="w-full max-w-md space-y-6">
        
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <BrandIcon className="h-9 w-9 group-hover:scale-105 transition-transform shrink-0" size={36} priority />
            <div className="flex items-center gap-1.5 text-left">
              <span className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">CaptoDesk</span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                Partner Network
              </span>
            </div>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-4">
            Agency Partner Console
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
            Manage your agency’s contractor client slots, monitor 5-second missed call recovery, and access closed-loop retainer attribution.
          </p>
        </div>

        {/* Card Box */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xl space-y-5 transition-colors">
          
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* 1-Tap Google Sign-In */}
          <div className="space-y-3">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full h-10 text-xs font-semibold bg-white hover:bg-slate-50 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-100 border border-slate-300 dark:border-zinc-700 rounded-lg gap-2.5 shadow-2xs cursor-pointer transition-colors"
            >
              {googleLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500 dark:text-zinc-400" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </>
              )}
            </Button>

            <div className="relative pt-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-mono">
                <span className="bg-white dark:bg-zinc-900 px-2 text-slate-400 dark:text-zinc-500 font-semibold">
                  Or continue with work email
                </span>
              </div>
            </div>
          </div>

          {magicLinkSent ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs space-y-2 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-600 dark:text-emerald-400" />
              <p className="font-semibold text-slate-900 dark:text-white">Magic Login Link Dispatched!</p>
              <p className="text-slate-600 dark:text-zinc-400 leading-relaxed">
                Check your inbox at <strong className="text-emerald-700 dark:text-emerald-300">{email}</strong>. Click the link to access your agency console immediately.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Agency Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  <Input
                    required
                    type="email"
                    placeholder="partner@youragency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
                  <Input
                    required
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-10 text-xs bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:border-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-2 shadow-xs cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying Partner Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In with Password</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>

              <div className="relative pt-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200 dark:border-zinc-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono">
                  <span className="bg-white dark:bg-zinc-900 px-2 text-slate-400 dark:text-zinc-500 font-semibold">
                    Or passwordless
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleMagicLink}
                disabled={loading || googleLoading}
                className="w-full h-9 text-xs font-semibold bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 rounded-lg cursor-pointer"
              >
                Send 1-Click Magic Login Link
              </Button>

            </form>
          )}

        </div>

        {/* Security & Assistance Footnote */}
        <div className="text-center text-[11px] text-slate-500 dark:text-zinc-400 space-y-1">
          <p>
            Protected by CaptoDesk 256-bit encryption & 10DLC compliant telephony.
          </p>
          <p>
            Interested in wholesale agency capacity?{' '}
            <a href="mailto:partners@captodesk.com" className="text-slate-700 dark:text-zinc-300 hover:underline font-medium">
              Apply for Wholesale Access
            </a>
          </p>
        </div>

      </div>

    </div>
  )
}
