'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { 
  Target, 
  PhoneCall, 
  MessageSquare, 
  Clock, 
  Search, 
  Calendar,
  FileText,
  LayoutList,
  Columns3,
  MapPin,
  ChevronRight,
  Filter,
  Plus
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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

const STAGES: { key: LeadItem['status']; label: string; countColor: string }[] = [
  { key: 'new', label: 'New Enquiries', countColor: 'text-blue-400' },
  { key: 'contacted', label: 'Contacted', countColor: 'text-amber-400' },
  { key: 'booked', label: 'Booked Jobs', countColor: 'text-emerald-400' },
  { key: 'lost', label: 'Archived', countColor: 'text-zinc-500' }
]

function getStatusBadge(status: LeadItem['status']) {
  switch (status) {
    case 'new':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          New
        </span>
      )
    case 'contacted':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Contacted
        </span>
      )
    case 'booked':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Booked
        </span>
      )
    case 'lost':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          Archived
        </span>
      )
  }
}

function getSourceBadge(source: string) {
  const formatted = source === 'missed_call' ? 'Missed Call' : source.replace('_', ' ')
  const isMissed = source === 'missed_call'
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border",
      isMissed
        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
        : "bg-zinc-800 text-zinc-400 border-zinc-700/80"
    )}>
      {formatted}
    </span>
  )
}

export default function LeadsPage() {
  const supabase = createClient()
  const [leads, setLeads] = useState<LeadItem[]>([])
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<'all' | LeadItem['status']>('all')
  const [viewMode, setViewMode] = useState<'table' | 'pipeline'>('table')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New Lead Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [leadContactId, setLeadContactId] = useState('')
  const [leadCustomName, setLeadCustomName] = useState('')
  const [leadCustomPhone, setLeadCustomPhone] = useState('')
  const [leadServiceNeeded, setLeadServiceNeeded] = useState('')
  const [leadSource, setLeadSource] = useState('manual')
  const [leadUrgency, setLeadUrgency] = useState<'normal' | 'low' | 'high' | 'emergency'>('normal')
  const [leadEstimatedValue, setLeadEstimatedValue] = useState('')
  const [leadNotes, setLeadNotes] = useState('')
  const [savingLead, setSavingLead] = useState(false)
  const [orgId, setOrgId] = useState<string | null>(null)

  // Load contacts for picker
  useEffect(() => {
    fetch('/api/client/customers?limit=100')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.customers) setContacts(data.customers)
      })
      .catch(() => {})
  }, [])

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
        .maybeSingle()

      if (profileErr || !profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }
      setOrgId(profile.org_id)

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
    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))

    const { error } = await supabase
      .from('leads')
      .update({ status: newStatus })
      .eq('id', leadId)

    if (error) {
      toast.error('Failed to update stage.')
      loadLeads() // Rollback on failure
    } else {
      toast.success(`Stage updated to ${newStatus}`)
    }
  }

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId) return

    setSavingLead(true)
    try {
      let finalContactId = leadContactId

      if (leadContactId === 'new' || (!leadContactId && contacts.length === 0)) {
        if (!leadCustomPhone.trim()) {
          toast.error('Customer phone number is required.')
          setSavingLead(false)
          return
        }
        const custRes = await fetch('/api/client/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: leadCustomName.trim() || undefined,
            phone: leadCustomPhone.trim()
          })
        })
        const custData = await custRes.json()
        if (!custRes.ok || !custData.contact?.id) {
          toast.error(custData.error || 'Failed to create customer for lead.')
          setSavingLead(false)
          return
        }
        finalContactId = custData.contact.id
      }

      if (!finalContactId) {
        toast.error('Please select or specify a customer for this lead.')
        setSavingLead(false)
        return
      }

      const { error: insertErr } = await supabase
        .from('leads')
        .insert({
          org_id: orgId,
          contact_id: finalContactId,
          source: leadSource,
          status: 'new',
          urgency: leadUrgency,
          service_needed: leadServiceNeeded.trim() || null,
          estimated_value: leadEstimatedValue ? parseFloat(leadEstimatedValue) : null,
          notes: leadNotes.trim() || null
        })

      if (insertErr) {
        toast.error(insertErr.message || 'Failed to create lead.')
      } else {
        toast.success('Inbound lead recorded successfully')
        setShowCreateModal(false)
        setLeadContactId('')
        setLeadCustomName('')
        setLeadCustomPhone('')
        setLeadServiceNeeded('')
        setLeadSource('manual')
        setLeadUrgency('normal')
        setLeadEstimatedValue('')
        setLeadNotes('')
        await loadLeads()
      }
    } catch {
      toast.error('Network error creating lead.')
    } finally {
      setSavingLead(false)
    }
  }

  const filtered = leads.filter(l => {
    const matchesStage = stageFilter === 'all' || l.status === stageFilter
    if (!matchesStage) return false

    const q = search.toLowerCase().trim()
    if (!q) return true

    return (
      l.contact?.name?.toLowerCase().includes(q) ||
      l.contact?.phone?.includes(q) ||
      l.service_needed?.toLowerCase().includes(q) ||
      l.source?.toLowerCase().includes(q)
    )
  })

  // Stage counts for quick filter tabs
  const stageCounts = {
    all: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    booked: leads.filter(l => l.status === 'booked').length,
    lost: leads.filter(l => l.status === 'lost').length,
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Leads
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {leads.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Inbound opportunities captured from phone calls, booking links, and messages.
          </p>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>New Lead</span>
          </Button>

          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === 'table'
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <LayoutList className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('pipeline')}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                viewMode === 'pipeline'
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              <Columns3 className="h-3.5 w-3.5" />
              <span>Pipeline</span>
            </button>
          </div>

          <Link href="/client/inbox">
            <Button variant="outline" size="sm" className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800">
              Open Inbox
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Stage Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setStageFilter('all')}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
              stageFilter === 'all'
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            )}
          >
            All <span className="ml-1 text-[11px] text-zinc-500 tabular-nums">({stageCounts.all})</span>
          </button>
          {STAGES.map(stage => (
            <button
              key={stage.key}
              type="button"
              onClick={() => setStageFilter(stage.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                stageFilter === stage.key
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              {stage.label} <span className="ml-1 text-[11px] text-zinc-500 tabular-nums">({stageCounts[stage.key]})</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search name, phone, service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-400 rounded-md"
          />
        </div>
      </div>

      {/* Error state */}
      {error ? (
        <ErrorState
          title="Failed to load leads"
          message={error}
          onRetry={loadLeads}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        /* Loading Skeletons */
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 bg-zinc-800" />
                  <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 bg-zinc-800" />
                <Skeleton className="h-4 w-28 bg-zinc-800 hidden sm:block" />
                <Skeleton className="h-7 w-24 bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Target}
          title={search || stageFilter !== 'all' ? 'No Matching Leads' : 'No Inbound Leads Yet'}
          description={
            search || stageFilter !== 'all'
              ? 'No leads match the selected filter criteria. Try adjusting your search query or stage filter.'
              : 'Missed calls and inbound inquiries will appear here automatically with customer phone numbers and requested services ready for dispatch.'
          }
          actionLabel={search || stageFilter !== 'all' ? 'Reset Filters' : 'Go to Inbox'}
          onAction={
            search || stageFilter !== 'all'
              ? () => { setSearch(''); setStageFilter('all') }
              : () => window.location.href = '/client/inbox'
          }
        />
      ) : viewMode === 'table' ? (
        /* Table View (Desktop & Tablet) + Responsive Mobile Cards */
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900/90 border-b border-zinc-800">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Customer</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Source</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Service Needed</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Stage</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Captured</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-800">
                {filtered.map(lead => (
                  <TableRow key={lead.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                    <TableCell className="py-3 px-4">
                      <div>
                        <div className="font-medium text-xs text-zinc-100">
                          {lead.contact?.name || 'Unknown Caller'}
                        </div>
                        <div className="text-[11px] text-zinc-400 tabular-nums">
                          {lead.contact?.phone}
                        </div>
                        {lead.contact?.address && (
                          <div className="text-[11px] text-zinc-500 truncate max-w-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            {lead.contact.address}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 px-4">
                      {getSourceBadge(lead.source)}
                    </TableCell>

                    <TableCell className="py-3 px-4">
                      {lead.service_needed ? (
                        <span className="text-xs text-zinc-300 max-w-xs block truncate">
                          {lead.service_needed}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3 px-4">
                      <select
                        aria-label="Update lead stage"
                        value={lead.status}
                        onChange={e => handleUpdateStatus(lead.id, e.target.value as LeadItem['status'])}
                        className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 cursor-pointer"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="booked">Booked</option>
                        <option value="lost">Archived</option>
                      </select>
                    </TableCell>

                    <TableCell className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </TableCell>

                    <TableCell className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <a
                          href={`tel:${lead.contact?.phone}`}
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-300 transition-colors"
                          title="Call customer"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                        </a>
                        <Link
                          href="/client/inbox"
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-300 transition-colors"
                          title="Open in Inbox"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        </Link>
                        <Link
                          href="/client/quotes"
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-300 transition-colors"
                          title="Create Quote"
                        >
                          <FileText className="h-3.5 w-3.5 text-zinc-400" />
                        </Link>
                        <Link
                          href="/client/calendar"
                          className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-300 transition-colors"
                          title="Schedule Job"
                        >
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List View (Strictly under md breakpoint) */}
          <div className="md:hidden divide-y divide-zinc-800">
            {filtered.map(lead => (
              <div key={lead.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-sm text-zinc-100">
                      {lead.contact?.name || 'Unknown Caller'}
                    </h3>
                    <p className="text-xs text-zinc-400 tabular-nums">
                      {lead.contact?.phone}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {getSourceBadge(lead.source)}
                    {getStatusBadge(lead.status)}
                  </div>
                </div>

                {lead.service_needed && (
                  <p className="text-xs text-zinc-300 bg-zinc-950 p-2.5 rounded border border-zinc-800/80">
                    {lead.service_needed}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">Stage:</span>
                    <select
                      aria-label="Update lead stage"
                      value={lead.status}
                      onChange={e => handleUpdateStatus(lead.id, e.target.value as LeadItem['status'])}
                      className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300"
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="booked">Booked</option>
                      <option value="lost">Archived</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <a
                      href={`tel:${lead.contact?.phone}`}
                      className="p-2 rounded-md bg-zinc-800 text-blue-400"
                      title="Call customer"
                    >
                      <PhoneCall className="h-4 w-4" />
                    </a>
                    <Link
                      href="/client/inbox"
                      className="p-2 rounded-md bg-zinc-800 text-emerald-400"
                      title="Message customer"
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Pipeline View (Clean columns, no gradient cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map(stage => {
            const stageLeads = filtered.filter(l => l.status === stage.key)

            return (
              <div 
                key={stage.key}
                className="flex flex-col rounded-lg bg-zinc-900 border border-zinc-800 p-3 min-h-[480px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3 px-1">
                  <span className="font-semibold text-xs uppercase tracking-wider text-zinc-300">
                    {stage.label}
                  </span>
                  <span className="text-xs font-medium text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 tabular-nums">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {stageLeads.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500 italic">
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map(lead => (
                      <div
                        key={lead.id}
                        className="rounded-md bg-zinc-950 border border-zinc-800 p-3 space-y-2.5 hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <p className="font-medium text-xs text-zinc-100">
                              {lead.contact?.name || 'Unknown Caller'}
                            </p>
                            <p className="text-[11px] text-zinc-400 tabular-nums">
                              {lead.contact?.phone}
                            </p>
                          </div>
                          {getSourceBadge(lead.source)}
                        </div>

                        {lead.service_needed && (
                          <p className="text-xs text-zinc-300 line-clamp-2">
                            {lead.service_needed}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                          <span>
                            {new Date(lead.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>

                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${lead.contact?.phone}`}
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
                              title="Call"
                            >
                              <PhoneCall className="h-3 w-3 text-blue-400" />
                            </a>
                            <Link
                              href="/client/inbox"
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300"
                              title="Message"
                            >
                              <MessageSquare className="h-3 w-3 text-emerald-400" />
                            </Link>
                          </div>
                        </div>

                        {/* Fast Move Selector */}
                        <div className="pt-1 flex items-center justify-between gap-1 border-t border-zinc-800/60 text-[10px]">
                          <span className="text-zinc-500">Move:</span>
                          <div className="flex items-center gap-1">
                            {stage.key !== 'new' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(lead.id, 'new')}
                                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                              >
                                New
                              </button>
                            )}
                            {stage.key !== 'contacted' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(lead.id, 'contacted')}
                                className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                              >
                                Contacted
                              </button>
                            )}
                            {stage.key !== 'booked' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(lead.id, 'booked')}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-colors font-medium"
                              >
                                Booked
                              </button>
                            )}
                            {stage.key !== 'lost' && (
                              <button
                                type="button"
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

      {/* New Lead Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Record New Inbound Lead"
        description="Log an inbound phone inquiry, quote request, or lead opportunity."
        size="md"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Customer</label>
            <select
              aria-label="Select Customer"
              value={leadContactId}
              onChange={(e) => setLeadContactId(e.target.value)}
              className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
            >
              <option value="">-- Select Existing Contact or Enter New --</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Customer'} ({c.phone})
                </option>
              ))}
              <option value="new">+ Enter New Customer</option>
            </select>
          </div>

          {(leadContactId === 'new' || (!leadContactId && contacts.length === 0)) && (
            <div className="space-y-3 p-3 rounded-md bg-zinc-950/60 border border-zinc-800/80">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Customer Name</label>
                <Input
                  placeholder="e.g. John Wick"
                  value={leadCustomName}
                  onChange={(e) => setLeadCustomName(e.target.value)}
                  className="h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Phone Number *</label>
                <Input
                  required
                  placeholder="e.g. +1 555-0199"
                  value={leadCustomPhone}
                  onChange={(e) => setLeadCustomPhone(e.target.value)}
                  className="h-8 bg-zinc-900 border-zinc-800 text-xs text-zinc-100 rounded-md"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Service Needed *</label>
            <Input
              required
              placeholder="e.g. Emergency pipe burst, AC capacitor inspection"
              value={leadServiceNeeded}
              onChange={(e) => setLeadServiceNeeded(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Lead Source</label>
              <select
                aria-label="Lead Source"
                value={leadSource}
                onChange={(e) => setLeadSource(e.target.value)}
                className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="manual">Manual Entry</option>
                <option value="phone_call">Phone Call</option>
                <option value="missed_call">Missed Call</option>
                <option value="booking_link">Booking Link</option>
                <option value="website">Website Inquiry</option>
                <option value="referral">Referral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Urgency</label>
              <select
                aria-label="Urgency"
                value={leadUrgency}
                onChange={(e) => setLeadUrgency(e.target.value as any)}
                className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Estimated Value ($)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 450.00 (optional)"
              value={leadEstimatedValue}
              onChange={(e) => setLeadEstimatedValue(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Notes / Scope</label>
            <textarea
              rows={2}
              placeholder="Details mentioned by caller..."
              value={leadNotes}
              onChange={(e) => setLeadNotes(e.target.value)}
              className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              className="h-8 text-xs border-zinc-800 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={savingLead}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {savingLead ? 'Saving...' : 'Record Lead'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
