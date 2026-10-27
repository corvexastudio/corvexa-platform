'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Phone,
  MessageSquare,
  Clock,
  ShieldCheck,
  Calendar,
  Send,
  HelpCircle,
  DollarSign,
  PenTool,
  RotateCcw,
  BadgeCheck,
  Lock,
  ChevronRight
} from 'lucide-react'

interface QuoteItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

interface QuoteData {
  id: string
  quote_number: string
  title: string
  description?: string | null
  subtotal: number
  tax: number
  discount: number
  total: number
  requires_deposit?: boolean
  deposit_type?: 'percentage' | 'fixed'
  deposit_value?: number
  deposit_amount?: number
  deposit_paid?: boolean
  deposit_invoice_token?: string | null
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  expires_at?: string | null
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  decline_reason?: string | null
  notes?: string | null
  signature_data?: string | null
  signed_by?: string | null
  signed_ip?: string | null
}

export default function CustomerQuotePage() {
  const params = useParams()
  const token = params?.token as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quote, setQuote] = useState<QuoteData | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [org, setOrg] = useState<any>(null)
  const [contact, setContact] = useState<any>(null)

  // Acceptance & Signature State
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw')
  const [hasDrawn, setHasDrawn] = useState(false)
  const [signatureData, setSignatureData] = useState<string>('')
  const [agreedToTerms, setAgreedToTerms] = useState(true)
  const [accepting, setAccepting] = useState(false)

  // Canvas ref & drawing tracking
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)

  // Decline Modal State
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declining, setDeclining] = useState(false)

  // Clarification Message State
  const [showQuestionBox, setShowQuestionBox] = useState(false)
  const [question, setQuestion] = useState('')
  const [sendingQuestion, setSendingQuestion] = useState(false)
  const [questionSent, setQuestionSent] = useState(false)

  const loadQuote = async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch(`/api/quote/${token}`)
      if (!res.ok) {
        setError('Quote not found or link has expired.')
        return
      }
      const data = await res.json()
      setQuote(data.quote)
      setItems(data.items || [])
      setOrg(data.organization)
      setContact(data.contact)
      if (data.contact?.name) setSignerName(data.contact.name)
    } catch {
      setError('Unable to load estimate details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQuote()
  }, [token])

  // Canvas Drawing Initializer & DPI Normalizer
  useEffect(() => {
    if (!showAcceptModal || signatureMode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set background to clean white for clear data URLs
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [showAcceptModal, signatureMode])

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    isDrawingRef.current = true
  }

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY

    ctx.lineTo(x, y)
    ctx.stroke()
    if (!hasDrawn) setHasDrawn(true)
  }

  const stopDrawing = () => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const canvas = canvasRef.current
    if (canvas) {
      setSignatureData(canvas.toDataURL('image/png'))
    }
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    setSignatureData('')
  }

  // Handle Accept with E-Signature
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!signerName.trim()) {
      toast.error('Please enter your full name.')
      return
    }

    if (!agreedToTerms) {
      toast.error('Please accept the electronic signature terms.')
      return
    }

    setAccepting(true)
    try {
      const res = await fetch(`/api/quote/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: signerName.trim(),
          signatureData: hasDrawn && signatureData ? signatureData : null
        })
      })
      const data = await res.json()
      if (res.ok) {
        setShowAcceptModal(false)
        if (data.requiresDeposit && data.depositInvoiceUrl) {
          toast.success('Estimate accepted! Proceeding to secure deposit payment...')
          window.location.href = data.depositInvoiceUrl
          return
        }
        toast.success('Quote approved! Work is scheduled and confirmed.')
        await loadQuote()
      } else {
        toast.error(data.error || 'Failed to accept quote.')
      }
    } catch {
      toast.error('Network error accepting quote.')
    } finally {
      setAccepting(false)
    }
  }

  // Handle Decline
  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault()
    setDeclining(true)
    try {
      const res = await fetch(`/api/quote/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: declineReason })
      })
      const data = await res.json()
      if (res.ok) {
        setShowDeclineModal(false)
        toast.success('Quote declined.')
        await loadQuote()
      } else {
        toast.error(data.error || 'Failed to decline quote.')
      }
    } catch {
      toast.error('Network error declining quote.')
    } finally {
      setDeclining(false)
    }
  }

  // Handle Clarification Question
  const handleSendQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return
    setSendingQuestion(true)
    try {
      const res = await fetch(`/api/quote/${token}/clarify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question })
      })
      if (res.ok) {
        setQuestionSent(true)
        setQuestion('')
        toast.success('Question sent to the contractor!')
        setTimeout(() => setQuestionSent(false), 5000)
      } else {
        toast.error('Failed to send question.')
      }
    } catch {
      toast.error('Network error sending question.')
    } finally {
      setSendingQuestion(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 dark:border-zinc-300 border-t-transparent" />
          <p className="text-xs text-slate-500 dark:text-zinc-400">Loading estimate details...</p>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-6 text-center space-y-4 shadow-xs">
          <AlertCircle className="h-10 w-10 text-red-500 dark:text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Quote Unavailable</h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400">{error || 'This estimate could not be found.'}</p>
        </div>
      </div>
    )
  }

  const isPending = ['draft', 'sent', 'viewed'].includes(quote.status)
  const isAccepted = quote.status === 'accepted'
  const isDeclined = quote.status === 'declined'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 py-8 px-4 sm:px-6 selection:bg-slate-900 selection:text-white dark:selection:bg-zinc-100 dark:selection:text-zinc-900">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Contractor Header & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Official Service Estimate
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-zinc-100 mt-0.5">
              {org?.name || 'Service Estimate'}
            </h1>
            {org?.phone && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mt-1">
                <Phone className="h-3 w-3 text-slate-700 dark:text-zinc-300" />
                <a href={`tel:${org.phone}`} className="hover:underline font-medium">{org.phone}</a>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                isAccepted
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
                  : isDeclined
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-700'
              }`}
            >
              {quote.status === 'accepted' ? 'Approved & Confirmed' : quote.status}
            </span>
          </div>
        </div>

        {/* Accepted Status & Official Verified E-Signature Certificate */}
        {isAccepted && (
          <div className="space-y-4">
            {/* Required Deposit Prompt if applicable */}
            {quote.requires_deposit && !quote.deposit_paid ? (
              <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-200 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs">
                    <span className="font-bold text-sm block text-amber-950 dark:text-amber-100">
                      Action Needed: Complete Upfront Deposit
                    </span>
                    <span className="text-amber-800 dark:text-amber-300 block mt-0.5 leading-relaxed">
                      Your estimate is signed and approved! To lock in your scheduled slot on the calendar and release project materials, please complete your deposit of <strong>${Number(quote.deposit_amount).toFixed(2)}</strong>.
                    </span>
                  </div>
                </div>
                {quote.deposit_invoice_token && (
                  <div className="pt-1">
                    <a
                      href={`/invoice/${quote.deposit_invoice_token}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs shadow-xs transition-all"
                    >
                      <DollarSign className="h-4 w-4" />
                      <span>Pay ${Number(quote.deposit_amount).toFixed(2)} Deposit Online</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            ) : null}

            {/* Verified Electronic Signature Certificate */}
            <div className="p-5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200 space-y-3.5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-200/80 dark:border-emerald-800/40">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-100">
                    Verified Electronic Signature Certificate
                  </span>
                </div>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  CERT-{quote.quote_number}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium block">
                    Authorized Electronic Signer:
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-zinc-100 block">
                    {quote.signed_by || signerName || contact?.name || 'Customer'}
                  </span>
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300/90 block">
                    Approved on {new Date(quote.accepted_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(quote.accepted_at || Date.now()).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                {quote.signature_data && (
                  <div className="bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-2 px-3 self-start sm:self-center shadow-2xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={quote.signature_data}
                      alt="Verified Signature"
                      className="max-h-12 w-auto object-contain dark:invert"
                    />
                  </div>
                )}
              </div>

              <p className="text-[10px] text-emerald-800/80 dark:text-emerald-400/80 pt-1 leading-relaxed border-t border-emerald-200/60 dark:border-emerald-800/30">
                Legally binding e-signature recorded and verified under the U.S. Electronic Signatures in Global and National Commerce Act (ESIGN) &amp; UETA.
              </p>
            </div>
          </div>
        )}

        {isDeclined && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-3">
            <XCircle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <div>
              <span className="font-bold text-sm block text-rose-900 dark:text-rose-200">Estimate Declined</span>
              <span>{quote.decline_reason ? `Reason: ${quote.decline_reason}` : 'This quote was declined.'}</span>
            </div>
          </div>
        )}

        {/* Quote Details Card */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-5 sm:p-6 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800 text-xs text-slate-500 dark:text-zinc-400">
            <div>
              <span className="font-bold text-slate-900 dark:text-white text-base block">{quote.title}</span>
              <span className="text-slate-500 dark:text-zinc-400 mt-0.5 block font-mono">Estimate #{quote.quote_number}</span>
            </div>
            <div className="space-y-1 sm:text-right">
              {contact?.name && (
                <div>
                  Prepared for: <strong className="text-slate-900 dark:text-zinc-100">{contact.name}</strong>
                </div>
              )}
              {quote.expires_at && (
                <div className="flex items-center sm:justify-end gap-1 text-slate-500 dark:text-zinc-400">
                  <Clock className="h-3 w-3 text-slate-400" />
                  <span>Valid through {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>

          {quote.description && (
            <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed bg-slate-50 dark:bg-zinc-850 p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800">
              {quote.description}
            </p>
          )}

          {/* Line Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Itemized Breakdown</h3>
            <div className="divide-y divide-slate-100 dark:divide-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-zinc-900/50">
              {items.map((it) => (
                <div key={it.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex-1">
                    <span className="font-bold text-slate-900 dark:text-white block">{it.description}</span>
                    <span className="text-slate-500 dark:text-zinc-400 text-[11px] font-mono">
                      {it.quantity} &times; ${Number(it.unit_price).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                    ${Number(it.total).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-zinc-800 text-xs">
            <div className="flex justify-between text-slate-500 dark:text-zinc-400">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200 font-mono">${Number(quote.subtotal).toFixed(2)}</span>
            </div>
            {Number(quote.discount) > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discount</span>
                <span className="font-mono">-${Number(quote.discount).toFixed(2)}</span>
              </div>
            )}
            {Number(quote.tax) > 0 && (
              <div className="flex justify-between text-slate-500 dark:text-zinc-400">
                <span>Estimated Tax</span>
                <span className="font-mono">${Number(quote.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-zinc-800">
              <span>Total Investment</span>
              <span className="text-slate-900 dark:text-zinc-100 font-mono">${Number(quote.total).toFixed(2)}</span>
            </div>

            {quote.requires_deposit && Number(quote.deposit_amount) > 0 && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-850 border border-slate-200 dark:border-zinc-750 space-y-1.5 text-xs">
                <div className="flex justify-between items-center font-bold text-slate-900 dark:text-zinc-100">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Required Upfront Deposit ({quote.deposit_type === 'percentage' ? `${quote.deposit_value}%` : 'Fixed'})</span>
                  </span>
                  <span className="text-sm font-mono">${Number(quote.deposit_amount).toFixed(2)}</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                  Due upon acceptance to secure your appointment and release project materials. Remaining balance (${(Number(quote.total) - Number(quote.deposit_amount)).toFixed(2)}) is due upon job completion.
                </p>
              </div>
            )}
          </div>

          {quote.notes && (
            <p className="text-[11px] text-slate-500 dark:text-zinc-400 italic pt-2 border-t border-slate-100 dark:border-zinc-800">
              Terms &amp; Warranty: {quote.notes}
            </p>
          )}
        </div>

        {/* Customer Action Buttons */}
        {isPending && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setShowAcceptModal(true)}
                className="flex-1 min-h-[48px] py-3 px-5 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
              >
                <PenTool className="h-4 w-4" />
                <span>
                  {quote.requires_deposit && Number(quote.deposit_amount) > 0
                    ? `Sign & Approve ($${Number(quote.deposit_amount).toFixed(2)} Deposit)`
                    : `Sign & Approve Estimate ($${Number(quote.total).toFixed(2)})`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeclineModal(true)}
                className="min-h-[48px] py-3 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <XCircle className="h-4 w-4" />
                <span>Decline</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowQuestionBox(!showQuestionBox)}
                className="text-xs text-slate-600 dark:text-zinc-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Have a question or need changes? Ask the contractor here</span>
              </button>
            </div>
          </div>
        )}

        {/* Question Submission Box */}
        {showQuestionBox && (
          <form onSubmit={handleSendQuestion} className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-4 space-y-3 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-slate-700 dark:text-zinc-300" />
              Ask a Question Regarding Estimate #{quote.quote_number}
            </h4>

            {questionSent && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                Your question has been sent! The contractor will respond directly.
              </p>
            )}

            <textarea
              rows={2}
              required
              placeholder="Type your question or request clarification..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs focus:outline-hidden focus:border-slate-500 resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuestionBox(false)}
                className="px-3 py-2 rounded-xl text-xs text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingQuestion}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="h-3 w-3" />
                <span>{sendingQuestion ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        )}

        {/* FINGER SIGNATURE ACCEPTANCE MODAL */}
        {showAcceptModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <form onSubmit={handleAccept} className="max-w-lg w-full rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-slate-900 dark:text-zinc-100">
                  <PenTool className="h-5 w-5" />
                  <h3 className="text-base font-bold">Approve Estimate #{quote.quote_number}</h3>
                </div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-zinc-100">
                  ${Number(quote.total).toFixed(2)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1">
                  Full Name (Legal Signer) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs focus:outline-hidden focus:border-slate-500 shadow-2xs"
                />
              </div>

              {/* Finger Signature Canvas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                    Finger or Stylus Signature
                  </label>
                  {hasDrawn && (
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-[11px] text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="relative rounded-xl border border-slate-200 dark:border-zinc-700 bg-white overflow-hidden shadow-2xs">
                  <canvas
                    ref={canvasRef}
                    width={450}
                    height={150}
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    className="w-full h-36 touch-none cursor-crosshair bg-white"
                  />
                  {!hasDrawn && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-400 select-none">
                      Draw signature here using finger or mouse
                    </div>
                  )}
                </div>
              </div>

              {/* Legal E-Sign Acknowledgement */}
              <label className="flex items-start gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-zinc-700 text-slate-900 h-4 w-4"
                />
                <span className="text-[11px] text-slate-600 dark:text-zinc-400 leading-relaxed">
                  I agree that this electronic signature is legally binding, and confirms authorization for <strong>{org?.name}</strong> to perform the services outlined for a total of <strong>${Number(quote.total).toFixed(2)}</strong>.
                </span>
              </label>

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accepting || !signerName.trim() || !agreedToTerms}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 disabled:opacity-50 text-white dark:text-zinc-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {accepting ? 'Signing...' : 'Authorize & Sign'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DECLINE MODAL */}
        {showDeclineModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <form onSubmit={handleDecline} className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <XCircle className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Decline Quote</h3>
              </div>

              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Please let us know why you're declining this estimate so we can adjust our proposal:
              </p>

              <textarea
                rows={3}
                placeholder="Price too high, project postponed, selected another provider, etc."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-white dark:bg-zinc-850 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-xs focus:outline-hidden focus:border-slate-500 resize-none shadow-2xs"
              />

              <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={declining}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  {declining ? 'Declining...' : 'Decline Quote'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="text-center text-[11px] text-slate-400 dark:text-zinc-500 flex items-center justify-center gap-1.5 pt-4">
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
          <span>Secure direct quote powered by CaptoDesk</span>
        </div>

      </div>
    </div>
  )
}
