import { PhoneMissed, TrendingUp, MessageSquare, Star, Zap } from 'lucide-react'
import Link from 'next/link'

interface MetricsProps {
  missedCallsToday: number
  activeLeads: number
  unreadMessages: number
  reviewsSentMonth: number
}

export function DashboardMetricsGrid({
  missedCallsToday,
  activeLeads,
  unreadMessages,
  reviewsSentMonth
}: MetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* Missed Calls */}
      <div className="rounded-2xl bg-[#0D1322] border border-blue-500/20 p-4 sm:p-5 relative overflow-hidden group hover:border-blue-500/40 transition-all shadow-lg">
        <div className="flex items-center justify-between text-blue-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Missed Calls Today</span>
          <PhoneMissed className="h-5 w-5" />
        </div>
        <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {missedCallsToday}
        </div>
        <p className="text-[11px] text-emerald-400 font-medium mt-1 flex items-center gap-1">
          <Zap className="h-3 w-3" /> Auto-text sent in &lt;15s
        </p>
      </div>

      {/* Active Leads */}
      <div className="rounded-2xl bg-[#0D1322] border border-zinc-800/80 p-4 sm:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all shadow-lg">
        <div className="flex items-center justify-between text-emerald-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Active Leads</span>
          <TrendingUp className="h-5 w-5" />
        </div>
        <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {activeLeads}
        </div>
        <Link href="/client/leads" className="text-[11px] text-zinc-400 hover:text-white font-medium mt-1 flex items-center gap-1 transition-colors">
          View pipeline &rarr;
        </Link>
      </div>

      {/* Unread Texts */}
      <div className="rounded-2xl bg-[#0D1322] border border-zinc-800/80 p-4 sm:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all shadow-lg">
        <div className="flex items-center justify-between text-indigo-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Unread Texts</span>
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {unreadMessages}
        </div>
        <Link href="/client/inbox" className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium mt-1 flex items-center gap-1 transition-colors">
          Open 2-way inbox &rarr;
        </Link>
      </div>

      {/* Reviews Sent */}
      <div className="rounded-2xl bg-[#0D1322] border border-zinc-800/80 p-4 sm:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all shadow-lg">
        <div className="flex items-center justify-between text-amber-400 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">5★ Reviews Sent</span>
          <Star className="h-5 w-5" />
        </div>
        <div className="text-3xl sm:text-4xl font-black text-white tracking-tight">
          {reviewsSentMonth}
        </div>
        <p className="text-[11px] text-zinc-400 font-medium mt-1">This month</p>
      </div>
    </div>
  )
}
