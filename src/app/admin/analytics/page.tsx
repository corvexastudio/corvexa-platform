'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Activity, PhoneMissed, Star, Users } from 'lucide-react'

interface PlatformMetrics {
  totalMissedCalls: number
  totalReviewsSent: number
  totalLeads: number
  totalActivity: number
  totalOrgs: number
}

export default function PlatformAnalytics() {
  const supabase = createClient()
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalMissedCalls: 0,
    totalReviewsSent: 0,
    totalLeads: 0,
    totalActivity: 0,
    totalOrgs: 0,
  })

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

      setMetrics({
        totalMissedCalls: totalMissedCalls ?? 0,
        totalReviewsSent: totalReviewsSent ?? 0,
        totalLeads: totalLeads ?? 0,
        totalActivity: totalActivity ?? 0,
        totalOrgs: totalOrgs ?? 0,
      })
    }
    fetchMetrics()
  }, [supabase])

  const stats = [
    { label: 'Total Missed Calls Saved', value: metrics.totalMissedCalls, icon: PhoneMissed, color: 'text-blue-400' },
    { label: 'Total Review Requests', value: metrics.totalReviewsSent, icon: Star, color: 'text-yellow-400' },
    { label: 'Total Form Leads', value: metrics.totalLeads, icon: Users, color: 'text-green-400' },
    { label: 'Total Platform Activity', value: metrics.totalActivity, icon: Activity, color: 'text-purple-400' },
    { label: 'Active Client Accounts', value: metrics.totalOrgs, icon: Users, color: 'text-cyan-400' },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Platform Analytics</h1>
        <p className="text-slate-400">Aggregate metrics across all {metrics.totalOrgs} client accounts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.label} className="bg-slate-900 border-slate-800 text-slate-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">{stat.label}</CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-white">{stat.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
