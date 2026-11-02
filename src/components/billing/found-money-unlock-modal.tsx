'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { 
  DollarSign, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  FileText,
  CreditCard
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
  amountDue = 250,
  customerName = 'Customer',
  invoiceNumber,
  operationMode = 'solo',
  onSuccess
}: FoundMoneyUnlockModalProps) {
  const [loading, setLoading] = useState(false)
  const formattedAmount = Math.round(amountDue).toLocaleString('en-US')

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
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      className="p-0 overflow-hidden max-w-lg w-full bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl"
    >
      {/* Mobile-First Header with Revenue Gradient */}
      <div className="relative p-6 sm:p-7 text-center bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent border-b border-emerald-500/20">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
          <DollarSign className="w-8 h-8 stroke-[2.5]" />
        </div>

        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Job #4 Ready to Collect
        </span>

        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Collect Your ${formattedAmount} Payment
        </h2>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1 max-w-md mx-auto leading-relaxed">
          {invoiceNumber ? `Invoice #${invoiceNumber}` : 'Your invoice'} for <strong>{customerName}</strong> is safely drafted and ready. You&apos;ve completed your 3 free starter jobs. Upgrade to Pro to send this live invoice and collect your card payment.
        </p>
      </div>

      <div className="p-5 sm:p-6 space-y-4">
        {/* Sunk Cost Reassurance Box */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
          <div className="flex items-start gap-2.5">
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-slate-700 dark:text-zinc-300">
              <strong>Draft is 100% saved:</strong> Your line items, pricing, and customer details are preserved. Nothing was erased.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-slate-700 dark:text-zinc-300">
              <strong>Direct Payout:</strong> Once sent, customer pays online via card and funds deposit directly to your bank account.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-slate-700 dark:text-zinc-300">
              <strong>Automated Google Review:</strong> Review invite will automatically be texted to {customerName} upon payment.
            </p>
          </div>
        </div>

        {/* Pricing Summary */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs">
          <div>
            <span className="font-bold text-blue-900 dark:text-blue-200">
              {operationMode === 'multi_crew' ? 'Multi-Crew Pro Plan' : 'Solo Pro Plan'}
            </span>
            <p className="text-[11px] text-blue-700 dark:text-blue-300">Unlimited jobs, dispatches &amp; invoices</p>
          </div>
          <div className="text-right">
            <span className="text-base font-black text-blue-900 dark:text-blue-100">
              {operationMode === 'multi_crew' ? '$199' : '$99'}
            </span>
            <span className="text-[11px] text-blue-700 dark:text-blue-300">/mo</span>
          </div>
        </div>

        {/* Action Buttons (Mobile-First Touch Target) */}
        <div className="space-y-2 pt-1">
          <Button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full min-h-[48px] py-3 text-sm font-extrabold rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
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
            className="w-full py-2.5 text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            Keep Draft Saved &amp; Return to Job
          </button>
        </div>

        <p className="text-[11px] text-center text-slate-500 dark:text-zinc-500 flex items-center justify-center gap-1.5 pt-0.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Cancel anytime • $0 platform fee on collected payments
        </p>
      </div>
    </Modal>
  )
}
