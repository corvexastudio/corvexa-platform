'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

interface OrgSettings {
  is_missed_call_active: boolean
  is_review_engine_active: boolean
  is_lead_alerts_active: boolean
  auto_reply_template: string
  google_review_url: string
  phone_number: string
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
  })
  const [orgId, setOrgId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.org_id)
      const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.org_id).single()
      if (org) setSettings({
        is_missed_call_active: org.is_missed_call_active,
        is_review_engine_active: org.is_review_engine_active,
        is_lead_alerts_active: org.is_lead_alerts_active,
        auto_reply_template: org.auto_reply_template,
        google_review_url: org.google_review_url || '',
        phone_number: org.phone_number || '',
      })
    }
    fetchSettings()
  }, [supabase])

  const handleSave = async () => {
    if (!orgId) return
    setSaving(true)
    await supabase.from('organizations').update(settings).eq('id', orgId)
    setSaving(false)
    alert('Settings saved!')
  }

  const Toggle = ({ label, description, field }: { label: string; description: string; field: keyof OrgSettings }) => (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        onClick={() => setSettings(s => ({ ...s, [field]: !s[field as keyof OrgSettings] }))}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings[field as keyof OrgSettings] ? 'bg-primary' : 'bg-muted'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings[field as keyof OrgSettings] ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automation Settings</h1>
        <p className="text-muted-foreground">Control your automation engines and SMS templates.</p>
      </div>

      {/* Master Toggles */}
      <Card>
        <CardHeader>
          <CardTitle>Automation Controls</CardTitle>
          <CardDescription>Enable or disable each automation engine independently.</CardDescription>
        </CardHeader>
        <CardContent>
          <Toggle
            label="Missed-Call Auto-Text"
            description="Automatically send an SMS to every missed caller."
            field="is_missed_call_active"
          />
          <Toggle
            label="Post-Job Review Dispatcher"
            description="Send review request SMS after a job is completed."
            field="is_review_engine_active"
          />
          <Toggle
            label="Instant Inbound Form SMS"
            description="Notify team when a website form lead comes in."
            field="is_lead_alerts_active"
          />
        </CardContent>
      </Card>

      {/* SMS Template */}
      <Card>
        <CardHeader>
          <CardTitle>Auto-Reply SMS Template</CardTitle>
          <CardDescription>Message sent automatically when a call is missed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="template">Message Template</Label>
            <textarea
              id="template"
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={settings.auto_reply_template}
              onChange={e => setSettings(s => ({ ...s, auto_reply_template: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Available chips: <code className="bg-muted px-1 rounded">{'{business_name}'}</code> <code className="bg-muted px-1 rounded">{'{customer_name}'}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Google Review URL & Forwarding Phone */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Settings</CardTitle>
          <CardDescription>Configure your Google Review link and call forwarding number.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="review_url">Google Review URL</Label>
            <Input
              id="review_url"
              placeholder="https://g.page/r/your-business/review"
              value={settings.google_review_url}
              onChange={e => setSettings(s => ({ ...s, google_review_url: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="forward_phone">Forwarding Target Phone</Label>
            <Input
              id="forward_phone"
              placeholder="(555) 555-5555"
              value={settings.phone_number}
              onChange={e => setSettings(s => ({ ...s, phone_number: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-fit">
        {saving ? 'Saving...' : 'Save All Settings'}
      </Button>
    </div>
  )
}
