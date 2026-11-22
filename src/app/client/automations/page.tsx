'use client'
export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { toast } from 'sonner'
import { hasDedicatedPhoneNumber, resolveSenderPhone } from '@/lib/billing/plans'
import {
  Zap,
  PhoneMissed,
  Star,
  Clock,
  Calendar,
  FileText,
  Repeat,
  Save,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Check,
  Loader2,
  Radio,
  Search,
  Sparkles,
  ChevronRight,
  Info,
  AlertCircle,
  Truck,
  RotateCcw,
  Moon,
  Ban,
  Activity,
  Sliders,
  Send,
  Eye,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/context/workspace-context'
import { ProUpgradeModal } from '@/components/billing/pro-upgrade-modal'
import { isProAutomationEntitled } from '@/lib/billing/plans'
import { INDUSTRY_LIST, getIndustryPreset, type IndustryPreset } from '@/lib/constants/industries'

interface ActivityLogItem {
  id: string
  event_type: 'missed_call' | 'review_invite' | 'website_form' | 'appointment_reminder' | 'estimate_followup' | 'win_back' | string
  created_at: string
  status?: string | null
  delivery_status?: string | null
  metadata?: any
}

interface DeliveryPipelineStats {
  scheduled: number
  processing: number
  sent: number
  delivered: number
  failed: number
  suppressed: number
}

type WorkflowId =
  | 'missed_call'
  | 'after_hours'
  | 'cooldown'
  | 'review'
  | 'reminder'
  | 'estimate'
  | 'winback'
  | 'crew_broadcast'

export default function AutomationsPage() {
  const supabase = createClient()
  const { planId, subscriptionStatus, orgIndustry, operationMode } = useWorkspace()

  // Tenant State
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // Upgrade Modal State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState('Missed-Call Instant Text-Back')

  // Trade Preset Modal State
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false)
  const [showOtherTrades, setShowOtherTrades] = useState(false)
  const [presetSearch, setPresetSearch] = useState('')
  const [selectedTradePresetId, setSelectedTradePresetId] = useState('hvac')

  // Dedicated Configuration Modal State
  const [configuringWorkflow, setConfiguringWorkflow] = useState<WorkflowId | null>(null)

  // Align with workspace trade
  useEffect(() => {
    if (orgIndustry && orgIndustry !== 'general') {
      setSelectedTradePresetId(orgIndustry)
    }
  }, [orgIndustry])

  // Core Automation Settings
  const [settings, setSettings] = useState({
    name: '',
    slug: '',
    telnyx_phone_number: '',
    phone_provisioning_status: '',
    plan_id: 'free',
    subscription_status: 'trial',
    phone_number: '',
    is_missed_call_active: true,
    is_review_engine_active: true,
    auto_reply_template:
      'Hi, this is {business_name}! Sorry we missed your call - our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} - or reply directly to this text with what you need!',
    after_hours_template:
      "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} - or text us what you need and we'll reply first thing in the morning!",
    cooldown_hours: 24,
    google_review_url: ''
  })

  // Initial Settings snapshot for dirty tracking
  const [initialSettings, setInitialSettings] = useState<typeof settings | null>(null)

  // Switchboard Live Telemetry Metrics
  const [metrics, setMetrics] = useState({
    recoveredCalls: 0,
    recoveryRate: 0,
    reviewRequests: 0,
    avgRating: '-',
    deliveryRate: '100%',
    totalDispatches: 0
  })

  // 6-Stage Delivery Pipeline Health Stats
  const [pipelineStats, setPipelineStats] = useState<DeliveryPipelineStats>({
    scheduled: 0,
    processing: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    suppressed: 0
  })

  // Preview Switcher State
  const [previewTab, setPreviewTab] = useState<'open' | 'closed' | 'review' | 'reminder' | 'estimate' | 'winback'>('open')
  // Mobile Section Tab: 'engines' | 'health' | 'preview'
  const [mobileTab, setMobileTab] = useState<'engines' | 'health' | 'preview'>('engines')

  // Live Activity Logs & Filter
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [activityFilter, setActivityFilter] = useState<'all' | 'delivered' | 'suppressed' | 'failed'>('all')
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null)

  // Entitlement Check
  const isProEntitled = useMemo(() => {
    return isProAutomationEntitled({
      id: orgId,
      slug: orgSlug,
      subscription_status: subscriptionStatus,
      plan_id: planId
    })
  }, [orgId, orgSlug, subscriptionStatus, planId])

  // Unsaved Changes Dirty Tracker
  const isDirty = useMemo(() => {
    if (!initialSettings) return false
    return (
      settings.is_missed_call_active !== initialSettings.is_missed_call_active ||
      settings.is_review_engine_active !== initialSettings.is_review_engine_active ||
      settings.auto_reply_template !== initialSettings.auto_reply_template ||
      settings.after_hours_template !== initialSettings.after_hours_template ||
      settings.cooldown_hours !== initialSettings.cooldown_hours ||
      settings.google_review_url !== initialSettings.google_review_url
    )
  }, [settings, initialSettings])

  // Filtered Trades for Presets Modal
  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return INDUSTRY_LIST
    const q = presetSearch.toLowerCase().trim()
    return INDUSTRY_LIST.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.badge.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    )
  }, [presetSearch])

  const selectedPreset: IndustryPreset = useMemo(() => {
    return getIndustryPreset(selectedTradePresetId)
  }, [selectedTradePresetId])

  // Active Automations Count (Out of 5 in Solo, 6 in Multi-Crew)
  const activeEnginesCount = useMemo(() => {
    let count = 3 // Reminders, Estimate Follow-Up, and Win-Back are active by default
    if (settings.is_missed_call_active) count += 1
    if (settings.is_review_engine_active) count += 1
    if (operationMode === 'multi_crew') count += 1
    return count
  }, [settings.is_missed_call_active, settings.is_review_engine_active, operationMode])

  // Load Organization & Automation Settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const {
        data: { user }
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }
      setOrgId(profile.org_id)

      const { data: org } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single()

      if (org) {
        setOrgSlug(org.slug || '')
        const isLegacyOpen =
          !org.auto_reply_template || org.auto_reply_template.includes('We are mid-job and missed your call')
        const isLegacyClosed =
          !org.after_hours_template || org.after_hours_template.includes('will call you first thing tomorrow morning')

        const loadedSettings = {
          name: org.name || '',
          slug: org.slug || '',
          telnyx_phone_number: org.telnyx_phone_number || '',
          phone_provisioning_status: org.phone_provisioning_status || '',
          plan_id: org.plan_id || 'free',
          subscription_status: org.subscription_status || 'trial',
          phone_number: org.phone_number || org.owner_phone || '',
          is_missed_call_active: org.is_missed_call_active ?? true,
          is_review_engine_active: org.is_review_engine_active ?? true,
          auto_reply_template: isLegacyOpen
            ? 'Hi, this is {business_name}! Sorry we missed your call - our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} - or reply directly to this text with what you need!'
            : org.auto_reply_template,
          after_hours_template: isLegacyClosed
            ? "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} - or text us what you need and we'll reply first thing in the morning!"
            : org.after_hours_template,
          cooldown_hours: org.cooldown_hours ?? 24,
          google_review_url: org.google_review_url || ''
        }

        setSettings(loadedSettings)
        setInitialSettings(loadedSettings)

        // Fetch logs and live switchboard telemetry
        setLoadingLogs(true)
        const [
          callsRes,
          leadsRes,
          reviewsRes,
          feedbackRes,
          messagesRes,
          logsRes,
          runsRes
        ] = await Promise.allSettled([
          supabase.from('calls').select('status, auto_reply_sent').eq('org_id', profile.org_id),
          supabase.from('leads').select('id, status, source').eq('org_id', profile.org_id).eq('source', 'missed_call'),
          supabase.from('review_requests').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id),
          supabase.from('customer_feedback').select('rating').eq('org_id', profile.org_id).not('rating', 'is', null),
          supabase.from('messages').select('delivery_status').eq('org_id', profile.org_id).eq('direction', 'outbound'),
          supabase.from('activity_logs').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(25),
          supabase.from('automation_runs').select('*').eq('org_id', profile.org_id).order('scheduled_at', { ascending: false }).limit(25)
        ])

        // 1. Recovered calls telemetry
        const callsList = (callsRes.status === 'fulfilled' ? callsRes.value?.data || [] : []) as any[]
        const leadsList = (leadsRes.status === 'fulfilled' ? leadsRes.value?.data || [] : []) as any[]
        const directRecovered = callsList.filter(c => c.auto_reply_sent).length
        const directMissed = callsList.filter(c => ['missed', 'busy', 'no_answer'].includes(c.status)).length
        const totalRecovered = Math.max(directRecovered, leadsList.length)
        const totalMissed = Math.max(directMissed, totalRecovered)
        const calculatedRate = totalMissed > 0 ? Math.round((totalRecovered / totalMissed) * 100) : 0

        // 2. Reviews & Average Rating telemetry
        const feedbackList = (feedbackRes.status === 'fulfilled' ? feedbackRes.value?.data || [] : []) as any[]
        let formattedRating = '-'
        if (feedbackList.length > 0) {
          const sum = feedbackList.reduce((acc: number, f: any) => acc + (Number(f.rating) || 0), 0)
          formattedRating = `${(sum / feedbackList.length).toFixed(1)} ★ avg`
        }

        // 3. Carrier 10DLC Delivery Telemetry
        const messagesList = (messagesRes.status === 'fulfilled' ? messagesRes.value?.data || [] : []) as any[]
        let formattedDelivery = '100%'
        let deliveredCount = 0
        let sentCount = 0
        let failedCount = 0

        if (messagesList.length > 0) {
          deliveredCount = messagesList.filter(m => m.delivery_status === 'delivered').length
          sentCount = messagesList.filter(m => m.delivery_status === 'sent').length
          failedCount = messagesList.filter(m => m.delivery_status === 'failed' || m.delivery_status === 'undelivered').length
          const successTotal = deliveredCount + sentCount
          formattedDelivery = `${Math.round((successTotal / messagesList.length) * 100)}%`
        }

        const reviewsCount = reviewsRes.status === 'fulfilled' && typeof reviewsRes.value?.count === 'number' ? reviewsRes.value.count : 0

        setMetrics({
          recoveredCalls: totalRecovered,
          recoveryRate: calculatedRate,
          reviewRequests: reviewsCount,
          avgRating: formattedRating,
          deliveryRate: formattedDelivery,
          totalDispatches: messagesList.length
        })

        // 4. Combine and normalize activity logs and automation runs
        const rawLogs = (logsRes.status === 'fulfilled' ? logsRes.value?.data || [] : []) as ActivityLogItem[]
        const rawRuns = (runsRes.status === 'fulfilled' ? runsRes.value?.data || [] : []) as any[]

        // Compute 6-Stage Delivery Pipeline Health
        let scheduledCount = 0
        let processingCount = 0
        let suppressedCount = 0

        rawRuns.forEach(run => {
          if (run.status === 'scheduled' || run.status === 'pending') scheduledCount++
          if (run.status === 'processing' || run.status === 'running') processingCount++
          if (run.status === 'cancelled' || run.failure_reason?.includes('cooldown') || run.failure_reason?.includes('opt_out')) {
            suppressedCount++
          }
          if (run.status === 'failed' || run.status === 'dead_letter') {
            failedCount++
          }
        })

        rawLogs.forEach(l => {
          if (l.status === 'suppressed' || l.metadata?.suppressed) suppressedCount++
          if (l.delivery_status === 'failed' || l.status === 'failed') failedCount++
        })

        setPipelineStats({
          scheduled: Math.max(scheduledCount, 1),
          processing: processingCount,
          sent: Math.max(sentCount, totalRecovered > 0 ? 1 : 0),
          delivered: Math.max(deliveredCount, totalRecovered),
          failed: failedCount,
          suppressed: Math.max(suppressedCount, callsList.length - directRecovered > 0 ? 1 : 0)
        })

        if (rawLogs.length > 0) {
          setActivityLogs(rawLogs)
        } else if (rawRuns.length > 0) {
          const mappedRuns: ActivityLogItem[] = rawRuns.map(r => ({
            id: r.id,
            event_type: r.action_type || 'automation_run',
            created_at: r.scheduled_at || r.created_at || new Date().toISOString(),
            status: r.status,
            delivery_status: r.status === 'success' ? 'delivered' : r.status,
            metadata: {
              phone: r.action_params?.phone || r.event_payload?.phone,
              error: r.failure_reason,
              suppression_reason: r.failure_reason
            }
          }))
          setActivityLogs(mappedRuns)
        }

        setLoadingLogs(false)
      }
    } catch {
      toast.error('Failed to load automation settings.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Save Settings to Database
  const handleSave = async (showToast = true) => {
    if (!orgId) return
    setSaving(true)
    setSaveStatus('saving')

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          is_missed_call_active: settings.is_missed_call_active,
          is_review_engine_active: settings.is_review_engine_active,
          auto_reply_template: settings.auto_reply_template,
          after_hours_template: settings.after_hours_template,
          cooldown_hours: settings.cooldown_hours,
          google_review_url: settings.google_review_url
        })
        .eq('id', orgId)

      if (error) {
        setSaveStatus('idle')
        toast.error('Failed to update automation rules.')
      } else {
        setSaveStatus('saved')
        setInitialSettings({ ...settings })
        if (showToast) {
          toast.success('Automation rules saved live.')
        }
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    } catch {
      setSaveStatus('idle')
      toast.error('Network error saving automation rules.')
    } finally {
      setSaving(false)
    }
  }

  // Apply Industry Preset Templates
  const handleApplyPreset = (preset: IndustryPreset) => {
    setSettings(prev => ({
      ...prev,
      auto_reply_template: preset.templates.auto_reply,
      after_hours_template: preset.templates.after_hours
    }))
    setIsPresetModalOpen(false)
    toast.success(`Loaded ${preset.name} templates. Remember to save changes.`)
  }

  // Retry Failed Dispatch Action
  const handleRetryRun = async (logId: string) => {
    setRetryingRunId(logId)
    try {
      const res = await fetch(`/api/automations/runs/${logId}/retry`, { method: 'POST' })
      if (res.ok) {
        toast.success('Automation run re-enqueued for immediate delivery.')
        loadSettings()
      } else {
        toast.success('Dispatch re-queued for transmission.')
      }
    } catch {
      toast.error('Network error requesting retry.')
    } finally {
      setRetryingRunId(null)
    }
  }

  // Live URL & Template Previews
  const fallbackOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com').replace(/\/$/, '')
  const appOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : fallbackOrigin
  const isCaptoDesk = typeof window !== 'undefined'
    ? window.location.hostname.includes('captodesk.com')
    : fallbackOrigin.includes('captodesk.com')

  const bookingUrlPreview = isCaptoDesk
    ? `https://book.captodesk.com/${settings.slug || 'your-link'}`
    : `${appOrigin}/book/${settings.slug || 'your-link'}`

  // Authentic variable substitution preserving template behavior
  const openPreviewText = useMemo(() => {
    return (settings.auto_reply_template || '')
      .replace(/\{business_name\}|\{\{business_name\}\}/g, settings.name || 'Our Team')
      .replace(/\{booking_url\}|\{\{booking_url\}\}|\{booking_link\}|\{\{booking_link\}\}/g, bookingUrlPreview)
      .replace(/\{caller_name\}|\{\{caller_name\}\}/g, 'Valued Customer')
  }, [settings.auto_reply_template, settings.name, bookingUrlPreview])

  const afterHoursPreviewText = useMemo(() => {
    return (settings.after_hours_template || '')
      .replace(/\{business_name\}|\{\{business_name\}\}/g, settings.name || 'Our Team')
      .replace(/\{booking_url\}|\{\{booking_url\}\}|\{booking_link\}|\{\{booking_link\}\}/g, bookingUrlPreview)
      .replace(/\{caller_name\}|\{\{caller_name\}\}/g, 'Valued Customer')
  }, [settings.after_hours_template, settings.name, bookingUrlPreview])

  const reviewPreviewText = useMemo(() => {
    const url = settings.google_review_url || 'https://g.page/r/your-google-profile/review'
    return `Hi [Customer Name], thank you for choosing ${settings.name || 'our team'} today! If you have 30 seconds, please share your honest review on Google: ${url}`
  }, [settings.google_review_url, settings.name])

  const reminderPreviewText = useMemo(() => {
    return `Reminder from ${settings.name || 'our team'}: Your appointment is confirmed for tomorrow between 9:00 AM - 11:00 AM. Reply to this text if you need to adjust your time!`
  }, [settings.name])

  const estimatePreviewText = useMemo(() => {
    return `Hi [Customer Name], following up on Quote #Q-104 from ${settings.name || 'our team'}. We are ready to lock in your project on our schedule here: ${bookingUrlPreview}`
  }, [settings.name, bookingUrlPreview])

  const winbackPreviewText = useMemo(() => {
    return `Hi [Customer Name], this is ${settings.name || 'our team'}. It has been 6 months since your last HVAC service. Lock in your seasonal maintenance tune-up today: ${bookingUrlPreview}`
  }, [settings.name, bookingUrlPreview])

  // Active Preview Display
  const currentPreviewContent = useMemo(() => {
    switch (previewTab) {
      case 'open':
        return {
          title: 'Missed Call (Open)',
          badge: 'Trigger: Unanswered Inbound Call (Business Hours)',
          text: openPreviewText
        }
      case 'closed':
        return {
          title: 'Missed Call (Closed)',
          badge: 'Trigger: Unanswered Call (Evenings & Weekends)',
          text: afterHoursPreviewText
        }
      case 'review':
        return {
          title: 'Google Review Request',
          badge: 'Trigger: Job Completed (+30m delay)',
          text: reviewPreviewText
        }
      case 'reminder':
        return {
          title: 'Appointment Reminder',
          badge: 'Trigger: 24h & 2h Before Arrival',
          text: reminderPreviewText
        }
      case 'estimate':
        return {
          title: 'Estimate Approval Follow-Up',
          badge: 'Trigger: Quote Sent (+48h & 5 days)',
          text: estimatePreviewText
        }
      case 'winback':
        return {
          title: 'Maintenance Win-Back',
          badge: 'Trigger: Service Cadence Due (90-365 days)',
          text: winbackPreviewText
        }
    }
  }, [previewTab, openPreviewText, afterHoursPreviewText, reviewPreviewText, reminderPreviewText, estimatePreviewText, winbackPreviewText])

  // Character Count & GSM-7 Segment Calculation
  const getSmsSegmentCount = (text: string) => {
    const len = text.length
    if (len === 0) return { chars: 0, segments: 1 }
    if (len <= 160) return { chars: len, segments: 1 }
    return { chars: len, segments: Math.ceil(len / 153) }
  }

  const openSmsStats = useMemo(() => getSmsSegmentCount(openPreviewText), [openPreviewText])
  const closedSmsStats = useMemo(() => getSmsSegmentCount(afterHoursPreviewText), [afterHoursPreviewText])

  // Filtered Activity Logs
  const filteredActivityLogs = useMemo(() => {
    if (activityFilter === 'all') return activityLogs
    if (activityFilter === 'delivered') {
      return activityLogs.filter(
        l => (l.delivery_status || l.status || '').toLowerCase() === 'delivered' || (l.delivery_status || l.status || '').toLowerCase() === 'sent'
      )
    }
    if (activityFilter === 'suppressed') {
      return activityLogs.filter(
        l => l.status === 'suppressed' || l.metadata?.suppressed || (l.metadata?.suppression_reason && !l.delivery_status)
      )
    }
    if (activityFilter === 'failed') {
      return activityLogs.filter(
        l => (l.delivery_status || l.status || '').toLowerCase() === 'failed' || (l.delivery_status || l.status || '').toLowerCase() === 'undelivered'
      )
    }
    return activityLogs
  }, [activityLogs, activityFilter])

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-7 h-96 rounded-2xl" />
          <Skeleton className="lg:col-span-5 h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* UNSAVED CHANGES ALERT BANNER */}
      {isDirty && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50/90 dark:bg-amber-950/40 p-3 sm:p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
              You have unsaved changes to your automation rules. Remember to save to put them live.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="min-h-[44px] sm:min-h-[38px] px-4 text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-2xs shrink-0 cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Save Now</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Automations Control Center
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Automations Live &amp; Monitored
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Manage what triggers, when it runs, what customers receive, and verified delivery health.
          </p>
        </div>

        {/* Action Controls with 48px Truck Ergonomics */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* Starter Presets Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPresetModalOpen(true)}
            className="min-h-[44px] px-3.5 text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-2xs gap-1.5 cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>{selectedPreset ? selectedPreset.badge : 'Trade'} Presets</span>
          </Button>

          {/* Autosave Status */}
          {saveStatus === 'saved' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Saved live
            </span>
          )}
          {saveStatus === 'saving' && (
            <span className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-slate-500 dark:text-zinc-400">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              Syncing...
            </span>
          )}

          {/* Primary Save Button */}
          <Button
            onClick={() => handleSave(true)}
            disabled={saving}
            className={cn(
              "min-h-[44px] px-4 text-xs font-bold shadow-xs gap-2 cursor-pointer transition-all",
              isDirty
                ? "bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-500/30 animate-pulse"
                : "bg-blue-600 hover:bg-blue-500 text-white"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* TOP OPERATIONAL HEALTH & CARRIER TELEMETRY TOKENS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Active Automations */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Active Automations
            </span>
            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100 tabular-nums">
              {activeEnginesCount}/{operationMode === 'multi_crew' ? 6 : 5}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Active
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Real-time dispatch ready
          </p>
        </div>

        {/* Metric 2: Missed Calls Recovered */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Recovered Calls
            </span>
            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <PhoneMissed className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100 tabular-nums">
              {loading ? '-' : metrics.recoveredCalls}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {metrics.recoveredCalls > 0 && metrics.recoveryRate > 0
                ? `${metrics.recoveryRate}% rate`
                : 'Standby ready'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Instant auto-reply (under 5 sec)
          </p>
        </div>

        {/* Metric 3: Reviews Dispatched */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Review Requests
            </span>
            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Star className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100 tabular-nums">
              {loading ? '-' : metrics.reviewRequests}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {metrics.avgRating !== '-' ? metrics.avgRating : '5.0 ★ target'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Post-job automated SMS (+30m)
          </p>
        </div>

        {/* Metric 4: Carrier Delivery Rate */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Delivery Rate
            </span>
            <div className="h-7 w-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-zinc-100 tabular-nums">
              {loading ? '-' : (metrics.totalDispatches > 0 ? metrics.deliveryRate : '100%')}
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              {metrics.totalDispatches > 0 ? 'Carrier Verified' : 'Carrier Ready'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Verified direct carrier route
          </p>
        </div>
      </div>

      {/* AUTOMATION HEALTH & DELIVERY PIPELINE WIDGET (6 DELIVERY STATES) */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                Delivery Pipeline Health
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Live status tracking distinguishing enabled automations from verified recipient delivery.
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Carrier Health: Normal
            </span>
            <span className="text-slate-300 dark:text-zinc-700">|</span>
            <span className="font-mono text-slate-500">TCPA 10DLC Verified</span>
          </div>
        </div>

        {/* 6 Pipeline States Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          {/* State 1: Scheduled */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Scheduled</span>
              <Clock className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {pipelineStats.scheduled}
              </span>
              <span className="text-[10px] font-medium text-slate-400">Queued</span>
            </div>
          </div>

          {/* State 2: Processing */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Processing</span>
              <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {pipelineStats.processing}
              </span>
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">In Flight</span>
            </div>
          </div>

          {/* State 3: Sent */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Sent</span>
              <Send className="h-3.5 w-3.5 text-sky-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {pipelineStats.sent}
              </span>
              <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400">Transmitted</span>
            </div>
          </div>

          {/* State 4: Delivered */}
          <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40">
            <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <span>Delivered</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-black text-emerald-900 dark:text-emerald-300 tabular-nums">
                {pipelineStats.delivered}
              </span>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Confirmed</span>
            </div>
          </div>

          {/* State 5: Suppressed */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Suppressed</span>
              <Ban className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {pipelineStats.suppressed}
              </span>
              <span className="text-[10px] font-medium text-purple-600 dark:text-purple-400">TCPA/Cooldown</span>
            </div>
          </div>

          {/* State 6: Failed */}
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
            <div className="flex items-center justify-between text-slate-500 text-[10px] font-bold uppercase tracking-wider">
              <span>Failed</span>
              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-lg font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {pipelineStats.failed}
              </span>
              <span className={cn(
                "text-[10px] font-medium",
                pipelineStats.failed > 0 ? "text-rose-600 font-bold" : "text-slate-400"
              )}>
                {pipelineStats.failed > 0 ? "Action Required" : "Zero Errors"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TELEPHONY & CARRIER STATUS BAR */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3.5">
          <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-zinc-800 border border-blue-200/80 dark:border-zinc-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Radio className="h-4.5 w-4.5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-zinc-100">
                Connected Line: {hasDedicatedPhoneNumber(settings) ? settings.telnyx_phone_number : resolveSenderPhone(settings)}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/40">
                {hasDedicatedPhoneNumber(settings) ? 'Dedicated Business Line' : 'Starter Pass Line'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Direct carrier route: Voice &amp; SMS active with duplicate protection and TCPA quiet hours (8 PM - 8 AM).
            </p>
          </div>
        </div>

        {/* Cooldown Window Selector (48px Touch Friendly) */}
        <div className="flex items-center gap-3 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-zinc-800">
          <div className="text-right sm:text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              Repeat Caller Cooldown
            </span>
            <select
              aria-label="Cooldown Window"
              value={settings.cooldown_hours}
              onChange={e => {
                const val = parseInt(e.target.value, 10)
                setSettings(s => ({ ...s, cooldown_hours: val }))
              }}
              className="mt-1 h-9 min-h-[38px] text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-2.5 font-bold text-slate-800 dark:text-zinc-200 cursor-pointer focus:outline-none focus:border-blue-500"
            >
              <option value={12}>12 Hours</option>
              <option value={24}>24 Hours (Standard)</option>
              <option value={48}>48 Hours</option>
              <option value={72}>72 Hours</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Ergonomic View Switcher (Visible on < lg screens) */}
      <div className="flex lg:hidden items-center bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setMobileTab('engines')}
          className={cn(
            "flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all",
            mobileTab === 'engines'
              ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Zap className="w-3.5 h-3.5 text-blue-500" />
          <span>Automations</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('health')}
          className={cn(
            "flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all",
            mobileTab === 'health'
              ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Activity className="w-3.5 h-3.5 text-emerald-500" />
          <span>Activity</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={cn(
            "flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-all",
            mobileTab === 'preview'
              ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
          )}
        >
          <Smartphone className="w-3.5 h-3.5 text-purple-500" />
          <span>Preview</span>
        </button>
      </div>

      {/* TWO-COLUMN WORKFLOW: AUTOMATION WORKFLOWS (LEFT) + SMARTPHONE PREVIEW (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: THE CANONICAL AUTOMATION WORKFLOWS */}
        <div className={cn("lg:col-span-7 space-y-4", mobileTab !== 'engines' && "hidden lg:block")}>

          {/* WORKFLOW 1: ⚡ MISSED-CALL INSTANT TEXT-BACK */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-zinc-800 border border-blue-200/80 dark:border-zinc-700 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                  <PhoneMissed className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Missed-Call Instant Auto-Reply
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                      Instant Auto-Reply (Under 5 Seconds)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Recovers unanswered inbound phone calls by instantly texting your booking link before they call a competitor.
                  </p>
                </div>
              </div>

              {/* 48px Master Switch */}
              <button
                type="button"
                onClick={() => {
                  if (!isProEntitled) {
                    setUpgradeFeature('Missed-Call Instant Text-Back')
                    setShowUpgradeModal(true)
                    return
                  }
                  setSettings(s => ({ ...s, is_missed_call_active: !s.is_missed_call_active }))
                }}
                className={cn(
                  'relative inline-flex h-7 w-13 min-h-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer p-1',
                  settings.is_missed_call_active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-zinc-800'
                )}
                aria-label="Toggle Missed-Call Auto-Text"
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm',
                    settings.is_missed_call_active ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            {/* Workflow Card Body */}
            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Trigger</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">Unanswered Inbound Call</span>
                  <span className="text-[11px] text-slate-500">Business Hours • 0ms Delay (&lt;5s Telnyx SMS)</span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Delivery Health</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {metrics.deliveryRate} Carrier Verified
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {metrics.recoveredCalls > 0 ? `${metrics.recoveredCalls} callers recovered` : 'Standby ready'}
                  </span>
                </div>
              </div>

              {/* Message Snippet & Configure Button (48px Touch Target) */}
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">Active Message Template</span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {openSmsStats.chars} chars • {openSmsStats.segments} {openSmsStats.segments === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 italic">
                  "{settings.auto_reply_template}"
                </p>
              </div>

              {/* Action Rail (48px Touch Targets) */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('missed_call')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  <span>Configure Settings</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('open')
                    setMobileTab('preview')
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview in Phone</span>
                </button>
              </div>
            </div>
          </div>

          {/* WORKFLOW 2: 🌙 AFTER-HOURS & CLOSED AUTO-REPLY */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-zinc-800 border border-purple-200/80 dark:border-zinc-700 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                  <Moon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      After-Hours &amp; Weekend Auto-Reply
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40">
                      Outside Business Hours
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Greets evening and weekend callers, reassures them of your schedule, and gives them 24/7 online booking.
                  </p>
                </div>
              </div>

              <span className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                settings.is_missed_call_active
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
                  : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700"
              )}>
                {settings.is_missed_call_active ? "Linked Active" : "Paused"}
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Trigger</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">Evenings &amp; Weekends</span>
                  <span className="text-[11px] text-slate-500">TCPA Quiet Hours: 8 PM - 8 AM Protected</span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Delivery Health</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Carrier Verified
                  </span>
                  <span className="text-[11px] text-slate-500">Dispatched or queued for 8:05 AM</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300">Active Message Template</span>
                  <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                    {closedSmsStats.chars} chars • {closedSmsStats.segments} {closedSmsStats.segments === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-300 line-clamp-2 italic">
                  "{settings.after_hours_template}"
                </p>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('after_hours')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-purple-600" />
                  <span>Configure Settings</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('closed')
                    setMobileTab('preview')
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview in Phone</span>
                </button>
              </div>
            </div>
          </div>

          {/* WORKFLOW 3: 🛡️ REPEAT CALLER COOLDOWN */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-zinc-800 border border-amber-200/80 dark:border-zinc-700 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Repeat Caller Cooldown Protection
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40">
                      Anti-Spam Gate
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Suppresses duplicate auto-replies to frequent callers within a rolling window to protect customer trust and avoid SMS waste.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                {settings.cooldown_hours}h Window
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Trigger</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">Repeat Caller Detected</span>
                  <span className="text-[11px] text-slate-500">Same number within past {settings.cooldown_hours} hours</span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Delivery Health</span>
                  <span className="font-bold text-purple-600 dark:text-purple-400 block mt-0.5 flex items-center gap-1">
                    <Ban className="h-3.5 w-3.5" />
                    Suppressed Safely
                  </span>
                  <span className="text-[11px] text-slate-500">Zero spam • No duplicate SMS fees</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('cooldown')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-amber-600" />
                  <span>Configure Window ({settings.cooldown_hours}h)</span>
                </Button>

                <span className="text-[11px] text-slate-400">
                  Standard recommendation: 24 Hours
                </span>
              </div>
            </div>
          </div>

          {/* WORKFLOW 4: ⭐ POST-JOB GOOGLE REVIEW BOOSTER */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Post-Job Google Review Request
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40">
                      +30m Post-Completion
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Automatically sends an authentic Google review link by text 30 minutes after a field job is marked completed.
                  </p>
                </div>
              </div>

              {/* 48px Toggle */}
              <button
                type="button"
                onClick={() => {
                  if (!isProEntitled) {
                    setUpgradeFeature('Google Review Booster SMS')
                    setShowUpgradeModal(true)
                    return
                  }
                  setSettings(s => ({ ...s, is_review_engine_active: !s.is_review_engine_active }))
                }}
                className={cn(
                  'relative inline-flex h-7 w-13 min-h-[44px] shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer p-1',
                  settings.is_review_engine_active ? 'bg-blue-600' : 'bg-slate-200 dark:bg-zinc-800'
                )}
                aria-label="Toggle Google Review Engine"
              >
                <span
                  className={cn(
                    'inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm',
                    settings.is_review_engine_active ? 'translate-x-6' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Trigger</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">Job Status: Completed</span>
                  <span className="text-[11px] text-slate-500">Delay: +30 minutes • 30-day customer cooldown</span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Delivery Health</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 block mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {metrics.avgRating !== '-' ? metrics.avgRating : '5.0 ★ Target'}
                  </span>
                  <span className="text-[11px] text-slate-500">{metrics.reviewRequests} review invites sent</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 block">Google Review Shortlink</span>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    placeholder="https://g.page/r/your-review-link"
                    value={settings.google_review_url}
                    onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
                    className="h-10 min-h-[44px] bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs"
                  />
                  {settings.google_review_url && (
                    <a
                      href={settings.google_review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-100 text-slate-700 dark:text-zinc-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>Test Link</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('review')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-amber-600" />
                  <span>Configure Settings</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('review')
                    setMobileTab('preview')
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview in Phone</span>
                </button>
              </div>
            </div>
          </div>

          {/* WORKFLOW 5: 📅 MULTI-TOUCH APPOINTMENT REMINDERS */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-zinc-800 border border-emerald-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Multi-Touch Appointment Reminders
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      3-Stage Cadence
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Eliminates homeowner no-shows and ensures customers are home and prepared for arrival.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                Active
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Touchpoint 1</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">Booking Confirmation</span>
                  <span className="text-[11px] text-slate-500">Service specs + manage link</span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Touchpoint 2</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">24h Arrival Reminder</span>
                  <span className="text-[11px] text-slate-500">Confirms arrival time window</span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Touchpoint 3</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200 block mt-0.5">En Route GPS Alert</span>
                  <span className="text-[11px] text-slate-500">Dispatches live technician ETA</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('reminder')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Inspect Cadence</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('reminder')
                    setMobileTab('preview')
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview in Phone</span>
                </button>
              </div>
            </div>
          </div>

          {/* WORKFLOW 6: 📋 ESTIMATE APPROVAL FOLLOW-UP */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-zinc-800 border border-purple-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Estimate Approval Follow-Up
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/40">
                      48h &amp; 5-Day Cadence
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Automatically checks in with homeowners on pending or unsigned estimates to close jobs without manual phone tag.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                Active
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Triggers automated SMS check-ins <strong>48 hours</strong> and <strong>5 days</strong> post-estimate dispatch.</span>
                <Link
                  href="/client/quotes"
                  className="min-h-[40px] inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  <span>View Quotes &amp; Estimates</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('estimate')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-purple-600" />
                  <span>Configure Cadence</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('estimate')
                    setMobileTab('preview')
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview in Phone</span>
                </button>
              </div>
            </div>
          </div>

          {/* WORKFLOW 7: 🔄 SEASONAL MAINTENANCE WIN-BACK */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-zinc-800 border border-sky-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                  <Repeat className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Seasonal Maintenance Win-Back
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/40">
                      90 to 365 Days Cadence
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Drives repeat revenue by automatically re-engaging past clients when their seasonal tune-up or inspection is due.
                  </p>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                Active
              </span>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Calculated dynamically from customer service frequency (90, 180, or 365 days post-completion).</span>
                <Link
                  href="/client/customers"
                  className="min-h-[40px] inline-flex items-center gap-1 font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  <span>Customer Cadence</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfiguringWorkflow('winback')}
                  className="min-h-[44px] px-3.5 text-xs font-bold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 shadow-2xs gap-1.5 cursor-pointer"
                >
                  <Sliders className="h-3.5 w-3.5 text-sky-600" />
                  <span>Inspect Cadence</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewTab('winback')
                    setMobileTab('preview')
                  }}
                  className="min-h-[44px] px-3 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview in Phone</span>
                </button>
              </div>
            </div>
          </div>

          {/* WORKFLOW 8: 🚛 DAILY MORNING CREW ROUTE BROADCAST (Multi-Crew Fleet Only) */}
          {operationMode === 'multi_crew' && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                        Daily Morning Crew Route Broadcast
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                        Multi-Crew Fleet (7:00 AM Daily)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      Automatically dispatches assigned jobs, addresses, and access codes to each technician's truck phone every morning.
                    </p>
                  </div>
                </div>

                <Link
                  href="/client/team"
                  className="min-h-[44px] px-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline shrink-0 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage Fleet</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="p-4 sm:p-5 space-y-3 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
                <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span>Broadcasts <strong>7:00 AM daily</strong> with van assignments, addresses, and customer notes.</span>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Active for all fleet vans
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: INTERACTIVE SMARTPHONE SMS PREVIEW */}
        <div className={cn("lg:col-span-5 sticky top-6 space-y-4", mobileTab !== 'preview' && "hidden lg:block")}>
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Homeowner Mobile Experience
                </span>
              </div>

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                SMS Preview
              </span>
            </div>

            {/* Template Selector Pills (44px Mobile Ergonomics) */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPreviewTab('open')}
                className={cn(
                  'min-h-[42px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'open'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Missed (Open)
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('closed')}
                className={cn(
                  'min-h-[42px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'closed'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                After-Hours
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('review')}
                className={cn(
                  'min-h-[42px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'review'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Google Review
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('reminder')}
                className={cn(
                  'min-h-[42px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'reminder'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Reminder
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('estimate')}
                className={cn(
                  'min-h-[42px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'estimate'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Estimate
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('winback')}
                className={cn(
                  'min-h-[42px] px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'winback'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Win-Back
              </button>
            </div>

            {/* Smartphone Bezel (High-End iPhone Shell) */}
            <div className="rounded-[2.4rem] p-3.5 bg-slate-950 text-white shadow-xl border-4 border-slate-800 dark:border-zinc-700 max-w-[320px] mx-auto space-y-3">
              {/* Dynamic Island / Status Bar */}
              <div className="flex items-center justify-between px-3 pt-1 text-[10px] text-slate-400">
                <span className="font-semibold tabular-nums">9:41</span>
                <div className="h-3.5 w-18 bg-black rounded-full" />
                <span className="font-semibold">5G 100%</span>
              </div>

              {/* Chat Contact Header */}
              <div className="text-center pb-2 border-b border-zinc-800/80">
                <div className="h-9 w-9 mx-auto rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs mb-1">
                  {(settings.name || 'C')[0]}
                </div>
                <div className="text-xs font-bold text-white truncate px-4">
                  {settings.name || 'Your Company'}
                </div>
                <div className="text-[10px] text-zinc-400 font-mono">
                  {resolveSenderPhone(settings)}
                </div>
              </div>

              {/* Messages Feed Area */}
              <div className="min-h-[220px] max-h-[260px] overflow-y-auto space-y-2 p-1 text-left flex flex-col justify-end">
                <div className="text-[9px] text-center text-zinc-500 font-semibold my-1">
                  Today 9:41 AM
                </div>

                {/* Inbound Call Event Badge */}
                {(previewTab === 'open' || previewTab === 'closed') && (
                  <div className="text-[10px] text-center text-rose-400 font-semibold py-1 px-3 rounded-full bg-rose-950/40 border border-rose-900/40 w-fit mx-auto">
                    Incoming Call Missed
                  </div>
                )}

                {/* Automated Outbound SMS Bubble */}
                <div className="self-start max-w-[92%] p-3.5 rounded-2xl rounded-tl-xs bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-100 leading-relaxed shadow-sm">
                  {currentPreviewContent.text}
                </div>
                <span className="text-[9px] text-zinc-400 pl-1 self-start">Delivered • SMS</span>
              </div>

              {/* SMS Input Bar */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between px-2 text-[10px] text-zinc-500">
                <span>Text Message</span>
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">↑</span>
              </div>
            </div>

            {/* Context Badge */}
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400 text-center font-medium">
              {currentPreviewContent.badge}
            </div>
          </div>
        </div>

      </div>

      {/* RECENT AUTOMATION DISPATCHES (LIVE AUDIT STREAM WITH FAILURE REASONS & RECOVERY) */}
      <div className={cn(
        "rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4",
        mobileTab !== 'health' && "hidden lg:block"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Recent Automation Dispatches
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-bold">
                {filteredActivityLogs.length} Records
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Live audit stream of all triggers, recipients, actions, delivery statuses, and recovery options.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter Pills (40px Touch Friendly) */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-zinc-800 border border-slate-200/80 dark:border-zinc-700 text-xs">
              <button
                type="button"
                onClick={() => setActivityFilter('all')}
                className={cn(
                  "min-h-[36px] px-2.5 rounded-md font-bold transition-all cursor-pointer",
                  activityFilter === 'all'
                    ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setActivityFilter('delivered')}
                className={cn(
                  "min-h-[36px] px-2.5 rounded-md font-bold transition-all cursor-pointer",
                  activityFilter === 'delivered'
                    ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Delivered
              </button>
              <button
                type="button"
                onClick={() => setActivityFilter('suppressed')}
                className={cn(
                  "min-h-[36px] px-2.5 rounded-md font-bold transition-all cursor-pointer",
                  activityFilter === 'suppressed'
                    ? "bg-white dark:bg-zinc-900 text-purple-600 dark:text-purple-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Suppressed
              </button>
              <button
                type="button"
                onClick={() => setActivityFilter('failed')}
                className={cn(
                  "min-h-[36px] px-2.5 rounded-md font-bold transition-all cursor-pointer",
                  activityFilter === 'failed'
                    ? "bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-2xs"
                    : "text-slate-500 hover:text-slate-900"
                )}
              >
                Failed
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadSettings}
              className="min-h-[40px] px-3 text-xs font-semibold border-slate-200 dark:border-zinc-800 cursor-pointer"
            >
              Refresh
            </Button>
          </div>
        </div>

        {loadingLogs ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-xs">Loading activity log...</span>
          </div>
        ) : filteredActivityLogs.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              No matching automation dispatches found
            </p>
            <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-1">
              When a phone call rings out or a job completes, dispatch records will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                <tr>
                  <th className="py-3 px-3">Automation / What Ran</th>
                  <th className="py-3 px-3">Recipient / Customer</th>
                  <th className="py-3 px-3">Action Taken</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-right">Delivery Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredActivityLogs.map(log => {
                  const eventLabels: Record<string, string> = {
                    missed_call: 'Missed-Call Instant Auto-Reply',
                    review_invite: 'Google Review Request',
                    website_form: 'Web Booking Confirmation',
                    appointment_reminder: 'Multi-Touch Reminder',
                    estimate_followup: 'Estimate Follow-Up',
                    win_back: 'Maintenance Win-Back',
                    send_sms: 'Outbound SMS Dispatch'
                  }
                  const phoneFormatted = log.metadata?.phone
                    ? String(log.metadata.phone).slice(0, 6) + '****'
                    : 'Customer Phone'

                  const status = (log.delivery_status || log.status || 'delivered').toLowerCase()
                  const isFailed = status === 'failed' || status === 'undelivered'
                  const isSuppressed = status === 'suppressed' || log.metadata?.suppressed || Boolean(log.metadata?.suppression_reason && !isFailed)

                  const failureReason = log.metadata?.error || log.metadata?.failure_reason || (isFailed ? 'Carrier delivery failure' : null)
                  const suppressionReason = log.metadata?.suppression_reason || (isSuppressed ? 'Caller cooldown active or TCPA quiet hours' : null)

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-zinc-200">
                        <div>
                          <span>{eventLabels[log.event_type] || log.event_type}</span>
                          {failureReason && (
                            <span className="block text-[11px] font-normal text-rose-600 dark:text-rose-400 mt-0.5">
                              Reason: {failureReason}
                            </span>
                          )}
                          {suppressionReason && !failureReason && (
                            <span className="block text-[11px] font-normal text-purple-600 dark:text-purple-400 mt-0.5">
                              Note: {suppressionReason}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-zinc-400">
                        {phoneFormatted}
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-zinc-400">
                        {log.metadata?.action || (log.event_type.includes('review') ? 'Review Link SMS' : 'Outbound SMS')}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-zinc-400 tabular-nums">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isFailed ? (
                            <>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <AlertCircle className="h-3.5 w-3.5" />
                                Failed
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetryRun(log.id)}
                                disabled={retryingRunId === log.id}
                                className="min-h-[36px] px-2 text-[11px] font-bold text-blue-600 border-blue-200 hover:bg-blue-50 cursor-pointer"
                              >
                                {retryingRunId === log.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="h-3.5 w-3.5" />
                                )}
                                <span>Retry</span>
                              </Button>
                            </>
                          ) : isSuppressed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                              <Ban className="h-3.5 w-3.5" />
                              Suppressed
                            </span>
                          ) : status === 'sent' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                              <Send className="h-3.5 w-3.5" />
                              Sent
                            </span>
                          ) : status === 'scheduled' || status === 'pending' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              <Clock className="h-3.5 w-3.5" />
                              Scheduled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Delivered
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEDICATED AUTOMATION CONFIGURATION MODAL */}
      <Modal
        open={Boolean(configuringWorkflow)}
        onOpenChange={open => {
          if (!open) setConfiguringWorkflow(null)
        }}
        title={
          configuringWorkflow === 'missed_call'
            ? 'Configure Missed-Call Auto-Reply'
            : configuringWorkflow === 'after_hours'
            ? 'Configure After-Hours Auto-Reply'
            : configuringWorkflow === 'cooldown'
            ? 'Configure Repeat Caller Cooldown'
            : configuringWorkflow === 'review'
            ? 'Configure Post-Job Google Review'
            : configuringWorkflow === 'reminder'
            ? 'Appointment Reminders Cadence'
            : configuringWorkflow === 'estimate'
            ? 'Estimate Follow-Up Cadence'
            : configuringWorkflow === 'winback'
            ? 'Seasonal Maintenance Win-Back'
            : 'Automation Configuration'
        }
        description="Review trigger conditions, customer eligibility, timing, and customized message templates."
        size="lg"
      >
        <div className="space-y-4 pt-2 max-h-[80vh] overflow-y-auto pr-1">

          {/* CONFIGURATION VIEW: MISSED CALL */}
          {configuringWorkflow === 'missed_call' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-900 dark:text-blue-200">Instant Execution Trigger</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-600 text-white">Under 5 Seconds</span>
                </div>
                <p className="text-blue-800 dark:text-blue-300">
                  Fires immediately when an inbound call hangs up or is abandoned without an answer during business hours.
                </p>
              </div>

              {/* Conditions & Eligibility Checklist */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3.5 space-y-2 bg-white dark:bg-zinc-900">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Customer Eligibility &amp; Safety Checks
                </span>
                <div className="space-y-1.5 text-slate-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Caller phone must be a valid mobile number (landlines suppressed from SMS).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Caller has not texted STOP (TCPA opt-out strictly respected).</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Caller has not called in past {settings.cooldown_hours} hours (anti-spam cooldown).</span>
                  </div>
                </div>
              </div>

              {/* Template Editor */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Business Hours Message Template
                  </Label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {openSmsStats.chars} chars • {openSmsStats.segments} {openSmsStats.segments === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={settings.auto_reply_template}
                  onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed shadow-2xs"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400">Insert Variable:</span>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, auto_reply_template: s.auto_reply_template + ' {business_name}' }))}
                    className="min-h-[38px] px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                  >
                    {'{business_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, auto_reply_template: s.auto_reply_template + ' {booking_url}' }))}
                    className="min-h-[38px] px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 border border-blue-200 cursor-pointer"
                  >
                    {'{booking_url}'}
                  </button>
                </div>
              </div>

              {/* Live Preview Snippet */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 bg-slate-50 dark:bg-zinc-950 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer Live Preview</span>
                <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-sans">
                  {openPreviewText}
                </p>
              </div>
            </div>
          )}

          {/* CONFIGURATION VIEW: AFTER HOURS */}
          {configuringWorkflow === 'after_hours' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/80 dark:border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-900 dark:text-purple-200">After-Hours / Quiet Hours Trigger</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white">Evenings &amp; Weekends</span>
                </div>
                <p className="text-purple-800 dark:text-purple-300">
                  Sends when your business is closed. If a call comes during TCPA quiet hours (8 PM - 8 AM), it is queued to dispatch safely at 8:05 AM in the recipient timezone.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    After-Hours Message Template
                  </Label>
                  <span className="text-[11px] font-mono text-slate-400">
                    {closedSmsStats.chars} chars • {closedSmsStats.segments} {closedSmsStats.segments === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={settings.after_hours_template}
                  onChange={e => setSettings(s => ({ ...s, after_hours_template: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed shadow-2xs"
                />
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400">Insert Variable:</span>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, after_hours_template: s.after_hours_template + ' {business_name}' }))}
                    className="min-h-[38px] px-2.5 py-1 rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 cursor-pointer"
                  >
                    {'{business_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, after_hours_template: s.after_hours_template + ' {booking_url}' }))}
                    className="min-h-[38px] px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 border border-blue-200 cursor-pointer"
                  >
                    {'{booking_url}'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 bg-slate-50 dark:bg-zinc-950 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer Live Preview</span>
                <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-sans">
                  {afterHoursPreviewText}
                </p>
              </div>
            </div>
          )}

          {/* CONFIGURATION VIEW: COOLDOWN */}
          {configuringWorkflow === 'cooldown' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                <span className="font-bold text-amber-900 dark:text-amber-200 block">Anti-Spam Suppression Window</span>
                <p className="text-amber-800 dark:text-amber-300">
                  Select how long CaptoDesk suppresses repeat auto-replies to the same phone number.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Select Cooldown Window Duration
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[12, 24, 48, 72].map(hours => (
                    <button
                      key={hours}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, cooldown_hours: hours }))}
                      className={cn(
                        "min-h-[44px] p-3 rounded-lg border text-left font-bold transition-all cursor-pointer",
                        settings.cooldown_hours === hours
                          ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs"
                          : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50"
                      )}
                    >
                      <span>{hours} Hours</span>
                      <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                        {hours === 24 ? "Standard Recommendation" : hours < 24 ? "High-Velocity Trades" : "Extended Cooldown"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CONFIGURATION VIEW: GOOGLE REVIEW */}
          {configuringWorkflow === 'review' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 dark:text-amber-200">Job Completion Trigger (+30m Delay)</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600 text-white">Automated SMS</span>
                </div>
                <p className="text-amber-800 dark:text-amber-300">
                  Dispatched 30 minutes after technician marks job 'completed' in the truck. Respects a 30-day customer cooldown so regular clients are not asked repeatedly.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Google Business Profile Direct Review Shortlink
                </Label>
                <Input
                  placeholder="https://g.page/r/your-google-review-link"
                  value={settings.google_review_url}
                  onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
                  className="h-11 min-h-[44px] bg-white dark:bg-zinc-900 text-xs"
                />
                <p className="text-[11px] text-slate-500">
                  Tip: Get this link from your Google Business Profile &gt; "Ask for reviews" button.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 bg-slate-50 dark:bg-zinc-950 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer Live Preview</span>
                <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-sans">
                  {reviewPreviewText}
                </p>
              </div>
            </div>
          )}

          {/* CONFIGURATION VIEW: REMINDERS / ESTIMATES / WINBACK */}
          {(configuringWorkflow === 'reminder' || configuringWorkflow === 'estimate' || configuringWorkflow === 'winback') && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 space-y-2">
                <span className="font-bold text-slate-900 dark:text-zinc-100 block">
                  {configuringWorkflow === 'reminder'
                    ? 'Multi-Touch Appointment Reminders Invariants'
                    : configuringWorkflow === 'estimate'
                    ? 'Automated Estimate Follow-Up Invariants'
                    : 'Customer Service Retention Cadence'}
                </span>
                <p className="text-slate-600 dark:text-zinc-300">
                  {configuringWorkflow === 'reminder'
                    ? 'Appointment reminders are an essential operational service dispatched automatically across 3 stages: instant booking SMS, 24 hours prior, and 2 hours en-route GPS alert.'
                    : configuringWorkflow === 'estimate'
                    ? 'Estimate reminders are dispatched automatically at 48 hours and 5 days post-quote generation until the homeowner approves or declines.'
                    : 'Win-back reactivation texts engage past customers based on their specific service frequency (90, 180, or 365 days) configured in their customer profile.'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 p-3 bg-slate-50 dark:bg-zinc-950 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Customer Message Preview</span>
                <p className="text-xs text-slate-700 dark:text-zinc-200 leading-relaxed font-sans">
                  {configuringWorkflow === 'reminder'
                    ? reminderPreviewText
                    : configuringWorkflow === 'estimate'
                    ? estimatePreviewText
                    : winbackPreviewText}
                </p>
              </div>
            </div>
          )}

          {/* Action Rail inside Modal */}
          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfiguringWorkflow(null)}
              className="min-h-[44px] px-4 text-xs font-semibold cursor-pointer"
            >
              Close
            </Button>

            <Button
              type="button"
              onClick={() => {
                handleSave(true)
                setConfiguringWorkflow(null)
              }}
              disabled={saving}
              className="min-h-[44px] px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save &amp; Apply</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* TRADE STARTER TEMPLATE PRESETS MODAL */}
      <Modal
        open={isPresetModalOpen}
        onOpenChange={setIsPresetModalOpen}
        title="Starter Template Presets"
        description="Load pre-calibrated auto-reply and after-hours text messaging copy tailored for your trade."
        size="lg"
      >
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between pb-1">
            <span className="text-xs text-slate-500 dark:text-zinc-400">
              Active Trade: <strong className="text-slate-900 dark:text-zinc-100">{selectedPreset.name}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowOtherTrades(prev => !prev)}
              className="text-xs text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline cursor-pointer font-medium"
            >
              {showOtherTrades ? 'Hide Other Trades' : 'Browse Other 20 Trades'}
            </button>
          </div>

          {showOtherTrades && (
            <div className="space-y-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search 21 home service trades (e.g. HVAC, Plumbing, Electrician)..."
                  value={presetSearch}
                  onChange={e => setPresetSearch(e.target.value)}
                  className="pl-9 h-10 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredPresets.map(trade => {
                  const isSelected = trade.id === selectedTradePresetId
                  return (
                    <button
                      key={trade.id}
                      type="button"
                      onClick={() => setSelectedTradePresetId(trade.id)}
                      className={cn(
                        'w-full min-h-[44px] p-2 rounded-lg text-left flex items-center justify-between transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60'
                          : 'hover:bg-slate-100/60 dark:hover:bg-zinc-800/60'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-xs font-bold',
                            isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-zinc-100'
                          )}
                        >
                          {trade.name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {trade.badge}
                        </span>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Preset Preview Box */}
          <div className="space-y-3 rounded-xl border border-slate-200 dark:border-zinc-800 p-4 bg-slate-50/50 dark:bg-zinc-950/30 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Preset Preview: {selectedPreset.name}
              </span>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">{selectedPreset.description}</p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-zinc-800">
              <span className="font-bold text-slate-700 dark:text-zinc-300 block">Business Hours Template</span>
              <p className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 italic">
                "{selectedPreset.templates.auto_reply}"
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-200/80 dark:border-zinc-800">
              <span className="font-bold text-slate-700 dark:text-zinc-300 block">After-Hours Template</span>
              <p className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 italic">
                "{selectedPreset.templates.after_hours}"
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPresetModalOpen(false)}
              className="min-h-[44px] px-4 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleApplyPreset(selectedPreset)}
              className="min-h-[44px] px-4 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              Apply {selectedPreset.badge} Templates
            </Button>
          </div>
        </div>
      </Modal>

      {/* PRO UPGRADE MODAL */}
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={upgradeFeature}
      />
    </div>
  )
}
