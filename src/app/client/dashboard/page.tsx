'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DashboardMetricsGrid } from '@/components/dashboard/metrics-grid'
import { RecentCallsFeed } from '@/components/dashboard/recent-calls-feed'
import { ReviewBoosterCard } from '@/components/dashboard/review-booster-card'
import { Star } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const supabase = createClient()
  const [org, setOrg] = useState<any>(null)
  const [metrics, setMetrics] = useState({
    missedCallsToday: 0,
    activeLeads: 0,
    unreadMessages: 0,
    reviewsSentMonth: 0
  })
  const [recentCalls, setRecentCalls] = useState<any[]>([])

  const loadDashboard = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) return

    const { data: orgData } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', profile.org_id)
      .single()

    if (orgData) setOrg(orgData)

    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)

    const [
      { count: missedCount },
      { count: leadsCount },
      { count: unreadCount },
      { count: reviewsCount },
      { data: recentCallsData }
    ] = await Promise.all([
      supabase.from('calls').select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .gte('created_at', todayStart.toISOString()),
      supabase.from('leads').select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .in('status', ['new', 'contacted']),
      supabase.from('conversations').select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .gt('unread_count', 0),
      supabase.from('activity_logs').select('*', { count: 'exact', head: true })
        .eq('org_id', profile.org_id)
        .eq('event_type', 'review_invite')
        .gte('created_at', monthStart.toISOString()),
      supabase.from('calls').select('*, contacts(name, phone)')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    setMetrics({
      missedCallsToday: missedCount ?? 0,
      activeLeads: leadsCount ?? 0,
      unreadMessages: unreadCount ?? 0,
      reviewsSentMonth: reviewsCount ?? 0
    })

    if (recentCallsData) setRecentCalls(recentCallsData)
  }, [supabase])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  return (
    <div className="space-y-6">
      {/* Top Header Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            What Needs Your Attention
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time lead recovery and customer follow-up overview.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 px-4 py-2.5 shadow-sm">
          <div className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <div className="text-left">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Safety Net Forwarding</p>
            <p className="text-xs font-bold text-emerald-400">
              {org?.telnyx_phone_number || 'Forwarding Active'}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <DashboardMetricsGrid {...metrics} />

      {/* Main Operations Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">Recent Missed Call Activity</h2>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400 border border-blue-500/20">Live</span>
            </div>
            <Link href="/client/inbox" className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors">
              Full Inbox &rarr;
            </Link>
          </div>
          <RecentCallsFeed calls={recentCalls} />
        </div>

        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
              1-Click Google Review Booster
            </h2>
            <span className="text-xs text-zinc-400 font-medium">Post-Job Weapon</span>
          </div>
          <ReviewBoosterCard 
            businessName={org?.name} 
            reviewUrl={org?.google_review_url}
            onSent={() => setMetrics(m => ({ ...m, reviewsSentMonth: m.reviewsSentMonth + 1 }))}
          />
        </div>
      </div>
    </div>
  )
}
