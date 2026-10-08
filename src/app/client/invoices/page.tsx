'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  Ban
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  sent_at?: string
  paid_at?: string
  created_at: string
  contact?: {
    id: string
    name: string
    phone: string
    email?: string
  }
}

function getInvoiceStatusBadge(inv: Invoice) {
  const isPaid = inv.status === 'paid'
  const isVoid = inv.status === 'void'
  const isOverdue =
    inv.status === 'overdue' ||
    (!isPaid && !isVoid && new Date(inv.due_date).getTime() < Date.now())

  if (isPaid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        Paid
      </span>
    )
  }
  if (inv.status === 'partially_paid') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        Partially Paid
      </span>
    )
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
        Overdue
      </span>
    )
  }
  if (inv.status === 'sent') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
        Sent
      </span>
    )
  }
  if (isVoid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-500 border border-zinc-700">
        Void
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
      Draft
    </span>
  )
}

function ClientInvoicesContent() {
  const searchParams = useSearchParams()
  const contactIdParam = searchParams.get('contact_id')

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
  const [savingInvoice, setSavingInvoice] = useState(false)

  // Listen to contact_id query param
  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam)
      setShowCreateModal(true)
    }
  }, [contactIdParam])

  // Offline Payment Modal
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card_offline'>('cash')
  const [referenceNote, setReferenceNote] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/invoices')
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
      setError('Unable to connect to invoicing service. Please check connection.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/client/customers')
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
  const subtotal = newItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
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
        toast.success('Invoice sent to customer via SMS')
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
    toast.success('Invoice link copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Financial aggregates
  const totalInvoiced = invoices.reduce((acc, inv) => acc + (Number(inv.total) || 0), 0)
  const totalDue = invoices.reduce((acc, inv) => acc + (Number(inv.amount_due) || 0), 0)
  const paidInvoices = invoices.filter((i) => i.status === 'paid')
  const totalPaid = invoices.reduce((acc, inv) => acc + (Number(inv.amount_paid) || 0), 0)
  const overdueInvoices = invoices.filter(
    (i) => i.status === 'overdue' || (i.status !== 'paid' && i.status !== 'void' && new Date(i.due_date).getTime() < Date.now())
  )

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter === 'unpaid') {
      if (inv.status === 'paid' || inv.status === 'void') return false
    } else if (statusFilter === 'paid') {
      if (inv.status !== 'paid') return false
    } else if (statusFilter === 'void') {
      if (inv.status !== 'void') return false
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      const matchNum = inv.invoice_number.toLowerCase().includes(q)
      const matchTitle = inv.title.toLowerCase().includes(q)
      const matchContact = inv.contact?.name.toLowerCase().includes(q) || inv.contact?.phone.includes(q)
      return matchNum || matchTitle || matchContact
    }
    return true
  })

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Invoices & Payments
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {invoices.length}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Fast mobile checkout links with Stripe, offline payment tracking, and automated reminders.
          </p>
        </div>

        <Button
          onClick={() => setShowCreateModal(true)}
          size="sm"
          className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          <span>New Invoice</span>
        </Button>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Total Invoiced</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">${totalInvoiced.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{invoices.length} total generated</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Balance Due</p>
          <p className="text-xl font-bold text-blue-400 tabular-nums mt-1">${totalDue.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Pending customer payment</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Collected</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums mt-1">${totalPaid.toFixed(2)}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">{paidInvoices.length} paid in full</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Overdue</p>
          <p className="text-xl font-bold text-rose-400 tabular-nums mt-1">{overdueInvoices.length}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Auto reminders scheduled</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { key: 'all', label: 'All Invoices' },
            { key: 'unpaid', label: 'Unpaid' },
            { key: 'paid', label: `Paid (${paidInvoices.length})` },
            { key: 'void', label: 'Void' }
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                statusFilter === t.key
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
          <Input
            placeholder="Search invoice or customer..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-400 rounded-md"
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
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title={searchQuery ? 'No Matching Invoices' : 'No Invoices Created Yet'}
          description={
            searchQuery
              ? `No invoices match "${searchQuery}". Try searching by customer name, phone number, or invoice number.`
              : 'Dispatched jobs can be invoiced immediately. Customers receive a secure mobile checkout link for instant payment.'
          }
          actionLabel={searchQuery ? 'Clear Search' : 'Create First Invoice'}
          onAction={searchQuery ? () => setSearchQuery('') : () => setShowCreateModal(true)}
        />
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900/90 border-b border-zinc-800">
                <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Invoice #</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Customer</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Title</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Status</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Due Date</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Balance Due</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Total</TableHead>
                  <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-zinc-800">
                {filteredInvoices.map(inv => {
                  const isPaid = inv.status === 'paid'
                  const isVoid = inv.status === 'void'

                  return (
                    <TableRow key={inv.id} className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors">
                      <TableCell className="py-3 px-4 font-mono font-medium text-xs text-zinc-300">
                        {inv.invoice_number}
                      </TableCell>

                      <TableCell className="py-3 px-4">
                        <div className="font-medium text-xs text-zinc-100">
                          {inv.contact?.name || 'Customer'}
                        </div>
                        <div className="text-[11px] text-zinc-400 tabular-nums">
                          {inv.contact?.phone}
                        </div>
                      </TableCell>

                      <TableCell className="py-3 px-4 text-xs text-zinc-300 max-w-xs truncate">
                        {inv.title}
                      </TableCell>

                      <TableCell className="py-3 px-4">
                        {getInvoiceStatusBadge(inv)}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap tabular-nums">
                        {new Date(inv.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right font-medium text-xs text-blue-400 tabular-nums">
                        ${Number(inv.amount_due).toFixed(2)}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right font-semibold text-xs text-zinc-100 tabular-nums">
                        ${Number(inv.total).toFixed(2)}
                      </TableCell>

                      <TableCell className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 justify-end">
                          {!isPaid && !isVoid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSendInvoice(inv.id)}
                              disabled={actionLoadingId === inv.id}
                              className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-800"
                            >
                              {actionLoadingId === inv.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3 mr-1" />
                              )}
                              <span>Send</span>
                            </Button>
                          )}

                          {!isPaid && !isVoid && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setPaymentModalInvoice(inv)
                                setPaymentAmount(String(inv.amount_due))
                              }}
                              className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800"
                              title="Record offline payment"
                            >
                              <Banknote className="h-3 w-3 mr-1" />
                              <span>Pay Offline</span>
                            </Button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyLink(inv.manage_token, inv.id)}
                            title="Copy link"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            {copiedId === inv.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <a
                            href={`/invoice/${inv.manage_token}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Preview customer invoice"
                            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>

                          {!isPaid && !isVoid && (
                            <button
                              type="button"
                              onClick={() => setVoidInvoiceId(inv.id)}
                              title="Void invoice"
                              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-500 hover:text-rose-400 transition-colors"
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

          {/* Mobile Card List View */}
          <div className="md:hidden divide-y divide-zinc-800">
            {filteredInvoices.map(inv => {
              const isPaid = inv.status === 'paid'
              const isVoid = inv.status === 'void'

              return (
                <div key={inv.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-zinc-400 font-medium">{inv.invoice_number}</span>
                        {getInvoiceStatusBadge(inv)}
                      </div>
                      <h3 className="font-medium text-xs text-zinc-100 mt-1">{inv.title}</h3>
                      <p className="text-[11px] text-zinc-400">{inv.contact?.name || 'Customer'} • {inv.contact?.phone}</p>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-semibold text-zinc-100 tabular-nums">
                        ${Number(inv.total).toFixed(2)}
                      </p>
                      {!isPaid && (
                        <p className="text-[10px] text-blue-400 tabular-nums">
                          Due ${Number(inv.amount_due).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-800/80">
                    {!isPaid && !isVoid && (
                      <Button
                        size="sm"
                        onClick={() => handleSendInvoice(inv.id)}
                        disabled={actionLoadingId === inv.id}
                        className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-500 text-white"
                      >
                        {actionLoadingId === inv.id ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Send className="h-3 w-3 mr-1" />
                        )}
                        <span>Send</span>
                      </Button>
                    )}

                    {!isPaid && !isVoid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPaymentModalInvoice(inv)
                          setPaymentAmount(String(inv.amount_due))
                        }}
                        className="h-7 px-2 text-xs border-zinc-800 bg-zinc-900 text-emerald-400 hover:bg-zinc-800"
                      >
                        <Banknote className="h-3 w-3 mr-1" />
                        <span>Pay</span>
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyLink(inv.manage_token, inv.id)}
                      className="p-1.5 rounded bg-zinc-800 text-zinc-300"
                      title="Copy link"
                    >
                      {copiedId === inv.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    <a
                      href={`/invoice/${inv.manage_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded bg-zinc-800 text-zinc-300"
                      title="View public invoice"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create New Invoice Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Create New Invoice"
        description="Set line items, tax, and discount for instant mobile checkout."
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
                Invoice Title
              </label>
              <Input
                value={invoiceTitle}
                onChange={e => setInvoiceTitle(e.target.value)}
                placeholder="e.g. Service & Labor Completion"
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Payment Terms (Days)
              </label>
              <Input
                type="number"
                value={dueDateDays}
                onChange={e => setDueDateDays(e.target.value)}
                min="0"
                max="60"
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
                    placeholder="Description (e.g. System replacement)"
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

            {/* Calculations Breakdown */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-medium text-zinc-200 tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span className="flex items-center gap-1">
                  Discount ($):
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value)}
                    className="w-16 h-6 px-1.5 bg-zinc-950 border border-zinc-800 rounded text-right text-xs text-zinc-200"
                  />
                </span>
                <span className="tabular-nums">-${discount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span className="flex items-center gap-1">
                  Tax Rate (%):
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={taxRate}
                    onChange={e => setTaxRate(e.target.value)}
                    className="w-16 h-6 px-1.5 bg-zinc-950 border border-zinc-800 rounded text-right text-xs text-zinc-200"
                  />
                </span>
                <span className="tabular-nums">+${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-zinc-800 text-white font-bold text-sm">
                <span>Total Amount:</span>
                <span className="tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>
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
              disabled={savingInvoice}
              onClick={() => handleSaveInvoice(false)}
              className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              Save Draft
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={savingInvoice}
              onClick={() => handleSaveInvoice(true)}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {savingInvoice ? (
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

      {/* Record Offline Payment Modal */}
      <Modal
        open={!!paymentModalInvoice}
        onOpenChange={(open) => !open && setPaymentModalInvoice(null)}
        title="Record Offline Payment"
        description={`Record cash, check, or on-site POS card payment for invoice #${paymentModalInvoice?.invoice_number || ''}.`}
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaymentModalInvoice(null)}
              className="h-8 text-xs border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={recordingPayment}
              onClick={handleRecordOfflinePayment}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              {recordingPayment ? 'Recording...' : 'Record Payment'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Amount Paid ($)
            </label>
            <Input
              type="number"
              step="0.01"
              value={paymentAmount}
              onChange={e => setPaymentAmount(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as any)}
              className="w-full p-2 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 focus:outline-none focus:border-zinc-700"
            >
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="card_offline">External Credit Card Terminal</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Reference Note / Check #
            </label>
            <Input
              value={referenceNote}
              onChange={e => setReferenceNote(e.target.value)}
              placeholder="e.g. Check #1042 or Cash in hand"
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
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
