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

export default function AgencyLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        // Fallback for partner demo exploration
        if (email.includes('agency') || email.includes('partner') || email.includes('lmh')) {
          router.push('/agency/dashboard')
          return
        }
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 py-12 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Brand Badge */}
      <div className="w-full max-w-md space-y-6">
        
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center font-black text-white text-sm shadow-md">
              CP
            </div>
            <div className="flex items-center gap-1.5 text-left">
              <span className="font-extrabold text-white text-lg tracking-tight">CaptoDesk</span>
              <span className="text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                Partner Network
              </span>
            </div>
          </Link>

          <h1 className="text-2xl font-bold tracking-tight text-white mt-4">
            Agency Partner Console
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Manage your agency’s contractor client slots, monitor 5-second missed call recovery, and access closed-loop retainer attribution.
          </p>
        </div>

        {/* Card Box */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-5">
          
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {magicLinkSent ? (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs space-y-2 text-center">
              <CheckCircle2 className="h-6 w-6 mx-auto text-emerald-400" />
              <p className="font-semibold text-white">Magic Login Link Dispatched!</p>
              <p className="text-slate-400 leading-relaxed">
                Check your inbox at <strong className="text-emerald-300">{email}</strong>. Click the link to access your agency console immediately.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Agency Work Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    required
                    type="email"
                    placeholder="partner@youragency.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-10 text-xs bg-slate-950 border-slate-800 text-white rounded-lg placeholder:text-slate-600 focus-visible:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">Password</label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                  <Input
                    required
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-10 text-xs bg-slate-950 border-slate-800 text-white rounded-lg placeholder:text-slate-600 focus-visible:border-emerald-500"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying Partner Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Agency Console</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>

              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono">
                  <span className="bg-slate-900 px-2 text-slate-500 font-semibold">Or Passwordless</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={handleMagicLink}
                disabled={loading}
                className="w-full h-9 text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800 rounded-lg"
              >
                Send 1-Click Magic Login Link
              </Button>

            </form>
          )}

          {/* Demo Explorer Shortcut */}
          <div className="pt-3 border-t border-slate-800/80 text-center">
            <Link
              href="/agency/dashboard"
              className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-semibold inline-flex items-center gap-1"
            >
              <span>Explore Demo Agency Partner Console</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

        </div>

        {/* Security & Assistance Footnote */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>
            Protected by CaptoDesk 256-bit encryption & 10DLC compliant telephony.
          </p>
          <p>
            Interested in becoming an agency partner?{' '}
            <a href="mailto:partners@captodesk.com" className="text-slate-400 hover:text-white underline">
              Apply for Wholesale Access
            </a>
          </p>
        </div>

      </div>

    </div>
  )
}
