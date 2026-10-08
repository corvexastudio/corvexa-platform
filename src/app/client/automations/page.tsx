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
      toast.success('Automation rules updated and active')
    }
  }

  const openPreview = settings.auto_reply_template
    .replace('{business_name}', settings.name || 'Your Company')

  const afterHoursPreview = settings.after_hours_template
    .replace('{business_name}', settings.name || 'Your Company')

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">
            Automations
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
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
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-blue-400">
                <PhoneMissed className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Missed-Call Instant Text-Back
                  </h2>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border",
                    settings.is_missed_call_active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}>
                    {settings.is_missed_call_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
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
                settings.is_missed_call_active ? "bg-blue-600" : "bg-zinc-800"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                settings.is_missed_call_active ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">Business Hours Response</Label>
              <textarea
                rows={3}
                value={settings.auto_reply_template}
                onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
                className="w-full rounded-md bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
              />
              <div className="rounded bg-zinc-950 p-2 border border-zinc-800/80 text-[11px] text-zinc-400">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Preview:</span>
                <span className="text-zinc-300">&ldquo;{openPreview}&rdquo;</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300 font-medium">After-Hours Response</Label>
              <textarea
                rows={3}
                value={settings.after_hours_template}
                onChange={e => setSettings(s => ({ ...s, after_hours_template: e.target.value }))}
                className="w-full rounded-md bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
              />
              <div className="rounded bg-zinc-950 p-2 border border-zinc-800/80 text-[11px] text-zinc-400">
                <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Preview:</span>
                <span className="text-zinc-300">&ldquo;{afterHoursPreview}&rdquo;</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center gap-2 text-xs text-zinc-400 border-t border-zinc-800/80">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Cooldown safeguard: Repeat calls within {settings.cooldown_hours} hours will not trigger duplicate texts.</span>
          </div>
        </div>

        {/* Rule 2: Google Review Request */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-zinc-800">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-amber-400">
                <Star className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Post-Job Google Review Invite
                  </h2>
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border",
                    settings.is_review_engine_active
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700"
                  )}>
                    {settings.is_review_engine_active ? 'Active' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sends an SMS asking homeowners to share honest feedback on Google after their job is marked completed.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSettings(s => ({ ...s, is_review_engine_active: !s.is_review_engine_active }))}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none cursor-pointer",
                settings.is_review_engine_active ? "bg-blue-600" : "bg-zinc-800"
              )}
            >
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform",
                settings.is_review_engine_active ? "translate-x-4.5" : "translate-x-0.5"
              )} />
            </button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300 font-medium">Google Business Review URL</Label>
            <Input
              placeholder="https://g.page/r/your-review-link"
              value={settings.google_review_url}
              onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
            <p className="text-[11px] text-zinc-500">
              Customers receive a direct link to your Google Business Profile review dialog.
            </p>
          </div>
        </div>

        {/* Rule 3: Appointment Reminders */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Appointment Confirmations & Reminders
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Sends booking confirmation immediately, followed by 24-hour and 2-hour appointment reminders.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded bg-zinc-950 p-3 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
            <div className="font-medium text-zinc-300">Default cadence:</div>
            <div>• Booking confirmed: Instant SMS with service details and reschedule link</div>
            <div>• 24 hours prior: Reminder SMS confirming technician arrival window</div>
            <div>• Technician en route: Live dispatch notification</div>
          </div>
        </div>

        {/* Rule 4: Quote Follow-Up */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Estimate Follow-Up
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Automatically checks in with homeowners if an estimate has not been approved after 48 hours.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded bg-zinc-950 p-3 border border-zinc-800/80 text-xs text-zinc-400">
            Follow-up SMS triggers 2 days and 5 days after quote dispatch unless accepted or declined.
          </div>
        </div>

        {/* Rule 5: Customer Reactivation */}
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                <Repeat className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-zinc-100">
                    Seasonal Maintenance Reactivation
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Reminds past clients who are due or overdue for recurring service to schedule their next visit.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded bg-zinc-950 p-3 border border-zinc-800/80 text-xs text-zinc-400">
            Cadence and template configured under Settings &gt; Customer Retention.
          </div>
        </div>

      </div>

    </div>
  )
}
