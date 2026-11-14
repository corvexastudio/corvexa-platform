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
  completedJobsCount?: number
  limit?: number
  isLimitReached?: boolean
}

/**
 * Mobile-First Milestone Celebration & Upgrade Modal
 * Celebrates completed jobs with $0 platform fees and prompts 1-tap upgrade to Pro.
 */
export function MilestoneUpgradeModal({
  isOpen,
  onClose,
  totalRevenue = 0,
  operationMode = 'solo',
  onSuccess,
  completedJobsCount = 3,
  limit = 3,
  isLimitReached = true
}: MilestoneUpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<'solo' | 'multi_crew'>(operationMode)
  const [loading, setLoading] = useState(false)

  const formattedRevenue = Math.round(totalRevenue).toLocaleString('en-US')
  const isSolo = selectedTier === 'solo'
  const isComplete = isLimitReached || completedJobsCount >= limit
  const remainingJobs = Math.max(0, limit - completedJobsCount)

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
      className="p-0 overflow-y-auto max-h-[92vh] sm:max-h-[88vh] max-w-lg w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl overscroll-contain"
    >
      {/* Dynamic Celebration Header */}
      <div className={cn(
        "relative p-5 sm:p-6 text-center border-b transition-colors",
        isComplete
          ? "bg-gradient-to-b from-amber-500/15 via-orange-500/10 to-transparent border-amber-500/20"
          : "bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent border-emerald-500/20"
      )}>
        <div className={cn(
          "mx-auto w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg mb-2.5",
          isComplete
            ? "bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-amber-500/20 animate-bounce"
            : "bg-gradient-to-tr from-emerald-500 to-teal-500 text-white shadow-emerald-500/20"
        )}>
          {isComplete ? (
            <Trophy className="w-6 h-6 text-black" />
          ) : (
            <Zap className="w-6 h-6 text-white" />
          )}
        </div>

        <span className={cn(
          "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase border mb-2",
          isComplete
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30"
            : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
        )}>
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          {isComplete
            ? `Starter Pass Completed (${limit}/${limit} Free Jobs)`
            : `Starter Pass Active (${completedJobsCount}/${limit} Used • ${remainingJobs} Free ${remainingJobs === 1 ? 'Job' : 'Jobs'} Left)`}
        </span>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {totalRevenue > 0
            ? `You Earned $${formattedRevenue} with $0 Platform Fees!`
            : `Keep 100% of Your Earnings with $0 Fees`}
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
          {isComplete
            ? "You've proven CaptoDesk brings real bookings and automated reviews to your business. Upgrade to Pro to keep unlimited online bookings, card payments, and dispatches rolling without interruption."
            : `You have ${remainingJobs} free customer ${remainingJobs === 1 ? 'job' : 'jobs'} remaining on your Starter Pass. Upgrade to Pro early to ensure uninterrupted booking flow, crew dispatching, and unlimited jobs.`}
        </p>
      </div>

      <div className="p-4 sm:p-6 space-y-3.5">
        {/* Tier Selection Cards (Mobile Friendly 44px+ touch targets) */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
          <button
            type="button"
            onClick={() => setSelectedTier('solo')}
            className={cn(
              'p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative min-h-[88px] sm:min-h-[96px] flex flex-col justify-between',
              isSolo
                ? 'border-blue-600 dark:border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 shadow-xs ring-1 ring-blue-500/30'
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
            <div className="mt-1.5">
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">$99</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">/mo</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setSelectedTier('multi_crew')}
            className={cn(
              'p-3 sm:p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative min-h-[88px] sm:min-h-[96px] flex flex-col justify-between',
              !isSolo
                ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500/30'
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
            <div className="mt-1.5">
              <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white">$199</span>
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-medium">/mo</span>
            </div>
          </button>
        </div>

        {/* Feature Highlights */}
        <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span><strong>Unlimited completed jobs</strong> &amp; zero cap on customer revenue</span>
          </div>
          <div className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span><strong>Live customer invoicing</strong> &amp; direct card &amp; online payments</span>
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
            'w-full min-h-[48px] py-2.5 text-sm font-extrabold rounded-2xl shadow-md transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer',
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

        <p className="text-[11px] text-center text-slate-500 dark:text-zinc-500 flex items-center justify-center gap-1.5 pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Cancel anytime • No long-term lock-in contracts
        </p>
      </div>
    </Modal>
  )
}
