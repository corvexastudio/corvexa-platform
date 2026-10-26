'use client'

import { useState } from 'react'
import { Link2, Smartphone, PhoneCall, Check, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/context/workspace-context'

export interface BookingShareBarProps {
  slug?: string
  className?: string
}

export function BookingShareBar({ slug: propSlug, className = '' }: BookingShareBarProps) {
  const { orgSlug, orgName } = useWorkspace()
  const [copied, setCopied] = useState(false)

  const effectiveSlug = propSlug || orgSlug || 'contractor'
  const appUrl = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com').replace(/\/$/, '')
  const bookingUrl = `${appUrl}/book/${effectiveSlug}`

  const smsText = `Hi! You can book an appointment directly on our schedule here: ${bookingUrl}`
  const smsHref = `sms:?&body=${encodeURIComponent(smsText)}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl)
      setCopied(true)
      toast.success('🔗 Public booking link copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Failed to copy link to clipboard.')
    }
  }

  return (
    <div className={`rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-zinc-900 p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
              Your Public Booking Link
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              100% Free &amp; Unlimited
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate font-mono">
            {bookingUrl}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <button
          type="button"
          onClick={handleCopyLink}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Copy Link</span>
            </>
          )}
        </button>

        <a
          href={smsHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-2xs"
          title="Send booking link from your phone's native SMS app"
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span>📱 Text Link from My Phone (Free)</span>
        </a>

        <a
          href="tel:+18777713802"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:underline transition-colors"
          title="Call our live toll-free number to test 3-second auto-reply text"
        >
          <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
          <span>Test 3-Sec Demo Call (+1-877-771-3802)</span>
        </a>
      </div>
    </div>
  )
}
