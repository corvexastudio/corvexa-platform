'use client'

import React, { useState, useEffect } from 'react'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { BellRing, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/context/workspace-context'

export function PushNotificationBanner() {
  const { orgId, orgPhone } = useWorkspace()
  const { isSupported, permission, isSubscribed, loading, subscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(true)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && orgId) {
      const isDismissed = localStorage.getItem(`captodesk_push_prompt_dismissed_${orgId}`) === 'true'
      setDismissed(isDismissed)
    }
  }, [orgId])

  // Don't show if unsupported, already subscribed, permission already decided (denied/granted), or user dismissed
  if (loading || !isSupported || isSubscribed || permission !== 'default' || dismissed) {
    return null
  }

  const handleEnable = async () => {
    setSubscribing(true)
    try {
      const ok = await subscribe()
      if (ok) {
        toast.success('Sound and screen alerts enabled on this device.')
      } else {
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          toast.error('Browser permission was denied. Direct SMS alerts remain active to your phone.')
        }
      }
    } catch {
      toast.error('Could not activate push notifications.')
    } finally {
      setSubscribing(false)
    }
  }

  const handleDismiss = () => {
    if (typeof window !== 'undefined' && orgId) {
      localStorage.setItem(`captodesk_push_prompt_dismissed_${orgId}`, 'true')
    }
    setDismissed(true)
    toast.info('Push banner dismissed. Direct SMS alerts remain active to your phone.')
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 p-4 shadow-2xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6 sm:pr-0">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-2xs shrink-0 mt-0.5">
            <BellRing className="h-4 w-4" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                Turn on instant sound &amp; screen alerts on this device
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                <Check className="h-2.5 w-2.5" /> SMS Backup Active
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Get notified the second a customer books, requests service, or pays an invoice while you are driving or in the field.
              {orgPhone ? ` (SMS alerts to ${orgPhone} are already active).` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto pt-1 sm:pt-0">
          <Button
            type="button"
            size="sm"
            disabled={subscribing}
            onClick={handleEnable}
            className="h-8 px-3 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs cursor-pointer gap-1.5"
          >
            {subscribing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <BellRing className="h-3.5 w-3.5" />
            )}
            <span>Enable Push Alerts</span>
          </Button>

          <button
            type="button"
            onClick={handleDismiss}
            className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-850 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
          >
            Keep SMS Only
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-blue-100/50 dark:hover:bg-blue-900/40 transition-colors cursor-pointer"
        aria-label="Dismiss banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
