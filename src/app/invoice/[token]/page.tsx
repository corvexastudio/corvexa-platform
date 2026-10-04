'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock,
  Phone,
  Receipt,
  ShieldCheck,
  Building,
  Calendar,
  DollarSign,
  ArrowRight,
  Loader2
} from 'lucide-react'

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface InvoiceData {
  id: string
  invoice_number: string
  title: string
  description?: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  amount_paid: number
  amount_due: number
  status: 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue' | 'void'
  due_date: string
  sent_at?: string | null
  viewed_at?: string | null
  paid_at?: string | null
  stripe_payment_link_url?: string | null
  notes?: string | null
}

export default function CustomerInvoicePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<InvoiceData | null>(null)
  const [items, setItems] = useState<InvoiceItem[]>([])
  const [org, setOrg] = useState<any>(null)
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const isSimulated = searchParams.get('simulated_checkout') === 'true'

  const loadInvoice = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/invoice/${token}`)
      if (!res.ok) {
        setError('Invoice not found or the link has expired.')
        return
      }
      const data = await res.json()
      setInvoice(data.invoice)
      setItems(data.items || [])
      setOrg(data.org || null)
    } catch {
      setError('Unable to load invoice. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoice()
  }, [token])

  const handlePay = async () => {
    setPaying(true)
    setPayError(null)

    try {
      const res = await fetch(`/api/invoice/${token}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await res.json()
      if (!res.ok || !data.checkoutUrl) {
        setPayError(data.error || 'Failed to start payment session')
        setPaying(false)
        return
      }

      window.location.href = data.checkoutUrl
    } catch (err: any) {
      setPayError(err.message || 'Payment initiation failed')
      setPaying(false)
    }
  }

  const handleSimulatedPayment = async () => {
    setPaying(true)
    try {
      const res = await fetch(`/api/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `evt_sim_${Date.now()}`,
          type: 'checkout.session.completed',
          data: {
            object: {
              id: `cs_sim_${Date.now()}`,
              metadata: {
                invoice_id: invoice?.id,
                org_id: org?.id || invoice?.id
              },
              amount_total: Math.round((Number(invoice?.amount_due) || Number(invoice?.total)) * 100),
              customer_details: { email: 'customer@example.com' }
            }
          }
        })
      })

      if (res.ok) {
        await loadInvoice()
      }
    } catch (err: any) {
      setPayError(err.message || 'Simulated payment failed')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">Loading invoice...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invoice Unavailable</h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-sm mb-6">{error || 'This invoice link is invalid.'}</p>
      </div>
    )
  }

  const isPaid = invoice.status === 'paid'
  const isPartiallyPaid = invoice.status === 'partially_paid'
  const isOverdue = invoice.status === 'overdue' || (!isPaid && new Date(invoice.due_date).getTime() < Date.now())
  const isVoid = invoice.status === 'void'

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        
        {/* Business Header */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Building className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold">{org?.name || 'Local Service Provider'}</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Payment Invoice & Statement</p>
          </div>

          {org?.owner_phone && (
            <a
              href={`tel:${org.owner_phone}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              <Phone className="w-4 h-4" />
              {org.owner_phone}
            </a>
          )}
        </div>

        {/* Invoice Summary Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-6 border-b border-slate-100 dark:border-slate-800 gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-black tracking-tight">{invoice.invoice_number}</h1>
                {isPaid && (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Paid in Full
                  </span>
                )}
                {isPartiallyPaid && (
                  <span className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" /> Partially Paid
                  </span>
                )}
                {isOverdue && !isPaid && (
                  <span className="inline-flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <AlertCircle className="w-3.5 h-3.5" /> Overdue
                  </span>
                )}
                {!isPaid && !isPartiallyPaid && !isOverdue && !isVoid && (
                  <span className="inline-flex items-center gap-1.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5" /> Payment Due
                  </span>
                )}
                {isVoid && (
                  <span className="inline-flex items-center gap-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    Void
                  </span>
                )}
              </div>
              <p className="text-base text-slate-700 dark:text-slate-300 font-medium">{invoice.title}</p>
              {invoice.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{invoice.description}</p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-0.5">Amount Due</p>
              <p className={`text-3xl font-black ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                ${Number(invoice.amount_due).toFixed(2)}
              </p>
              <div className="flex items-center gap-1 text-xs text-slate-500 mt-1 sm:justify-end">
                <Calendar className="w-3.5 h-3.5" />
                <span>Due {new Date(invoice.due_date).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Paid Celebration Banner */}
          {isPaid && (
            <div className="my-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Payment Received on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'Record'}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Thank you for your business! Your account has a zero balance.
                </p>
              </div>
            </div>
          )}

          {/* Simulated Mode Warning & Helper */}
          {isSimulated && !isPaid && (
            <div className="my-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
                Development Simulation Mode
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mb-3">
                No Stripe live credentials configured. You can simulate completing this payment in one click:
              </p>
              <button
                onClick={handleSimulatedPayment}
                disabled={paying}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-sm transition shadow-sm"
              >
                {paying ? 'Simulating...' : 'Simulate Paid Webhook'}
              </button>
            </div>
          )}

          {/* Line Items Table */}
          <div className="py-6">
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-3">Itemized Services</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 text-center font-semibold w-16">Qty</th>
                    <th className="pb-3 text-right font-semibold w-24">Rate</th>
                    <th className="pb-3 text-right font-semibold w-24">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-3 font-medium text-slate-900 dark:text-slate-100">{item.description}</td>
                      <td className="py-3 text-center text-slate-600 dark:text-slate-400">{item.quantity}</td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-400">${Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-3 text-right font-bold text-slate-900 dark:text-slate-100">${Number(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                        {invoice.title}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Breakdown */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 flex justify-end">
            <div className="w-full sm:w-64 space-y-2 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span>${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span>-${Number(invoice.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.tax) > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Tax</span>
                  <span>+${Number(invoice.tax).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 dark:text-white font-bold pt-2 border-t border-slate-100 dark:border-slate-800 text-base">
                <span>Total</span>
                <span>${Number(invoice.total).toFixed(2)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Amount Paid</span>
                  <span>-${Number(invoice.amount_paid).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 dark:text-white text-lg pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>Balance Due</span>
                <span>${Number(invoice.amount_due).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Pay Button / Actions */}
          {!isPaid && !isVoid && (
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              {payError && (
                <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-900 text-center">
                  {payError}
                </p>
              )}

              <button
                onClick={handlePay}
                disabled={paying}
                className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-black rounded-xl text-lg flex items-center justify-center gap-3 transition shadow-lg shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
              >
                {paying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Connecting to Stripe...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Pay Online with Card / Apple Pay (${Number(invoice.amount_due).toFixed(2)})</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Secure 256-bit SSL encrypted checkout powered by Stripe</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <p className="text-center text-xs text-slate-400">
          Invoice #{invoice.invoice_number} • Issued by {org?.name || 'Business'} • Questions? Call{' '}
          <a href={`tel:${org?.owner_phone}`} className="underline">
            {org?.owner_phone || 'support'}
          </a>
        </p>

      </div>
    </div>
  )
}
