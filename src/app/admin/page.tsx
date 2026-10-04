'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  MessageSquare, 
  Zap, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Flame, 
  ArrowRight,
  ShieldCheck,
  CreditCard,
  PhoneCall,
  Activity,
  Terminal
} from 'lucide-react'
import { PlatformOverview, TenantHealthSummary } from '@/lib/admin/admin-service'

export default function AdminOverviewPage() {
  const [overview, setOverview] = useState<PlatformOverview | null>(null)
  const [tenantsWithIssues, setTenantsWithIssues] = useState<TenantHealthSummary[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [resOverview, resTenants] = await Promise.all([
        fetch('/api/admin/overview'),
        fetch('/api/admin/tenants')
      ])

      if (resOverview.ok) {
        const data = await resOverview.json()
        setOverview(data)
      }

      if (resTenants.ok) {
        const data = await resTenants.json()
        const degradedOrWarning = (data.tenants || []).filter(
          (t: TenantHealthSummary) => t.healthGrade !== 'healthy' || t.subscriptionStatus === 'suspended'
        )
        setTenantsWithIssues(degradedOrWarning)
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const orgs = overview?.organizations
  const messaging = overview?.messaging
  const auto = overview?.automation
  const integ = overview?.integrations

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Platform Command Center
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
              Live Operations
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Global multi-tenant operations, messaging delivery, background queues, and integration status.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/events"
            className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 px-3.5 py-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            <Terminal className="h-4 w-4 text-amber-400" />
            <span>Event Debugger</span>
          </Link>

          <Link
            href="/admin/simulator"
            className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs px-3.5 py-2 transition-all shadow-md shadow-amber-500/20"
          >
            <Flame className="h-4 w-4 fill-black" />
            <span>Sales Simulator</span>
          </Link>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Platform Overview"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. Organizations Breakdown Cards */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
            Tenant Organizations ({orgs?.total ?? 0})
          </h2>
          <span className="text-xs font-mono font-semibold text-emerald-400">
            Platform MRR: ${orgs?.mrr.toLocaleString() ?? '0'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Active */}
          <Link
            href="/admin/organizations?status=active"
            className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 hover:border-emerald-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-emerald-400">Active Tenants</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-3xl font-extrabold text-white">{orgs?.active ?? 0}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Paying subscription active</p>
          </Link>

          {/* Trial */}
          <Link
            href="/admin/organizations?status=trial"
            className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 hover:border-blue-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-blue-400">Trial Period</span>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <div className="text-3xl font-extrabold text-white">{orgs?.trial ?? 0}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Active evaluation window</p>
          </Link>

          {/* Suspended */}
          <Link
            href="/admin/organizations?status=suspended"
            className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 hover:border-amber-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-amber-400">Suspended</span>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
            </div>
            <div className="text-3xl font-extrabold text-amber-400">{orgs?.suspended ?? 0}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Past due / payment failure</p>
          </Link>

          {/* Churned */}
          <Link
            href="/admin/organizations?status=churned"
            className="rounded-xl bg-zinc-900/80 border border-zinc-800 p-4 hover:border-rose-500/40 transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 group-hover:text-rose-400">Churned</span>
              <span className="h-2 w-2 rounded-full bg-rose-500" />
            </div>
            <div className="text-3xl font-extrabold text-zinc-400">{orgs?.churned ?? 0}</div>
            <p className="text-[11px] text-zinc-400 mt-1">Canceled accounts</p>
          </Link>
        </div>
      </section>

      {/* 2. Platform Health Strips: Messaging & Automation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Messaging Health */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Platform Messaging
              </h3>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-400">
              {messaging?.deliveryRate ?? 100}% Delivery Rate
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Sent</p>
              <div className="text-xl font-extrabold text-white mt-1">{messaging?.sent ?? 0}</div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Delivered</p>
              <div className="text-xl font-extrabold text-emerald-400 mt-1">{messaging?.delivered ?? 0}</div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Failed</p>
              <div className="text-xl font-extrabold text-rose-400 mt-1">{messaging?.failed ?? 0}</div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Undelivered</p>
              <div className="text-xl font-extrabold text-amber-400 mt-1">{messaging?.undelivered ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Automation Health */}
        <div className="rounded-2xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Automation & Background Jobs
              </h3>
            </div>
            <span className="text-xs font-mono font-semibold text-zinc-400">
              {auto?.deadLetters ?? 0} in Dead-Letter Queue
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Executions</p>
              <div className="text-xl font-extrabold text-white mt-1">{auto?.executions ?? 0}</div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Failures</p>
              <div className="text-xl font-extrabold text-rose-400 mt-1">{auto?.failures ?? 0}</div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Retries</p>
              <div className="text-xl font-extrabold text-blue-400 mt-1">{auto?.retries ?? 0}</div>
            </div>
            <div className="rounded-xl bg-zinc-950 border border-zinc-800/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Stuck Jobs</p>
              <div className="text-xl font-extrabold text-amber-400 mt-1">{auto?.stuckJobs ?? 0}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Integrations Status Bar */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Core Integrations Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Telnyx */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <PhoneCall className="h-5 w-5 text-blue-400" />
              <div>
                <p className="text-xs font-bold text-white">Telnyx Telephony</p>
                <p className="text-[11px] text-zinc-400">
                  {integ?.telnyx.configuredNumbers ?? 0} configured numbers ({integ?.telnyx.mode} mode)
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
              integ?.telnyx.status === 'operational'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
            }`}>
              {integ?.telnyx.status ?? 'checking'}
            </span>
          </div>

          {/* Stripe */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-teal-400" />
              <div>
                <p className="text-xs font-bold text-white">Stripe Invoicing & Payments</p>
                <p className="text-[11px] text-zinc-400">
                  Webhook & API Keys ({integ?.stripe.mode} mode)
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
              integ?.stripe.status === 'operational'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
            }`}>
              {integ?.stripe.status ?? 'checking'}
            </span>
          </div>

          {/* Webhooks */}
          <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Radio className="h-5 w-5 text-purple-400" />
              <div>
                <p className="text-xs font-bold text-white">Inbound Webhooks</p>
                <p className="text-[11px] text-zinc-400">
                  {integ?.webhooks.recentFailures24h ?? 0} errors in last 24 hours
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
              integ?.webhooks.status === 'operational'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
            }`}>
              {integ?.webhooks.status ?? 'checking'}
            </span>
          </div>
        </div>
      </section>

      {/* 4. Tenants Needing Attention */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Tenants Needing Platform Attention
            </h2>
          </div>
          <Link
            href="/admin/organizations"
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
          >
            All Tenants &rarr;
          </Link>
        </div>

        {tenantsWithIssues.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 p-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white">All Tenant Systems Healthy</h4>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
              No tenants are currently experiencing elevated SMS errors, webhook drops, or automation job failures.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {tenantsWithIssues.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{t.name}</h4>
                    <p className="text-[11px] text-zinc-400">/{t.slug}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                    t.healthGrade === 'degraded'
                      ? 'bg-rose-500/20 text-rose-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {t.healthGrade}
                  </span>
                </div>

                <div className="text-xs text-zinc-400 space-y-1 pt-1 border-t border-zinc-800/80">
                  {t.failedMessagesCount > 0 && (
                    <p className="text-rose-400">• {t.failedMessagesCount} failed SMS</p>
                  )}
                  {t.automationFailuresCount > 0 && (
                    <p className="text-amber-400">• {t.automationFailuresCount} automation failures</p>
                  )}
                  {t.webhookFailuresCount > 0 && (
                    <p className="text-purple-400">• {t.webhookFailuresCount} webhook errors</p>
                  )}
                  {t.subscriptionStatus === 'suspended' && (
                    <p className="text-amber-400">• Subscription suspended</p>
                  )}
                </div>

                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400">
                    Last active: {t.lastActivity ? new Date(t.lastActivity).toLocaleDateString() : 'Never'}
                  </span>
                  <Link
                    href={`/admin/events?orgId=${t.id}`}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                  >
                    Inspect Logs &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
