'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Zap, 
  PhoneMissed, 
  Star, 
  Clock, 
  MessageSquare, 
  CheckCircle2, 
  Lock, 
  Calendar, 
  FileText, 
  Receipt, 
  Repeat, 
  Save,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AutomationsPage() {
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Active Settings for Missed Call & Reviews
  const [settings, setSettings] = useState({
    name: '',
    telnyx_phone_number: '',
    is_missed_call_active: true,
    is_review_engine_active: true,
    auto_reply_template: 'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?',
    after_hours_template: 'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.',
    cooldown_hours: 24,
    google_review_url: ''
  })

  const loadSettings = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) return
    setOrgId(profile.org_id)

    const { data: org } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.org_id)
      .single()

    if (org) {
      setSettings({
        name: org.name || '',
        telnyx_phone_number: org.telnyx_phone_number || '',
        is_missed_call_active: org.is_missed_call_active ?? true,
        is_review_engine_active: org.is_review_engine_active ?? true,
        auto_reply_template: org.auto_reply_template || 'Hey, this is {business_name}! We are mid-job and missed your call. How can we help you?',
        after_hours_template: org.after_hours_template || 'Thanks for calling {business_name}. We are currently closed for the evening, but received your message and will call you first thing tomorrow morning.',
        cooldown_hours: org.cooldown_hours ?? 24,
        google_review_url: org.google_review_url || ''
      })
    }
  }, [supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)

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

    setSaving(false)
    if (error) {
      toast.error('Failed to save settings.')
    } else {
      toast.success('Automation settings saved & live!')
    }
  }

  // Previews
  const openPreview = settings.auto_reply_template
    .replace('{business_name}', settings.name || 'Your Company')

  const afterHoursPreview = settings.after_hours_template
    .replace('{business_name}', settings.name || 'Your Company')

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Zap className="h-6 w-6 text-blue-500" />
            Automations Hub
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Prebuilt customer conversion and follow-up engines designed for trade businesses.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
        </Button>
      </div>

      {/* ── Section 1: ACTIVE LIVE AUTOMATION ENGINES ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          Active Live Services (Phase 1)
        </div>

        {/* Engine 1: Missed-Call Recovery */}
        <div className="rounded-2xl border border-blue-500/30 bg-[#0D1322] p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                <PhoneMissed className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">Missed-Call Recovery & Instant Text-Back</h2>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    ACTIVE • ON
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Fires an instant SMS when a homeowner calls and your phone rings out.
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              onClick={() => setSettings(s => ({ ...s, is_missed_call_active: !s.is_missed_call_active }))}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none",
                settings.is_missed_call_active ? "bg-blue-600" : "bg-zinc-800"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                settings.is_missed_call_active ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          {/* Configuration Form */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Open Hours Template */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                <span>Business Hours Auto-Reply (SMS)</span>
                <span className="text-[10px] text-zinc-400">Under 160 characters</span>
              </Label>
              <textarea
                rows={3}
                value={settings.auto_reply_template}
                onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
              />
              <div className="rounded-lg bg-zinc-950/70 p-2.5 border border-zinc-800/60 text-[11px] text-zinc-400">
                <span className="text-zinc-400 font-bold uppercase text-[9px] block">Live Preview:</span>
                <span className="text-zinc-200 italic">&ldquo;{openPreview}&rdquo;</span>
              </div>
            </div>

            {/* After Hours Template */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-200 flex items-center justify-between">
                <span>After-Hours & Weekend Auto-Reply</span>
                <span className="text-[10px] text-zinc-400">Outside 8AM-6PM</span>
              </Label>
              <textarea
                rows={3}
                value={settings.after_hours_template}
                onChange={e => setSettings(s => ({ ...s, after_hours_template: e.target.value }))}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-white placeholder:text-zinc-400 focus:outline-none focus:border-blue-500"
              />
              <div className="rounded-lg bg-zinc-950/70 p-2.5 border border-zinc-800/60 text-[11px] text-zinc-400">
                <span className="text-zinc-400 font-bold uppercase text-[9px] block">Live Preview:</span>
                <span className="text-zinc-200 italic">&ldquo;{afterHoursPreview}&rdquo;</span>
              </div>
            </div>
          </div>

          {/* Cooldown Safety Rules (Blueprint §8) */}
          <div className="mt-4 pt-4 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
            <div className="flex items-center gap-2 text-zinc-300">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Safety Cooldown Window: <strong>{settings.cooldown_hours} Hours</strong></span>
            </div>
            <p className="text-[11px] text-zinc-400">
              CaptoDesk will never spam a caller twice if they call back multiple times within 24 hours.
            </p>
          </div>
        </div>

        {/* Engine 2: 1-Click Google Review Booster */}
        <div className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white">Google Review Booster Engine</h2>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    ACTIVE • ON
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  1-Click SMS request sent after job completion to invite customers to share honest feedback on Google.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSettings(s => ({ ...s, is_review_engine_active: !s.is_review_engine_active }))}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none",
                settings.is_review_engine_active ? "bg-amber-500" : "bg-zinc-800"
              )}
            >
              <span className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
                settings.is_review_engine_active ? "translate-x-6" : "translate-x-1"
              )} />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            <Label className="text-xs font-semibold text-zinc-200">Google Business Review Link</Label>
            <Input
              placeholder="https://g.page/r/your-review-link"
              value={settings.google_review_url}
              onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
              className="bg-zinc-900 border-zinc-800 text-xs text-white h-10 rounded-xl focus:border-amber-500"
            />
            <p className="text-[11px] text-zinc-400">
              Paste your direct Google Maps &ldquo;Ask for reviews&rdquo; link. Customers will be directed straight to your Google review link.
            </p>
          </div>
        </div>
      </div>

      {/* ── Section 2: BLUEPRINT PREBUILT EXPANSIONS (Sections 34, 35, 62-65) ── */}
      <div className="space-y-4 pt-4 border-t border-zinc-800/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <Sparkles className="h-3.5 w-3.5 text-blue-400" />
            Prebuilt Blueprint Modules (Roadmap Preview)
          </div>
          <span className="text-xs text-zinc-400">Configurable Prebuilts</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Module 3: Unresponsive Lead Follow-Up */}
          <div className="rounded-2xl border border-zinc-800/70 bg-[#0B0F19]/90 p-5 space-y-3 opacity-90 hover:opacity-100 transition-opacity">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-800/80 flex items-center justify-center shrink-0 text-zinc-300">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-200">Lead Follow-Up Engine</h3>
                  <p className="text-xs text-zinc-400">Nudges leads who went quiet after 48 hours.</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-400 border border-blue-500/20">
                Phase 2 Preview
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/50">
              <strong>Workflow:</strong> If a recovered lead does not respond after 2 days, CaptoDesk sends a friendly polite check-in: <em>&ldquo;Hey John, just checking if you still needed help with that repair?&rdquo;</em>
            </div>
          </div>

          {/* Module 4: Appointment Reminders */}
          <div className="rounded-2xl border border-zinc-800/70 bg-[#0B0F19]/90 p-5 space-y-3 opacity-90 hover:opacity-100 transition-opacity">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-800/80 flex items-center justify-center shrink-0 text-zinc-300">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-200">Appointment Reminders</h3>
                  <p className="text-xs text-zinc-400">Cuts no-shows with automated 24h & 2h alerts.</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-400 border border-blue-500/20">
                Phase 2 Preview
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/50">
              <strong>Workflow:</strong> Automatically texts confirmation upon booking, reminder SMS 24 hours prior, and notification when technician is en route.
            </div>
          </div>

          {/* Module 5: Quote Follow-Up */}
          <div className="rounded-2xl border border-zinc-800/70 bg-[#0B0F19]/90 p-5 space-y-3 opacity-90 hover:opacity-100 transition-opacity">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-800/80 flex items-center justify-center shrink-0 text-zinc-300">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-200">Quote & Estimate Recovery</h3>
                  <p className="text-xs text-zinc-400">Recovers unsold quotes sent to clients.</p>
                </div>
              </div>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-400 border border-zinc-700">
                Included in Pro
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/50">
              <strong>Workflow:</strong> Triggers follow-up 3 days after quote delivery to ask if homeowner has questions or is ready to schedule.
            </div>
          </div>

          {/* Module 6: Customer Reactivation */}
          <div className="rounded-2xl border border-zinc-800/70 bg-[#0B0F19]/90 p-5 space-y-3 opacity-90 hover:opacity-100 transition-opacity">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-800/80 flex items-center justify-center shrink-0 text-zinc-300">
                  <Repeat className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-200">Seasonal Customer Reactivation</h3>
                  <p className="text-xs text-zinc-400">Brings past clients back every 6 months.</p>
                </div>
              </div>
              <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-400 border border-zinc-700">
                Included in Pro
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/50">
              <strong>Workflow:</strong> Automatic seasonal check-in SMS sent 6 months after completed job (e.g. spring AC checkup, fall gutter cleaning).
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
