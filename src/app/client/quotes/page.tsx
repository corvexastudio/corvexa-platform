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
  X, 
  Loader2, 
  Trash2,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export default function ClientQuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
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
    try {
      const res = await fetch('/api/client/quotes?limit=100')
      if (res.ok) {
        const data = await res.json()
        setQuotes(data.quotes || [])
      }
    } catch {
      toast.error('Failed to load quotes.')
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
    // Status Filter
    if (tab === 'pending' && q.status !== 'sent' && q.status !== 'viewed') return false
    if (tab === 'accepted' && q.status !== 'accepted') return false
    if (tab === 'declined' && q.status !== 'declined') return false
    if (tab === 'draft' && q.status !== 'draft') return false

    // Search Filter
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
    toast.success('Quote link copied to clipboard!')
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleSendQuote = async (quoteId: string) => {
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/client/quotes/${quoteId}/send`, { method: 'POST' })
      if (res.ok) {
        toast.success('Quote sent to customer via SMS!')
        loadQuotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to send quote.')
      }
    } catch {
      toast.error('Network error sending quote.')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Create Quote Handler
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
          toast.success('Quote created and texted to customer!')
        } else {
          toast.success('Draft estimate created successfully!')
        }
        setShowCreateModal(false)
        loadQuotes()
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to create quote.')
      }
    } catch {
      toast.error('Network error saving quote.')
    } finally {
      setSavingQuote(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="h-7 w-7 text-blue-500" />
            Quotes & Estimates
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Send mobile estimates to homeowners, get approval via text, and convert won jobs with 1 click.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Quote</span>
        </Button>
      </div>

      {/* ── Filter Tabs & Search Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'All Quotes', count: quotes.length },
            { key: 'pending', label: 'Awaiting Response', count: quotes.filter(q => q.status === 'sent' || q.status === 'viewed').length },
            { key: 'accepted', label: 'Approved', count: quotes.filter(q => q.status === 'accepted').length },
            { key: 'declined', label: 'Declined', count: quotes.filter(q => q.status === 'declined').length },
            { key: 'draft', label: 'Drafts', count: quotes.filter(q => q.status === 'draft').length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5',
                tab === t.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-zinc-900/80 text-zinc-400 hover:text-white border border-zinc-800'
              )}
            >
              <span>{t.label}</span>
              <span className={cn('text-[10px] px-1.5 py-0.2 rounded-full', tab === t.key ? 'bg-blue-700 text-blue-100' : 'bg-zinc-800 text-zinc-400')}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search by customer or quote #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 bg-zinc-900/90 border-zinc-800 text-xs rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* ── Content Viewport ── */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-12 text-center flex flex-col items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
          <p className="text-sm text-zinc-400">Loading your estimates...</p>
        </div>
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search ? 'No Matching Estimates Found' : 'No Estimates Created Yet'}
          description={
            search 
              ? 'No quotes match your search criteria. Try searching by a different name, phone number, or quote ID.'
              : 'Sending professional mobile estimates via text lets homeowners approve pricing on their phone in seconds, helping you win jobs before competitors call back.'
          }
          actionLabel={search ? 'Clear Search' : 'Create First Quote'}
          onAction={search ? () => setSearch('') : () => setShowCreateModal(true)}
          tip="Homeowners can review line items and click 'Accept' on their phone without logging in."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredQuotes.map(quote => {
            const isAccepted = quote.status === 'accepted'
            const isDeclined = quote.status === 'declined'
            const isPending = quote.status === 'sent' || quote.status === 'viewed'
            const isDraft = quote.status === 'draft'

            return (
              <div
                key={quote.id}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/70 p-4 sm:p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
              >
                {/* Left: Quote info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-white text-base tracking-tight">
                      {quote.quote_number}
                    </span>

                    {/* Status Badge */}
                    {isAccepted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> Approved
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
                        <Clock className="h-3 w-3" /> {quote.status === 'viewed' ? 'Opened by Customer' : 'Sent (Awaiting)'}
                      </span>
                    )}
                    {isDeclined && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-400 border border-rose-500/20">
                        <XCircle className="h-3 w-3" /> Declined
                      </span>
                    )}
                    {isDraft && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-400 border border-zinc-700">
                        Draft
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-zinc-200">
                    {quote.title}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span className="flex items-center gap-1 text-zinc-300">
                      <User className="h-3 w-3 text-zinc-400" />
                      {quote.contact?.name || 'Homeowner'}
                    </span>
                    <span>•</span>
                    <span>{quote.contact?.phone}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-zinc-400" />
                      Valid until {new Date(quote.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                {/* Right: Pricing & Quick Actions */}
                <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-zinc-800/80">
                  <div className="text-left md:text-right">
                    <p className="text-[11px] text-zinc-400 font-medium">Estimate Total</p>
                    <p className="text-lg sm:text-xl font-black text-white">
                      ${Number(quote.total).toFixed(2)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Send SMS Action */}
                    {!isAccepted && !isDeclined && (
                      <Button
                        size="sm"
                        onClick={() => handleSendQuote(quote.id)}
                        disabled={actionLoadingId === quote.id}
                        className="h-8.5 px-3 rounded-xl bg-blue-600/90 hover:bg-blue-600 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        {actionLoadingId === quote.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        <span>{quote.status === 'sent' ? 'Resend SMS' : 'Send SMS'}</span>
                      </Button>
                    )}

                    {/* Copy Link */}
                    <button
                      onClick={() => handleCopyLink(quote.manage_token, quote.id)}
                      title="Copy Customer Approval Link"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                    >
                      {copiedId === quote.id ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>

                    {/* View Public Estimate */}
                    <a
                      href={`/quote/${quote.manage_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Preview Homeowner View"
                      className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>

                    {/* Convert to Job if Accepted */}
                    {isAccepted && (
                      <Link
                        href="/client/jobs"
                        className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 text-xs font-semibold transition"
                      >
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>View In Jobs</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create New Quote Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B101B] border border-zinc-800 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Create New Estimate</h2>
                <p className="text-xs text-zinc-400">Generate a professional estimate ready to text to the customer.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Select Customer
                </label>
                <select
                  value={selectedContactId}
                  onChange={e => setSelectedContactId(e.target.value)}
                  className="w-full p-2.5 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Valued Customer'} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Estimate Title
                </label>
                <Input
                  value={quoteTitle}
                  onChange={e => setQuoteTitle(e.target.value)}
                  placeholder="e.g. Water Heater Replacement & Installation"
                  className="bg-zinc-900 border-zinc-800 text-xs sm:text-sm text-white"
                />
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {newItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder="Service / Part description"
                        value={item.description}
                        onChange={e => handleItemChange(idx, 'description', e.target.value)}
                        className="flex-1 bg-zinc-900 border-zinc-800 text-xs text-white"
                      />
                      <Input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                        className="w-16 bg-zinc-900 border-zinc-800 text-xs text-white text-center"
                      />
                      <Input
                        type="number"
                        placeholder="Price"
                        value={item.unit_price}
                        onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                        className="w-24 bg-zinc-900 border-zinc-800 text-xs text-white text-right"
                      />
                      {newItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 text-zinc-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-zinc-800/60 text-xs font-bold text-zinc-300">
                  <span>Subtotal</span>
                  <span className="text-white text-sm font-black">${calculatedSubtotal.toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Valid For
                </label>
                <select
                  value={validDays}
                  onChange={e => setValidDays(e.target.value)}
                  className="w-full p-2.5 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="7">7 Days</option>
                  <option value="14">14 Days (Standard)</option>
                  <option value="30">30 Days</option>
                  <option value="60">60 Days</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Customer Notes (Optional)
                </label>
                <textarea
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  placeholder="e.g. Estimate includes all labor, disposal of old unit, and 1-year parts warranty."
                  rows={2}
                  className="w-full p-2.5 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-5 border-t border-zinc-800/80 mt-5">
              <Button
                variant="outline"
                onClick={() => setShowCreateModal(false)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                onClick={() => handleSaveQuote(false)}
                disabled={savingQuote}
                className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs cursor-pointer"
              >
                Save Draft
              </Button>
              <Button
                onClick={() => handleSaveQuote(true)}
                disabled={savingQuote}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20"
              >
                {savingQuote ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                <span>Save & Text Quote</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
