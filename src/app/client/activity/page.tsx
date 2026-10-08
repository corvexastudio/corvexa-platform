'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RefreshCw, MessageSquare, X } from 'lucide-react'

const typeLabel: Record<string, string> = {
  missed_call: 'Missed call',
  review_invite: 'Review link sent',
  website_form: 'Form lead',
}
const typeDot: Record<string, string> = {
  missed_call: 'bg-blue-500',
  review_invite: 'bg-amber-500',
  website_form: 'bg-emerald-500',
}

type Filter = 'all' | 'missed_call' | 'website_form' | 'review_invite'

export default function ActivityPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }

      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (filter !== 'all') {
        query = query.eq('event_type', filter)
      }

      const { data } = await query
      if (data) setLogs(data)
      setLoading(false)
    }
    fetchLogs()
  }, [filter, supabase])

  const [retryingId, setRetryingId] = useState<string | null>(null)

  const handleRetry = async (log: any) => {
    const targetId = log.automation_run_id || log.id
    setRetryingId(targetId)
    try {
      const res = await fetch(`/api/automations/runs/${targetId}/retry`, {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Automation queued for immediate retry.')
        setLogs(prev => prev.map(item => {
          if (item.id === log.id) {
            return { ...item, status: 'pending', delivery_status: 'pending' }
          }
          return item
        }))
        if (selected?.id === log.id) {
          setSelected((prev: any) => prev ? { ...prev, status: 'pending', delivery_status: 'pending' } : null)
        }
      } else {
        toast.error(data.error || 'Failed to retry automation run.')
      }
    } catch {
      toast.error('Network error while requesting automation retry.')
    } finally {
      setRetryingId(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      delivered: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
      sent: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      failed: 'bg-rose-500/10 text-rose-400 border border-rose-500/20 font-medium',
      pending: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    }
    return map[status] ?? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'missed_call', label: 'Missed Calls' },
    { key: 'website_form', label: 'Leads' },
    { key: 'review_invite', label: 'Reviews' },
  ]

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto relative">
      <div>
        <h1 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-tight">Activity Log</h1>
        <p className="text-zinc-400 text-xs mt-0.5">Audit log of inbound calls, outbound texts, and automation triggers.</p>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-colors border ${
              filter === f.key 
                ? 'bg-zinc-800 text-zinc-100 border-zinc-700' 
                : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-zinc-800/40 animate-pulse mx-4 my-2 rounded-md" />)
        ) : logs.length === 0 ? (
          <div className="py-12 text-center px-4">
            <p className="text-xs font-medium text-zinc-300">No activity logged yet.</p>
            <p className="text-xs text-zinc-500 mt-1">Inbound calls, SMS replies, and automation events will be logged here as they occur.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {logs.map(log => {
              const eventType = log.event_type || log.type || 'system_event'
              const deliveryStatus = log.metadata?.delivery || log.delivery_status || 'sent'
              const contactInfo = log.description || log.metadata?.phone || 'Contractor event'
              
              return (
                <button
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors text-left"
                >
                  <div className={`h-2 w-2 rounded-full shrink-0 ${typeDot[eventType] ?? 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200 truncate">{typeLabel[eventType] ?? eventType}</p>
                    <p className="text-xs text-zinc-400 truncate">
                      {contactInfo} · {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${statusBadge(deliveryStatus)}`}>
                      {deliveryStatus}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Bottom Sheet / Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div
            className="bg-zinc-900 border border-zinc-800 text-zinc-100 w-full sm:max-w-md sm:rounded-lg rounded-t-lg px-5 pt-5 pb-8 sm:pb-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-zinc-700 rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{typeLabel[selected.event_type || selected.type] ?? selected.event_type}</p>
                <p className="text-xs text-zinc-400">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Event Description / Contact */}
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-md p-3 mb-3">
              <p className="text-[10px] uppercase font-semibold text-zinc-400 mb-0.5">Details</p>
              <p className="text-xs font-medium text-zinc-200">{selected.description || 'System action'}</p>
              {selected.metadata?.phone && (
                <p className="text-xs text-zinc-400 mt-0.5">{selected.metadata.phone}</p>
              )}
            </div>

            {/* Message payload if present */}
            {selected.metadata?.message && (
              <div className="mb-3">
                <p className="text-[10px] uppercase font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" /> Message Payload
                </p>
                <div className="bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-md p-3">
                  {selected.metadata.message}
                </div>
              </div>
            )}

            {/* Delivery status */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <div>
                <p className="text-[10px] uppercase font-semibold text-zinc-400 mb-1">Delivery Status</p>
                <span className={`text-xs px-2.5 py-0.5 rounded-md font-medium ${statusBadge(selected.delivery_status ?? selected.status ?? 'pending')}`}>
                  {selected.delivery_status ?? selected.status ?? 'pending'}
                </span>
              </div>
              {(selected.delivery_status === 'failed' || selected.status === 'failed') && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="rounded-md text-xs h-8"
                  disabled={retryingId === (selected.automation_run_id || selected.id)}
                  onClick={() => handleRetry(selected)}
                >
                  <RefreshCw className={`mr-1.5 h-3 w-3 ${retryingId === (selected.automation_run_id || selected.id) ? 'animate-spin' : ''}`} />
                  {retryingId === (selected.automation_run_id || selected.id) ? 'Retrying...' : 'Retry Event'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
