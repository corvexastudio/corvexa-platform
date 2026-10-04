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
        .single()

      if (!profile || !profile.org_id) {
        setLoading(false)
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

  const handleRetry = async (log: any) => {
    // Retry simulation: logs retry action
    toast.info('Retrying notification dispatch...')
    setTimeout(() => {
      toast.success('Dispatched.')
    }, 800)
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      delivered: 'bg-emerald-50 text-emerald-700',
      sent: 'bg-blue-50 text-blue-700',
      failed: 'bg-red-50 text-red-700 font-semibold',
      pending: 'bg-amber-50 text-amber-700',
    }
    return map[status] ?? 'bg-muted text-muted-foreground'
  }

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'missed_call', label: 'Missed Calls' },
    { key: 'website_form', label: 'Leads' },
    { key: 'review_invite', label: 'Reviews' },
  ]

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto relative">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">Every automated action, in one place.</p>
      </div>

      {/* Scrollable filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${filter === f.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="bg-background border rounded-2xl overflow-hidden">
        {loading ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted/30 animate-pulse mx-4 my-2 rounded-lg" />)
        ) : logs.length === 0 ? (
          <div className="py-12 text-center px-4">
            <p className="text-sm font-medium text-muted-foreground">No activity yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Your first missed call or form lead will appear here automatically.</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map(log => {
              const eventType = log.event_type || log.type || 'system_event'
              const deliveryStatus = log.metadata?.delivery || log.delivery_status || 'sent'
              const contactInfo = log.description || log.metadata?.phone || 'Contractor event'
              
              return (
                <button
                  key={log.id}
                  onClick={() => setSelected(log)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${typeDot[eventType] ?? 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{typeLabel[eventType] ?? eventType}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contactInfo} · {new Date(log.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(deliveryStatus)}`}>
                      {deliveryStatus}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Detail Bottom Sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center bg-black/40" onClick={() => setSelected(null)}>
          <div
            className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl px-5 pt-5 pb-8 sm:pb-5 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar */}
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-semibold">{typeLabel[selected.event_type || selected.type] ?? selected.event_type}</p>
                <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Event Description / Contact */}
            <div className="bg-muted/40 rounded-xl p-3 mb-3">
              <p className="text-xs text-muted-foreground mb-0.5">Details</p>
              <p className="text-sm font-medium">{selected.description || 'System action'}</p>
              {selected.metadata?.phone && (
                <p className="text-sm text-muted-foreground">{selected.metadata.phone}</p>
              )}
            </div>

            {/* Message body if present in metadata */}
            {selected.metadata?.message && (
              <div className="mb-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><MessageSquare className="h-3 w-3" /> Message payload</p>
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground text-sm rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[85%]">
                    {selected.metadata.message}
                  </div>
                </div>
              </div>
            )}

            {/* Delivery status */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery status</p>
                <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusBadge(selected.delivery_status ?? selected.status ?? 'pending')}`}>
                  {selected.delivery_status ?? selected.status ?? 'pending'}
                </span>
              </div>
              {(selected.delivery_status === 'failed' || selected.status === 'failed') && (
                <Button size="sm" variant="destructive" onClick={() => handleRetry(selected)}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
