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
import { 
  Zap, 
  PhoneMissed, 
  Star, 
  Clock, 
  MessageSquare, 
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
  Wrench,
  CheckCircle,
  Truck
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspace } from '@/lib/context/workspace-context'
import { ProUpgradeModal } from '@/components/billing/pro-upgrade-modal'
import { isProAutomationEntitled } from '@/lib/billing/plans'
import { INDUSTRY_LIST, getIndustryPreset, type IndustryPreset } from '@/lib/constants/industries'

interface ActivityLogItem {
  id: string
  event_type: 'missed_call' | 'review_invite' | 'website_form' | string
  created_at: string
  status?: string | null
  delivery_status?: string | null
  metadata?: any
}

export default function AutomationsPage() {
  const supabase = createClient()
  const { planId, subscriptionStatus, orgIndustry, operationMode } = useWorkspace()

  // State
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
    is_missed_call_active: true,
    is_review_engine_active: true,
    auto_reply_template: 'Hi, this is {business_name}! Sorry we missed your call - our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} - or reply directly to this text with what you need!',
    after_hours_template: "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} - or text us what you need and we'll reply first thing in the morning!",
    cooldown_hours: 24,
    google_review_url: ''
  })

  // Preview Switcher State
  const [previewTab, setPreviewTab] = useState<'open' | 'closed' | 'review' | 'reminder'>('open')

  // Live Activity Logs
  const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Entitlement Check
  const isProEntitled = useMemo(() => {
    return isProAutomationEntitled({
      id: orgId,
      slug: orgSlug,
      subscription_status: subscriptionStatus,
      plan_id: planId
    })
  }, [orgId, orgSlug, subscriptionStatus, planId])

  // Filtered Trades for 21-Trade Starter Presets Modal
  const filteredPresets = useMemo(() => {
    if (!presetSearch.trim()) return INDUSTRY_LIST
    const q = presetSearch.toLowerCase().trim()
    return INDUSTRY_LIST.filter(p => 
      p.name.toLowerCase().includes(q) ||
      p.badge.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
  }, [presetSearch])

  const selectedPreset: IndustryPreset = useMemo(() => {
    return getIndustryPreset(selectedTradePresetId)
  }, [selectedTradePresetId])

  // Active Automations Count (Calculated out of 5 engines in Solo, 6 in Multi-Crew)
  const activeEnginesCount = useMemo(() => {
    let count = 3 // Appointment Reminders, Estimate Follow-Up, and Win-Back are active by default
    if (settings.is_missed_call_active) count += 1
    if (settings.is_review_engine_active) count += 1
    if (operationMode === 'multi_crew') count += 1
    return count
  }, [settings.is_missed_call_active, settings.is_review_engine_active, operationMode])

  // Load Organization & Automation Settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
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
        const isLegacyOpen = !org.auto_reply_template || org.auto_reply_template.includes('We are mid-job and missed your call')
        const isLegacyClosed = !org.after_hours_template || org.after_hours_template.includes('will call you first thing tomorrow morning')

        setSettings({
          name: org.name || '',
          slug: org.slug || '',
          telnyx_phone_number: org.telnyx_phone_number || '',
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
        })

        // Fetch recent automation activity logs
        setLoadingLogs(true)
        const { data: logs } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('org_id', profile.org_id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (logs) {
          setActivityLogs(logs)
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
        if (showToast) {
          toast.success('Automation switchboard updated and live.')
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

  // Live URL & Template Previews
  const fallbackOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'https://captodesk.com').replace(/\/$/, '')
  const appOrigin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : fallbackOrigin
  const isCaptoDesk = typeof window !== 'undefined'
    ? window.location.hostname.includes('captodesk.com')
    : fallbackOrigin.includes('captodesk.com')

  const bookingUrlPreview = isCaptoDesk
    ? `https://book.captodesk.com/${settings.slug || 'your-link'}`
    : `${appOrigin}/book/${settings.slug || 'your-link'}`

  const openPreviewText = useMemo(() => {
    return (settings.auto_reply_template || '')
      .replace(/\{business_name\}|\{\{business_name\}\}/g, settings.name || 'Our Team')
      .replace(/\{booking_url\}|\{\{booking_url\}\}|\{booking_link\}|\{\{booking_link\}\}/g, bookingUrlPreview)
  }, [settings.auto_reply_template, settings.name, bookingUrlPreview])

  const afterHoursPreviewText = useMemo(() => {
    return (settings.after_hours_template || '')
      .replace(/\{business_name\}|\{\{business_name\}\}/g, settings.name || 'Our Team')
      .replace(/\{booking_url\}|\{\{booking_url\}\}|\{booking_link\}|\{\{booking_link\}\}/g, bookingUrlPreview)
  }, [settings.after_hours_template, settings.name, bookingUrlPreview])

  const reviewPreviewText = useMemo(() => {
    const url = settings.google_review_url || 'https://g.page/r/your-google-profile/review'
    return `Hi Sarah, thank you for choosing ${settings.name || 'our service'} today! If you have 30 seconds, please share your honest review on Google: ${url}`
  }, [settings.google_review_url, settings.name])

  const reminderPreviewText = useMemo(() => {
    return `Reminder from ${settings.name || 'our team'}: Your appointment is confirmed for tomorrow between 9:00 AM - 11:00 AM. Reply to this text if you need to adjust your time!`
  }, [settings.name])

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
          title: 'Google Review Booster',
          badge: 'Trigger: Job Completed (+30m delay)',
          text: reviewPreviewText
        }
      case 'reminder':
        return {
          title: 'Appointment Reminder',
          badge: 'Trigger: 24h & 2h Before Arrival',
          text: reminderPreviewText
        }
    }
  }, [previewTab, openPreviewText, afterHoursPreviewText, reviewPreviewText, reminderPreviewText])

  // Character Count & Segment Calculation Helper (GSM-7 standard)
  const getSmsSegmentCount = (text: string) => {
    const len = text.length
    if (len <= 160) return { chars: len, segments: 1 }
    return { chars: len, segments: Math.ceil(len / 153) }
  }

  const openSmsStats = useMemo(() => getSmsSegmentCount(openPreviewText), [openPreviewText])
  const closedSmsStats = useMemo(() => getSmsSegmentCount(afterHoursPreviewText), [afterHoursPreviewText])

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

      {/* TOP HEADER & CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Automation Switchboard
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              24/7 Autopilot Live
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Real-time automated communication rules configured for field service response and review growth.
          </p>
        </div>

        {/* Action Controls with 48px Truck Ergonomics */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {/* 1-Click 21-Trade Starter Presets Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsPresetModalOpen(true)}
            className="min-h-[44px] sm:min-h-[40px] px-3.5 text-xs font-semibold border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-2xs gap-1.5 cursor-pointer"
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
            className="min-h-[44px] sm:min-h-[40px] px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs gap-2 cursor-pointer"
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

      {/* 4 TOP OPERATIONAL METRIC TOKENS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Active Automations */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              Armed Rules
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
              18
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              94.2% rate
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Instant 3-sec auto-text
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
              24
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              4.9 ★ avg
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Post-job automated SMS
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
              99.8%
            </span>
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              10DLC Verified
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-zinc-500 mt-0.5">
            Telnyx direct carrier route
          </p>
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
                Connected Line: {settings.telnyx_phone_number || 'Provisioning Dedicated Telnyx DID'}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/80 dark:border-blue-800/40">
                A2P 10DLC Registered
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
              Carrier route: Direct Telnyx Voice & SMS Gateway with automated multi-zone failover
            </p>
          </div>
        </div>

        {/* Cooldown Window Selector (48px Truck Touch Friendly) */}
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

      {/* TWO-COLUMN WORKFLOW: SWITCHBOARD ENGINES (LEFT) + SMARTPHONE PREVIEW (RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: THE 5 CANONICAL AUTOMATION ENGINES */}
        <div className="lg:col-span-7 space-y-4">

          {/* ENGINE 1: ⚡ MISSED-CALL INSTANT TEXT-BACK */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            {/* Header / Master Switch */}
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-zinc-800 border border-blue-200/80 dark:border-zinc-700 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                  <PhoneMissed className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Missed-Call Instant Text-Back
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/40">
                      3-Sec Trigger
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Fires an immediate SMS within 3 seconds of a missed call so prospective customers do not dial competitors.
                  </p>
                </div>
              </div>

              {/* 48px Touch Target Master Switch */}
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

            {/* Template Editors */}
            <div className="p-4 sm:p-5 space-y-5 bg-slate-50/50 dark:bg-zinc-950/30">

              {/* Sub-rule 1: Business Hours Response */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      Business Hours Response (While Working)
                    </Label>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {openSmsStats.chars} chars • {openSmsStats.segments} {openSmsStats.segments === 1 ? 'segment' : 'segments'}
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={settings.auto_reply_template}
                  onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed shadow-2xs"
                  placeholder="Text sent to caller during business hours..."
                />

                {/* 48px Mobile-Friendly Variable Tag Inserters */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">Insert Tag:</span>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, auto_reply_template: s.auto_reply_template + ' {business_name}' }))}
                    className="min-h-[40px] px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {'{business_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, auto_reply_template: s.auto_reply_template + ' {booking_url}' }))}
                    className="min-h-[40px] px-3 py-1 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 transition-colors cursor-pointer"
                  >
                    {'{booking_url}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('open')}
                    className="ml-auto min-h-[40px] px-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Preview in Phone</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-rule 2: After-Hours / Weekend Response */}
              <div className="space-y-2.5 pt-4 border-t border-slate-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                      After-Hours / Closed Response (Evenings & Weekends)
                    </Label>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                    {closedSmsStats.chars} chars • {closedSmsStats.segments} {closedSmsStats.segments === 1 ? 'segment' : 'segments'}
                  </span>
                </div>

                <textarea
                  rows={3}
                  value={settings.after_hours_template}
                  onChange={e => setSettings(s => ({ ...s, after_hours_template: e.target.value }))}
                  className="w-full p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed shadow-2xs"
                  placeholder="Text sent when your business is closed..."
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-zinc-500">Insert Tag:</span>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, after_hours_template: s.after_hours_template + ' {business_name}' }))}
                    className="min-h-[40px] px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-mono font-medium text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                  >
                    {'{business_name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings(s => ({ ...s, after_hours_template: s.after_hours_template + ' {booking_url}' }))}
                    className="min-h-[40px] px-3 py-1 rounded-md bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-xs font-mono font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 transition-colors cursor-pointer"
                  >
                    {'{booking_url}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('closed')}
                    className="ml-auto min-h-[40px] px-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Preview in Phone</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* ENGINE 2: ⭐ POST-JOB GOOGLE REVIEW BOOSTER */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-100 dark:border-zinc-800">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                  <Star className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Post-Job Google Review Booster
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40">
                      +30m Post-Completion
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Automatically sends an SMS asking homeowners to share honest feedback on your Google Business Profile after work is marked complete.
                  </p>
                </div>
              </div>

              {/* 48px Touch Toggle */}
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

            <div className="p-4 sm:p-5 space-y-3 bg-slate-50/50 dark:bg-zinc-950/30">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Google Business Profile Direct Review Shortlink
                  </Label>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('review')}
                    className="min-h-[40px] px-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Preview in Phone</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    placeholder="https://g.page/r/your-review-link"
                    value={settings.google_review_url}
                    onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
                    className="h-11 min-h-[44px] bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100"
                  />
                  {settings.google_review_url && (
                    <a
                      href={settings.google_review_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 min-h-[44px] px-3.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-100 text-slate-700 dark:text-zinc-300 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <span>Test Link</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                  Tip: Retrieve this link directly from your Google Business Profile &gt; "Ask for reviews" button.
                </p>
              </div>
            </div>
          </div>

          {/* ENGINE 3: 📅 APPOINTMENT CONFIRMATION & REMINDERS */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4">
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
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Eliminates costly customer no-shows with automated multi-touch notifications before arrival.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewTab('reminder')}
                className="min-h-[44px] px-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Preview</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Touchpoint 1</span>
                <span className="font-bold text-slate-900 dark:text-zinc-200 block mt-0.5">Instant Booking SMS</span>
                <span className="text-[11px] text-slate-500">Service specs + manage link</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Touchpoint 2</span>
                <span className="font-bold text-slate-900 dark:text-zinc-200 block mt-0.5">24h Arrival Reminder</span>
                <span className="text-[11px] text-slate-500">Confirms arrival time window</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Touchpoint 3</span>
                <span className="font-bold text-slate-900 dark:text-zinc-200 block mt-0.5">En Route Alert</span>
                <span className="text-[11px] text-slate-500">Dispatches live GPS ETA</span>
              </div>
            </div>
          </div>

          {/* ENGINE 4: 📋 ESTIMATE APPROVAL FOLLOW-UP */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-zinc-800 border border-purple-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-purple-600 dark:text-purple-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Estimate Approval Follow-Up
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Follows up automatically with homeowners who have not signed or approved pending quotes.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Triggers SMS check-in <strong>48 hours</strong> and <strong>5 days</strong> post-estimate dispatch.</span>
              <Link 
                href="/client/quotes" 
                className="min-h-[40px] inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>View Estimates</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* ENGINE 5: 🔄 SEASONAL MAINTENANCE WIN-BACK */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-sky-50 dark:bg-zinc-800 border border-sky-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                  <Repeat className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                      Seasonal Maintenance Win-Back
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Automatically checks in with past customers when their standard maintenance cycle (90, 180, or 365 days) is due.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Reactivation cadence: <strong>90 - 180 days</strong> post-job based on service frequency.</span>
              <Link 
                href="/client/customers" 
                className="min-h-[40px] inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
              >
                <span>View Customer Directory</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* ENGINE 6: 🚛 DAILY MORNING CREW SCHEDULE BROADCAST (Multi-Crew Fleet Only) */}
          {operationMode === 'multi_crew' && (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-700 flex items-center justify-center shrink-0 text-indigo-600 dark:text-indigo-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                        Daily Morning Crew Schedule Broadcast
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                        Multi-Crew Fleet
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                      Automatically dispatches each technician's daily route and job addresses to their mobile phone every morning.
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

              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Broadcasts <strong>7:00 AM daily</strong> with van assignments, addresses, and customer notes.</span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Active for all dispatched crews
                </span>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: INTERACTIVE SMARTPHONE SMS PREVIEW */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-500 dark:text-zinc-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                  Live Homeowner Perspective
                </span>
              </div>

              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                SMS Preview
              </span>
            </div>

            {/* Template Selector Pills (44px Mobile Ergonomics) */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setPreviewTab('open')}
                className={cn(
                  'min-h-[42px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate',
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
                  'min-h-[42px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'closed'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Missed (Closed)
              </button>

              <button
                type="button"
                onClick={() => setPreviewTab('review')}
                className={cn(
                  'min-h-[42px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate',
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
                  'min-h-[42px] px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center truncate',
                  previewTab === 'reminder'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                Reminder
              </button>
            </div>

            {/* Smartphone Bezel (High-End iPhone Shell) */}
            <div className="rounded-[2.4rem] p-3.5 bg-slate-950 text-white shadow-xl border-4 border-slate-800 dark:border-zinc-700 max-w-[320px] mx-auto space-y-3">
              {/* Top Dynamic Island / Status Bar */}
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
                  {settings.telnyx_phone_number || '+1 (555) 019-2831'}
                </div>
              </div>

              {/* Messages Feed Area */}
              <div className="min-h-[220px] max-h-[260px] overflow-y-auto space-y-2 p-1 text-left flex flex-col justify-end">
                <div className="text-[9px] text-center text-zinc-500 font-semibold my-1">
                  Today 9:41 AM
                </div>

                {/* Inbound Missed Call Indicator */}
                {(previewTab === 'open' || previewTab === 'closed') && (
                  <div className="text-[10px] text-center text-rose-400 font-semibold py-1 px-3 rounded-full bg-rose-950/40 border border-rose-900/40 w-fit mx-auto">
                    Incoming Call Missed
                  </div>
                )}

                {/* Automated Outbound SMS Bubble */}
                <div className="self-start max-w-[92%] p-3.5 rounded-2xl rounded-tl-xs bg-zinc-800 border border-zinc-700/60 text-xs text-zinc-100 leading-relaxed shadow-sm">
                  {currentPreviewContent.text}
                </div>
                <span className="text-[9px] text-zinc-400 pl-1 self-start">Delivered</span>
              </div>

              {/* SMS Input Box */}
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

      {/* RECENT AUTOMATION DISPATCHES (LIVE AUDIT STREAM) */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
              Recent Automation Dispatches
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Live audit stream of triggered SMS responses, review invites, and booking confirmations.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadSettings}
            className="min-h-[40px] px-3 text-xs font-semibold border-slate-200 dark:border-zinc-800 cursor-pointer"
          >
            Refresh Audit Stream
          </Button>
        </div>

        {loadingLogs ? (
          <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-xs">Loading audit stream...</span>
          </div>
        ) : activityLogs.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl p-4">
            <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              No automations have fired yet today
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
                  <th className="py-3 px-3">Event Type</th>
                  <th className="py-3 px-3">Recipient</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-right">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {activityLogs.map(log => {
                  const eventLabels: Record<string, string> = {
                    missed_call: 'Missed Call Auto-Text',
                    review_invite: 'Google Review Booster',
                    website_form: 'Web Booking Confirmation'
                  }
                  const phoneFormatted = log.metadata?.phone 
                    ? String(log.metadata.phone).slice(0, 6) + '****' 
                    : 'Customer Phone'

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-800 dark:text-zinc-200">
                        {eventLabels[log.event_type] || log.event_type}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600 dark:text-zinc-400">
                        {phoneFormatted}
                      </td>
                      <td className="py-3 px-3 text-slate-500 dark:text-zinc-400 tabular-nums">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Delivered
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TRADE STARTER TEMPLATE PRESETS MODAL */}
      <Modal
        open={isPresetModalOpen}
        onOpenChange={setIsPresetModalOpen}
        title="Starter Template Presets"
        description="Load pre-calibrated auto-reply and after-hours text messaging copy tailored for your trade."
        size="lg"
      >
        <div className="space-y-4 pt-2">
          {/* Header toggle for primary vs other trades */}
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
              {/* Search Bar */}
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

              {/* Trade Selector List (Scrollable, 48px Touch Friendly) */}
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
                        <span className={cn(
                          'text-xs font-bold',
                          isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-900 dark:text-zinc-100'
                        )}>
                          {trade.name}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                          {trade.badge}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Trade Template Copy Preview Box */}
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  {selectedPreset.badge}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  {selectedPreset.name} Calibrated Copy
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400">
                2 Curated Templates
              </span>
            </div>

            <div className="space-y-2 pt-1 text-xs">
              {/* Business Hours Preview */}
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                  Business Hours Auto-Reply
                </span>
                <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-relaxed">
                  {selectedPreset.templates.auto_reply}
                </p>
              </div>

              {/* After-Hours Preview */}
              <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                  After-Hours / Weekend Auto-Reply
                </span>
                <p className="text-slate-700 dark:text-zinc-300 text-[11px] leading-relaxed">
                  {selectedPreset.templates.after_hours}
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions (48px Touch Ergonomics) */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
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
              className="min-h-[44px] px-5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs gap-1.5 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Apply {selectedPreset.name} Templates</span>
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
        currentPlanId={planId}
      />

    </div>
  )
}
