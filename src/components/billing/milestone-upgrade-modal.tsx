'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  Zap, 
  Users, 
  ArrowRight, 
  Loader2,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface MilestoneUpgradeModalProps {
  isOpen: boolean
  onClose: () => void
  totalRevenue?: number
  operationMode?: 'solo' | 'multi_crew'
  onSuccess?: () => void
}

/**
 * Mobile-First Milestone 3 Celebration & Upgrade Modal
 * Celebrates 3 completed jobs with $0 platform fees and prompts 1-tap upgrade to Pro.
 */
export function MilestoneUpgradeModal({
  isOpen,
  onClose,
  totalRevenue = 0,
  operationMode = 'solo',
  onSuccess
}: MilestoneUpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<'solo' | 'multi_crew'>(operationMode)
  const [loading, setLoading] = useState(false)

  const formattedRevenue = Math.round(totalRevenue).toLocaleString('en-US')
  const isSolo = selectedTier === 'solo'

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade_plan',
          targetPlanId: selectedTier === 'multi_crew' ? 'multi_crew' : 'solo'
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.checkoutUrl && !data.simulated) {
          window.location.href = data.checkoutUrl
          return
        }
        toast.success(data.message || `✨ Upgraded to ${isSolo ? 'Solo Pro' : 'Multi-Crew Pro'}!`)
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

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="p-0 overflow-hidden max-w-lg w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl"
    >
      {/* Mobile-First Header with Celebration Gradient */}
      <div className="relative p-6 sm:p-7 text-center bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-transparent border-b border-amber-500/20">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black flex items-center justify-center shadow-lg shadow-amber-500/20 mb-3 animate-bounce">
          <Trophy className="w-7 h-7" />
        </div>

        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Starter Pass Completed (3/3 Free Jobs)
        </span>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          You Earned ${formattedRevenue} with $0 Platform Fees!
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
          You've proven CaptoDesk brings real bookings and automated reviews to your business. Upgrade to Pro to keep unlimited online bookings, card payments, and dispatches rolling without interruption.
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Tier Selection Cards (Mobile Friendly 44px+ touch targets) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSelectedTier('solo')}
            className={cn(
              'p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative min-h-[96px] flex flex-col justify-between',
              isSolo
                ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 shadow-xs'
                : 'border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40 hover:bg-slate-100 dark:hover:bg-zinc-800'
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Solo Pro
                </span>
                {isSolo && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Owner-operator</p>
            </div>
            <div className="mt-2">
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">$99</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">/mo</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTier('multi_crew')}
            className={cn(
              'p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative min-h-[96px] flex flex-col justify-between',
              !isSolo
                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs'
                : 'border-slate-200 dark:border-zinc-800 bg-slate-50/40 dark:bg-zinc-900/40 hover:bg-slate-100 dark:hover:bg-zinc-800'
            )}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  Multi-Crew
                </span>
                {!isSolo && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">2+ trucks / tech routes</p>
            </div>
            <div className="mt-2">
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">$199</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">/mo</span>
            </div>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span><strong>Unlimited completed jobs</strong> &amp; zero cap on customer revenue</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span><strong>Live customer invoicing</strong> &amp; direct Stripe card payments</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span><strong>Automated Google review requests</strong> with 1-tap customer links</span>
          </div>
          {!isSolo && (
            <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
              <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
              <span><strong>Team &amp; multi-crew route dispatching</strong> with live arrival tracking</span>
            </div>
          )}
        </div>

        {/* Action Button (Mobile-First Touch Target) */}
        <Button
          onClick={handleUpgrade}
          disabled={loading}
          className={cn(
            'w-full min-h-[48px] py-3 text-sm font-extrabold rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer',
            isSolo
              ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20'
          )}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Preparing Checkout...</span>
            </>
          ) : (
            <>
              <span>Upgrade to {isSolo ? 'Solo Pro ($99/mo)' : 'Multi-Crew Pro ($199/mo)'}</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>

        <p className="text-[11px] text-center text-slate-500 dark:text-zinc-500 flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Cancel anytime • No long-term lock-in contracts
        </p>
      </div>
    </Modal>
  )
}
