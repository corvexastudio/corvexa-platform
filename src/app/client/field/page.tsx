'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
  MessageSquare,
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
  ChevronRight,
  Key,
  DollarSign,
  ArrowRight,
  ExternalLink,
  LayoutDashboard
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
  status: 'draft' | 'scheduled' | 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
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
  crew?: {
    id: string
    name: string
    van_identifier?: string | null
    phone_number?: string | null
  } | null
  contact?: {
    id?: string
    name?: string | null
    phone: string
    email?: string | null
    address?: string | null
    notes?: string | null
  } | null
  service?: {
    id: string
    name: string
    duration_minutes: number
  } | null
  invoices?: Array<{
    id: string
    invoice_number: string
    total: number
    status: string
    amount_paid?: number
    amount_due?: number
    paid_at?: string | null
    manage_token?: string
  }>
}

interface CrewItem {
  id: string
  name: string
  color_code?: string | null
  color?: string | null
  van_identifier?: string | null
  phone_number?: string | null
  crew_lead_id?: string | null
  member_ids?: string[]
}

export default function FieldPage() {
  const router = useRouter()
  const { orgName: wsOrgName, orgTimezone: wsOrgTimezone, role, isSuperAdmin, userId } = useWorkspace()
  const isOwnerOrAdmin = role === 'owner' || role === 'admin' || isSuperAdmin
  const orgTimezone = wsOrgTimezone || 'America/Chicago'
  const orgName = wsOrgName || 'Our team'
  const [selectedDate, setSelectedDate] = useState(() => getTodayInTimezone(orgTimezone))
  const [selectedCrewId, setSelectedCrewId] = useState<string>('all')
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null)

  // En Route Modal
  const [enRouteJob, setEnRouteJob] = useState<FieldJob | null>(null)
  const [showEnRouteModal, setShowEnRouteModal] = useState(false)

  // Photos Modal
  const [photoJob, setPhotoJob] = useState<FieldJob | null>(null)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  // Field Note Inline Composer
  const [activeNoteJobId, setActiveNoteJobId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // Fetch Jobs Route Data
  const { data, isLoading: loading, isError, refetch } = useQuery({
    queryKey: ['field-jobs'],
    queryFn: async () => {
      const res = await fetch('/api/client/jobs?limit=100')
      if (!res.ok) throw new Error('Failed to load field jobs')
      return res.json()
    },
    staleTime: 45 * 1000
  })

  // Fetch Crews for Multi-Van routing & filtering
  const { data: crewsData } = useQuery({
    queryKey: ['field-crews'],
    queryFn: async () => {
      const res = await fetch('/api/client/crews')
      if (!res.ok) return { crews: [] }
      return res.json()
    },
    staleTime: 60 * 1000
  })

  const crews: CrewItem[] = crewsData?.crews || []

  // Auto-select technician's assigned van if logged in as technician
  useEffect(() => {
    if (!isOwnerOrAdmin && userId && crews.length > 0) {
      const myCrew = crews.find(c => c.crew_lead_id === userId || (Array.isArray(c.member_ids) && c.member_ids.includes(userId)))
      if (myCrew) {
        setSelectedCrewId(myCrew.id)
      }
    }
  }, [isOwnerOrAdmin, userId, crews])

  const jobs: FieldJob[] = data?.jobs || data?.items || []
  const error = isError ? 'Failed to load field jobs' : null

  const loadFieldSchedule = useCallback(async () => {
    await refetch()
  }, [refetch])

  // All jobs on selected date across the whole company
  const jobsForDay = useMemo(() => {
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

  // Filter jobs for selected date AND selected crew/van
  const filteredJobs = useMemo(() => {
    return jobsForDay.filter(j => {
      if (selectedCrewId === 'all') return true
      if (selectedCrewId === 'unassigned') return !j.crew_id
      return j.crew_id === selectedCrewId
    })
  }, [jobsForDay, selectedCrewId])

  // Route HUD Summary Stats
  const routeStats = useMemo(() => {
    const total = filteredJobs.length
    const completed = filteredJobs.filter(j => j.status === 'completed').length
    const working = filteredJobs.filter(j => j.status === 'in_progress').length
    const enRoute = filteredJobs.filter(j => j.status === 'en_route').length
    const remaining = total - completed
    return { total, completed, working, enRoute, remaining }
  }, [filteredJobs])

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
        if (action === 'started') toast.success('Work timer started!')
        if (action === 'completed') {
          const draftInv = data.invoice
          const targetJob = jobs.find(j => j.id === jobId)
          const contactId = targetJob?.contact?.id
          if (isOwnerOrAdmin) {
            if (draftInv) {
              if (draftInv.status === 'paid') {
                toast.success(`Job completed! Invoice #${draftInv.invoice_number} is already paid.`, {
                  action: {
                    label: 'View Invoice',
                    onClick: () => router.push(`/client/invoices?search=${encodeURIComponent(draftInv.invoice_number)}`)
                  },
                  duration: 6000
                })
              } else {
                toast.success(`Job completed! Invoice #${draftInv.invoice_number} generated.`, {
                  action: {
                    label: 'Collect Payment',
                    onClick: () => router.push(`/client/invoices?search=${encodeURIComponent(draftInv.invoice_number)}&pay=true`)
                  },
                  duration: 8000
                })
              }
            } else if (contactId) {
              toast.success('Job completed! Ready to invoice homeowner?', {
                action: {
                  label: 'Create Invoice',
                  onClick: () => router.push(`/client/invoices?create=true&contact_id=${contactId}&job_id=${jobId}&title=${encodeURIComponent(targetJob?.title || 'Completed Job')}`)
                },
                duration: 8000
              })
            } else {
              toast.success('Job completed! Google Review booster dispatched.')
            }
          } else {
            toast.success('Job completed successfully! Office draft invoice created.')
          }
        }
        loadFieldSchedule()
      } else {
        toast.error(data.error || 'Failed to update job status')
      }
    } catch {
      toast.error('Network error updating job status')
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
        toast.success(`En Route dispatched with ${etaMinutes}m ETA SMS!`)
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
    <div className="space-y-4 max-w-3xl mx-auto pb-16">
      
      {/* FIELD COMPANION HEADER */}
      <PageHeader
        title="Field Truck Portal"
        badge={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Truck Route Active</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2">
            {isOwnerOrAdmin && (
              <Link
                href="/client/dashboard"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 shadow-2xs transition-colors cursor-pointer min-h-[44px]"
                title="Return to Office Dashboard"
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-slate-500" />
                <span>Office</span>
              </Link>
            )}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 p-1 rounded-xl border border-slate-200 dark:border-zinc-700/60 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDateChange(-1)}
                className="h-10 w-10 min-h-[44px] min-w-[44px] text-slate-700 dark:text-zinc-200 cursor-pointer"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="px-3 text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 min-w-32 text-center tabular-nums">
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
                className="h-10 w-10 min-h-[44px] min-w-[44px] text-slate-700 dark:text-zinc-200 cursor-pointer"
                aria-label="Next day"
              >
                <ChevronRight className="h-5 w-5" />
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
          </div>
        }
      />

      {/* MULTI-VAN / FLEET CREW SELECTOR PILL BAR */}
      {crews.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCrewId('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] flex items-center gap-1.5 shrink-0",
              selectedCrewId === 'all'
                ? "bg-slate-900 text-white dark:bg-white dark:text-zinc-900 shadow-2xs"
                : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
            )}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>All Vans ({jobsForDay.length})</span>
          </button>
          {crews.map(crew => {
            const count = jobsForDay.filter(j => j.crew_id === crew.id).length
            const isSelected = selectedCrewId === crew.id
            return (
              <button
                key={crew.id}
                type="button"
                onClick={() => setSelectedCrewId(crew.id)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[38px] flex items-center gap-1.5 shrink-0 border",
                  isSelected
                    ? "bg-blue-600 border-blue-600 text-white shadow-2xs"
                    : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-zinc-700"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: crew.color_code || crew.color || '#3b82f6' }}
                />
                <span>{crew.name}{crew.van_identifier ? ` (${crew.van_identifier})` : ''}</span>
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-mono",
                  isSelected
                    ? "bg-blue-700 text-white"
                    : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ROUTE HEADS-UP DISPLAY (HUD) METRIC TOKENS */}
      {filteredJobs.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Stops
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900 dark:text-zinc-100 tabular-nums">
                {routeStats.total}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                scheduled
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Completed
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {routeStats.completed}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                closed
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Remaining
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                {routeStats.remaining}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                in route
              </span>
            </div>
          </div>
        </div>
      )}

      {/* MAIN ROUTE ITINERARY FEED */}
      {error ? (
        <ErrorState
          title="Field Connection Error"
          message={error}
          onRetry={loadFieldSchedule}
          retryLabel="Retry Loading Route"
        />
      ) : loading ? (
        <div className="space-y-3.5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 animate-pulse" />
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

            // Elapsed active work timer if in_progress
            let elapsedWorkMins: number | null = null
            if (job.status === 'in_progress' && job.started_at) {
              elapsedWorkMins = Math.max(1, Math.round((Date.now() - new Date(job.started_at).getTime()) / 60000))
            }

            // Has special property / gate instructions
            const hasPropertyInstructions = Boolean(job.contact?.notes || job.notes)

            return (
              <div
                key={job.id}
                className={cn(
                  "rounded-2xl border p-4 sm:p-5 bg-white dark:bg-zinc-900 shadow-xs space-y-4 transition-all",
                  job.status === 'in_progress'
                    ? "border-blue-500 ring-2 ring-blue-500/20"
                    : job.status === 'en_route'
                    ? "border-amber-400 ring-2 ring-amber-400/20"
                    : job.status === 'completed'
                    ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/15 dark:bg-emerald-950/10"
                    : "border-slate-200/90 dark:border-zinc-800"
                )}
              >
                {/* Header: Stop Number, Scheduled Time & Status */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="h-7 w-7 rounded-lg bg-slate-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center text-xs font-bold shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-zinc-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{startTimeStr}</span>
                        {job.job_number && (
                          <span className="text-[11px] font-mono text-slate-400 font-normal">({job.job_number})</span>
                        )}
                        {job.crew?.name && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-300 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md ml-1 border border-slate-200 dark:border-zinc-700">
                            <Truck className="w-3 h-3 text-slate-500" />
                            <span>{job.crew.name}</span>
                          </span>
                        )}
                      </div>
                    </div>
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
                    className="font-bold uppercase tracking-wider text-[11px] px-2.5 py-1"
                  >
                    {job.status === 'in_progress' ? 'Working On Site' : job.status.replace('_', ' ')}
                  </Badge>
                </div>

                {/* Job Title & Service Description */}
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                    {job.title}
                  </h2>
                  {job.service?.name && (
                    <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                      Service: {job.service.name}
                    </div>
                  )}
                  {job.description && (
                    <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>
                  )}
                </div>

                {/* GATE CODES, PROPERTY ACCESS & SAFETY WARNINGS (HIGH-VISIBILITY DAYLIGHT BOX) */}
                {hasPropertyInstructions && (
                  <div className="p-3.5 rounded-xl border border-amber-300/80 dark:border-amber-800/80 bg-amber-50/80 dark:bg-amber-950/30 text-xs text-amber-950 dark:text-amber-200 space-y-1.5 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span className="uppercase tracking-wider text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                        Gate Code & Property Access Notes
                      </span>
                    </div>
                    {job.contact?.notes && (
                      <div className="text-xs font-bold leading-relaxed whitespace-pre-line pl-5 text-amber-900 dark:text-amber-100">
                        {job.contact.notes}
                      </div>
                    )}
                    {job.notes && (
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 pt-1 border-t border-amber-200/80 dark:border-amber-800/50 pl-5">
                        <span className="font-bold">Job Instructions: </span>{job.notes}
                      </div>
                    )}
                  </div>
                )}

                {/* CUSTOMER CONTACT & 48PX TRUCK NAVIGATION RAIL */}
                <div className="p-3.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/90 dark:bg-zinc-950/60 space-y-3">
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                      {job.contact?.name || 'Homeowner'}
                    </div>
                    {job.contact?.address && (
                      <div className="text-xs text-slate-600 dark:text-zinc-400 flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="font-medium">{job.contact.address}</span>
                      </div>
                    )}
                  </div>

                  {/* 48px Truck Touch Buttons (Call, Text, Navigate) */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/70 dark:border-zinc-800">
                    {/* 1-Tap Navigation */}
                    {job.contact?.address ? (
                      <a
                        href={`https://maps.google.com/?q=${encodeURIComponent(job.contact.address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        aria-label={`Navigate to ${job.contact.address}`}
                      >
                        <Navigation className="w-4 h-4 shrink-0" />
                        <span>Navigate</span>
                      </a>
                    ) : (
                      <div className="min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-400 text-xs font-semibold flex items-center justify-center">
                        No Address
                      </div>
                    )}

                    {/* 1-Tap Call */}
                    {job.contact?.phone ? (
                      <a
                        href={`tel:${job.contact.phone}`}
                        className="min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        aria-label={`Call ${job.contact.name || 'customer'} at ${job.contact.phone}`}
                      >
                        <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Call</span>
                      </a>
                    ) : (
                      <div className="min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-400 text-xs font-semibold flex items-center justify-center">
                        No Phone
                      </div>
                    )}

                    {/* 1-Tap Text / SMS */}
                    {job.contact?.phone ? (
                      <a
                        href={`sms:${job.contact.phone}`}
                        className="min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        aria-label={`Text ${job.contact.name || 'customer'} at ${job.contact.phone}`}
                      >
                        <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>Text</span>
                      </a>
                    ) : (
                      <div className="min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-400 text-xs font-semibold flex items-center justify-center">
                        No SMS
                      </div>
                    )}
                  </div>
                </div>

                {/* ACTIVE WORKING TIMER HUD */}
                {job.status === 'in_progress' && elapsedWorkMins && (
                  <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 font-bold">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Active Work Timer Running:</span>
                    </div>
                    <span className="tabular-nums font-mono text-sm">{elapsedWorkMins}m on site</span>
                  </div>
                )}

                {/* 50PX GLOVE-FRIENDLY TACTILE STATE MACHINE ACTION BAR */}
                <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2.5">
                  {/* Scheduled or Confirmed -> On My Way / Mark Arrived */}
                  {['scheduled', 'confirmed'].includes(job.status) && (
                    <>
                      <Button
                        size="touch"
                        disabled={isBusy}
                        onClick={() => {
                          setEnRouteJob(job)
                          setShowEnRouteModal(true)
                        }}
                        className="min-h-[48px] flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs cursor-pointer gap-2"
                      >
                        <Truck className="w-4.5 h-4.5" />
                        <span>On My Way (Send ETA SMS)</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'arrived')}
                        className="min-h-[48px] text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-700 font-bold cursor-pointer gap-1.5"
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
                        className="min-h-[48px] flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer gap-2"
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4.5 h-4.5" />}
                        <span>I Have Arrived</span>
                      </Button>

                      <Button
                        variant="outline"
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'started')}
                        className="min-h-[48px] text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 font-bold cursor-pointer gap-1.5"
                      >
                        <Play className="w-4 h-4" />
                        <span>Start Work Now</span>
                      </Button>
                    </>
                  )}

                  {/* In Progress -> Photos Proof / Complete Job */}
                  {job.status === 'in_progress' && (
                    <>
                      <Button
                        variant="outline"
                        size="touch"
                        onClick={() => {
                          setPhotoJob(job)
                          setShowPhotoModal(true)
                        }}
                        className="min-h-[48px] border-blue-300 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-2xs cursor-pointer gap-2"
                      >
                        <Camera className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                        <span>Add Photo Proof</span>
                      </Button>

                      <Button
                        size="touch"
                        disabled={isBusy}
                        onClick={() => handleTimestampAction(job.id, 'completed')}
                        className="min-h-[48px] flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-xs cursor-pointer gap-2"
                      >
                        {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4.5 h-4.5" />}
                        <span>Complete Job</span>
                      </Button>
                    </>
                  )}

                  {/* Completed -> Duration, Photos & 1-Tap On-Site Payment */}
                  {job.status === 'completed' && (() => {
                    const linkedInvoice = Array.isArray(job.invoices) && job.invoices.length > 0
                      ? (job.invoices.find(i => i.status === 'paid') || job.invoices[0])
                      : null
                    const isPaid = linkedInvoice?.status === 'paid'

                    return (
                      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Finished{durationMins ? ` (${durationMins}m on site)` : ''}</span>
                          </span>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPhotoJob(job)
                              setShowPhotoModal(true)
                            }}
                            className="min-h-[40px] text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 mr-1" />
                            View Photos
                          </Button>
                        </div>

                        {/* Financial Action / Status Badge */}
                        {isPaid && linkedInvoice ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Paid • ${Number(linkedInvoice.total || 0).toFixed(2)}</span>
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/client/invoices?search=${encodeURIComponent(linkedInvoice.invoice_number)}`)}
                              className="min-h-[40px] px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 border-slate-200 dark:border-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100 cursor-pointer gap-1"
                              title="View Invoice"
                            >
                              <Receipt className="w-3.5 h-3.5 text-slate-400" />
                              <span>#{linkedInvoice.invoice_number}</span>
                            </Button>
                          </div>
                        ) : linkedInvoice ? (
                          Boolean(isOwnerOrAdmin) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/client/invoices?search=${encodeURIComponent(linkedInvoice.invoice_number)}&pay=true`)}
                              className="min-h-[44px] px-3.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 cursor-pointer shadow-2xs gap-1.5"
                            >
                              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                              <span>Collect Payment (#{linkedInvoice.invoice_number} • ${Number(linkedInvoice.total || 0).toFixed(2)})</span>
                            </Button>
                          )
                        ) : (
                          Boolean(isOwnerOrAdmin && job.contact?.id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/client/invoices?create=true&contact_id=${job.contact?.id}&job_id=${job.id}&title=${encodeURIComponent(job.title || 'Completed Job')}`)}
                              className="min-h-[44px] px-3.5 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 cursor-pointer shadow-2xs gap-1.5"
                            >
                              <Receipt className="w-3.5 h-3.5 text-blue-600" />
                              <span>Create Invoice</span>
                            </Button>
                          )
                        )}
                      </div>
                    )
                  })()}

                  {/* Quick Photo & Note Action Pills */}
                  {job.status !== 'completed' && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPhotoJob(job)
                          setShowPhotoModal(true)
                        }}
                        className="min-h-[40px] px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
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
                        className="min-h-[40px] px-2.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
                      >
                        + Note
                      </Button>
                    </div>
                  )}
                </div>

                {/* Inline Field Note Composer */}
                {activeNoteJobId === job.id && (
                  <div className="pt-3 border-t border-slate-100 dark:border-zinc-800/80 space-y-2.5">
                    <textarea
                      placeholder="Add field notes (e.g. replaced 2.5 ton dual capacitor, checked voltage, gate locked upon departure)..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                      className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 resize-none h-24 leading-relaxed"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveNoteJobId(null)}
                        className="min-h-[40px] text-xs cursor-pointer"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        disabled={savingNote || !noteText.trim()}
                        onClick={() => handleSaveNote(job.id)}
                        className="min-h-[40px] text-xs bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold cursor-pointer"
                      >
                        {savingNote ? 'Saving...' : 'Save Field Note'}
                      </Button>
                    </div>
                  </div>
                )}

              </div>
            )
          })}
        </div>
      )}

      {/* En Route ETA Modal */}
      <EnRouteModal
        isOpen={showEnRouteModal}
        onClose={() => setShowEnRouteModal(false)}
        job={enRouteJob}
        organizationName={orgName}
        onConfirm={handleConfirmEnRoute}
      />

      {/* Photo Proof Modal */}
      <JobPhotosModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        job={photoJob}
        onPhotosUpdated={loadFieldSchedule}
      />

    </div>
  )
}
