'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileText,
  CreditCard,
  X
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface FoundMoneyUnlockModalProps {
  isOpen: boolean
  onClose: () => void
  amountDue?: number
  customerName?: string
  invoiceNumber?: string
  operationMode?: 'solo' | 'multi_crew'
  onSuccess?: () => void
}

/**
 * Mobile-First "Found Money" Finish-Line Sunk-Cost Paywall Modal
 * 
 * Appears when the contractor attempts to send an invoice or dispatch crew on Job #4+.
 * Guarantees zero data loss: confirms the draft invoice is already saved, and provides
 * a 1-tap checkout path to collect their real earned customer revenue.
 */
export function FoundMoneyUnlockModal({
  isOpen,
  onClose,
  amountDue,
  customerName = 'Customer',
  invoiceNumber,
  operationMode = 'solo',
  onSuccess
}: FoundMoneyUnlockModalProps) {
  const [loading, setLoading] = useState(false)
  const formattedAmount = amountDue && amountDue > 0 ? `$${Math.round(amountDue).toLocaleString('en-US')}` : ''

  const handleUpgrade = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upgrade_plan',
          targetPlanId: operationMode === 'multi_crew' ? 'multi_crew' : 'solo'
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.checkoutUrl && !data.simulated) {
          window.location.href = data.checkoutUrl
          return
        }
        toast.success('✨ Pro Plan unlocked! Sending live invoice...')
        if (onSuccess) onSuccess()
        onClose()
        setTimeout(() => {
          window.location.reload()
        }, 600)
      } else {
        toast.error(data.error || 'Failed to initiate upgrade.')
      }
    } catch {
      toast.error('Network error initiating plan upgrade.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="flex flex-col gap-0 p-0 sm:p-0 max-sm:p-0 sm:max-w-[520px] w-full max-h-[92dvh] overflow-y-auto overscroll-contain bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl max-sm:rounded-b-none max-sm:rounded-t-3xl shadow-2xl ring-0"
      >
        {/* Edge-to-edge Revenue Header */}
        <div className="relative shrink-0 px-6 pt-5 pb-4 text-center bg-gradient-to-b from-emerald-500/15 via-teal-500/8 to-transparent border-b border-emerald-500/15 rounded-t-3xl">
          <DialogClose
            render={
              <Button
                variant="ghost"
                size="icon-touch"
                aria-label="Close dialog"
                className="absolute top-3 right-3 z-20 h-9 w-9 min-h-[36px] min-w-[36px] rounded-full bg-white/85 dark:bg-zinc-900/85 hover:bg-white dark:hover:bg-zinc-800 text-slate-600 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white border border-slate-200/80 dark:border-zinc-700/80 shadow-xs cursor-pointer"
              />
            }
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogClose>

          <div className="inline-flex items-center justify-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-sm shadow-emerald-500/25 shrink-0">
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-wider uppercase bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Job #4 Ready to Collect
            </span>
          </div>

          <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            {formattedAmount
              ? `Collect Your ${formattedAmount} Payment`
              : 'Unlock Job #4 & Start Collecting Payments'}
          </DialogTitle>

          <DialogDescription className="text-xs sm:text-[13px] text-slate-600 dark:text-zinc-400 mt-1.5 max-w-md mx-auto leading-relaxed">
            {invoiceNumber ? `Invoice #${invoiceNumber}` : 'Your job'} for <strong className="text-slate-900 dark:text-zinc-200">{customerName}</strong> is safely saved and ready. You&apos;ve completed your 3 free starter jobs—upgrade to Pro to dispatch crew and collect your card payments.
          </DialogDescription>
        </div>

        {/* Body Content */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-3.5">
          {/* Sunk Cost Reassurance Box */}
          <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs sm:text-[13px] leading-snug">
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <p className="text-slate-700 dark:text-zinc-300">
                <strong className="text-slate-900 dark:text-zinc-100">Draft is 100% saved:</strong> Your line items, pricing, and customer details are preserved. Nothing was erased.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
              <p className="text-slate-700 dark:text-zinc-300">
                <strong className="text-slate-900 dark:text-zinc-100">Direct Payout:</strong> Once sent, your customer pays online via card and funds deposit directly to your bank account.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-slate-700 dark:text-zinc-300">
                <strong className="text-slate-900 dark:text-zinc-100">Automated Google Review:</strong> A review invite will automatically be texted to {customerName} upon payment.
              </p>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60 text-xs">
            <div>
              <span className="font-bold text-sm text-blue-950 dark:text-blue-100">
                {operationMode === 'multi_crew' ? 'Multi-Crew Pro Plan' : 'Solo Pro Plan'}
              </span>
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">
                Unlimited jobs, dispatches &amp; invoices
              </p>
            </div>
            <div className="text-right shrink-0 pl-3">
              <span className="text-lg font-black text-blue-950 dark:text-blue-100">
                {operationMode === 'multi_crew' ? '$199' : '$99'}
              </span>
              <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">/mo</span>
            </div>
          </div>

          {/* Action Buttons (Mobile-First Touch Target) */}
          <div className="space-y-1.5 pt-0.5">
            <Button
              onClick={handleUpgrade}
              disabled={loading}
              className="w-full min-h-[48px] py-3 text-sm font-extrabold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing Checkout...</span>
                </>
              ) : (
                <>
                  <span>Unlock &amp; Send Live Invoice (${operationMode === 'multi_crew' ? '199' : '99'}/mo)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Keep Draft Saved &amp; Return to Job
            </button>
          </div>

          <p className="text-[11px] text-center text-slate-500 dark:text-zinc-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Cancel anytime &bull; $0 platform fee on collected payments</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
