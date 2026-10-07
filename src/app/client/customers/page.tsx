'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { 
  Users, 
  Search, 
  Star, 
  RefreshCw, 
  Clock, 
  Calendar,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Loader2,
  DollarSign,
  ChevronRight,
  Tag,
  ArrowUpDown
} from 'lucide-react'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    due: 0,
    overdue: 0,
    inactive: 0,
    totalLtv: 0
  })
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'due' | 'overdue' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'last_activity' | 'ltv' | 'last_service' | 'name'>('last_activity')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningReactivation, setRunningReactivation] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('query', search.trim())
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (sortBy) params.set('sortBy', sortBy)

      const res = await fetch(`/api/client/customers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
        setCounts(data.counts || {})
      } else {
        setError('Failed to load customer directory. Please retry.')
      }
    } catch (err) {
      setError('Network error while loading customer directory.')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, sortBy])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const handleRunReactivation = async () => {
    setRunningReactivation(true)
    try {
      const res = await fetch('/api/client/retention', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Reactivation complete: ${data.reactivatedCount} reminders dispatched.`)
        loadData()
      } else {
        toast.error('Failed to trigger reactivation cycle.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setRunningReactivation(false)
    }
  }

  const statusPills: Record<string, { label: string; class: string; icon: any }> = {
    active: { label: 'Active', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
    due: { label: 'Service Due', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    overdue: { label: 'Overdue', class: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle },
    inactive: { label: 'Inactive', class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: HelpCircle }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-blue-500" />
            Customer Database & Intelligence
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Complete central source of truth for customer history, dynamic interaction timelines, and lifetime value.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunReactivation}
            disabled={runningReactivation}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            {runningReactivation ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
            Run Reactivations
          </Button>
        </div>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="text-zinc-400 text-xs font-medium">Total Customers</div>
          <div className="mt-2 text-2xl font-bold text-white">
            {loading ? <Skeleton className="h-8 w-14 bg-zinc-800 mt-0.5" /> : counts.total}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Verified contacts</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="text-zinc-400 text-xs font-medium">Active Customers</div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">
            {loading ? <Skeleton className="h-8 w-14 bg-zinc-800 mt-0.5" /> : counts.active}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Recent service completed</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="text-zinc-400 text-xs font-medium">Services Due / Overdue</div>
          <div className="mt-2 text-2xl font-bold text-amber-400">
            {loading ? <Skeleton className="h-8 w-14 bg-zinc-800 mt-0.5" /> : counts.due + counts.overdue}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Eligible for reactivation</p>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4">
          <div className="text-zinc-400 text-xs font-medium">Total Lifetime Value</div>
          <div className="mt-2 text-2xl font-bold text-white">
            {loading ? <Skeleton className="h-8 w-20 bg-zinc-800 mt-0.5" /> : `$${counts.totalLtv.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Verified payments collected</p>
        </div>
      </div>

      {/* Filter Tabs, Search & Sort */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs overflow-x-auto">
          {(['all', 'active', 'due', 'overdue', 'inactive'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg capitalize font-medium transition-colors ${
                filterStatus === st ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder="Search name, phone, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-zinc-900 border-zinc-800 text-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-400">
            <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="last_activity" className="bg-zinc-900 text-white">Recent Activity</option>
              <option value="ltv" className="bg-zinc-900 text-white">Lifetime Value</option>
              <option value="last_service" className="bg-zinc-900 text-white">Last Service</option>
              <option value="name" className="bg-zinc-900 text-white">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table / Error / Skeletons */}
      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-red-400">{error}</p>
          <Button onClick={loadData} variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/20">
            Retry Loading Customers
          </Button>
        </div>
      ) : (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="divide-y divide-zinc-800/60 p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 bg-zinc-800" />
                  <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full bg-zinc-800" />
                <Skeleton className="h-4 w-24 bg-zinc-800" />
                <Skeleton className="h-4 w-16 bg-zinc-800" />
                <Skeleton className="h-4 w-16 bg-zinc-800" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="p-4 sm:p-6">
            <EmptyState
              icon={Users}
              title={search ? 'No Matching Customers Found' : 'Your Customer Directory is Empty'}
              description={
                search
                  ? `No customer profiles match "${search}". Try searching by a different name or phone number.`
                  : 'As homeowners call, text, or book services, CaptoDesk builds detailed 360° customer profiles tracking their service history, lifetime revenue, and maintenance schedules.'
              }
              actionLabel={search ? 'Clear Search' : 'View Inbox'}
              onAction={search ? () => setSearch('') : () => router.push('/client/inbox')}
              tip="CaptoDesk automatically captures new callers and saves their details to this directory."
              compact
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Lifecycle Status</th>
                  <th className="px-4 py-3 font-semibold">Last Service</th>
                  <th className="px-4 py-3 font-semibold">Lifetime Value</th>
                  <th className="px-4 py-3 font-semibold">Last Activity</th>
                  <th className="px-4 py-3 font-semibold text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {customers.map(contact => {
                  const statusInfo = statusPills[contact.lifecycle_status || 'active'] || statusPills.active
                  const StatusIcon = statusInfo.icon

                  return (
                    <tr
                      key={contact.id}
                      onClick={() => router.push(`/client/customers/${contact.id}`)}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                    >
                      <td className="px-5 py-3">
                        <div className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                          {contact.name || 'Valued Customer'}
                        </div>
                        <div className="text-zinc-500 text-[11px]">{contact.phone}</div>
                        {contact.tags && contact.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {contact.tags.slice(0, 3).map((t: string) => (
                              <span key={t} className="text-[10px] bg-zinc-800/80 text-zinc-400 px-1.5 py-0.2 rounded">
                                {t}
                              </span>
                            ))}
                            {contact.tags.length > 3 && (
                              <span className="text-[10px] text-zinc-600">+{contact.tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusInfo.class}`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">
                        {contact.last_service_date ? (
                          <div>
                            <div>{new Date(contact.last_service_date).toLocaleDateString()}</div>
                            <div className="text-[10px] text-zinc-500">Every {contact.service_frequency_days || 90}d</div>
                          </div>
                        ) : (
                          <span className="text-zinc-600">No jobs yet</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-semibold text-emerald-400">
                        $${Number(contact.lifetime_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">
                        {contact.last_activity ? new Date(contact.last_activity).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all inline-flex items-center gap-0.5">
                          360 View <ChevronRight className="h-3.5 w-3.5" />
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}
