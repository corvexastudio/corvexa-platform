'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
  Terminal, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Activity, 
  Play, 
  Radio, 
  CreditCard, 
  Zap, 
  PhoneCall, 
  MessageSquare,
  ShieldCheck,
  FileCode
} from 'lucide-react'
import { toast } from 'sonner'
import { EventTimelineItem } from '@/lib/admin/admin-service'

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventTimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null)
  const [inspecting, setInspecting] = useState(false)
  
  // Diagnostics state
  const [runningDiag, setRunningDiag] = useState<string | null>(null)
  const [diagResult, setDiagResult] = useState<any | null>(null)

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.set('category', categoryFilter)

      const res = await fetch(`/api/admin/events?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      } else {
        toast.error('Failed to load events')
      }
    } catch {
      toast.error('Network error loading events')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const handleInspect = async (eventId: string) => {
    setInspecting(true)
    try {
      const res = await fetch(`/api/admin/events/${eventId}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedEvent(data.event)
      } else {
        toast.error('Failed to inspect event payload')
      }
    } catch {
      toast.error('Network error inspecting event')
    } finally {
      setInspecting(false)
    }
  }

  const runDiagnostic = async (type: 'ping_telnyx' | 'ping_stripe' | 'check_stuck_automations') => {
    setRunningDiag(type)
    setDiagResult(null)
    try {
      const res = await fetch('/api/admin/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diagnosticType: type })
      })

      if (res.ok) {
        const data = await res.json()
        setDiagResult(data.result)
        toast.success(`Diagnostic '${type}' completed`)
      } else {
        const err = await res.json()
        toast.error(err.error || 'Diagnostic failed')
      }
    } catch {
      toast.error('Network error running diagnostic')
    } finally {
      setRunningDiag(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Event Timeline & Safe Diagnostics
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <Terminal className="h-3 w-3" />
              Redacted Payload Inspector
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time webhook and automation telemetry with zero credential exposure.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Timeline"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 1. Safe Diagnostics Suite */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-300">
              Platform Diagnostics Runner
            </h2>
          </div>
          <span className="text-[11px] text-zinc-400">Safe read-only connectivity probes</span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => runDiagnostic('ping_telnyx')}
            disabled={Boolean(runningDiag)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-blue-500/50 text-xs font-semibold text-zinc-200 hover:text-white transition-colors disabled:opacity-50"
          >
            <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
            <span>Ping Telnyx API</span>
          </button>

          <button
            onClick={() => runDiagnostic('ping_stripe')}
            disabled={Boolean(runningDiag)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-teal-500/50 text-xs font-semibold text-zinc-200 hover:text-white transition-colors disabled:opacity-50"
          >
            <CreditCard className="h-3.5 w-3.5 text-teal-400" />
            <span>Verify Stripe Webhook Secret</span>
          </button>

          <button
            onClick={() => runDiagnostic('check_stuck_automations')}
            disabled={Boolean(runningDiag)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/50 text-xs font-semibold text-zinc-200 hover:text-white transition-colors disabled:opacity-50"
          >
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>Detect Stuck Background Jobs</span>
          </button>
        </div>

        {diagResult && (
          <div className="rounded-xl bg-zinc-950 border border-zinc-800 p-4 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between text-zinc-400 border-b border-zinc-800/80 pb-2">
              <span className="text-amber-400 font-bold">Diagnostic Output: {diagResult.diagnostic}</span>
              <span>Latency: {diagResult.latencyMs}ms</span>
            </div>
            <pre className="text-zinc-300 text-[11px] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(diagResult, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* 2. Event Timeline Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          {['all', 'webhook', 'sms', 'automation', 'call', 'billing'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                categoryFilter === cat
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <span className="text-xs text-zinc-400">Showing {events.length} events</span>
      </div>

      {/* 3. Event Timeline Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Event Type</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No platform events recorded matching this category.
                  </td>
                </tr>
              ) : (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                      {new Date(evt.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                      {evt.orgName}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        evt.category === 'webhook' ? 'bg-purple-500/20 text-purple-300' :
                        evt.category === 'sms' ? 'bg-blue-500/20 text-blue-300' :
                        evt.category === 'automation' ? 'bg-amber-500/20 text-amber-300' :
                        evt.category === 'call' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-zinc-800 text-zinc-300'
                      }`}>
                        {evt.category}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-amber-400">
                      {evt.eventType}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-300 max-w-xs truncate">
                      {evt.description}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleInspect(evt.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/20 transition-colors"
                      >
                        <FileCode className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Slide-Over / Modal Payload Inspector */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="rounded-2xl border border-zinc-800 bg-[#0B0F19] max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 p-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                  Safe Payload Inspection (Credentials Scrubbed)
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">{selectedEvent.eventType}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <div>
                  <p className="text-zinc-500 uppercase font-mono text-[10px]">Organization</p>
                  <p className="text-zinc-200 font-bold">{selectedEvent.orgName}</p>
                </div>
                <div>
                  <p className="text-zinc-500 uppercase font-mono text-[10px]">Timestamp</p>
                  <p className="text-zinc-200 font-mono">{new Date(selectedEvent.createdAt).toISOString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-400 mb-1.5 uppercase font-mono">
                  Description
                </p>
                <p className="text-xs text-zinc-200 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  {selectedEvent.description || 'No description recorded'}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-zinc-400 mb-1.5 uppercase font-mono">
                  Metadata Payload (JSON)
                </p>
                <pre className="text-[11px] font-mono text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-800 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(selectedEvent.metadata, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-zinc-800 p-3 flex justify-end bg-zinc-950/50">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
