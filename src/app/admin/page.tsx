'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { 
  Building2, 
  PhoneCall, 
  DollarSign, 
  Flame, 
  ArrowUpRight, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Plus
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function AdminOverviewPage() {
  const supabase = createClient()
  const [stats, setStats] = useState({
    totalTenants: 0,
    activeTenants: 0,
    mrr: 0,
    totalCalls: 0,
    missedCallsToday: 0,
    totalLeads: 0
  })
  const [recentCalls, setRecentCalls] = useState<any[]>([])
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const [
      { data: orgs },
      { count: allCallsCount },
      { count: todayMissedCount },
      { count: leadsCount },
      { data: callsData }
    ] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('calls').select('*', { count: 'exact', head: true }),
      supabase.from('calls').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()).eq('status', 'missed'),
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('calls').select('*, organizations(name)').order('created_at', { ascending: false }).limit(6)
    ])

    const orgList = orgs || []
    const active = orgList.filter(o => o.subscription_status === 'active' || !o.subscription_status)
    const mrr = active.reduce((acc, curr) => acc + Number(curr.monthly_rate || 99), 0)

    setStats({
      totalTenants: orgList.length,
      activeTenants: active.length,
      mrr,
      totalCalls: allCallsCount || 0,
      missedCallsToday: todayMissedCount || 0,
      totalLeads: leadsCount || 0
    })

    setTenants(orgList.slice(0, 5))
    setRecentCalls(callsData || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="space-y-6">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Agency Command Center
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Global multi-tenant overview, live telephony metrics, and revenue health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/admin/simulator">
            <Button className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs h-9 px-3.5 gap-2 shadow-lg shadow-amber-500/20">
              <Flame className="h-4 w-4 fill-black" />
              <span>Launch Demo Simulator</span>
            </Button>
          </Link>
          <Link href="/admin/organizations">
            <Button variant="outline" className="border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 text-xs h-9 px-3 gap-2">
              <Building2 className="h-4 w-4" />
              <span>Manage Tenants</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0A0E18] border-zinc-800/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Monthly Recurring Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <CardTitle className="text-3xl font-black text-white mt-1">
              ${stats.mrr.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              From <span className="text-emerald-400 font-semibold">{stats.activeTenants}</span> active client subscriptions
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0A0E18] border-zinc-800/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Client Tenants</span>
              <Building2 className="h-4 w-4 text-blue-400" />
            </div>
            <CardTitle className="text-3xl font-black text-white mt-1">
              {stats.totalTenants}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              <span className="text-blue-400 font-semibold">{stats.activeTenants} Active</span> · {stats.totalTenants - stats.activeTenants} in Trial / Suspended
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0A0E18] border-zinc-800/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Missed Calls Recovered</span>
              <PhoneCall className="h-4 w-4 text-amber-400" />
            </div>
            <CardTitle className="text-3xl font-black text-white mt-1">
              {stats.totalCalls}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              <span className="text-amber-400 font-semibold">{stats.missedCallsToday}</span> recovered today across all contractors
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#0A0E18] border-zinc-800/80 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-xs font-semibold uppercase tracking-wider">Leads &amp; Enquiries</span>
              <CheckCircle2 className="h-4 w-4 text-purple-400" />
            </div>
            <CardTitle className="text-3xl font-black text-white mt-1">
              {stats.totalLeads}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              Directly routed into client Kanban boards
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2-Column Split: Active Tenants & Live Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Client Tenants Roster (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="bg-[#0A0E18] border-zinc-800/80">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800/60">
              <div>
                <CardTitle className="text-base text-white font-bold">Active Client Tenants</CardTitle>
                <CardDescription className="text-xs text-zinc-400">Contractor organizations currently on CaptoDesk</CardDescription>
              </div>
              <Link href="/admin/organizations" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="pt-3">
              {tenants.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                  <p>No client tenants registered yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Clients who sign up via Google will appear here automatically.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {tenants.map(t => (
                    <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-white">{t.name}</p>
                        <p className="text-xs text-zinc-400 font-mono">
                          {t.telnyx_phone_number || t.owner_phone || 'Forwarding not configured'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={t.is_missed_call_active ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-[10px]" : "border-zinc-700 text-zinc-400 text-[10px]"}>
                          {t.is_missed_call_active ? "Engine ON" : "Paused"}
                        </Badge>
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-[10px]">
                          ${t.monthly_rate || 99}/mo
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Live Platform Ingestion Feed (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-[#0A0E18] border-zinc-800/80">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800/60">
              <div>
                <CardTitle className="text-base text-white font-bold">Recent Telephony Calls</CardTitle>
                <CardDescription className="text-xs text-zinc-400">Live call events processed by Telnyx</CardDescription>
              </div>
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            </CardHeader>
            <CardContent className="pt-3">
              {recentCalls.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  <PhoneCall className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
                  <p>No calls logged yet.</p>
                  <p className="text-xs text-zinc-600 mt-1">Calls will stream in as soon as carriers forward to your Telnyx line.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentCalls.map(call => (
                    <div key={call.id} className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-xs">
                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="font-semibold text-white">{call.caller_number}</span>
                        <Badge variant="outline" className={call.auto_reply_sent ? "border-emerald-500/30 text-emerald-400 text-[10px]" : "border-zinc-700 text-zinc-400 text-[10px]"}>
                          {call.auto_reply_sent ? "SMS Sent" : call.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 mt-1">
                        <span>{call.organizations?.name || 'Client Org'}</span>
                        <span>{new Date(call.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
