'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function SystemHealth() {
  const supabase = createClient()
  const [healthLogs, setHealthLogs] = useState<any[]>([])
  const [failedWebhooks, setFailedWebhooks] = useState<any[]>([])
  const [checking, setChecking] = useState(false)

  const fetchData = async () => {
    const { data: health } = await supabase
      .from('system_health_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(20)
    if (health) setHealthLogs(health)

    // Failed webhook logs from activity_logs
    const { data: failed } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10)
    if (failed) setFailedWebhooks(failed)
  }

  useEffect(() => { fetchData() }, [supabase])

  const pingServices = async () => {
    setChecking(true)
    // Insert mock health check entries for demo (replace with real ping logic when Twilio is live)
    const services = [
      { service_name: 'Twilio REST API', status: 'healthy', latency_ms: Math.floor(Math.random() * 100) + 30 },
      { service_name: 'Twilio Webhooks', status: 'healthy', latency_ms: Math.floor(Math.random() * 80) + 20 },
      { service_name: 'Make.com Pipeline', status: 'healthy', latency_ms: Math.floor(Math.random() * 200) + 50 },
      { service_name: 'Supabase Realtime', status: 'healthy', latency_ms: Math.floor(Math.random() * 30) + 5 },
    ]
    await supabase.from('system_health_logs').insert(services)
    await fetchData()
    setChecking(false)
  }

  const retryDispatch = async (id: string) => {
    await supabase.from('activity_logs').update({ status: 'pending' }).eq('id', id)
    setFailedWebhooks(failedWebhooks.filter(w => w.id !== id))
  }

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'healthy') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    if (status === 'degraded') return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    return <AlertCircle className="h-4 w-4 text-red-500" />
  }

  // Get the latest entry per service
  const latestByService = Object.values(
    healthLogs.reduce((acc: any, log) => {
      if (!acc[log.service_name]) acc[log.service_name] = log
      return acc
    }, {})
  ) as any[]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">System Health</h1>
          <p className="text-slate-400">Monitor external APIs, webhooks, and integration statuses.</p>
        </div>
        <Button onClick={pingServices} disabled={checking} className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600">
          <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Ping All Services'}
        </Button>
      </div>

      {/* Service Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {latestByService.length === 0 ? (
          ['Twilio REST API', 'Twilio Webhooks', 'Make.com Pipeline', 'Supabase Realtime'].map(name => (
            <Card key={name} className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary" className="bg-slate-700 text-slate-400">Not checked</Badge>
                <p className="text-xs text-slate-600 mt-2">Click "Ping All Services"</p>
              </CardContent>
            </Card>
          ))
        ) : (
          latestByService.map((log) => (
            <Card key={log.id} className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <StatusIcon status={log.status} />
                  <CardTitle className="text-sm">{log.service_name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Badge className={
                  log.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-500' :
                  log.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-500' :
                  'bg-red-500/10 text-red-500'
                }>
                  {log.status}
                </Badge>
                <p className="text-xs text-slate-500 mt-2">
                  {log.latency_ms ? `${log.latency_ms}ms` : '—'} · {new Date(log.checked_at).toLocaleTimeString()}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Webhook Failure Logs */}
      <Card className="bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle>Webhook Failure Log</CardTitle>
          <CardDescription className="text-slate-400">Failed dispatches with retry actions.</CardDescription>
        </CardHeader>
        <CardContent>
          {failedWebhooks.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-500 py-4">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">No failed webhooks — all systems operational!</span>
            </div>
          ) : (
            <Table>
              <TableHeader className="border-slate-800">
                <TableRow className="border-slate-800">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Type</TableHead>
                  <TableHead className="text-slate-400">Contact</TableHead>
                  <TableHead className="text-slate-400 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failedWebhooks.map((w) => (
                  <TableRow key={w.id} className="border-slate-800">
                    <TableCell className="text-slate-300 text-xs">{new Date(w.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="destructive">{w.type.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-slate-300">{w.contact_phone}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => retryDispatch(w.id)}>
                        <RefreshCw className="mr-1 h-3 w-3" /> Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
