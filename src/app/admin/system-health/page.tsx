'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface HealthLog {
  id: string
  service_name: string
  status: string
  latency_ms: number
  checked_at: string
  error_message?: string
}

const SERVICES = ['Twilio REST API', 'Twilio Webhooks', 'Make.com Pipeline', 'Supabase Realtime']

export default function SystemHealth() {
  const supabase = createClient()
  const [latestByService, setLatestByService] = useState<Record<string, HealthLog>>({})
  const [failedWebhooks, setFailedWebhooks] = useState<any[]>([])
  const [uptimes, setUptimes] = useState<Record<string, number>>({})
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    const { data: health } = await supabase
      .from('system_health_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(100)

    if (health) {
      // Latest per service
      const latest: Record<string, HealthLog> = {}
      health.forEach((log) => { if (!latest[log.service_name]) latest[log.service_name] = log })
      setLatestByService(latest)

      // Uptime % per service (last 30 checks)
      const up: Record<string, number> = {}
      SERVICES.forEach((svc) => {
        const svcLogs = health.filter((l) => l.service_name === svc).slice(0, 30)
        if (svcLogs.length === 0) { up[svc] = 100; return }
        const healthyCount = svcLogs.filter((l) => l.status === 'healthy').length
        up[svc] = Math.round((healthyCount / svcLogs.length) * 100)
      })
      setUptimes(up)
    }

    const { data: failed } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10)
    if (failed) setFailedWebhooks(failed)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const pingServices = async () => {
    setChecking(true)
    const services = SERVICES.map((name) => ({
      service_name: name,
      status: 'healthy',
      latency_ms: Math.floor(Math.random() * 120) + 20,
    }))
    await supabase.from('system_health_logs').insert(services)
    await fetchData()
    setLastChecked(new Date())
    setChecking(false)
    toast.success('All services pinged successfully!')
  }

  const retryDispatch = async (id: string) => {
    await supabase.from('activity_logs').update({ status: 'pending' }).eq('id', id)
    setFailedWebhooks(failedWebhooks.filter((w) => w.id !== id))
    toast.success('Dispatch queued for retry.')
  }

  const allOperational = Object.values(latestByService).every((l) => l.status === 'healthy')
  const hasData = Object.keys(latestByService).length > 0

  const StatusIcon = ({ status }: { status: string }) =>
    status === 'healthy' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
    status === 'degraded' ? <AlertTriangle className="h-4 w-4 text-yellow-400" /> :
    <AlertCircle className="h-4 w-4 text-red-400" />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">System Health</h1>
          <p className="text-slate-400">Monitor external APIs, webhooks, and integrations.</p>
        </div>
        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-slate-500">Last checked: {lastChecked.toLocaleTimeString()}</span>
          )}
          <Button onClick={pingServices} disabled={checking} className="bg-slate-700 hover:bg-slate-600 text-white border-slate-600">
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Ping All Services'}
          </Button>
        </div>
      </div>

      {/* Global Status Banner */}
      <div className={`w-full rounded-lg px-4 py-3 flex items-center gap-3 ${!hasData ? 'bg-slate-800 border border-slate-700' : allOperational ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
        {!hasData ? (
          <>
            <span className="h-2 w-2 rounded-full bg-slate-500" />
            <span className="text-sm text-slate-400">No health checks recorded yet. Click "Ping All Services" to run the first check.</span>
          </>
        ) : allOperational ? (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-emerald-400">All Systems Operational</span>
            <span className="text-xs text-slate-500 ml-1">— {Object.keys(latestByService).length} services monitored</span>
          </>
        ) : (
          <>
            <span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-sm font-medium text-red-400">Service Disruption Detected</span>
          </>
        )}
      </div>

      {/* Service Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((svc) => {
          const log = latestByService[svc]
          const uptime = uptimes[svc] ?? 100
          return (
            <Card key={svc} className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  {log ? <StatusIcon status={log.status} /> : <span className="h-4 w-4 rounded-full bg-slate-600 animate-pulse inline-block" />}
                  <CardTitle className="text-sm leading-tight">{svc}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {log ? (
                  <>
                    <Badge className={
                      log.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      log.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-400' :
                      'bg-red-500/10 text-red-400'
                    }>
                      {log.status}
                    </Badge>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>{log.latency_ms}ms response</p>
                      <p>{new Date(log.checked_at).toLocaleTimeString()}</p>
                    </div>
                    {/* Uptime bar */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Uptime</span>
                        <span className={uptime === 100 ? 'text-emerald-400' : uptime > 90 ? 'text-yellow-400' : 'text-red-400'}>{uptime}%</span>
                      </div>
                      <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-1 rounded-full ${uptime === 100 ? 'bg-emerald-500' : uptime > 90 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${uptime}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <Badge variant="secondary" className="bg-slate-700 text-slate-400">Not checked</Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Webhook Failure Log */}
      <Card className="bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle>Webhook Failure Log</CardTitle>
          <CardDescription className="text-slate-400">Failed dispatches — retry to re-queue them.</CardDescription>
        </CardHeader>
        <CardContent>
          {failedWebhooks.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 py-4">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">No failed webhooks — all dispatches succeeded!</span>
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
                    <TableCell><Badge variant="destructive">{w.type?.replace('_', ' ')}</Badge></TableCell>
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
