'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
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
  CalendarDays,
  Camera,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
  MessageSquare
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

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

export default function JobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'today' | 'active' | 'completed' | 'all'>('today')

  // Create Job Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [selectedContactId, setSelectedContactId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [jobScheduledStart, setJobScheduledStart] = useState('')
  const [jobNotes, setJobNotes] = useState('')
  const [creatingJob, setCreatingJob] = useState(false)

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

  // Status Progression Handler
  const handleUpdateStatus = async (jobId: string, newStatus: string, notifyCustomer: boolean = false) => {
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notifyCustomer })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(`Job marked as ${newStatus.replace('_', ' ')}!`)
        if (newStatus === 'completed') {
          toast.success('Emitted job.completed domain event.')
        }
        await loadJobs()
      } else {
        toast.error(data.error || 'Failed to update job status.')
      }
    } catch {
      toast.error('Network error updating job.')
    }
  }

  // Add Note Handler
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
        toast.success('Note attached to job!')
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

  // Filter Jobs based on selected Tab
  const filteredJobs = jobs.filter((job) => {
    if (tab === 'today') return true
    if (tab === 'active') return ['scheduled', 'confirmed', 'en_route', 'in_progress'].includes(job.status)
    if (tab === 'completed') return job.status === 'completed'
    return true
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Briefcase className="h-6 w-6 text-blue-500" />
            Field Jobs & Dispatch
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Mobile execution pipeline: En route, In progress, and Completed.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-800 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
            {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Create Job</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'today', label: "Today's Jobs" },
          { key: 'active', label: 'Active Pipeline' },
          { key: 'completed', label: 'Completed' },
          { key: 'all', label: 'All Jobs' }
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-[#0D1322] text-zinc-400 hover:text-white border border-zinc-800/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Jobs Feed */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/70 mb-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {tab === 'today' ? "Today's Schedule" : 'Job Orders'}
          </h2>
          <span className="text-xs text-zinc-400">
            {filteredJobs.length} Jobs
          </span>
        </div>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">Failed to load field jobs</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">{error}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={loadJobs}
              className="text-xs border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-[#0B0F19] p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28 bg-zinc-800/80" />
                  <Skeleton className="h-4 w-20 bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-48 bg-zinc-800/80" />
                <Skeleton className="h-3 w-36 bg-zinc-800/60" />
              </div>
            ))}
          </div>
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={tab === 'today' ? "No Field Jobs Scheduled For Today" : "No Jobs in this View"}
            description="Track technician dispatch, update live statuses (En Route, In Progress, Done), and automatically invite customers to share honest feedback on Google when work is finished."
            actionLabel="View Calendar"
            onAction={() => router.push('/client/calendar')}
            secondaryActionLabel="Open Quotes"
            onSecondaryAction={() => router.push('/client/quotes')}
            tip="Accepted quotes and online appointments automatically flow into this job queue."
            compact
          />
        ) : (
          <div className="space-y-4">
            {filteredJobs.map((job) => {
              const startDate = new Date(job.scheduled_start)
              const isEnRoute = job.status === 'en_route'
              const isInProgress = job.status === 'in_progress'
              const isCompleted = job.status === 'completed'

              return (
                <div
                  key={job.id}
                  className={`rounded-xl border p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all shadow-sm ${
                    isEnRoute
                      ? 'bg-amber-500/5 border-amber-500/40 ring-1 ring-amber-500/30'
                      : isInProgress
                      ? 'bg-blue-500/5 border-blue-500/40 ring-1 ring-blue-500/30'
                      : isCompleted
                      ? 'bg-[#0B0F19]/60 border-zinc-800/60 opacity-80'
                      : 'bg-[#0B0F19] border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shrink-0 text-blue-400">
                      <span className="text-xs font-black">
                        {startDate.toLocaleDateString([], { day: 'numeric' })}
                      </span>
                      <span className="text-[9px] uppercase font-bold text-zinc-400">
                        {startDate.toLocaleDateString([], { month: 'short' })}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-zinc-500 font-bold">
                          {job.job_number}
                        </span>
                        <h3 className="font-bold text-sm text-white">
                          {job.title}
                        </h3>

                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                          isCompleted
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : isEnRoute
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 animate-pulse'
                            : isInProgress
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30 animate-pulse'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}>
                          {job.status.replace('_', ' ')}
                        </span>

                        {job.quote?.total && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            ${Number(job.quote.total).toFixed(2)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 pt-0.5">
                        <span className="flex items-center gap-1 text-zinc-300 font-medium">
                          <Clock className="h-3 w-3 text-blue-400" />
                          {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        {job.contact?.address && (
                          <a
                            href={`https://maps.google.com/?q=${encodeURIComponent(job.contact.address)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-zinc-300 hover:text-blue-400 hover:underline"
                          >
                            <MapPin className="h-3 w-3 text-red-400" />
                            <span>{job.contact.address}</span>
                          </a>
                        )}
                        {job.contact?.name && (
                          <span>• {job.contact.name}</span>
                        )}
                      </div>

                      {job.notes && (
                        <p className="text-[11px] text-zinc-400 italic pt-1 whitespace-pre-line">
                          {job.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                    {/* Status Step 1: Mark En Route */}
                    {(job.status === 'scheduled' || job.status === 'confirmed') && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job.id, 'en_route', true)}
                        className="py-1.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-600/20"
                      >
                        <Navigation className="h-3 w-3" />
                        <span>En Route</span>
                      </button>
                    )}

                    {/* Status Step 2: Mark Started */}
                    {job.status === 'en_route' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                        className="py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                      >
                        <Play className="h-3 w-3" />
                        <span>Start Job</span>
                      </button>
                    )}

                    {/* Status Step 3: Mark Completed */}
                    {job.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job.id, 'completed')}
                        className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Complete Job</span>
                      </button>
                    )}

                    {/* Add Note Button */}
                    <button
                      type="button"
                      onClick={() => setActiveJobForNote(activeJobForNote === job.id ? null : job.id)}
                      className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                      title="Add note"
                    >
                      <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                    </button>

                    {/* Call Customer */}
                    {job.contact?.phone && (
                      <a
                        href={`tel:${job.contact.phone}`}
                        className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                        title="Call customer"
                      >
                        <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Note Floating Dialog */}
      {activeJobForNote && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0D1322] border border-zinc-800 rounded-2xl p-5 space-y-3 shadow-2xl">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              Add Note to Job
            </h3>
            <textarea
              rows={3}
              placeholder="e.g. Unit capacitor replaced, customer signed paper invoice..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#0B0F19] border border-zinc-800 text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveJobForNote(null)}
                className="px-3 py-1.5 rounded-xl border border-zinc-800 text-xs text-zinc-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingNote || !noteText.trim()}
                onClick={() => handleSaveNote(activeJobForNote)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                {savingNote ? 'Saving...' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create New Job Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0B101B] border border-zinc-800 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Dispatch New Job</h2>
                <p className="text-xs text-zinc-400">Schedule a job and track mobile execution through completion.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-4 flex-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Customer
                </label>
                <select
                  value={selectedContactId}
                  onChange={e => setSelectedContactId(e.target.value)}
                  required
                  className="w-full p-2.5 text-xs sm:text-sm bg-zinc-900 border border-zinc-800 rounded-xl text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="">-- Choose Customer --</option>
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || 'Valued Customer'} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Job Title
                </label>
                <Input
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  placeholder="e.g. AC Condenser Diagnostic & Coil Clean"
                  required
                  className="h-10 bg-zinc-900 border-zinc-800 text-xs text-white rounded-xl focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Scheduled Start (Date & Time)
                </label>
                <Input
                  type="datetime-local"
                  value={jobScheduledStart}
                  onChange={e => setJobScheduledStart(e.target.value)}
                  required
                  className="h-10 bg-zinc-900 border-zinc-800 text-xs text-white rounded-xl focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Job Notes / Work Description
                </label>
                <textarea
                  rows={3}
                  value={jobNotes}
                  onChange={e => setJobNotes(e.target.value)}
                  placeholder="e.g. Homeowner reported system blowing warm air. Gate code #4492."
                  className="w-full p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="h-10 px-4 text-xs font-semibold rounded-xl border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={creatingJob}
                  className="h-10 px-5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {creatingJob ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Creating...
                    </>
                  ) : (
                    'Dispatch Job'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
