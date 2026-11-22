'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, use, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useWorkspace } from '@/lib/context/workspace-context'
import { FoundMoneyUnlockModal } from '@/components/billing/found-money-unlock-modal'
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
  X,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Check,
  CheckCircle,
  Receipt,
  UserCheck,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCustomerName, formatStandardUsAddress, formatAsYouTypeUsPhone } from '@/lib/booking/customer-input-formatter'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { operationMode } = useWorkspace()
  const [showFoundMoneyModal, setShowFoundMoneyModal] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Active primary tab: 'timeline' | 'jobs' | 'billing' | 'property'
  const [activeTab, setActiveTab] = useState<'timeline' | 'jobs' | 'billing' | 'property'>('timeline')

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
          name: name.trim() ? formatCustomerName(name.trim()) : undefined,
          phone: phone.trim() ? formatAsYouTypeUsPhone(phone.trim()) : undefined,
          email: email.trim() || undefined,
          address: address.trim() ? formatStandardUsAddress(address.trim()) : undefined,
          notes: notes.trim() || undefined,
          tags,
          serviceFrequencyDays: Number(serviceFrequency) || 90
        })
      })
      if (res.ok) {
        toast.success('Customer details updated successfully')
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

  const handleAddTag = (tagToAdd?: string) => {
    const raw = tagToAdd || tagInput
    if (!raw.trim()) return
    const newTag = raw.trim()
    if (!tags.includes(newTag)) {
      setTags([...tags, newTag])
    }
    if (!tagToAdd) {
      setTagInput('')
    }
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
        if (res.status === 402 || data.upgradeRequired) {
          setShowFoundMoneyModal(true)
          return
        }
        toast.error(data.error || 'Failed to dispatch review invite')
      }
    } catch {
      toast.error('Network error dispatching invite.')
    } finally {
      setSendingReview(false)
    }
  }

  // Calculated Next Service Due Date and Days Remaining / Overdue
  const nextDueDate = useMemo(() => {
    if (!profile?.contact?.last_service_date) return null
    const last = new Date(profile.contact.last_service_date)
    const days = Number(serviceFrequency) || 90
    return new Date(last.getTime() + days * 24 * 60 * 60 * 1000)
  }, [profile?.contact?.last_service_date, serviceFrequency])

  const daysUntilDue = useMemo(() => {
    if (!nextDueDate) return null
    const now = new Date()
    return Math.ceil((nextDueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }, [nextDueDate])

  // Computed Financial Totals
  const { totalInvoiced, totalOutstanding } = useMemo(() => {
    const invoices = profile?.invoices || []
    let invoiced = 0
    let outstanding = 0
    for (const inv of invoices) {
      const tot = Number(inv.total) || 0
      invoiced += tot
      if (inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'void') {
        const due = inv.amount_due !== undefined && inv.amount_due !== null ? Number(inv.amount_due) : tot
        outstanding += due
      }
    }
    return { totalInvoiced: invoiced, totalOutstanding: outstanding }
  }, [profile?.invoices])

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
        <span className="text-xs text-slate-500 dark:text-zinc-400">Loading customer profile...</span>
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

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="w-3 h-3" />
            <span>Completed</span>
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            <span>In Progress</span>
          </span>
        )
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span>Cancelled</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Calendar className="w-3 h-3" />
            <span>Scheduled</span>
          </span>
        )
    }
  }

  const getInvoiceStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Check className="w-3 h-3" />
            <span>Paid</span>
          </span>
        )
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Overdue</span>
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            <span>Sent</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 capitalize">
            {status || 'Draft'}
          </span>
        )
    }
  }

  const getQuoteStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Check className="w-3 h-3" />
            <span>Accepted</span>
          </span>
        )
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <span>Declined</span>
          </span>
        )
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            <span>Sent</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 capitalize">
            {status || 'Draft'}
          </span>
        )
    }
  }

  const tabItems = [
    { 
      id: 'timeline', 
      label: 'Activity Timeline', 
      icon: Clock, 
      count: profile.timeline?.length || 0 
    },
    { 
      id: 'jobs', 
      label: 'Jobs & Bookings', 
      icon: Briefcase, 
      count: (profile.jobs?.length || 0) + (profile.appointments?.length || 0) 
    },
    { 
      id: 'billing', 
      label: 'Quotes & Billing', 
      icon: Receipt, 
      count: (profile.invoices?.length || 0) + (profile.quotes?.length || 0) 
    },
    { 
      id: 'property', 
      label: 'Property & Info', 
      icon: Wrench, 
      count: tags.length 
    }
  ]

  const commonTagPresets = [
    'VIP Customer',
    'HVAC Maintenance',
    'Plumbing',
    'Heat Pump',
    'Filter 20x25x4',
    'Commercial',
    'Annual Service Plan',
    'Senior Discount'
  ]

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
                {formatCustomerName(contact.name) || 'Customer'}
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
                  {formatNationalUs(contact.phone) || contact.phone}
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
                  <span>{formatStandardUsAddress(contact.address)}</span>
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

          {/* Truck Fast Action Rail (48px Min Touch Height on Mobile) */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 pt-2 lg:pt-0 w-full lg:w-auto">
            {contact.phone && (
              <>
                <a
                  href={`tel:${contact.phone}`}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
                >
                  <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Call</span>
                </a>

                <Link
                  href={`/client/inbox?contact=${contact.id}`}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>2-Way SMS</span>
                </Link>
              </>
            )}

            <Link
              href={`/client/jobs?new=true&customerId=${contact.id}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
            >
              <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              <span>Book Job</span>
            </Link>

            <Link
              href={`/client/quotes?new=true&customerId=${contact.id}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 transition-colors shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Estimate</span>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSendReviewInvite}
              disabled={sendingReview}
              className="col-span-2 sm:col-span-1 min-h-[48px] px-3.5 text-xs font-bold border-amber-300 dark:border-amber-700/60 bg-amber-50/50 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 text-amber-800 dark:text-amber-300 shadow-2xs"
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
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Verified paid revenue</p>
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
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">
            {nextDueDate ? 'Next Service Due' : 'Service Cadence'}
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-zinc-100 tabular-nums mt-1 truncate">
            {nextDueDate ? nextDueDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No prior jobs'}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
            {daysUntilDue !== null ? (
              daysUntilDue > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Due in {daysUntilDue} days</span>
              ) : daysUntilDue === 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">Due today</span>
              ) : (
                <span className="text-rose-600 dark:text-rose-400 font-medium">Overdue by {Math.abs(daysUntilDue)} days</span>
              )
            ) : (
              `Every ${contact.service_frequency_days || 90} days`
            )}
          </p>
        </div>
      </div>

      {/* Customer 360 Primary 4-Tab Bar (48px Touch Targets) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100 dark:bg-zinc-800/80 p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800">
        {tabItems.map(tab => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "min-h-[48px] px-3 py-2 inline-flex items-center justify-center sm:justify-start gap-2 rounded-xl text-xs font-bold transition-all",
                isActive
                  ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
              <span className="truncate">{tab.label}</span>
              <span className={cn(
                "ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-mono tabular-nums shrink-0 hidden sm:inline-block",
                isActive 
                  ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300" 
                  : "bg-slate-200/70 text-slate-500 dark:bg-zinc-700/60 dark:text-zinc-400"
              )}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* TAB 1: Unified Activity Timeline */}
      {activeTab === 'timeline' && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
          
          {/* Timeline Header & Sub-Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                Customer Activity &amp; Unified History
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
                    "min-h-[32px] px-3 py-1 text-xs font-semibold rounded-md transition-colors",
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

                      {item.type === 'invoice' && (
                        <div className="pt-1">
                          <Link
                            href={`/client/invoices`}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>View Invoices</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}

                      {item.type === 'quote' && (
                        <div className="pt-1">
                          <Link
                            href={`/client/quotes`}
                            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                          >
                            <span>View Estimates</span>
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
      )}

      {/* TAB 2: Field Jobs & Self-Service Bookings */}
      {activeTab === 'jobs' && (
        <div className="space-y-6">
          
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs">
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-purple-500" />
                <span>Field Service Jobs &amp; Bookings</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Complete log of dispatch assignments and self-service online appointments.
              </p>
            </div>
            <Link
              href={`/client/jobs?new=true&customerId=${contact.id}`}
              className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule New Job</span>
            </Link>
          </div>

          {/* Section 1: Field Jobs */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Dispatched Field Jobs ({profile.jobs?.length || 0})
              </h3>
            </div>

            {(!profile.jobs || profile.jobs.length === 0) ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No field jobs scheduled or completed for this customer yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.jobs.map((job: any) => (
                  <div
                    key={job.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-xs text-slate-900 dark:text-white">
                          {job.title || `Job #${job.id.slice(0, 8)}`}
                        </p>
                        {job.job_number && (
                          <p className="text-[11px] font-mono text-slate-400">
                            {job.job_number}
                          </p>
                        )}
                      </div>
                      {getJobStatusBadge(job.status)}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-1">
                      {job.scheduled_start && (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>
                            {new Date(job.scheduled_start).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      )}
                      {job.assigned_technician_name && (
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>Technician: {job.assigned_technician_name}</span>
                        </div>
                      )}
                    </div>

                    {job.job_items && job.job_items.length > 0 && (
                      <div className="text-[11px] bg-white dark:bg-zinc-900 p-2 rounded-lg border border-slate-200/70 dark:border-zinc-800/80 text-slate-600 dark:text-zinc-300">
                        <span className="font-medium text-slate-900 dark:text-white">Line Items: </span>
                        {job.job_items.map((it: any) => it.name || it.description).filter(Boolean).join(', ')}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-zinc-800">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-zinc-100">
                        ${Number(job.total_price || 0).toFixed(2)}
                      </span>
                      <Link
                        href={`/client/jobs?id=${job.id}`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open Job</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Bookings & Appointments */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Self-Service Online Bookings &amp; Appointments ({profile.appointments?.length || 0})
              </h3>
            </div>

            {(!profile.appointments || profile.appointments.length === 0) ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No self-service appointments booked yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.appointments.map((appt: any) => (
                  <div
                    key={appt.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-bold text-xs text-slate-900 dark:text-white">
                        {appt.services?.name || appt.service_name || 'Service Booking'}
                      </p>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 capitalize">
                        {appt.status || 'Confirmed'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-zinc-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {new Date(appt.start_time).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {appt.services?.duration_minutes && (
                        <p className="text-[11px] text-slate-400">
                          Est. Duration: {appt.services.duration_minutes} minutes
                        </p>
                      )}
                      {appt.notes && (
                        <p className="text-[11px] italic text-slate-600 dark:text-zinc-400 pt-1">
                          Notes: {appt.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 3: Quotes, Invoices & Payments */}
      {activeTab === 'billing' && (
        <div className="space-y-6">

          {/* Financial Summary Banner */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-500" />
                  <span>Financial Standing &amp; Billing Records</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Verified invoices, received payments, and active customer estimates.
                </p>
              </div>
              <Link
                href={`/client/quotes?new=true&customerId=${contact.id}`}
                className="inline-flex items-center justify-center gap-1.5 min-h-[48px] px-4 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Create Estimate</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">
                  Verified Paid LTV
                </p>
                <p className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                  ${Number(profile.lifetimeValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Total collected funds
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-600 dark:text-zinc-400">
                  Total Invoiced
                </p>
                <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1 tabular-nums">
                  ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                  Across all historical invoices
                </p>
              </div>

              <div className={cn(
                "p-3.5 rounded-xl border",
                totalOutstanding > 0 
                  ? "bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/50 text-amber-900 dark:text-amber-300"
                  : "bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
              )}>
                <p className="text-[11px] uppercase tracking-wider font-semibold">
                  Outstanding Balance
                </p>
                <p className="text-xl font-bold font-mono mt-1 tabular-nums">
                  ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10px] opacity-75 mt-0.5">
                  {totalOutstanding > 0 ? 'Pending customer payment' : 'No overdue invoices'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 1: Invoices */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Invoices ({profile.invoices?.length || 0})
              </h3>
            </div>

            {(!profile.invoices || profile.invoices.length === 0) ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No invoices created for this customer.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.invoices.map((inv: any) => (
                  <div
                    key={inv.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold font-mono text-xs text-slate-900 dark:text-white">
                          {inv.invoice_number || `INV-${inv.id.slice(0, 6)}`}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Issued: {new Date(inv.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {getInvoiceStatusBadge(inv.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 dark:text-zinc-400">Total:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        ${Number(inv.total || 0).toFixed(2)}
                      </span>
                    </div>

                    {inv.amount_due !== undefined && inv.amount_due !== null && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 dark:text-zinc-400">Balance Due:</span>
                        <span className={cn(
                          "font-mono font-bold",
                          Number(inv.amount_due) > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                        )}>
                          ${Number(inv.amount_due).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 flex justify-end">
                      <Link
                        href={`/client/invoices`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Manage Invoices</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Payments Received */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Payments Received ({profile.payments?.length || 0})
              </h3>
            </div>

            {(!profile.payments || profile.payments.length === 0) ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No payments recorded yet for this customer.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.payments.map((pay: any) => (
                  <div
                    key={pay.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        +${Number(pay.amount || 0).toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 capitalize">
                        {pay.payment_method ? pay.payment_method.replace('_', ' ') : 'Credit Card'}
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {new Date(pay.paid_at || pay.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle className="w-3 h-3" />
                      <span>{pay.payment_status || 'Succeeded'}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Quotes & Estimates */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="border-b border-slate-100 dark:border-zinc-800 pb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                Estimates &amp; Quotes ({profile.quotes?.length || 0})
              </h3>
            </div>

            {(!profile.quotes || profile.quotes.length === 0) ? (
              <div className="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
                No estimates or quotes created for this customer yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.quotes.map((q: any) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold font-mono text-xs text-slate-900 dark:text-white">
                          {q.quote_number || `EST-${q.id.slice(0, 6)}`}
                        </p>
                        {q.title && (
                          <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                            {q.title}
                          </p>
                        )}
                      </div>
                      {getQuoteStatusBadge(q.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-slate-500 dark:text-zinc-400">Quote Total:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">
                        ${Number(q.total || 0).toFixed(2)}
                      </span>
                    </div>

                    {q.valid_until && (
                      <p className="text-[11px] text-slate-400">
                        Valid until: {new Date(q.valid_until).toLocaleDateString()}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 flex justify-end">
                      <Link
                        href={`/client/quotes`}
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Manage Estimates</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: Property, Equipment & Contact Information */}
      {activeTab === 'property' && (
        <form onSubmit={handleSaveContact} className="border border-slate-200 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-xs">
          
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-blue-500" />
                <span>Property, Equipment &amp; Customer Profile</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Update customer contact info, gate codes, equipment specs, and reminder intervals.
              </p>
            </div>
          </div>

          {/* 10DLC Compliance & Messaging Opt-Out Status Badge */}
          <div className={cn(
            "p-4 rounded-xl border flex items-start gap-3",
            contact.opt_out
              ? "bg-rose-50/70 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50"
              : "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50"
          )}>
            {contact.opt_out ? (
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className={cn(
                "text-xs font-bold",
                contact.opt_out ? "text-rose-900 dark:text-rose-300" : "text-emerald-900 dark:text-emerald-300"
              )}>
                {contact.opt_out ? 'SMS Opted Out (STOP Received)' : 'SMS Subscribed & Active'}
              </p>
              <p className={cn(
                "text-[11px] leading-relaxed",
                contact.opt_out ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"
              )}>
                {contact.opt_out
                  ? 'Customer has opted out of SMS text communications. Outbound automated reminders and review links are suppressed for TCPA and 10DLC compliance.'
                  : 'Customer is opted in to receive SMS confirmations, on-the-way dispatch alerts, and Google review invites.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Customer Full Name */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Customer Full Name
              </Label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                onBlur={e => setName(formatCustomerName(e.target.value))}
                placeholder="e.g. John Smith"
                className="h-10 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
              />
            </div>

            {/* Cell Phone Number */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Cell Phone Number
              </Label>
              <Input
                value={phone}
                onChange={e => setPhone(formatAsYouTypeUsPhone(e.target.value))}
                onBlur={e => setPhone(formatAsYouTypeUsPhone(e.target.value))}
                placeholder="(555) 000-0000"
                className="h-10 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
            </div>

            {/* Email Address */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Email Address
              </Label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="h-10 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
              />
            </div>

            {/* Service Property Address */}
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
                    <span>View Map ↗</span>
                  </a>
                )}
              </div>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                onBlur={e => setAddress(formatStandardUsAddress(e.target.value))}
                placeholder="Street address, city, state, zip"
                className="h-10 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
              />
            </div>

            {/* Service Frequency Cadence */}
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Service Cadence Interval (Days)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={7}
                  value={serviceFrequency}
                  onChange={e => setServiceFrequency(parseInt(e.target.value, 10) || 90)}
                  className="h-10 w-36 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
                />
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  {nextDueDate ? (
                    <span>
                      Next automated service due on{' '}
                      <strong className="text-slate-800 dark:text-zinc-200 font-mono">
                        {nextDueDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </strong>{' '}
                      ({daysUntilDue !== null ? (daysUntilDue > 0 ? `${daysUntilDue} days remaining` : `Overdue by ${Math.abs(daysUntilDue)} days`) : ''})
                    </span>
                  ) : (
                    'Default is 90 days. Next due date will be calculated once first field job is completed.'
                  )}
                </span>
              </div>
            </div>

            {/* Customer Tags */}
            <div className="md:col-span-2 space-y-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block">
                Customer &amp; Equipment Tags
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type a tag and press Enter (e.g. VIP, Heat Pump, Filter Size)..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                  className="h-10 bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
                />
                <Button
                  type="button"
                  onClick={() => handleAddTag()}
                  variant="outline"
                  className="min-h-[40px] px-3.5 text-xs border-slate-200 dark:border-zinc-800 shrink-0 font-semibold"
                >
                  Add Tag
                </Button>
              </div>

              {/* Tag Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400 font-medium mr-1">Suggested:</span>
                {commonTagPresets.map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAddTag(preset)}
                    className="text-[11px] px-2 py-0.5 rounded-md border border-dashed border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              {/* Active Tags */}
              <div className="flex flex-wrap gap-1.5 min-h-[32px] pt-1">
                {tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 text-xs px-2.5 py-1 rounded-md font-semibold"
                  >
                    <Tag className="h-3 w-3 text-slate-400" />
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t)}
                      className="text-slate-400 hover:text-rose-500 ml-1 transition-colors"
                      title="Remove tag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Equipment, Gate Codes & Property Notes */}
            <div className="md:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1 block">
                Equipment Specs, Gate Codes &amp; Property Notes
              </Label>
              <textarea
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Carrier 4-ton AC in attic (Filter 20x25x4), gate code #5921, beware of dog in back yard."
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed resize-none"
              />
            </div>

          </div>

          {/* Save Button (48px Height) */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto min-h-[48px] px-6 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-xs"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  <span>Save Customer Profile</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Found Money Finish-Line Paywall Modal */}
      <FoundMoneyUnlockModal
        isOpen={showFoundMoneyModal}
        onClose={() => setShowFoundMoneyModal(false)}
        customerName={profile?.contact?.name || 'Customer'}
        amountDue={250}
        operationMode={operationMode === 'multi_crew' ? 'multi_crew' : 'solo'}
        onSuccess={loadProfile}
      />

    </div>
  )
}
