'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, use } from 'react'
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
  HelpCircle,
  Tag,
  Save,
  Send,
  Loader2,
  ExternalLink,
  DollarSign
} from 'lucide-react'

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'timeline' | 'jobs' | 'quotes_invoices' | 'notes'>('timeline')

  // Editable fields
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [serviceFrequency, setServiceFrequency] = useState(90)
  const [saving, setSaving] = useState(false)

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
          name,
          phone,
          email,
          address,
          notes,
          tags,
          serviceFrequencyDays: Number(serviceFrequency)
        })
      })
      if (res.ok) {
        toast.success('Customer details updated!')
        loadProfile()
      } else {
        toast.error('Failed to update customer details')
      }
    } catch {
      toast.error('Network error')
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

  const sendReviewQuick = async () => {
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: profile?.contact?.name || 'Customer', phone: profile?.contact?.phone }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Review invite dispatched!')
        loadProfile()
      } else {
        toast.error(data.error || 'Failed to send review invite')
      }
    } catch {
      toast.error('Network error')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!profile) return null

  const contact = profile.contact || {}
  const statusPills: Record<string, { label: string; class: string; icon: any }> = {
    active: { label: 'Active', class: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
    due: { label: 'Service Due', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: Clock },
    overdue: { label: 'Overdue', class: 'bg-red-500/10 text-red-400 border-red-500/20', icon: AlertCircle },
    inactive: { label: 'Inactive', class: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20', icon: HelpCircle }
  }
  const statusInfo = statusPills[profile.lifecycleStatus] || statusPills.active
  const StatusIcon = statusInfo.icon

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/client/customers"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={sendReviewQuick}
            className="border-zinc-800 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 text-xs"
          >
            <Star className="h-3.5 w-3.5 mr-1 fill-amber-400" />
            Send Review Link
          </Button>
          <Link href="/client/inbox">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Open in Inbox
            </Button>
          </Link>
        </div>
      </div>

      {/* Customer 360 Header Profile Card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                {contact.name || 'Valued Customer'}
              </h1>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.class}`}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusInfo.label}
              </span>
              {profile.leadSource && (
                <span className="text-[11px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full capitalize">
                  Source: {profile.leadSource.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5 text-blue-400" />
                <a href={`tel:${contact.phone}`} className="hover:text-blue-400">{contact.phone}</a>
              </span>
              {contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5 text-zinc-400" />
                  <a href={`mailto:${contact.email}`} className="hover:text-blue-400">{contact.email}</a>
                </span>
              )}
              {contact.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                  <span>{contact.address}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick LTV display */}
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl px-4 py-3 min-w-[140px] text-right">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Lifetime Value</div>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">
              ${Number(profile.lifetimeValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Completed Jobs</span>
            <Briefcase className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {profile.stats?.completedJobs} <span className="text-xs font-normal text-zinc-500">/ {profile.stats?.totalJobs} total</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Invoices & Quotes</span>
            <FileText className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {profile.stats?.totalInvoices} <span className="text-xs font-normal text-zinc-500">invoices ({profile.stats?.totalQuotes} quotes)</span>
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Last Service Date</span>
            <Calendar className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            {contact.last_service_date ? new Date(contact.last_service_date).toLocaleDateString() : 'No completed jobs'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Every {contact.service_frequency_days || 90} days</div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4">
          <div className="flex items-center justify-between text-zinc-400 text-xs">
            <span>Next Expected Service</span>
            <Clock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-sm font-semibold text-white">
            {contact.next_expected_service_date ? new Date(contact.next_expected_service_date).toLocaleDateString() : '-'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">Automated reactivation enabled</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 text-sm font-medium">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Customer Timeline ({profile.timeline?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'jobs'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Jobs & Bookings ({profile.jobs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('quotes_invoices')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'quotes_invoices'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Quotes & Invoices ({profile.invoices?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 px-1 border-b-2 transition-colors ${
            activeTab === 'notes'
              ? 'border-blue-500 text-white font-semibold'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          CRM Notes & Details
        </button>
      </div>

      {/* Tab 1: Dynamic Chronological Timeline */}
      {activeTab === 'timeline' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
          <div className="mb-4">
            <h3 className="font-bold text-white text-base">Interaction & Service Timeline</h3>
            <p className="text-zinc-400 text-xs">
              Chronological log synthesized dynamically from real calls, SMS messages, estimates, field jobs, and payments.
            </p>
          </div>

          {profile.timeline?.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-sm">No historical events recorded for this customer yet.</div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
              {profile.timeline.map((item: any) => {
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

                const iconColors: Record<string, string> = {
                  call: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  message: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                  quote: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                  appointment: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
                  job: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                  invoice: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
                  payment: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  review_request: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }

                return (
                  <div key={item.id} className="relative group">
                    {/* Bullet marker */}
                    <div className={`absolute -left-6 top-1 h-5 w-5 rounded-full flex items-center justify-center border ${iconColors[item.type] || 'text-zinc-400 bg-zinc-800 border-zinc-700'}`}>
                      <Icon className="h-2.5 w-2.5" />
                    </div>

                    <div className="bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-3.5 ml-2 hover:border-zinc-700 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-semibold text-sm text-white">{item.title}</span>
                        <span className="text-[11px] text-zinc-500">
                          {new Date(item.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-zinc-400 mt-1">{item.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Jobs & Appointments */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
            <h3 className="font-bold text-white text-sm mb-3">Field Service Jobs</h3>
            {profile.jobs?.length === 0 ? (
              <p className="text-zinc-500 text-xs">No jobs on record for this customer.</p>
            ) : (
              <div className="space-y-2">
                {profile.jobs.map((j: any) => (
                  <div key={j.id} className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-white">{j.job_number} - {j.title}</div>
                      <div className="text-xs text-zinc-500">{new Date(j.created_at).toLocaleDateString()}</div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {j.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Quotes & Invoices */}
      {activeTab === 'quotes_invoices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
            <h3 className="font-bold text-white text-sm mb-3">Invoices & Payments</h3>
            {profile.invoices?.length === 0 ? (
              <p className="text-zinc-500 text-xs">No invoices created.</p>
            ) : (
              <div className="space-y-2">
                {profile.invoices.map((inv: any) => (
                  <div key={inv.id} className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-white">{inv.invoice_number}</div>
                      <div className="text-xs text-zinc-500">$${inv.total} (Due: $${inv.amount_due})</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-zinc-800 text-zinc-300">
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
            <h3 className="font-bold text-white text-sm mb-3">Quotes & Estimates</h3>
            {profile.quotes?.length === 0 ? (
              <p className="text-zinc-500 text-xs">No estimates created.</p>
            ) : (
              <div className="space-y-2">
                {profile.quotes.map((q: any) => (
                  <div key={q.id} className="bg-zinc-950/80 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm text-white">{q.quote_number} - {q.title}</div>
                      <div className="text-xs text-zinc-500">Total: $${q.total}</div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {q.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: CRM Notes & Details */}
      {activeTab === 'notes' && (
        <form onSubmit={handleSaveContact} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Customer Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="bg-zinc-950 border-zinc-800" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Phone Number</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="bg-zinc-950 border-zinc-800" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Email Address</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} className="bg-zinc-950 border-zinc-800" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-300">Service Frequency (Days)</Label>
              <Input
                type="number"
                min={7}
                value={serviceFrequency}
                onChange={e => setServiceFrequency(parseInt(e.target.value) || 90)}
                className="bg-zinc-950 border-zinc-800"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-zinc-300">Service Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} className="bg-zinc-950 border-zinc-800" />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-zinc-300">Customer Tags</Label>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  placeholder="Add a tag (e.g. VIP, Residential, Commercial)..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                  className="bg-zinc-950 border-zinc-800 text-sm"
                />
                <Button type="button" onClick={handleAddTag} variant="outline" className="border-zinc-800 text-xs">
                  Add Tag
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-200 text-xs px-2.5 py-1 rounded-full">
                    <Tag className="h-3 w-3 text-blue-400" />
                    {t}
                    <button type="button" onClick={() => handleRemoveTag(t)} className="text-zinc-500 hover:text-white ml-1">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-zinc-300">CRM Relationship Notes</Label>
              <textarea
                rows={4}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Important gate codes, preferences, pets, or service history..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
