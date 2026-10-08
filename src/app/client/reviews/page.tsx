'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
  ShieldCheck, 
  Activity,
  Globe
} from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

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

function getReviewStatusBadge(status: string) {
  switch (status) {
    case 'delivered':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Delivered
        </span>
      )
    case 'clicked':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Opened
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-300 border border-zinc-700">
          Sent
        </span>
      )
    case 'pending':
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Scheduled
        </span>
      )
    case 'suppressed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-500 border border-zinc-700">
          Suppressed
        </span>
      )
    case 'failed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          {status}
        </span>
      )
  }
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
      } else if (res.status === 403) {
        const err = await res.json().catch(() => ({}))
        if (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization')) {
          window.location.href = '/client/onboarding'
          return
        }
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
        toast.success(`Review link sent to ${name || phone}`)
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
        toast.success('Review automation settings updated')
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
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Reviews & Reputation
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {requests.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Automated Google Business review requests dispatched post-job with strict policy compliance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {settings.googleReviewUrl && (
            <a
              href={settings.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <Globe className="h-3.5 w-3.5 text-blue-400" />
              <span>Google Profile</span>
            </a>
          )}

          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
          >
            <Settings className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
            <span>Settings</span>
          </Button>
        </div>
      </div>

      {/* Honest Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Requests Sent</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">{loading ? '-' : metrics.totalSent}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Outbound SMS invites</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Delivered</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums mt-1">{loading ? '-' : metrics.totalDelivered}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Confirmed network delivery</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Link Clicks</p>
          <p className="text-xl font-bold text-blue-400 tabular-nums mt-1">{loading ? '-' : metrics.totalClicked}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Verified redirect clicks</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Click Rate</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums mt-1">{loading ? '-' : `${metrics.clickRate}%`}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Customer follow-through</p>
        </div>
      </div>

      {/* Manual Dispatch Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="mb-3">
          <h2 className="font-semibold text-xs text-zinc-200">
            Dispatch One-Off Review Invite
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Send an instant review invitation. Respects customer opt-outs and cooldown windows automatically.
          </p>
        </div>

        <form onSubmit={handleSend} className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Input
            placeholder="Customer Name"
            value={name}
            onChange={e => setName(e.target.value)}
            className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
          />
          <Input
            placeholder="(555) 000-0000"
            value={phone}
            onChange={handlePhone}
            className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending}
            className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            <span>Send Invite</span>
          </Button>
        </form>
      </div>

      {/* Recent Requests Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-xs text-zinc-200">Review Requests Log</h2>
          <span className="text-[11px] text-zinc-500 tabular-nums">{requests.length} records</span>
        </div>

        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                <Skeleton className="h-4 w-36 bg-zinc-800" />
                <Skeleton className="h-4 w-28 bg-zinc-800" />
                <Skeleton className="h-4 w-16 bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : requests.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Star}
              title="No Review Requests Yet"
              description="Review requests will be dispatched automatically when field jobs are completed, or you can send one directly using the form above."
              actionLabel="Review Settings"
              onAction={() => setShowSettings(true)}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900/90 border-b border-zinc-800">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Customer</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Job Reference</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Status</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Date</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Clicks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-800">
                {requests.map(req => (
                  <TableRow key={req.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                    <TableCell className="py-3 px-4">
                      <div className="font-medium text-xs text-zinc-100">{req.contacts?.name || 'Customer'}</div>
                      <div className="text-[11px] text-zinc-400 tabular-nums">{req.contacts?.phone || '—'}</div>
                    </TableCell>

                    <TableCell className="py-3 px-4 text-xs text-zinc-300">
                      {req.jobs ? (
                        <span>{req.jobs.job_number} • {req.jobs.title}</span>
                      ) : (
                        <span className="text-zinc-500">Manual Dispatch</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3 px-4">
                      {getReviewStatusBadge(req.status)}
                      {req.suppression_reason && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">{req.suppression_reason}</div>
                      )}
                    </TableCell>

                    <TableCell className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap tabular-nums">
                      {req.sent_at ? new Date(req.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </TableCell>

                    <TableCell className="py-3 px-4 text-right font-medium text-xs text-zinc-300 tabular-nums">
                      {req.click_count > 0 ? (
                        <span className="text-blue-400 font-semibold">{req.click_count}</span>
                      ) : (
                        <span className="text-zinc-600">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Review Automation Settings Modal */}
      <Modal
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Review Automation Settings"
        description="Configure post-job automated review requests and cooldown intervals."
        size="md"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <Label className="text-xs text-zinc-300 mb-1 block">Google Review URL</Label>
            <Input
              placeholder="https://g.page/r/your-google-review-link/review"
              value={settings.googleReviewUrl}
              onChange={e => setSettings({ ...settings, googleReviewUrl: e.target.value })}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Direct link to your Google Business Profile review dialog.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-zinc-300 mb-1 block">Delay After Job (Hours)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={settings.delayHours}
                onChange={e => setSettings({ ...settings, delayHours: parseInt(e.target.value) || 24 })}
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
            </div>

            <div>
              <Label className="text-xs text-zinc-300 mb-1 block">Customer Cooldown (Days)</Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={settings.cooldownDays}
                onChange={e => setSettings({ ...settings, cooldownDays: parseInt(e.target.value) || 60 })}
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="reviewEnabled"
              checked={settings.reviewRequestsEnabled}
              onChange={e => setSettings({ ...settings, reviewRequestsEnabled: e.target.checked })}
              className="rounded border-zinc-800 bg-zinc-950 text-blue-600 h-4 w-4"
            />
            <Label htmlFor="reviewEnabled" className="text-xs text-zinc-200 cursor-pointer">
              Automatically trigger review request when job is marked completed
            </Label>
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(false)}
              className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingSettings}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {savingSettings ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
              Save Settings
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
