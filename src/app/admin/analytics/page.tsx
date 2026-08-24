'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { Activity, PhoneMissed, Star, Users, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from 'recharts'

interface PlatformMetrics {
  totalMissedCalls: number
  totalReviewsSent: number
  totalLeads: number
  totalActivity: number
  totalOrgs: number
}

interface DailyData {
  day: string
  missed_calls: number
  reviews: number
  leads: number
}

interface TopClient {
  name: string
  count: number
}

export default function PlatformAnalytics() {
  const supabase = createClient()
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null)
  const [chartData, setChartData] = useState<DailyData[]>([])
  const [topClients, setTopClients] = useState<TopClient[]>([])

  useEffect(() => {
    const fetchMetrics = async () => {
      const [
        { count: totalMissedCalls },
        { count: totalReviewsSent },
        { count: totalLeads },
        { count: totalActivity },
        { count: totalOrgs },
      ] = await Promise.all([
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'missed_call'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'review_invite'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('type', 'website_form'),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }),
        supabase.from('organizations').select('*', { count: 'exact', head: true }),
      ])
      setMetrics({ totalMissedCalls: totalMissedCalls ?? 0, totalReviewsSent: totalReviewsSent ?? 0, totalLeads: totalLeads ?? 0, totalActivity: totalActivity ?? 0, totalOrgs: totalOrgs ?? 0 })
    }

    const fetchChartData = async () => {
      // Build last 30 days buckets
      const days: Record<string, DailyData> = {}
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        days[key] = { day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), missed_calls: 0, reviews: 0, leads: 0 }
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const { data } = await supabase
        .from('activity_logs')
        .select('type,created_at,org_id')
        .gte('created_at', thirtyDaysAgo.toISOString())

      if (data) {
        data.forEach((log) => {
          const key = log.created_at?.slice(0, 10)
          if (key && days[key]) {
            if (log.type === 'missed_call') days[key].missed_calls++
            else if (log.type === 'review_invite') days[key].reviews++
            else if (log.type === 'website_form') days[key].leads++
          }
        })

        // Top clients by activity volume this month
        const orgCounts: Record<string, number> = {}
        data.forEach((log) => { orgCounts[log.org_id] = (orgCounts[log.org_id] ?? 0) + 1 })
        const orgIds = Object.keys(orgCounts)
        if (orgIds.length > 0) {
          const { data: orgs } = await supabase.from('organizations').select('id,name').in('id', orgIds)
          if (orgs) {
            const top = orgs
              .map((o) => ({ name: o.name, count: orgCounts[o.id] ?? 0 }))
              .sort((a, b) => b.count - a.count)
              .slice(0, 5)
            setTopClients(top)
          }
        }
      }
      setChartData(Object.values(days))
    }

    fetchMetrics()
    fetchChartData()
  }, [supabase])

  const stats = [
    { label: 'Missed Calls Saved', value: metrics?.totalMissedCalls, icon: PhoneMissed, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-l-blue-500' },
    { label: 'Review Requests', value: metrics?.totalReviewsSent, icon: Star, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-l-amber-500' },
    { label: 'Form Leads', value: metrics?.totalLeads, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-l-emerald-500' },
    { label: 'Total Activity', value: metrics?.totalActivity, icon: Activity, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-l-purple-500' },
    { label: 'Active Accounts', value: metrics?.totalOrgs, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-l-cyan-500' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Platform Analytics</h1>
        <p className="text-slate-400">Aggregate metrics across {metrics?.totalOrgs ?? '...'} client accounts.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.label} className={`bg-slate-900 border-slate-800 text-slate-50 border-l-4 ${stat.border}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-400">{stat.label}</CardTitle>
              <div className={`h-8 w-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {metrics === null ? (
                <Skeleton className="h-8 w-16 bg-slate-800" />
              ) : (
                <div className="text-2xl font-bold text-white">{stat.value?.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 30-Day Area Chart */}
      <Card className="bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle className="text-base">Platform Activity — Last 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <Skeleton className="h-64 w-full bg-slate-800" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="colorMissed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} interval={4} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="missed_calls" name="Missed Calls" stroke="#3b82f6" strokeWidth={2} fill="url(#colorMissed)" dot={false} />
                  <Area type="monotone" dataKey="reviews" name="Review Requests" stroke="#f59e0b" strokeWidth={2} fill="url(#colorReviews)" dot={false} />
                  <Area type="monotone" dataKey="leads" name="Form Leads" stroke="#10b981" strokeWidth={2} fill="url(#colorLeads)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Clients Leaderboard */}
      {topClients.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 text-slate-50">
          <CardHeader>
            <CardTitle className="text-base">Most Active Clients — This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topClients} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8', fontSize: 12 }}
                    itemStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="count" name="Actions" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
