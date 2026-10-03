'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Settings as SettingsIcon, 
  PhoneCall, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  Send, 
  Save,
  HelpCircle,
  Smartphone,
  ExternalLink
} from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingSms, setTestingSms] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    owner_phone: '',
    telnyx_phone_number: '',
    carrier: 'Verizon',
    timezone: 'America/Chicago',
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
      setFormData({
        name: org.name || '',
        owner_phone: org.owner_phone || '',
        telnyx_phone_number: org.telnyx_phone_number || '',
        carrier: org.carrier || 'Verizon',
        timezone: org.timezone || 'America/Chicago',
        google_review_url: org.google_review_url || ''
      })
    }
  }, [supabase])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleCopyNumber = () => {
    if (!formData.telnyx_phone_number) return
    navigator.clipboard.writeText(formData.telnyx_phone_number)
    setCopied(true)
    toast.success('Forwarding number copied to clipboard!')
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
        google_review_url: formData.google_review_url
      })
      .eq('id', orgId)

    setSaving(false)
    if (error) toast.error('Failed to update settings.')
    else toast.success('Settings saved!')
  }

  const handleSendTestSms = async () => {
    if (!formData.owner_phone) {
      toast.error('Add your mobile number first so we know where to send the test.')
      return
    }
    setTestingSms(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Owner Test',
          phone: formData.owner_phone,
          message: `[CaptoDesk Test] Hey, this is ${formData.name || 'your business'}! This is the exact SMS your customers receive within 15 seconds of a missed call.`
        })
      })
      if (res.ok) {
        toast.success(`Test text dispatched to ${formData.owner_phone}!`)
      } else {
        toast.error('Test SMS failed. Verify your phone format.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setTestingSms(false)
    }
  }

  const cleanForwardingDigits = formData.telnyx_phone_number.replace(/\D/g, '')

  return (
    <div className="space-y-8 max-w-4xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
          <SettingsIcon className="h-6 w-6 text-blue-500" />
          Settings & Carrier Setup
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Configure business details and activate carrier conditional forwarding (`*71`).
        </p>
      </div>

      {/* ── STEP-BY-STEP CARRIER FORWARDING WIZARD (Blueprint §6, §7) ── */}
      <div className="rounded-2xl border border-blue-500/30 bg-[#0D1322] p-5 sm:p-7 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 shrink-0">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Step 1: Your Dedicated Cloud Safety Net
              </span>
              <h2 className="text-lg font-bold text-white">Your Assigned Forwarding Number</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-10 px-4 rounded-xl bg-zinc-900 border border-zinc-700/80 flex items-center font-mono font-bold text-sm text-emerald-400">
              {formData.telnyx_phone_number || 'Provisioning...'}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyNumber}
              className="h-10 px-3 rounded-xl border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-white"
            >
              {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Carrier Dial Instructions */}
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Step 2: Dial Your Carrier Forwarding Code
            </h3>
            <span className="text-xs text-zinc-400 font-medium">Takes 30 seconds</span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">
            Open the phone dialer on your cell phone (the phone that receives business calls). Type the code below and tap Call. 
            Your phone still rings normally. Only unanswered rings will forward to CaptoDesk to fire the instant text-back.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {/* Verizon */}
            <div className="rounded-xl bg-[#090D16] border border-zinc-800 p-4 space-y-2">
              <span className="text-xs font-bold text-red-400 uppercase tracking-wider block">Verizon</span>
              <div className="font-mono text-sm font-black text-white bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-center">
                *71{cleanForwardingDigits || 'XXXXXXXXXX'}
              </div>
              <p className="text-[11px] text-zinc-400">Dial code, listen for 2 beeps, hang up.</p>
              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                To turn off: dial <code className="text-zinc-300 font-bold">*73</code>
              </div>
            </div>

            {/* AT&T */}
            <div className="rounded-xl bg-[#090D16] border border-zinc-800 p-4 space-y-2">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">AT&amp;T</span>
              <div className="font-mono text-sm font-black text-white bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-center">
                *71{cleanForwardingDigits || 'XXXXXXXXXX'}
              </div>
              <p className="text-[11px] text-zinc-400">Dial code, wait for tone, hang up.</p>
              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                To turn off: dial <code className="text-zinc-300 font-bold">*73</code>
              </div>
            </div>

            {/* T-Mobile */}
            <div className="rounded-xl bg-[#090D16] border border-zinc-800 p-4 space-y-2">
              <span className="text-xs font-bold text-pink-400 uppercase tracking-wider block">T-Mobile</span>
              <div className="font-mono text-sm font-black text-white bg-zinc-900 p-2 rounded-lg border border-zinc-800 text-center">
                **62*{cleanForwardingDigits || 'XXXXXXXXXX'}#
              </div>
              <p className="text-[11px] text-zinc-400">Dial code with # at end, tap call.</p>
              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                To turn off: dial <code className="text-zinc-300 font-bold">##62#</code>
              </div>
            </div>
          </div>
        </div>

        {/* Live Test Trigger Button */}
        <div className="mt-6 pt-5 border-t border-zinc-800/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">
            Want to see how it looks on your phone right now?
          </div>
          <Button
            type="button"
            onClick={handleSendTestSms}
            disabled={testingSms || !formData.owner_phone}
            className="h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs border border-zinc-700 flex items-center gap-2"
          >
            <Send className="h-3.5 w-3.5 text-blue-400" />
            <span>{testingSms ? 'Dispatching Test...' : 'Send Live Test SMS to My Cell'}</span>
          </Button>
        </div>
      </div>

      {/* ── Business Profile Form ── */}
      <form onSubmit={handleSave} className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] p-5 sm:p-7 space-y-5 shadow-xl">
        <h2 className="text-base font-bold text-white uppercase tracking-wider">
          Business Profile & Notifications
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Business Name</Label>
            <Input
              value={formData.name}
              onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
              placeholder="e.g. Reyes Plumbing"
              className="bg-zinc-900 border-zinc-800 text-xs text-white h-10 rounded-xl focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Owner Cell Phone (For Notifications)</Label>
            <Input
              value={formData.owner_phone}
              onChange={e => setFormData(d => ({ ...d, owner_phone: e.target.value }))}
              placeholder="(555) 123-4567"
              className="bg-zinc-900 border-zinc-800 text-xs text-white h-10 rounded-xl focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Primary Mobile Carrier</Label>
            <select
              value={formData.carrier}
              onChange={e => setFormData(d => ({ ...d, carrier: e.target.value }))}
              className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white px-3 focus:outline-none focus:border-blue-500"
            >
              <option value="Verizon">Verizon Wireless</option>
              <option value="AT&T">AT&amp;T</option>
              <option value="T-Mobile">T-Mobile / Sprint</option>
              <option value="Other">Other / Landline</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-300">Timezone</Label>
            <select
              value={formData.timezone}
              onChange={e => setFormData(d => ({ ...d, timezone: e.target.value }))}
              className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white px-3 focus:outline-none focus:border-blue-500"
            >
              <option value="America/New_York">Eastern Time (ET)</option>
              <option value="America/Chicago">Central Time (CT)</option>
              <option value="America/Denver">Mountain Time (MT)</option>
              <option value="America/Los_Angeles">Pacific Time (PT)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="h-10 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </Button>
        </div>
      </form>

      {/* ── TCPA & 10DLC Compliance Card (Blueprint §59) ── */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0B0F19] p-5 text-xs text-zinc-400 space-y-2">
        <div className="flex items-center gap-2 text-zinc-300 font-bold">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>A2P 10DLC & TCPA Carrier Compliance Built-In</span>
        </div>
        <p className="leading-relaxed">
          CaptoDesk automatically manages carrier regulations for your business. Whenever a customer texts 
          <code className="text-zinc-200 font-bold mx-1">STOP</code>, <code className="text-zinc-200 font-bold mx-1">UNSUBSCRIBE</code>, or <code className="text-zinc-200 font-bold mx-1">CANCEL</code>, 
          the system instantly suppresses all future automated messages and logs the opt-out in your customer records.
        </p>
      </div>

    </div>
  )
}
