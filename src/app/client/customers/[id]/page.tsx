'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  ArrowLeft,
  Users, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard, 
  Briefcase, 
  FileText, 
  Star, 
  MessageSquare, 
  CheckCircle2, 
  AlertCircle, 
  Tag, 
  Save, 
  Loader2, 
  ExternalLink, 
  DollarSign,
  ChevronRight,
  Plus,
  Wrench,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // History timeline filter: 'all' | 'jobs' | 'money' | 'comms'
  const [historyFilter, setHistoryFilter] = useState<'all' | 'jobs' | 'money' | 'comms'>('all')

  // Editable CRM contact fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [serviceFrequency, setServiceFrequency] = useState(90)
  const [saving, setSaving] = useState(false)
  const [sendingReview, setSendingReview] = useState(false)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/client/customers/${id}`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        const c = data.contact || {}
        setName(c.name || '')
        setPhone(c.phone || '')
        setEmail(c.email || '')
        setAddress(c.address || '')
        setNotes(c.notes || '')
        setTags(c.tags || [])
        setServiceFrequency(c.service_frequency_days || 90)
      } else {
        if (res.status === 403) {
          const err = await res.json().catch(() => ({}))
          if (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization')) {
            window.location.href = '/client/onboarding'
            return
          }
        }
        toast.error('Customer not found')
        router.push('/client/customers')
      }
    } catch {
      toast.error('Error loading customer profile')
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/client/customers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          address: address.trim() || undefined,
          notes: notes.trim() || undefined,
          tags,
          serviceFrequencyDays: Number(serviceFrequency) || 90
        })
      })
      if (res.ok) {
        toast.success('Customer dossier updated successfully')
        loadProfile()
      } else {
        toast.error('Failed to update customer details')
      }
    } catch {
      toast.error('Network error updating profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTag = () => {
    if (!tagInput.trim()) return
    const newTag = tagInput.trim()
    if (!tags.includes(newTag)) {
      setTags([...tags, newTag])
    }
    setTagInput('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  const handleSendReviewInvite = async () => {
    if (!profile?.contact?.phone) {
      toast.error('No valid phone number for this customer.')
      return
    }
    setSendingReview(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: profile?.contact?.name || 'Customer', 
          phone: profile?.contact?.phone 
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Google Review invite sent to ${profile?.contact?.name || profile?.contact?.phone}`)
        loadProfile()
      } else {
        toast.error(data.error || 'Failed to dispatch review invite')
      }
    } catch {
      toast.error('Network error dispatching invite.')
    } finally {
      setSendingReview(false)
    }
  }

  // Filtered timeline based on active sub-pill
  const filteredTimeline = useMemo(() => {
    const list = profile?.timeline || []
    if (historyFilter === 'jobs') {
      return list.filter((item: any) => item.type === 'job' || item.type === 'appointment')
    }
    if (historyFilter === 'money') {
      return list.filter((item: any) => item.type === 'invoice' || item.type === 'quote' || item.type === 'payment')
    }
    if (historyFilter === 'comms') {
      return list.filter((item: any) => item.type === 'call' || item.type === 'message' || item.type === 'review_request')
    }
    return list
  }, [profile?.timeline, historyFilter])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="text-xs text-slate-500 dark:text-zinc-400">Loading homeowner dossier...</span>
      </div>
    )
  }

  if (!profile) return null

  const contact = profile.contact || {}

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active Relationship</span>
          </span>
        )
      case 'due':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Service Due</span>
          </span>
        )
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Overdue for Service</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
            Inactive
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">

      {/* Top Breadcrumb Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
        <Link
          href="/client/customers"
          className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Customer Directory</span>
        </Link>
      </div>

      {/* Customer Header & Truck Quick Actions (48px Touch Targets) */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Identity & Contact Badges */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {contact.name || 'Customer'}
              </h1>
              {getStatusBadge(profile.lifecycleStatus || 'active')}
              {profile.leadSource && (
                <span className="text-[11px] bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:border-zinc-800 px-2 py-0.5 rounded-md capitalize font-medium">
                  Source: {profile.leadSource.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-zinc-400 pt-1">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-200 font-mono">
                <Phone className="h-3.5 w-3.5 text-blue-500" />
                <a href={`tel:${contact.phone}`} className="hover:text-blue-600 font-bold tabular-nums">
                  {contact.phone}
                </a>
              </span>

              {contact.email && (
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                    {contact.email}
                  </a>
                </span>
              )}

              {contact.address && (
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-zinc-200">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  <span>{contact.address}</span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center ml-0.5"
                    title="Open address in Google Maps"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </span>
              )}
            </div>
          </div>

          {/* Truck Fast Action Rail (48px Touch Height on Mobile) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0">
            {contact.phone && (
              <>
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Call</span>
                </a>

                <Link
                  href={`/client/inbox?contact=${contact.id}`}
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>2-Way SMS</span>
                </Link>
              </>
            )}

            <Link
              href={`/client/jobs?new=true&customerId=${contact.id}`}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
            >
              <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Book Job</span>
            </Link>

            <Link
              href={`/client/quotes?new=true&customerId=${contact.id}`}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Estimate</span>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSendReviewInvite}
              disabled={sendingReview}
              className="h-10 px-3.5 text-xs font-bold border-amber-300 dark:border-amber-700/60 bg-amber-50/50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 shadow-2xs"
            >
              {sendingReview ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Star className="h-3.5 w-3.5 mr-1.5 text-amber-500 fill-amber-500" />
              )}
              <span>Send Review Link</span>
            </Button>
          </div>

        </div>
      </div>

      {/* 4 Financial & Operational Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs rounded-xl p-3.5">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Lifetime Value</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
            ${Number(profile.lifetimeValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Paid invoices &amp; jobs</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs rounded-xl p-3.5">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Completed Field Jobs</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {profile.stats?.completedJobs || 0} <span className="text-xs font-normal text-slate-400">/ {profile.stats?.totalJobs || 0} total</span>
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Service history</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs rounded-xl p-3.5">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Billing Records</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {profile.stats?.totalInvoices || 0} <span className="text-xs font-normal text-slate-400">invoices ({profile.stats?.totalQuotes || 0} quotes)</span>
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Financial records</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-xs rounded-xl p-3.5">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Service Cadence</p>
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 tabular-nums mt-1 truncate">
            {contact.last_service_date ? new Date(contact.last_service_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No prior jobs'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Recurrence every {contact.service_frequency_days || 90}d</p>
        </div>
      </div>

      {/* Split Layout: Main Medical Chart (7 cols) + Property Dossier (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Unified Chronological Timeline (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
            
            {/* Timeline Header & Sub-Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  Customer Medical Chart &amp; Activity
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Chronological unified feed of dispatches, calls, quotes, invoices, and payments.
                </p>
              </div>

              {/* History Sub-Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'jobs', label: 'Jobs' },
                  { id: 'money', label: 'Money' },
                  { id: 'comms', label: 'Comms' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryFilter(tab.id as any)}
                    className={cn(
                      "px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors",
                      historyFilter === tab.id
                        ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-2xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Stream */}
            {filteredTimeline.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No events recorded for this filter category.
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-zinc-800">
                {filteredTimeline.map((item: any) => {
                  const eventIcons: Record<string, any> = {
                    call: Phone,
                    message: MessageSquare,
                    quote: FileText,
                    appointment: Calendar,
                    job: Briefcase,
                    invoice: CreditCard,
                    payment: DollarSign,
                    review_request: Star
                  }
                  const Icon = eventIcons[item.type] || Clock

                  return (
                    <div key={item.id} className="relative group">
                      <div className="absolute -left-6 top-1 h-5 w-5 rounded-full flex items-center justify-center bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 shadow-2xs">
                        <Icon className="h-2.5 w-2.5" />
                      </div>

                      <div className="bg-slate-50/70 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 rounded-xl p-3.5 ml-2 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors space-y-1">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                            {item.title}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono tabular-nums">
                            {new Date(item.timestamp).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>

                        {item.description && (
                          <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {/* Direct Record Deep Links */}
                        {item.type === 'job' && item.metadata?.job_id && (
                          <div className="pt-1">
                            <Link
                              href={`/client/jobs?id=${item.metadata.job_id}`}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>View Field Job</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}

                        {item.type === 'invoice' && item.metadata?.invoice_id && (
                          <div className="pt-1">
                            <Link
                              href={`/client/invoices`}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>View Invoice</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}

                        {item.type === 'quote' && item.metadata?.quote_id && (
                          <div className="pt-1">
                            <Link
                              href={`/client/quotes`}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                            >
                              <span>View Estimate</span>
                              <ChevronRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Property Dossier, Equipment & Notes (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <form onSubmit={handleSaveContact} className="border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-500" />
                <span>Property &amp; Equipment Dossier</span>
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Customer Full Name
                </Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="h-9 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Cell Phone Number
                </Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="h-9 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Email Address
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-9 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                    Service Property Address
                  </Label>
                  {address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Map ↗</span>
                    </a>
                  )}
                </div>
                <Input
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street address, city, state, zip"
                  className="h-9 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Service Frequency Cadence (Days)
                </Label>
                <Input
                  type="number"
                  min={7}
                  value={serviceFrequency}
                  onChange={e => setServiceFrequency(parseInt(e.target.value, 10) || 90)}
                  className="h-9 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
                />
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Interval for automated seasonal maintenance alerts (default: 90 days).
                </p>
              </div>

              {/* Tags Section */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Customer &amp; Trade Tags
                </Label>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    placeholder="e.g. VIP, Heat Pump, Commercial..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                    className="h-8.5 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
                  />
                  <Button
                    type="button"
                    onClick={handleAddTag}
                    variant="outline"
                    size="sm"
                    className="h-8.5 text-xs border-slate-200 dark:border-zinc-800 shrink-0 font-semibold"
                  >
                    Add Tag
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                  {tags.map(t => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs px-2.5 py-0.5 rounded-md font-semibold"
                    >
                      <Tag className="h-3 w-3 text-slate-400" />
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(t)}
                        className="text-slate-400 hover:text-rose-500 ml-1 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Equipment Notes */}
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                  Equipment, Gate Codes &amp; Property Notes
                </Label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Carrier 4-ton AC in attic (Filter 20x25x4), gate code #5921, watch out for dog."
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
                />
              </div>

            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-11 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    <span>Save Customer Profile</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>

      </div>

    </div>
  )
}
