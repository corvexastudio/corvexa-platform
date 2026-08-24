import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function SystemHealth() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">System Health</h1>
        <p className="text-slate-400">Monitor external APIs and webhook statuses.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle>Twilio REST API</CardTitle>
            <CardDescription className="text-slate-400">Outbound SMS Service</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-emerald-500/10 text-emerald-500">Operational</Badge>
            <p className="text-xs text-slate-500 mt-2">Latency: 45ms</p>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle>Webhook Ingestion</CardTitle>
            <CardDescription className="text-slate-400">Incoming Calls</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-emerald-500/10 text-emerald-500">Operational</Badge>
            <p className="text-xs text-slate-500 mt-2">100% Success Rate (24h)</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle>Supabase Realtime</CardTitle>
            <CardDescription className="text-slate-400">WebSocket Connections</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge className="bg-emerald-500/10 text-emerald-500">Operational</Badge>
            <p className="text-xs text-slate-500 mt-2">Connected</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
