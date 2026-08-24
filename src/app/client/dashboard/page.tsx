'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Activity, PhoneMissed, Send, Star, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function DashboardOverview() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  
  // Format phone (xxx) xxx-xxxx
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    const formatted = !x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : '')
    setPhone(formatted)
  }

  const handleSendReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || phone.length < 14) return alert("Please enter a valid name and phone number.")
    
    // Trigger POST /api/reviews/send
    await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    })
    
    setName('')
    setPhone('')
    alert("Review invite dispatched!")
  }

  useEffect(() => {
    // Initial fetch
    const fetchLogs = async () => {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setLogs(data)
    }
    
    fetchLogs()

    // Realtime subscription
    const channel = supabase
      .channel('realtime_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, (payload) => {
        setLogs((current) => [payload.new, ...current].slice(0, 10))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">Monitor your automation performance and dispatch review requests.</p>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Missed Calls Saved</CardTitle>
            <PhoneMissed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inbound Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">+4% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviews Sent</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">234</div>
            <p className="text-xs text-muted-foreground">42 posted this month</p>
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
              <Button type="submit" className="w-full">
                <Send className="mr-2 h-4 w-4" /> Send SMS Review
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Realtime Activity Stream */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Activity Stream</CardTitle>
            <CardDescription>Live feed of automated follow-ups.</CardDescription>
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
                    <div className="grid gap-1">
                      <p className="text-sm font-medium leading-none">
                        {log.type === 'missed_call' ? 'Missed Call Follow-up' : log.type === 'review_invite' ? 'Review SMS Sent' : 'Form Lead Captured'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {log.contact_name || 'Unknown'} • {log.contact_phone}
                      </p>
                    </div>
                    <div className="ml-auto font-medium text-xs">
                      <span className={`px-2 py-1 rounded-full ${log.status === 'replied' || log.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {log.status}
                      </span>
                    </div>
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
