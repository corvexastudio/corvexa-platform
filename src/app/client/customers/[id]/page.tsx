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
  Loader2, 
  ExternalLink, 
  DollarSign,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

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
        toast.success('Customer details updated')
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
        toast.success('Review invite sent')
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!profile) return null

  const contact = profile.contact || {}

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Active
          </span>
        )
      case 'due':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Service Due
          </span>
        )
      case 'overdue':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Overdue
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            Inactive
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">

      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <Link
          href="/client/customers"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Customers</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={sendReviewQuick}
            className="h-8 text-xs border-zinc-800 bg-zinc-900 text-amber-400 hover:bg-zinc-800"
          >
            <Star className="h-3.5 w-3.5 mr-1" />
            <span>Send Review Link</span>
          </Button>
          <Link href="/client/inbox">
            <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              <span>Inbox</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Profile Overview Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {contact.name || 'Customer'}
              </h1>
              {getStatusBadge(profile.lifecycleStatus || 'active')}
              {profile.leadSource && (
                <span className="text-[11px] bg-zinc-950 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded capitalize">
                  {profile.leadSource.replace('_', ' ')}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 pt-1">
              <span className="flex items-center gap-1 text-zinc-300">
                <Phone className="h-3.5 w-3.5 text-zinc-500" />
                <a href={`tel:${contact.phone}`} className="hover:text-blue-400">{contact.phone}</a>
              </span>
              {contact.email && (
                <span className="flex items-center gap-1 text-zinc-300">
                  <Mail className="h-3.5 w-3.5 text-zinc-500" />
                  <a href={`mailto:${contact.email}`} className="hover:text-blue-400">{contact.email}</a>
                </span>
              )}
              {contact.address && (
                <span className="flex items-center gap-1 text-zinc-300">
                  <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                  <span>{contact.address}</span>
                </span>
              )}
            </div>
          </div>

          {/* Lifetime Value Box */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-md px-4 py-2.5 md:text-right shrink-0">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Lifetime Value</div>
            <div className="text-xl font-bold text-emerald-400 tabular-nums mt-0.5">
              ${Number(profile.lifetimeValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Completed Jobs</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">
            {profile.stats?.completedJobs} <span className="text-xs font-normal text-zinc-500">/ {profile.stats?.totalJobs} total</span>
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Billing Records</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">
            {profile.stats?.totalInvoices} <span className="text-xs font-normal text-zinc-500">invoices ({profile.stats?.totalQuotes} quotes)</span>
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Last Service</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums mt-1">
            {contact.last_service_date ? new Date(contact.last_service_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No prior jobs'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Every {contact.service_frequency_days || 90} days</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Next Expected Service</p>
          <p className="text-sm font-semibold text-zinc-100 tabular-nums mt-1">
            {contact.next_expected_service_date ? new Date(contact.next_expected_service_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Automated reactivation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('timeline')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition-colors",
            activeTab === 'timeline'
              ? "border-blue-500 text-white font-semibold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          Timeline ({profile.timeline?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition-colors",
            activeTab === 'jobs'
              ? "border-blue-500 text-white font-semibold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          Jobs ({profile.jobs?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('quotes_invoices')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition-colors",
            activeTab === 'quotes_invoices'
              ? "border-blue-500 text-white font-semibold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          Quotes & Invoices ({profile.invoices?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={cn(
            "pb-2.5 px-3 border-b-2 transition-colors",
            activeTab === 'notes'
              ? "border-blue-500 text-white font-semibold"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          )}
        >
          Details & Notes
        </button>
      </div>

      {/* Tab 1: Chronological Timeline */}
      {activeTab === 'timeline' && (
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 p-5">
          <div className="mb-4">
            <h2 className="font-semibold text-xs text-zinc-200 uppercase tracking-wider">Activity Timeline</h2>
            <p className="text-zinc-500 text-xs mt-0.5">
              Call logs, SMS messages, estimates, dispatches, and payment events.
            </p>
          </div>

          {profile.timeline?.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No historical activity recorded yet.</div>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-zinc-800">
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

                return (
                  <div key={item.id} className="relative group">
                    <div className="absolute -left-6 top-1 h-5 w-5 rounded-full flex items-center justify-center bg-zinc-950 border border-zinc-800 text-zinc-400">
                      <Icon className="h-2.5 w-2.5" />
                    </div>

                    <div className="bg-zinc-950 border border-zinc-800/80 rounded-md p-3 ml-2 hover:border-zinc-700 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="font-medium text-xs text-zinc-100">{item.title}</span>
                        <span className="text-[11px] text-zinc-500 tabular-nums">
                          {new Date(item.timestamp).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
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

      {/* Tab 2: Jobs */}
      {activeTab === 'jobs' && (
        <div className="border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="font-semibold text-xs text-zinc-200 uppercase tracking-wider">Field Jobs</h2>
            <Link href="/client/jobs">
              <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-800 bg-zinc-950 text-zinc-300">
                Dispatch New
              </Button>
            </Link>
          </div>
          {profile.jobs?.length === 0 ? (
            <p className="p-6 text-zinc-500 text-xs text-center">No field jobs recorded for this customer.</p>
          ) : (
            <div className="divide-y divide-zinc-800">
              {profile.jobs.map((j: any) => (
                <div key={j.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-xs text-zinc-100">{j.job_number} • {j.title}</div>
                    <div className="text-[11px] text-zinc-500 tabular-nums">{new Date(j.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded capitalize bg-zinc-950 text-zinc-300 border border-zinc-800">
                    {j.status.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Quotes & Invoices */}
      {activeTab === 'quotes_invoices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden">
            <div className="p-3.5 border-b border-zinc-800">
              <h2 className="font-semibold text-xs text-zinc-200 uppercase tracking-wider">Invoices</h2>
            </div>
            {profile.invoices?.length === 0 ? (
              <p className="p-6 text-zinc-500 text-xs text-center">No invoices generated.</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {profile.invoices.map((inv: any) => (
                  <div key={inv.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">{inv.invoice_number}</div>
                      <div className="text-[11px] text-zinc-400 tabular-nums">${Number(inv.total).toFixed(2)} (Due: ${Number(inv.amount_due).toFixed(2)})</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded capitalize bg-zinc-950 text-zinc-300 border border-zinc-800">
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden">
            <div className="p-3.5 border-b border-zinc-800">
              <h2 className="font-semibold text-xs text-zinc-200 uppercase tracking-wider">Estimates</h2>
            </div>
            {profile.quotes?.length === 0 ? (
              <p className="p-6 text-zinc-500 text-xs text-center">No estimates created.</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {profile.quotes.map((q: any) => (
                  <div key={q.id} className="p-3 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-xs text-zinc-100">{q.quote_number} • {q.title}</div>
                      <div className="text-[11px] text-zinc-400 tabular-nums">Total: ${Number(q.total).toFixed(2)}</div>
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded capitalize bg-zinc-950 text-zinc-300 border border-zinc-800">
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
        <form onSubmit={handleSaveContact} className="border border-zinc-800 rounded-lg bg-zinc-900 p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-300 mb-1 block">Customer Full Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} className="h-8.5 bg-zinc-950 border-zinc-800 text-xs" />
            </div>

            <div>
              <Label className="text-xs text-zinc-300 mb-1 block">Phone Number</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="h-8.5 bg-zinc-950 border-zinc-800 text-xs" />
            </div>

            <div>
              <Label className="text-xs text-zinc-300 mb-1 block">Email Address</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} className="h-8.5 bg-zinc-950 border-zinc-800 text-xs" />
            </div>

            <div>
              <Label className="text-xs text-zinc-300 mb-1 block">Service Frequency (Days)</Label>
              <Input
                type="number"
                min={7}
                value={serviceFrequency}
                onChange={e => setServiceFrequency(parseInt(e.target.value) || 90)}
                className="h-8.5 bg-zinc-950 border-zinc-800 text-xs"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs text-zinc-300 mb-1 block">Service Address</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} className="h-8.5 bg-zinc-950 border-zinc-800 text-xs" />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs text-zinc-300 mb-1 block">Customer Tags</Label>
              <div className="flex items-center gap-2 mb-2">
                <Input
                  placeholder="Add a tag (e.g. VIP, Residential)..."
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
                  className="h-8 bg-zinc-950 border-zinc-800 text-xs"
                />
                <Button type="button" onClick={handleAddTag} variant="outline" size="sm" className="h-8 text-xs border-zinc-800 bg-zinc-950">
                  Add Tag
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded">
                    <Tag className="h-3 w-3 text-zinc-500" />
                    {t}
                    <button type="button" onClick={() => handleRemoveTag(t)} className="text-zinc-500 hover:text-rose-400 ml-1">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs text-zinc-300 mb-1 block">Relationship Notes</Label>
              <textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Gate codes, preferences, equipment details..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-2.5 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-zinc-800">
            <Button type="submit" size="sm" disabled={saving} className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save Changes
            </Button>
          </div>
        </form>
      )}

    </div>
  )
}
