'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ShieldAlert, 
  ShieldCheck, 
  Lock, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Zap,
  ArrowLeft
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

function AdminLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [authMode, setAuthMode] = useState<'magic' | 'password'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/client/auth/callback?next=/admin`,
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

  const urlError = searchParams.get('error')

  useEffect(() => {
    if (urlError === 'unauthorized' || urlError === 'not_super_admin') {
      setErrorMessage('Access Denied: This administrative console is strictly restricted to platform super administrators. Your account does not have super administrator privileges.')
    }
  }, [urlError])

  // Verifies user role strictly before permitting entry
  const verifySuperAdminAndRedirect = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErrorMessage('Authentication failed. Please verify your credentials.')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      // Immediately terminate unauthorized session
      await supabase.auth.signOut()
      setErrorMessage('Access Denied: This administrative console is strictly restricted to platform super administrators. Your account does not have super administrator privileges.')
      toast.error('Access Denied: Super administrator privileges required.')
      return
    }

    toast.success(`Welcome back, ${profile.full_name || 'Super Admin'}!`)
    router.replace('/admin')
  }

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Please enter both email and password.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        setErrorMessage(error.message)
        toast.error(error.message)
      } else {
        await verifySuperAdminAndRedirect()
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      toast.error('Please enter your administrator email.')
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      const callbackUrl = `${window.location.origin}/client/auth/callback?next=/admin`
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl }
      })

      if (error) {
        setErrorMessage(error.message)
        toast.error(error.message)
      } else {
        setMagicSent(true)
        toast.success('Magic link dispatched to your administrator email.')
      }
    } catch {
      setErrorMessage('Failed to send magic link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#070A12] px-4 text-zinc-100 selection:bg-amber-500/30">
      {/* Top Accent Line */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 z-50" />

      <div className="max-w-md w-full space-y-6">
        {/* Security Header Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 mb-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 font-mono">
              Restricted Console • Super Admin Only
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            CaptoDesk Operations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            Dedicated administrative authentication portal.
          </p>
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex items-start gap-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <p className="font-bold text-rose-200">Security Exception</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-rose-300/90">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Card Form */}
        <div className="rounded-2xl border border-zinc-800 bg-[#0B0F19] p-6 sm:p-8 shadow-2xl space-y-6">
          {magicSent ? (
            <div className="text-center space-y-4 py-4">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">Magic Link Dispatched</h3>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                We sent a secure one-time authorization link to <span className="text-white font-semibold">{email}</span>. Click the link to access the operations console.
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-semibold"
              >
                Use password login instead
              </button>
            </div>
          ) : (
            <>
              {/* Google One-Click OAuth */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-1">
                <div className="border-t border-zinc-800 w-full" />
                <span className="bg-[#0B0F19] px-3 text-[10px] text-zinc-500 uppercase tracking-widest font-mono">
                  Or with email
                </span>
              </div>

              {/* Tab Selector: Password vs Magic Link */}
              <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAuthMode('password')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${
                    authMode === 'password'
                      ? 'bg-amber-500 text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Password Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode('magic')}
                  className={`flex-1 py-1.5 rounded-lg transition-colors ${
                    authMode === 'magic'
                      ? 'bg-amber-500 text-black shadow-sm font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Magic Link / OTP
                </button>
              </div>

              {authMode === 'password' ? (
                <form onSubmit={handlePasswordLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                      Super Admin Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@yourdomain.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                      Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                    ) : (
                      <>
                        <span>Authenticate Super Admin</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleMagicLinkLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                      Super Admin Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@yourdomain.com"
                        className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-black" />
                    ) : (
                      <>
                        <span>Send Super Admin Magic Link</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </>
          )}

          <div className="pt-4 border-t border-zinc-800/80 text-center">
            <Link
              href="/client/login"
              className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Looking for customer portal login?</span>
            </Link>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[11px] text-zinc-400 text-center font-mono">
          All administrative sessions are logged with IP attribution, cryptographic validation, and role-based privilege checks.
        </p>
      </div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#070A12] text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    }>
      <AdminLoginContent />
    </Suspense>
  )
}
