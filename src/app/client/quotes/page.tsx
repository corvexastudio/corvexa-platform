'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { 
  FileText, 
  Plus, 
  Search, 
  Send, 
  Copy, 
  Check, 
  ExternalLink, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Briefcase, 
  DollarSign, 
  User, 
  Calendar, 
  Loader2, 
  Trash2,
  TrendingUp,
  Percent
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface QuoteItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  total?: number
}

interface Quote {
  id: string
  quote_number: string
  title: string
  subtotal: number
  tax: number
  discount: number
  total: number
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  expires_at: string
  manage_token: string
  sent_at?: string
  accepted_at?: string
  notes?: string
  created_at: string
  contact?: {
    id: string
    name: string
    phone: string
    email?: string
  }
  items?: QuoteItem[]
}

function getQuoteStatusBadge(status: Quote['status']) {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          Approved
        </span>
      )
    case 'viewed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          Viewed
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
          Sent
        </span>
      )
    case 'declined':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          Declined
        </span>
      )
    case 'expired':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-500 border border-zinc-700">
          Expired
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
          Draft
        </span>
      )
  }
}

export default function ClientQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'pending' | 'accepted' | 'declined' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // New Quote Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [quoteTitle, setQuoteTitle] = useState('Standard Service Estimate')
  const [validDays, setValidDays] = useState('14')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [newItems, setNewItems] = useState<QuoteItem[]>([
    { description: 'Diagnostics & System Assessment', quantity: 1, unit_price: 120 }
  ])
  const [savingQuote, setSavingQuote] = useState(false)

  // Load Quotes
  const loadQuotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/quotes?limit=100')
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.quotes || [])
      } else {
        const err = await res.json().catch(() => ({}))
        if (res.status === 403 && (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization'))) {
          window.location.href = '/client/onboarding'
          return
        }
        setError(err.error || 'Failed to load estimates.')
      }
    } catch {
      setError('Unable to reach quotes service. Please verify your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load Contacts for picker
  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/client/customers?limit=100')
      if (res.ok) {
        const data = await res.json()
        setContacts(data.customers || [])
      }
    } catch {
      // quiet fail
    }
  }, [])

  useEffect(() => {
    loadQuotes()
    loadContacts()
  }, [loadQuotes, loadContacts])

  // Filter quotes based on search and status tab
  const filteredQuotes = quotes.filter(q => {
    if (tab === 'pending' && q.status !== 'sent' && q.status !== 'viewed') return false
    if (tab === 'accepted' && q.status !== 'accepted') return false
    if (tab === 'declined' && q.status !== 'declined') return false
    if (tab === 'draft' && q.status !== 'draft') return false

    if (search.trim()) {
      const query = search.toLowerCase()
      const matchesNum = q.quote_number?.toLowerCase().includes(query)
      const matchesName = q.contact?.name?.toLowerCase().includes(query)
      const matchesPhone = q.contact?.phone?.includes(query)
      const matchesTitle = q.title?.toLowerCase().includes(query)
      return matchesNum || matchesName || matchesPhone || matchesTitle
    }
    return true
  })

  // Fast Actions
  const handleCopyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/quote/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Quote link copied to clipboard')
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleSendQuote = async (quoteId: string) => {
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/client/quotes/${quoteId}/send`, { method: 'POST' })
      if (res.ok) {
        toast.success('Quote sent to customer via SMS')
        loadQuotes()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to send quote.')
      }
    } catch {
      toast.error('Network error sending quote.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Create Quote Handlers
  const handleAddItem = () => {
    setNewItems([...newItems, { description: '', quantity: 1, unit_price: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    if (newItems.length === 1) return
    setNewItems(newItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof QuoteItem, val: any) => {
    const updated = [...newItems]
    updated[index] = { ...updated[index], [field]: val }
    setNewItems(updated)
  }

  const calculatedSubtotal = newItems.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)

  const handleSaveQuote = async (andSend: boolean = false) => {
    if (!selectedContactId) {
      toast.error('Please choose a customer.')
      return
    }
    if (newItems.some(i => !i.description.trim() || Number(i.unit_price) <= 0)) {
      toast.error('Please fill in valid descriptions and prices for all items.')
      return
    }

    setSavingQuote(true)
    try {
      const res = await fetch('/api/client/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedContactId,
          title: quoteTitle,
          items: newItems,
          valid_days: Number(validDays) || 14,
          notes: quoteNotes
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (andSend && data.quote?.id) {
          await fetch(`/api/client/quotes/${data.quote.id}/send`, { method: 'POST' })
          toast.success('Quote created and sent via SMS')
        } else {
          toast.success('Draft estimate created successfully')
        }
        setShowCreateModal(false)
        loadQuotes()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to create quote.')
      }
    } catch {
      toast.error('Network error saving quote.')
    } finally {
      setSavingQuote(false)
    }
  }

  // Metrics
  const totalValue = quotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0)
  const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed')
  const pendingValue = pendingQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0)
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
  const acceptedValue = acceptedQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0)
  const resolvedCount = acceptedQuotes.length + quotes.filter(q => q.status === 'declined').length
  const winRate = resolvedCount > 0 ? Math.round((acceptedQuotes.length / resolvedCount) * 100) : 0

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Quotes & Estimates
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {quotes.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Send transparent service estimates, track customer views, and convert won jobs.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          size="sm"
          className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>New Quote</span>
        </Button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Total Estimates</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">${totalValue.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{quotes.length} quotes generated</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Awaiting Approval</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums mt-1">${pendingValue.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{pendingQuotes.length} active with customers</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Won Revenue</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums mt-1">${acceptedValue.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{acceptedQuotes.length} quotes accepted</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Win Rate</p>
          <p className="text-xl font-bold text-blue-400 tabular-nums mt-1">{winRate}%</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Based on resolved quotes</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'All Quotes', count: quotes.length },
            { key: 'pending', label: 'Awaiting Response', count: pendingQuotes.length },
            { key: 'accepted', label: 'Approved', count: acceptedQuotes.length },
            { key: 'declined', label: 'Declined', count: quotes.filter(q => q.status === 'declined').length },
            { key: 'draft', label: 'Drafts', count: quotes.filter(q => q.status === 'draft').length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
                tab === t.key
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              <span>{t.label}</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-950 text-zinc-400 tabular-nums">
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search customer, quote #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-400 rounded-md"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <ErrorState
          title="Failed to load quotes"
          message={error}
          onRetry={loadQuotes}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-zinc-800/60 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 bg-zinc-800" />
                  <Skeleton className="h-3 w-48 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 bg-zinc-800" />
                <Skeleton className="h-4 w-16 bg-zinc-800" />
                <Skeleton className="h-8 w-24 bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No Matching Estimates' : 'No Estimates Created Yet'}
          description={
            search 
              ? 'No quotes match your search criteria. Try searching by a different name, phone number, or quote ID.'
              : 'Create and dispatch professional estimates directly via SMS. Homeowners can approve pricing on their phone in one click.'
          }
          actionLabel={search ? 'Clear Search' : 'Create First Quote'}
          onAction={search ? () => setSearch('') : () => setShowCreateModal(true)}
        />
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900/90 border-b border-zinc-800">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Quote #</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Customer</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Title</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Status</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Valid Until</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Total</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-800">
                {filteredQuotes.map(quote => {
                  const isAccepted = quote.status === 'accepted'
                  const isDeclined = quote.status === 'declined'

                  return (
                    <TableRow key={quote.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono font-medium text-xs text-zinc-300">
                        {quote.quote_number}
                      </TableCell>

                      <TableCell className="py-3 px-4">
                        <div className="font-medium text-xs text-zinc-100">
                          {quote.contact?.name || 'Homeowner'}
                        </div>
                        <div className="text-[11px] text-zinc-400 tabular-nums">
                          {quote.contact?.phone}
                        </div>
                      </TableCell>

                      <TableCell className="py-3 px-4 text-xs text-zinc-300 max-w-xs truncate">
                        {quote.title}
                      </TableCell>

                      <TableCell className="py-3 px-4">
                        {getQuoteStatusBadge(quote.status)}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap tabular-nums">
                        {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right font-semibold text-xs text-zinc-100 tabular-nums">
                        ${Number(quote.total).toFixed(2)}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {!isAccepted && !isDeclined && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendQuote(quote.id)}
                              disabled={actionLoadingId === quote.id}
                              className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800"
                            >
                              {actionLoadingId === quote.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              <span>{quote.status === 'sent' ? 'Resend' : 'Send'}</span>
                            </Button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyLink(quote.manage_token, quote.id)}
                            title="Copy link"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            {copiedId === quote.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <a
                            href={`/quote/${quote.manage_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Preview customer view"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          {isAccepted && (
                            <Link
                              href="/client/jobs"
                              className="inline-flex items-center gap-1 h-7 px-2 rounded text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                            >
                              <Briefcase className="h-3 w-3" />
                              <span>In Jobs</span>
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-zinc-800">
            {filteredQuotes.map(quote => {
              const isAccepted = quote.status === 'accepted'
              const isDeclined = quote.status === 'declined'

              return (
                <div key={quote.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400 font-medium">{quote.quote_number}</span>
                        {getQuoteStatusBadge(quote.status)}
                      </div>
                      <h3 className="font-medium text-xs text-zinc-100 mt-1">{quote.title}</h3>
                      <p className="text-[11px] text-zinc-400">{quote.contact?.name || 'Homeowner'} • {quote.contact?.phone}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold text-zinc-100 tabular-nums">
                        ${Number(quote.total).toFixed(2)}
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        Exp {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-800/80">
                    {!isAccepted && !isDeclined && (
                      <Button
                        size="sm"
                        onClick={() => handleSendQuote(quote.id)}
                        disabled={actionLoadingId === quote.id}
                        className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        {actionLoadingId === quote.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        <span>{quote.status === 'sent' ? 'Resend' : 'Send'}</span>
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyLink(quote.manage_token, quote.id)}
                      className="p-1.5 rounded bg-zinc-800 text-zinc-300"
                      title="Copy link"
                    >
                      {copiedId === quote.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <a
                      href={`/quote/${quote.manage_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded bg-zinc-800 text-zinc-300"
                      title="View public quote"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    {isAccepted && (
                      <Link
                        href="/client/jobs"
                        className="inline-flex items-center gap-1 h-7 px-2.5 rounded text-xs font-medium text-emerald-400 bg-emerald-500/10"
                      >
                        <Briefcase className="h-3 w-3" />
                        <span>Jobs</span>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create New Quote Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Create Service Estimate"
        description="Build line items and send an instant approval link via SMS."
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Customer
            </label>
            <select
              aria-label="Select Customer"
              value={selectedContactId}
              onChange={e => setSelectedContactId(e.target.value)}
              className="w-full p-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-zinc-700 cursor-pointer"
            >
              <option value="">-- Choose Customer --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Valued Customer'} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Estimate Title
              </label>
              <Input
                value={quoteTitle}
                onChange={e => setQuoteTitle(e.target.value)}
                placeholder="e.g. AC Repair & Maintenance"
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Valid For (Days)
              </label>
              <Input
                type="number"
                value={validDays}
                onChange={e => setValidDays(e.target.value)}
                min="1"
                max="90"
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Line Items</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Description (e.g. Capacitor replacement)"
                    value={item.description}
                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                    className="flex-1 h-8 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                    min="1"
                    className="w-16 h-8 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md text-center"
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                    min="0"
                    step="0.01"
                    className="w-24 h-8 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md text-right"
                  />
                  {newItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 text-xs">
              <span className="text-zinc-400 mr-2">Estimated Total:</span>
              <span className="font-bold text-white tabular-nums">${calculatedSubtotal.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Customer Notes / Terms
            </label>
            <textarea
              rows={2}
              value={quoteNotes}
              onChange={e => setQuoteNotes(e.target.value)}
              placeholder="e.g. Includes 1-year parts warranty. Payment due upon completion."
              className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingQuote}
              onClick={() => handleSaveQuote(false)}
              className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingQuote}
              onClick={() => handleSaveQuote(true)}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {savingQuote ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                'Save & Send via SMS'
              )}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
