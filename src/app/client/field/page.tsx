'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useWorkspace } from '@/lib/context/workspace-context'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { 
  Navigation, 
  MapPin, 
  Phone, 
  Clock, 
  Camera, 
  CheckCircle2, 
  Play, 
  Truck, 
  Calendar,
  AlertCircle,
  FileText,
  Receipt,
  Loader2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'
import { EnRouteModal } from '@/components/jobs/en-route-modal'
import { JobPhotosModal } from '@/components/jobs/job-photos-modal'
import { getTodayInTimezone } from '@/lib/booking/availability'
import { cn } from '@/lib/utils'

interface FieldJob {
  id: string
  job_number: string
  title: string
  description?: string | null
  status: 'scheduled' | 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_start: string
  scheduled_end?: string | null
  en_route_at?: string | null
  arrived_at?: string | null
  started_at?: string | null
  completed_at?: string | null
  notes?: string | null
  tracking_token?: string | null
  crew_id?: string | null
  assigned_to?: string | null
  contact?: {
    id?: string
    name?: string | null
    phone: string
    address?: string | null
  } | null
  service?: {
    id: string
    name: string
    duration_minutes: number
  } | null
}

export default function FieldPage() {
  const router = useRouter()
  const supabase = createClient()
  const { orgName: wsOrgName, orgTimezone: wsOrgTimezone, role, isSuperAdmin } = useWorkspace()
  const isOwnerOrAdmin = role === 'owner' || role === 'admin' || isSuperAdmin
  const orgTimezone = wsOrgTimezone || 'America/Chicago'
  const orgName = wsOrgName || 'Our team'
  const [selectedDate, setSelectedDate] = useState(() => getTodayInTimezone(orgTimezone))
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)

  // En Route Modal
  const [enRouteJob, setEnRouteJob] = useState<FieldJob | null>(null)
  const [showEnRouteModal, setShowEnRouteModal] = useState(false)

  // Photos Modal
  const [photoJob, setPhotoJob] = useState<FieldJob | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  // New Note Modal / Inline
  const [activeNoteJobId, setActiveNoteJobId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ['field-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/client/jobs?limit=100')
      if (!res.ok) throw new Error('Failed to load field jobs')
      return res.json()
    },
    staleTime: 60 * 1000
  })

  const jobs: FieldJob[] = data?.jobs || data?.items || []
  const error = isError ? 'Failed to load field jobs' : null

  const loadFieldSchedule = useCallback(async () => {
    await refetch()
  }, [refetch])

  // Filter jobs for selected date
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      if (!j.scheduled_start) return false
      let jDate = ''
      try {
        jDate = new Intl.DateTimeFormat('en-CA', { timeZone: orgTimezone }).format(new Date(j.scheduled_start))
      } catch {
        jDate = j.scheduled_start.slice(0, 10)
      }
      return jDate === selectedDate
    })
  }, [jobs, selectedDate, orgTimezone])

  const handleDateChange = (direction: -1 | 1 | 0) => {
    if (direction === 0) {
      setSelectedDate(getTodayInTimezone(orgTimezone))
      return
    }
    const current = new Date(`${selectedDate}T12:00:00.000Z`)
    current.setDate(current.getDate() + direction)
    setSelectedDate(current.toISOString().slice(0, 10))
  }

  // 1-Tap Timestamp Action: Arrived, Started, Completed
  const handleTimestampAction = async (jobId: string, action: 'arrived' | 'started' | 'completed') => {
    setUpdatingJobId(jobId)
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/timestamp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (action === 'arrived') toast.success('Marked Arrived at job site!')
        if (action === 'started') toast.success('Work started!')
        if (action === 'completed') {
          const targetJob = jobs.find(j => j.id === jobId)
          const contactId = targetJob?.contact?.id
          if (isOwnerOrAdmin && contactId) {
            toast.success('Job completed! Ready to invoice customer?', {
              action: {
                label: 'Create Invoice',
                onClick: () => router.push(`/client/invoices?contact_id=${contactId}&title=${encodeURIComponent(targetJob?.title || 'Completed Job')}`)
              },
              duration: 8000
            })
          } else {
            toast.success('Job completed successfully! Review prompt dispatched.')
          }
        }
        loadFieldSchedule()
      } else {
        toast.error(data.error || 'Failed to update status')
      }
    } catch {
      toast.error('Network error updating status')
    } finally {
      setUpdatingJobId(null)
    }
  }

  // En Route submission
  const handleConfirmEnRoute = async ({
    technicianName,
    etaMinutes,
    notifyCustomer
  }: {
    technicianName: string
    etaMinutes: number
    notifyCustomer: boolean
  }) => {
    if (!enRouteJob) return
    try {
      const res = await fetch(`/api/client/jobs/${enRouteJob.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'en_route',
          technicianName,
          etaMinutes,
          notifyCustomer
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`En Route dispatched with ${etaMinutes}m ETA!`)
        setShowEnRouteModal(false)
        loadFieldSchedule()
      } else {
        toast.error(data.error || 'Failed to update status')
      }
    } catch {
      toast.error('Network error updating status')
    }
  }

  // Save Job Note from Field
  const handleSaveNote = async (jobId: string) => {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes: noteText.trim()
        })
      })

      if (res.ok) {
        toast.success('Field note added to job record')
        setNoteText('')
        setActiveNoteJobId(null)
        loadFieldSchedule()
      } else {
        toast.error('Failed to save field note')
      }
    } catch {
      toast.error('Network error saving note')
    } finally {
      setSavingNote(false)
    }
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-12">
      {/* Field Mobile Header */}
      <PageHeader
        title="Field Technician Portal"
        badge={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Dispatch</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-700/60 shadow-2xs">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDateChange(-1)}
              className="h-9 w-9 min-h-[44px] min-w-[44px] text-slate-700 dark:text-zinc-200"
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="px-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-100 min-w-28 text-center tabular-nums">
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric'
              }).format(new Date(`${selectedDate}T12:00:00.000Z`))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDateChange(1)}
              className="h-9 w-9 min-h-[44px] min-w-[44px] text-slate-700 dark:text-zinc-200"
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDateChange(0)}
              className="min-h-[44px] text-xs font-bold text-blue-600 dark:text-blue-400 px-3.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 cursor-pointer"
            >
              Today
            </Button>
          </div>
        }
      />

      {/* Main Jobs Route List */}
      {error ? (
        <ErrorState
          title="Field Connection Error"
          message={error}
          onRetry={loadFieldSchedule}
          retryLabel="Retry Loading Route"
        />
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 animate-pulse" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="No Field Jobs Scheduled"
          description={`You have no active service jobs or routes assigned for ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${selectedDate}T12:00:00.000Z`))}.`}
          actionLabel="Check Today's Schedule"
          onAction={() => handleDateChange(0)}
        />
      ) : (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-500 dark:text-zinc-400 px-1">
            {filteredJobs.length} Job{filteredJobs.length !== 1 ? 's' : ''} on today&apos;s itinerary
          </div>

          {filteredJobs.map((job, idx) => {
            const isBusy = updatingJobId === job.id
            const startTimeStr = new Intl.DateTimeFormat('en-US', {
              timeZone: orgTimezone,
              hour: 'numeric',
              minute: '2-digit'
            }).format(new Date(job.scheduled_start))

            // Duration calculation
            let durationMins: number | null = null
            if (job.started_at && job.completed_at) {
              durationMins = Math.round(
                (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 60000
              )
            }

            return (
              <div
                key={job.id}
                className={cn(
                  "rounded-2xl border p-4 sm:p-5 bg-white dark:bg-zinc-900 shadow-xs space-y-4 transition-all",
                  job.status === 'in_progress'
                    ? "border-blue-500 ring-1 ring-blue-500/30"
                    : job.status === 'en_route'
                    ? "border-amber-400 ring-1 ring-amber-400/30"
                    : job.status === 'completed'
                    ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                    : "border-slate-200/90 dark:border-zinc-800"
                )}
              >
                {/* Header: Stop Index, Time Window & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {startTimeStr}
                    </span>
                    {job.job_number && (
                      <span className="text-[11px] font-mono text-slate-400">#{job.job_number}</span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <Badge
                    variant={
                      job.status === 'completed'
                        ? 'success'
                        : job.status === 'in_progress'
                        ? 'info'
                        : job.status === 'en_route'
                        ? 'warning'
                        : 'neutral'
                    }
                    size="default"
                    className="font-bold uppercase tracking-wider text-[11px]"
                  >
                    {job.status === 'in_progress' ? 'Working' : job.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Job Title & Description */}
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    {job.title}
                  </h2>
                  {job.service?.name && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                      Service: {job.service.name}
                    </div>
                  )}
                  {job.description && (
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {job.description}
                    </p>
                  )}
                </div>

                {/* Customer Details & 1-Tap Navigation / Call */}
                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                      {job.contact?.name || 'Customer'}
                    </div>
                    {job.contact?.address && (
                      <div className="text-slate-600 dark:text-zinc-400 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{job.contact.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {job.contact?.address && (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(job.contact.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                        aria-label={`Navigate to ${job.contact.address}`}
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Navigate</span>
                      </a>
                    )}
                    {job.contact?.phone && (
                      <a
                        href={`tel:${job.contact.phone}`}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                        aria-label={`Call ${job.contact.name || 'customer'} at ${job.contact.phone}`}
                      >
                        <Phone className="w-4 h-4 text-emerald-600" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>
                </div>

                {/* Field Notes Section */}
                {job.notes && (
                  <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                    <div className="font-semibold flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Special Job Notes
                    </div>
                    <div className="whitespace-pre-line text-[11px]">{job.notes}</div>
                  </div>
                )}

                {/* 1-Tap Big Glove-Friendly Action Buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2">
                  {/* Scheduled or Confirmed -> En Route / Arrived */}
                  {['scheduled', 'confirmed'].includes(job.status) && (
                    <>
                      <Button
                        size="touch"
                        disabled={isBusy}
                        onClick={() => {
                          setEnRouteJob(job)
                          setShowEnRouteModal(true)
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs"
                      >
                        <Truck className="w-4 h-4" />
                        <span>On My Way (Send ETA)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'arrived')}
                        className="text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 font-semibold"
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 text-emerald-600" />}
                        <span>Mark Arrived</span>
                      </Button>
                    </>
                  )}

                  {/* En Route -> Arrived / Start Work */}
                  {job.status === 'en_route' && (
                    <>
                      <Button
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'arrived')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                        <span>I Have Arrived</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'started')}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 font-semibold"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Work Now</span>
                      </Button>
                    </>
                  )}

                  {/* In Progress -> Photos / Complete */}
                  {job.status === 'in_progress' && (
                    <>
                      <Button
                        variant="outline"
                        size="touch"
                        onClick={() => {
                          setPhotoJob(job)
                          setShowPhotoModal(true)
                        }}
                        className="border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-2xs"
                      >
                        <Camera className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span>Add Photos Proof</span>
                      </Button>

                      <Button
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'completed')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs"
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Complete Job</span>
                      </Button>
                    </>
                  )}

                  {/* Completed -> Summary, Photos View & Create Invoice */}
                  {job.status === 'completed' && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Finished{durationMins ? ` (${durationMins}m on site)` : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPhotoJob(job)
                          setShowPhotoModal(true)
                        }}
                        className="h-8 text-xs text-blue-600 dark:text-blue-400"
                      >
                        <Camera className="w-3.5 h-3.5 mr-1" />
                        View Photos
                      </Button>
                      {Boolean(isOwnerOrAdmin && job.contact?.id) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/client/invoices?contact_id=${job.contact?.id}&title=${encodeURIComponent(job.title || 'Completed Job')}`)}
                          className="h-8 text-xs font-semibold text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                        >
                          <Receipt className="w-3.5 h-3.5 mr-1" />
                          Create Invoice
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Photos & Notes Quick Actions */}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPhotoJob(job)
                        setShowPhotoModal(true)
                      }}
                      className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Photos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setActiveNoteJobId(activeNoteJobId === job.id ? null : job.id)
                        setNoteText('')
                      }}
                      className="h-9 px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200"
                    >
                      + Note
                    </Button>
                  </div>
                </div>

                {/* Inline Note Composer */}
                {activeNoteJobId === job.id && (
                  <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 space-y-2">
                    <textarea
                      placeholder="Add field notes (e.g. replaced 2.5 ton capacitor, tested voltage, clean)..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none h-20"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveNoteJobId(null)}
                        className="h-8 text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingNote || !noteText.trim()}
                        onClick={() => handleSaveNote(job.id)}
                        className="h-8 text-xs bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-semibold"
                      >
                        {savingNote ? 'Saving...' : 'Save Note'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* En Route Modal */}
      <EnRouteModal
        isOpen={showEnRouteModal}
        onClose={() => setShowEnRouteModal(false)}
        job={enRouteJob}
        organizationName={orgName}
        onConfirm={handleConfirmEnRoute}
      />

      {/* Photo Verification Modal */}
      <JobPhotosModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        job={photoJob}
        onPhotosUpdated={loadFieldSchedule}
      />
    </div>
  )
}
