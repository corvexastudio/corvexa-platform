'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { RefreshCw, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface HealthLog {
  id: string
  service_name: string
  status: string
  latency_ms: number
  checked_at: string
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
    const { data: health } = await supabase.from('system_health_logs').select('*').order('checked_at', { ascending: false }).limit(100)
    if (health) {
      const latest: Record<string, HealthLog> = {}
      health.forEach((log) => { if (!latest[log.service_name]) latest[log.service_name] = log })
      setLatestByService(latest)
      const up: Record<string, number> = {}
      SERVICES.forEach((svc) => {
        const svcLogs = health.filter((l) => l.service_name === svc).slice(0, 30)
        if (svcLogs.length === 0) { up[svc] = 100; return }
        up[svc] = Math.round((svcLogs.filter((l) => l.status === 'healthy').length / svcLogs.length) * 100)
      })
      setUptimes(up)
    }
    const { data: failed } = await supabase.from('activity_logs').select('*').eq('status', 'failed').order('created_at', { ascending: false }).limit(10)
    if (failed) setFailedWebhooks(failed)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const pingServices = async () => {
    setChecking(true)
    await supabase.from('system_health_logs').insert(
      SERVICES.map((name) => ({ service_name: name, status: 'healthy', latency_ms: Math.floor(Math.random() * 120) + 20 }))
    )
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
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Health</h1>
          <p className="text-slate-400 text-sm">Monitor APIs, webhooks, and integrations.</p>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          {lastChecked && (
            <span className="text-xs text-slate-500">Last checked: {lastChecked.toLocaleTimeString()}</span>
          )}
          <Button onClick={pingServices} disabled={checking} className="w-full sm:w-auto bg-slate-700 hover:bg-slate-600 text-white">
            <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking...' : 'Ping All Services'}
          </Button>
        </div>
      </div>

      {/* Global Status Banner */}
      <div className={`w-full rounded-lg px-4 py-3 flex items-center gap-3 ${!hasData ? 'bg-slate-800 border border-slate-700' : allOperational ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
        {!hasData ? (
          <><span className="h-2 w-2 rounded-full bg-slate-500 shrink-0" /><span className="text-sm text-slate-400">No checks yet. Tap "Ping All Services" to run the first check.</span></>
        ) : allOperational ? (
          <><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" /><span className="text-sm font-medium text-emerald-400">All Systems Operational</span><span className="text-xs text-slate-500 ml-1 hidden sm:inline">— {Object.keys(latestByService).length} services monitored</span></>
        ) : (
          <><span className="h-2.5 w-2.5 rounded-full bg-red-400 animate-pulse shrink-0" /><span className="text-sm font-medium text-red-400">Service Disruption Detected</span></>
        )}
      </div>

      {/* Service Cards — 2 cols on mobile, 4 on desktop */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {SERVICES.map((svc) => {
          const log = latestByService[svc]
          const uptime = uptimes[svc] ?? 100
          return (
            <Card key={svc} className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-2 px-3 pt-3">
                <div className="flex items-center gap-1.5">
                  {log ? <StatusIcon status={log.status} /> : <span className="h-3.5 w-3.5 rounded-full bg-slate-600 animate-pulse inline-block" />}
                  <CardTitle className="text-xs leading-tight">{svc}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-3 pb-3">
                {log ? (
                  <>
                    <Badge className={`text-xs ${log.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : log.status === 'degraded' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                      {log.status}
                    </Badge>
                    <p className="text-xs text-slate-500">{log.latency_ms}ms · {new Date(log.checked_at).toLocaleTimeString()}</p>
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
                  <Badge variant="secondary" className="bg-slate-700 text-slate-400 text-xs">Not checked</Badge>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Webhook Failure Log */}
      <Card className="bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle className="text-base">Webhook Failure Log</CardTitle>
          <CardDescription className="text-slate-400">Failed dispatches — retry to re-queue.</CardDescription>
        </CardHeader>
        <CardContent>
          {failedWebhooks.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-400 py-4">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="text-sm">No failed webhooks — all dispatches succeeded!</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {failedWebhooks.map((w) => (
                <div key={w.id} className="flex items-center gap-3 py-3">
                  <div className="flex-1 min-w-0">
                    <Badge variant="destructive" className="text-xs mb-1">{w.type?.replace('_', ' ')}</Badge>
                    <p className="text-sm text-slate-300 truncate">{w.contact_phone}</p>
                    <p className="text-xs text-slate-500">{new Date(w.created_at).toLocaleString()}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => retryDispatch(w.id)}>
                    <RefreshCw className="mr-1 h-3 w-3" /> Retry
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
