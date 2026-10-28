'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  Percent,
  Receipt,
  Sparkles,
  Layers,
  ArrowRight,
  ChevronRight,
  ShieldCheck,
  AlertCircle
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
import { INDUSTRY_LIST, INDUSTRY_PRESETS, getIndustryPreset, type IndustryPreset } from '@/lib/constants/industries'

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
  requires_deposit?: boolean
  deposit_type?: 'percentage' | 'fixed'
  deposit_value?: number
  deposit_amount?: number
  deposit_paid?: boolean
  sent_at?: string
  accepted_at?: string
  notes?: string
  created_at: string
  contact?: {
    id: string
    name: string
    phone: string
    email?: string
    address?: string
  }
  items?: QuoteItem[]
  jobs?: Array<{ id: string; job_number: string; status: string }>
}

function getQuoteStatusBadge(status: Quote['status']) {
  switch (status) {
    case 'accepted':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          Approved
        </span>
      )
    case 'viewed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
          Viewed
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          Sent
        </span>
      )
    case 'declined':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
          Declined
        </span>
      )
    case 'expired':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700">
          Expired
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
          Draft
        </span>
      )
  }
}

function ClientQuotesContent() {
  const searchParams = useSearchParams()
  const contactIdParam = searchParams.get('contact_id') || searchParams.get('contactId')

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'all' | 'pending' | 'accepted' | 'declined' | 'draft'>('all')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertingInvoiceId, setConvertingInvoiceId] = useState<string | null>(null)

  // New Quote Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [quoteTitle, setQuoteTitle] = useState('Standard Service Estimate')
  const [validDays, setValidDays] = useState('14')
  const [quoteNotes, setQuoteNotes] = useState('Includes complete labor, standard parts warranty, and clean work area guarantee.')
  const [newItems, setNewItems] = useState<QuoteItem[]>([
    { description: 'On-Site Diagnostic & System Assessment', quantity: 1, unit_price: 89 }
  ])
  const [savingQuote, setSavingQuote] = useState(false)
  const [requiresDeposit, setRequiresDeposit] = useState(false)
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>('percentage')
  const [depositValue, setDepositValue] = useState<number>(50)
  
  // 21 Trades Selector State
  const [selectedTradeId, setSelectedTradeId] = useState<string>('all')
  const [tradeSearch, setTradeSearch] = useState<string>('')

  // Listen to contact_id or quick-create query param
  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam)
      setShowCreateModal(true)
    } else if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
      setShowCreateModal(true)
    }
  }, [contactIdParam, searchParams])

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
        setContacts(data.customers || data.contacts || [])
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
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
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
  }, [quotes, tab, search])

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
        toast.success('Quote dispatched to customer via SMS')
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

  const handleConvertToJob = async (quoteId: string) => {
    setConvertingId(quoteId)
    try {
      const res = await fetch(`/api/client/quotes/${quoteId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success(`Job #${data.job?.job_number || ''} scheduled successfully!`)
        await loadQuotes()
      } else {
        toast.error(data.error || 'Failed to convert quote to job.')
      }
    } catch {
      toast.error('Network error converting quote.')
    } finally {
      setConvertingId(null)
    }
  }

  const handleConvertToInvoice = async (quoteId: string) => {
    setConvertingInvoiceId(quoteId)
    try {
      const res = await fetch('/api/client/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert_quote',
          quoteId
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success(`Invoice #${data.invoice?.invoice_number || ''} generated from quote!`)
        await loadQuotes()
      } else {
        toast.error(data.error || 'Failed to convert quote to invoice.')
      }
    } catch {
      toast.error('Network error converting quote to invoice.')
    } finally {
      setConvertingInvoiceId(null)
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

  // 1-Tap Trade Preset Line Item Addition
  const handleApplyTradeService = (service: { name: string; description: string; price: number | null }, tradeName: string) => {
    const cleanDesc = service.description ? service.description.replace(/\[pricing:[^\]]+\]\s*/i, '').trim() : service.name
    const unitPrice = service.price || 120

    // If only 1 empty line item exists, replace it; otherwise append
    if (newItems.length === 1 && !newItems[0].description.trim() && Number(newItems[0].unit_price) === 0) {
      setNewItems([{ description: `${service.name} - ${cleanDesc}`, quantity: 1, unit_price: unitPrice }])
    } else {
      setNewItems([...newItems, { description: `${service.name} - ${cleanDesc}`, quantity: 1, unit_price: unitPrice }])
    }

    if (quoteTitle === 'Standard Service Estimate' || !quoteTitle.trim()) {
      setQuoteTitle(`${service.name}`)
    }
    toast.success(`Added ${service.name} ($${unitPrice}) to estimate`)
  }

  const calculatedSubtotal = useMemo(() => {
    return newItems.reduce((acc, item) => acc + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0), 0)
  }, [newItems])

  const calculatedDepositAmount = useMemo(() => {
    if (!requiresDeposit) return 0
    if (depositType === 'percentage') {
      const pct = Math.min(100, Math.max(1, depositValue || 50))
      return Math.round(((calculatedSubtotal * pct) / 100) * 100) / 100
    }
    return Math.min(calculatedSubtotal, Math.max(1, depositValue || 0))
  }, [requiresDeposit, depositType, depositValue, calculatedSubtotal])

  const handleSaveQuote = async (andSend: boolean = false) => {
    if (!selectedContactId) {
      toast.error('Please choose a customer from the directory.')
      return
    }
    if (newItems.some(i => !i.description.trim() || Number(i.unit_price) <= 0)) {
      toast.error('Please provide a valid description and price for all line items.')
      return
    }

    setSavingQuote(true)
    try {
      const res = await fetch('/api/client/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: selectedContactId,
          title: quoteTitle.trim() || 'Service Estimate',
          items: newItems,
          valid_days: Number(validDays) || 14,
          notes: quoteNotes,
          requires_deposit: requiresDeposit,
          deposit_type: depositType,
          deposit_value: Number(depositValue) || 0
        })
      })

      if (res.ok) {
        const data = await res.json()
        if (andSend && data.quote?.id) {
          await fetch(`/api/client/quotes/${data.quote.id}/send`, { method: 'POST' })
          toast.success('Quote dispatched to customer via SMS')
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

  // Financial Metrics
  const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'viewed')
  const pendingValue = pendingQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0)
  const acceptedQuotes = quotes.filter(q => q.status === 'accepted')
  const acceptedValue = acceptedQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0)
  const declinedQuotes = quotes.filter(q => q.status === 'declined')
  const draftQuotes = quotes.filter(q => q.status === 'draft')
  const resolvedCount = acceptedQuotes.length + declinedQuotes.length
  const winRate = resolvedCount > 0 ? Math.round((acceptedQuotes.length / resolvedCount) * 100) : 0

  // Filtered 21 Trades list for the preset builder
  const filteredTrades = useMemo(() => {
    return INDUSTRY_LIST.filter(trade => {
      if (selectedTradeId !== 'all' && trade.id !== selectedTradeId) return false
      if (tradeSearch.trim()) {
        const q = tradeSearch.toLowerCase()
        const matchesTrade = trade.name.toLowerCase().includes(q)
        const matchesServices = trade.services.some(s => s.name.toLowerCase().includes(q))
        return matchesTrade || matchesServices
      }
      return true
    })
  }, [selectedTradeId, tradeSearch])

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Quotes & Estimates
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 tabular-nums">
              {quotes.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Build itemized estimates, require upfront deposits, and dispatch digital approval links via SMS.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          size="sm"
          className="h-9 px-3.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          <span>New Estimate</span>
        </Button>
      </div>

      {/* 3 Streamlined Financial Summary Tokens (Senior UX Standard) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Active Pipeline</p>
            <Clock className="h-4 w-4 text-amber-500/80" />
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono mt-1">${pendingValue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {pendingQuotes.length} estimate{pendingQuotes.length === 1 ? '' : 's'} awaiting homeowner response
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Approved Revenue</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500/80" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-1">${acceptedValue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {acceptedQuotes.length} approved · ready to schedule & invoice
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Win Rate</p>
            <TrendingUp className="h-4 w-4 text-blue-500/80" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums font-mono mt-1">{winRate}%</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {acceptedQuotes.length} won vs {declinedQuotes.length} declined
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
          {[
            { key: 'all', label: 'All Estimates', count: quotes.length },
            { key: 'pending', label: 'Awaiting Decision', count: pendingQuotes.length },
            { key: 'accepted', label: 'Approved', count: acceptedQuotes.length },
            { key: 'declined', label: 'Declined', count: declinedQuotes.length },
            { key: 'draft', label: 'Drafts', count: draftQuotes.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer",
                tab === t.key
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
              )}
            >
              <span>{t.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono font-semibold",
                tab === t.key
                  ? "bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200"
                  : "bg-slate-200/80 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400"
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
          <Input
            placeholder="Search customer, quote #, or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8.5 pl-8 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-400 rounded-lg shadow-2xs focus:border-blue-500"
          />
        </div>
      </div>

      {/* Main Table / Feed */}
      {error ? (
        <ErrorState
          title="Failed to load quotes"
          message={error}
          onRetry={loadQuotes}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-36 bg-slate-100 dark:bg-zinc-800" />
                  <Skeleton className="h-3 w-48 bg-slate-100/70 dark:bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 bg-slate-100 dark:bg-zinc-800" />
                <Skeleton className="h-4 w-16 bg-slate-100 dark:bg-zinc-800" />
                <Skeleton className="h-8 w-28 bg-slate-100 dark:bg-zinc-800" />
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
              ? 'No quotes match your search criteria. Try searching by a different customer name, phone number, or quote ID.'
              : 'Create and dispatch professional estimates directly via SMS. Homeowners can approve pricing and pay upfront deposits on their phone in one click.'
          }
          actionLabel={search ? 'Clear Search' : 'Create First Estimate'}
          onAction={search ? () => setSearch('') : () => setShowCreateModal(true)}
        />
      ) : (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200/80 dark:border-zinc-800">
                <TableRow className="border-b border-slate-200/80 dark:border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Quote #</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Customer</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Scope & Title</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Status</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Expiration</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Total & Deposit</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredQuotes.map(quote => {
                  const isAccepted = quote.status === 'accepted'
                  const isDeclined = quote.status === 'declined'
                  const isExpired = quote.status === 'expired' || (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now() && !isAccepted)
                  const daysLeft = Math.ceil((new Date(quote.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

                  return (
                    <TableRow key={quote.id} className="border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-700 dark:text-zinc-300">
                        {quote.quote_number}
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                          {quote.contact?.name || 'Homeowner'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {quote.contact?.phone}
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 px-4 max-w-xs">
                        <div className="text-xs font-medium text-slate-900 dark:text-zinc-100 truncate">
                          {quote.title}
                        </div>
                        {quote.items && quote.items.length > 0 && (
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                            {quote.items.length} line item{quote.items.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        {getQuoteStatusBadge(quote.status)}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                        <div>
                          {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {!isAccepted && !isDeclined && (
                          <div className={cn(
                            "text-[10px] font-medium",
                            isExpired ? "text-rose-600 dark:text-rose-400" : daysLeft <= 3 ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                          )}>
                            {isExpired ? 'Expired' : `${daysLeft}d remaining`}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right tabular-nums">
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 font-mono">
                          ${Number(quote.total).toFixed(2)}
                        </div>
                        {quote.requires_deposit && (
                          <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Deposit: ${Number(quote.deposit_amount || 0).toFixed(2)}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* 1-Tap SMS Send */}
                          {!isAccepted && !isDeclined && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendQuote(quote.id)}
                              disabled={actionLoadingId === quote.id}
                              className="h-7.5 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-zinc-800 font-semibold rounded-md shadow-2xs cursor-pointer"
                              title={quote.status === 'sent' ? 'Resend SMS quote link' : 'Send estimate to customer via SMS'}
                            >
                              {actionLoadingId === quote.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              <span>{quote.status === 'sent' ? 'Resend' : 'Send'}</span>
                            </Button>
                          )}

                          {/* 1-Tap Copy Link */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(quote.manage_token, quote.id)}
                            title="Copy customer quote link"
                            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
                          >
                            {copiedId === quote.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* 1-Tap Preview Public Quote */}
                          <a
                            href={`/quote/${quote.manage_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Preview customer view"
                            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-2xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          {/* Approved Actions: Convert to Job & Convert to Invoice */}
                          {isAccepted && (
                            <>
                              {quote.jobs && quote.jobs.length > 0 ? (
                                <Link
                                  href={`/client/calendar?tab=dispatch&search=${quote.jobs[0].job_number}`}
                                  className="inline-flex items-center gap-1 h-7.5 px-2.5 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 dark:border-emerald-500/20 shadow-2xs transition-colors"
                                  title={`Open Work Order #${quote.jobs[0].job_number}`}
                                >
                                  <Briefcase className="h-3 w-3" />
                                  <span>Job #{quote.jobs[0].job_number}</span>
                                </Link>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleConvertToJob(quote.id)}
                                  disabled={convertingId === quote.id}
                                  className="h-7.5 px-2.5 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 shadow-2xs cursor-pointer"
                                  title="Schedule field service job from this estimate"
                                >
                                  {convertingId === quote.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Briefcase className="h-3 w-3 mr-1" />
                                  )}
                                  <span>Convert to Job</span>
                                </Button>
                              )}

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConvertToInvoice(quote.id)}
                                disabled={convertingInvoiceId === quote.id}
                                className="h-7.5 px-2.5 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/20 shadow-2xs cursor-pointer"
                                title="Generate customer invoice from this estimate"
                              >
                                {convertingInvoiceId === quote.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Receipt className="h-3 w-3 mr-1" />
                                )}
                                <span>Invoice</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card List View (Truck-Ready 48px Ergonomics) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredQuotes.map(quote => {
              const isAccepted = quote.status === 'accepted'
              const isDeclined = quote.status === 'declined'

              return (
                <div key={quote.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 dark:text-zinc-400 font-semibold">{quote.quote_number}</span>
                        {getQuoteStatusBadge(quote.status)}
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 mt-1">{quote.title}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">{quote.contact?.name || 'Homeowner'} • {quote.contact?.phone}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 tabular-nums font-mono">
                        ${Number(quote.total).toFixed(2)}
                      </p>
                      {quote.requires_deposit && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Dep: ${Number(quote.deposit_amount || 0).toFixed(2)}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                        Exp {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(quote.manage_token, quote.id)}
                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs"
                        title="Copy link"
                      >
                        {copiedId === quote.id ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>

                      <a
                        href={`/quote/${quote.manage_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs"
                        title="View public quote"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isAccepted && !isDeclined && (
                        <Button
                          size="sm"
                          onClick={() => handleSendQuote(quote.id)}
                          disabled={actionLoadingId === quote.id}
                          className="h-9 px-3 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
                        >
                          {actionLoadingId === quote.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <Send className="h-3 w-3 mr-1" />
                          )}
                          <span>{quote.status === 'sent' ? 'Resend' : 'Send SMS'}</span>
                        </Button>
                      )}

                      {isAccepted && (
                        <>
                          {quote.jobs && quote.jobs.length > 0 ? (
                            <Link
                              href={`/client/calendar?tab=dispatch&search=${quote.jobs[0].job_number}`}
                              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20 shadow-2xs"
                            >
                              <Briefcase className="h-3.5 w-3.5" />
                              <span>Job #{quote.jobs[0].job_number}</span>
                            </Link>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConvertToJob(quote.id)}
                              disabled={convertingId === quote.id}
                              className="h-9 px-3 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 shadow-2xs"
                            >
                              {convertingId === quote.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <Briefcase className="h-3 w-3 mr-1" />
                              )}
                              <span>+ Job</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvertToInvoice(quote.id)}
                            disabled={convertingInvoiceId === quote.id}
                            className="h-9 px-3 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/20 shadow-2xs"
                          >
                            {convertingInvoiceId === quote.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Receipt className="h-3 w-3 mr-1" />
                            )}
                            <span>+ Invoice</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Redesigned Quote Builder Modal (All 21 Trades Supported) */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Create Service Estimate"
        description="Build line items, configure optional upfront deposits, and dispatch approval link via SMS."
        size="xl"
      >
        <div className="space-y-4">
          
          {/* Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Customer <span className="text-rose-500">*</span>
            </label>
            <select
              aria-label="Select Customer"
              value={selectedContactId}
              onChange={e => setSelectedContactId(e.target.value)}
              className="w-full p-2.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="">-- Choose Customer from Directory --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Valued Customer'} ({c.phone || 'No phone'}) {c.address ? `• ${c.address}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 21-Trade Preset Browser (1-Tap Sight-Unseen Line Items) */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Trade Price Book (All 21 Home Service Trades)</span>
              </span>

              {/* Trade Filter Dropdown */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedTradeId}
                  onChange={e => setSelectedTradeId(e.target.value)}
                  className="p-1 px-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer shadow-2xs"
                >
                  <option value="all">All 21 Trades</option>
                  {INDUSTRY_LIST.map(ind => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Presets List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-1 scrollbar-thin">
              {filteredTrades.flatMap(trade => 
                trade.services.map((svc, idx) => (
                  <button
                    key={`${trade.id}-${idx}`}
                    type="button"
                    onClick={() => handleApplyTradeService(svc, trade.name)}
                    className="p-2 text-left rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:bg-blue-50/60 dark:hover:bg-zinc-800 hover:border-blue-300 dark:hover:border-blue-500/30 transition-all shadow-2xs cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">
                          {trade.badge}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {svc.price ? `$${svc.price}` : 'Quote on Site'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1 mt-0.5">
                        {svc.name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <p className="text-[10px] text-slate-500 dark:text-zinc-400 italic">
              Tap any standard service above to instantly add it to your estimate line items.
            </p>
          </div>

          {/* Estimate Title & Validity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Estimate Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={quoteTitle}
                onChange={e => setQuoteTitle(e.target.value)}
                placeholder="e.g. Water Heater Replacement & Installation"
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Valid For (Days)
              </label>
              <Input
                type="number"
                value={validDays}
                onChange={e => setValidDays(e.target.value)}
                min="1"
                max="90"
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500 tabular-nums font-mono"
              />
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Line Items ({newItems.length})
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Add Custom Line Item
              </button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto p-0.5">
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Description (e.g. 50-Gal Water Heater, Parts & Labor)"
                    value={item.description}
                    onChange={e => handleItemChange(idx, 'description', e.target.value)}
                    className="flex-1 h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400">Qty</span>
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                      min="1"
                      className="w-16 h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md text-center focus:border-blue-500 font-mono tabular-nums"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-400">$</span>
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.unit_price}
                      onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                      min="0"
                      step="0.01"
                      className="w-24 h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md text-right focus:border-blue-500 font-mono tabular-nums"
                    />
                  </div>
                  {newItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 text-xs">
              <span className="text-slate-500 dark:text-zinc-400 mr-2 font-medium">Estimated Subtotal:</span>
              <span className="font-bold text-slate-900 dark:text-white tabular-nums font-mono">${calculatedSubtotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Upfront Deposit Section (Explicit 50% Preset & Card / Apple Pay Checkout) */}
          <div className="p-3.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label htmlFor="depositToggle" className="text-xs font-semibold text-slate-900 dark:text-zinc-100 cursor-pointer flex items-center gap-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Require Upfront Deposit Upon Approval</span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                  Customer signs quote and pays required deposit via Apple Pay or Credit Card to reserve their spot.
                </p>
              </div>
              <input
                type="checkbox"
                id="depositToggle"
                checked={requiresDeposit}
                onChange={e => setRequiresDeposit(e.target.checked)}
                className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-600 h-4 w-4 cursor-pointer"
              />
            </div>

            {requiresDeposit && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900 text-xs">
                    <button
                      type="button"
                      onClick={() => { setDepositType('percentage'); setDepositValue(50); }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                        depositType === 'percentage'
                          ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                          : "text-slate-600 dark:text-zinc-400"
                      )}
                    >
                      % Percentage
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDepositType('fixed'); setDepositValue(Math.round(calculatedSubtotal * 0.5)); }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                        depositType === 'fixed'
                          ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                          : "text-slate-600 dark:text-zinc-400"
                      )}
                    >
                      $ Fixed Amount
                    </button>
                  </div>

                  {depositType === 'percentage' ? (
                    <div className="flex items-center gap-1.5">
                      {[20, 30, 50].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDepositValue(pct)}
                          className={cn(
                            "h-7 px-2.5 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                            depositValue === pct
                              ? "bg-emerald-50 dark:bg-emerald-950/70 border-emerald-500 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30"
                              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
                          )}
                        >
                          {pct}% {pct === 50 ? '(Standard)' : ''}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        value={depositValue}
                        onChange={e => setDepositValue(Number(e.target.value))}
                        className="h-7 w-16 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md text-right font-mono tabular-nums"
                      />
                      <span className="text-xs text-slate-500">%</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 font-medium">$</span>
                      <Input
                        type="number"
                        min={1}
                        max={calculatedSubtotal || 10000}
                        value={depositValue}
                        onChange={e => setDepositValue(Number(e.target.value))}
                        className="h-7 w-24 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md font-mono tabular-nums"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs bg-emerald-50/80 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-200/60 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <span>Deposit Due Upon Acceptance: <strong className="font-mono">${calculatedDepositAmount.toFixed(2)}</strong></span>
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                    Balance on completion: ${(calculatedSubtotal - calculatedDepositAmount).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Customer Notes / Warranty / Terms */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Customer Notes / Warranty Scope
            </label>
            <textarea
              rows={2}
              value={quoteNotes}
              onChange={e => setQuoteNotes(e.target.value)}
              placeholder="e.g. Includes manufacturer parts warranty. Work site thoroughly vacuumed and cleaned."
              className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 text-xs focus:outline-none focus:border-blue-500 resize-none shadow-2xs"
            />
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              className="h-9 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:text-white shadow-2xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingQuote}
              onClick={() => handleSaveQuote(false)}
              className="h-9 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingQuote}
              onClick={() => handleSaveQuote(true)}
              className="h-9 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs cursor-pointer"
            >
              {savingQuote ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Save & Send via SMS
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}

export default function ClientQuotesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-500">Loading estimates...</div>}>
      <ClientQuotesContent />
    </Suspense>
  )
}
