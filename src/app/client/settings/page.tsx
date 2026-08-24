'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Loader2, Send } from 'lucide-react'

interface OrgSettings {
  is_missed_call_active: boolean
  is_review_engine_active: boolean
  is_lead_alerts_active: boolean
  auto_reply_template: string
  google_review_url: string
  phone_number: string
  name: string
}

export default function SettingsPage() {
  const supabase = createClient()
  const [settings, setSettings] = useState<OrgSettings>({
    is_missed_call_active: true,
    is_review_engine_active: true,
    is_lead_alerts_active: true,
    auto_reply_template: 'Hey, this is {business_name}! We are on a job and missed your call. How can we help you?',
    google_review_url: '',
    phone_number: '',
    name: '',
  })
  const [orgId, setOrgId] = useState<string | null>(null)
  const [userPhone, setUserPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [testingSms, setTestingSms] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id,phone').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.org_id)
      setUserPhone(profile.phone || '')
      const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.org_id).single()
      if (org) setSettings({ is_missed_call_active: org.is_missed_call_active, is_review_engine_active: org.is_review_engine_active, is_lead_alerts_active: org.is_lead_alerts_active, auto_reply_template: org.auto_reply_template || '', google_review_url: org.google_review_url || '', phone_number: org.phone_number || '', name: org.name || '' })
    }
    fetch()
  }, [supabase])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    const { error } = await supabase.from('organizations').update(settings).eq('id', orgId)
    setSaving(false)
    if (error) toast.error('Failed to save. Try again.')
    else toast.success('Settings saved!')
  }

  const sendTest = async (type: string) => {
    if (!userPhone && !settings.phone_number) {
      toast.error('Add your mobile number in Integration Settings first.')
      return
    }
    setTestingSms(type)
    const preview = settings.auto_reply_template.replace('{business_name}', settings.name || 'Your Business')
    const res = await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', phone: userPhone || settings.phone_number, message: preview }),
    })
    setTestingSms(null)
    if (res.ok) toast.success('Test message sent to your phone!')
    else toast.error('Failed to send test. Check your phone number in Integration Settings.')
  }

  // Live SMS preview
  const smsPreview = settings.auto_reply_template
    .replace('{business_name}', settings.name || 'Your Business')
    .replace('{customer_name}', 'John')

  const Toggle = ({ label, description, field }: { label: string; description: string; field: keyof OrgSettings }) => (
    <div className="py-4 border-b last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => setSettings(s => ({ ...s, [field]: !s[field as keyof OrgSettings] }))}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none mt-0.5 ${settings[field as keyof OrgSettings] ? 'bg-primary' : 'bg-muted'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${settings[field as keyof OrgSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 text-xs"
        onClick={() => sendTest(field as string)}
        disabled={testingSms === field}
      >
        {testingSms === field ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending test...</> : <><Send className="mr-1 h-3 w-3" /> Send test to yourself</>}
      </Button>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">Control your automations and message templates.</p>
      </div>

      {/* Automation Toggles */}
      <div className="bg-background border rounded-2xl px-5">
        <div className="py-4 border-b">
          <h2 className="text-sm font-semibold">Automations</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Enable or disable each automation independently.</p>
        </div>
        <Toggle label="Missed-call auto-text" description="Automatically texts anyone who calls and you don't pick up." field="is_missed_call_active" />
        <Toggle label="Post-job review dispatcher" description="Sends a review request SMS after a job is marked complete." field="is_review_engine_active" />
        <Toggle label="Inbound form SMS alert" description="Texts you instantly when a website form lead comes in." field="is_lead_alerts_active" />
      </div>

      {/* SMS Template with live bubble preview */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        <h2 className="text-sm font-semibold mb-1">Auto-reply message</h2>
        <p className="text-xs text-muted-foreground mb-3">Sent automatically when a call is missed. Use <code className="bg-muted px-1 rounded">{'{business_name}'}</code> and <code className="bg-muted px-1 rounded">{'{customer_name}'}</code> as placeholders.</p>

        <div className="grid gap-2 mb-4">
          <textarea
            rows={3}
            className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            value={settings.auto_reply_template}
            onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
          />
        </div>

        {/* Live SMS bubble preview */}
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <div className="flex justify-end">
            <div className="bg-primary text-primary-foreground text-sm rounded-2xl rounded-br-sm px-3.5 py-2.5 max-w-[85%] leading-snug">
              {smsPreview || 'Your message will appear here…'}
            </div>
          </div>
        </div>
      </div>

      {/* Integration Settings */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        <h2 className="text-sm font-semibold mb-4">Integration settings</h2>
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="review_url">Google Review URL</Label>
            <Input id="review_url" placeholder="https://g.page/r/your-business/review" value={settings.google_review_url} onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="fwd_phone">Forwarding phone number</Label>
            <Input id="fwd_phone" placeholder="(555) 555-5555" value={settings.phone_number} onChange={e => setSettings(s => ({ ...s, phone_number: e.target.value }))} />
            <p className="text-xs text-muted-foreground">Also used to send test messages to yourself.</p>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-fit">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save all settings'}
      </Button>
    </div>
  )
}
