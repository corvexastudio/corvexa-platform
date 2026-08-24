'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Send, PhoneMissed, Star, Loader2, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type Range = 'today' | 'week' | 'month'

function getRangeStart(range: Range): Date {
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }
  if (range === 'week') {
    const d = new Date(now); d.setDate(d.getDate() - 7); return d
  }
  const d = new Date(now); d.setDate(1); d.setHours(0, 0, 0, 0); return d
}

function rangeLabel(range: Range) {
  return range === 'today' ? 'today' : range === 'week' ? 'this week' : 'this month'
}

export default function DashboardPage() {
  const supabase = createClient()
  const [range, setRange] = useState<Range>('today')
  const [org, setOrg] = useState<any>(null)
  const [metrics, setMetrics] = useState({ leads: 0, prevLeads: 0, missedCalls: 0, reviewsSent: 0 })
  const [recentLogs, setRecentLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Review dispatch form
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || phone.length < 14) { toast.error('Enter a valid name and phone number.'); return }
    setSending(true)
    const res = await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    })
    setSending(false)
    if (res.ok) { toast.success(`Review link sent to ${name}!`); setName(''); setPhone('') }
    else toast.error('Failed to send. Try again.')
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) { setLoading(false); return }

    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', profile.org_id).single()
    if (orgData) setOrg(orgData)

    const start = getRangeStart(range)

    // Previous period start for trend
    const periodMs = Date.now() - start.getTime()
    const prevStart = new Date(start.getTime() - periodMs)

    const [
      { count: leads },
      { count: prevLeads },
      { count: missedCalls },
      { count: reviewsSent },
      { data: recent },
    ] = await Promise.all([
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('type', 'website_form').gte('created_at', start.toISOString()),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('type', 'website_form').gte('created_at', prevStart.toISOString()).lt('created_at', start.toISOString()),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('type', 'missed_call').gte('created_at', start.toISOString()),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('type', 'review_invite').gte('created_at', start.toISOString()),
      supabase.from('activity_logs').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(3),
    ])

    setMetrics({ leads: leads ?? 0, prevLeads: prevLeads ?? 0, missedCalls: missedCalls ?? 0, reviewsSent: reviewsSent ?? 0 })
    if (recent) setRecentLogs(recent)
    setLoading(false)
  }, [supabase, range])

  useEffect(() => { fetchData() }, [fetchData])

  // Status strip
  const allActive = org?.is_missed_call_active && org?.is_review_engine_active
  const leadDiff = metrics.leads - metrics.prevLeads
  const trendText = leadDiff === 0
    ? `Same as ${rangeLabel(range === 'today' ? 'today' : range === 'week' ? 'week' : 'month')}.`
    : leadDiff > 0
      ? `Up ${leadDiff} from last period.`
      : `Down ${Math.abs(leadDiff)} from last period.`

  const typeLabel: Record<string, string> = {
    missed_call: 'Missed call follow-up',
    review_invite: 'Review link sent',
    website_form: 'Form lead captured',
  }
  const typeDot: Record<string, string> = {
    missed_call: 'bg-blue-500',
    review_invite: 'bg-amber-500',
    website_form: 'bg-emerald-500',
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">

      {/* Status Strip */}
      <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium ${allActive ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>
        {allActive
          ? <><CheckCircle2 className="h-4 w-4 shrink-0" /> All automations active</>
          : <><AlertTriangle className="h-4 w-4 shrink-0" /> Some automations are off — <Link href="/settings" className="underline underline-offset-2 ml-1">Turn on</Link></>
        }
      </div>

      {/* Time Range Toggle */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-full">
        {(['today', 'week', 'month'] as Range[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${range === r ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
          >
            {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Hero Number */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        {loading ? (
          <div className="h-10 w-32 bg-muted animate-pulse rounded-lg mb-2" />
        ) : (
          <>
            <p className="text-4xl font-bold tracking-tight">
              {metrics.leads} lead{metrics.leads !== 1 ? 's' : ''}
            </p>
            <p className="text-muted-foreground text-sm mt-1">{rangeLabel(range)}. {trendText}</p>
          </>
        )}

        {/* Secondary chips */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <Link href="/activity" className="flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-blue-100 transition-colors">
            <PhoneMissed className="h-3 w-3" />
            {loading ? '—' : metrics.missedCalls} calls saved
          </Link>
          <Link href="/reviews" className="flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-full hover:bg-amber-100 transition-colors">
            <Star className="h-3 w-3" />
            {loading ? '—' : metrics.reviewsSent} reviews sent
          </Link>
        </div>
      </div>

      {/* Quick Action — Send a review link */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        <h2 className="text-base font-semibold mb-1">Send a review link</h2>
        <p className="text-sm text-muted-foreground mb-4">Text a recent customer a direct link to leave a Google review.</p>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="cname">Customer name</Label>
            <Input id="cname" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cphone">Phone number</Label>
            <Input id="cphone" placeholder="(555) 555-5555" value={phone} onChange={handlePhoneChange} maxLength={14} required />
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : <><Send className="mr-2 h-4 w-4" /> Send review link</>}
          </Button>
        </form>
      </div>

      {/* Recent Activity Preview */}
      <div className="bg-background border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b">
          <h2 className="text-sm font-semibold">Recent activity</h2>
          <Link href="/activity" className="text-xs text-primary flex items-center gap-0.5">View all <ChevronRight className="h-3 w-3" /></Link>
        </div>
        <div className="divide-y">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/30 animate-pulse mx-4 my-2 rounded-lg" />)
          ) : recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center px-4">
              No activity yet. Your first missed call or form lead will appear here automatically.
            </p>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3">
                <div className={`h-2 w-2 rounded-full shrink-0 ${typeDot[log.type] ?? 'bg-muted'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{typeLabel[log.type] ?? log.type}</p>
                  <p className="text-xs text-muted-foreground truncate">{log.contact_name || 'Unknown'} · {log.contact_phone}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${log.delivery_status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : log.delivery_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                  {log.delivery_status ?? log.status ?? 'pending'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
