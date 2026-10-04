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
  MessageSquare,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'

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
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'today' | 'active' | 'completed' | 'all'>('today')

  // Note dialog state
  const [activeJobForNote, setActiveJobForNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const isToday = tab === 'today'
      const res = await fetch(`/api/client/jobs${isToday ? '?today=true' : ''}`)
      if (res.ok) {
        const data = await res.json()
        setJobs(data.jobs || [])
      }
    } catch {
      toast.error('Failed to load field jobs.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    loadJobs()
  }, [loadJobs])

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

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-800 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
            {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
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

        {loading ? (
          <div className="py-12 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
            <p className="text-xs text-zinc-400 mt-2">Loading jobs...</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-3">
            <Briefcase className="h-12 w-12 text-zinc-700 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No jobs found in this view</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              When appointments or accepted quotes are converted to jobs, they will appear here for mobile field execution.
            </p>
          </div>
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

    </div>
  )
}
