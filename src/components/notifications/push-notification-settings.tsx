'use client'

import { usePushNotifications } from '@/hooks/use-push-notifications'
import { useWorkspace } from '@/lib/context/workspace-context'
import { Button } from '@/components/ui/button'
import { Bell, BellRing, Check, ShieldAlert, Loader2, Smartphone, MessageSquare, PhoneMissed, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export function PushNotificationSettings() {
  const { orgPhone } = useWorkspace()
  const {
    isSupported,
    permission,
    isSubscribed,
    loading,
    error,
    subscribe,
    unsubscribe
  } = usePushNotifications()

  const handleToggle = async () => {
    if (isSubscribed) {
      const ok = await unsubscribe()
      if (ok) {
        toast.success('Push notifications disabled on this device.')
      } else {
        toast.error('Failed to disable push notifications.')
      }
    } else {
      const ok = await subscribe()
      if (ok) {
        toast.success('Push notifications enabled successfully!')
      } else {
        toast.error(error || 'Failed to enable push notifications.')
      }
    }
  }

  return (
    <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-blue-600 dark:text-blue-400 mt-0.5">
            {isSubscribed ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4 text-slate-500 dark:text-zinc-400" />}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
              Owner Mobile &amp; Browser Alerts
              {isSubscribed && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Push Active
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Receive real-time push and SMS notifications for new missed calls, customer replies, and bookings.
            </p>
          </div>
        </div>

        <div>
          {!isSupported ? (
            <span className="text-xs text-slate-500 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 inline-block font-medium">
              Push Not Supported on this Browser
            </span>
          ) : permission === 'denied' ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-lg">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Blocked in browser settings</span>
            </div>
          ) : (
            <Button
              type="button"
              variant={isSubscribed ? 'outline' : 'default'}
              size="sm"
              disabled={loading}
              onClick={handleToggle}
              className={`h-8 text-xs font-medium shadow-xs ${
                isSubscribed
                  ? 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : isSubscribed ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mr-1.5" />
              ) : (
                <Bell className="h-3.5 w-3.5 mr-1.5" />
              )}
              <span>{isSubscribed ? 'Disable on this device' : 'Enable Web Push'}</span>
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">
          {error}
        </div>
      )}

      {/* Active Delivery Channels Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        {/* Channel 1: SMS (Always Active by Default) */}
        <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              Direct SMS Alerts
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              <Check className="h-2.5 w-2.5" /> Always On (Default)
            </span>
          </div>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
            Urgent booking notifications and customer replies are delivered directly to {orgPhone ? <span className="font-semibold text-emerald-950 dark:text-emerald-100">{orgPhone}</span> : 'your mobile number'}.
          </p>
        </div>

        {/* Channel 2: Push Notifications */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3.5 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
              <BellRing className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Browser &amp; Screen Alerts
            </span>
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              isSubscribed
                ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                : 'bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-300/60 dark:border-zinc-700'
            }`}>
              {isSubscribed ? <Check className="h-2.5 w-2.5" /> : null}
              {isSubscribed ? 'Active on This Device' : 'Inactive on This Device'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400">
            {isSubscribed
              ? 'Instant sound chimes and screen banners will pop up on this device whenever a customer interacts.'
              : 'Turn on push alerts to hear an instant chime even if your CaptoDesk tab is in the background.'}
          </p>
        </div>
      </div>

      {/* Channel Matrix & Event Policies */}
      <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 space-y-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">Notification Channel Routing</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Missed Calls */}
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                <PhoneMissed className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
                Missed Calls
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-900 border border-slate-300/60 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold">
                Critical
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Recovered calls and instant caller replies.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" /> Push
              </span>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" /> SMS
              </span>
            </div>
          </div>

          {/* Customer Replies */}
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                Customer Replies
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-900 border border-slate-300/60 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold">
                Critical
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Inbound SMS messages from leads &amp; clients.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" /> Push
              </span>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" /> SMS
              </span>
            </div>
          </div>

          {/* New Bookings */}
          <div className="rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                New Bookings
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-900 border border-slate-300/60 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 font-semibold">
                Critical
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Instant appointments and service requests.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" /> Push
              </span>
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <Check className="h-2.5 w-2.5" /> SMS
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
