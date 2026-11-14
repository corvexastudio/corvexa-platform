'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Navigation, Clock, User, MessageSquare, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/context/workspace-context'
import {
  renderSituationAwareText,
  formatCustomerGreetingName,
} from '@/lib/notifications/situation-templates'
import { PLATFORM_TOLL_FREE_NUMBER, resolveSenderPhone } from '@/lib/billing/plans'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'

interface EnRouteModalProps {
  isOpen: boolean
  onClose: () => void
  job: {
    id: string
    job_number: string
    title: string
    contact?: {
      name?: string | null
      phone?: string | null
      address?: string | null
    } | null
    technician_name?: string | null
    crew?: {
      id?: string
      name?: string | null
      van_identifier?: string | null
    } | null
    assigned_profile?: {
      full_name?: string | null
    } | null
    tracking_token?: string | null
  } | null
  organizationName?: string
  techSuggestions?: string[]
  onConfirm: (payload: {
    technicianName: string
    etaMinutes: number
    notifyCustomer: boolean
  }) => Promise<void>
}

const ETA_PRESETS = [15, 30, 45, 60]
const DEFAULT_ETA_MINUTES = 30
const MIN_ETA_MINUTES = 1
const MAX_ETA_MINUTES = 240
const LAST_TECH_STORAGE_KEY = 'captodesk_last_en_route_tech'

function cleanTechName(value?: string | null): string {
  const trimmed = (value || '').trim()
  if (!trimmed || trimmed.toLowerCase() === 'unassigned') return ''
  return trimmed
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function EnRouteModal({
  isOpen,
  onClose,
  job,
  organizationName,
  techSuggestions = [],
  onConfirm
}: EnRouteModalProps) {
  const workspace = useWorkspace()
  const [technicianName, setTechnicianName] = useState('')
  const [etaMinutes, setEtaMinutes] = useState(DEFAULT_ETA_MINUTES)
  const [isCustomEta, setIsCustomEta] = useState(false)
  const [customEtaInput, setCustomEtaInput] = useState('20')
  const [notifyCustomer, setNotifyCustomer] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const rawCustomerPhone = job?.contact?.phone?.trim() || ''
  const hasCustomerPhone = rawCustomerPhone.length > 0

  // Initialize or reset cleanly whenever the modal opens for a job
  useEffect(() => {
    if (!isOpen || !job) return

    let savedTech = ''
    try {
      savedTech = cleanTechName(window.localStorage.getItem(LAST_TECH_STORAGE_KEY))
    } catch {
      savedTech = ''
    }

    const defaultName =
      cleanTechName(job.technician_name) ||
      cleanTechName(job.crew?.name) ||
      cleanTechName(job.assigned_profile?.full_name) ||
      savedTech ||
      cleanTechName(workspace.userFullName) ||
      'Lead Technician'

    setTechnicianName(defaultName)
    setEtaMinutes(DEFAULT_ETA_MINUTES)
    setIsCustomEta(false)
    setNotifyCustomer(Boolean(job.contact?.phone?.trim()))
    setSubmitError(null)
  }, [isOpen, job, workspace.userFullName])

  const techQuickPicks = useMemo(() => {
    if (!job) return []
    const candidates = [
      cleanTechName(job.technician_name),
      cleanTechName(job.crew?.name),
      cleanTechName(job.assigned_profile?.full_name),
      cleanTechName(workspace.userFullName),
      ...techSuggestions.map(cleanTechName),
      'Lead Technician',
    ]
    const seen = new Set<string>()
    const picks: string[] = []
    for (const c of candidates) {
      if (!c) continue
      const key = c.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      picks.push(c)
      if (picks.length >= 5) break
    }
    return picks
  }, [job, techSuggestions, workspace.userFullName])

  if (!job) return null

  const trimmedCustom = customEtaInput.trim()
  const parsedCustomEta = /^\d+$/.test(trimmedCustom) ? parseInt(trimmedCustom, 10) : NaN
  const isCustomEtaValid =
    !isCustomEta ||
    (Number.isInteger(parsedCustomEta) &&
      parsedCustomEta >= MIN_ETA_MINUTES &&
      parsedCustomEta <= MAX_ETA_MINUTES)

  const effectiveEta = isCustomEta
    ? (isCustomEtaValid ? parsedCustomEta : DEFAULT_ETA_MINUTES)
    : etaMinutes

  const willNotifyCustomer = hasCustomerPhone && notifyCustomer
  const techDisplay = technicianName.trim() || 'Your technician'
  const effectiveOrgName = organizationName?.trim() || workspace.orgName?.trim() || 'CaptoDesk'
  const effectiveOperationMode = workspace.operationMode === 'multi_crew' ? 'multi_crew' : 'solo'

  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '') ||
    'https://captodesk.com'
  ).replace(/\/$/, '')
  const trackingToken = job.tracking_token?.trim()
  const trackingUrl = trackingToken ? `${appUrl}/t/${trackingToken}` : `${appUrl}/t/live-tracker`

  const smsPreview = renderSituationAwareText('customer_en_route', {
    operationMode: effectiveOperationMode,
    customerName: job.contact?.name || 'there',
    businessName: effectiveOrgName,
    technicianName: techDisplay,
    etaMinutes: effectiveEta,
    trackingUrl,
  })

  const senderPhone = resolveSenderPhone({
    telnyx_phone_number: workspace.orgPhone,
    plan_id: workspace.planId,
    subscription_status: workspace.subscriptionStatus,
  })
  const formattedSender = formatNationalUs(senderPhone)
  const isPlatformTollFree = senderPhone === PLATFORM_TOLL_FREE_NUMBER

  const customerGreetingName = formatCustomerGreetingName(job.contact?.name, '')
  const displayJobTitle =
    customerGreetingName && job.contact?.name?.trim()
      ? job.title.replace(
          new RegExp(`\\s*-\\s*${escapeRegExp(job.contact.name.trim())}$`),
          ` - ${customerGreetingName}`
        )
      : job.title

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!technicianName.trim() || !isCustomEtaValid || submitting) return
    setSubmitError(null)
    setSubmitting(true)
    try {
      await onConfirm({
        technicianName: techDisplay,
        etaMinutes: effectiveEta,
        notifyCustomer: willNotifyCustomer
      })
      try {
        if (techDisplay && techDisplay !== 'Lead Technician') {
          window.localStorage.setItem(LAST_TECH_STORAGE_KEY, techDisplay)
        }
      } catch {
        // Ignore storage errors in restricted browsers
      }
      onClose()
    } catch (err: any) {
      setSubmitError(err?.message || 'Unable to dispatch en-route status. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={open => !open && !submitting && onClose()}
      title="Dispatch 'On My Way' Arrival Alert"
      description={<span className="block truncate max-w-sm sm:max-w-md">Job #{job.job_number} • {displayJobTitle}</span>}
      size="md"
      className="overflow-hidden sm:max-w-lg p-4 sm:p-5"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={submitting}
            className="min-h-[44px] sm:min-h-[36px] px-3.5 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleSubmit()}
            disabled={submitting || !technicianName.trim() || !isCustomEtaValid}
            className="min-h-[44px] sm:min-h-[36px] px-4 text-xs bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-xs"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Navigation className="h-3.5 w-3.5 mr-1.5" />
            )}
            <span>{willNotifyCustomer ? 'Send Text & Start Travel' : 'Start Travel Only'}</span>
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 overflow-x-hidden">
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Technician / Van Selection */}
        <div>
          <Label
            htmlFor="enRouteTechnicianInput"
            className="text-xs text-slate-700 dark:text-zinc-300 font-semibold mb-1.5 flex items-center gap-1.5"
          >
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Who is heading to this job?</span>
          </Label>
          <Input
            id="enRouteTechnicianInput"
            value={technicianName}
            onChange={e => setTechnicianName(e.target.value)}
            placeholder="e.g. Mike Ross (Lead Tech) or Van #2"
            className="h-10 sm:h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md"
            required
          />
          {techQuickPicks.length > 1 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {techQuickPicks.map(pick => {
                const isSelected = technicianName.trim().toLowerCase() === pick.toLowerCase()
                return (
                  <button
                    key={pick}
                    type="button"
                    onClick={() => setTechnicianName(pick)}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-400 text-blue-700 dark:text-blue-300'
                        : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                    )}
                  >
                    {pick}
                  </button>
                )
              })}
            </div>
          )}
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
                    'min-h-[44px] sm:min-h-[36px] rounded-lg text-xs font-semibold border transition-all',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30'
                      : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
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
                'min-h-[44px] sm:min-h-[36px] rounded-lg text-xs font-semibold border transition-all',
                isCustomEta
                  ? 'bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs ring-1 ring-blue-500/30'
                  : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800'
              )}
            >
              Custom
            </button>
          </div>

          {isCustomEta && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={MIN_ETA_MINUTES}
                  max={MAX_ETA_MINUTES}
                  value={customEtaInput}
                  onChange={e => setCustomEtaInput(e.target.value)}
                  placeholder="Minutes"
                  aria-label="Custom ETA in minutes"
                  className={cn(
                    'h-9 w-24 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-zinc-100 rounded-md tabular-nums',
                    isCustomEtaValid
                      ? 'border-slate-200 dark:border-zinc-800'
                      : 'border-red-400 dark:border-red-700 focus-visible:ring-red-500'
                  )}
                />
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  minutes until on-site arrival
                </span>
              </div>
              {!isCustomEtaValid && (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  Enter a whole number between {MIN_ETA_MINUTES} and {MAX_ETA_MINUTES} minutes.
                </p>
              )}
            </div>
          )}
        </div>

        {/* SMS Notification Toggle */}
        <label
          htmlFor="notifyCustomerToggle"
          className={cn(
            'flex items-center gap-2.5 min-h-[44px] px-3 py-2 rounded-lg border transition-colors',
            hasCustomerPhone
              ? 'cursor-pointer bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 hover:bg-slate-100/70 dark:hover:bg-zinc-900'
              : 'cursor-not-allowed bg-slate-50/70 dark:bg-zinc-950/60 border-slate-200/70 dark:border-zinc-800/70 opacity-75'
          )}
        >
          <input
            type="checkbox"
            id="notifyCustomerToggle"
            checked={willNotifyCustomer}
            disabled={!hasCustomerPhone}
            onChange={e => setNotifyCustomer(e.target.checked)}
            className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-600 h-4 w-4 shrink-0"
          />
          <span className="text-xs text-slate-700 dark:text-zinc-200 font-medium leading-snug flex-1">
            {hasCustomerPhone
              ? `Send arrival text to customer (${formatNationalUs(rawCustomerPhone)})`
              : 'No customer phone on file — status will update without SMS'}
          </span>
        </label>

        {/* Live Customer SMS Preview Bubble */}
        {willNotifyCustomer && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
              <div className="flex items-center gap-1.5 font-semibold uppercase tracking-wider">
                <MessageSquare className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                <span>Customer SMS Preview</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                Via {formattedSender}
                {isPlatformTollFree ? ' (Verified)' : ''}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs sm:text-[13px] text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-normal [overflow-wrap:anywhere] max-h-28 overflow-y-auto select-all">
              {smsPreview}
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
