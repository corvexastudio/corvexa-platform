'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Power, 
  ExternalLink,
  PhoneCall,
  Terminal,
  Filter
} from 'lucide-react'
import { toast } from 'sonner'
import { TenantHealthSummary } from '@/lib/admin/admin-service'

export default function AdminOrganizationsPage() {
  const [tenants, setTenants] = useState<TenantHealthSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('query', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/admin/tenants?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
      } else {
        toast.error('Failed to load tenants')
      }
    } catch {
      toast.error('Network error loading tenants')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTenants()
    }, 200)
    return () => clearTimeout(timer)
  }, [fetchTenants])

  const handleStatusChange = async (orgId: string, newStatus: string) => {
    setUpdatingId(orgId)
    try {
      const res = await fetch('/api/admin/organizations/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, status: newStatus })
      })

      if (res.ok) {
        toast.success(`Subscription status updated to ${newStatus}`)
        setTenants(tenants.map(t => t.id === orgId ? { ...t, subscriptionStatus: newStatus as any } : t))
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to update status')
      }
    } catch {
      toast.error('Network error updating status')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Tenant Health & Organizations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time multi-tenant health grades, message delivery integrity, and subscription lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchTenants}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Tenants"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, slug, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          {['all', 'active', 'trial', 'suspended', 'churned'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Health Grade</th>
                <th className="py-3.5 px-4">Subscription</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4">Messaging Failures</th>
                <th className="py-3.5 px-4">Automation / Webhooks</th>
                <th className="py-3.5 px-4">Telnyx Config</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No tenant organizations match the current filters.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                    {/* Name & Slug */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{t.name}</div>
                      <div className="text-[11px] text-zinc-400">/{t.slug} • ${t.monthlyRate}/mo</div>
                    </td>

                    {/* Health Grade */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        t.healthGrade === 'healthy'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : t.healthGrade === 'warning'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          t.healthGrade === 'healthy' ? 'bg-emerald-400' : t.healthGrade === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        {t.healthGrade}
                      </span>
                    </td>

                    {/* Subscription Status Selector */}
                    <td className="py-3.5 px-4">
                      <select
                        value={t.subscriptionStatus}
                        disabled={updatingId === t.id}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-amber-500 transition-colors capitalize ${
                          t.subscriptionStatus === 'active' ? 'text-emerald-400' :
                          t.subscriptionStatus === 'trial' ? 'text-blue-400' :
                          t.subscriptionStatus === 'suspended' ? 'text-amber-400' : 'text-zinc-400'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="trial">Trial</option>
                        <option value="suspended">Suspended</option>
                        <option value="churned">Churned</option>
                      </select>
                    </td>

                    {/* Last Activity */}
                    <td className="py-3.5 px-4 text-zinc-400">
                      {t.lastActivity ? (
                        <div>
                          <p className="text-zinc-200">{new Date(t.lastActivity).toLocaleDateString()}</p>
                          <p className="text-[10px] text-zinc-400">{new Date(t.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">No activity</span>
                      )}
                    </td>

                    {/* Messaging Failures */}
                    <td className="py-3.5 px-4">
                      <span className="text-zinc-200 font-medium">{t.messagesCount} sent</span>
                      {t.failedMessagesCount > 0 ? (
                        <span className="text-rose-400 font-bold ml-1.5">({t.failedMessagesCount} failed)</span>
                      ) : (
                        <span className="text-emerald-400/80 text-[10px] ml-1.5 font-bold">100% OK</span>
                      )}
                    </td>

                    {/* Automation / Webhooks */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className={t.automationFailuresCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                          {t.automationFailuresCount} auto failures
                        </span>
                        {t.webhookFailuresCount > 0 && (
                          <p className="text-purple-400 font-semibold">{t.webhookFailuresCount} webhook errors</p>
                        )}
                      </div>
                    </td>

                    {/* Telnyx Config */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono text-[11px] text-zinc-300">
                        {t.telnyxNumber || 'Not Configured'}
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        {t.isMissedCallActive ? (
                          <span className="text-emerald-400">Safety Net Active</span>
                        ) : (
                          <span className="text-zinc-400">Engine Paused</span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/admin/events?orgId=${t.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/20 transition-colors"
                      >
                        <Terminal className="h-3 w-3" />
                        <span>Inspect</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
