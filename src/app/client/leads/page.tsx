'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { 
  Target, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  Search, 
  CheckCircle2, 
  Plus, 
  ArrowRight,
  Flame,
  Archive,
  CalendarCheck
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'

interface LeadItem {
  id: string
  contact_id: string
  source: string
  status: 'new' | 'contacted' | 'booked' | 'lost'
  urgency: 'low' | 'normal' | 'high' | 'emergency'
  service_needed?: string | null
  estimated_value?: number | null
  notes?: string | null
  created_at: string
  contact: {
    id: string
    name?: string | null
    phone: string
    address?: string | null
  }
}

const STAGES: { key: LeadItem['status']; label: string; dot: string; border: string }[] = [
  { key: 'new', label: 'New Enquiries', dot: 'bg-blue-500', border: 'border-blue-500/30' },
  { key: 'contacted', label: 'Contacted', dot: 'bg-amber-500', border: 'border-amber-500/30' },
  { key: 'booked', label: 'Booked Jobs', dot: 'bg-emerald-500', border: 'border-emerald-500/30' },
  { key: 'lost', label: 'Archived / Lost', dot: 'bg-zinc-600', border: 'border-zinc-800' }
]

export default function LeadsPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setError('Authentication required to load leads.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .single()

      if (profileErr || !profile) {
        setError('Failed to resolve organization profile.')
        setLoading(false)
        return
      }

      const { data, error: leadsErr } = await supabase
        .from('leads')
        .select(`
          id, contact_id, source, status, urgency, service_needed, estimated_value, notes, created_at,
          contact:contacts(id, name, phone, address)
        `)
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })

      if (leadsErr) {
        setError('Unable to load inbound leads. Please retry.')
      } else if (data) {
        const enriched: LeadItem[] = data.map((l: any) => ({
          ...l,
          contact: Array.isArray(l.contact) ? l.contact[0] : l.contact
        }))
        setLeads(enriched)
      }
    } catch {
      setError('An unexpected error occurred while loading leads.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadLeads() }, [loadLeads])

  const handleUpdateStatus = async (leadId: string, newStatus: LeadItem['status']) => {
    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)

    if (error) {
      toast.error('Failed to update stage.')
    } else {
      toast.success(`Moved to ${newStatus}`)
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    }
  }

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    return (
      l.contact?.name?.toLowerCase().includes(q) ||
      l.contact?.phone?.includes(q) ||
      l.service_needed?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Target className="h-6 w-6 text-blue-500" />
            Leads Pipeline
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Track and move incoming opportunities from missed calls to booked jobs.
          </p>
        </div>

        {/* Search Input */}
        <div className="w-full sm:w-64">
          <Input
            placeholder="Search leads by name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 bg-zinc-900 border-zinc-800 text-xs rounded-xl text-white placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-center space-y-3">
          <p className="text-sm font-medium text-red-400">{error}</p>
          <Button onClick={loadLeads} variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/20">
            Retry Loading Leads
          </Button>
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map(stage => (
            <div
              key={stage.key}
              className="flex flex-col rounded-2xl bg-[#0D1322] border border-zinc-800/80 p-3.5 min-h-[500px] space-y-3"
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", stage.dot)} />
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">
                    {stage.label}
                  </span>
                </div>
                <Skeleton className="h-4 w-6 rounded bg-zinc-800" />
              </div>
              <Skeleton className="h-28 w-full rounded-xl bg-zinc-800/60" />
              <Skeleton className="h-28 w-full rounded-xl bg-zinc-800/60" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title={search ? 'No Matching Leads Found' : 'No Inbound Leads Yet'}
          description={
            search
              ? `No leads match "${search}". Try searching by a different name, phone number, or clear your search.`
              : 'Every missed call and online booking request is automatically captured as an actionable lead with homeowner contact details ready for follow-up.'
          }
          actionLabel={search ? 'Clear Search' : 'View Inbox'}
          onAction={search ? () => setSearch('') : () => window.location.href = '/client/inbox'}
          secondaryActionLabel="Open Calendar"
          onSecondaryAction={() => window.location.href = '/client/calendar'}
          tip="When you miss a call on your business line, CaptoDesk creates a New Lead and texts the caller immediately."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAGES.map(stage => {
          const stageLeads = filtered.filter(l => l.status === stage.key)

          return (
            <div 
              key={stage.key}
              className="flex flex-col rounded-2xl bg-[#0D1322] border border-zinc-800/80 p-3.5 min-h-[500px]"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/60 mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", stage.dot)} />
                  <span className="font-bold text-xs uppercase tracking-wider text-zinc-300">
                    {stage.label}
                  </span>
                </div>
                <span className="text-xs font-black text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                  {stageLeads.length}
                </span>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-3 overflow-y-auto">
                {stageLeads.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-400 italic">
                    No leads in this stage
                  </div>
                ) : (
                  stageLeads.map(lead => (
                    <div
                      key={lead.id}
                      className={cn(
                        "rounded-xl bg-[#0B0F19] border p-3.5 space-y-2.5 shadow-md transition-all hover:scale-[1.01]",
                        stage.border
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-sm text-white">
                            {lead.contact?.name || lead.contact?.phone}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {lead.contact?.phone}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold text-blue-400 border border-blue-500/20">
                          {lead.source === 'missed_call' ? 'Missed Call' : lead.source}
                        </span>
                      </div>

                      {lead.service_needed && (
                        <p className="text-xs text-zinc-300 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
                          {lead.service_needed}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 text-[10px] text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${lead.contact?.phone}`}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                            title="Call customer"
                          >
                            <PhoneCall className="h-3 w-3 text-blue-400" />
                          </a>
                          <Link
                            href="/client/inbox"
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                            title="Open chat"
                          >
                            <MessageSquare className="h-3 w-3 text-emerald-400" />
                          </Link>
                        </div>
                      </div>

                      {/* Stage Selector */}
                      <div className="pt-1 flex items-center justify-between gap-1 text-[10px]">
                        <span className="text-zinc-400 text-[9px] uppercase tracking-wider">Move:</span>
                        <div className="flex items-center gap-1">
                          {stage.key !== 'new' && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, 'new')}
                              className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            >
                              New
                            </button>
                          )}
                          {stage.key !== 'contacted' && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, 'contacted')}
                              className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                            >
                              Contacted
                            </button>
                          )}
                          {stage.key !== 'booked' && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, 'booked')}
                              className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors font-bold"
                            >
                              Booked
                            </button>
                          )}
                          {stage.key !== 'lost' && (
                            <button
                              onClick={() => handleUpdateStatus(lead.id, 'lost')}
                              className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 transition-colors"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
      )}

    </div>
  )
}
