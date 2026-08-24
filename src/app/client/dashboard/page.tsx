'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PhoneMissed, Send, Star, TrendingUp, Users, Activity, Dot } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Metrics {
  missedCalls: number
  leads: number
  reviewsSent: number
  reviewsPosted: number
}

export default function DashboardOverview() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [metrics, setMetrics] = useState<Metrics | null>(null)
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
    if (!name || phone.length < 14) {
      toast.error('Please enter a valid name and phone number.')
      return
    }
    setSending(true)
    const res = await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    })
    setSending(false)
    if (res.ok) {
      toast.success(`Review invite sent to ${name}!`)
      setName('')
      setPhone('')
    } else {
      toast.error('Failed to send. Please try again.')
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: logsData } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (logsData) setLogs(logsData)

      const [{ count: missedCalls }, { count: leads }, { count: reviewsSent }, { count: reviewsPosted }] =
        await Promise.all([
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'missed_call'),
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'website_form'),
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'review_invite'),
          supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'review_invite').eq('status', 'reviewed'),
        ])
      setMetrics({ missedCalls: missedCalls ?? 0, leads: leads ?? 0, reviewsSent: reviewsSent ?? 0, reviewsPosted: reviewsPosted ?? 0 })
    }

    fetchData()

    const channel = supabase
      .channel('realtime_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs((current) => [payload.new, ...current].slice(0, 10))
        toast.info(`New ${payload.new.type === 'missed_call' ? 'missed call' : payload.new.type === 'review_invite' ? 'review invite' : 'form lead'} from ${payload.new.contact_phone}`)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const metricCards = [
    {
      label: 'Missed Calls Saved',
      value: metrics?.missedCalls,
      sub: 'All time total',
      icon: PhoneMissed,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-l-blue-500',
    },
    {
      label: 'Inbound Leads',
      value: metrics?.leads,
      sub: 'Website form submissions',
      icon: Users,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-l-emerald-500',
    },
    {
      label: 'Review Requests',
      value: metrics?.reviewsSent,
      sub: `${metrics?.reviewsPosted ?? 0} posted this month`,
      icon: Star,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-l-amber-500',
    },
  ]

  const typeConfig: Record<string, { label: string; dot: string }> = {
    missed_call: { label: 'Missed Call Follow-up', dot: 'bg-blue-500' },
    review_invite: { label: 'Review SMS Sent', dot: 'bg-amber-500' },
    website_form: { label: 'Form Lead Captured', dot: 'bg-emerald-500' },
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground text-sm">Monitor your automation performance and dispatch review requests.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {metricCards.map((card) => (
          <Card key={card.label} className={`border-l-4 ${card.border}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <div className={`h-9 w-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {metrics === null ? (
                <Skeleton className="h-8 w-16 mb-1" />
              ) : (
                <div className="text-3xl font-bold">{card.value}</div>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <TrendingUp className="h-3 w-3 text-emerald-500" /> {card.sub}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* SMS Dispatcher */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Dispatch Review Request</CardTitle>
            <CardDescription>Manually text a review link to a recent customer.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendReview} className="flex flex-col gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="name">Customer Name</Label>
                <Input id="name" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="grid gap-1.5">
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Live Activity Stream</CardTitle>
              <CardDescription>Auto-updating feed of automated actions.</CardDescription>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                  <Activity className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
                  <p className="text-xs text-muted-foreground max-w-[220px]">Your first missed call or form lead will appear here automatically.</p>
                </div>
              ) : (
                logs.map((log) => {
                  const config = typeConfig[log.type] ?? { label: log.type, dot: 'bg-muted' }
                  return (
                    <div key={log.id} className="flex items-center gap-3 py-2 border-b last:border-0 last:pb-0">
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${config.dot}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none truncate">{config.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {log.contact_name || 'Unknown'} · {log.contact_phone}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                        log.status === 'replied' || log.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {log.status}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
