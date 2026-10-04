'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  DollarSign
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
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired'
  expires_at?: string | null
  sent_at?: string | null
  viewed_at?: string | null
  accepted_at?: string | null
  declined_at?: string | null
  decline_reason?: string | null
  notes?: string | null
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

  // Modals / Actions
  const [showAcceptModal, setShowAcceptModal] = useState(false)
  const [signerName, setSignerName] = useState('')
  const [accepting, setAccepting] = useState(false)

  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [declining, setDeclining] = useState(false)

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

  // Handle Accept
  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccepting(true)
    try {
      const res = await fetch(`/api/quote/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: signerName })
      })
      const data = await res.json()
      if (res.ok) {
        setShowAcceptModal(false)
        await loadQuote()
      } else {
        alert(data.error || 'Failed to accept quote.')
      }
    } catch {
      alert('Network error accepting quote.')
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
        await loadQuote()
      } else {
        alert(data.error || 'Failed to decline quote.')
      }
    } catch {
      alert('Network error declining quote.')
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
        setTimeout(() => setQuestionSent(false), 5000)
      } else {
        alert('Failed to send question.')
      }
    } catch {
      alert('Network error sending question.')
    } finally {
      setSendingQuestion(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060911] text-zinc-200 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-xs text-zinc-400">Loading estimate details...</p>
        </div>
      </div>
    )
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-[#060911] text-zinc-200 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0D1322] border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-white">Quote Unavailable</h1>
          <p className="text-sm text-zinc-400">{error || 'This estimate could not be found.'}</p>
        </div>
      </div>
    )
  }

  const isPending = ['draft', 'sent', 'viewed'].includes(quote.status)
  const isAccepted = quote.status === 'accepted'
  const isDeclined = quote.status === 'declined'

  return (
    <div className="min-h-screen bg-[#060911] text-zinc-100 py-8 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Business Header & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-zinc-800">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
              Official Estimate
            </div>
            <h1 className="text-2xl font-black text-white mt-0.5">
              {org?.name || 'Service Estimate'}
            </h1>
            {org?.phone && (
              <p className="text-xs text-zinc-400 flex items-center gap-1.5 mt-1">
                <Phone className="h-3 w-3 text-blue-400" />
                <a href={`tel:${org.phone}`} className="hover:underline">{org.phone}</a>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
              isAccepted
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isDeclined
                ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
            }`}>
              {quote.status}
            </span>
          </div>
        </div>

        {/* Status Notification Banner */}
        {isAccepted && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <span className="font-bold text-sm block">Estimate Accepted</span>
              <span>Thank you! Your quote has been accepted and confirmed with {org?.name}.</span>
            </div>
          </div>
        )}

        {isDeclined && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
            <XCircle className="h-5 w-5 shrink-0 text-red-400" />
            <div>
              <span className="font-bold text-sm block">Estimate Declined</span>
              <span>{quote.decline_reason ? `Reason: ${quote.decline_reason}` : 'This quote was declined.'}</span>
            </div>
          </div>
        )}

        {/* Quote Details Card */}
        <div className="rounded-2xl bg-[#0D1322] border border-zinc-800 p-5 sm:p-6 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 text-xs text-zinc-400">
            <div>
              <span className="font-bold text-white text-base block">{quote.title}</span>
              <span className="text-zinc-400 mt-0.5 block">Quote #{quote.quote_number}</span>
            </div>
            <div className="space-y-1 sm:text-right">
              {contact?.name && <div>Prepared for: <strong className="text-zinc-200">{contact.name}</strong></div>}
              {quote.expires_at && (
                <div className="flex items-center sm:justify-end gap-1 text-zinc-400">
                  <Clock className="h-3 w-3 text-amber-400" />
                  <span>Valid through {new Date(quote.expires_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>
          </div>

          {quote.description && (
            <p className="text-xs text-zinc-300 leading-relaxed bg-[#0B0F19] p-3.5 rounded-xl border border-zinc-800/80">
              {quote.description}
            </p>
          )}

          {/* Line Items Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Itemized Breakdown</h3>
            <div className="divide-y divide-zinc-800/80 border border-zinc-800/80 rounded-xl overflow-hidden bg-[#0B0F19]">
              {items.map((it) => (
                <div key={it.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="flex-1">
                    <span className="font-bold text-white block">{it.description}</span>
                    <span className="text-zinc-400 text-[11px]">
                      {it.quantity} × ${Number(it.unit_price).toFixed(2)}
                    </span>
                  </div>
                  <span className="font-extrabold text-white text-sm">
                    ${Number(it.total).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Totals */}
          <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs">
            <div className="flex justify-between text-zinc-400">
              <span>Subtotal</span>
              <span className="font-semibold text-zinc-200">${Number(quote.subtotal).toFixed(2)}</span>
            </div>
            {Number(quote.discount) > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount</span>
                <span>-${Number(quote.discount).toFixed(2)}</span>
              </div>
            )}
            {Number(quote.tax) > 0 && (
              <div className="flex justify-between text-zinc-400">
                <span>Estimated Tax</span>
                <span>${Number(quote.tax).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-white pt-2 border-t border-zinc-800/80">
              <span>Total Investment</span>
              <span className="text-emerald-400">${Number(quote.total).toFixed(2)}</span>
            </div>
          </div>

          {quote.notes && (
            <p className="text-[11px] text-zinc-500 italic pt-2">
              Terms & Notes: {quote.notes}
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
                className="flex-1 py-3.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Accept Estimate (${Number(quote.total).toFixed(2)})</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDeclineModal(true)}
                className="py-3.5 px-4 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <XCircle className="h-4 w-4" />
                <span>Decline</span>
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowQuestionBox(!showQuestionBox)}
                className="text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Have a question or need changes? Ask here</span>
              </button>
            </div>
          </div>
        )}

        {/* Question Submission Box */}
        {showQuestionBox && (
          <form onSubmit={handleSendQuestion} className="rounded-2xl bg-[#0D1322] border border-blue-500/30 p-4 space-y-3 shadow-xl">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              Ask a Question Regarding Quote #{quote.quote_number}
            </h4>

            {questionSent && (
              <p className="text-xs text-emerald-400">
                Your question has been dispatched! We will reply promptly.
              </p>
            )}

            <textarea
              rows={2}
              required
              placeholder="Type your question or request clarification..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0B0F19] border border-zinc-800 text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowQuestionBox(false)}
                className="px-3 py-2 rounded-xl text-xs text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingQuestion}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5"
              >
                <Send className="h-3 w-3" />
                <span>{sendingQuestion ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ACCEPT MODAL */}
        {showAcceptModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleAccept} className="max-w-md w-full rounded-2xl bg-[#0D1322] border border-emerald-500/40 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Accept Quote #{quote.quote_number}</h3>
              </div>

              <p className="text-xs text-zinc-400 leading-relaxed">
                By entering your name below and clicking confirm, you authorize {org?.name} to proceed with the services outlined in this quote for the total of <strong>${Number(quote.total).toFixed(2)}</strong>.
              </p>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">
                  Full Name (Electronic Signature)
                </label>
                <input
                  type="text"
                  required
                  placeholder="Your Full Name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accepting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  {accepting ? 'Confirming...' : 'Authorize & Accept'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* DECLINE MODAL */}
        {showDeclineModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleDecline} className="max-w-md w-full rounded-2xl bg-[#0D1322] border border-red-500/40 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="h-5 w-5" />
                <h3 className="text-base font-bold text-white">Decline Quote</h3>
              </div>

              <p className="text-xs text-zinc-400">
                Please let us know why you're declining this estimate so we can adjust our proposal:
              </p>

              <textarea
                rows={3}
                placeholder="Price too high, project postponed, selected another provider, etc."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#0B0F19] border border-zinc-800 text-white text-xs focus:outline-none focus:border-red-500 resize-none"
              />

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeclineModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-800 text-xs font-semibold text-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={declining}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                >
                  {declining ? 'Declining...' : 'Decline Quote'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="text-center text-[11px] text-zinc-500 flex items-center justify-center gap-1.5 pt-4">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-400" />
          <span>Secure direct quote powered by CaptoDesk</span>
        </div>

      </div>
    </div>
  )
}
