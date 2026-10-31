'use client'

import { useState } from 'react'
import { 
  Sparkles, 
  Trash2, 
  Navigation, 
  FileText, 
  CreditCard, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Smartphone,
  ExternalLink,
  Zap,
  Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { ProUpgradeModal } from '@/components/billing/pro-upgrade-modal'
import { toast } from 'sonner'

export interface PracticeJobCardProps {
  job: {
    id: string
    job_number?: string
    title: string
    status?: string
    notes?: string | null
    scheduled_start?: string | null
    contact?: {
      name?: string | null
      phone?: string | null
      address?: string | null
    } | null
  }
  onDismiss?: (jobId: string) => void
  currentPlanId?: string | null
}

export function PracticeJobCard({ job, onDismiss, currentPlanId = 'free' }: PracticeJobCardProps) {
  const [showSimEnRoute, setShowSimEnRoute] = useState(false)
  const [showSimQuote, setShowSimQuote] = useState(false)
  const [showSimPayment, setShowSimPayment] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState('1-Click Dispatch & SMS')

  const appUrl = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com').replace(/\/$/, '')

  const simTrackingUrl = `${appUrl}/t/demo-tracking-preview`
  const simSmsText = `Hi Alex! Lead Technician from Our Team is on the way (ETA: ~25 mins). Live arrival tracker: ${simTrackingUrl}`

  const handleDismiss = async () => {
    try {
      // Attempt API deletion or pass to parent
      await fetch(`/api/client/jobs/${job.id}`, { method: 'DELETE' }).catch(() => {})
      toast.success('🧹 Practice card dismissed!')
      if (onDismiss) onDismiss(job.id)
    } catch {
      if (onDismiss) onDismiss(job.id)
    }
  }

  const triggerUpgrade = (featureName: string) => {
    setUpgradeFeature(featureName)
    setShowUpgradeModal(true)
  }

  return (
    <>
      <div className="rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-sm space-y-3 transition-all hover:border-amber-600">
        {/* Amber Banner Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 dark:border-amber-900/50 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              🧪 INTERACTIVE PRACTICE CARD — Not a Real Customer
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 hidden lg:inline">
              Tap buttons below to test 1-click automations!
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-zinc-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 hover:bg-amber-100/50 transition-colors cursor-pointer shadow-2xs"
              title="Remove this sandbox card from your board"
            >
              <Trash2 className="w-3 h-3 text-amber-600" />
              <span>🧹 Dismiss Practice Card</span>
            </button>
          </div>
        </div>

        {/* Job Body */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400">
                {job.job_number || 'PRACTICE-101'}
              </span>
              <h2 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">
                {job.title}
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                Sandbox Mode
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-zinc-400">
              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                👤 {job.contact?.name || '🧪 Alex Miller (Test Customer)'}
              </span>
              <span>&bull;</span>
              <span className="font-mono text-slate-500">
                📞 {job.contact?.phone || '+1 (555) 019-9999'}
              </span>
              <span>&bull;</span>
              <span className="flex items-center gap-1 text-slate-500">
                <MapPin className="w-3 h-3 text-amber-600" />
                123 Practice Lane, Suite 100, Austin, TX
              </span>
            </div>

            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 italic pt-0.5">
              💡 {job.notes || 'This is a safe practice job. Tap the buttons to test live SMS previews & GPS arrival links without sending any real charges or texts.'}
            </p>
          </div>

          {/* Interactive Simulation Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap shrink-0 pt-2 md:pt-0">
            <Button
              size="sm"
              onClick={() => setShowSimEnRoute(true)}
              className="h-8 px-3 rounded-lg text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-xs cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5 mr-1" />
              <span>🚐 Test &apos;On My Way&apos;</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimQuote(true)}
              className="h-8 px-3 rounded-lg text-xs bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-800 text-slate-800 dark:text-zinc-200 font-semibold shadow-xs cursor-pointer hover:bg-amber-50"
            >
              <FileText className="w-3.5 h-3.5 mr-1 text-blue-600" />
              <span>💬 1-Click Quote</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimPayment(true)}
              className="h-8 px-3 rounded-lg text-xs bg-white dark:bg-zinc-900 border-amber-300 dark:border-amber-800 text-slate-800 dark:text-zinc-200 font-semibold shadow-xs cursor-pointer hover:bg-amber-50"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              <span>💳 Collect $89</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Simulation Modal 1: On My Way Live ETA Tracker */}
      <Modal
        open={showSimEnRoute}
        onOpenChange={(open) => !open && setShowSimEnRoute(false)}
        title="🧪 Simulated 'On My Way' Arrival Alert"
        description="Here is what your customer receives within 3 seconds of tapping 'On My Way' on a live job."
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 dark:border-blue-900 p-3.5 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Live Customer SMS Message Preview
            </span>
            <div className="rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-3 text-xs font-mono text-slate-800 dark:text-zinc-200 shadow-2xs">
              {simSmsText}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400">
              Your customer taps the link to view your live GPS van location on a map with minute-by-minute ETA countdown.
            </p>
          </div>

          <div className="rounded-xl border border-amber-300/80 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-900 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-600 fill-amber-500/20" />
              <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                In Solo Pro ($99/mo), this is 100% automated
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-300">
              Zero manual texting while driving. Just 1 tap and your customer gets a live Domino&apos;s-style tracking link from your dedicated business phone number.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimEnRoute(false)}
              className="text-xs"
            >
              Close Preview
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowSimEnRoute(false)
                triggerUpgrade('On My Way Live ETA Tracker')
              }}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Zap className="w-3.5 h-3.5 mr-1 fill-current" />
              <span>⚡ Unlock for Real Customers — $99/mo</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Simulation Modal 2: 1-Click Quote */}
      <Modal
        open={showSimQuote}
        onOpenChange={(open) => !open && setShowSimQuote(false)}
        title="🧪 Simulated 1-Click Customer Quote"
        description="Quotes are sent directly via SMS with a 1-tap accept and signature page."
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Water Heater Diagnostic &amp; Safety Inspection</span>
              <span className="text-sm font-extrabold text-blue-600 tabular-nums">$89.00</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Customer receives an instant text with a clean branded web link to accept the estimate from their mobile device.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimQuote(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowSimQuote(false)
                triggerUpgrade('1-Click Quote SMS')
              }}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Zap className="w-3.5 h-3.5 mr-1 fill-current" />
              <span>⚡ Unlock for Real Customers — $99/mo</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Simulation Modal 3: Collect Payment */}
      <Modal
        open={showSimPayment}
        onOpenChange={(open) => !open && setShowSimPayment(false)}
        title="🧪 Simulated On-Site Payment"
        description="Collect payments on-site with 1-tap Apple Pay, Google Pay, or Credit Card."
        size="md"
      >
        <div className="space-y-4 pt-1">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 dark:border-emerald-900 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Invoice #INV-PRACTICE • $89.00
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white">
                Ready for Card / Apple Pay
              </span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-zinc-400">
              Your customer pays instantly on their phone. Funds settle directly to your connected bank account with instant verification.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSimPayment(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setShowSimPayment(false)
                triggerUpgrade('On-Site Payments & Invoicing')
              }}
              className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Zap className="w-3.5 h-3.5 mr-1 fill-current" />
              <span>⚡ Unlock for Real Customers — $99/mo</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Contextual Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={upgradeFeature}
        requiredTier="solo"
        currentPlanId={currentPlanId}
      />
    </>
  )
}
