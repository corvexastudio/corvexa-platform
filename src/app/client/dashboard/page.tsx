'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Activity, PhoneMissed, Send, Star, TrendingUp, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Metrics {
  missedCalls: number
  leads: number
  reviewsSent: number
  reviewsPosted: number
}

export default function DashboardOverview() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [metrics, setMetrics] = useState<Metrics>({ missedCalls: 0, leads: 0, reviewsSent: 0, reviewsPosted: 0 })
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [sending, setSending] = useState(false)

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  const handleSendReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || phone.length < 14) return alert('Please enter a valid name and phone number.')
    setSending(true)
    await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    })
    setSending(false)
    setName('')
    setPhone('')
    alert('Review invite dispatched!')
  }

  useEffect(() => {
    const fetchData = async () => {
      // Fetch activity logs
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (logsData) setLogs(logsData)

      // Fetch real metric counts
      const [{ count: missedCalls }, { count: leads }, { count: reviewsSent }, { count: reviewsPosted }] =
        await Promise.all([
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'missed_call'),
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'website_form'),
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'review_invite'),
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'review_invite').eq('status', 'reviewed'),
        ])

      setMetrics({
        missedCalls: missedCalls ?? 0,
        leads: leads ?? 0,
        reviewsSent: reviewsSent ?? 0,
        reviewsPosted: reviewsPosted ?? 0,
      })
    }

    fetchData()

    // Realtime subscription
    const channel = supabase
      .channel('realtime_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs((current) => [payload.new, ...current].slice(0, 10))
        setMetrics((m) => ({
          ...m,
          missedCalls: payload.new.type === 'missed_call' ? m.missedCalls + 1 : m.missedCalls,
          leads: payload.new.type === 'website_form' ? m.leads + 1 : m.leads,
          reviewsSent: payload.new.type === 'review_invite' ? m.reviewsSent + 1 : m.reviewsSent,
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Monitor your automation performance and dispatch review requests.</p>
      </div>

      {/* Real Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Calls Saved</CardTitle>
            <PhoneMissed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.missedCalls}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3 text-green-500" /> All time total</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.leads}</div>
            <p className="text-xs text-muted-foreground">Website form submissions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Review Requests</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.reviewsSent}</div>
            <p className="text-xs text-muted-foreground">{metrics.reviewsPosted} posted this month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Quick Action Bar */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Dispatch Review Request</CardTitle>
            <CardDescription>Manually text a review link to a recent customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendReview} className="flex flex-col gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Customer Name</Label>
                <Input id="name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" placeholder="(555) 555-5555" value={phone} onChange={handlePhoneChange} maxLength={14} required />
              </div>
              <Button type="submit" className="w-full" disabled={sending}>
                <Send className="mr-2 h-4 w-4" /> {sending ? 'Sending...' : 'Send SMS Review'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Realtime Activity Stream */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Live Activity Stream</CardTitle>
            <CardDescription>Auto-updating feed of automated actions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">No recent activity.</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    <div className="grid gap-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none">
                        {log.type === 'missed_call' ? 'Missed Call Follow-up' : log.type === 'review_invite' ? 'Review SMS Sent' : 'Form Lead Captured'}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {log.contact_name || 'Unknown'} • {log.contact_phone}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${log.status === 'replied' || log.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {log.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
