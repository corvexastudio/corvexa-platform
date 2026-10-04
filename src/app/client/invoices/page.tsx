'use client'

import { useEffect, useState } from 'react'
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
  X,
  Loader2,
  Trash2
} from 'lucide-react'

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

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'void'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

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

  // Offline Payment Modal
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check' | 'card_offline'>('cash')
  const [referenceNote, setReferenceNote] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/client/invoices')
      if (res.ok) {
        const data = await res.json()
        setInvoices(data.invoices || [])
      }
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadContacts = async () => {
    try {
      const res = await fetch('/api/client/customers')
      if (res.ok) {
        const data = await res.json()
        setContacts(data.customers || data.contacts || [])
      }
    } catch (err) {
      console.error('Failed to load contacts:', err)
    }
  }

  useEffect(() => {
    loadInvoices()
    loadContacts()
  }, [])

  // Calculations for new invoice form
  const subtotal = newItems.reduce((acc, it) => acc + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0)
  const discount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0))
  const tax = Math.round(Math.max(0, subtotal - discount) * ((Number(taxRate) || 0) / 100) * 100) / 100
  const total = Math.max(0, Math.round((subtotal - discount + tax) * 100) / 100)

  const handleAddItem = () => {
    setNewItems([...newItems, { description: '', quantity: 1, unit_price: 0 }])
  }

  const handleRemoveItem = (index: number) => {
    setNewItems(newItems.filter((_, i) => i !== index))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updated = [...newItems]
    updated[index] = { ...updated[index], [field]: value }
    setNewItems(updated)
  }

  const handleSaveInvoice = async (sendImmediately: boolean) => {
    if (!selectedContactId || !invoiceTitle.trim()) {
      alert('Please select a customer and provide an invoice title.')
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
        alert(data.error || 'Failed to create invoice')
        setSavingInvoice(false)
        return
      }

      if (sendImmediately && data.invoice?.id) {
        await fetch(`/api/client/invoices/${data.invoice.id}/send`, { method: 'POST' })
      }

      setShowCreateModal(false)
      await loadInvoices()
    } catch (err: any) {
      alert(err.message || 'Error creating invoice')
    } finally {
      setSavingInvoice(false)
    }
  }

  const handleSendInvoice = async (invoiceId: string) => {
    setActionLoadingId(invoiceId)
    try {
      const res = await fetch(`/api/client/invoices/${invoiceId}/send`, { method: 'POST' })
      if (res.ok) {
        await loadInvoices()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to send invoice')
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleRecordOfflinePayment = async () => {
    if (!paymentModalInvoice || !paymentAmount || Number(paymentAmount) <= 0) {
      alert('Please enter a valid payment amount.')
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
        setPaymentModalInvoice(null)
        setPaymentAmount('')
        setReferenceNote('')
        await loadInvoices()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to record payment')
      }
    } finally {
      setRecordingPayment(false)
    }
  }

  const handleVoidInvoice = async (invoiceId: string) => {
    if (!confirm('Are you sure you want to void this invoice?')) return
    setActionLoadingId(invoiceId)
    try {
      const res = await fetch(`/api/client/invoices/${invoiceId}/void`, { method: 'POST' })
      if (res.ok) {
        await loadInvoices()
      }
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleCopyLink = (token: string, id: string) => {
    const url = `${window.location.origin}/invoice/${token}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

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
      const q = searchQuery.toLowerCase()
      const matchNum = inv.invoice_number.toLowerCase().includes(q)
      const matchTitle = inv.title.toLowerCase().includes(q)
      const matchContact = inv.contact?.name.toLowerCase().includes(q) || inv.contact?.phone.includes(q)
      return matchNum || matchTitle || matchContact
    }
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Invoices & Payments</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Lightweight invoicing with instant Stripe payment collection & automated reminders.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm transition text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Invoice</span>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Total Invoiced</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">${totalInvoiced.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{invoices.length} invoices generated</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Balance Due</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">${totalDue.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">Pending customer settlement</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Collected</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">${totalPaid.toFixed(2)}</p>
          <p className="text-xs text-slate-400 mt-1">{paidInvoices.length} invoices paid in full</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">Overdue</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{overdueInvoices.length}</p>
          <p className="text-xs text-rose-500 mt-1">Automated reminders scheduled</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All ({invoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('unpaid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'unpaid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Unpaid
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'paid'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Paid ({paidInvoices.length})
          </button>
          <button
            onClick={() => setStatusFilter('void')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              statusFilter === 'void'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Void
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search invoice or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-sm">Loading invoices...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-1">No invoices found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Create an invoice to collect payments via credit card, Apple Pay, or Google Pay.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition"
          >
            Create First Invoice
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.map((inv) => {
            const isPaid = inv.status === 'paid'
            const isVoid = inv.status === 'void'
            const isOverdue =
              inv.status === 'overdue' ||
              (!isPaid && !isVoid && new Date(inv.due_date).getTime() < Date.now())

            return (
              <div
                key={inv.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-blue-200 dark:hover:border-blue-900"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-900 dark:text-white text-base">
                      {inv.invoice_number}
                    </span>

                    {isPaid && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    )}
                    {inv.status === 'partially_paid' && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> Partially Paid
                      </span>
                    )}
                    {isOverdue && !isPaid && (
                      <span className="inline-flex items-center gap-1 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                    {!isPaid && !isOverdue && !isVoid && inv.status !== 'partially_paid' && (
                      <span className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" /> {inv.status === 'sent' ? 'Sent' : 'Draft'}
                      </span>
                    )}
                    {isVoid && (
                      <span className="inline-flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold px-2.5 py-0.5 rounded-full">
                        Void
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{inv.title}</p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {inv.contact?.name || 'Unassigned'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Due {new Date(inv.due_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  <div className="text-left md:text-right">
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="text-lg font-black text-slate-900 dark:text-white">${Number(inv.total).toFixed(2)}</p>
                    {!isPaid && Number(inv.amount_paid) > 0 && (
                      <p className="text-xs text-emerald-600">Paid: ${Number(inv.amount_paid).toFixed(2)}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {!isPaid && !isVoid && (
                      <button
                        onClick={() => handleSendInvoice(inv.id)}
                        disabled={actionLoadingId === inv.id}
                        title="Send / Resend SMS with Payment Link"
                        className="p-2 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        {actionLoadingId === inv.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        <span className="hidden sm:inline">Send SMS</span>
                      </button>
                    )}

                    {!isPaid && !isVoid && (
                      <button
                        onClick={() => {
                          setPaymentModalInvoice(inv)
                          setPaymentAmount(String(inv.amount_due))
                        }}
                        title="Record Cash or Check Payment"
                        className="p-2 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                      >
                        <DollarSign className="w-4 h-4" />
                        <span className="hidden sm:inline">Pay</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleCopyLink(inv.manage_token, inv.id)}
                      title="Copy Public Link"
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      {copiedId === inv.id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <a
                      href={`/invoice/${inv.manage_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open Public Invoice Portal"
                      className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {!isPaid && !isVoid && (
                      <button
                        onClick={() => handleVoidInvoice(inv.id)}
                        title="Void Invoice"
                        className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 rounded-xl text-xs transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">Create New Invoice</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Customer
                </label>
                <select
                  value={selectedContactId}
                  onChange={(e) => setSelectedContactId(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Customer --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Invoice Title
                </label>
                <input
                  type="text"
                  value={invoiceTitle}
                  onChange={(e) => setInvoiceTitle(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
                  placeholder="e.g. Completed HVAC Repair & Service"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Payment Terms
                </label>
                <select
                  value={dueDateDays}
                  onChange={(e) => setDueDateDays(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-blue-500"
                >
                  <option value="0">Due on Receipt (Today)</option>
                  <option value="7">Net 7 Days</option>
                  <option value="14">Net 14 Days</option>
                  <option value="30">Net 30 Days</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Line Items</label>
                  <button
                    onClick={handleAddItem}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {newItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="flex-1 p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-16 p-2 text-xs text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                        className="w-24 p-2 text-xs text-right bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
                      />
                      {newItems.length > 1 && (
                        <button
                          onClick={() => handleRemoveItem(index)}
                          className="p-2 text-slate-400 hover:text-rose-500 rounded-lg cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Discount ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal:</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span>-${discount.toFixed(2)}</span>
                  </div>
                )}
                {tax > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Tax:</span>
                    <span>+${tax.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-slate-900 dark:text-white text-base pt-1 border-t border-slate-200 dark:border-slate-700">
                  <span>Total Amount:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => handleSaveInvoice(false)}
                  disabled={savingInvoice}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  onClick={() => handleSaveInvoice(true)}
                  disabled={savingInvoice}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {savingInvoice ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Create & Send SMS</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {paymentModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Record Payment for {paymentModalInvoice.invoice_number}
              </h2>
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Amount Received ($)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full p-2.5 text-base font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Payment Method
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['cash', 'check', 'card_offline'] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 text-xs font-bold rounded-xl border capitalize transition cursor-pointer ${
                      paymentMethod === method
                        ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {method.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Check # / Reference Note
              </label>
              <input
                type="text"
                value={referenceNote}
                onChange={(e) => setReferenceNote(e.target.value)}
                placeholder="e.g. Check #4029 received on site"
                className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setPaymentModalInvoice(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordOfflinePayment}
                disabled={recordingPayment}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {recordingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Payment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
