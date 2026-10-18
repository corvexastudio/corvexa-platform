'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  ArrowRight,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function AutomationsPage() {
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Active Settings for Missed Call & Reviews
  const [settings, setSettings] = useState({
    name: '',
    slug: '',
    telnyx_phone_number: '',
    is_missed_call_active: true,
    is_review_engine_active: true,
    auto_reply_template: 'Hi, this is {business_name}! Sorry we missed your call — our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} — or reply directly to this text with what you need!',
    after_hours_template: "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} — or text us what you need and we'll reply first thing in the morning!",
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
      const isLegacyOpen = !org.auto_reply_template || org.auto_reply_template.includes('We are mid-job and missed your call')
      const isLegacyClosed = !org.after_hours_template || org.after_hours_template.includes('will call you first thing tomorrow morning')

      setSettings({
        name: org.name || '',
        slug: org.slug || '',
        telnyx_phone_number: org.telnyx_phone_number || '',
        is_missed_call_active: org.is_missed_call_active ?? true,
        is_review_engine_active: org.is_review_engine_active ?? true,
        auto_reply_template: isLegacyOpen
          ? 'Hi, this is {business_name}! Sorry we missed your call — our team is currently assisting customers on-site. You can lock in a time on our schedule here: {booking_url} — or reply directly to this text with what you need!'
          : org.auto_reply_template,
        after_hours_template: isLegacyClosed
          ? "Thanks for calling {business_name}! Our office is currently closed, but you can reserve an appointment on our schedule anytime here: {booking_url} — or text us what you need and we'll reply first thing in the morning!"
          : org.after_hours_template,
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
      toast.success('Automation rules updated and active')
    }
  }

  const bookingUrlPreview = settings.slug 
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://app.corvexastudio.com'}/book/${settings.slug}`
    : 'https://app.corvexastudio.com/book/your-link'

  const openPreview = (settings.auto_reply_template || '')
    .replace(/\{business_name\}|\{\{business_name\}\}/g, settings.name || 'Your Company')
    .replace(/\{booking_url\}|\{\{booking_url\}\}|\{booking_link\}|\{\{booking_link\}\}/g, bookingUrlPreview)

  const afterHoursPreview = (settings.after_hours_template || '')
    .replace(/\{business_name\}|\{\{business_name\}\}/g, settings.name || 'Your Company')
    .replace(/\{booking_url\}|\{\{booking_url\}\}|\{booking_link\}|\{\{booking_link\}\}/g, bookingUrlPreview)

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Automations
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Rules and automated responses for missed calls, booking reminders, and customer reviews.
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          size="sm"
          className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium self-start sm:self-auto"
        >
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              Save Rules
            </>
          )}
        </Button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">

        {/* Rule 1: Missed Call Text-Back */}
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-zinc-950 border border-blue-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                <PhoneMissed className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Missed-Call Instant Text-Back
                  </h2>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border",
                    settings.is_missed_call_active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-750"
                  )}>
                    {settings.is_missed_call_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Sends an immediate SMS response to callers when a business call is missed or rings out.
                </p>
              </div>
            </div>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, is_missed_call_active: !s.is_missed_call_active }))}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                settings.is_missed_call_active ? "bg-blue-600" : "bg-slate-200 dark:bg-zinc-800"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs",
                settings.is_missed_call_active ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-700 dark:text-zinc-300 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  Business Hours Response
                </Label>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">While Open</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Sent when a call is missed during regular operating hours (e.g. while mid-job).
              </p>
              <textarea
                rows={4}
                value={settings.auto_reply_template}
                onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
                className="w-full rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed shadow-2xs"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">Insert tag:</span>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, auto_reply_template: s.auto_reply_template + ' {business_name}' }))}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300 font-mono transition-colors"
                >
                  {'{business_name}'}
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, auto_reply_template: s.auto_reply_template + ' {booking_url}' }))}
                  className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-[10px] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-mono transition-colors"
                >
                  {'{booking_url}'}
                </button>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-950 p-2.5 border border-slate-200/80 dark:border-zinc-800/80 text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 block tracking-wider">Live Preview:</span>
                <span className="text-slate-800 dark:text-zinc-300 leading-relaxed block">&ldquo;{openPreview}&rdquo;</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-700 dark:text-zinc-300 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                  After-Hours / Closed Response
                </Label>
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-medium">While Closed</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Automatically detected when office is closed or on weekends. Keeps callers from calling competitors.
              </p>
              <textarea
                rows={4}
                value={settings.after_hours_template}
                onChange={e => setSettings(s => ({ ...s, after_hours_template: e.target.value }))}
                className="w-full rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none font-sans leading-relaxed shadow-2xs"
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 dark:text-zinc-500">Insert tag:</span>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, after_hours_template: s.after_hours_template + ' {business_name}' }))}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-[10px] text-slate-700 dark:text-zinc-300 font-mono transition-colors"
                >
                  {'{business_name}'}
                </button>
                <button
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, after_hours_template: s.after_hours_template + ' {booking_url}' }))}
                  className="px-1.5 py-0.5 rounded bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-[10px] text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 font-mono transition-colors"
                >
                  {'{booking_url}'}
                </button>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-zinc-950 p-2.5 border border-slate-200/80 dark:border-zinc-800/80 text-[11px] text-slate-600 dark:text-zinc-400 space-y-1">
                <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-zinc-500 block tracking-wider">Live Preview:</span>
                <span className="text-slate-800 dark:text-zinc-300 leading-relaxed block">&ldquo;{afterHoursPreview}&rdquo;</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800/80">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <span>Cooldown safeguard: Repeat calls within {settings.cooldown_hours} hours will not trigger duplicate texts.</span>
          </div>
        </div>

        {/* Rule 2: Google Review Request */}
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-50 dark:bg-zinc-950 border border-amber-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                <Star className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Post-Job Google Review Invite
                  </h2>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border",
                    settings.is_review_engine_active
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-750"
                  )}>
                    {settings.is_review_engine_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Sends an SMS asking homeowners to share honest feedback on Google after their job is marked completed.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, is_review_engine_active: !s.is_review_engine_active }))}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                settings.is_review_engine_active ? "bg-blue-600" : "bg-slate-200 dark:bg-zinc-800"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-xs",
                settings.is_review_engine_active ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-700 dark:text-zinc-300 font-medium">Google Business Review URL</Label>
            <Input
              placeholder="https://g.page/r/your-review-link"
              value={settings.google_review_url}
              onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
              className="h-8.5 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-md"
            />
            <p className="text-[11px] text-slate-500 dark:text-zinc-500">
              Customers receive a direct link to your Google Business Profile review dialog.
            </p>
          </div>
        </div>

        {/* Rule 3: Appointment Reminders */}
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-slate-500 dark:text-zinc-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Appointment Confirmations & Reminders
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Sends booking confirmation immediately, followed by 24-hour and 2-hour appointment reminders.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400 space-y-1">
            <div className="font-medium text-slate-900 dark:text-zinc-300">Default cadence:</div>
            <div>• Booking confirmed: Instant SMS with service details and reschedule link</div>
            <div>• 24 hours prior: Reminder SMS confirming technician arrival window</div>
            <div>• Technician en route: Live dispatch notification</div>
          </div>
        </div>

        {/* Rule 4: Quote Follow-Up */}
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-slate-500 dark:text-zinc-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Estimate Follow-Up
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Automatically checks in with homeowners if an estimate has not been approved after 48 hours.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400">
            Follow-up SMS triggers 2 days and 5 days after quote dispatch unless accepted or declined.
          </div>
        </div>

        {/* Rule 5: Customer Reactivation */}
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-5 space-y-3 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-center shrink-0 text-slate-500 dark:text-zinc-400">
                <Repeat className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    Seasonal Maintenance Reactivation
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Reminds past clients who are due or overdue for recurring service to schedule their next visit.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 dark:bg-zinc-950 p-3 border border-slate-200/80 dark:border-zinc-800/80 text-xs text-slate-600 dark:text-zinc-400">
            Cadence and template configured under Settings &gt; Customer Retention.
          </div>
        </div>

        {/* Bottom Save Action Bar for Mobile Thumb Reach */}
        <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400">Changes deploy immediately to your front desk and SMS routing.</p>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="h-9 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium w-full sm:w-auto"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Saving Rules...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Automation Rules
              </>
            )}
          </Button>
        </div>

      </div>

    </div>
  )
}
