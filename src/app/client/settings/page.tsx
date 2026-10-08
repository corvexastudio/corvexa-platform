'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { toast } from 'sonner'
import { 
  Settings as SettingsIcon, 
  PhoneCall, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  Send, 
  Save, 
  Smartphone,
  Loader2,
  Check
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingSms, setTestingSms] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    owner_phone: '',
    telnyx_phone_number: '',
    carrier: 'Verizon',
    timezone: 'America/Chicago',
    google_review_url: '',
    reactivation_enabled: true,
    default_reactivation_interval_days: 90,
    reactivation_cooldown_days: 30,
    reactivation_template: "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
    reactivation_quiet_hours: true,
    reactivation_max_daily: 50
  })

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setError('Authentication required to view settings.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profileErr || !profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }
      setOrgId(profile.org_id)

      const { data: org, error: orgErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.org_id)
        .single()

      if (orgErr) {
        setError('Failed to retrieve organization settings.')
      } else if (org) {
        setFormData({
          name: org.name || '',
          owner_phone: org.owner_phone || '',
          telnyx_phone_number: org.telnyx_phone_number || '',
          carrier: org.carrier || 'Verizon',
          timezone: org.timezone || 'America/Chicago',
          google_review_url: org.google_review_url || '',
          reactivation_enabled: org.reactivation_enabled ?? true,
          default_reactivation_interval_days: org.default_reactivation_interval_days ?? 90,
          reactivation_cooldown_days: org.reactivation_cooldown_days ?? 30,
          reactivation_template: org.reactivation_template || "Hi {customer_name}, it's been a little while since your last service with {business_name}. Would you like us to schedule your next visit? You can book online anytime: {booking_url}",
          reactivation_quiet_hours: org.reactivation_quiet_hours ?? true,
          reactivation_max_daily: org.reactivation_max_daily ?? 50
        })
      }
    } catch {
      setError('An unexpected error occurred while loading settings.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleCopyNumber = () => {
    if (!formData.telnyx_phone_number) return
    navigator.clipboard.writeText(formData.telnyx_phone_number)
    setCopied(true)
    toast.success('Forwarding number copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setSaving(true)

    const { error } = await supabase
      .from('organizations')
      .update({
        name: formData.name,
        owner_phone: formData.owner_phone,
        carrier: formData.carrier,
        timezone: formData.timezone,
        google_review_url: formData.google_review_url,
        reactivation_enabled: formData.reactivation_enabled,
        default_reactivation_interval_days: parseInt(String(formData.default_reactivation_interval_days), 10) || 90,
        reactivation_cooldown_days: parseInt(String(formData.reactivation_cooldown_days), 10) || 30,
        reactivation_template: formData.reactivation_template,
        reactivation_quiet_hours: formData.reactivation_quiet_hours,
        reactivation_max_daily: parseInt(String(formData.reactivation_max_daily), 10) || 50
      })
      .eq('id', orgId)

    setSaving(false)
    if (error) toast.error('Failed to update settings.')
    else toast.success('Settings saved successfully')
  }

  const handleSendTestSms = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile number first so we know where to send the test.')
      return
    }
    setTestingSms(true)
    try {
      const res = await fetch('/api/telnyx/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.owner_phone
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `Test text sent to ${formData.owner_phone}`)
      } else {
        toast.error(data.error || 'Test SMS failed. Verify your phone format.')
      }
    } catch {
      toast.error('Network error while dispatching test SMS.')
    } finally {
      setTestingSms(false)
    }
  }

  const cleanForwardingDigits = formData.telnyx_phone_number.replace(/\D/g, '')

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Page Header */}
      <div className="border-b border-zinc-800 pb-5">
        <h1 className="text-xl font-bold tracking-tight text-white">
          Settings & Carrier Routing
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Phone routing, conditional call forwarding, and business details.
        </p>
      </div>

      {error ? (
        <ErrorState
          title="Failed to load settings"
          message={error}
          onRetry={loadSettings}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="space-y-4">
          <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-3">
            <Skeleton className="h-5 w-40 bg-zinc-800" />
            <Skeleton className="h-3 w-64 bg-zinc-800/60" />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Skeleton className="h-9 w-full bg-zinc-800" />
              <Skeleton className="h-9 w-full bg-zinc-800" />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Section 1: Carrier Call Forwarding ── */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-400" />
                  Carrier Conditional Call Forwarding
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Forward unanswered calls to CaptoDesk to fire the instant text-back. Your phone still rings normally.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-xs font-medium text-emerald-400 bg-zinc-950 px-3 py-1.5 rounded border border-zinc-800">
                  {formData.telnyx_phone_number || 'Provisioning...'}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyNumber}
                  className="h-7.5 px-2.5 text-xs border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Carrier Dial Codes */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-zinc-300 block">Dial Code by Carrier:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Verizon */}
                <div className="rounded bg-zinc-950 border border-zinc-800 p-3 space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-300 block">Verizon</span>
                  <div className="font-mono text-xs font-medium text-white bg-zinc-900 p-1.5 rounded border border-zinc-800 text-center">
                    *71{cleanForwardingDigits || 'XXXXXXXXXX'}
                  </div>
                  <p className="text-[11px] text-zinc-500">Dial code, listen for 2 beeps, hang up.</p>
                  <p className="text-[10px] text-zinc-600">To disable: dial *73</p>
                </div>

                {/* AT&T */}
                <div className="rounded bg-zinc-950 border border-zinc-800 p-3 space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-300 block">AT&amp;T</span>
                  <div className="font-mono text-xs font-medium text-white bg-zinc-900 p-1.5 rounded border border-zinc-800 text-center">
                    *71{cleanForwardingDigits || 'XXXXXXXXXX'}
                  </div>
                  <p className="text-[11px] text-zinc-500">Dial code, wait for tone, hang up.</p>
                  <p className="text-[10px] text-zinc-600">To disable: dial *73</p>
                </div>

                {/* T-Mobile */}
                <div className="rounded bg-zinc-950 border border-zinc-800 p-3 space-y-1.5">
                  <span className="text-xs font-semibold text-zinc-300 block">T-Mobile</span>
                  <div className="font-mono text-xs font-medium text-white bg-zinc-900 p-1.5 rounded border border-zinc-800 text-center">
                    **62*{cleanForwardingDigits || 'XXXXXXXXXX'}#
                  </div>
                  <p className="text-[11px] text-zinc-500">Dial code with # at end, tap call.</p>
                  <p className="text-[10px] text-zinc-600">To disable: dial ##62#</p>
                </div>
              </div>
            </div>

            {/* Test SMS Trigger */}
            <div className="pt-3 border-t border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs text-zinc-400">
                Verify SMS dispatch to your mobile number.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTestSms}
                disabled={testingSms || !formData.owner_phone}
                className="h-7.5 text-xs border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
              >
                {testingSms ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-3 w-3 mr-1.5 text-blue-400" />
                )}
                <span>Send Test SMS</span>
              </Button>
            </div>
          </div>

          {/* ── Section 2: Business Profile & Settings Form ── */}
          <form onSubmit={handleSave} className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Business Details
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Primary contact details and default business timezone.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-zinc-300 mb-1 block">Business Name</Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Reyes Plumbing"
                  className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-300 mb-1 block">Owner Cell Phone (Notifications)</Label>
                <Input
                  value={formData.owner_phone}
                  onChange={e => setFormData(d => ({ ...d, owner_phone: e.target.value }))}
                  placeholder="(555) 123-4567"
                  className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>

              <div>
                <Label className="text-xs text-zinc-300 mb-1 block">Primary Carrier</Label>
                <select
                  aria-label="Primary Carrier"
                  value={formData.carrier}
                  onChange={e => setFormData(d => ({ ...d, carrier: e.target.value }))}
                  className="w-full h-8.5 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 px-2.5 focus:outline-none focus:border-zinc-700"
                >
                  <option value="Verizon">Verizon Wireless</option>
                  <option value="AT&T">AT&amp;T</option>
                  <option value="T-Mobile">T-Mobile / Sprint</option>
                  <option value="Other">Other / Landline</option>
                </select>
              </div>

              <div>
                <Label className="text-xs text-zinc-300 mb-1 block">Timezone</Label>
                <select
                  aria-label="Timezone"
                  value={formData.timezone}
                  onChange={e => setFormData(d => ({ ...d, timezone: e.target.value }))}
                  className="w-full h-8.5 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 px-2.5 focus:outline-none focus:border-zinc-700"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>
            </div>

            {/* Customer Reactivation Settings */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Customer Retention & Reactivation
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Remind past clients when they are due for recurring maintenance.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={formData.reactivation_enabled}
                    onChange={e => setFormData(d => ({ ...d, reactivation_enabled: e.target.checked }))}
                    className="rounded bg-zinc-950 border-zinc-800 text-blue-600 h-4 w-4"
                  />
                  <span>Enabled</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">Interval (Days)</Label>
                  <Input
                    type="number"
                    min={14}
                    max={730}
                    value={formData.default_reactivation_interval_days}
                    onChange={e => setFormData(d => ({ ...d, default_reactivation_interval_days: parseInt(e.target.value, 10) || 90 }))}
                    className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                  />
                  <span className="text-[10px] text-zinc-500">Days since last service</span>
                </div>

                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">Cooldown (Days)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    value={formData.reactivation_cooldown_days}
                    onChange={e => setFormData(d => ({ ...d, reactivation_cooldown_days: parseInt(e.target.value, 10) || 30 }))}
                    className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                  />
                  <span className="text-[10px] text-zinc-500">Min days between messages</span>
                </div>

                <div>
                  <Label className="text-xs text-zinc-400 mb-1 block">Daily Dispatch Limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={formData.reactivation_max_daily}
                    onChange={e => setFormData(d => ({ ...d, reactivation_max_daily: parseInt(e.target.value, 10) || 50 }))}
                    className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                  />
                  <span className="text-[10px] text-zinc-500">Max sent per day</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-zinc-400">Reactivation Message Template</Label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-zinc-400">
                    <input
                      type="checkbox"
                      checked={formData.reactivation_quiet_hours}
                      onChange={e => setFormData(d => ({ ...d, reactivation_quiet_hours: e.target.checked }))}
                      className="rounded bg-zinc-950 border-zinc-800 text-blue-600 h-3.5 w-3.5"
                    />
                    <span>Quiet Hours (8am-8pm local)</span>
                  </label>
                </div>
                <textarea
                  rows={2}
                  value={formData.reactivation_template}
                  onChange={e => setFormData(d => ({ ...d, reactivation_template: e.target.value }))}
                  className="w-full rounded-md bg-zinc-950 border border-zinc-800 p-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                <span>Save Settings</span>
              </Button>
            </div>
          </form>

          {/* ── Section 3: TCPA & Carrier Compliance ── */}
          <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-4 text-xs text-zinc-400 space-y-1.5">
            <div className="flex items-center gap-2 text-zinc-200 font-medium">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>A2P 10DLC & TCPA Carrier Compliance Built-In</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              When customers reply <code className="text-zinc-300">STOP</code>, <code className="text-zinc-300">UNSUBSCRIBE</code>, or <code className="text-zinc-300">CANCEL</code>, automated SMS messages are immediately suppressed.
            </p>
          </div>

        </div>
      )}

    </div>
  )
}
