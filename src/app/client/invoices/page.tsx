'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
  ArrowRight
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

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  total?: number
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
  manage_token: string
  payment_method?: string
  sent_at?: string
  paid_at?: string
  created_at: string
  contact?: {
    id: string
    name: string
    phone: string
    email?: string
  }
  items?: InvoiceItem[]
  job?: { id: string; job_number: string; status: string }
  quote?: { id: string; quote_number: string; title: string }
}

function getInvoiceStatusBadge(inv: Invoice) {
  const isPaid = inv.status === 'paid'
  const isVoid = inv.status === 'void'
  const isOverdue =
    inv.status === 'overdue' ||
    (!isPaid && !isVoid && new Date(inv.due_date).getTime() < Date.now())

  if (isPaid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
        Paid
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

function ClientInvoicesContent() {
  const searchParams = useSearchParams()
  const contactIdParam = searchParams.get('contact_id') || searchParams.get('contactId')
  const titleParam = searchParams.get('title')

  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'void'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null)

  // New Invoice Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [invoiceTitle, setInvoiceTitle] = useState('Standard Service Invoice')
  const [dueDateDays, setDueDateDays] = useState('7')
  const [taxRate, setTaxRate] = useState('0')
  const [discountAmount, setDiscountAmount] = useState('0')
  const [newItems, setNewItems] = useState<InvoiceItem[]>([
    { description: 'Service Labor & Callout', quantity: 1, unit_price: 150 }
  ])
  const { orgIndustry } = useWorkspace()
  const [savingInvoice, setSavingInvoice] = useState(false)
  const [selectedTradeId, setSelectedTradeId] = useState<string>('all')
  const [showAllTrades, setShowAllTrades] = useState(false)

  // Align default trade with organization onboarding trade
  useEffect(() => {
    if (orgIndustry && orgIndustry !== 'general') {
      setSelectedTradeId(orgIndustry)
    }
  }, [orgIndustry])

  // Listen to contact_id / title / create query param
  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam)
      if (titleParam) {
        setInvoiceTitle(titleParam)
      }
      setShowCreateModal(true)
    } else if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
      setShowCreateModal(true)
    }
  }, [contactIdParam, titleParam, searchParams])

  // Truck-Ready Offline Payment Modal
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card_offline' | 'other'>('cash')
  const [referenceNote, setReferenceNote] = useState('Cash handed on site')
  const [recordingPayment, setRecordingPayment] = useState(false)

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
    const unitPrice = service.price || 120

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
          title: invoiceTitle,
          items: newItems,
          taxRate: Number(taxRate) || 0,
          discountAmount: Number(discountAmount) || 0,
          dueDate
        })
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to create invoice')
        setSavingInvoice(false)
        return
      }

      if (sendImmediately && data.invoice?.id) {
        await fetch(`/api/client/invoices/${data.invoice.id}/send`, { method: 'POST' })
        toast.success('Invoice created and sent via SMS')
      } else {
        toast.success('Draft invoice created successfully')
      }

      setShowCreateModal(false)
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
      if (res.ok) {
        toast.success('Payment link dispatched to customer via SMS')
        await loadInvoices()
      } else {
        const data = await res.json().catch(() => ({}))
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
        toast.success('Offline payment recorded successfully')
        setPaymentModalInvoice(null)
        setPaymentAmount('')
        setReferenceNote('')
        await loadInvoices()
      } else {
        const data = await res.json().catch(() => ({}))
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

  // Financial aggregates
  const totalInvoiced = useMemo(() => invoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0), [invoices])
  const totalDue = useMemo(() => invoices.reduce((acc, inv) => acc + (Number(inv.amount_due) || 0), 0), [invoices])
  const paidInvoices = useMemo(() => invoices.filter((i) => i.status === 'paid'), [invoices])
  const totalPaid = useMemo(() => invoices.reduce((acc, inv) => acc + (Number(inv.amount_paid) || 0), 0), [invoices])
  const overdueInvoices = useMemo(() => invoices.filter(
    (i) => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'void' && new Date(i.due_date).getTime() < Date.now())
  ), [invoices])
  const overdueAmount = useMemo(() => overdueInvoices.reduce((acc, inv) => acc + (Number(inv.amount_due) || 0), 0), [overdueInvoices])
  const unpaidInvoices = useMemo(() => invoices.filter(i => i.status !== 'paid' && i.status !== 'void'), [invoices])

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter === 'unpaid') {
        if (inv.status === 'paid' || inv.status === 'void') return false
      } else if (statusFilter === 'paid') {
        if (inv.status !== 'paid') return false
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
            Dispatch digital payment links via SMS, record on-site cash/checks, and auto-issue verified customer receipts.
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
            onClick={() => setShowCreateModal(true)}
            size="sm"
            className="h-9 px-3.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>New Invoice</span>
          </Button>
        </div>
      </div>

      {/* Financial Summary (Senior Craft 4 Tokens) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Receivables Due</p>
            <Clock className="h-4 w-4 text-blue-500/80" />
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums font-mono mt-1">${totalDue.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {unpaidInvoices.length} open invoice{unpaidInvoices.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Total Collected</p>
            <CheckCircle2 className="h-4 w-4 text-emerald-500/80" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums font-mono mt-1">${totalPaid.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {paidInvoices.length} paid in full
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Overdue</p>
            <AlertCircle className="h-4 w-4 text-rose-500/80" />
          </div>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums font-mono mt-1">{overdueInvoices.length}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1 font-mono">
            ${overdueAmount.toFixed(2)} past due date
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Gross Invoiced</p>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums font-mono mt-1">${totalInvoiced.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
            {invoices.length} lifetime invoices
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
          {[
            { key: 'all', label: 'All Invoices', count: invoices.length },
            { key: 'unpaid', label: 'Unpaid (Due & Overdue)', count: unpaidInvoices.length },
            { key: 'paid', label: 'Paid', count: paidInvoices.length },
            { key: 'void', label: 'Void', count: invoices.filter(i => i.status === 'void').length }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer",
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
            className="h-8.5 pl-8 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-400 rounded-lg shadow-2xs focus:border-blue-500"
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
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={searchQuery ? 'No Matching Invoices' : 'No Invoices Created Yet'}
          description={
            searchQuery
              ? `No invoices match "${searchQuery}". Try searching by customer name, phone number, or invoice number.`
              : 'Dispatched jobs can be invoiced immediately. Customers receive a secure mobile checkout link for instant payment via Card or Apple Pay.'
          }
          actionLabel={searchQuery ? 'Clear Search' : 'Create First Invoice'}
          onAction={searchQuery ? () => setSearchQuery('') : () => setShowCreateModal(true)}
        />
      ) : (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200/80 dark:border-zinc-800">
                <TableRow className="border-b border-slate-200/80 dark:border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Invoice #</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Customer</TableHead>
                  <TableHead className="text-slate-600 dark:text-zinc-400 font-semibold text-xs py-3.5 px-4">Scope & Title</TableHead>
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
                      <TableCell className="py-3.5 px-4 font-mono font-semibold text-xs text-slate-700 dark:text-zinc-300">
                        {inv.invoice_number}
                      </TableCell>

                      <TableCell className="py-3.5 px-4">
                        <div className="font-semibold text-xs text-slate-900 dark:text-zinc-100">
                          {inv.contact?.name || 'Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {inv.contact?.phone}
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

                      <TableCell className="py-3.5 px-4 text-right font-semibold text-xs text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                        ${Number(inv.amount_due).toFixed(2)}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right font-bold text-xs text-slate-900 dark:text-zinc-100 font-mono tabular-nums">
                        ${Number(inv.total).toFixed(2)}
                      </TableCell>

                      <TableCell className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5 justify-end">
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
                            title="Preview customer invoice"
                            className="p-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-2xs"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          {/* Void Invoice */}
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

          {/* Mobile Card List View (Truck-Ready 48px Ergonomics) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
            {filteredInvoices.map(inv => {
              const isPaid = inv.status === 'paid'
              const isVoid = inv.status === 'void'

              return (
                <div key={inv.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 dark:text-zinc-400 font-semibold">{inv.invoice_number}</span>
                        {getInvoiceStatusBadge(inv)}
                      </div>
                      <h3 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 mt-1">{inv.title}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400">{inv.contact?.name || 'Customer'} • {inv.contact?.phone}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 font-mono tabular-nums">
                        ${Number(inv.total).toFixed(2)}
                      </p>
                      {!isPaid && (
                        <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                          Due ${Number(inv.amount_due).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-slate-100 dark:border-zinc-800/80">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(inv.manage_token, inv.id)}
                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs"
                        title="Copy payment link"
                      >
                        {copiedId === inv.id ? (
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>

                      <a
                        href={`/invoice/${inv.manage_token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 shadow-2xs"
                        title="View invoice"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isPaid && !isVoid && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => openOfflinePaymentModal(inv)}
                            className="h-9 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
                          >
                            <Banknote className="h-3.5 w-3.5 mr-1" />
                            <span>Collect</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSendInvoice(inv.id)}
                            disabled={actionLoadingId === inv.id}
                            className="h-9 px-3 text-xs border-slate-200 dark:border-zinc-800 font-semibold shadow-2xs"
                          >
                            {actionLoadingId === inv.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                            ) : (
                              <Send className="h-3.5 w-3.5 mr-1 text-blue-600" />
                            )}
                            <span>SMS</span>
                          </Button>
                        </>
                      )}

                      {isPaid && (
                        <a
                          href={`/invoice/${inv.manage_token}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center h-9 px-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800 font-semibold rounded-lg shadow-2xs"
                        >
                          <Receipt className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                          <span>Receipt</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Redesigned "Record Offline Payment" Modal (48px Truck Ergonomics) */}
      <Modal
        open={!!paymentModalInvoice}
        onOpenChange={(open) => !open && setPaymentModalInvoice(null)}
        title="Record On-Site Payment"
        description={`Record immediate cash, check, Zelle, or card terminal payment for #${paymentModalInvoice?.invoice_number || ''}.`}
        size="md"
      >
        <div className="space-y-4">
          {/* Invoice Summary Pill */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">Customer</p>
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {paymentModalInvoice?.contact?.name || 'Customer'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">Balance Due</p>
              <p className="text-sm font-bold text-blue-600 dark:text-blue-400 font-mono tabular-nums">
                ${Number(paymentModalInvoice?.amount_due || 0).toFixed(2)}
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
                { id: 'cash', label: 'Cash on Site', note: 'Cash in hand' },
                { id: 'check', label: 'Paper Check', note: 'Check #' },
                { id: 'other', label: 'Zelle / Venmo', note: 'Zelle transfer verified' },
                { id: 'card_offline', label: 'External POS Card', note: 'Square/Clover card swipe' }
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
                </button>
              ))}
            </div>
          </div>

          {/* Amount Paid with 1-Tap Full Balance Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Amount Received ($)
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

          {/* Reference Note */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              Reference Note / Check Number
            </label>
            <Input
              value={referenceNote}
              onChange={e => setReferenceNote(e.target.value)}
              placeholder="e.g. Check #1042 or Zelle confirmation ID"
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
              disabled={recordingPayment}
              onClick={handleRecordOfflinePayment}
              className="h-10 px-5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer"
            >
              {recordingPayment ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Recording...
                </>
              ) : (
                `Confirm & Mark Paid ($${Number(paymentAmount || 0).toFixed(2)})`
              )}
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
              className="w-full p-2.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="">-- Choose Customer --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Valued Customer'} ({c.phone || 'No phone'}) {c.address ? `• ${c.address}` : ''}
                </option>
              ))}
            </select>
          </div>

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
                    <option value={orgIndustry}>★ {getIndustryPreset(orgIndustry).name} (My Primary Trade)</option>
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
                    className="p-2 text-left rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-850 hover:bg-blue-50/60 dark:hover:bg-zinc-800 transition-all shadow-2xs cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-zinc-500 uppercase">{trade.badge}</span>
                        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {svc.price ? `$${svc.price}` : '$120'}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 line-clamp-1 mt-0.5">
                        {svc.name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Invoice Title <span className="text-rose-500">*</span>
              </label>
              <Input
                value={invoiceTitle}
                onChange={e => setInvoiceTitle(e.target.value)}
                placeholder="e.g. Service & Labor Completion"
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                Payment Terms (Days)
              </label>
              <Input
                type="number"
                value={dueDateDays}
                onChange={e => setDueDateDays(e.target.value)}
                min="0"
                max="60"
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
              {newItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Description (e.g. System replacement & labor)"
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
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Calculations Breakdown */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums font-mono">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 dark:text-zinc-400">
                <span className="flex items-center gap-1 font-medium">
                  Discount ($):
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    className="w-16 h-6 px-1.5 bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded text-right text-xs text-slate-900 dark:text-zinc-200 focus:outline-none font-mono"
                  />
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
