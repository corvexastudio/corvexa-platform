'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { selectBestAcceptedQuoteForJob } from '@/lib/jobs/quote-matching'
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Receipt,
  FileText,
  User,
  Calendar,
  Loader2,
  Trash2,
  Banknote,
  Ban,
  Download,
  Briefcase,
  Sparkles,
  Smartphone,
  ShieldCheck,
  ArrowRight,
  Edit2,
  MoreVertical,
  Eye,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { exportToCsv, CsvFormatters } from '@/lib/export/csv-export'
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
import { INDUSTRY_LIST, getIndustryPreset, type IndustryPreset } from '@/lib/constants/industries'
import { FoundMoneyUnlockModal } from '@/components/billing/found-money-unlock-modal'
import { formatCustomerName } from '@/lib/booking/customer-input-formatter'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  total?: number
}

interface PaymentRecord {
  id: string
  amount: number
  payment_method: string
  status: string
  reference_note?: string | null
  created_at: string
  stripe_receipt_url?: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  title: string
  description?: string
  subtotal: number
  tax: number
  discount: number
  total: number
  amount_paid: number
  amount_due: number
  status: 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'void'
  due_date: string
  payment_method?: string | null
  notes?: string | null
  created_at: string
  paid_at?: string | null
  sent_at?: string | null
  manage_token: string
  job_id?: string | null
  quote_id?: string | null
  contact?: {
    id: string
    name: string
    phone: string
    email?: string
    address?: string
  }
  job?: {
    id: string
    job_number: string
    status: string
  }
  quote?: {
    id: string
    quote_number: string
    title: string
  }
  items?: InvoiceItem[]
  payments?: PaymentRecord[]
}

function getInvoiceStatusBadge(inv: Invoice) {
  const isPaid = inv.status === 'paid'
  const isVoid = inv.status === 'void'
  const isDraft = inv.status === 'draft'
  const remainingDue = Number(inv.amount_due ?? (Number(inv.total || 0) - Number(inv.amount_paid || 0)))
  const isOverdue =
    inv.status === 'overdue' ||
    (!isDraft && !isPaid && !isVoid && remainingDue > 0 && new Date(inv.due_date).getTime() < Date.now())

  if (isPaid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
        Paid in Full
      </span>
    )
  }
  if (inv.status === 'partially_paid') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
        Partially Paid
      </span>
    )
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
        Overdue
      </span>
    )
  }
  if (inv.status === 'sent') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20">
        Sent
      </span>
    )
  }
  if (inv.status === 'viewed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20">
        Viewed
      </span>
    )
  }
  if (isVoid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700">
        Void
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
      Draft
    </span>
  )
}

function getDescriptiveStatusBadge(inv: Invoice) {
  const isPaid = inv.status === 'paid'
  const isVoid = inv.status === 'void'
  const isDraft = inv.status === 'draft'
  const remainingDue = Number(inv.amount_due ?? (Number(inv.total || 0) - Number(inv.amount_paid || 0)))
  const isOverdue =
    inv.status === 'overdue' ||
    (!isDraft && !isPaid && !isVoid && remainingDue > 0 && new Date(inv.due_date).getTime() < Date.now())

  if (isPaid) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        Paid in full
      </span>
    )
  }
  if (inv.status === 'partially_paid') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
        ${remainingDue.toFixed(2)} remaining
      </span>
    )
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
        <AlertCircle className="h-3 w-3 text-rose-600 dark:text-rose-400" />
        Payment was due on {new Date(inv.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
      </span>
    )
  }
  if (inv.status === 'sent') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
        <Send className="h-3 w-3 text-blue-600 dark:text-blue-400" />
        Waiting for customer payment
      </span>
    )
  }
  if (inv.status === 'viewed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800">
        <Eye className="h-3 w-3 text-sky-600 dark:text-sky-400" />
        Viewed by customer
      </span>
    )
  }
  if (isVoid) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
        <Ban className="h-3 w-3" />
        Voided
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
      <Clock className="h-3 w-3" />
      Not sent to the customer
    </span>
  )
}

function ClientInvoicesContent() {
  const searchParams = useSearchParams()
  const contactIdParam = searchParams.get('contact_id')
  const titleParam = searchParams.get('title')
  const jobIdParam = searchParams.get('job_id')
  const quoteIdParam = searchParams.get('quote_id')

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null)
  const [matchingQuotes, setMatchingQuotes] = useState<any[]>([])
  const [loadingMatchingQuotes, setLoadingMatchingQuotes] = useState(false)

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'overdue' | 'draft' | 'void'>('all')
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || searchParams.get('q') || '')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null)

  // Focused Invoice Detail Modal State
  const [selectedInvoiceForDetail, setSelectedInvoiceForDetail] = useState<Invoice | null>(null)

  // Mobile Bottom-Sheet Action Menu State
  const [selectedInvoiceForActions, setSelectedInvoiceForActions] = useState<Invoice | null>(null)

  // New Invoice Wizard State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [invoiceTitle, setInvoiceTitle] = useState('Standard Service Invoice')
  const [dueDateDays, setDueDateDays] = useState('7')
  const [taxRate, setTaxRate] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [newItems, setNewItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0 }
  ])
  const newItemsRef = useRef<InvoiceItem[]>(newItems)
  const selectedQuoteIdRef = useRef<string | null>(selectedQuoteId)
  useEffect(() => {
    newItemsRef.current = newItems
  }, [newItems])
  useEffect(() => {
    selectedQuoteIdRef.current = selectedQuoteId
  }, [selectedQuoteId])

  const { orgIndustry, operationMode } = useWorkspace()
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState<string>('all')
  const [showAllTrades, setShowAllTrades] = useState(false)
  const [foundMoneyModalOpen, setFoundMoneyModalOpen] = useState(false)
  const [gatedInvoiceData, setGatedInvoiceData] = useState<{
    amount?: number
    customerName?: string
    invoiceNumber?: string
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

  // Sync search query from URL parameter if updated dynamically
  useEffect(() => {
    const searchParam = searchParams.get('search') || searchParams.get('q')
    if (searchParam) {
      setSearchQuery(searchParam)
    }
  }, [searchParams])

  // Listen to contact_id / title / job_id / quote_id / create query param
  useEffect(() => {
    if (jobIdParam) {
      setSelectedJobId(jobIdParam)
    }
    if (quoteIdParam) {
      setSelectedQuoteId(quoteIdParam)
    }
    const isExplicitCreate = searchParams.get('create') === 'true' || searchParams.get('new') === 'true' || Boolean(quoteIdParam)
    const hasSearch = Boolean(searchParams.get('search') || searchParams.get('q'))

    // Only open creation modal if explicit create intent or contact passed without invoice search
    if (contactIdParam && (!hasSearch || isExplicitCreate)) {
      setSelectedContactId(contactIdParam)
      if (titleParam) {
        setInvoiceTitle(titleParam)
      }
      setShowCreateModal(true)
    } else if (isExplicitCreate) {
      setShowCreateModal(true)
    }
  }, [contactIdParam, titleParam, jobIdParam, quoteIdParam, searchParams])

  // Truck-Ready Payment Collection Modal State
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card_offline' | 'other'>('cash')
  const [referenceNote, setReferenceNote] = useState('Cash handed on site')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Edit Draft Invoice Modal State
  const [editingDraftInvoice, setEditingDraftInvoice] = useState<Invoice | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [editLineItems, setEditLineItems] = useState<Array<{ description: string; quantity: number; unit_price: number }>>([])
  const [editTaxRate, setEditTaxRate] = useState<number>(0)
  const [editDiscount, setEditDiscount] = useState<number>(0)
  const [savingDraftEdit, setSavingDraftEdit] = useState(false)

  const openEditDraftModal = async (inv: Invoice) => {
    setEditingDraftInvoice(inv)
    setEditTitle(inv.title || '')
    setEditDueDate(inv.due_date ? inv.due_date.split('T')[0] : '')
    setEditTaxRate(Number(inv.tax) > 0 && Number(inv.subtotal) > 0 ? (Number(inv.tax) / Number(inv.subtotal)) * 100 : 0)
    setEditDiscount(Number(inv.discount) || 0)

    try {
      const res = await fetch(`/api/client/invoices/${inv.id}`)
      if (res.ok) {
        const data = await res.json()
        if (data.invoice?.items && data.invoice.items.length > 0) {
          setEditLineItems(data.invoice.items.map((it: any) => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unit_price: Number(it.unit_price) || 0
          })))
          return
        }
      }
    } catch {
      // Fallback
    }

    if (inv.items && inv.items.length > 0) {
      setEditLineItems(inv.items.map(it => ({
        description: it.description,
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0
      })))
    } else {
      setEditLineItems([
        { description: inv.title || 'Completed Service', quantity: 1, unit_price: Number(inv.total) || 0 }
      ])
    }
  }

  const handleSaveDraftEdit = async () => {
    if (!editingDraftInvoice) return
    if (!editTitle.trim()) {
      toast.error('Invoice title is required')
      return
    }
    if (editLineItems.length === 0) {
      toast.error('Please add at least one line item')
      return
    }

    setSavingDraftEdit(true)
    try {
      const res = await fetch('/api/client/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: editingDraftInvoice.id,
          title: editTitle.trim(),
          items: editLineItems,
          taxRate: editTaxRate,
          discountAmount: editDiscount,
          dueDate: editDueDate ? new Date(`${editDueDate}T12:00:00Z`).toISOString() : undefined
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Failed to update invoice.')
        return
      }

      toast.success(`Draft invoice #${editingDraftInvoice.invoice_number} updated!`)
      setEditingDraftInvoice(null)
      loadInvoices()
    } catch {
      toast.error('Network error updating invoice.')
    } finally {
      setSavingDraftEdit(false)
    }
  }

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/invoices?limit=100')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      } else {
        const errData = await res.json().catch(() => ({}))
        if (res.status === 403 && (errData.error?.includes('profile not registered') || errData.error?.includes('not linked to an organization'))) {
          window.location.href = '/client/onboarding'
          return
        }
        setError(errData.error || 'Failed to load invoices.')
      }
    } catch {
      setError('Unable to connect to invoicing service. Please check your connection.')
    } finally {
      setLoading(false)
    }
  }, [])

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
    loadInvoices()
    loadContacts()
  }, [loadInvoices, loadContacts])

  // Keep selectedInvoiceForDetail synchronized when invoices list refreshes
  useEffect(() => {
    if (selectedInvoiceForDetail) {
      const fresh = invoices.find(i => i.id === selectedInvoiceForDetail.id)
      if (fresh) {
        setSelectedInvoiceForDetail(fresh)
      }
    }
  }, [invoices, selectedInvoiceForDetail])

  // Calculations for new invoice form
  const subtotal = useMemo(() => {
    return newItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  }, [newItems])
  const discount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0))
  const tax = Math.round(Math.max(0, subtotal - discount) * ((Number(taxRate) || 0) / 100) * 100) / 100
  const total = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100)

  const handleAddItem = () => {
    setNewItems([...newItems, { description: '', quantity: 1, unit_price: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    if (newItems.length === 1) return
    setNewItems(newItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...newItems]
    updated[index] = { ...updated[index], [field]: value }
    setNewItems(updated)
  }

  const handleApplyTradeService = (service: { name: string; description: string; price: number | null }) => {
    const cleanDesc = service.description ? service.description.replace(/\[pricing:[^\]]+\]\s*/i, '').trim() : service.name
    const unitPrice = typeof service.price === 'number' && service.price > 0 ? service.price : 0

    if (newItems.length === 1 && !newItems[0].description.trim() && Number(newItems[0].unit_price) === 0) {
      setNewItems([{ description: `${service.name} - ${cleanDesc}`, quantity: 1, unit_price: unitPrice }])
    } else {
      setNewItems([...newItems, { description: `${service.name} - ${cleanDesc}`, quantity: 1, unit_price: unitPrice }])
    }

    if (invoiceTitle === 'Standard Service Invoice' || !invoiceTitle.trim()) {
      setInvoiceTitle(`${service.name}`)
    }
    toast.success(`Added ${service.name} to invoice items`)
  }

  // 1-Tap Import from Approved Quote
  const handleImportQuote = useCallback((q: any) => {
    setSelectedQuoteId(q.id)
    if (q.title) {
      setInvoiceTitle(prev => (prev === 'Standard Service Invoice' || !prev.trim() ? q.title : prev))
    }
    const qItems = q.items || q.quote_items || []
    if (Array.isArray(qItems) && qItems.length > 0) {
      setNewItems(qItems.map((it: any) => ({
        description: it.description || q.title || 'Completed Service',
        quantity: Number(it.quantity) || 1,
        unit_price: Number(it.unit_price) || 0
      })))
    } else if (Number(q.total) > 0) {
      setNewItems([{
        description: q.title || 'Approved Service',
        quantity: 1,
        unit_price: Number(q.total)
      }])
    }
    if (typeof q.discount === 'number' && q.discount > 0) {
      setDiscountAmount(String(q.discount))
    }
    if (typeof q.tax_rate === 'number' && q.tax_rate > 0) {
      setTaxRate(String(q.tax_rate))
    } else if (Number(q.tax) > 0 && Number(q.subtotal) > 0) {
      const taxable = Math.max(1, Number(q.subtotal) - (Number(q.discount) || 0))
      const rate = Math.round((Number(q.tax) / taxable) * 100 * 100) / 100
      setTaxRate(String(rate))
    }
    toast.success(`Imported Estimate #${q.quote_number} items & price ($${Number(q.total || 0).toFixed(2)})`)
  }, [])

  // Fetch matching accepted quotes when selected customer changes
  useEffect(() => {
    if (!selectedContactId) {
      setMatchingQuotes([])
      return
    }
    let cancelled = false
    setLoadingMatchingQuotes(true)
    fetch(`/api/client/quotes?contact_id=${encodeURIComponent(selectedContactId)}&status=accepted&limit=10`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled) return
        const qList = (data?.quotes || data?.items || []) as any[]
        setMatchingQuotes(qList)
        if (qList.length === 0) return

        // 1. Exact URL quote_id parameter always imports immediately
        if (quoteIdParam) {
          const exactMatch = qList.find(q => q.id === quoteIdParam)
          if (exactMatch) {
            handleImportQuote(exactMatch)
            return
          }
        }

        // 2. Otherwise auto-import matching approved estimate when line items are still blank
        const currentItems = newItemsRef.current
        const isBlankDraft =
          !selectedQuoteIdRef.current &&
          currentItems.length === 1 &&
          !currentItems[0].description.trim() &&
          Number(currentItems[0].unit_price) === 0

        if (isBlankDraft) {
          const autoMatch = selectBestAcceptedQuoteForJob(
            {
              id: jobIdParam || '',
              contact_id: selectedContactId,
              title: titleParam || null,
            },
            qList
          )
          if (autoMatch) {
            handleImportQuote(autoMatch)
          }
        }
      })
      .catch(() => {
        if (!cancelled) setMatchingQuotes([])
      })
      .finally(() => {
        if (!cancelled) setLoadingMatchingQuotes(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedContactId, quoteIdParam, jobIdParam, titleParam, handleImportQuote])

  const handleSaveInvoice = async (sendImmediately: boolean) => {
    if (!selectedContactId || !invoiceTitle.trim()) {
      toast.error('Please select a customer and provide an invoice title.')
      return
    }

    setSavingInvoice(true)
    try {
      const dueDate = new Date(Date.now() + Number(dueDateDays) * 24 * 60 * 60 * 1000).toISOString()
      const res = await fetch('/api/client/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContactId,
          jobId: selectedJobId || undefined,
          quoteId: selectedQuoteId || undefined,
          title: invoiceTitle,
          items: newItems,
          taxRate: Number(taxRate) || 0,
          discountAmount: Number(discountAmount) || 0,
          dueDate
        })
      })

      const data = await res.json()
      if (res.status === 402 || data.upgradeRequired) {
        setShowCreateModal(false)
        setGatedInvoiceData({
          amount: total > 0 ? total : undefined,
          customerName: contacts.find(c => c.id === selectedContactId)?.name || 'Customer'
        })
        setFoundMoneyModalOpen(true)
        setSavingInvoice(false)
        return
      }
      if (!res.ok) {
        toast.error(data.error || 'Failed to create invoice')
        setSavingInvoice(false)
        return
      }

      if (sendImmediately && data.invoice?.id) {
        const sendRes = await fetch(`/api/client/invoices/${data.invoice.id}/send`, { method: 'POST' })
        const sendData = await sendRes.json().catch(() => ({}))
        if (sendRes.ok) {
          toast.success('Invoice created and sent via SMS')
        } else if (sendRes.status === 402 || sendData.upgradeRequired) {
          setGatedInvoiceData({
            amount: total,
            customerName: contacts.find(c => c.id === selectedContactId)?.name || 'Customer',
            invoiceNumber: data.invoice.invoice_number
          })
          setFoundMoneyModalOpen(true)
          toast.info('Draft invoice saved safely. Upgrade to Pro to send to customer.')
        } else {
          toast.error(sendData.error || 'Invoice saved, but sending failed')
        }
      } else {
        toast.success('Draft invoice created successfully')
      }

      setShowCreateModal(false)
      setSelectedJobId(null)
      await loadInvoices()
    } catch (err: any) {
      toast.error(err.message || 'Error creating invoice')
    } finally {
      setSavingInvoice(false)
    }
  }

  const handleSendInvoice = async (invoiceId: string) => {
    setActionLoadingId(invoiceId)
    try {
      const res = await fetch(`/api/client/invoices/${invoiceId}/send`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('Payment link dispatched to customer via SMS')
        await loadInvoices()
      } else if (res.status === 402 || data.upgradeRequired) {
        const inv = invoices.find(i => i.id === invoiceId)
        setGatedInvoiceData({
          amount: inv ? (inv.amount_due || inv.total) : undefined,
          customerName: inv?.contact?.name || 'Customer',
          invoiceNumber: inv?.invoice_number
        })
        setFoundMoneyModalOpen(true)
      } else {
        toast.error(data.error || 'Failed to send invoice')
      }
    } catch {
      toast.error('Network error sending invoice.')
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRecordOfflinePayment = async () => {
    if (!paymentModalInvoice || !paymentAmount || Number(paymentAmount) <= 0) {
      toast.error('Please enter a valid payment amount.')
      return
    }

    setRecordingPayment(true)
    try {
      const res = await fetch(`/api/client/invoices/${paymentModalInvoice.id}/pay-offline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(paymentAmount),
          paymentMethod,
          referenceNote
        })
      })

      if (res.ok) {
        toast.success('Payment recorded successfully')
        setPaymentModalInvoice(null)
        setPaymentAmount('')
        setReferenceNote('')
        await loadInvoices()
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 402 || data.upgradeRequired) {
          setGatedInvoiceData({
            amount: paymentModalInvoice.total || Number(paymentAmount) || 250,
            customerName: paymentModalInvoice.contact?.name || 'Customer',
            invoiceNumber: paymentModalInvoice.invoice_number
          })
          setPaymentModalInvoice(null)
          setFoundMoneyModalOpen(true)
          return
        }
        toast.error(data.error || 'Failed to record payment')
      }
    } catch {
      toast.error('Network error recording payment.')
    } finally {
      setRecordingPayment(false)
    }
  }

  const executeVoidInvoice = async (invoiceId: string) => {
    setActionLoadingId(invoiceId)
    try {
      const res = await fetch(`/api/client/invoices/${invoiceId}/void`, { method: 'POST' })
      if (res.ok) {
        toast.success('Invoice voided.')
        if (selectedInvoiceForDetail?.id === invoiceId) {
          setSelectedInvoiceForDetail(null)
        }
        await loadInvoices()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to void invoice.')
      }
    } catch {
      toast.error('Network error voiding invoice.')
    } finally {
      setActionLoadingId(null)
      setVoidInvoiceId(null)
    }
  }

  const handleCopyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/invoice/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    toast.success('Payment link copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Financial aggregates (Authoritative Accounting Engine)
  const totalInvoiced = useMemo(() => invoices.filter(i => i.status !== 'void').reduce((acc, inv) => acc + (Number(inv.total) || 0), 0), [invoices])
  const paidInvoices = useMemo(() => invoices.filter((i) => i.status === 'paid'), [invoices])
  const totalPaid = useMemo(() => invoices.filter(i => i.status !== 'void').reduce((acc, inv) => acc + (Number(inv.amount_paid) || 0), 0), [invoices])
  const draftInvoices = useMemo(() => invoices.filter((i) => i.status === 'draft'), [invoices])
  const voidInvoices = useMemo(() => invoices.filter((i) => i.status === 'void'), [invoices])

  // Collectible issued receivables (strictly issued invoices with positive amount due; excludes unissued drafts, paid, and void)
  const receivablesInvoices = useMemo(() => invoices.filter(
    (i) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status) && Number(i.amount_due) > 0
  ), [invoices])
  const totalDue = useMemo(() => receivablesInvoices.reduce((acc, inv) => acc + (Number(inv.amount_due) || 0), 0), [receivablesInvoices])

  // Overdue issued invoices (issued with positive amount due past due date)
  const overdueInvoices = useMemo(() => invoices.filter(
    (i) => ['sent', 'viewed', 'partially_paid', 'overdue'].includes(i.status) &&
           Number(i.amount_due) > 0 &&
           (i.status === 'overdue' || new Date(i.due_date).getTime() < Date.now())
  ), [invoices])
  const overdueAmount = useMemo(() => overdueInvoices.reduce((acc, inv) => acc + (Number(inv.amount_due) || 0), 0), [overdueInvoices])
  const unpaidInvoices = receivablesInvoices

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter === 'unpaid') {
        if (!['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status) || Number(inv.amount_due) <= 0) return false
      } else if (statusFilter === 'paid') {
        if (inv.status !== 'paid') return false
      } else if (statusFilter === 'overdue') {
        if (!['sent', 'viewed', 'partially_paid', 'overdue'].includes(inv.status) || Number(inv.amount_due) <= 0 || (inv.status !== 'overdue' && new Date(inv.due_date).getTime() >= Date.now())) return false
      } else if (statusFilter === 'draft') {
        if (inv.status !== 'draft') return false
      } else if (statusFilter === 'void') {
        if (inv.status !== 'void') return false
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchNum = inv.invoice_number?.toLowerCase().includes(q)
        const matchTitle = inv.title?.toLowerCase().includes(q)
        const matchContact = inv.contact?.name?.toLowerCase().includes(q) || inv.contact?.phone?.includes(q)
        return matchNum || matchTitle || matchContact
      }
      return true
    })
  }, [invoices, statusFilter, searchQuery])

  const handleExportCsv = () => {
    if (!invoices.length) {
      toast.error('No invoices to export.')
      return
    }
    exportToCsv('captodesk_invoices', [
      { header: 'Invoice #', accessor: i => i.invoice_number },
      { header: 'Customer Name', accessor: i => i.contact?.name || 'Unnamed' },
      { header: 'Customer Phone', accessor: i => i.contact?.phone || '' },
      { header: 'Status', accessor: i => CsvFormatters.status(i.status) },
      { header: 'Subtotal', accessor: i => CsvFormatters.currency(i.subtotal) },
      { header: 'Tax', accessor: i => CsvFormatters.currency(i.tax) },
      { header: 'Discount', accessor: i => CsvFormatters.currency(i.discount) },
      { header: 'Total Amount', accessor: i => CsvFormatters.currency(i.total) },
      { header: 'Amount Paid', accessor: i => CsvFormatters.currency(i.amount_paid) },
      { header: 'Balance Due', accessor: i => CsvFormatters.currency(i.amount_due) },
      { header: 'Payment Method', accessor: i => i.payment_method || '' },
      { header: 'Due Date', accessor: i => CsvFormatters.date(i.due_date) },
      { header: 'Paid At', accessor: i => CsvFormatters.dateTime(i.paid_at) },
      { header: 'Created At', accessor: i => CsvFormatters.date(i.created_at) }
    ], invoices)
    toast.success(`Exported ${invoices.length} invoices to CSV`)
  }

  const openOfflinePaymentModal = (inv: Invoice) => {
    setPaymentModalInvoice(inv)
    setPaymentAmount(String(inv.amount_due || inv.total))
    setPaymentMethod('cash')
    setReferenceNote('Cash handed on site')
  }

  // Auto-open offline payment modal if ?pay=true and matching invoice found
  useEffect(() => {
    const searchParam = searchParams.get('search') || searchParams.get('q')
    const shouldPay = searchParams.get('pay') === 'true'
    if (shouldPay && searchParam && invoices.length > 0) {
      const q = searchParam.toLowerCase().trim()
      const targetInv = invoices.find(inv => 
        inv.invoice_number?.toLowerCase() === q ||
        inv.id === searchParam
      )
      if (targetInv && targetInv.status !== 'paid' && targetInv.status !== 'void') {
        openOfflinePaymentModal(targetInv)
      }
    }
  }, [searchParams, invoices])

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Invoices & Payments
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 tabular-nums font-mono">
              {invoices.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Send text payment links, collect payments on-site, and manage customer receivables.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="h-9 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs cursor-pointer"
            title="Download full invoices report as CSV"
          >
            <Download className="h-3.5 w-3.5 sm:mr-1.5 text-slate-400 dark:text-zinc-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>

          <Button
            onClick={() => {
              if (starterUsage?.isLimitReached) {
                setGatedInvoiceData({ customerName: 'Customer' })
                setFoundMoneyModalOpen(true)
                return
              }
              setShowCreateModal(true)
            }}
            size="sm"
            className="h-9 px-3.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>New Invoice</span>
          </Button>
        </div>
      </div>

      {/* Financial Summary (Senior Craft 4 Tokens) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Outstanding Receivables</p>
            <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500/80" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums font-mono mt-1">${totalDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
            {receivablesInvoices.length} open receivable{receivablesInvoices.length === 1 ? '' : 's'}{draftInvoices.length > 0 ? ` (${draftInvoices.length} draft unissued)` : ''}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Total Collected</p>
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500/80" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-1">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
            {paidInvoices.length} paid in full
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Past Due</p>
            <AlertCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-rose-500/80" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono mt-1">{overdueInvoices.length}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 font-mono truncate">
            ${overdueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} past due
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Gross Invoiced</p>
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-400" />
          </div>
          <p className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums font-mono mt-1">${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 sm:mt-1 truncate">
            {invoices.length} lifetime invoices
          </p>
        </div>
      </div>

      {/* Filter and Search Bar (Horizontal Thumb-Friendly Tabs) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
          {[
            { key: 'all', label: 'All Invoices', count: invoices.length },
            { key: 'unpaid', label: 'Unpaid', count: receivablesInvoices.length },
            { key: 'paid', label: 'Paid', count: paidInvoices.length },
            { key: 'overdue', label: 'Overdue', count: overdueInvoices.length },
            { key: 'draft', label: 'Drafts', count: draftInvoices.length },
            { key: 'void', label: 'Void', count: voidInvoices.length }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer min-h-[36px]",
                statusFilter === t.key
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
              )}
            >
              <span>{t.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono font-semibold",
                statusFilter === t.key
                  ? "bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200"
                  : "bg-slate-200/80 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400"
              )}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
          <Input
            placeholder="Search invoice #, customer, or title..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-9 pl-8 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-400 rounded-lg shadow-2xs focus:border-blue-500"
          />
        </div>
      </div>

      {/* Main Content Feed */}
      {error ? (
        <ErrorState
          title="Failed to load invoices"
          message={error}
          onRetry={loadInvoices}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/80 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={searchQuery ? 'No invoices match your search' : 'No invoices in this view'}
          description={
            searchQuery
              ? `No invoices matching "${searchQuery}". Try searching by customer name, phone number, or invoice number.`
              : statusFilter === 'unpaid'
              ? 'No unpaid invoices! All customer accounts are up to date.'
              : statusFilter === 'overdue'
              ? 'Zero overdue accounts! Great job maintaining customer collections.'
              : statusFilter === 'draft'
              ? 'No unissued draft invoices. Click "New Invoice" to create one.'
              : statusFilter === 'paid'
              ? 'No paid invoices found yet.'
              : 'Create service invoices, text secure payment links to customers, or collect payments in the field.'
          }
          actionLabel={!searchQuery && statusFilter === 'all' ? 'Create First Invoice' : undefined}
          onAction={!searchQuery && statusFilter === 'all' ? () => setShowCreateModal(true) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View (>= 768px) */}
          <div className="hidden md:block border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-zinc-950 border-b border-slate-200/80 dark:border-zinc-800">
                <TableRow>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 w-28">Invoice #</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Customer</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Service Scope</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Status</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Due Date</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Balance Due</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Total</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {filteredInvoices.map(inv => {
                  const isPaid = inv.status === 'paid'
                  const isVoid = inv.status === 'void'
                  const isOverdue = !isPaid && !isVoid && new Date(inv.due_date).getTime() < Date.now()

                  return (
                    <TableRow key={inv.id} className="border-b border-slate-100 dark:border-zinc-800/80 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceForDetail(inv)}
                          className="font-mono font-bold text-xs text-blue-600 hover:underline dark:text-blue-400 cursor-pointer"
                          title="View invoice details"
                        >
                          {inv.invoice_number}
                        </button>
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                          {formatCustomerName(inv.contact?.name) || 'Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {inv.contact?.phone ? formatNationalUs(inv.contact.phone) : '-'}
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 px-4 max-w-xs">
                        <div className="text-xs font-medium text-slate-900 dark:text-zinc-100 truncate">
                          {inv.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {inv.job && (
                            <Link
                              href={`/client/calendar?tab=dispatch&search=${inv.job.job_number}`}
                              className="text-[10px] font-mono text-blue-600 hover:underline inline-flex items-center gap-0.5"
                            >
                              <Briefcase className="h-2.5 w-2.5" />
                              <span>Job #{inv.job.job_number}</span>
                            </Link>
                          )}
                          {inv.quote && (
                            <Link
                              href={`/client/quotes?search=${inv.quote.quote_number}`}
                              className="text-[10px] font-mono text-emerald-600 hover:underline inline-flex items-center gap-0.5"
                            >
                              <FileText className="h-2.5 w-2.5" />
                              <span>Quote #{inv.quote.quote_number}</span>
                            </Link>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        {getInvoiceStatusBadge(inv)}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-xs text-slate-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">
                        <div>
                          {new Date(inv.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {isOverdue && (
                          <div className="text-[10px] font-medium text-rose-600 dark:text-rose-400">
                            Past Due
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right font-semibold text-xs font-mono tabular-nums">
                        {isPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400">$0.00</span>
                        ) : (
                          <span className={cn(isOverdue ? "text-rose-600 dark:text-rose-400 font-bold" : "text-blue-600 dark:text-blue-400")}>
                            ${Number(inv.amount_due).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right font-bold text-xs text-slate-900 dark:text-zinc-100 font-mono tabular-nums">
                        ${Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* Details Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedInvoiceForDetail(inv)}
                            className="h-7.5 px-2 text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800 font-semibold rounded-md cursor-pointer"
                            title="View full invoice details"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            <span>Details</span>
                          </Button>

                          {/* 1-Tap Offline Payment Button */}
                          {!isPaid && !isVoid && (
                            <Button
                              size="sm"
                              onClick={() => openOfflinePaymentModal(inv)}
                              className="h-7.5 px-2.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800/60 font-semibold rounded-md shadow-2xs cursor-pointer"
                              title="Record on-site cash, check, or POS card payment"
                            >
                              <Banknote className="h-3 w-3 mr-1" />
                              <span>Collect</span>
                            </Button>
                          )}

                          {/* 1-Tap SMS Payment Link */}
                          {!isPaid && !isVoid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendInvoice(inv.id)}
                              disabled={actionLoadingId === inv.id}
                              className="h-7.5 px-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-zinc-800 font-semibold rounded-md shadow-2xs cursor-pointer"
                              title={inv.status === 'draft' ? 'Send invoice payment link via SMS' : 'Resend payment reminder SMS'}
                            >
                              {actionLoadingId === inv.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              <span>{inv.status === 'draft' ? 'Send SMS' : 'Remind'}</span>
                            </Button>
                          )}

                          {/* Edit Draft Button */}
                          {inv.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDraftModal(inv)}
                              className="h-7.5 px-2.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200 dark:text-zinc-300 dark:border-zinc-800 font-semibold rounded-md shadow-2xs cursor-pointer"
                              title="Edit draft invoice amounts and items"
                            >
                              <Edit2 className="h-3 w-3 mr-1 text-slate-500" />
                              <span>Edit</span>
                            </Button>
                          )}

                          {/* Verified Customer Receipt Button */}
                          {isPaid && (
                            <a
                              href={`/invoice/${inv.manage_token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center h-7.5 px-2.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 font-semibold rounded-md shadow-2xs transition-colors"
                              title="View official customer receipt"
                            >
                              <Receipt className="h-3 w-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                              <span>Receipt</span>
                            </a>
                          )}

                          {/* 1-Tap Copy Link */}
                          <button
                            type="button"
                            onClick={() => handleCopyLink(inv.manage_token, inv.id)}
                            title="Copy payment link"
                            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-2xs cursor-pointer"
                          >
                            {copiedId === inv.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          {/* 1-Tap Preview Customer Invoice */}
                          <a
                            href={`/invoice/${inv.manage_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-2xs"
                            title="Preview customer invoice page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          {/* Void Invoice (P0 Security & Safety) */}
                          {!isPaid && !isVoid && (
                            <button
                              type="button"
                              onClick={() => setVoidInvoiceId(inv.id)}
                              title="Void invoice"
                              className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors shadow-2xs cursor-pointer"
                            >
                              <Ban className="h-3.5 w-3.5" />
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

          {/* Mobile High-Touch Cards (< 768px) */}
          <div className="md:hidden space-y-3">
            {filteredInvoices.map((inv) => {
              const isPaid = inv.status === 'paid'
              const isVoid = inv.status === 'void'
              const isDraft = inv.status === 'draft'
              const remainingDue = Number(inv.amount_due ?? (Number(inv.total || 0) - Number(inv.amount_paid || 0)))
              const isOverdue =
                inv.status === 'overdue' ||
                (!isDraft && !isPaid && !isVoid && remainingDue > 0 && new Date(inv.due_date).getTime() < Date.now())

              return (
                <div
                  key={inv.id}
                  className="rounded-xl border border-slate-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3 transition-colors hover:border-slate-300 dark:hover:border-zinc-700"
                >
                  {/* Top Bar: Clickable to view details */}
                  <div
                    onClick={() => setSelectedInvoiceForDetail(inv)}
                    className="cursor-pointer space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-xs text-slate-900 dark:text-zinc-100 font-bold">
                            #{inv.invoice_number}
                          </span>
                          {getDescriptiveStatusBadge(inv)}
                        </div>
                        <h3 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 line-clamp-1">
                          {inv.title}
                        </h3>
                      </div>

                      {/* Remaining Balance Receives Strongest Visual Emphasis */}
                      <div className="text-right shrink-0">
                        {!isPaid && !isVoid ? (
                          <>
                            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                              Balance Due
                            </div>
                            <div className={cn(
                              "text-lg font-black font-mono tabular-nums leading-tight",
                              isOverdue ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"
                            )}>
                              ${remainingDue.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                              Total ${Number(inv.total).toFixed(2)}
                            </div>
                          </>
                        ) : isPaid ? (
                          <>
                            <div className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                              $0.00 Due
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-zinc-400 font-mono">
                              Total ${Number(inv.total).toFixed(2)}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-400 font-mono">
                            Voided
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Customer Info & Due Date */}
                    <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-slate-100 dark:border-zinc-800/60">
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                          {formatCustomerName(inv.contact?.name) || 'Customer'}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {inv.contact?.phone ? (
                            <a
                              href={`tel:${inv.contact.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
                              title="Call customer directly"
                            >
                              <Smartphone className="h-3 w-3" />
                              <span>{formatNationalUs(inv.contact.phone)}</span>
                            </a>
                          ) : (
                            <span>No phone</span>
                          )}
                          <span>•</span>
                          <span>Due {new Date(inv.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {inv.job && (
                          <Link
                            href={`/client/calendar?tab=dispatch&search=${inv.job.job_number}`}
                            className="text-[10px] font-mono text-blue-600 hover:underline inline-flex items-center gap-0.5 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/60"
                          >
                            <Briefcase className="h-2.5 w-2.5" />
                            <span>Job #{inv.job.job_number}</span>
                          </Link>
                        )}
                        {inv.quote && (
                          <Link
                            href={`/client/quotes?search=${inv.quote.quote_number}`}
                            className="text-[10px] font-mono text-emerald-600 hover:underline inline-flex items-center gap-0.5 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200/60 dark:border-emerald-900/60"
                          >
                            <FileText className="h-2.5 w-2.5" />
                            <span>Quote #{inv.quote.quote_number}</span>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions Bar (44px+ touch targets) */}
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5">
                      {/* Secondary Quick Action */}
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceForDetail(inv)}
                        className="min-h-[44px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs flex items-center justify-center gap-1 text-xs font-semibold cursor-pointer"
                        title="View invoice details"
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-500" />
                        <span>Details</span>
                      </button>

                      {/* 3-Dots Action Sheet Trigger */}
                      <button
                        type="button"
                        onClick={() => setSelectedInvoiceForActions(inv)}
                        className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs flex items-center justify-center cursor-pointer transition-colors"
                        title="More invoice actions"
                        aria-label="More invoice actions"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Primary Action Button */}
                      {!isPaid && !isVoid ? (
                        <Button
                          size="sm"
                          onClick={() => openOfflinePaymentModal(inv)}
                          className="min-h-[44px] px-4 text-xs text-white bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          <Banknote className="h-4 w-4" />
                          <span>Collect Payment</span>
                        </Button>
                      ) : isPaid ? (
                        <a
                          href={`/invoice/${inv.manage_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[44px] px-3.5 text-xs text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 font-semibold rounded-lg shadow-2xs inline-flex items-center gap-1.5"
                        >
                          <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Receipt</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Voided</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Focused Invoice Detail Modal */}
      {selectedInvoiceForDetail && (
        <Modal
          open={!!selectedInvoiceForDetail}
          onOpenChange={(open) => !open && setSelectedInvoiceForDetail(null)}
          title={`Invoice #${selectedInvoiceForDetail.invoice_number}`}
          description={`Issued ${new Date(selectedInvoiceForDetail.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`}
          size="xl"
        >
          <div className="space-y-4">
            
            {/* Status & Operational Guidance Banner */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider text-[10px]">
                  Payment Status
                </span>
                {getInvoiceStatusBadge(selectedInvoiceForDetail)}
              </div>
              <div className="text-slate-800 dark:text-zinc-200 font-medium leading-relaxed">
                {selectedInvoiceForDetail.status === 'draft' && 'Draft invoice. Not yet sent to customer. Review line items and dispatch payment link via SMS.'}
                {selectedInvoiceForDetail.status === 'sent' && 'Dispatched to customer. Waiting for online credit card checkout or record on-site collection.'}
                {selectedInvoiceForDetail.status === 'viewed' && 'Customer opened and viewed invoice. Ready for digital card payment or on-site settlement.'}
                {selectedInvoiceForDetail.status === 'partially_paid' && `Partial payment received. Outstanding balance remaining: $${Number(selectedInvoiceForDetail.amount_due).toFixed(2)}.`}
                {selectedInvoiceForDetail.status === 'paid' && 'Paid in full! Payment has been settled and customer verified receipt is available.'}
                {selectedInvoiceForDetail.status === 'overdue' && `Payment is overdue. Due date was ${new Date(selectedInvoiceForDetail.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}. Follow up with a payment reminder SMS.`}
                {selectedInvoiceForDetail.status === 'void' && 'Invoice has been voided. Balances cancelled and automated reminders stopped.'}
              </div>
            </div>

            {/* Customer Information Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2 text-xs shadow-2xs">
              <span className="font-bold text-slate-900 dark:text-white block text-sm">
                {formatCustomerName(selectedInvoiceForDetail.contact?.name) || 'Homeowner / Customer'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-zinc-400 text-xs">
                {selectedInvoiceForDetail.contact?.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-blue-600" />
                    <a href={`tel:${selectedInvoiceForDetail.contact.phone}`} className="font-mono hover:underline font-semibold">
                      {formatNationalUs(selectedInvoiceForDetail.contact.phone)}
                    </a>
                  </div>
                )}
                {selectedInvoiceForDetail.contact?.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{selectedInvoiceForDetail.contact.email}</span>
                  </div>
                )}
                {selectedInvoiceForDetail.contact?.address && (
                  <div className="flex items-center gap-1.5 sm:col-span-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{selectedInvoiceForDetail.contact.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Linked Job and Quote Records */}
            {(selectedInvoiceForDetail.job || selectedInvoiceForDetail.quote) && (
              <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 flex items-center gap-3 text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-semibold uppercase text-[10px] tracking-wider">
                  Linked Records:
                </span>
                {selectedInvoiceForDetail.job && (
                  <Link
                    href={`/client/calendar?tab=dispatch&search=${selectedInvoiceForDetail.job.job_number}`}
                    className="font-mono text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <Briefcase className="h-3 w-3" />
                    <span>Job #{selectedInvoiceForDetail.job.job_number}</span>
                  </Link>
                )}
                {selectedInvoiceForDetail.quote && (
                  <Link
                    href={`/client/quotes?search=${selectedInvoiceForDetail.quote.quote_number}`}
                    className="font-mono text-emerald-600 hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    <FileText className="h-3 w-3" />
                    <span>Quote #{selectedInvoiceForDetail.quote.quote_number}</span>
                  </Link>
                )}
              </div>
            )}

            {/* Itemized Line Items Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[11px]">
                  Scope: {selectedInvoiceForDetail.title}
                </span>
                <span className="text-slate-400">{selectedInvoiceForDetail.items?.length || 0} line items</span>
              </div>

              <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400">
                        <th className="py-2.5 px-3 font-semibold">Description</th>
                        <th className="py-2.5 px-3 text-center font-semibold w-16">Qty</th>
                        <th className="py-2.5 px-3 text-right font-semibold w-24">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right font-semibold w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                      {selectedInvoiceForDetail.items && selectedInvoiceForDetail.items.length > 0 ? (
                        selectedInvoiceForDetail.items.map((item, idx) => (
                          <tr key={item.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30">
                            <td className="py-2.5 px-3 text-slate-900 dark:text-zinc-100 font-medium">{item.description}</td>
                            <td className="py-2.5 px-3 text-center text-slate-600 dark:text-zinc-400 font-mono">{item.quantity}</td>
                            <td className="py-2.5 px-3 text-right text-slate-600 dark:text-zinc-400 font-mono tabular-nums">
                              ${Number(item.unit_price).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-zinc-100 font-mono tabular-nums">
                              ${((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="py-3 px-3 text-center text-slate-400 italic">
                            {selectedInvoiceForDetail.title}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div className="p-3.5 bg-slate-50/60 dark:bg-zinc-950/60 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
                  <div className="w-64 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono tabular-nums">${Number(selectedInvoiceForDetail.subtotal).toFixed(2)}</span>
                    </div>
                    {Number(selectedInvoiceForDetail.discount) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                        <span>Discount</span>
                        <span className="font-mono tabular-nums">-${Number(selectedInvoiceForDetail.discount).toFixed(2)}</span>
                      </div>
                    )}
                    {Number(selectedInvoiceForDetail.tax) > 0 && (
                      <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                        <span>Tax</span>
                        <span className="font-mono tabular-nums">+${Number(selectedInvoiceForDetail.tax).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-zinc-800">
                      <span>Total Invoice</span>
                      <span className="font-mono tabular-nums">${Number(selectedInvoiceForDetail.total).toFixed(2)}</span>
                    </div>
                    {Number(selectedInvoiceForDetail.amount_paid) > 0 && (
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Amount Paid</span>
                        <span className="font-mono tabular-nums">-${Number(selectedInvoiceForDetail.amount_paid).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-slate-900 dark:text-zinc-100 text-sm pt-1.5 border-t-2 border-slate-900 dark:border-zinc-100">
                      <span>Balance Due</span>
                      <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        ${Number(selectedInvoiceForDetail.amount_due).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment History Ledger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Payment History Ledger</span>
                </span>
                <span className="text-slate-400">
                  {selectedInvoiceForDetail.payments?.length || 0} transaction{selectedInvoiceForDetail.payments?.length === 1 ? '' : 's'}
                </span>
              </div>

              {selectedInvoiceForDetail.payments && selectedInvoiceForDetail.payments.length > 0 ? (
                <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800/80 shadow-2xs">
                  {selectedInvoiceForDetail.payments.map((pmt) => (
                    <div key={pmt.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50/50 dark:hover:bg-zinc-850/40">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-zinc-100 capitalize">
                            {pmt.payment_method === 'card_offline'
                              ? 'External POS Card'
                              : pmt.payment_method === 'other'
                              ? 'Zelle / Venmo'
                              : pmt.payment_method}
                          </span>
                          <span className={cn(
                            "px-1.5 py-0.2 rounded text-[10px] font-bold uppercase",
                            pmt.status === 'succeeded'
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400"
                          )}>
                            {pmt.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                          {pmt.reference_note || 'Payment recorded'} • {new Date(pmt.created_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +${Number(pmt.amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-500 dark:text-zinc-400">
                  No payments recorded yet for this invoice.
                </div>
              )}
            </div>

            {/* Contextual Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCopyLink(selectedInvoiceForDetail.manage_token, selectedInvoiceForDetail.id)}
                  className="min-h-[44px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs flex items-center gap-1 text-xs font-semibold cursor-pointer"
                  title="Copy customer payment link"
                >
                  {copiedId === selectedInvoiceForDetail.id ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  <span>Copy Link</span>
                </button>

                <a
                  href={`/invoice/${selectedInvoiceForDetail.manage_token}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[44px] px-3 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 shadow-2xs inline-flex items-center gap-1 text-xs font-semibold"
                  title="Preview customer invoice page"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Preview Page</span>
                </a>
              </div>

              <div className="flex items-center gap-2">
                {selectedInvoiceForDetail.status === 'draft' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const inv = selectedInvoiceForDetail
                      setSelectedInvoiceForDetail(null)
                      openEditDraftModal(inv)
                    }}
                    className="min-h-[44px] px-3.5 text-xs font-semibold cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5 mr-1 text-slate-500" />
                    <span>Edit Draft</span>
                  </Button>
                )}

                {selectedInvoiceForDetail.status !== 'paid' && selectedInvoiceForDetail.status !== 'void' && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSendInvoice(selectedInvoiceForDetail.id)}
                      disabled={actionLoadingId === selectedInvoiceForDetail.id}
                      className="min-h-[44px] px-3.5 text-xs font-semibold text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 cursor-pointer"
                    >
                      {actionLoadingId === selectedInvoiceForDetail.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Send className="h-3.5 w-3.5 mr-1" />
                      )}
                      <span>{selectedInvoiceForDetail.status === 'draft' ? 'Send SMS' : 'Remind SMS'}</span>
                    </Button>

                    <Button
                      type="button"
                      onClick={() => {
                        const inv = selectedInvoiceForDetail
                        setSelectedInvoiceForDetail(null)
                        openOfflinePaymentModal(inv)
                      }}
                      className="min-h-[44px] px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Banknote className="h-4 w-4" />
                      <span>Collect Payment</span>
                    </Button>
                  </>
                )}

                {selectedInvoiceForDetail.status === 'paid' && (
                  <a
                    href={`/invoice/${selectedInvoiceForDetail.manage_token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] px-4 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Receipt className="h-4 w-4" />
                    <span>View Customer Receipt</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Mobile Action Sheet (Part 3) */}
      {selectedInvoiceForActions && (
        <Modal
          open={!!selectedInvoiceForActions}
          onOpenChange={(open) => !open && setSelectedInvoiceForActions(null)}
          title={`Invoice #${selectedInvoiceForActions.invoice_number}`}
          description={formatCustomerName(selectedInvoiceForActions.contact?.name) || 'Customer Actions'}
          size="sm"
        >
          <div className="space-y-2 py-1">
            <button
              type="button"
              onClick={() => {
                const inv = selectedInvoiceForActions
                setSelectedInvoiceForActions(null)
                setSelectedInvoiceForDetail(inv)
              }}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
            >
              <Eye className="h-4 w-4 text-blue-600" />
              <span>View Full Invoice Details</span>
            </button>

            {selectedInvoiceForActions.status !== 'paid' && selectedInvoiceForActions.status !== 'void' && (
              <button
                type="button"
                onClick={() => {
                  const inv = selectedInvoiceForActions
                  setSelectedInvoiceForActions(null)
                  openOfflinePaymentModal(inv)
                }}
                className="w-full h-12 px-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 text-left text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
              >
                <Banknote className="h-4 w-4 text-emerald-600" />
                <span>Record On-Site Payment</span>
              </button>
            )}

            {selectedInvoiceForActions.status !== 'paid' && selectedInvoiceForActions.status !== 'void' && (
              <button
                type="button"
                onClick={() => {
                  const id = selectedInvoiceForActions.id
                  setSelectedInvoiceForActions(null)
                  handleSendInvoice(id)
                }}
                className="w-full h-12 px-4 rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 text-left text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
              >
                <Send className="h-4 w-4 text-blue-600" />
                <span>{selectedInvoiceForActions.status === 'draft' ? 'Send Invoice via SMS' : 'Resend Payment Reminder SMS'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                handleCopyLink(selectedInvoiceForActions.manage_token, selectedInvoiceForActions.id)
                setSelectedInvoiceForActions(null)
              }}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
            >
              <Copy className="h-4 w-4 text-slate-500" />
              <span>Copy Customer Payment Link</span>
            </button>

            <a
              href={`/invoice/${selectedInvoiceForActions.manage_token}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setSelectedInvoiceForActions(null)}
              className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px]"
            >
              <ExternalLink className="h-4 w-4 text-slate-500" />
              <span>Preview Customer View</span>
            </a>

            {selectedInvoiceForActions.status === 'draft' && (
              <button
                type="button"
                onClick={() => {
                  const inv = selectedInvoiceForActions
                  setSelectedInvoiceForActions(null)
                  openEditDraftModal(inv)
                }}
                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-left text-xs font-semibold text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
              >
                <Edit2 className="h-4 w-4 text-slate-500" />
                <span>Edit Draft Line Items</span>
              </button>
            )}

            {selectedInvoiceForActions.status !== 'paid' && selectedInvoiceForActions.status !== 'void' && (
              <button
                type="button"
                onClick={() => {
                  const id = selectedInvoiceForActions.id
                  setSelectedInvoiceForActions(null)
                  setVoidInvoiceId(id)
                }}
                className="w-full h-12 px-4 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-left text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100/50 transition-colors flex items-center gap-2.5 min-h-[48px] cursor-pointer"
              >
                <Ban className="h-4 w-4 text-rose-600" />
                <span>Void Invoice</span>
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Redesigned Payment Collection Modal (Truck Ergonomics) */}
      <Modal
        open={!!paymentModalInvoice}
        onOpenChange={(open) => !open && setPaymentModalInvoice(null)}
        title="Record Customer Payment"
        description={`Record immediate cash, check, Zelle, or card terminal settlement for #${paymentModalInvoice?.invoice_number || ''}.`}
        size="md"
      >
        <div className="space-y-4">
          {/* Invoice Summary Pill */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">Customer</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {formatCustomerName(paymentModalInvoice?.contact?.name) || 'Customer'}
              </p>
              {paymentModalInvoice?.contact?.phone && (
                <p className="text-[11px] text-slate-500 font-mono">
                  {formatNationalUs(paymentModalInvoice.contact.phone)}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">Current Balance Due</p>
              <p className="text-base font-black text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                ${Number(paymentModalInvoice?.amount_due || 0).toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-400 font-mono">
                Total ${Number(paymentModalInvoice?.total || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* 4 Large 48px Payment Method Touch Targets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'cash', label: 'Cash on Site', note: 'Cash handed in person' },
                { id: 'check', label: 'Paper Check', note: 'Check #' },
                { id: 'other', label: 'Zelle / Venmo', note: 'Zelle transfer verified' },
                { id: 'card_offline', label: 'External POS Card', note: 'Square or Clover swipe' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(m.id as any)
                    setReferenceNote(m.note)
                  }}
                  className={cn(
                    "min-h-12 p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-center",
                    paymentMethod === m.id
                      ? "bg-blue-50/70 border-blue-600 dark:bg-blue-950/40 dark:border-blue-500 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/20"
                      : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-850"
                  )}
                >
                  <span className="text-xs font-bold">{m.label}</span>
                  <span className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">{m.note}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Paid with 1-Tap Full Balance Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Amount Being Collected ($)
              </label>
              <button
                type="button"
                onClick={() => setPaymentAmount(String(paymentModalInvoice?.amount_due || ''))}
                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Pay Full Balance (${Number(paymentModalInvoice?.amount_due || 0).toFixed(2)})
              </button>
            </div>
            <Input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              placeholder="0.00"
              className="h-10 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-sm font-bold text-slate-900 dark:text-zinc-100 rounded-lg focus:border-blue-500 font-mono tabular-nums"
            />
          </div>

          {/* Dynamic Resulting Balance & Status Preview Box */}
          {Number(paymentAmount) > 0 && paymentModalInvoice && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-zinc-400">Resulting Remaining Balance:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  ${Math.max(0, Number(paymentModalInvoice.amount_due) - Number(paymentAmount)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500 dark:text-zinc-400">Resulting Status:</span>
                {Number(paymentAmount) >= Number(paymentModalInvoice.amount_due) ? (
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Will mark invoice Paid in Full
                  </span>
                ) : (
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Will mark invoice Partially Paid
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Reference Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Reference Note or Check Number
            </label>
            <Input
              value={referenceNote}
              onChange={e => setReferenceNote(e.target.value)}
              placeholder="e.g. Check #1042 or Zelle verification confirmation"
              className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg focus:border-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPaymentModalInvoice(null)}
              className="h-10 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:text-white shadow-2xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={recordingPayment || !paymentAmount || Number(paymentAmount) <= 0}
              onClick={handleRecordOfflinePayment}
              className="h-10 px-5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer"
            >
              {recordingPayment ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Recording...
                </>
              ) : (
                `Confirm & Record Payment ($${Number(paymentAmount || 0).toFixed(2)})`
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Draft Invoice Modal */}
      <Modal
        open={!!editingDraftInvoice}
        onOpenChange={(open) => !open && setEditingDraftInvoice(null)}
        title={`Edit Draft #${editingDraftInvoice?.invoice_number || ''}`}
        description="Update line items, amounts, or payment terms before sending to customer."
        size="lg"
      >
        <div className="space-y-4 py-1">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 text-xs">
            <div>
              <span className="font-bold text-slate-900 dark:text-zinc-100 block">
                {editingDraftInvoice?.contact?.name || 'Customer'}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">
                {editingDraftInvoice?.contact?.phone}
              </span>
            </div>
            {editingDraftInvoice?.job && (
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">
                Job #{editingDraftInvoice.job.job_number}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Invoice Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="e.g. Service & Labor Completion"
                className="h-9 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Line items editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">Line Items</span>
              <button
                type="button"
                onClick={() => setEditLineItems(prev => [...prev, { description: 'Additional Service / Parts', quantity: 1, unit_price: 0 }])}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {editLineItems.map((item, idx) => (
                <div key={idx} className="p-2.5 sm:p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center gap-2">
                  <Input
                    value={item.description}
                    onChange={(e) => {
                      const val = e.target.value
                      setEditLineItems(prev => {
                        const copy = [...prev]
                        copy[idx] = { ...copy[idx], description: val }
                        return copy
                      })
                    }}
                    placeholder="Description"
                    className="h-9 sm:h-8 text-xs flex-1"
                  />
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400">Qty</span>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 1
                          setEditLineItems(prev => {
                            const copy = [...prev]
                            copy[idx] = { ...copy[idx], quantity: val }
                            return copy
                          })
                        }}
                        className="w-16 h-9 sm:h-8 text-xs text-center font-mono tabular-nums"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-400">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0
                          setEditLineItems(prev => {
                            const copy = [...prev]
                            copy[idx] = { ...copy[idx], unit_price: val }
                            return copy
                          })
                        }}
                        className="w-24 h-9 sm:h-8 text-xs font-mono text-right tabular-nums"
                      />
                    </div>
                    <div className="sm:hidden text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300 tabular-nums">
                      ${((Number(item.quantity) || 1) * (Number(item.unit_price) || 0)).toFixed(2)}
                    </div>
                    {editLineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setEditLineItems(prev => prev.filter((_, i) => i !== idx))}
                        className="p-2 sm:p-1 text-slate-400 hover:text-rose-600 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center cursor-pointer"
                        title="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="p-3 rounded-xl bg-slate-900 text-white dark:bg-zinc-950 dark:border dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Updated Total</span>
            <span className="text-xl font-bold font-mono">
              ${editLineItems.reduce((acc, it) => acc + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditingDraftInvoice(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={savingDraftEdit}
              onClick={handleSaveDraftEdit}
              className="h-10 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5 shadow-xs"
            >
              {savingDraftEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              <span>Save Changes</span>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create New Invoice Modal (with 21-Trade Presets) */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Create Service Invoice"
        description="Set line items, tax, and discount for instant mobile checkout via Card or Apple Pay."
        size="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Customer <span className="text-rose-500">*</span>
            </label>
            <select
              aria-label="Select Customer"
              value={selectedContactId}
              onChange={e => setSelectedContactId(e.target.value)}
              className="w-full p-2.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="">Choose a customer...</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Invoice Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={invoiceTitle}
                onChange={e => setInvoiceTitle(e.target.value)}
                placeholder="e.g. Electrical Panel Upgrade"
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Payment Terms (Due Date)
              </label>
              <select
                aria-label="Payment Terms"
                value={dueDateDays}
                onChange={e => setDueDateDays(e.target.value)}
                className="w-full p-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs h-9"
              >
                <option value="0">Due on receipt</option>
                <option value="7">Net 7 Days</option>
                <option value="14">Net 14 Days</option>
                <option value="30">Net 30 Days</option>
              </select>
            </div>
          </div>

          {/* 1-Tap Approved Estimate Matcher */}
          {matchingQuotes.length > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Approved Estimate Found ({matchingQuotes.length})
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                  Autofills approved price & line items
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {matchingQuotes.map(q => (
                  <div key={q.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-800/80 shadow-2xs">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                        <span>#{q.quote_number}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">${Number(q.total || 0).toFixed(2)}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 line-clamp-1">{q.title}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleImportQuote(q)}
                      className={cn(
                        "h-7.5 px-3 text-xs font-bold cursor-pointer shadow-xs gap-1.5",
                        selectedQuoteId === q.id 
                          ? "bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white"
                      )}
                    >
                      {selectedQuoteId === q.id ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                      <span>{selectedQuoteId === q.id ? 'Imported' : 'Import Items & Price'}</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Trade Presets */}
          <div className="space-y-2 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Quick Line Items {selectedTradeId !== 'all' ? `(${getIndustryPreset(selectedTradeId).name.split('&')[0].trim()})` : ''}</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAllTrades(prev => !prev)}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 hover:underline cursor-pointer"
              >
                {showAllTrades ? 'Focus My Trade' : 'Browse other trades'}
              </button>
            </div>

            {showAllTrades && (
              <div className="flex items-center gap-2 pt-1 pb-0.5">
                <span className="text-[11px] text-slate-500 dark:text-zinc-400 shrink-0">Filter Trade:</span>
                <select
                  value={selectedTradeId}
                  onChange={e => setSelectedTradeId(e.target.value)}
                  className="w-full p-1 px-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md text-slate-800 dark:text-zinc-200 focus:outline-none cursor-pointer shadow-2xs"
                >
                  {orgIndustry && orgIndustry !== 'general' && (
                    <option value={orgIndustry}>* {getIndustryPreset(orgIndustry).name} (My Primary Trade)</option>
                  )}
                  <option value="all">All 21 Home Service Trades</option>
                  {INDUSTRY_LIST.filter(ind => ind.id !== orgIndustry).map(ind => (
                    <option key={ind.id} value={ind.id}>
                      {ind.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 scrollbar-thin">
              {INDUSTRY_LIST.filter(t => selectedTradeId === 'all' || t.id === selectedTradeId).flatMap(trade =>
                trade.services.map((svc, idx) => (
                  <button
                    key={`${trade.id}-${idx}`}
                    type="button"
                    onClick={() => handleApplyTradeService(svc)}
                    className="text-left p-2 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer group shadow-2xs flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 line-clamp-1">
                        {svc.name}
                      </span>
                      {typeof svc.price === 'number' && svc.price > 0 && (
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-zinc-400 font-mono">
                          ${svc.price}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Discount & Tax Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/40">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Discount Amount ($)
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discountAmount}
                onChange={e => setDiscountAmount(e.target.value)}
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500 font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Tax Rate (%)
              </label>
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder="0.0"
                value={taxRate}
                onChange={e => setTaxRate(e.target.value)}
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500 font-mono tabular-nums"
              />
            </div>
          </div>

          {/* Line Items */}
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
                <Plus className="h-3 w-3" /> Add Custom Item
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto p-0.5">
              {newItems.map((item, idx) => {
                const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
                return (
                  <div
                    key={idx}
                    className="p-2 sm:p-0 rounded-lg border sm:border-0 border-slate-200 dark:border-zinc-800 bg-slate-50/50 sm:bg-transparent dark:bg-zinc-900/30 sm:dark:bg-transparent flex flex-col sm:flex-row sm:items-center gap-2"
                  >
                    <Input
                      placeholder="Description (e.g. System replacement & labor)"
                      value={item.description}
                      onChange={e => handleItemChange(idx, 'description', e.target.value)}
                      className="flex-1 h-9 sm:h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                    />
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Qty</span>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={e => handleItemChange(idx, 'quantity', Number(e.target.value))}
                          min="1"
                          className="w-16 h-9 sm:h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md text-center focus:border-blue-500 font-mono tabular-nums"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">$</span>
                        <Input
                          type="number"
                          placeholder="Price"
                          value={item.unit_price}
                          onChange={e => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-24 h-9 sm:h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md text-right focus:border-blue-500 font-mono tabular-nums"
                        />
                      </div>
                      <div className="sm:hidden text-xs font-mono font-semibold text-slate-700 dark:text-zinc-300 tabular-nums">
                        ${lineTotal.toFixed(2)}
                      </div>
                      {newItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-2 sm:p-1.5 text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center rounded-md"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>Subtotal:</span>
                <span className="tabular-nums font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1 font-medium">
                  Discount ($):
                </span>
                <span className="tabular-nums font-mono font-medium text-emerald-600 dark:text-emerald-400">-${discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1 font-medium">
                  Tax Rate (%):
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                    className="w-16 h-6 px-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-right text-xs text-slate-900 dark:text-zinc-200 focus:outline-none font-mono"
                  />
                </span>
                <span className="tabular-nums font-mono font-medium text-slate-700 dark:text-zinc-300">+${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white font-bold text-sm">
                <span>Total Amount Due:</span>
                <span className="tabular-nums font-mono">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              className="h-9 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-white shadow-2xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={savingInvoice}
              onClick={() => handleSaveInvoice(false)}
              className="h-9 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingInvoice}
              onClick={() => handleSaveInvoice(true)}
              className="h-9 px-4 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs cursor-pointer"
            >
              {savingInvoice ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Save & Send Payment Link via SMS
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Void Dialog */}
      <ConfirmDialog
        open={!!voidInvoiceId}
        onOpenChange={(open) => !open && setVoidInvoiceId(null)}
        title="Void Invoice"
        description="Are you sure you want to void this invoice? This will cancel open balances and halt automated SMS reminders."
        confirmText="Void Invoice"
        variant="destructive"
        onConfirm={() => {
          if (voidInvoiceId) executeVoidInvoice(voidInvoiceId)
        }}
      />

      {/* Mobile Floating Action Button */}
      <button
        type="button"
        onClick={() => {
          if (starterUsage?.isLimitReached) {
            setGatedInvoiceData({ customerName: 'Customer' })
            setFoundMoneyModalOpen(true)
            return
          }
          setShowCreateModal(true)
        }}
        className="fixed bottom-20 right-4 sm:hidden z-40 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-4 py-3 rounded-full shadow-lg shadow-blue-600/30 font-semibold text-xs tracking-wide transition-all cursor-pointer min-h-[44px]"
        aria-label="Create New Invoice"
      >
        <Plus className="h-4 w-4" />
        <span>New Invoice</span>
      </button>

      {/* Found Money Finish-Line Paywall Modal */}
      <FoundMoneyUnlockModal
        isOpen={foundMoneyModalOpen}
        onClose={() => setFoundMoneyModalOpen(false)}
        amountDue={gatedInvoiceData?.amount}
        customerName={gatedInvoiceData?.customerName}
        invoiceNumber={gatedInvoiceData?.invoiceNumber}
        operationMode={operationMode}
        onSuccess={loadInvoices}
      />

    </div>
  )
}

export default function ClientInvoicesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-500">Loading invoices...</div>}>
      <ClientInvoicesContent />
    </Suspense>
  )
}
