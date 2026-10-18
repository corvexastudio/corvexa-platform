'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navigation, Clock, User, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EnRouteModalProps {
  isOpen: boolean
  onClose: () => void
  job: {
    id: string
    job_number: string
    title: string
    contact?: {
      name?: string | null
      phone: string
      address?: string | null
    } | null
    technician_name?: string | null
    assigned_profile?: {
      full_name?: string | null
    } | null
    tracking_token?: string | null
  } | null
  organizationName?: string
  onConfirm: (payload: {
    technicianName: string
    etaMinutes: number
    notifyCustomer: boolean
  }) => Promise<void>
}

const ETA_PRESETS = [15, 25, 45, 60]

export function EnRouteModal({
  isOpen,
  onClose,
  job,
  organizationName = 'Our team',
  onConfirm
}: EnRouteModalProps) {
  const [technicianName, setTechnicianName] = useState('')
  const [etaMinutes, setEtaMinutes] = useState(25)
  const [isCustomEta, setIsCustomEta] = useState(false)
  const [customEtaInput, setCustomEtaInput] = useState('30')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Initialize or reset when a job opens
  useEffect(() => {
    if (job) {
      const defaultName =
        job.technician_name ||
        job.assigned_profile?.full_name ||
        'Lead Technician'
      setTechnicianName(defaultName)
      setEtaMinutes(25)
      setIsCustomEta(false)
      setNotifyCustomer(true)
    }
  }, [job])

  if (!job) return null

  const customerName = job.contact?.name || 'there'
  const effectiveEta = isCustomEta ? (parseInt(customEtaInput, 10) || 25) : etaMinutes

  // Live SMS Preview calculation
  const techDisplay = technicianName.trim() || 'Your technician'
  const smsPreview = `Hi ${customerName}! ${techDisplay} from ${organizationName} is on the way (ETA: ~${effectiveEta} mins). Live arrival tracker: https://app.corvexastudio.com/track/${job.tracking_token || '...'}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onConfirm({
        technicianName: techDisplay,
        etaMinutes: effectiveEta,
        notifyCustomer
      })
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={open => !open && onClose()}
      title="Dispatch 'On My Way' Arrival Alert"
      description={`Job #${job.job_number} • ${job.title}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Technician / Van Selection */}
        <div>
          <Label className="text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1.5 flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Who is heading to this job?</span>
          </Label>
          <Input
            value={technicianName}
            onChange={e => setTechnicianName(e.target.value)}
            placeholder="e.g. Mike Ross (Lead Tech) or Van #2"
            className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
            required
          />
        </div>

        {/* Estimated Arrival Time Pills */}
        <div>
          <Label className="text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            <span>Estimated Arrival Time (ETA)</span>
          </Label>
          <div className="grid grid-cols-5 gap-1.5">
            {ETA_PRESETS.map(preset => {
              const isSelected = !isCustomEta && etaMinutes === preset
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setEtaMinutes(preset)
                    setIsCustomEta(false)
                  }}
                  className={cn(
                    "h-8 rounded-lg text-xs font-semibold border transition-all",
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30"
                      : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
                  )}
                >
                  {preset}m
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setIsCustomEta(true)}
              className={cn(
                "h-8 rounded-lg text-xs font-semibold border transition-all",
                isCustomEta
                  ? "bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30"
                  : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800"
              )}
            >
              Custom
            </button>
          </div>

          {isCustomEta && (
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={300}
                value={customEtaInput}
                onChange={e => setCustomEtaInput(e.target.value)}
                placeholder="Minutes"
                className="h-8 w-24 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md tabular-nums"
              />
              <span className="text-xs text-slate-500 dark:text-zinc-400">minutes until on-site arrival</span>
            </div>
          )}
        </div>

        {/* SMS Notification Toggle */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
          <input
            type="checkbox"
            id="notifyCustomerToggle"
            checked={notifyCustomer}
            onChange={e => setNotifyCustomer(e.target.checked)}
            className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-600 h-4 w-4"
          />
          <Label htmlFor="notifyCustomerToggle" className="text-xs text-slate-700 dark:text-zinc-200 cursor-pointer flex-1">
            <span>Send arrival text to customer ({job.contact?.phone || 'No phone'})</span>
          </Label>
        </div>

        {/* Live Customer SMS Preview */}
        {notifyCustomer && (
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              <span>Customer SMS Preview</span>
            </Label>
            <div className="p-3 rounded-lg bg-slate-100/80 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300 font-mono leading-relaxed">
              "{smsPreview}"
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="h-8 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting || !technicianName.trim()}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Navigation className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span>Send Alert &amp; Start Travel</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}
