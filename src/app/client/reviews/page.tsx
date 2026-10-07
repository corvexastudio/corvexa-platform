'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Star, 
  Send, 
  ExternalLink, 
  Loader2, 
  MousePointerClick, 
  CheckCircle2, 
  Settings, 
  Clock, 
  ShieldAlert, 
  Activity,
  Sparkles
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

interface ReviewRequestItem {
  id: string
  token: string
  google_review_url: string
  status: 'pending' | 'scheduled' | 'sent' | 'delivered' | 'failed' | 'clicked' | 'suppressed'
  delivery_status: string
  sent_at?: string
  clicked_at?: string
  click_count: number
  suppression_reason?: string
  contacts?: { name?: string; phone: string }
  jobs?: { job_number: string; title: string }
  created_at: string
}

export default function ReviewsPage() {
  const [metrics, setMetrics] = useState({
    totalSent: 0,
    totalDelivered: 0,
    totalClicked: 0,
    totalSuppressed: 0,
    clickRate: 0
  })
  const [settings, setSettings] = useState({
    googleReviewUrl: '',
    reviewRequestsEnabled: true,
    delayHours: 24,
    cooldownDays: 60
  })
  const [requests, setRequests] = useState<ReviewRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savingSettings, setSavingSettings] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Send single review invite
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/reviews')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data.metrics || {})
        setSettings(data.settings || {})
        setRequests(data.requests || [])
      }
    } catch (err) {
      console.error('Error fetching review data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid 10-digit phone number.')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Feedback & review link dispatched to ${name || phone}!`)
        setName('')
        setPhone('')
        loadData()
      } else {
        toast.error(data.error || 'Failed to dispatch review invite.')
      }
    } catch {
      toast.error('Network error dispatching invite.')
    } finally {
      setSending(false)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await fetch('/api/client/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast.success('Review automation settings updated!')
        setShowSettings(false)
      } else {
        toast.error('Failed to update settings.')
      }
    } catch {
      toast.error('Network error saving settings.')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Star className="h-6 w-6 text-amber-400 fill-amber-400" />
            Reviews & Reputation
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Turn completed jobs into verified Google reviews with zero fake estimates and strict policy compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {settings.googleReviewUrl && (
            <a
              href={settings.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 border border-blue-500/30 rounded-xl px-3 py-2 hover:bg-blue-500/10 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View on Google
            </a>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="border-zinc-800 text-zinc-300 hover:text-white"
          >
            <Settings className="h-4 w-4 mr-1.5" />
            Settings
          </Button>
        </div>
      </div>

      {/* Settings Card */}
      {showSettings && (
        <form onSubmit={handleSaveSettings} className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4 text-blue-400" />
              Review Automation Settings
            </h3>
            <span className="text-xs text-zinc-400">Strictly anti-gating compliant</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Google Review URL</Label>
              <Input
                placeholder="https://g.page/r/your-google-review-link/review"
                value={settings.googleReviewUrl}
                onChange={e => setSettings({ ...settings, googleReviewUrl: e.target.value })}
                className="bg-zinc-950 border-zinc-800 text-sm"
              />
              <p className="text-[11px] text-zinc-500">Direct Google Business Profile review link provided to customers.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Automation Trigger Delay (Hours)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.delayHours}
                onChange={e => setSettings({ ...settings, delayHours: parseInt(e.target.value) || 24 })}
                className="bg-zinc-950 border-zinc-800 text-sm"
              />
              <p className="text-[11px] text-zinc-500">Wait time after job completion before sending review request (Default: 24h).</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Customer Cooldown (Days)</Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={settings.cooldownDays}
                onChange={e => setSettings({ ...settings, cooldownDays: parseInt(e.target.value) || 60 })}
                className="bg-zinc-950 border-zinc-800 text-sm"
              />
              <p className="text-[11px] text-zinc-500">Minimum days between review requests for the same contact (Default: 60d).</p>
            </div>

            <div className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                id="reviewEnabled"
                checked={settings.reviewRequestsEnabled}
                onChange={e => setSettings({ ...settings, reviewRequestsEnabled: e.target.checked })}
                className="rounded border-zinc-700 bg-zinc-900 text-blue-600 focus:ring-blue-500 h-4 w-4"
              />
              <Label htmlFor="reviewEnabled" className="text-sm text-zinc-200 cursor-pointer">
                Automatically send review request on job completion
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowSettings(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={savingSettings} className="bg-blue-600 hover:bg-blue-700">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save Settings
            </Button>
          </div>
        </form>
      )}

      {/* Honest Verifiable Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Requests Sent</span>
            <Send className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {loading ? '-' : metrics.totalSent}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Verified outbound SMS</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Delivered</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {loading ? '-' : metrics.totalDelivered}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Confirmed delivery</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Link Clicks</span>
            <MousePointerClick className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-400">
            {loading ? '-' : metrics.totalClicked}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Cryptographically tracked</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
            <span>Click-Through Rate</span>
            <Activity className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {loading ? '-' : `${metrics.clickRate}%`}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Genuine customer engagement</p>
        </div>
      </div>

      {/* Manual Send Invitation Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
        <h3 className="font-semibold text-white text-sm mb-1 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-400" />
          Send Immediate Review Invitation
        </h3>
        <p className="text-zinc-400 text-xs mb-4">
          Dispatches a trackable review link. Automatically checks opt-outs, invalid phone numbers, and cooldown intervals.
        </p>

        <form onSubmit={handleSend} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Customer Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="bg-zinc-950 border-zinc-800 text-sm"
          />
          <Input
            placeholder="(555) 000-0000"
            value={phone}
            onChange={handlePhone}
            className="bg-zinc-950 border-zinc-800 text-sm"
          />
          <Button
            type="submit"
            disabled={sending}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
            Send Review Link
          </Button>
        </form>
      </div>

      {/* Recent Requests Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between">
          <h3 className="font-semibold text-white text-sm">Review Requests Log</h3>
          <span className="text-xs text-zinc-500">Tracked interactions</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">Loading activity logs...</div>
        ) : requests.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              icon={Star}
              title="No Review Requests Dispatched Yet"
              description="CaptoDesk automatically texts homeowners a link to your Google Business Profile after completed jobs, inviting customers to share honest feedback on Google."
              actionLabel="Adjust Review Settings"
              onAction={() => setShowSettings(true)}
              tip="When you mark a job as 'Completed' in the Jobs pipeline, CaptoDesk schedules a review request automatically."
              compact
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Recipient</th>
                  <th className="px-4 py-3 font-semibold">Job Reference</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Dispatched</th>
                  <th className="px-4 py-3 font-semibold">Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {requests.map(req => {
                  const statusColors: Record<string, string> = {
                    sent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    delivered: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    clicked: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                    failed: 'bg-red-500/10 text-red-400 border-red-500/20',
                    suppressed: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }

                  return (
                    <tr key={req.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-medium text-white">{req.contacts?.name || 'Customer'}</div>
                        <div className="text-zinc-500 text-[11px]">{req.contacts?.phone || '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {req.jobs ? (
                          <span>{req.jobs.job_number} - {req.jobs.title}</span>
                        ) : (
                          <span className="text-zinc-600">Manual / Direct</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusColors[req.status] || statusColors.pending}`}>
                          {req.status}
                        </span>
                        {req.suppression_reason && (
                          <div className="text-[10px] text-zinc-500 mt-0.5">{req.suppression_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {req.sent_at ? new Date(req.sent_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">
                        {req.click_count > 0 ? (
                          <span className="text-purple-400 font-semibold">{req.click_count} click{req.click_count > 1 ? 's' : ''}</span>
                        ) : (
                          <span className="text-zinc-600">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
