'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { 
  Users, 
  Search, 
  RefreshCw, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  Loader2, 
  ChevronRight, 
  ArrowUpDown,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<any[]>([])
  const [counts, setCounts] = useState({
    total: 0,
    active: 0,
    due: 0,
    overdue: 0,
    inactive: 0,
    totalLtv: 0
  })
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'due' | 'overdue' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'last_activity' | 'ltv' | 'last_service' | 'name'>('last_activity')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningReactivation, setRunningReactivation] = useState(false)

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false)
  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addFrequency, setAddFrequency] = useState('90')
  const [addingCustomer, setAddingCustomer] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('query', search.trim())
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (sortBy) params.set('sortBy', sortBy)

      const res = await fetch(`/api/client/customers?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
        setCounts(data.counts || {})
      } else {
        if (res.status === 403) {
          const err = await res.json().catch(() => ({}))
          if (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization')) {
            window.location.href = '/client/onboarding'
            return
          }
        }
        setError('Failed to load customer directory. Please retry.')
      }
    } catch {
      setError('Network error while loading customer directory.')
    } finally {
      setLoading(false)
    }
  }, [search, filterStatus, sortBy])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData()
    }, 250)
    return () => clearTimeout(timer)
  }, [loadData])

  const handleRunReactivation = async () => {
    setRunningReactivation(true)
    try {
      const res = await fetch('/api/client/retention', { method: 'POST' })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Reactivation complete: ${data.reactivatedCount} reminders dispatched.`)
        loadData()
      } else {
        toast.error('Failed to trigger reactivation cycle.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setRunningReactivation(false)
    }
  }

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addPhone.trim()) {
      toast.error('Customer phone number is required.')
      return
    }

    setAddingCustomer(true)
    try {
      const res = await fetch('/api/client/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName.trim() || undefined,
          phone: addPhone.trim(),
          email: addEmail.trim() || undefined,
          address: addAddress.trim() || undefined,
          notes: addNotes.trim() || undefined,
          serviceFrequencyDays: parseInt(addFrequency, 10) || 90
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Customer ${addName ? `"${addName}"` : ''} added successfully`)
        setShowAddModal(false)
        setAddName('')
        setAddPhone('')
        setAddEmail('')
        setAddAddress('')
        setAddNotes('')
        setAddFrequency('90')
        await loadData()
      } else {
        toast.error(data.error || 'Failed to add customer')
      }
    } catch {
      toast.error('Network error adding customer.')
    } finally {
      setAddingCustomer(false)
    }
  }

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

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">
              Customers
            </h1>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 tabular-nums">
              {counts.total}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Complete customer directory, service history, and lifetime revenue.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>Add Customer</span>
          </Button>

          <Button
            onClick={handleRunReactivation}
            disabled={runningReactivation}
            size="sm"
            className="h-8 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
          >
            {runningReactivation ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-zinc-400" />
            )}
            <span>Run Reactivations</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Total Customers</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">{loading ? '-' : counts.total}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Verified contacts</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Active Customers</p>
          <p className="text-xl font-bold text-emerald-400 tabular-nums mt-1">{loading ? '-' : counts.active}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Recent service completed</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Service Due / Overdue</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums mt-1">{loading ? '-' : counts.due + counts.overdue}</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Eligible for reactivation</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3.5">
          <p className="text-[11px] text-zinc-400 uppercase tracking-wider font-semibold">Total Lifetime Value</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">
            {loading ? '-' : `$${counts.totalLtv.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">Collected revenue</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {(['all', 'active', 'due', 'overdue', 'inactive'] as const).map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium capitalize whitespace-nowrap transition-colors",
                filterStatus === st
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              )}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search name, phone, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-400 rounded-md"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-md px-2.5 py-1 text-xs text-zinc-400">
            <ArrowUpDown className="h-3 w-3 text-zinc-500 shrink-0" />
            <select
              aria-label="Sort customers"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="last_activity" className="bg-zinc-950 text-white">Recent Activity</option>
              <option value="ltv" className="bg-zinc-950 text-white">Lifetime Value</option>
              <option value="last_service" className="bg-zinc-950 text-white">Last Service</option>
              <option value="name" className="bg-zinc-950 text-white">Name</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {error ? (
        <ErrorState
          title="Failed to load customers"
          message={error}
          onRetry={loadData}
          retryLabel="Retry Loading"
        />
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36 bg-zinc-800" />
                    <Skeleton className="h-3 w-24 bg-zinc-800/60" />
                  </div>
                  <Skeleton className="h-5 w-20 bg-zinc-800" />
                  <Skeleton className="h-4 w-24 bg-zinc-800" />
                  <Skeleton className="h-4 w-16 bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title={search ? 'No Matching Customers' : 'Customer Directory Empty'}
                description={
                  search
                    ? `No customer profiles match "${search}". Try searching by a different name or phone number.`
                    : 'Customer profiles are automatically established as homeowners call, message, or book service.'
                }
                actionLabel={search ? 'Clear Search' : 'Go to Inbox'}
                onAction={search ? () => setSearch('') : () => router.push('/client/inbox')}
              />
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-900/90 border-b border-zinc-800">
                    <TableRow className="border-b border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Customer</TableHead>
                      <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Lifecycle Status</TableHead>
                      <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Last Service</TableHead>
                      <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Lifetime Value</TableHead>
                      <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4">Last Activity</TableHead>
                      <TableHead className="text-zinc-400 font-semibold text-xs py-3 px-4 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-zinc-800">
                    {customers.map(contact => (
                      <TableRow
                        key={contact.id}
                        onClick={() => router.push(`/client/customers/${contact.id}`)}
                        className="border-b border-zinc-800 hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                      >
                        <TableCell className="py-3 px-4">
                          <div className="font-medium text-xs text-zinc-100 group-hover:text-blue-400 transition-colors">
                            {contact.name || 'Customer'}
                          </div>
                          <div className="text-[11px] text-zinc-400 tabular-nums">
                            {contact.phone}
                          </div>
                          {contact.tags && contact.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {contact.tags.slice(0, 3).map((t: string) => (
                                <span key={t} className="text-[10px] bg-zinc-950 text-zinc-400 px-1.5 py-0.2 rounded border border-zinc-800">
                                  {t}
                                </span>
                              ))}
                              {contact.tags.length > 3 && (
                                <span className="text-[10px] text-zinc-500">+{contact.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="py-3 px-4">
                          {getStatusBadge(contact.lifecycle_status || 'active')}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-xs text-zinc-300">
                          {contact.last_service_date ? (
                            <div>
                              <div className="tabular-nums">{new Date(contact.last_service_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              <div className="text-[11px] text-zinc-500">Every {contact.service_frequency_days || 90}d</div>
                            </div>
                          ) : (
                            <span className="text-zinc-500">No jobs completed</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3 px-4 font-semibold text-xs text-emerald-400 tabular-nums">
                          ${Number(contact.lifetime_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-xs text-zinc-400 tabular-nums">
                          {contact.last_activity ? new Date(contact.last_activity).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—'}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-right">
                          <span className="text-xs text-zinc-400 group-hover:text-white transition-colors inline-flex items-center gap-0.5">
                            View <ChevronRight className="h-3 w-3" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Card List View */}
              <div className="md:hidden divide-y divide-zinc-800">
                {customers.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => router.push(`/client/customers/${contact.id}`)}
                    className="p-4 space-y-2 cursor-pointer active:bg-zinc-800/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-xs text-zinc-100">{contact.name || 'Customer'}</h3>
                        <p className="text-[11px] text-zinc-400 tabular-nums">{contact.phone}</p>
                      </div>
                      {getStatusBadge(contact.lifecycle_status || 'active')}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-zinc-500">
                        {contact.last_service_date ? `Last: ${new Date(contact.last_service_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}` : 'No prior jobs'}
                      </span>
                      <span className="font-semibold text-emerald-400 tabular-nums">
                        ${Number(contact.lifetime_value || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Customer Modal */}
      <Modal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        title="Add New Customer"
        description="Create a verified contact profile in your customer directory."
        size="md"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Full Name</label>
            <Input
              placeholder="e.g. Sarah Connor"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Phone Number *</label>
            <Input
              required
              placeholder="e.g. +1 555-0199"
              value={addPhone}
              onChange={(e) => setAddPhone(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Email Address</label>
            <Input
              type="email"
              placeholder="e.g. sarah@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Service Address</label>
            <Input
              placeholder="e.g. 742 Evergreen Terrace, Springfield"
              value={addAddress}
              onChange={(e) => setAddAddress(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Service Frequency (Days)</label>
            <Input
              type="number"
              min="7"
              value={addFrequency}
              onChange={(e) => setAddFrequency(e.target.value)}
              className="h-8.5 bg-zinc-950 border-zinc-800 text-xs text-zinc-100 rounded-md"
            />
            <span className="text-[11px] text-zinc-500 mt-0.5 block">How often this customer typically requires maintenance (default: 90 days)</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Notes / Preferences</label>
            <textarea
              rows={2}
              placeholder="Customer notes, gate codes, equipment details..."
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              className="w-full p-2 rounded-md bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
              className="h-8 text-xs border-zinc-800 text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addingCustomer}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {addingCustomer ? 'Adding...' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
