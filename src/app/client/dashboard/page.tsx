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
      <div className={`flex items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${allActive ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'}`}>
        {allActive
          ? <><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> All automations active</>
          : <><AlertTriangle className="h-4 w-4 shrink-0" /> Some automations are off — <Link href="/settings" className="underline underline-offset-2 ml-1 font-semibold">Turn on</Link></>
        }
      </div>

      {/* Time Range Toggle */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-2xl w-full">
        {(['today', 'week', 'month'] as Range[]).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${range === r ? 'bg-white shadow-sm text-zinc-950' : 'text-zinc-400 hover:text-zinc-600'}`}
          >
            {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Hero Number */}
      <div className="bg-white border border-zinc-100 rounded-2xl px-6 py-6 shadow-sm">
        {loading ? (
          <div className="h-14 w-40 bg-zinc-100 animate-pulse rounded-xl mb-2" />
        ) : (
          <>
            <p className="text-6xl font-bold tracking-tight text-zinc-950">
              {metrics.leads}
            </p>
            <p className="text-lg text-zinc-500 mt-1 font-medium">
              lead{metrics.leads !== 1 ? 's' : ''} {rangeLabel(range)}
            </p>
            <p className="text-sm text-zinc-400 mt-0.5">{trendText}</p>
          </>
        )}

        {/* Secondary chips */}
        <div className="flex gap-2 mt-5 flex-wrap">
          <Link href="/activity" className="flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-2 rounded-full hover:bg-blue-100 transition-colors border border-blue-100">
            <PhoneMissed className="h-3.5 w-3.5" />
            {loading ? '—' : metrics.missedCalls} calls saved
          </Link>
          <Link href="/reviews" className="flex items-center gap-2 bg-amber-50 text-amber-700 text-sm font-semibold px-4 py-2 rounded-full hover:bg-amber-100 transition-colors border border-amber-100">
            <Star className="h-3.5 w-3.5" />
            {loading ? '—' : metrics.reviewsSent} reviews sent
          </Link>
        </div>
      </div>

      {/* Quick Action — Send a review link */}
      <div className="bg-white border border-zinc-100 rounded-2xl px-6 py-6 shadow-sm">
        <h2 className="text-lg font-bold text-zinc-950 mb-1">Send a review link</h2>
        <p className="text-sm text-zinc-400 mb-5">Text a recent customer a direct link to leave a Google review.</p>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-zinc-700" htmlFor="cname">Customer name</label>
            <input id="cname" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required
              className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-transparent transition-all" />
          </div>
          <div className="grid gap-1.5">
            <label className="text-sm font-medium text-zinc-700" htmlFor="cphone">Phone number</label>
            <input id="cphone" placeholder="(555) 555-5555" value={phone} onChange={handlePhoneChange} maxLength={14} required
              className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base text-zinc-950 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950 focus:border-transparent transition-all" />
          </div>
          <button type="submit" disabled={sending}
            className="w-full h-12 bg-zinc-950 hover:bg-zinc-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60 text-base">
            {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : <><Send className="h-4 w-4" /> Send review link</>}
          </button>
        </form>
      </div>

      {/* Recent Activity Preview */}
      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="text-base font-bold text-zinc-950">Recent activity</h2>
          <Link href="/activity" className="text-sm text-zinc-400 hover:text-zinc-600 flex items-center gap-1 transition-colors">View all <ChevronRight className="h-3.5 w-3.5" /></Link>
        </div>
        <div className="divide-y divide-zinc-50">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-50/60 animate-pulse mx-4 my-2 rounded-xl" />)
          ) : recentLogs.length === 0 ? (
            <p className="text-sm text-zinc-400 py-10 text-center px-4 leading-relaxed">
              No activity yet. Your first missed call or form lead will appear here automatically.
            </p>
          ) : (
            recentLogs.map(log => (
              <div key={log.id} className="flex items-center gap-4 px-6 py-4">
                <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${typeDot[log.type] ?? 'bg-zinc-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 truncate">{typeLabel[log.type] ?? log.type}</p>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{log.contact_name || 'Unknown'} · {log.contact_phone}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full shrink-0 font-semibold ${log.delivery_status === 'delivered' ? 'bg-emerald-50 text-emerald-700' : log.delivery_status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
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
