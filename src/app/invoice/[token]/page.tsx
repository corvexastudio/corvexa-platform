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
  Loader2,
  ExternalLink,
  Download,
  Printer,
  Camera,
  MapPin,
  Mail,
  FileText,
  BadgeCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  contacts?: {
    id: string
    name: string
    phone: string
    email?: string
    address_street?: string
    address_city?: string
    address_state?: string
    address_postal_code?: string
  }
}

interface JobPhoto {
  id: string
  url: string
  photo_type: 'before' | 'after' | 'progress' | 'completion'
  caption?: string
  created_at: string
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
  const [jobPhotos, setJobPhotos] = useState<JobPhoto[]>([])
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
      setJobPhotos(data.jobPhotos || [])
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

  const handlePrintPdf = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
        <p className="text-slate-600 dark:text-zinc-400 text-xs font-medium">Loading secure invoice...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4 border border-red-200 dark:border-red-900">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-1.5">Invoice Unavailable</h1>
        <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm mb-6 leading-relaxed">
          {error || 'This invoice link is invalid or may have been updated.'}
        </p>
      </div>
    )
  }

  const isPaid = invoice.status === 'paid'
  const isPartiallyPaid = invoice.status === 'partially_paid'
  const isOverdue = invoice.status === 'overdue' || (!isPaid && new Date(invoice.due_date).getTime() < Date.now())
  const isVoid = invoice.status === 'void'
  const customer = invoice.contacts

  const orgAddress = [
    org?.address_street,
    org?.address_city,
    org?.address_state && org?.address_postal_code ? `${org.address_state} ${org.address_postal_code}` : org?.address_state
  ].filter(Boolean).join(', ')

  const customerAddress = [
    customer?.address_street,
    customer?.address_city,
    customer?.address_state && customer?.address_postal_code ? `${customer.address_state} ${customer.address_postal_code}` : customer?.address_state
  ].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-6 sm:py-10 px-4 sm:px-6">
      {/* Top Utility Bar (Hidden during Print) */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Verified Secure Contractor Invoice</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrintPdf}
            className="h-8.5 px-3 text-xs font-semibold gap-1.5 border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-2xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
            <span>Download Official PDF</span>
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto space-y-5 print:max-w-none print:m-0 print:p-0">
        
        {/* Main Invoice Card (Print-Ready) */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-8 shadow-xs border border-slate-200 dark:border-zinc-800 print:border-none print:shadow-none print:p-0">
          
          {/* Official Letterhead Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-slate-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Building className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                  {org?.name || 'Local Service Provider'}
                </h2>
              </div>

              {/* State Trade License Badge */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 mb-2">
                <BadgeCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>
                  {org?.license_number
                    ? `Licensed Trade Contractor • License #${org.license_number}`
                    : `Verified Licensed & Insured Contractor`}
                </span>
              </div>

              {/* Business Contact Information */}
              <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-0.5">
                {orgAddress && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    <span>{orgAddress}</span>
                  </div>
                )}
                {org?.owner_phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-400" />
                    <a href={`tel:${org.owner_phone}`} className="hover:underline text-slate-700 dark:text-zinc-300">
                      {org.owner_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Invoice Reference Metadata */}
            <div className="text-left sm:text-right space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                {isPaid ? 'Official Receipt & Statement' : 'Official Service Invoice'}
              </span>
              <h1 className="text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-zinc-100">
                {invoice.invoice_number}
              </h1>

              <div className="text-xs text-slate-600 dark:text-zinc-400 space-y-0.5 pt-1">
                <div>
                  <span className="text-slate-400">Date Issued: </span>
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    {invoice.sent_at ? new Date(invoice.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Due Date: </span>
                  <span className="font-medium text-slate-700 dark:text-zinc-200">
                    {new Date(invoice.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="pt-2 sm:justify-end flex">
                {isPaid && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Paid in Full
                  </span>
                )}
                {isPartiallyPaid && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    Partially Paid
                  </span>
                )}
                {isOverdue && !isPaid && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    Payment Overdue
                  </span>
                )}
                {!isPaid && !isPartiallyPaid && !isOverdue && !isVoid && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                    <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Payment Due
                  </span>
                )}
                {isVoid && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400 border border-slate-300 dark:border-zinc-700">
                    Voided
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Customer & Job Details Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-slate-200 dark:border-zinc-800 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Billed To
              </span>
              <div className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                {customer?.name || 'Homeowner / Client'}
              </div>
              {customer?.phone && (
                <div className="text-slate-600 dark:text-zinc-400 mt-0.5">
                  {customer.phone}
                </div>
              )}
              {customer?.email && (
                <div className="text-slate-600 dark:text-zinc-400">
                  {customer.email}
                </div>
              )}
              {customerAddress && (
                <div className="text-slate-600 dark:text-zinc-400 mt-1 flex items-start gap-1">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                  <span>{customerAddress}</span>
                </div>
              )}
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
                Job Details
              </span>
              <div className="font-semibold text-slate-900 dark:text-zinc-100">
                {invoice.title}
              </div>
              {invoice.description && (
                <p className="text-slate-500 dark:text-zinc-400 mt-0.5 leading-relaxed">
                  {invoice.description}
                </p>
              )}
            </div>
          </div>

          {/* Paid Celebration Banner & Verified Receipt Stamp */}
          {isPaid && (
            <div className="my-6 p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800 flex items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    Payment Received in Full
                  </h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-400 mt-0.5">
                    Settled on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : 'Record'}. Your account balance is $0.00.
                  </p>
                </div>
              </div>

              {/* Stamp Border */}
              <div className="hidden sm:block text-center border-2 border-dashed border-emerald-600 dark:border-emerald-400 rounded-lg px-3 py-1 rotate-[-3deg] uppercase font-black text-emerald-700 dark:text-emerald-400 text-xs tracking-widest shadow-2xs">
                Official Receipt
              </div>
            </div>
          )}

          {/* Simulated Mode Warning & Helper (Hidden in Print) */}
          {isSimulated && !isPaid && (
            <div className="my-5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 print:hidden">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-1">
                Development Test Mode
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-2.5">
                Stripe live mode not configured. Click below to simulate completing this checkout:
              </p>
              <Button
                type="button"
                size="sm"
                onClick={handleSimulatedPayment}
                disabled={paying}
                className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-8 cursor-pointer"
              >
                {paying ? 'Processing...' : 'Simulate Paid Webhook'}
              </Button>
            </div>
          )}

          {/* Itemized Services Table */}
          <div className="py-6">
            <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block mb-3">
              Itemized Labor & Materials
            </span>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400">
                    <th className="pb-2.5 font-semibold">Description</th>
                    <th className="pb-2.5 text-center font-semibold w-16">Qty</th>
                    <th className="pb-2.5 text-right font-semibold w-24">Unit Rate</th>
                    <th className="pb-2.5 text-right font-semibold w-24">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-850/30 transition-colors">
                      <td className="py-3 font-medium text-slate-900 dark:text-zinc-100 pr-4">
                        {item.description}
                      </td>
                      <td className="py-3 text-center text-slate-600 dark:text-zinc-400 font-mono">
                        {item.quantity}
                      </td>
                      <td className="py-3 text-right text-slate-600 dark:text-zinc-400 font-mono tabular-nums">
                        ${Number(item.unit_price).toFixed(2)}
                      </td>
                      <td className="py-3 text-right font-bold text-slate-900 dark:text-zinc-100 font-mono tabular-nums">
                        ${Number(item.total).toFixed(2)}
                      </td>
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

          {/* Financial Breakdown Summary */}
          <div className="border-t border-slate-200 dark:border-zinc-800 pt-5 flex justify-end">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums">${Number(invoice.subtotal).toFixed(2)}</span>
              </div>
              {Number(invoice.discount) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Discount</span>
                  <span className="font-mono tabular-nums">-${Number(invoice.discount).toFixed(2)}</span>
                </div>
              )}
              {Number(invoice.tax) > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-zinc-400">
                  <span>Tax</span>
                  <span className="font-mono tabular-nums">+${Number(invoice.tax).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-900 dark:text-zinc-100 font-bold pt-2 border-t border-slate-200 dark:border-zinc-800 text-sm">
                <span>Total Invoice</span>
                <span className="font-mono tabular-nums">${Number(invoice.total).toFixed(2)}</span>
              </div>
              {Number(invoice.amount_paid) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Amount Paid</span>
                  <span className="font-mono tabular-nums">-${Number(invoice.amount_paid).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-slate-900 dark:text-zinc-100 text-base pt-2 border-t-2 border-slate-900 dark:border-zinc-100">
                <span>Balance Due</span>
                <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                  ${Number(invoice.amount_due).toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Jobsite Proof of Work / Before & After Photos */}
          {jobPhotos.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800">
              <div className="flex items-center gap-2 mb-3">
                <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-zinc-100">
                  Proof of Work • Jobsite Photos
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mb-3 leading-relaxed">
                Documented on-site for customer verification, manufacturer warranty compliance, and insurance records.
              </p>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {jobPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden bg-slate-50 dark:bg-zinc-950 shadow-2xs"
                  >
                    <div className="relative aspect-4/3 bg-slate-100 dark:bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || `${photo.photo_type} job photo`}
                        className="w-full h-full object-cover"
                      />
                      <span
                        className={cn(
                          'absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-white shadow-xs',
                          photo.photo_type === 'before' ? 'bg-amber-600' : 'bg-emerald-600'
                        )}
                      >
                        {photo.photo_type}
                      </span>
                    </div>
                    {photo.caption && (
                      <p className="p-2 text-[11px] text-slate-600 dark:text-zinc-400 line-clamp-1">
                        {photo.caption}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Instructions Card (Zelle / Check / Cash / Direct) */}
          {org?.payment_instructions && (
            <div className="mt-6 p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>Payment & Settlement Instructions</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-300 whitespace-pre-line leading-relaxed">
                {org.payment_instructions}
              </p>
            </div>
          )}

          {/* Interactive Pay Button / Actions (Hidden during Print) */}
          {!isPaid && !isVoid && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800 flex flex-col gap-3 print:hidden">
              {payError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-900 text-center">
                  {payError}
                </p>
              )}

              {/* Option A: Contractor has External Payment Link configured (Square, Venmo, PayPal, etc.) */}
              {org?.external_payment_url ? (
                <>
                  <a
                    href={org.external_payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer"
                  >
                    <CreditCard className="w-5 h-5" />
                    <span>Pay Online Now (${Number(invoice.amount_due).toFixed(2)})</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 mt-0.5">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Opens contractor payment checkout in a secure tab</span>
                  </div>
                </>
              ) : org?.stripe_charges_enabled || invoice.stripe_payment_link_url ? (
                /* Option B: Stripe Connect Card / Apple Pay */
                <>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={paying}
                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2.5 transition shadow-sm disabled:opacity-50 cursor-pointer"
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
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-1">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Secure 256-bit SSL encrypted checkout powered by Stripe</span>
                  </div>
                </>
              ) : (
                /* Option C: Direct Offline / Custom Settlement instructions */
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-center space-y-1">
                  <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                    Payment Upon Service Completion
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    To settle this invoice, please contact {org?.name || 'the service provider'} at{' '}
                    <a href={`tel:${org?.owner_phone}`} className="underline font-semibold text-blue-600 dark:text-blue-400">
                      {org?.owner_phone || 'their phone number'}
                    </a>{' '}
                    for payment options (Cash, Check, or Direct Settlement).
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Official Document Footer (Visible in Print & Screen) */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-800 text-center text-[11px] text-slate-400 dark:text-zinc-500 space-y-1">
            <p>
              Official Document #{invoice.invoice_number} • Issued by {org?.name || 'Service Provider'}
            </p>
            {org?.owner_phone && (
              <p>
                Questions or support? Call{' '}
                <a href={`tel:${org.owner_phone}`} className="underline text-slate-600 dark:text-zinc-400">
                  {org.owner_phone}
                </a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
