'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { 
  Zap, 
  CheckCircle2, 
  Sparkles, 
  Truck, 
  Phone, 
  MessageSquare, 
  Clock, 
  Star, 
  Navigation, 
  ShieldCheck, 
  Users, 
  Loader2, 
  Smartphone,
  ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface ProUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  requiredTier?: 'solo' | 'fleet'
  featureName: string
  currentPlanId?: string | null
  customerPhone?: string | null
  customerName?: string | null
  fallbackNativeSmsText?: string | null
  onSuccess?: () => void
}

export function ProUpgradeModal({
  isOpen,
  onClose,
  requiredTier = 'solo',
  featureName,
  currentPlanId = 'free',
  customerPhone,
  customerName,
  fallbackNativeSmsText,
  onSuccess
}: ProUpgradeModalProps) {
  const [activeTier, setActiveTier] = useState<'solo' | 'fleet'>(requiredTier)
  const [loading, setLoading] = useState(false)

  // Sync activeTier if prop changes when opening
  const isSoloActive = activeTier === 'solo'
  const isCurrentlySolo = (currentPlanId || '').toLowerCase() === 'solo' || (currentPlanId || '').toLowerCase() === 'solo_yearly'

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade_plan',
          targetPlanId: activeTier === 'fleet' ? 'multi_crew' : 'solo'
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.checkoutUrl && !data.simulated) {
          window.location.href = data.checkoutUrl
          return
        }
        toast.success(data.message || `✨ Upgraded to ${activeTier === 'fleet' ? 'Team & Fleet Pro' : 'Solo Pro'}!`)
        if (onSuccess) onSuccess()
        onClose()
        setTimeout(() => {
          window.location.reload()
        }, 600)
      } else {
        toast.error(data.error || 'Failed to process upgrade.')
      }
    } catch {
      toast.error('Network error initiating plan upgrade.')
    } finally {
      setLoading(false)
    }
  }

  const encodedSms = fallbackNativeSmsText ? encodeURIComponent(fallbackNativeSmsText) : ''
  const cleanPhone = customerPhone ? customerPhone.replace(/\D/g, '') : ''
  const nativeSmsHref = cleanPhone ? `sms:+${cleanPhone}?&body=${encodedSms}` : `sms:?&body=${encodedSms}`

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title={
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            {isSoloActive ? <Zap className="w-4 h-4 fill-amber-500/20" /> : <Truck className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
              {isSoloActive ? `Unlock 1-Click ${featureName}` : `Unlock Team & Fleet Dispatch`}
            </span>
          </div>
        </div>
      }
      description={
        isSoloActive
          ? 'Save 5+ hours every week and look like a $5M operation. Turn missed calls into booked jobs automatically.'
          : 'Equip technicians and dispatchers with live routing, restricted financial visibility, and multi-truck capacity.'
      }
      size="md"
    >
      <div className="space-y-4 pt-1">
        {/* Tier Card Display */}
        {isSoloActive ? (
          <div className="rounded-2xl border-2 border-blue-600/30 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-4.5 space-y-3.5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                  Solo Operator Pro
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1">
                  1 Truck • Complete Automation
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">$99</span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium"> / mo</span>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>Dedicated 10DLC Business Number:</strong> Instant 8-sec AI missed-call recovery text-back</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>Automated Customer Alerts:</strong> Booking confirmations, 24h &amp; 2h pre-appointment reminders</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>1-Click Live &apos;On My Way&apos; Tracker:</strong> Send ETA tracker links with real-time Domino&apos;s-style GPS</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span><strong>Automated 5-Star Review Booster:</strong> 1-click SMS with Google review links &amp; feedback shield</span>
              </li>
            </ul>

            {/* Setup Fee Waiver Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>One-Time Setup: <span className="line-through text-slate-400 dark:text-zinc-500">$199.00</span> <strong className="text-emerald-600 dark:text-emerald-400">$0.00 (Waived!)</strong></span>
            </div>

            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full h-10 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-1.5 fill-current" />
                  <span>⚡ Upgrade to Solo Pro — $99/mo</span>
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-indigo-600/30 dark:border-indigo-500/30 bg-indigo-50/40 dark:bg-indigo-950/20 p-4.5 space-y-3.5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-2xs">
                  Team &amp; Fleet Pro
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1">
                  Multi-Truck • Crews &amp; Dispatch
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
                  {isCurrentlySolo ? '+$100' : '$199'}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                  {isCurrentlySolo ? ' / mo (Prorated)' : ' / mo'}
                </span>
              </div>
            </div>

            <ul className="space-y-2 text-xs text-slate-700 dark:text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Everything in Solo Pro:</strong> Dedicated number, missed call AI, and SMS automations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Unlimited Staff Seats:</strong> Invite field technicians, dispatchers, and crew leaders</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Restricted Field Tech Portal:</strong> Complete job notes, maps &amp; photos with zero revenue visibility</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span><strong>Multi-Crew Calendar Dispatch:</strong> Assign jobs by van/crew with automated 7 AM daily routes</span>
              </li>
            </ul>

            {/* Setup Fee Waiver Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>One-Time Setup: <span className="line-through text-slate-400 dark:text-zinc-500">$299.00</span> <strong className="text-emerald-600 dark:text-emerald-400">$0.00 (Waived!)</strong></span>
            </div>

            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full h-10 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-xs cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span>Processing...</span>
                </>
              ) : isCurrentlySolo ? (
                <>
                  <Truck className="w-4 h-4 mr-1.5" />
                  <span>🚀 Upgrade to Fleet — +$100/mo (Prorated)</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-1.5" />
                  <span>🚀 Upgrade to Team &amp; Fleet Pro — $199/mo</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Free Native SMS Fallback if available */}
        {fallbackNativeSmsText && (
          <div className="pt-1">
            <a
              href={nativeSmsHref}
              target="_blank"
              rel="noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-500" />
              <span>📱 Send Free SMS from My Phone Instead</span>
            </a>
          </div>
        )}

        {/* Subtle Toggle Link Between Solo and Fleet */}
        <div className="text-center pt-1">
          {isSoloActive ? (
            <button
              type="button"
              onClick={() => setActiveTier('fleet')}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Need multiple trucks or dispatchers? View Team &amp; Fleet ($199/mo)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTier('solo')}
              className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Just 1 truck? View Solo Operator Pro ($99/mo)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
