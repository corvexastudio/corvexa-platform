'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { 
  Sparkles, 
  Zap, 
  CheckCircle2, 
  ShieldCheck, 
  Loader2, 
  ArrowRight,
  PhoneCall
} from 'lucide-react'
import { toast } from 'sonner'

export interface FirstBookingCelebrationModalProps {
  isOpen: boolean
  onClose: () => void
  bookingCount?: number
  onUpgradeSuccess?: () => void
  milestoneType?: 'booking' | 'missed_call'
  isInteractiveTest?: boolean
}

export function FirstBookingCelebrationModal({
  isOpen,
  onClose,
  bookingCount = 1,
  onUpgradeSuccess,
  milestoneType = 'booking',
  isInteractiveTest = false
}: FirstBookingCelebrationModalProps) {
  const [loading, setLoading] = useState(false)

  const isMissedCall = milestoneType === 'missed_call'

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade_plan',
          targetPlanId: 'solo'
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.checkoutUrl && !data.simulated) {
          window.location.href = data.checkoutUrl
          return
        }
        toast.success('✨ Welcome to Solo Pro!')
        if (onUpgradeSuccess) onUpgradeSuccess()
        onClose()
        setTimeout(() => {
          window.location.reload()
        }, 600)
      } else {
        toast.error(data.error || 'Failed to initiate plan upgrade.')
      }
    } catch {
      toast.error('Network error initiating plan upgrade.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isMissedCall 
              ? 'bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400' 
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
          }`}>
            {isMissedCall ? (
              <PhoneCall className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>
          <div>
            <span className={`inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider ${
              isMissedCall ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {isMissedCall
                ? (isInteractiveTest ? 'Live Interactive Test' : 'Achievement Unlocked • Missed Call Text-Back')
                : 'Milestone Reached • Customer Booked'}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              {isMissedCall
                ? '⚡ 3-Second Missed Call Recovery'
                : '🎉 Your Free Booking Link Is Working!'}
            </h2>
          </div>
        </div>
      }
      description={
        isMissedCall
          ? 'Turn every missed phone call into a confirmed customer in under 3 seconds before they call a competitor.'
          : "A customer just booked directly on your schedule. You've proven your online link brings in real jobs without phone tag."
      }
    >
      <div className="space-y-4 pt-2">
        {/* Contextual Milestone Banner */}
        {isMissedCall ? (
          isInteractiveTest ? (
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-950 dark:text-blue-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-blue-900 dark:text-blue-300">
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Try It Live from Your Cell Phone</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs">
                  Toll-Free Test Line
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-blue-800 dark:text-blue-300/90 leading-relaxed">
                Call our live demo line at <strong className="font-mono text-blue-950 dark:text-white">+1 (877) 771-3802</strong> from your phone. Let it ring once and hang up—your phone will immediately receive our live 3-second auto-reply text with a booking link!
              </p>
              <a
                href="tel:+18777713802"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer w-fit"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call (877) 771-3802 to Test</span>
              </a>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900 dark:text-emerald-300">
                <Zap className="w-3.5 h-3.5" />
                <span>Inbound Missed Call Caught!</span>
              </div>
              <p className="text-[11px] sm:text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                A customer just called while you were on a job or driving. While customer details are saved in your Leads inbox, <strong>80% of missed callers hire the first business that texts them back</strong>. Solo Pro automatically replies in 3 seconds before they call the next contractor on Google.
              </p>
            </div>
          )
        ) : (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 dark:text-amber-200 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
              <PhoneCall className="w-3.5 h-3.5" />
              <span>The Next Big Leak: 62% of Customers Still Call</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
              While online booking captures digital homeowners, <strong>62% of high-ticket emergency jobs</strong> still start with a phone call. When you&apos;re under a sink or driving, missed calls go to voicemail—and 80% immediately call the next contractor on Google.
            </p>
          </div>
        )}

        {/* Solo Pro Value Card */}
        <div className="rounded-2xl border-2 border-blue-600/30 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-2xs">
                Solo Operator Pro
              </span>
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1">
                Zero Missed Jobs • Complete Truck Automation
              </h3>
            </div>
            <div className="text-right shrink-0">
              <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">$99</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium"> / mo</span>
            </div>
          </div>

          <ul className="space-y-2 text-xs text-slate-700 dark:text-zinc-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Instant 3-Sec Missed-Call Text-Back:</strong> Texts your booking link in 3 seconds before callers hang up and call competitors</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Dedicated Business Phone Line:</strong> Keep your personal cell number 100% private</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Automated SMS Reminders:</strong> 24h &amp; 2h pre-appointment alerts to eliminate customer no-shows</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span><strong>1-Click Live &apos;On My Way&apos; Tracker:</strong> Real-time Domino&apos;s-style GPS link for arriving at job sites</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Automated 5-Star Review Booster:</strong> Instant review links sent automatically upon job completion</span>
            </li>
          </ul>

          {/* Setup Fee Waived Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>One-Time Setup: <span className="line-through text-slate-400 dark:text-zinc-500">$199.00</span> <strong className="text-emerald-600 dark:text-emerald-400">$0.00 (Waived!)</strong></span>
          </div>
        </div>

        {/* Dual Actions */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full h-11 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirecting to PayPal Checkout...</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>⚡ Upgrade to Solo Pro ($99/mo)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer text-center"
          >
            Keep using free booking link ($0/mo) for now
          </button>
        </div>
      </div>
    </Modal>
  )
}
