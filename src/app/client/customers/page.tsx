'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  ChevronRight, 
  ArrowUpDown,
  Plus,
  Download,
  Phone,
  MessageSquare,
  MapPin,
  X,
  Tag,
  Wrench
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { exportToCsv, CsvFormatters } from '@/lib/export/csv-export'

export default function CustomersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'due' | 'overdue' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'last_activity' | 'ltv' | 'last_service' | 'name'>('last_activity')

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false)

  // Auto-open modal if triggered via Quick Actions query parameter
  useEffect(() => {
    if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
      setShowAddModal(true)
    }
  }, [searchParams])

  const [addName, setAddName] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [addFrequency, setAddFrequency] = useState('90')
  const [addingCustomer, setAddingCustomer] = useState(false)

  const handlePhoneFormat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    let formatted = raw
    if (raw.length > 6) {
      formatted = `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`
    } else if (raw.length > 3) {
      formatted = `(${raw.slice(0, 3)}) ${raw.slice(3)}`
    } else if (raw.length > 0) {
      formatted = `(${raw}`
    }
    setAddPhone(formatted)
  }

  // React Query with stale-while-revalidate caching
  const { data, isLoading: loading, isError, error: queryError, refetch } = useQuery({
    queryKey: ['customers', search, filterStatus, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search.trim()) params.set('query', search.trim())
      if (filterStatus !== 'all') params.set('status', filterStatus)
      if (sortBy) params.set('sortBy', sortBy)

      const res = await fetch(`/api/client/customers?${params.toString()}`)
      if (!res.ok) {
        if (res.status === 403) {
          const err = await res.json().catch(() => ({}))
          if (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization')) {
            window.location.href = '/client/onboarding'
            return { customers: [], counts: {} }
          }
        }
        throw new Error('Failed to load customer directory. Please retry.')
      }
      return res.json()
    },
    staleTime: 60 * 1000
  })

  const customers: any[] = (data as any)?.customers || []
  const counts = (data as any)?.counts || { total: 0, active: 0, due: 0, overdue: 0, inactive: 0, totalLtv: 0 }
  const error = isError ? (queryError?.message || 'Failed to load customer directory.') : null

  const loadData = useCallback(async () => {
    await refetch()
  }, [refetch])

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

      const resData = await res.json()
      if (res.ok && resData.success) {
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
        toast.error(resData.error || 'Failed to add customer')
      }
    } catch {
      toast.error('Network error adding customer.')
    } finally {
      setAddingCustomer(false)
    }
  }

  const handleExportCsv = () => {
    if (!customers.length) {
      toast.error('No customer records to export.')
      return
    }
    exportToCsv('captodesk_customers', [
      { header: 'Customer Name', accessor: c => c.name || 'Unnamed' },
      { header: 'Phone', accessor: c => c.phone || '' },
      { header: 'Email', accessor: c => c.email || '' },
      { header: 'Address', accessor: c => c.address || '' },
      { header: 'Lifecycle Status', accessor: c => CsvFormatters.status(c.lifecycle_status) },
      { header: 'Service Frequency (Days)', accessor: c => c.service_frequency_days || 90 },
      { header: 'Last Service Date', accessor: c => CsvFormatters.date(c.last_service_date) },
      { header: 'Lifetime Value', accessor: c => CsvFormatters.currency(c.lifetime_value) },
      { header: 'Created At', accessor: c => CsvFormatters.date(c.created_at) }
    ], customers)
    toast.success(`Exported ${customers.length} customer records to CSV`)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Active</span>
          </span>
        )
      case 'due':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            <span>Service Due</span>
          </span>
        )
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertCircle className="w-3 h-3" />
            <span>Overdue</span>
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
            Inactive
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">

      {/* Page Header (Senior Designer Standard) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Customer Directory
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 font-mono tabular-nums">
              {counts.total} contacts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
            Verified homeowner profiles, property equipment notes, service cadences, and cumulative lifetime value.
          </p>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="h-9 px-3.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>Add Customer</span>
          </Button>

          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="h-9 px-3 text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-800 shadow-xs"
            title="Download full customer directory as CSV"
          >
            <Download className="h-3.5 w-3.5 sm:mr-1.5 text-slate-500 dark:text-zinc-400" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Financial & Operational Metric Tokens (4 Columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Total Customers</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">{loading ? '—' : counts.total}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Recorded CRM contacts</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Active Customers</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{loading ? '—' : counts.active}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Within service interval</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Service Due / Overdue</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-1">{loading ? '—' : counts.due + counts.overdue}</p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Reactivation candidates</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 shadow-xs">
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 uppercase tracking-wider font-semibold">Cumulative Lifetime Value</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {loading ? '—' : `$${Number(counts.totalLtv || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">Paid invoices &amp; jobs</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Rail */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800">
          {[
            { id: 'all', label: 'All', count: counts.total },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'due', label: 'Due', count: counts.due },
            { id: 'overdue', label: 'Overdue', count: counts.overdue },
            { id: 'inactive', label: 'Inactive', count: counts.inactive }
          ].map(st => (
            <button
              key={st.id}
              onClick={() => setFilterStatus(st.id as any)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-colors",
                filterStatus === st.id
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              <span>{st.label}</span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-mono",
                filterStatus === st.id ? "bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200" : "text-slate-400 dark:text-zinc-500"
              )}>
                {st.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
            <Input
              placeholder="Search name, phone, email, notes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-8 pr-7 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg shadow-2xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-zinc-300 shadow-2xs">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
            <select
              aria-label="Sort customers"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs text-slate-700 dark:text-zinc-200 focus:outline-none cursor-pointer font-medium"
            >
              <option value="last_activity" className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white">Recent Activity</option>
              <option value="ltv" className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white">Highest LTV</option>
              <option value="last_service" className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white">Last Service</option>
              <option value="name" className="bg-white dark:bg-zinc-950 text-slate-900 dark:text-white">Customer Name</option>
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
        <div className="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36 bg-slate-200 dark:bg-zinc-800" />
                    <Skeleton className="h-3 w-24 bg-slate-200 dark:bg-zinc-800/60" />
                  </div>
                  <Skeleton className="h-5 w-20 bg-slate-200 dark:bg-zinc-800" />
                  <Skeleton className="h-4 w-24 bg-slate-200 dark:bg-zinc-800" />
                  <Skeleton className="h-4 w-16 bg-slate-200 dark:bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title={search ? 'No Matching Customers' : 'Customer Directory Empty'}
                description={
                  search
                    ? `No customer profiles match "${search}". Try searching by a different name, phone number, or address.`
                    : 'Customer profiles are automatically established as homeowners call, message, or book service.'
                }
                actionLabel={search ? 'Clear Search' : 'Add First Customer'}
                onAction={search ? () => setSearch('') : () => setShowAddModal(true)}
              />
            </div>
          ) : (
            <div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/90 border-b border-slate-200 dark:border-zinc-800">
                    <TableRow className="border-b border-slate-200 dark:border-zinc-800 hover:bg-transparent">
                      <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Customer</TableHead>
                      <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Lifecycle Status</TableHead>
                      <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Service Cadence</TableHead>
                      <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Lifetime Value</TableHead>
                      <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4">Last Activity</TableHead>
                      <TableHead className="text-slate-600 dark:text-zinc-400 font-bold text-xs py-3 px-4 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {customers.map(contact => (
                      <TableRow
                        key={contact.id}
                        onClick={() => router.push(`/client/customers/${contact.id}`)}
                        className="border-b border-slate-100 dark:border-zinc-800 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                      >
                        <TableCell className="py-3 px-4">
                          <div className="font-bold text-xs text-slate-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {contact.name || 'Customer'}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                            {contact.phone}
                          </div>
                          {contact.address && (
                            <div className="text-[10px] text-slate-400 dark:text-zinc-500 truncate max-w-xs mt-0.5">
                              {contact.address}
                            </div>
                          )}
                          {contact.tags && contact.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {contact.tags.slice(0, 3).map((t: string) => (
                                <span key={t} className="text-[10px] bg-slate-100 text-slate-600 dark:bg-zinc-950 dark:text-zinc-400 px-1.5 py-0.2 rounded border border-slate-200 dark:border-zinc-800 font-medium">
                                  {t}
                                </span>
                              ))}
                              {contact.tags.length > 3 && (
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500">+{contact.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="py-3 px-4">
                          {getStatusBadge(contact.lifecycle_status || 'active')}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-xs text-slate-700 dark:text-zinc-300">
                          {contact.last_service_date ? (
                            <div>
                              <div className="tabular-nums font-semibold">{new Date(contact.last_service_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                              <div className="text-[11px] text-slate-500 dark:text-zinc-500">Every {contact.service_frequency_days || 90}d</div>
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-zinc-500 italic">No prior jobs</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3 px-4 font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                          ${Number(contact.lifetime_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-xs text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {contact.last_activity ? new Date(contact.last_activity).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </TableCell>

                        <TableCell className="py-3 px-4 text-right">
                          <span className="text-xs text-slate-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors inline-flex items-center gap-0.5 font-bold">
                            <span>Dossier</span>
                            <ChevronRight className="h-3 w-3" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Truck Card List View (48px Touch Targets) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800">
                {customers.map(contact => (
                  <div
                    key={contact.id}
                    className="p-4 space-y-2.5 active:bg-slate-50 dark:active:bg-zinc-800/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div 
                        onClick={() => router.push(`/client/customers/${contact.id}`)}
                        className="cursor-pointer space-y-0.5 flex-1"
                      >
                        <h3 className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                          {contact.name || 'Customer'}
                        </h3>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono tabular-nums">
                          {contact.phone}
                        </p>
                        {contact.address && (
                          <p className="text-[10px] text-slate-400 dark:text-zinc-500 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{contact.address}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {getStatusBadge(contact.lifecycle_status || 'active')}
                        <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
                          ${Number(contact.lifetime_value || 0).toFixed(0)} LTV
                        </p>
                      </div>
                    </div>

                    {/* 48px Truck Touch Fast Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1.5">
                        {contact.phone && (
                          <>
                            <a
                              href={`tel:${contact.phone}`}
                              className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                            >
                              <Phone className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              <span>Call</span>
                            </a>
                            <a
                              href={`sms:${contact.phone}`}
                              className="inline-flex items-center justify-center gap-1 h-9 px-3 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 transition-colors"
                            >
                              <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>SMS</span>
                            </a>
                          </>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/client/customers/${contact.id}`)}
                        className="h-9 px-3 text-xs font-semibold border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
                      >
                        <span>Open Dossier</span>
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
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
        title="Add Customer Profile"
        description="Create a verified contact in your customer directory with property notes and service intervals."
        size="md"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Customer Full Name
              </label>
              <Input
                placeholder="e.g. Sarah Connor"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Cell Phone Number *
              </label>
              <Input
                required
                placeholder="(555) 000-0000"
                value={addPhone}
                onChange={handlePhoneFormat}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="e.g. sarah@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                Service Cadence (Days)
              </label>
              <Input
                type="number"
                min="7"
                value={addFrequency}
                onChange={(e) => setAddFrequency(e.target.value)}
                className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Service Address
            </label>
            <Input
              placeholder="e.g. 742 Evergreen Terrace, Springfield, IL 62704"
              value={addAddress}
              onChange={(e) => setAddAddress(e.target.value)}
              className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              Property Notes, Gate Codes &amp; Equipment
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Gate code #4821, Carrier 4-ton heat pump in attic, friendly dog in backyard."
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2.5 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(false)}
              className="h-9 text-xs border-slate-300 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={addingCustomer}
              className="h-9 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
            >
              {addingCustomer ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              <span>Create Customer</span>
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
