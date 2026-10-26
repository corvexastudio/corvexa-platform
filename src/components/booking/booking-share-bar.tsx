'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Link2, Smartphone, PhoneCall, Check, ExternalLink, MapPin, Globe, Share2, Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/context/workspace-context'

export interface BookingShareBarProps {
  slug?: string
  className?: string
  showUpgradeCallout?: boolean
}

export function BookingShareBar({ slug: propSlug, className = '', showUpgradeCallout = false }: BookingShareBarProps) {
  const { orgSlug, orgName } = useWorkspace()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [showChannels, setShowChannels] = useState(false)

  const effectiveSlug = propSlug || orgSlug || 'contractor'
  const appUrl = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://app.corvexastudio.com').replace(/\/$/, '')
  const bookingUrl = `${appUrl}/book/${effectiveSlug}`

  const mapsUrl = `${bookingUrl}?ref=google_maps`
  const websiteUrl = `${bookingUrl}?ref=website`
  const smsBookingUrl = `${bookingUrl}?ref=sms`

  const smsText = `Hi! You can book an appointment directly on our schedule here: ${smsBookingUrl}`
  const smsHref = `sms:?&body=${encodeURIComponent(smsText)}`

  const handleCopy = async (url: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedKey(key)
      toast.success(`Copied ${label} to clipboard!`)
      setTimeout(() => setCopiedKey(null), 2500)
    } catch {
      toast.error('Failed to copy link to clipboard.')
    }
  }

  return (
    <div className={`rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-zinc-900 p-3 shadow-2xs flex flex-col gap-3 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate font-mono">
                {bookingUrl}
              </p>
              <a
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-[10px] text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                title="Preview public booking page"
              >
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => handleCopy(bookingUrl, 'default', 'Booking Link')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-2xs cursor-pointer"
          >
            {copiedKey === 'default' ? (
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

          <button
            type="button"
            onClick={() => setShowChannels(!showChannels)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors shadow-2xs cursor-pointer ${
              showChannels
                ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{showChannels ? 'Hide Channels' : 'Where to Put Link (Maps/Web)'}</span>
          </button>

          <a
            href={smsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-2xs"
            title="Send booking link from your phone's native SMS app"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>📱 Text to Customer</span>
          </a>

          <a
            href="tel:+18777713802"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 hover:underline transition-colors"
            title="Call our live toll-free number to test 3-second auto-reply text"
          >
            <PhoneCall className="w-3.5 h-3.5 text-slate-400" />
            <span>Test Missed Call Auto-Text</span>
          </a>
        </div>
      </div>

      {showChannels && (
        <div className="pt-2 border-t border-blue-200/60 dark:border-blue-900/30 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                <span>Google Business Profile / Maps</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Paste into your Google Profile under &quot;Booking / Appointment Link&quot;
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(mapsUrl, 'maps', 'Google Maps link')}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/20 transition-colors"
            >
              {copiedKey === 'maps' ? <Check className="w-3 h-3 text-emerald-600" /> : <Link2 className="w-3 h-3" />}
              <span>{copiedKey === 'maps' ? 'Copied' : 'Copy Tagged'}</span>
            </button>
          </div>

          <div className="p-2.5 rounded-lg bg-white/80 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-zinc-200">
                <Globe className="w-3.5 h-3.5 text-indigo-500" />
                <span>Contractor Website</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Paste behind your website &quot;Book Online&quot; button
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleCopy(websiteUrl, 'website', 'Website link')}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 transition-colors"
            >
              {copiedKey === 'website' ? <Check className="w-3 h-3 text-emerald-600" /> : <Link2 className="w-3 h-3" />}
              <span>{copiedKey === 'website' ? 'Copied' : 'Copy Tagged'}</span>
            </button>
          </div>
        </div>
      )}

      {showUpgradeCallout && (
        <div className="pt-2.5 border-t border-blue-200/60 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 items-center justify-center font-bold text-xs shrink-0">
              <Sparkles className="w-3 h-3" />
            </span>
            <p className="text-slate-700 dark:text-zinc-300">
              <span className="font-semibold text-slate-900 dark:text-white">Active Plan: Free Booking &amp; Field Organizer ($0/mo).</span>{' '}
              Want automated 3-second text-back when you miss calls in the field?
            </p>
          </div>
          <Link
            href="/client/billing"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-bold transition-colors shrink-0 self-start sm:self-auto shadow-2xs border border-slate-700 dark:border-zinc-700 cursor-pointer"
          >
            <span>Upgrade to Solo Pro ($99/mo)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  )
}
