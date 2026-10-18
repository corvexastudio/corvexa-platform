'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { 
  Briefcase, 
  Clock, 
  MapPin, 
  PhoneCall, 
  CheckCircle2, 
  Navigation, 
  Play, 
  FileText, 
  Plus, 
  Calendar,
  Search,
  MessageSquare,
  DollarSign,
  Loader2,
  ChevronRight,
  ExternalLink,
  Download
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { exportToCsv, CsvFormatters } from '@/lib/export/csv-export'

interface JobItem {
  id: string
  job_number: string
  title: string
  description?: string | null
  status: 'scheduled' | 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  scheduled_start: string
  scheduled_end?: string | null
  en_route_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  notes?: string | null
  tracking_token?: string | null
  contact?: {
    id: string
    name?: string | null
    phone: string
    address?: string | null
  } | null
  quote?: {
    quote_number: string
    total: number
  } | null
}

function getJobStatusBadge(status: JobItem['status']) {
  switch (status) {
    case 'en_route':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
          En Route
        </span>
      )
    case 'in_progress':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
          In Progress
        </span>
      )
    case 'completed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
          Completed
        </span>
      )
    case 'cancelled':
    case 'no_show':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
          {status === 'no_show' ? 'No Show' : 'Cancelled'}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
          Scheduled
        </span>
      )
  }
}

function JobsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const contactIdParam = searchParams.get('contact_id')

  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'today' | 'active' | 'completed' | 'all'>('today')
  const [search, setSearch] = useState('')

  // Create Job Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobScheduledStart, setJobScheduledStart] = useState('')
  const [jobNotes, setJobNotes] = useState('')
  const [creatingJob, setCreatingJob] = useState(false)

  // Listen to contact_id query param
  useEffect(() => {
    if (contactIdParam) {
      setSelectedContactId(contactIdParam)
      setShowCreateModal(true)
    }
  }, [contactIdParam])

  // Note dialog state
  const [activeJobForNote, setActiveJobForNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const isToday = tab === 'today'
      const res = await fetch(`/api/client/jobs${isToday ? '?today=true' : ''}`)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      } else {
        const err = await res.json().catch(() => ({}))
        if (res.status === 403 && (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization'))) {
          window.location.href = '/client/onboarding'
          return
        }
        setError(err.error || 'Failed to load field jobs.')
      }
    } catch {
      setError('Unable to load field jobs. Check network connection.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  const loadContacts = useCallback(async () => {
    try {
      const res = await fetch('/api/client/customers?limit=100')
      if (res.ok) {
        const data = await res.json()
        setContacts(data.customers || [])
      }
    } catch {
      // quiet fail
    }
  }, [])

  useEffect(() => {
    loadJobs()
    loadContacts()
  }, [loadJobs, loadContacts])

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedContactId) {
      toast.error('Please choose a customer.')
      return
    }
    if (!jobTitle.trim()) {
      toast.error('Please enter a job title.')
      return
    }
    if (!jobScheduledStart) {
      toast.error('Please pick a scheduled date and time.')
      return
    }

    setCreatingJob(true)
    try {
      const res = await fetch('/api/client/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: selectedContactId,
          title: jobTitle.trim(),
          scheduledStart: new Date(jobScheduledStart).toISOString(),
          notes: jobNotes.trim() || undefined
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Job ${data.job?.job_number || ''} created successfully!`)
        setShowCreateModal(false)
        setJobTitle('')
        setJobScheduledStart('')
        setJobNotes('')
        setSelectedContactId('')
        await loadJobs()
      } else {
        toast.error(data.error || 'Failed to create job.')
      }
    } catch {
      toast.error('Network error creating job.')
    } finally {
      setCreatingJob(false)
    }
  }

  const handleUpdateStatus = async (jobId: string, newStatus: string, notifyCustomer: boolean = false) => {
    // Optimistic update
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, status: newStatus as any } : j))

    try {
      const res = await fetch(`/api/client/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notifyCustomer })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(`Job marked as ${newStatus.replace('_', ' ')}`)
        await loadJobs()
      } else {
        toast.error(data.error || 'Failed to update job status.')
        await loadJobs() // rollback
      }
    } catch {
      toast.error('Network error updating job.')
      await loadJobs()
    }
  }

  const handleSaveNote = async (jobId: string) => {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: jobs.find(j => j.id === jobId)?.status, notes: noteText.trim() })
      })
      if (res.ok) {
        toast.success('Note attached to job')
        setNoteText('')
        setActiveJobForNote(null)
        await loadJobs()
      } else {
        toast.error('Failed to save note.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setSavingNote(false)
    }
  }

  // Filter Jobs based on selected Tab and Search
  const filteredJobs = jobs.filter((job) => {
    if (tab === 'active' && !['scheduled', 'confirmed', 'en_route', 'in_progress'].includes(job.status)) {
      return false
    }
    if (tab === 'completed' && job.status !== 'completed') {
      return false
    }

    if (!search.trim()) return true
    const q = search.toLowerCase().trim()
    return (
      job.job_number.toLowerCase().includes(q) ||
      job.title.toLowerCase().includes(q) ||
      job.contact?.name?.toLowerCase().includes(q) ||
      job.contact?.phone?.includes(q) ||
      job.contact?.address?.toLowerCase().includes(q)
    )
  })

  const handleExportCsv = () => {
    if (!jobs.length) {
      toast.error('No jobs to export.')
      return
    }
    exportToCsv('captodesk_jobs', [
      { header: 'Job #', accessor: j => j.job_number },
      { header: 'Job Title', accessor: j => j.title },
      { header: 'Customer Name', accessor: j => j.contact?.name || 'Unnamed' },
      { header: 'Customer Phone', accessor: j => j.contact?.phone || '' },
      { header: 'Service Address', accessor: j => j.contact?.address || '' },
      { header: 'Status', accessor: j => CsvFormatters.status(j.status) },
      { header: 'Scheduled Start', accessor: j => CsvFormatters.dateTime(j.scheduled_start) },
      { header: 'Started At', accessor: j => CsvFormatters.dateTime(j.started_at) },
      { header: 'Completed At', accessor: j => CsvFormatters.dateTime(j.completed_at) },
      { header: 'Job Total', accessor: j => CsvFormatters.currency(j.quote?.total) },
      { header: 'Notes', accessor: j => j.notes || '' }
    ], jobs)
    toast.success(`Exported ${jobs.length} jobs to CSV`)
  }

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Jobs & Dispatch
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200/80 dark:border-zinc-700 tabular-nums">
              {jobs.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Dispatch, execution lifecycle, and service completion for field technicians.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs"
            title="Download full job history as CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5 text-slate-400 dark:text-zinc-400" />
            <span>Export CSV</span>
          </Button>
          <Link href="/client/calendar">
            <Button variant="outline" size="sm" className="h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Calendar
            </Button>
          </Link>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Dispatch Job
          </Button>
        </div>
      </div>

      {/* Filter Bar & Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/60 dark:border-zinc-800">
          {[
            { key: 'today', label: "Today's Schedule" },
            { key: 'active', label: 'Active Pipeline' },
            { key: 'completed', label: 'Completed' },
            { key: 'all', label: 'All Jobs' }
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                tab === t.key
                  ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-zinc-400" />
          <Input
            placeholder="Search jobs, customers, address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 rounded-lg"
          />
        </div>
      </div>

      {/* Content Feed */}
      {error ? (
        <ErrorState
          title="Failed to load field jobs"
          message={error}
          onRetry={loadJobs}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40 bg-slate-100 dark:bg-zinc-800" />
                  <Skeleton className="h-3 w-56 bg-slate-100 dark:bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 bg-slate-100 dark:bg-zinc-800" />
                <Skeleton className="h-8 w-28 bg-slate-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={tab === 'today' ? "No Jobs Scheduled for Today" : "No Jobs in This View"}
          description={
            tab === 'today'
              ? "All field appointments for today are clear. You can dispatch a new job directly or view the weekly calendar."
              : "No jobs matched your current filter criteria. New jobs flow automatically from accepted quotes and bookings."
          }
          actionLabel="Dispatch New Job"
          onAction={() => setShowCreateModal(true)}
          secondaryActionLabel="Open Calendar"
          onSecondaryAction={() => router.push('/client/calendar')}
        />
      ) : (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800 shadow-xs">
          {filteredJobs.map((job) => {
            const startDate = new Date(job.scheduled_start)
            const isEnRoute = job.status === 'en_route'
            const isInProgress = job.status === 'in_progress'
            const isCompleted = job.status === 'completed'

            return (
              <div
                key={job.id}
                className="p-4 sm:p-4.5 hover:bg-slate-50/70 dark:hover:bg-zinc-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left details */}
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Time box */}
                  <div className="h-11 w-12 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center shrink-0 text-slate-700 dark:text-zinc-300">
                    <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-white">
                      {startDate.toLocaleDateString([], { day: 'numeric' })}
                    </span>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-zinc-500">
                      {startDate.toLocaleDateString([], { month: 'short' })}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {job.job_number}
                      </span>
                      <h2 className="font-semibold text-xs text-slate-900 dark:text-zinc-100 truncate">
                        {job.title}
                      </h2>
                      {getJobStatusBadge(job.status)}

                      {job.quote?.total && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 tabular-nums">
                          ${Number(job.quote.total).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1 text-slate-700 dark:text-zinc-300 font-medium tabular-nums">
                        <Clock className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                        {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>

                      {job.contact?.name && (
                        <span className="text-slate-700 dark:text-zinc-300 font-medium">• {job.contact.name}</span>
                      )}

                      {job.contact?.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(job.contact.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 truncate max-w-xs transition-colors"
                        >
                          <MapPin className="h-3 w-3 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span className="truncate">{job.contact.address}</span>
                        </a>
                      )}
                    </div>

                    {job.notes && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1 italic pt-0.5">
                        {job.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right / Bottom Action Controls */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-zinc-800/80 w-full md:w-auto justify-between md:justify-end">
                  {/* Status Progression Workflow */}
                  <div className="flex items-center gap-1.5">
                    {(job.status === 'scheduled' || job.status === 'confirmed') && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(job.id, 'en_route', true)}
                        className="h-7.5 px-3 rounded-lg text-xs bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
                      >
                        <Navigation className="h-3 w-3 mr-1" />
                        En Route
                      </Button>
                    )}

                    {job.status === 'en_route' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                        className="h-7.5 px-3 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Start Job
                      </Button>
                    )}

                    {job.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(job.id, 'completed')}
                        className="h-7.5 px-3 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Complete Job
                      </Button>
                    )}
                  </div>

                  {/* Utility actions */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveJobForNote(activeJobForNote === job.id ? null : job.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                      title="Add note"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                    </button>

                    {job.contact?.phone && (
                      <a
                        href={`tel:${job.contact.phone}`}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
                        title="Call customer"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <Link
                      href="/client/invoices"
                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                      title="Invoice this job"
                    >
                      <DollarSign className="h-3.5 w-3.5" />
                    </Link>

                    {/* Customer Live Tracker Link */}
                    {job.tracking_token && (
                      <div className="flex items-center gap-0.5 border-l border-slate-200 dark:border-zinc-800 pl-1">
                        <button
                          type="button"
                          onClick={() => {
                            const url = `${window.location.origin}/t/${job.tracking_token}`
                            navigator.clipboard.writeText(url)
                            toast.success('Customer live tracking link copied to clipboard!')
                          }}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors"
                          title="Copy Customer Tracking Link"
                        >
                          <Navigation className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                        </button>
                        <a
                          href={`/t/${job.tracking_token}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors"
                          title="Open Customer Live Tracker"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Note Modal */}
      <Modal
        open={!!activeJobForNote}
        onOpenChange={(open) => !open && setActiveJobForNote(null)}
        title="Add Note to Job"
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveJobForNote(null)}
              className="h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={savingNote || !noteText.trim()}
              onClick={() => activeJobForNote && handleSaveNote(activeJobForNote)}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
            >
              {savingNote ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        }
      >
        <textarea
          rows={3}
          placeholder="e.g. Unit capacitor replaced, customer signed work order..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
        />
      </Modal>

      {/* Dispatch New Job Modal */}
      <Modal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        title="Dispatch New Job"
        description="Schedule a field appointment and track execution through completion."
        size="lg"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Customer
            </label>
            <select
              aria-label="Select Customer"
              value={selectedContactId}
              onChange={e => setSelectedContactId(e.target.value)}
              required
              className="w-full p-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">-- Choose Customer --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id} className="bg-white dark:bg-zinc-900 text-slate-900 dark:text-white">
                  {c.name || 'Valued Customer'} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Job Title
            </label>
            <Input
              value={jobTitle}
              onChange={e => setJobTitle(e.target.value)}
              placeholder="e.g. AC Condenser Diagnostic & Coil Clean"
              required
              className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Scheduled Start
            </label>
            <Input
              type="datetime-local"
              value={jobScheduledStart}
              onChange={e => setJobScheduledStart(e.target.value)}
              required
              className="h-9 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Job Notes
            </label>
            <textarea
              rows={3}
              value={jobNotes}
              onChange={e => setJobNotes(e.target.value)}
              placeholder="e.g. Homeowner reported system blowing warm air. Gate code #4492."
              className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-200 text-xs focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateModal(false)}
              className="h-8 text-xs border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={creatingJob}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
            >
              {creatingJob ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                  Creating...
                </>
              ) : (
                'Dispatch Job'
              )}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}

export default function JobsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-500">Loading jobs...</div>}>
      <JobsContent />
    </Suspense>
  )
}
