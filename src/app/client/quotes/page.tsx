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
  AlertCircle,
  MoreVertical,
  Eye,
  Phone,
  Mail,
  MapPin,
  RotateCcw,
  BadgeCheck,
  Lock,
  ArrowLeft,
  SlidersHorizontal,
  CheckCircle,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { FoundMoneyUnlockModal } from '@/components/billing/found-money-unlock-modal'
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
import { useWorkspace } from '@/lib/context/workspace-context'
import { INDUSTRY_LIST, getIndustryPreset } from '@/lib/constants/industries'
import { formatCustomerName } from '@/lib/booking/customer-input-formatter'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'
import { calculateQuoteFinancials } from '@/lib/quotes/quote-math'

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
  declined_at?: string
  decline_reason?: string
  notes?: string
  signature_data?: string
  signed_by?: string
  signed_ip?: string
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Approved
        </span>
      )
    case 'viewed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          Viewed
        </span>
      )
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Sent
        </span>
      )
    case 'declined':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Declined
        </span>
      )
    case 'expired':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-500 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          Expired
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
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
  const [tab, setTab] = useState<'all' | 'pending' | 'accepted' | 'declined' | 'draft' | 'expired'>('all')
  const [search, setSearch] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [convertingInvoiceId, setConvertingInvoiceId] = useState<string | null>(null)

  // Focused Quote Details Modal State (Part 5)
  const [selectedQuoteForDetails, setSelectedQuoteForDetails] = useState<Quote | null>(null)

  // Mobile Action Sheet State (Part 3)
  const [selectedQuoteForActions, setSelectedQuoteForActions] = useState<Quote | null>(null)

  // New Quote Wizard State (Part 4)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState<1 | 2 | 3 | 4>(1)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [quoteTitle, setQuoteTitle] = useState('Standard Service Estimate')
  const [validDays, setValidDays] = useState('14')
  const [quoteNotes, setQuoteNotes] = useState('Includes complete labor, standard parts warranty, and clean work area guarantee.')
  const [newItems, setNewItems] = useState<QuoteItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ])
  const [taxRate, setTaxRate] = useState<string>('0')
  const [discountAmount, setDiscountAmount] = useState<string>('0')
  const [requiresDeposit, setRequiresDeposit] = useState(false)
  const [depositType, setDepositType] = useState<'percentage' | 'fixed'>('percentage')
  const [depositValue, setDepositValue] = useState<number>(50)
  const [savingQuote, setSavingQuote] = useState(false)

  // 21 Trades Selector State
  const { orgIndustry, operationMode } = useWorkspace()
  const [selectedTradeId, setSelectedTradeId] = useState<string>('all')
  const [showAllTrades, setShowAllTrades] = useState(false)
  const [tradeSearch, setTradeSearch] = useState<string>('')

  // Found Money Finish-Line Paywall Modal (Job #4+)
  const [showFoundMoneyModal, setShowFoundMoneyModal] = useState(false)
  const [gatedQuoteData, setGatedQuoteData] = useState<{
    amount?: number
    customerName?: string
  } | null>(null)
  const [starterUsage, setStarterUsage] = useState<{ isLimitReached: boolean; completedJobsCount: number } | null>(null)

  useEffect(() => {
    let isMounted = true
    fetch('/api/client/billing')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (isMounted && d?.entitlement?.starterUsage) {
          setStarterUsage(d.entitlement.starterUsage)
        }
      })
      .catch(() => {})
    return () => { isMounted = false }
  }, [])

  // Align default trade with organization onboarding trade
  useEffect(() => {
    if (orgIndustry && orgIndustry !== 'general') {
      setSelectedTradeId(orgIndustry)
    }
  }, [orgIndustry])

  // Listen to contact_id or quick-create query param
  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam)
      setShowCreateModal(true)
      setCreateStep(2) // Jump to items step if contact preselected
    } else if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
      setShowCreateModal(true)
      setCreateStep(1)
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

  // Real-Time Authoritative Financial Calculations via Shared Helper
  const calculatedFinancials = useMemo(() => {
    const safeTax = Math.max(0, parseFloat(taxRate) || 0)
    const safeDiscount = Math.max(0, parseFloat(discountAmount) || 0)
    return calculateQuoteFinancials(newItems, {
      taxRate: safeTax,
      discount: safeDiscount
    })
  }, [newItems, taxRate, discountAmount])

  const calculatedDepositAmount = useMemo(() => {
    if (!requiresDeposit) return 0
    if (depositType === 'percentage') {
      const pct = Math.min(100, Math.max(1, depositValue || 50))
      return Math.round(((calculatedFinancials.total * pct) / 100) * 100) / 100
    }
    return Math.min(calculatedFinancials.total, Math.max(1, depositValue || 0))
  }, [requiresDeposit, depositType, depositValue, calculatedFinancials.total])

  // Standardized Win-Rate Formula: Accepted / (Accepted + Declined + Expired) * 100
  const nowTs = Date.now()
  const pendingQuotes = useMemo(() => quotes.filter(q => {
    if (q.status === 'sent' || q.status === 'viewed') {
      const isExpired = q.expires_at && new Date(q.expires_at).getTime() < nowTs
      return !isExpired
    }
    return false
  }), [quotes, nowTs])

  const pendingValue = useMemo(() => pendingQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0), [pendingQuotes])

  const acceptedQuotes = useMemo(() => quotes.filter(q => q.status === 'accepted'), [quotes])
  const acceptedValue = useMemo(() => acceptedQuotes.reduce((acc, q) => acc + (Number(q.total) || 0), 0), [acceptedQuotes])

  const declinedQuotes = useMemo(() => quotes.filter(q => q.status === 'declined'), [quotes])

  const expiredQuotes = useMemo(() => quotes.filter(q => {
    if (q.status === 'expired') return true
    if (q.expires_at && new Date(q.expires_at).getTime() < nowTs && q.status !== 'accepted') return true
    return false
  }), [quotes, nowTs])

  const draftQuotes = useMemo(() => quotes.filter(q => q.status === 'draft'), [quotes])

  const resolvedCount = acceptedQuotes.length + declinedQuotes.length + expiredQuotes.length
  const winRate = resolvedCount > 0 ? Math.round((acceptedQuotes.length / resolvedCount) * 100) : 0

  // Filter quotes based on search and status tab
  const filteredQuotes = useMemo(() => {
    return quotes.filter(q => {
      const isPastDue = q.expires_at && new Date(q.expires_at).getTime() < nowTs && q.status !== 'accepted'
      const isExpired = q.status === 'expired' || isPastDue

      if (tab === 'pending') {
        if (q.status !== 'sent' && q.status !== 'viewed') return false
        if (isExpired) return false
      }
      if (tab === 'accepted' && q.status !== 'accepted') return false
      if (tab === 'declined' && q.status !== 'declined') return false
      if (tab === 'draft' && q.status !== 'draft') return false
      if (tab === 'expired' && !isExpired) return false

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
  }, [quotes, tab, search, nowTs])

  // Filtered Contacts for Picker
  const filteredContacts = useMemo(() => {
    if (!customerSearch.trim()) return contacts
    const q = customerSearch.toLowerCase()
    return contacts.filter(c => 
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.address?.toLowerCase().includes(q)
    )
  }, [contacts, customerSearch])

  const selectedContact = useMemo(() => {
    return contacts.find(c => c.id === selectedContactId) || null
  }, [contacts, selectedContactId])

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
        if (selectedQuoteForDetails?.id === quoteId) {
          setSelectedQuoteForDetails(prev => prev ? { ...prev, status: 'sent', sent_at: new Date().toISOString() } : null)
        }
      } else {
        const err = await res.json().catch(() => ({}))
        if (res.status === 402 || err.upgradeRequired) {
          const targetQuote = quotes.find(q => q.id === quoteId)
          setGatedQuoteData({
            amount: targetQuote?.total || undefined,
            customerName: targetQuote?.contact?.name || 'Customer'
          })
          setShowFoundMoneyModal(true)
          return
        }
        toast.error(err.error || 'Failed to send quote.')
      }
    } catch {
      toast.error('Network error sending quote.')
    } finally {
      setActionLoadingId(null)
      setSelectedQuoteForActions(null)
    }
  }

  const handleDeleteDraft = async (quoteId: string) => {
    if (!confirm('Are you sure you want to delete this draft estimate?')) return
    setActionLoadingId(quoteId)
    try {
      const res = await fetch(`/api/client/quotes?id=${quoteId}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success('Draft estimate deleted.')
        loadQuotes()
        if (selectedQuoteForDetails?.id === quoteId) {
          setSelectedQuoteForDetails(null)
        }
      } else {
        toast.error(data.error || 'Failed to delete draft.')
      }
    } catch {
      toast.error('Network error deleting draft.')
    } finally {
      setActionLoadingId(null)
      setSelectedQuoteForActions(null)
    }
  }

  const handleConvertToJob = async (quoteId: string) => {
    if (starterUsage?.isLimitReached) {
      const targetQuote = quotes.find(q => q.id === quoteId)
      setGatedQuoteData({
        amount: targetQuote?.total || undefined,
        customerName: targetQuote?.contact?.name || 'Customer'
      })
      setShowFoundMoneyModal(true)
      return
    }
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
      } else if (res.status === 402 || data.upgradeRequired) {
        const targetQuote = quotes.find(q => q.id === quoteId)
        setGatedQuoteData({
          amount: targetQuote?.total || undefined,
          customerName: targetQuote?.contact?.name || 'Customer'
        })
        setShowFoundMoneyModal(true)
      } else {
        toast.error(data.error || 'Failed to convert quote to job.')
      }
    } catch {
      toast.error('Network error converting quote.')
    } finally {
      setConvertingId(null)
      setSelectedQuoteForActions(null)
    }
  }

  const handleConvertToInvoice = async (quoteId: string) => {
    if (starterUsage?.isLimitReached) {
      const targetQuote = quotes.find(q => q.id === quoteId)
      setGatedQuoteData({
        amount: targetQuote?.total || undefined,
        customerName: targetQuote?.contact?.name || 'Customer'
      })
      setShowFoundMoneyModal(true)
      return
    }
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
      } else if (res.status === 402 || data.upgradeRequired) {
        const targetQuote = quotes.find(q => q.id === quoteId)
        setGatedQuoteData({
          amount: targetQuote?.total || undefined,
          customerName: targetQuote?.contact?.name || 'Customer'
        })
        setShowFoundMoneyModal(true)
      } else {
        toast.error(data.error || 'Failed to convert quote to invoice.')
      }
    } catch {
      toast.error('Network error converting quote to invoice.')
    } finally {
      setConvertingInvoiceId(null)
      setSelectedQuoteForActions(null)
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
    const unitPrice = typeof service.price === 'number' && service.price > 0 ? service.price : 0

    // If only 1 empty line item exists, replace it; otherwise append
    if (newItems.length === 1 && !newItems[0].description.trim() && Number(newItems[0].unit_price) === 0) {
      setNewItems([{ description: `${service.name} - ${cleanDesc}`, quantity: 1, unit_price: unitPrice }])
    } else {
      setNewItems([...newItems, { description: `${service.name} - ${cleanDesc}`, quantity: 1, unit_price: unitPrice }])
    }

    if (quoteTitle === 'Standard Service Estimate' || !quoteTitle.trim()) {
      setQuoteTitle(`${service.name}`)
    }
    if (unitPrice > 0) {
      toast.success(`Added ${service.name} ($${unitPrice}) to estimate`)
    } else {
      toast.success(`Added ${service.name} to estimate`)
    }
  }

  const handleSaveQuote = async (andSend: boolean = false) => {
    if (!selectedContactId) {
      toast.error('Please choose a customer from the directory.')
      setCreateStep(1)
      return
    }
    if (newItems.some(i => !i.description.trim() || Number(i.unit_price) <= 0)) {
      toast.error('Please provide a valid description and price for all line items.')
      setCreateStep(2)
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
          tax_rate: parseFloat(taxRate) || 0,
          discount_amount: parseFloat(discountAmount) || 0,
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
        resetCreateForm()
        loadQuotes()
      } else {
        const err = await res.json().catch(() => ({}))
        if (res.status === 402 || err.code === 'STARTER_LIMIT_REACHED' || err.upgradeRequired) {
          setShowCreateModal(false)
          const contact = contacts.find(c => c.id === selectedContactId)
          setGatedQuoteData({
            amount: calculatedFinancials.total > 0 ? calculatedFinancials.total : undefined,
            customerName: contact?.name || 'Customer'
          })
          setShowFoundMoneyModal(true)
          return
        }
        toast.error(err.error || 'Failed to create quote.')
      }
    } catch {
      toast.error('Network error saving quote.')
    } finally {
      setSavingQuote(false)
    }
  }

  const resetCreateForm = () => {
    setCreateStep(1)
    setSelectedContactId('')
    setCustomerSearch('')
    setQuoteTitle('Standard Service Estimate')
    setValidDays('14')
    setQuoteNotes('Includes complete labor, standard parts warranty, and clean work area guarantee.')
    setNewItems([{ description: '', quantity: 1, unit_price: 0 }])
    setTaxRate('0')
    setDiscountAmount('0')
    setRequiresDeposit(false)
    setDepositType('percentage')
    setDepositValue(50)
  }

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
              Quotes &amp; Estimates
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 tabular-nums">
              {quotes.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Create professional estimates, collect upfront deposits, and get customer approval by text.
          </p>
        </div>

        <Button
          onClick={() => {
            if (starterUsage?.isLimitReached) {
              setGatedQuoteData({ customerName: 'Customer' })
              setShowFoundMoneyModal(true)
              return
            }
            resetCreateForm()
            setShowCreateModal(true)
          }}
          size="sm"
          className="h-10 sm:h-9 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs self-stretch sm:self-auto min-h-[44px] sm:min-h-0 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          <span>New Estimate</span>
        </Button>
      </div>

      {/* 3 Compact Financial Summary Tokens (Mobile-Optimized Row) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {/* Metric 1: Active Pipeline */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-2.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold truncate">
              Active Pipeline
            </p>
            <Clock className="h-3.5 w-3.5 text-amber-500/80 shrink-0 hidden xs:block" />
          </div>
          <p className="text-base sm:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums font-mono mt-0.5 sm:mt-1 truncate">
            ${pendingValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
            {pendingQuotes.length} pending decision
          </p>
        </div>

        {/* Metric 2: Approved Quotes */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-2.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold truncate">
              Approved
            </p>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/80 shrink-0 hidden xs:block" />
          </div>
          <p className="text-base sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-0.5 sm:mt-1 truncate">
            ${acceptedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
            {acceptedQuotes.length} won (uncollected)
          </p>
        </div>

        {/* Metric 3: Quote Win Rate */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-2.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold truncate">
              Win Rate
            </p>
            <TrendingUp className="h-3.5 w-3.5 text-blue-500/80 shrink-0 hidden xs:block" />
          </div>
          <p className="text-base sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums font-mono mt-0.5 sm:mt-1 truncate">
            {winRate}%
          </p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
            {acceptedQuotes.length} of {resolvedCount} resolved
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Thumb-Friendly Navigation Tabs */}
        <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
          {[
            { key: 'all', label: 'All Estimates', count: quotes.length },
            { key: 'pending', label: 'Awaiting Decision', count: pendingQuotes.length },
            { key: 'accepted', label: 'Approved', count: acceptedQuotes.length },
            { key: 'declined', label: 'Declined', count: declinedQuotes.length },
            { key: 'draft', label: 'Drafts', count: draftQuotes.length },
            { key: 'expired', label: 'Expired', count: expiredQuotes.length }
          ].map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={cn(
                "px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0",
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
          <Input
            placeholder="Search customer, quote #, or title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 sm:h-9 pl-9 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-400 rounded-lg shadow-2xs focus:border-blue-500 min-h-[44px] sm:min-h-0"
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
          onAction={search ? () => setSearch('') : () => { resetCreateForm(); setShowCreateModal(true); }}
        />
      ) : (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          
          {/* ========================================================================= */}
          {/* DESKTOP TABLE VIEW (>= 768px)                                             */}
          {/* ========================================================================= */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200/80 dark:border-zinc-800">
                <TableRow className="border-b border-slate-200/80 dark:border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Quote #</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Customer</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Scope &amp; Title</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Status</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Expiration</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Total &amp; Deposit</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredQuotes.map(quote => {
                  const isAccepted = quote.status === 'accepted'
                  const isDeclined = quote.status === 'declined'
                  const isPastDue = quote.expires_at && new Date(quote.expires_at).getTime() < nowTs && !isAccepted
                  const isExpired = quote.status === 'expired' || isPastDue
                  const daysLeft = Math.ceil((new Date(quote.expires_at).getTime() - nowTs) / (1000 * 60 * 60 * 24))

                  return (
                    <TableRow 
                      key={quote.id} 
                      className="border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedQuoteForDetails(quote)}
                    >
                      <TableCell className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-700 dark:text-zinc-300">
                        {quote.quote_number}
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                          {formatCustomerName(quote.contact?.name) || 'Homeowner'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {quote.contact?.phone ? formatNationalUs(quote.contact.phone) : '-'}
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
                            isExpired ? "text-rose-600 dark:text-rose-400 font-semibold" : daysLeft <= 3 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-400"
                          )}>
                            {isExpired ? 'Expired' : `${daysLeft}d remaining`}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right tabular-nums">
                        <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 font-mono">
                          ${Number(quote.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {quote.requires_deposit && (
                          <div className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                            Deposit: ${Number(quote.deposit_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* 1-Tap Details */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedQuoteForDetails(quote)}
                            className="h-7.5 px-2 text-xs text-slate-700 hover:text-slate-900 dark:text-zinc-300 font-medium rounded-md shadow-2xs cursor-pointer"
                            title="View quote details"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span>Details</span>
                          </Button>

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
                                  <span>+ Job</span>
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
                                <span>+ Invoice</span>
                              </Button>
                            </>
                          )}

                          {/* Delete Draft Action (Draft only) */}
                          {quote.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(quote.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors"
                              title="Delete draft estimate"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* ========================================================================= */}
          {/* MOBILE CARD LIST VIEW (< 768px)                                           */}
          {/* ========================================================================= */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredQuotes.map(quote => {
              const isAccepted = quote.status === 'accepted'
              const isDeclined = quote.status === 'declined'
              const isPastDue = quote.expires_at && new Date(quote.expires_at).getTime() < nowTs && !isAccepted
              const isExpired = quote.status === 'expired' || isPastDue
              const daysLeft = Math.ceil((new Date(quote.expires_at).getTime() - nowTs) / (1000 * 60 * 60 * 24))

              return (
                <div 
                  key={quote.id} 
                  data-quote-card="true"
                  className="p-4 space-y-3 bg-white dark:bg-zinc-900 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedQuoteForDetails(quote)}
                >
                  {/* Top Bar: Quote #, Status Badge, Amount & Deposit */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs text-slate-600 dark:text-zinc-400 font-semibold">{quote.quote_number}</span>
                        {getQuoteStatusBadge(quote.status)}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100 leading-snug line-clamp-1">{quote.title}</h3>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-base font-extrabold text-slate-900 dark:text-zinc-100 tabular-nums font-mono">
                        ${Number(quote.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      {quote.requires_deposit && (
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          Deposit: ${Number(quote.deposit_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Customer Information & Expiration */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-zinc-400 pt-1 border-t border-slate-100/80 dark:border-zinc-800/60">
                    <div className="flex items-center gap-1.5 truncate" onClick={e => e.stopPropagation()}>
                      <span className="font-medium text-slate-800 dark:text-zinc-200 truncate">
                        {formatCustomerName(quote.contact?.name) || 'Homeowner'}
                      </span>
                      {quote.contact?.phone && (
                        <a
                          href={`tel:${quote.contact.phone}`}
                          className="text-[11px] text-blue-600 dark:text-blue-400 font-mono hover:underline shrink-0"
                          title="Call customer"
                        >
                          {formatNationalUs(quote.contact.phone)}
                        </a>
                      )}
                    </div>

                    <div className="text-[11px] font-medium shrink-0 ml-2">
                      {isExpired ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">Expired</span>
                      ) : !isAccepted && !isDeclined ? (
                        <span className={daysLeft <= 3 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-400 dark:text-zinc-500"}>
                          {daysLeft > 0 ? `${daysLeft}d left` : 'Due today'}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-zinc-500">
                          {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Linked Job Indicator */}
                  {isAccepted && quote.jobs && quote.jobs.length > 0 && (
                    <div className="pt-0.5" onClick={e => e.stopPropagation()}>
                      <Link
                        href={`/client/calendar?tab=dispatch&search=${quote.jobs[0].job_number}`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/40"
                      >
                        <Briefcase className="h-3 w-3" />
                        <span>Scheduled: Job #{quote.jobs[0].job_number} ({quote.jobs[0].status})</span>
                      </Link>
                    </div>
                  )}

                  {/* Actions Row (44px Minimum Touch Targets) */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {/* Copy Link Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyLink(quote.manage_token, quote.id)}
                        className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs cursor-pointer min-h-[44px] min-w-[44px]"
                        title="Copy customer quote link"
                        aria-label="Copy customer quote link"
                      >
                        {copiedId === quote.id ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>

                      {/* Preview Public Quote Button */}
                      <a
                        href={`/quote/${quote.manage_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs min-h-[44px] min-w-[44px]"
                        title="Preview customer view"
                        aria-label="Preview customer view"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>

                      {/* More Secondary Actions Trigger */}
                      <button
                        type="button"
                        onClick={() => setSelectedQuoteForActions(quote)}
                        className="h-10 w-10 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs cursor-pointer min-h-[44px] min-w-[44px]"
                        title="More actions"
                        aria-label="More actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Primary Contextual Action Button */}
                    <div className="flex items-center gap-2">
                      {!isAccepted && !isDeclined && (
                        <Button
                          size="sm"
                          onClick={() => handleSendQuote(quote.id)}
                          disabled={actionLoadingId === quote.id}
                          className="h-10 px-3.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                        >
                          {actionLoadingId === quote.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          <span>{quote.status === 'sent' ? 'Resend' : 'Send SMS'}</span>
                        </Button>
                      )}

                      {isAccepted && (
                        <>
                          {(!quote.jobs || quote.jobs.length === 0) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleConvertToJob(quote.id)}
                              disabled={convertingId === quote.id}
                              className="h-10 px-3 text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-500/20 shadow-2xs flex items-center gap-1 cursor-pointer min-h-[44px]"
                            >
                              {convertingId === quote.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Briefcase className="h-3.5 w-3.5" />
                              )}
                              <span>+ Job</span>
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleConvertToInvoice(quote.id)}
                            disabled={convertingInvoiceId === quote.id}
                            className="h-10 px-3 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-500/20 shadow-2xs flex items-center gap-1 cursor-pointer min-h-[44px]"
                          >
                            {convertingInvoiceId === quote.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Receipt className="h-3.5 w-3.5" />
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

      {/* ========================================================================= */}
      {/* MOBILE-NATIVE ESTIMATE CREATION MODAL (Part 4)                            */}
      {/* ========================================================================= */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Create Service Estimate"
        description="Build itemized proposals, calculate taxes, configure deposits, and dispatch via SMS."
        size="xl"
      >
        <div className="space-y-5">
          
          {/* Stepper Navigation Bar */}
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-zinc-950 rounded-xl border border-slate-200/80 dark:border-zinc-800 text-xs">
            {[
              { step: 1, label: '1. Customer' },
              { step: 2, label: '2. Items' },
              { step: 3, label: '3. Pricing' },
              { step: 4, label: '4. Review' }
            ].map(s => (
              <button
                key={s.step}
                type="button"
                onClick={() => setCreateStep(s.step as any)}
                className={cn(
                  "py-2 px-1 text-center font-semibold rounded-lg transition-all min-h-[38px] flex items-center justify-center",
                  createStep === s.step
                    ? "bg-white dark:bg-zinc-850 text-blue-600 dark:text-blue-400 shadow-xs"
                    : createStep > s.step
                    ? "text-emerald-700 dark:text-emerald-400 font-medium"
                    : "text-slate-500 dark:text-zinc-500 font-medium"
                )}
              >
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* STEP 1: CUSTOMER SELECTION                                          */}
          {/* ------------------------------------------------------------------- */}
          {createStep === 1 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200">
                  Select Customer from Directory <span className="text-rose-500">*</span>
                </label>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Search existing customer contacts or select who will receive this quotation.
                </p>
              </div>

              {/* Customer Search Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Filter by customer name, phone, or address..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="h-10 pl-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 min-h-[44px]"
                />
              </div>

              {/* Customer Select Dropdown / List */}
              <div className="space-y-2">
                <select
                  aria-label="Select Customer"
                  value={selectedContactId}
                  onChange={e => setSelectedContactId(e.target.value)}
                  className="w-full p-3 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs min-h-[48px]"
                >
                  <option value="">-- Choose Customer ({filteredContacts.length} available) --</option>
                  {filteredContacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Valued Customer'} ({c.phone || 'No phone'}) {c.address ? `• ${c.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Customer Contact Card */}
              {selectedContact ? (
                <div className="p-3.5 rounded-xl border border-emerald-200/80 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      {formatCustomerName(selectedContact.name)}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
                      Selected
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-emerald-900 dark:text-emerald-200">
                    <div>
                      <span className="text-emerald-600/80 dark:text-emerald-400/80">Phone: </span>
                      <strong className="font-mono">{selectedContact.phone ? formatNationalUs(selectedContact.phone) : 'Unset'}</strong>
                    </div>
                    {selectedContact.email && (
                      <div>
                        <span className="text-emerald-600/80 dark:text-emerald-400/80">Email: </span>
                        <span>{selectedContact.email}</span>
                      </div>
                    )}
                    {selectedContact.address && (
                      <div className="sm:col-span-2">
                        <span className="text-emerald-600/80 dark:text-emerald-400/80">Property: </span>
                        <span>{selectedContact.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-xs text-slate-400 text-center">
                  Select a customer to confirm contact details and advance to line items.
                </div>
              )}

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 text-xs min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!selectedContactId}
                  onClick={() => setCreateStep(2)}
                  className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px] flex items-center gap-1.5"
                >
                  <span>Next: Line Items</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------- */}
          {/* STEP 2: LINE ITEMS & TRADE PRESETS                                  */}
          {/* ------------------------------------------------------------------- */}
          {createStep === 2 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              
              {/* Estimate Title */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200 mb-1">
                  Estimate Title <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={quoteTitle}
                  onChange={e => setQuoteTitle(e.target.value)}
                  placeholder="e.g. Tankless Water Heater Replacement & New Line"
                  className="h-10 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 min-h-[44px]"
                />
              </div>

              {/* 1-Tap Trade Presets */}
              <div className="space-y-2 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Quick Trade Presets {selectedTradeId !== 'all' ? `(${getIndustryPreset(selectedTradeId).name.split('&')[0].trim()})` : ''}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowAllTrades(prev => !prev)}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    {showAllTrades ? 'Focus Trade' : 'Browse All Trades'}
                  </button>
                </div>

                {showAllTrades && (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 pb-0.5">
                    <select
                      value={selectedTradeId}
                      onChange={e => setSelectedTradeId(e.target.value)}
                      className="p-1 px-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-slate-800 dark:text-zinc-200 cursor-pointer min-h-[38px]"
                    >
                      {orgIndustry && orgIndustry !== 'general' && (
                        <option value={orgIndustry}>★ {getIndustryPreset(orgIndustry).name} (Primary Trade)</option>
                      )}
                      <option value="all">All 21 Home Service Trades</option>
                      {INDUSTRY_LIST.filter(ind => ind.id !== orgIndustry).map(ind => (
                        <option key={ind.id} value={ind.id}>{ind.name}</option>
                      ))}
                    </select>
                    <Input
                      placeholder="Search trade services..."
                      value={tradeSearch}
                      onChange={e => setTradeSearch(e.target.value)}
                      className="h-8 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 w-full sm:w-44"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
                  {filteredTrades.flatMap(trade => 
                    trade.services.map((svc, idx) => (
                      <button
                        key={`${trade.id}-${idx}`}
                        type="button"
                        onClick={() => handleApplyTradeService(svc, trade.name)}
                        className="p-2 text-left rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-blue-400 dark:hover:border-blue-500/40 transition-all text-xs cursor-pointer flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-bold uppercase text-slate-400 dark:text-zinc-500">{trade.badge}</span>
                          <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {svc.price ? `$${svc.price}` : 'Quote'}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate mt-0.5">{svc.name}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Vertically Stacked Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
                    Itemized Scope ({newItems.length} item{newItems.length === 1 ? '' : 's'})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold inline-flex items-center gap-1 cursor-pointer min-h-[36px]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto p-0.5">
                  {newItems.map((item, idx) => {
                    const itemTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase">
                            Item #{idx + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100 tabular-nums">
                              ${itemTotal.toFixed(2)}
                            </span>
                            {newItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center rounded"
                                title="Remove line item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Description */}
                        <Input
                          placeholder="Description (e.g. 50-Gal Water Heater, Parts & Labor)"
                          value={item.description}
                          onChange={e => handleItemChange(idx, 'description', e.target.value)}
                          className="h-10 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 min-h-[44px]"
                        />

                        {/* Quantity and Price Stack */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-[10px] font-medium text-slate-500 block mb-1">Quantity</span>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                              className="h-10 text-xs text-center font-mono font-semibold bg-white dark:bg-zinc-900 min-h-[44px]"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] font-medium text-slate-500 block mb-1">Unit Price ($)</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                              className="h-10 text-xs text-right font-mono font-semibold bg-white dark:bg-zinc-900 min-h-[44px]"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-zinc-950 text-xs">
                  <span className="font-semibold text-slate-600 dark:text-zinc-400">Subtotal ({newItems.length} items):</span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100 font-mono text-sm">${calculatedFinancials.subtotal.toFixed(2)}</span>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateStep(1)}
                  className="h-10 text-xs min-h-[44px] flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back: Customer</span>
                </Button>
                <Button
                  type="button"
                  disabled={newItems.some(i => !i.description.trim() || Number(i.unit_price) <= 0)}
                  onClick={() => setCreateStep(3)}
                  className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px] flex items-center gap-1.5"
                >
                  <span>Next: Financials</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------- */}
          {/* STEP 3: FINANCIAL DETAILS & DEPOSIT                                 */}
          {/* ------------------------------------------------------------------- */}
          {createStep === 3 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              
              {/* Subtotal Display */}
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-zinc-400">Line Items Subtotal:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white text-base">${calculatedFinancials.subtotal.toFixed(2)}</span>
              </div>

              {/* Tax & Discount Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Sales Tax Rate (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="30"
                      value={taxRate}
                      onChange={e => setTaxRate(e.target.value)}
                      placeholder="e.g. 8.25"
                      className="h-10 text-xs font-mono font-semibold bg-white dark:bg-zinc-950 pr-8 min-h-[44px]"
                    />
                    <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  </div>
                  {Number(taxRate) > 0 && (
                    <p className="text-[11px] text-slate-500 font-mono">
                      Calculated Tax: +${calculatedFinancials.tax.toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200">
                    Discount Amount ($)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountAmount}
                      onChange={e => setDiscountAmount(e.target.value)}
                      placeholder="e.g. 50.00"
                      className="h-10 text-xs font-mono font-semibold bg-white dark:bg-zinc-950 pl-8 min-h-[44px]"
                    />
                  </div>
                  {Number(discountAmount) > 0 && (
                    <p className="text-[11px] text-emerald-600 font-mono">
                      Deduction: -${calculatedFinancials.discount.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>

              {/* Upfront Deposit Configuration */}
              <div className="p-4 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="modalDepositToggle" className="text-xs font-bold text-slate-900 dark:text-zinc-100 cursor-pointer flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Require Upfront Deposit Upon Approval</span>
                    </label>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                      Customer pays deposit immediately on approval via Apple Pay or credit card.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    id="modalDepositToggle"
                    checked={requiresDeposit}
                    onChange={e => setRequiresDeposit(e.target.checked)}
                    className="rounded border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-600 h-5 w-5 cursor-pointer min-h-[24px]"
                  />
                </div>

                {requiresDeposit && (
                  <div className="pt-3 border-t border-slate-200/60 dark:border-zinc-800/80 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded-lg border border-slate-200 dark:border-zinc-800 p-0.5 bg-white dark:bg-zinc-900 text-xs">
                        <button
                          type="button"
                          onClick={() => { setDepositType('percentage'); setDepositValue(50); }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer min-h-[36px]",
                            depositType === 'percentage'
                              ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                              : "text-slate-600 dark:text-zinc-400"
                          )}
                        >
                          % Percentage
                        </button>
                        <button
                          type="button"
                          onClick={() => { setDepositType('fixed'); setDepositValue(Math.round(calculatedFinancials.total * 0.5)); }}
                          className={cn(
                            "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer min-h-[36px]",
                            depositType === 'fixed'
                              ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
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
                                "h-9 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer min-h-[36px]",
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
                            className="h-9 w-16 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-right font-mono tabular-nums"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500 font-medium">$</span>
                          <Input
                            type="number"
                            min={1}
                            max={calculatedFinancials.total || 10000}
                            value={depositValue}
                            onChange={e => setDepositValue(Number(e.target.value))}
                            className="h-9 w-28 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs font-mono tabular-nums"
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-emerald-900 dark:text-emerald-200">
                      <span>Deposit Due on Approval: <strong className="font-mono text-sm">${calculatedDepositAmount.toFixed(2)}</strong></span>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                        Balance upon job completion: ${(calculatedFinancials.total - calculatedDepositAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Grand Total Highlight Box */}
              <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 space-y-1.5 text-xs">
                <div className="flex justify-between text-blue-900 dark:text-blue-200 font-medium">
                  <span>Items Subtotal:</span>
                  <span className="font-mono">${calculatedFinancials.subtotal.toFixed(2)}</span>
                </div>
                {calculatedFinancials.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>Discount:</span>
                    <span className="font-mono">-${calculatedFinancials.discount.toFixed(2)}</span>
                  </div>
                )}
                {calculatedFinancials.tax > 0 && (
                  <div className="flex justify-between text-blue-900 dark:text-blue-200">
                    <span>Sales Tax ({taxRate}%):</span>
                    <span className="font-mono">+${calculatedFinancials.tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-blue-200/80 dark:border-blue-800/60 flex items-center justify-between text-base font-black text-blue-950 dark:text-blue-100">
                  <span>Total Proposed Investment:</span>
                  <span className="font-mono text-lg">${calculatedFinancials.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateStep(2)}
                  className="h-10 text-xs min-h-[44px] flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back: Items</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => setCreateStep(4)}
                  className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px] flex items-center gap-1.5"
                >
                  <span>Next: Review &amp; Send</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------- */}
          {/* STEP 4: REVIEW & DISPATCH                                           */}
          {/* ------------------------------------------------------------------- */}
          {createStep === 4 && (
            <div className="space-y-4 animate-in fade-in-50 duration-200">
              
              {/* Validity and Expiration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200 mb-1">
                    Valid For (Days)
                  </label>
                  <div className="flex items-center gap-1.5">
                    {['7', '14', '30'].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setValidDays(d)}
                        className={cn(
                          "h-10 px-3 rounded-lg text-xs font-semibold border transition-all cursor-pointer min-h-[44px]",
                          validDays === d
                            ? "bg-blue-50 dark:bg-blue-950/70 border-blue-500 text-blue-700 dark:text-blue-300"
                            : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                    <Input
                      type="number"
                      min="1"
                      max="90"
                      value={validDays}
                      onChange={e => setValidDays(e.target.value)}
                      className="h-10 w-20 text-xs text-center font-mono font-semibold bg-white dark:bg-zinc-900 min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 flex flex-col justify-center text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500">Calculated Expiration Date</span>
                  <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm mt-0.5">
                    {new Date(Date.now() + (Number(validDays) || 14) * 86400000).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Customer Notes / Warranty / Terms */}
              <div>
                <label className="block text-xs font-bold text-slate-800 dark:text-zinc-200 mb-1">
                  Customer Notes &amp; Warranty Terms
                </label>
                <textarea
                  rows={2}
                  value={quoteNotes}
                  onChange={e => setQuoteNotes(e.target.value)}
                  placeholder="e.g. Includes manufacturer warranty and site cleanup."
                  className="w-full p-3 rounded-xl bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                />
              </div>

              {/* Pre-Flight Dispatch Summary Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950 space-y-2.5 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block pb-1 border-b border-slate-200/80 dark:border-zinc-800">
                  Pre-Flight Dispatch Summary
                </span>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400">Recipient:</span>
                    <strong className="block text-slate-900 dark:text-zinc-100 truncate">
                      {formatCustomerName(selectedContact?.name)} ({selectedContact?.phone ? formatNationalUs(selectedContact.phone) : 'No phone'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Estimate Scope:</span>
                    <strong className="block text-slate-900 dark:text-zinc-100 truncate">{quoteTitle}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Total Investment:</span>
                    <strong className="block text-slate-900 dark:text-zinc-100 font-mono text-sm">${calculatedFinancials.total.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Required Deposit:</span>
                    <strong className="block text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                      {requiresDeposit ? `$${calculatedDepositAmount.toFixed(2)}` : 'None ($0.00)'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateStep(3)}
                  className="h-10 text-xs min-h-[44px] flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back: Financials</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={savingQuote}
                    onClick={() => handleSaveQuote(false)}
                    className="h-10 px-4 text-xs font-semibold min-h-[44px] flex-1 sm:flex-initial"
                  >
                    Save Draft
                  </Button>
                  <Button
                    type="button"
                    disabled={savingQuote}
                    onClick={() => handleSaveQuote(true)}
                    className="h-10 px-5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px] flex-1 sm:flex-initial flex items-center justify-center gap-1.5"
                  >
                    {savingQuote ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Dispatching...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Estimate via SMS</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* FOCUSED QUOTE DETAILS EXPERIENCE MODAL (Part 5)                           */}
      {/* ========================================================================= */}
      {selectedQuoteForDetails && (
        <Modal
          open={!!selectedQuoteForDetails}
          onOpenChange={(open) => !open && setSelectedQuoteForDetails(null)}
          title={`Estimate #${selectedQuoteForDetails.quote_number}`}
          description={`Created ${new Date(selectedQuoteForDetails.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`}
          size="xl"
        >
          <div className="space-y-4">
            
            {/* Status & Next Step Operational Guidance Banner */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                  Current Status
                </span>
                {getQuoteStatusBadge(selectedQuoteForDetails.status)}
              </div>
              <div className="text-slate-800 dark:text-zinc-200 font-medium leading-relaxed">
                {selectedQuoteForDetails.status === 'draft' && 'Draft estimate. Review line items and dispatch to customer via SMS.'}
                {selectedQuoteForDetails.status === 'sent' && 'Dispatched to customer. Awaiting customer to open and review proposal.'}
                {selectedQuoteForDetails.status === 'viewed' && 'Viewed by customer. Waiting for digital signature and approval.'}
                {selectedQuoteForDetails.status === 'accepted' && 'Approved and electronically signed! Ready to convert into a scheduled job or final invoice.'}
                {selectedQuoteForDetails.status === 'declined' && (
                  <span className="text-rose-600 dark:text-rose-400">
                    Customer declined proposal. {selectedQuoteForDetails.decline_reason ? `Feedback: "${selectedQuoteForDetails.decline_reason}"` : ''}
                  </span>
                )}
                {selectedQuoteForDetails.status === 'expired' && 'Estimate has expired. Create a revised estimate to re-open negotiation.'}
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 text-xs shadow-2xs">
              <span className="font-bold text-slate-900 dark:text-white block text-sm">
                {formatCustomerName(selectedQuoteForDetails.contact?.name) || 'Homeowner'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-zinc-400 text-xs">
                {selectedQuoteForDetails.contact?.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-blue-600" />
                    <a href={`tel:${selectedQuoteForDetails.contact.phone}`} className="font-mono hover:underline font-semibold">
                      {formatNationalUs(selectedQuoteForDetails.contact.phone)}
                    </a>
                  </div>
                )}
                {selectedQuoteForDetails.contact?.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedQuoteForDetails.contact.email}</span>
                  </div>
                )}
                {selectedQuoteForDetails.contact?.address && (
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{selectedQuoteForDetails.contact.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Service Scope & Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">
                  Scope: {selectedQuoteForDetails.title}
                </span>
                <span className="text-slate-400">{selectedQuoteForDetails.items?.length || 0} line items</span>
              </div>

              {selectedQuoteForDetails.notes && (
                <p className="text-xs text-slate-600 dark:text-zinc-300 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 italic">
                  &quot;{selectedQuoteForDetails.notes}&quot;
                </p>
              )}

              <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 text-xs">
                {(selectedQuoteForDetails.items || []).map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-zinc-100 block truncate">{it.description}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {it.quantity} &times; ${Number(it.unit_price).toFixed(2)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">
                      ${Number(it.total || (it.quantity * it.unit_price)).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Breakdown */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Items Subtotal:</span>
                <span className="font-mono font-semibold">${Number(selectedQuoteForDetails.subtotal).toFixed(2)}</span>
              </div>
              {Number(selectedQuoteForDetails.discount) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount Applied:</span>
                  <span className="font-mono font-semibold">-${Number(selectedQuoteForDetails.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(selectedQuoteForDetails.tax) > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Estimated Tax:</span>
                  <span className="font-mono font-semibold">+${Number(selectedQuoteForDetails.tax).toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-zinc-800 flex justify-between text-sm font-extrabold text-slate-900 dark:text-white">
                <span>Total Proposal:</span>
                <span className="font-mono text-base">${Number(selectedQuoteForDetails.total).toFixed(2)}</span>
              </div>

              {selectedQuoteForDetails.requires_deposit && (
                <div className="mt-2 pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 flex justify-between font-medium">
                  <span>Upfront Deposit ({selectedQuoteForDetails.deposit_type === 'percentage' ? `${selectedQuoteForDetails.deposit_value}%` : 'Fixed'}):</span>
                  <span className="font-mono font-bold">${Number(selectedQuoteForDetails.deposit_amount || 0).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Verified Electronic Signature Certificate (if accepted) */}
            {selectedQuoteForDetails.status === 'accepted' && (
              <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-emerald-200/60 dark:border-emerald-800/40">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-900 dark:text-emerald-100 flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    Verified E-Signature Certificate
                  </span>
                  <span className="font-mono font-bold text-[10px] text-emerald-700 dark:text-emerald-400">
                    CERT-{selectedQuoteForDetails.quote_number}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 block">Signer:</span>
                    <strong className="text-slate-900 dark:text-zinc-100">{selectedQuoteForDetails.signed_by || selectedQuoteForDetails.contact?.name || 'Customer'}</strong>
                    <span className="text-[10px] text-slate-500 block">
                      Accepted: {new Date(selectedQuoteForDetails.accepted_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(selectedQuoteForDetails.accepted_at || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {selectedQuoteForDetails.signature_data && (
                    <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/50 rounded-lg p-1.5 self-start sm:self-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={selectedQuoteForDetails.signature_data}
                        alt="Customer Signature"
                        className="max-h-10 w-auto object-contain dark:invert"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Contextual Actions Footer */}
            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyLink(selectedQuoteForDetails.manage_token, selectedQuoteForDetails.id)}
                  className="h-10 px-3 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 min-h-[44px] flex items-center gap-1.5"
                >
                  {copiedId === selectedQuoteForDetails.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>Copy Link</span>
                </button>

                <a
                  href={`/quote/${selectedQuoteForDetails.manage_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-10 px-3 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 min-h-[44px] flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Customer View</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                {selectedQuoteForDetails.status === 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => handleSendQuote(selectedQuoteForDetails.id)}
                    disabled={actionLoadingId === selectedQuoteForDetails.id}
                    className="h-10 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold min-h-[44px] flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Send via SMS</span>
                  </Button>
                )}

                {(selectedQuoteForDetails.status === 'sent' || selectedQuoteForDetails.status === 'viewed') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendQuote(selectedQuoteForDetails.id)}
                    disabled={actionLoadingId === selectedQuoteForDetails.id}
                    className="h-10 px-3 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800/40 min-h-[44px] flex items-center gap-1.5"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Resend SMS</span>
                  </Button>
                )}

                {selectedQuoteForDetails.status === 'accepted' && (
                  <>
                    {(!selectedQuoteForDetails.jobs || selectedQuoteForDetails.jobs.length === 0) && (
                      <Button
                        size="sm"
                        onClick={() => handleConvertToJob(selectedQuoteForDetails.id)}
                        disabled={convertingId === selectedQuoteForDetails.id}
                        className="h-10 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold min-h-[44px] flex items-center gap-1.5"
                      >
                        <Briefcase className="h-3.5 w-3.5" />
                        <span>Schedule Job</span>
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleConvertToInvoice(selectedQuoteForDetails.id)}
                      disabled={convertingInvoiceId === selectedQuoteForDetails.id}
                      className="h-10 px-3.5 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-800 min-h-[44px] flex items-center gap-1.5"
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      <span>Generate Invoice</span>
                    </Button>
                  </>
                )}
              </div>
            </div>

          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MOBILE ACTION SHEET MODAL (< 768px secondary actions)                     */}
      {/* ========================================================================= */}
      {selectedQuoteForActions && (
        <Modal
          open={!!selectedQuoteForActions}
          onOpenChange={(open) => !open && setSelectedQuoteForActions(null)}
          title={`Quote #${selectedQuoteForActions.quote_number}`}
          description={formatCustomerName(selectedQuoteForActions.contact?.name) || 'Customer Actions'}
          size="sm"
        >
          <div className="space-y-2 py-1">
            <button
              type="button"
              onClick={() => {
                const q = selectedQuoteForActions
                setSelectedQuoteForActions(null)
                setSelectedQuoteForDetails(q)
              }}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
            >
              <Eye className="h-4 w-4 text-blue-600" />
              <span>View Full Quote Details</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleCopyLink(selectedQuoteForActions.manage_token, selectedQuoteForActions.id)
                setSelectedQuoteForActions(null)
              }}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Copy Customer Link</span>
            </button>

            <a
              href={`/quote/${selectedQuoteForActions.manage_token}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSelectedQuoteForActions(null)}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px]"
            >
              <ExternalLink className="h-4 w-4 text-slate-500" />
              <span>Preview Customer View</span>
            </a>

            {selectedQuoteForActions.status !== 'accepted' && selectedQuoteForActions.status !== 'declined' && (
              <button
                type="button"
                onClick={() => handleSendQuote(selectedQuoteForActions.id)}
                className="w-full h-12 px-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 text-left text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
              >
                <Send className="h-4 w-4 text-blue-600" />
                <span>{selectedQuoteForActions.status === 'sent' ? 'Resend Estimate via SMS' : 'Send Estimate via SMS'}</span>
              </button>
            )}

            {selectedQuoteForActions.status === 'accepted' && (
              <>
                <button
                  type="button"
                  onClick={() => handleConvertToJob(selectedQuoteForActions.id)}
                  className="w-full h-12 px-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-left text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
                >
                  <Briefcase className="h-4 w-4 text-emerald-600" />
                  <span>Convert to Scheduled Job</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConvertToInvoice(selectedQuoteForActions.id)}
                  className="w-full h-12 px-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 text-left text-xs font-semibold text-blue-800 dark:text-blue-300 hover:bg-blue-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
                >
                  <Receipt className="h-4 w-4 text-blue-600" />
                  <span>Convert to Final Invoice</span>
                </button>
              </>
            )}

            {selectedQuoteForActions.status === 'draft' && (
              <button
                type="button"
                onClick={() => handleDeleteDraft(selectedQuoteForActions.id)}
                className="w-full h-12 px-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-left text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
              >
                <Trash2 className="h-4 w-4 text-rose-600" />
                <span>Delete Draft Estimate</span>
              </button>
            )}

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedQuoteForActions(null)}
                className="w-full h-11 text-xs min-h-[44px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mobile Floating Action Button */}
      <button
        type="button"
        onClick={() => {
          if (starterUsage?.isLimitReached) {
            setGatedQuoteData({ customerName: 'Customer' })
            setShowFoundMoneyModal(true)
            return
          }
          resetCreateForm()
          setShowCreateModal(true)
        }}
        className="fixed bottom-20 right-4 sm:hidden z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-3 rounded-full shadow-lg shadow-blue-600/30 font-semibold text-xs tracking-wide transition-all cursor-pointer min-h-[48px] min-w-[48px]"
        aria-label="Create New Estimate"
      >
        <Plus className="h-4 w-4" />
        <span>New Estimate</span>
      </button>

      {/* Found Money Finish-Line Paywall Modal */}
      <FoundMoneyUnlockModal
        isOpen={showFoundMoneyModal}
        onClose={() => setShowFoundMoneyModal(false)}
        amountDue={gatedQuoteData?.amount}
        customerName={gatedQuoteData?.customerName}
        operationMode={operationMode === 'multi_crew' ? 'multi_crew' : 'solo'}
        onSuccess={loadQuotes}
      />

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
