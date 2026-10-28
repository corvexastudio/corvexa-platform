'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { EnRouteModal } from '@/components/jobs/en-route-modal'
import { JobPhotosModal } from '@/components/jobs/job-photos-modal'
import { RecurringPlanModal } from '@/components/jobs/recurring-plan-modal'
import { ReassignCrewModal } from '@/components/crews/reassign-crew-modal'
import { CrewModal } from '@/components/crews/crew-modal'
import { exportToCsv } from '@/lib/export/csv-export'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'
import { getTodayInTimezone, getSelectableDatesInTimezone } from '@/lib/booking/availability'
import { type Crew } from '@/lib/crews/crew-manager'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Briefcase,
  Truck,
  Repeat,
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  Navigation,
  Plus,
  Search,
  Filter,
  Download,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Camera,
  Receipt,
  Loader2,
  X,
  Pause,
  PlayCircle,
  Trash2,
  Sliders,
  Users
} from 'lucide-react'

export interface JobItem {
  id: string
  job_number: string
  title: string
  description?: string | null
  status: 'scheduled' | 'confirmed' | 'en_route' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  scheduled_start: string
  scheduled_end?: string | null
  en_route_at?: string | null
  arrived_at?: string | null
  completed_at?: string | null
  notes?: string | null
  tracking_token?: string | null
  technician_name?: string | null
  eta_minutes?: number | null
  crew_id?: string | null
  contact?: {
    id?: string
    name?: string | null
    phone: string
    email?: string | null
    address?: string | null
  } | null
  service?: {
    id?: string
    name: string
    duration_minutes: number
    price?: number | null
  } | null
  crew?: {
    id: string
    name: string
    color: string
    van_identifier?: string | null
    phone_number?: string | null
  } | null
  quote?: {
    id: string
    quote_number: string
    total: number
  } | null
  appointment?: {
    id: string
    start_time: string
    end_time?: string | null
  } | null
}

export type ViewMode = 'agenda' | 'list' | 'calendar' | 'crews' | 'recurring'

interface ScheduleDispatchHubProps {
  defaultView?: ViewMode
}

export function ScheduleDispatchHub({ defaultView = 'agenda' }: ScheduleDispatchHubProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Primary State
  const initialView = (searchParams.get('view') as ViewMode) || defaultView
  const [activeView, setActiveView] = useState<ViewMode>(initialView)
  const [jobs, setJobs] = useState<JobItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Meta State
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [orgName, setOrgName] = useState<string>('')
  const [orgTimezone, setOrgTimezone] = useState<string>('America/Chicago')
  const [contacts, setContacts] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [crews, setCrews] = useState<Crew[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [crewFilter, setCrewFilter] = useState<string>('all')
  const [dateRangeFilter, setDateRangeFilter] = useState<'all' | 'today'>('all')

  // Date Nav (Agenda & Month Calendar)
  const todayDateStr = useMemo(() => getTodayInTimezone(orgTimezone), [orgTimezone])
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr)
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())

  // Slide-Out Drawer & Modal States
  const [activeDrawerJob, setActiveDrawerJob] = useState<JobItem | null>(null)
  const [enRouteJob, setEnRouteJob] = useState<JobItem | null>(null)
  const [photoJob, setPhotoJob] = useState<JobItem | null>(null)
  const [reassignJob, setReassignJob] = useState<JobItem | null>(null)
  const [showCreateJobModal, setShowCreateJobModal] = useState(false)
  const [showRecurringModal, setShowRecurringModal] = useState(false)
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null)

  // Recurring Plans State
  const [recurringTemplates, setRecurringTemplates] = useState<any[]>([])
  const [loadingRecurring, setLoadingRecurring] = useState(false)
  const [runningSpawner, setRunningSpawner] = useState(false)

  // Create Job Form State
  const [newContactId, setNewContactId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newServiceId, setNewServiceId] = useState('')
  const [newScheduledDate, setNewScheduledDate] = useState('')
  const [newScheduledTime, setNewScheduledTime] = useState('09:00')
  const [newCrewId, setNewCrewId] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [submittingCreate, setSubmittingCreate] = useState(false)

  // 7-day quick date navigation pills strictly aligned with US business timezone
  const quickDatePills = useMemo(() => {
    return getSelectableDatesInTimezone(orgTimezone || 'America/Chicago', 7)
  }, [orgTimezone])

  // Update URL view parameter cleanly
  const handleViewChange = (newView: ViewMode) => {
    setActiveView(newView)
    const currentUrl = new URL(window.location.href)
    currentUrl.searchParams.set('view', newView)
    window.history.replaceState({}, '', currentUrl.toString())
  }

  // Handle URL query parameters for direct modal creation triggers
  useEffect(() => {
    if (searchParams.get('create') === 'true' || searchParams.get('new') === 'true') {
      const custId = searchParams.get('customerId') || searchParams.get('contact_id')
      if (custId) setNewContactId(custId)
      setShowCreateJobModal(true)
    }
  }, [searchParams])

  // Load Organization & Profile Settings
  useEffect(() => {
    async function loadOrgContext() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || !profile.org_id) return

      const { data: org } = await supabase
        .from('organizations')
        .select('name, slug, timezone')
        .eq('id', profile.org_id)
        .single()

      if (org) {
        if (org.name) setOrgName(org.name)
        if (org.slug) setOrgSlug(org.slug)
        if (org.timezone) setOrgTimezone(org.timezone)
      }

      const { data: members } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('org_id', profile.org_id)
      if (members) setTeamMembers(members)
    }
    loadOrgContext()
  }, [])

  // Load Reference Data (Contacts, Services, Crews)
  const loadReferenceData = useCallback(async () => {
    try {
      const [contactsRes, servicesRes, crewsRes] = await Promise.all([
        fetch('/api/client/customers?limit=100').catch(() => null),
        fetch('/api/client/services').catch(() => null),
        fetch('/api/client/crews').catch(() => null)
      ])

      if (contactsRes?.ok) {
        const data = await contactsRes.json()
        setContacts(data.customers || [])
      }
      if (servicesRes?.ok) {
        const data = await servicesRes.json()
        setServices(data.services || [])
      }
      if (crewsRes?.ok) {
        const data = await crewsRes.json()
        setCrews(data.crews || [])
      }
    } catch {
      // Non-fatal
    }
  }, [])

  // Load Master Jobs & Appointments Dataset
  const loadJobs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/client/jobs?limit=100')
      if (!res.ok) {
        throw new Error('Failed to load dispatch schedule. Please try again.')
      }
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (err: any) {
      setError(err?.message || 'Error loading schedule')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load Recurring Templates
  const loadRecurringTemplates = useCallback(async () => {
    setLoadingRecurring(true)
    try {
      const res = await fetch('/api/client/recurring-jobs')
      if (res.ok) {
        const data = await res.json()
        setRecurringTemplates(data.templates || [])
      }
    } catch {
      toast.error('Failed to load recurring maintenance plans.')
    } finally {
      setLoadingRecurring(false)
    }
  }, [])

  useEffect(() => {
    loadJobs()
    loadReferenceData()
  }, [loadJobs, loadReferenceData])

  useEffect(() => {
    if (activeView === 'recurring') {
      loadRecurringTemplates()
    }
  }, [activeView, loadRecurringTemplates])

  // Realtime Subscriptions for Dispatch Sync
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('schedule-dispatch-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          loadJobs()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadJobs])

  // Job Status Mutation
  const handleUpdateStatus = async (
    jobId: string,
    newStatus: JobItem['status'],
    options?: { etaMinutes?: number; notifyCustomer?: boolean; technicianName?: string }
  ) => {
    setStatusUpdatingId(jobId)
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          etaMinutes: options?.etaMinutes,
          notifyCustomer: options?.notifyCustomer ?? false,
          technicianName: options?.technicianName
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const statusLabels: Record<string, string> = {
          en_route: 'Marked En Route. Homeowner notified via SMS.',
          in_progress: 'Job started. Clock is running.',
          completed: 'Job marked complete.',
          cancelled: 'Job cancelled.'
        }
        toast.success(statusLabels[newStatus] || `Status updated to ${newStatus}`)
        loadJobs()

        // Keep active drawer in sync
        if (activeDrawerJob && activeDrawerJob.id === jobId) {
          setActiveDrawerJob({
            ...activeDrawerJob,
            status: newStatus,
            eta_minutes: options?.etaMinutes ?? activeDrawerJob.eta_minutes
          })
        }
      } else {
        toast.error(data.error || 'Failed to update job status.')
      }
    } catch {
      toast.error('Network error updating status.')
    } finally {
      setStatusUpdatingId(null)
    }
  }

  // Create Job Handler
  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContactId) {
      toast.error('Please select or create a customer.')
      return
    }
    if (!newTitle.trim()) {
      toast.error('Please provide a job title.')
      return
    }
    if (!newScheduledDate) {
      toast.error('Please choose a scheduled date.')
      return
    }

    setSubmittingCreate(true)
    try {
      const scheduledDateTime = new Date(`${newScheduledDate}T${newScheduledTime || '09:00'}:00`).toISOString()

      const res = await fetch('/api/client/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: newContactId,
          title: newTitle.trim(),
          scheduledStart: scheduledDateTime,
          serviceId: newServiceId || undefined,
          crewId: newCrewId || undefined,
          notes: newNotes.trim() || undefined
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Job ${data.job?.job_number || ''} scheduled successfully!`)
        setShowCreateJobModal(false)
        setNewTitle('')
        setNewScheduledDate('')
        setNewNotes('')
        setNewServiceId('')
        setNewCrewId('')
        loadJobs()
      } else {
        toast.error(data.error || 'Failed to schedule job.')
      }
    } catch {
      toast.error('Network error scheduling job.')
    } finally {
      setSubmittingCreate(false)
    }
  }

  // Recurring Plan Mutations
  const handleToggleRecurringStatus = async (templateId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active'
    try {
      const res = await fetch(`/api/client/recurring-jobs/${templateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      if (res.ok) {
        toast.success(`Plan ${newStatus === 'active' ? 'resumed' : 'paused'}`)
        loadRecurringTemplates()
      } else {
        toast.error('Failed to update recurring plan.')
      }
    } catch {
      toast.error('Network error.')
    }
  }

  const handleDeleteRecurringTemplate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/client/recurring-jobs/${templateId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Recurring plan deleted.')
        loadRecurringTemplates()
      } else {
        toast.error('Failed to delete plan.')
      }
    } catch {
      toast.error('Network error.')
    }
  }

  const handleRunAutonomousSpawner = async () => {
    setRunningSpawner(true)
    try {
      const res = await fetch('/api/client/recurring-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate' })
      })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Autonomous job engine generated ${data.generatedCount || 0} scheduled visit(s)!`)
        loadRecurringTemplates()
        loadJobs()
      } else {
        toast.error(data.error || 'Failed to run autonomous spawner.')
      }
    } catch {
      toast.error('Network error running autonomous spawner.')
    } finally {
      setRunningSpawner(false)
    }
  }

  // Filtered Jobs Computation
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = job.title?.toLowerCase().includes(q)
        const matchNumber = job.job_number?.toLowerCase().includes(q)
        const matchCustomer = job.contact?.name?.toLowerCase().includes(q)
        const matchPhone = job.contact?.phone?.includes(q)
        const matchAddress = job.contact?.address?.toLowerCase().includes(q)
        if (!matchTitle && !matchNumber && !matchCustomer && !matchPhone && !matchAddress) {
          return false
        }
      }

      // Status filter
      if (statusFilter !== 'all') {
        if (job.status !== statusFilter) return false
      }

      // Crew filter
      if (crewFilter !== 'all') {
        if (crewFilter === 'unassigned') {
          if (job.crew_id) return false
        } else {
          if (job.crew_id !== crewFilter) return false
        }
      }

      // Date Range filter (List view)
      if (dateRangeFilter === 'today') {
        const jobDate = new Date(job.scheduled_start).toLocaleDateString('en-CA')
        if (jobDate !== todayDateStr) return false
      }

      return true
    })
  }, [jobs, searchQuery, statusFilter, crewFilter, dateRangeFilter, todayDateStr])

  // Agenda View: Jobs for Selected Date
  const agendaDateJobs = useMemo(() => {
    return jobs.filter(job => {
      const jobDate = new Date(job.scheduled_start).toLocaleDateString('en-CA')
      return jobDate === selectedDate
    }).sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
  }, [jobs, selectedDate])

  // Export CSV Handler
  const handleExportCsv = () => {
    exportToCsv<JobItem>('capto_schedule_dispatch', [
      { header: 'Job Number', accessor: (j: JobItem) => j.job_number },
      { header: 'Title', accessor: (j: JobItem) => j.title },
      { header: 'Status', accessor: (j: JobItem) => j.status },
      { header: 'Scheduled Start', accessor: (j: JobItem) => j.scheduled_start },
      { header: 'Customer Name', accessor: (j: JobItem) => j.contact?.name || 'Customer' },
      { header: 'Customer Phone', accessor: (j: JobItem) => j.contact?.phone },
      { header: 'Address', accessor: (j: JobItem) => j.contact?.address || '' },
      { header: 'Crew', accessor: (j: JobItem) => j.crew?.name || 'Unassigned' }
    ], filteredJobs)
    toast.success('Schedule exported to CSV.')
  }

  // Status Badge Helper
  const renderStatusBadge = (status: JobItem['status'], etaMinutes?: number | null) => {
    switch (status) {
      case 'en_route':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            En Route {etaMinutes ? `(~${etaMinutes}m)` : ''}
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            In Progress
          </span>
        )
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        )
      case 'cancelled':
      case 'no_show':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
            {status === 'no_show' ? 'No Show' : 'Cancelled'}
          </span>
        )
      case 'scheduled':
      case 'confirmed':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
            Scheduled
          </span>
        )
    }
  }

  // Summary Metrics
  const metrics = useMemo(() => {
    const todayCount = jobs.filter(j => new Date(j.scheduled_start).toLocaleDateString('en-CA') === todayDateStr).length
    const activeRouteCount = jobs.filter(j => j.status === 'en_route' || j.status === 'in_progress').length
    const completedTodayCount = jobs.filter(j => j.status === 'completed' && new Date(j.scheduled_start).toLocaleDateString('en-CA') === todayDateStr).length
    return { todayCount, activeRouteCount, completedTodayCount }
  }, [jobs, todayDateStr])

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">

      {/* TOP HEADER & MASTER CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              Schedule & Dispatch
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700">
              {orgTimezone.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            <span className="font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">{metrics.todayCount}</span> jobs scheduled today
            {metrics.activeRouteCount > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-semibold ml-1.5">
                • {metrics.activeRouteCount} currently in field
              </span>
            )}
          </p>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => handleViewChange('agenda')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                activeView === 'agenda'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Agenda</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewChange('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                activeView === 'list'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <Briefcase className="h-3.5 w-3.5" />
              <span>Dispatch List</span>
            </button>

            <button
              type="button"
              onClick={() => handleViewChange('calendar')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                activeView === 'calendar'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>Month</span>
            </button>

            {crews.length > 0 && (
              <button
                type="button"
                onClick={() => handleViewChange('crews')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                  activeView === 'crews'
                    ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
                )}
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Crews</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleViewChange('recurring')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer',
                activeView === 'recurring'
                  ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white'
              )}
            >
              <Repeat className="h-3.5 w-3.5" />
              <span>Recurring</span>
            </button>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex items-center gap-1.5">
            {orgSlug && (
              <Link
                href={`/book/${orgSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                title="View customer online booking page"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-zinc-300 dark:hover:text-white bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs h-8 cursor-pointer"
              >
                <span>Booking Page</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSyncModal(true)}
              className="h-8 text-xs font-medium border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1 text-slate-500" />
              <span>iCal / Sync</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setShowCreateJobModal(true)}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Schedule Job</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <ErrorState
          title="Could not load schedule"
          message={error}
          onRetry={loadJobs}
        />
      )}

      {/* LOADING SKELETON */}
      {loading && !error && (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
      )}

      {/* VIEW 1: AGENDA (DAY-BY-DAY ROUTE) */}
      {!loading && !error && activeView === 'agenda' && (
        <div className="space-y-4">
          {/* 7-Day Quick Date Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {quickDatePills.map(p => {
              const isSelected = p.dateStr === selectedDate
              const isToday = p.dateStr === todayDateStr
              return (
                <button
                  key={p.dateStr}
                  type="button"
                  onClick={() => setSelectedDate(p.dateStr)}
                  className={cn(
                    'flex flex-col items-center justify-center min-w-[70px] sm:min-w-[80px] py-2 px-3 rounded-xl border text-center transition-all cursor-pointer',
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent shadow-xs'
                      : 'bg-white dark:bg-zinc-900/60 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                  )}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80">
                    {p.dayOfWeek}
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {p.dayNum}
                  </span>
                  {isToday && (
                    <span className={cn('text-[9px] font-semibold mt-0.5', isSelected ? 'text-blue-300 dark:text-blue-600' : 'text-blue-600 dark:text-blue-400')}>
                      Today
                    </span>
                  )}
                </button>
              )
            })}

            {/* Custom Date Input */}
            <div className="ml-auto shrink-0 flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="h-8.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 text-slate-700 dark:text-zinc-300 cursor-pointer"
              />
            </div>
          </div>

          {/* Agenda Chronological Appointments Feed */}
          {agendaDateJobs.length === 0 ? (
            <div className="py-12 border border-slate-200/80 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 text-center p-6 space-y-3">
              <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                  No appointments scheduled for this date
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto">
                  Confirmed customer bookings and dispatch routes will automatically appear here.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNewScheduledDate(selectedDate)
                  setShowCreateJobModal(true)
                }}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Schedule for this Day
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {agendaDateJobs.map(job => {
                const startTime = new Date(job.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                const endTime = job.scheduled_end ? new Date(job.scheduled_end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : null

                return (
                  <div
                    key={job.id}
                    className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 transition-all shadow-xs p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Left: Time & Core Details */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setActiveDrawerJob(job)}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono font-semibold text-slate-500 dark:text-zinc-400">
                          {job.job_number}
                        </span>
                        {renderStatusBadge(job.status, job.eta_minutes)}
                        {job.crew && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                            style={{ backgroundColor: job.crew.color || '#3b82f6' }}
                          >
                            <Truck className="h-3 w-3" />
                            {job.crew.name}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
                        {job.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500 dark:text-zinc-400 mt-2">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-zinc-200 tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {startTime}{endTime ? ` - ${endTime}` : ''}
                        </span>

                        <span className="inline-flex items-center gap-1 font-medium">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          {job.contact?.name || 'Customer'} ({job.contact?.phone})
                        </span>

                        {job.contact?.address && (
                          <span className="inline-flex items-center gap-1 text-slate-600 dark:text-zinc-300">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {job.contact.address}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Field Quick Actions (Truck-Friendly 40-48px touch targets) */}
                    <div className="flex items-center flex-wrap gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-zinc-800">
                      {job.contact?.phone && (
                        <a
                          href={`tel:${job.contact.phone}`}
                          title="Call customer"
                          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
                        >
                          <Phone className="h-3.5 w-3.5 text-slate-500" />
                          <span className="hidden sm:inline">Call</span>
                        </a>
                      )}

                      {job.contact?.address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.contact.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open navigation directions"
                          className="h-9 px-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/80 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 inline-flex items-center justify-center gap-1.5 text-xs font-semibold"
                        >
                          <Navigation className="h-3.5 w-3.5 text-blue-500" />
                          <span className="hidden sm:inline">Navigate</span>
                        </a>
                      )}

                      {/* Status Advancement Button */}
                      {(job.status === 'scheduled' || job.status === 'confirmed') && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setEnRouteJob(job)}
                          className="h-9 text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1 shadow-xs cursor-pointer"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span>En Route</span>
                        </Button>
                      )}

                      {job.status === 'en_route' && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={statusUpdatingId === job.id}
                          onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                          className="h-9 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1 shadow-xs cursor-pointer"
                        >
                          {statusUpdatingId === job.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Clock className="h-3.5 w-3.5" />
                          )}
                          <span>Arrived / Start</span>
                        </Button>
                      )}

                      {job.status === 'in_progress' && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={statusUpdatingId === job.id}
                          onClick={() => handleUpdateStatus(job.id, 'completed')}
                          className="h-9 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1 shadow-xs cursor-pointer"
                        >
                          {statusUpdatingId === job.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Complete Job</span>
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveDrawerJob(job)}
                        className="h-9 text-xs border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:text-slate-900"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: DISPATCH LIST (MASTER TABLE) */}
      {!loading && !error && activeView === 'list' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search customer, phone, address, #job..."
                  className="pl-8 h-8 text-xs bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                />
              </div>

              {/* Status Filter */}
              <select
                aria-label="Filter by Status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="h-8 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md px-2 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="en_route">En Route</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>

              {/* Crew Filter */}
              {crews.length > 0 && (
                <select
                  aria-label="Filter by Crew"
                  value={crewFilter}
                  onChange={e => setCrewFilter(e.target.value)}
                  className="h-8 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md px-2 text-slate-700 dark:text-zinc-300 cursor-pointer"
                >
                  <option value="all">All Crews</option>
                  <option value="unassigned">Unassigned Only</option>
                  {crews.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {/* Date Filter */}
              <select
                aria-label="Filter by Date Window"
                value={dateRangeFilter}
                onChange={e => setDateRangeFilter(e.target.value as any)}
                className="h-8 text-xs bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-md px-2 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="all">All Dates</option>
                <option value="today">Today Only</option>
              </select>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                className="h-8 text-xs border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
              >
                <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Table Feed */}
          {filteredJobs.length === 0 ? (
            <div className="py-12 border border-slate-200/80 dark:border-zinc-800 rounded-2xl bg-white dark:bg-zinc-900 text-center p-6 space-y-3">
              <div className="h-10 w-10 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">No jobs match your filter</h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Try resetting filters or search query.</p>
              </div>
            </div>
          ) : (
            <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 dark:bg-zinc-950/60 border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] font-bold">
                    <tr>
                      <th className="py-3 px-4">Job #</th>
                      <th className="py-3 px-4">Title / Service</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Scheduled Window</th>
                      <th className="py-3 px-4">Crew</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {filteredJobs.map(job => {
                      const dateFormatted = new Date(job.scheduled_start).toLocaleDateString([], { month: 'short', day: 'numeric' })
                      const timeFormatted = new Date(job.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

                      return (
                        <tr
                          key={job.id}
                          onClick={() => setActiveDrawerJob(job)}
                          className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-zinc-300">
                            {job.job_number}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100 block">
                              {job.title}
                            </span>
                            {job.service?.name && (
                              <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                                {job.service.name}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-medium text-slate-800 dark:text-zinc-200 block">
                              {job.contact?.name || 'Customer'}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                              {job.contact?.phone}
                            </span>
                          </td>

                          <td className="py-3 px-4 tabular-nums">
                            <span className="font-medium text-slate-800 dark:text-zinc-200 block">
                              {dateFormatted}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                              {timeFormatted}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            {job.crew ? (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                                style={{ backgroundColor: job.crew.color || '#3b82f6' }}
                              >
                                {job.crew.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Unassigned</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            {renderStatusBadge(job.status, job.eta_minutes)}
                          </td>

                          <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {(job.status === 'scheduled' || job.status === 'confirmed') && (
                                <button
                                  type="button"
                                  onClick={() => setEnRouteJob(job)}
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20"
                                >
                                  En Route
                                </button>
                              )}
                              {job.status === 'en_route' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(job.id, 'in_progress')}
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                                >
                                  Start
                                </button>
                              )}
                              {job.status === 'in_progress' && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateStatus(job.id, 'completed')}
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20"
                                >
                                  Complete
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveDrawerJob(job)}
                                className="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                              >
                                Details →
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MONTH CALENDAR */}
      {!loading && !error && activeView === 'calendar' && (
        <div className="space-y-4">
          {/* Month Header Navigation */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-zinc-100">
                {currentMonthDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}
              </h2>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(currentMonthDate)
                  d.setMonth(d.getMonth() - 1)
                  setCurrentMonthDate(d)
                }}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonthDate(new Date())}
                className="h-8 text-xs px-2.5 font-medium"
              >
                Today
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const d = new Date(currentMonthDate)
                  d.setMonth(d.getMonth() + 1)
                  setCurrentMonthDate(d)
                }}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Month Calendar Grid */}
          <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            {/* Days of week header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/60 text-center py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid Cells */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-zinc-800">
              {(() => {
                const year = currentMonthDate.getFullYear()
                const month = currentMonthDate.getMonth()
                const firstDayIndex = new Date(year, month, 1).getDay()
                const daysInMonth = new Date(year, month + 1, 0).getDate()

                const cells = []
                // Empty leading cells
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push(
                    <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[110px] p-2 bg-slate-50/30 dark:bg-zinc-950/20" />
                  )
                }

                // Month days
                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const dayJobs = jobs.filter(j => new Date(j.scheduled_start).toLocaleDateString('en-CA') === dateStr)
                  const isToday = dateStr === todayDateStr

                  cells.push(
                    <div
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr)
                        handleViewChange('agenda')
                      }}
                      className={cn(
                        'min-h-[90px] sm:min-h-[110px] p-2 transition-colors cursor-pointer hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 relative flex flex-col justify-between',
                        isToday && 'bg-blue-50/40 dark:bg-blue-950/20'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'text-xs font-bold tabular-nums inline-flex items-center justify-center h-6 w-6 rounded-full',
                            isToday ? 'bg-blue-600 text-white' : 'text-slate-800 dark:text-zinc-200'
                          )}
                        >
                          {day}
                        </span>

                        {dayJobs.length > 0 && (
                          <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 tabular-nums">
                            {dayJobs.length} {dayJobs.length === 1 ? 'job' : 'jobs'}
                          </span>
                        )}
                      </div>

                      {/* Mini Job Pills */}
                      <div className="space-y-1 mt-1 overflow-hidden">
                        {dayJobs.slice(0, 2).map(j => (
                          <div
                            key={j.id}
                            className="text-[10px] truncate px-1.5 py-0.5 rounded font-medium bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200/80 dark:border-zinc-700"
                          >
                            {j.title}
                          </div>
                        ))}
                        {dayJobs.length > 2 && (
                          <div className="text-[9px] text-slate-500 font-semibold pl-1">
                            +{dayJobs.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                }

                return cells
              })()}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 4: CREWS & FLEET SWIMLANES */}
      {!loading && !error && activeView === 'crews' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                Fleet & Crew Dispatch Swimlanes
              </h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Drag or reassign service calls across your vehicles and technicians.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowCrewModal(true)}
              className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Crew
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Unassigned Pool Column */}
            <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Unassigned Route Pool
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                  {jobs.filter(j => !j.crew_id && j.status !== 'completed' && j.status !== 'cancelled').length}
                </span>
              </div>

              <div className="space-y-2">
                {jobs.filter(j => !j.crew_id && j.status !== 'completed' && j.status !== 'cancelled').map(job => (
                  <div
                    key={job.id}
                    className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{job.title}</span>
                      {renderStatusBadge(job.status)}
                    </div>
                    <p className="text-[11px] text-slate-500">{job.contact?.name || 'Customer'}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReassignJob(job)}
                      className="w-full h-7 text-[11px] border-slate-200 dark:border-zinc-800 font-medium"
                    >
                      Assign to Van / Crew
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Crew Swimlanes */}
            {crews.map(crew => {
              const crewJobs = jobs.filter(j => j.crew_id === crew.id && j.status !== 'completed' && j.status !== 'cancelled')
              return (
                <div
                  key={crew.id}
                  className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: crew.color }} />
                      <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{crew.name}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      {crewJobs.length}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {crewJobs.length === 0 ? (
                      <p className="text-xs text-slate-400 dark:text-zinc-600 italic py-4 text-center">
                        No active jobs assigned to this vehicle
                      </p>
                    ) : (
                      crewJobs.map(job => (
                        <div
                          key={job.id}
                          className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-950/60 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">{job.title}</span>
                            {renderStatusBadge(job.status, job.eta_minutes)}
                          </div>
                          <p className="text-[11px] text-slate-500">{job.contact?.name || 'Customer'}</p>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(job.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setReassignJob(job)}
                              className="h-6 text-[11px] text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                            >
                              Reassign
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VIEW 5: RECURRING SERVICE PLANS */}
      {!loading && !error && activeView === 'recurring' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-900 text-white dark:bg-zinc-900 border border-slate-800 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-bold">Autonomous Recurring Engine</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Service visits auto-schedule themselves ahead of time and advance upon completion.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={runningSpawner}
                onClick={handleRunAutonomousSpawner}
                className="h-8 text-xs border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                {runningSpawner ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Repeat className="h-3 w-3 mr-1" />}
                Generate Visits
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => setShowRecurringModal(true)}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Plan
              </Button>
            </div>
          </div>

          {loadingRecurring ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading maintenance contracts...</span>
            </div>
          ) : recurringTemplates.length === 0 ? (
            <EmptyState
              icon={Repeat}
              title="No recurring maintenance plans yet"
              description="Automate recurring visits for weekly pool maintenance, bi-weekly lawn mowing, quarterly pest control, or seasonal HVAC tune-ups."
              actionLabel="Create First Recurring Plan"
              onAction={() => setShowRecurringModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {recurringTemplates.map(plan => (
                <div
                  key={plan.id}
                  className="rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-xs text-slate-900 dark:text-white">{plan.title}</h3>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                        Customer: <span className="font-semibold text-slate-700 dark:text-zinc-300">{plan.contact?.name || 'Customer'}</span>
                      </p>
                    </div>

                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                      plan.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800'
                    )}>
                      {plan.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-zinc-800">
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 capitalize">
                      Cadence: {plan.cadence}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleRecurringStatus(plan.id, plan.status)}
                        className="h-7 text-xs px-2"
                      >
                        {plan.status === 'active' ? (
                          <>
                            <Pause className="h-3 w-3 mr-1 text-amber-500" />
                            Pause
                          </>
                        ) : (
                          <>
                            <PlayCircle className="h-3 w-3 mr-1 text-emerald-500" />
                            Resume
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteRecurringTemplate(plan.id)}
                        className="h-7 text-xs px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SLIDE-OUT JOB DETAIL DRAWER (SHEET) */}
      <Sheet open={!!activeDrawerJob} onOpenChange={open => !open && setActiveDrawerJob(null)}>
        <SheetContent side="right" className="sm:max-w-lg w-full p-0 flex flex-col justify-between overflow-y-auto">
          {activeDrawerJob && (
            <div className="p-6 space-y-6">
              {/* Header */}
              <SheetHeader className="pb-4 border-b border-slate-200 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-slate-500 dark:text-zinc-400">
                      {activeDrawerJob.job_number}
                    </span>
                    {renderStatusBadge(activeDrawerJob.status, activeDrawerJob.eta_minutes)}
                  </div>
                </div>
                <SheetTitle className="text-lg font-bold text-slate-900 dark:text-zinc-100 text-left mt-1">
                  {activeDrawerJob.title}
                </SheetTitle>
              </SheetHeader>

              {/* Field Command Actions (48px Touch Targets) */}
              <div className="space-y-2">
                <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-zinc-500">
                  Field Action
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {(activeDrawerJob.status === 'scheduled' || activeDrawerJob.status === 'confirmed') && (
                    <Button
                      type="button"
                      onClick={() => setEnRouteJob(activeDrawerJob)}
                      className="h-11 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs gap-1.5"
                    >
                      <Truck className="h-4 w-4" />
                      Dispatch En Route
                    </Button>
                  )}

                  {activeDrawerJob.status === 'en_route' && (
                    <Button
                      type="button"
                      disabled={statusUpdatingId === activeDrawerJob.id}
                      onClick={() => handleUpdateStatus(activeDrawerJob.id, 'in_progress')}
                      className="h-11 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs gap-1.5"
                    >
                      {statusUpdatingId === activeDrawerJob.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                      Arrived / Start Job
                    </Button>
                  )}

                  {activeDrawerJob.status === 'in_progress' && (
                    <Button
                      type="button"
                      disabled={statusUpdatingId === activeDrawerJob.id}
                      onClick={() => handleUpdateStatus(activeDrawerJob.id, 'completed')}
                      className="h-11 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 col-span-2"
                    >
                      {statusUpdatingId === activeDrawerJob.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      Mark Job Complete
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPhotoJob(activeDrawerJob)}
                    className="h-11 border-slate-200 dark:border-zinc-800 text-xs font-semibold gap-1.5"
                  >
                    <Camera className="h-4 w-4 text-slate-500" />
                    Field Photos
                  </Button>

                  {activeDrawerJob.contact?.address && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeDrawerJob.contact.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-11 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-slate-50 text-slate-800 dark:text-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <Navigation className="h-4 w-4 text-blue-500" />
                      GPS Directions
                    </a>
                  )}
                </div>
              </div>

              {/* Customer Contact Details */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-950/70 border border-slate-200/80 dark:border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                    {activeDrawerJob.contact?.name || 'Customer'}
                  </span>
                  {activeDrawerJob.contact?.id && (
                    <Link
                      href={`/client/customers/${activeDrawerJob.contact.id}`}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View CRM Profile →
                    </Link>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <a href={`tel:${activeDrawerJob.contact?.phone}`} className="hover:underline font-mono font-medium text-slate-900 dark:text-zinc-200">
                      {activeDrawerJob.contact?.phone}
                    </a>
                  </div>

                  {activeDrawerJob.contact?.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span>{activeDrawerJob.contact.address}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Schedule Timing & Crew */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Scheduled Time</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100 tabular-nums">
                    {new Date(activeDrawerJob.scheduled_start).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at {new Date(activeDrawerJob.scheduled_start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800">
                  <span className="text-slate-500 dark:text-zinc-400 font-medium">Assigned Crew</span>
                  <div className="flex items-center gap-2">
                    {activeDrawerJob.crew ? (
                      <span className="font-semibold text-slate-900 dark:text-zinc-100">
                        {activeDrawerJob.crew.name}
                      </span>
                    ) : (
                      <span className="text-slate-400">Unassigned</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setReassignJob(activeDrawerJob)}
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {activeDrawerJob.service && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800">
                    <span className="text-slate-500 dark:text-zinc-400 font-medium">Service Type</span>
                    <span className="font-semibold text-slate-900 dark:text-zinc-100">
                      {activeDrawerJob.service.name} ({activeDrawerJob.service.duration_minutes}m)
                    </span>
                  </div>
                )}
              </div>

              {/* Field Notes */}
              {activeDrawerJob.notes && (
                <div className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500 dark:text-zinc-500">
                    Job Notes
                  </span>
                  <p className="text-xs text-slate-700 dark:text-zinc-300 p-3 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 leading-relaxed whitespace-pre-wrap">
                    {activeDrawerJob.notes}
                  </p>
                </div>
              )}

              {/* Bottom Financial Conversion Actions */}
              <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between gap-2">
                <Link
                  href={`/client/invoices?create=true&contact_id=${activeDrawerJob.contact?.id || ''}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs cursor-pointer"
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Generate Invoice</span>
                </Link>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateStatus(activeDrawerJob.id, 'cancelled')}
                  className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  Cancel Job
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* CREATE JOB / APPOINTMENT MODAL */}
      <Modal
        open={showCreateJobModal}
        onOpenChange={setShowCreateJobModal}
        title="Schedule New Job"
        description="Book a verified customer appointment and create an active field job."
        size="md"
      >
        <form onSubmit={handleCreateJob} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Customer *
            </label>
            <select
              aria-label="Select Customer"
              required
              value={newContactId}
              onChange={e => setNewContactId(e.target.value)}
              className="w-full p-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">-- Choose Existing Customer --</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Valued Customer'} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Job Title *
            </label>
            <Input
              required
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="e.g. AC Diagnostic & Coil Clean"
              className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={newScheduledDate}
                onChange={e => setNewScheduledDate(e.target.value)}
                className="w-full h-8.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 text-slate-900 dark:text-zinc-100 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={newScheduledTime}
                onChange={e => setNewScheduledTime(e.target.value)}
                className="w-full h-8.5 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg px-2 text-slate-900 dark:text-zinc-100 cursor-pointer"
              />
            </div>
          </div>

          {services.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Service Catalog Item
              </label>
              <select
                aria-label="Select Service Catalog Item"
                value={newServiceId}
                onChange={e => {
                  setNewServiceId(e.target.value)
                  const svc = services.find(s => s.id === e.target.value)
                  if (svc && !newTitle) setNewTitle(svc.name)
                }}
                className="w-full p-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Optional: Link Service Catalog --</option>
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_minutes}m)
                  </option>
                ))}
              </select>
            </div>
          )}

          {crews.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
                Assign Crew / Vehicle
              </label>
              <select
                aria-label="Assign Crew or Vehicle"
                value={newCrewId}
                onChange={e => setNewCrewId(e.target.value)}
                className="w-full p-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">-- Leave Unassigned (Route Pool) --</option>
                {crews.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.van_identifier ? `(${c.van_identifier})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300 mb-1">
              Field Notes / Gate Codes
            </label>
            <textarea
              rows={2}
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              placeholder="e.g. Lockbox on side gate, dog in backyard..."
              className="w-full p-2 text-xs bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCreateJobModal(false)}
              className="h-8 text-xs border-slate-200 dark:border-zinc-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submittingCreate}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {submittingCreate ? 'Scheduling...' : 'Confirm Booking'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* EN ROUTE MODAL */}
      <EnRouteModal
        isOpen={!!enRouteJob}
        onClose={() => setEnRouteJob(null)}
        job={enRouteJob}
        organizationName={orgName}
        onConfirm={async payload => {
          if (!enRouteJob) return
          await handleUpdateStatus(enRouteJob.id, 'en_route', {
            etaMinutes: payload.etaMinutes,
            notifyCustomer: payload.notifyCustomer,
            technicianName: payload.technicianName
          })
          setEnRouteJob(null)
        }}
      />

      {/* JOB PHOTOS MODAL */}
      <JobPhotosModal
        isOpen={!!photoJob}
        onClose={() => setPhotoJob(null)}
        job={photoJob ? { id: photoJob.id, job_number: photoJob.job_number, title: photoJob.title } : null}
      />

      {/* REASSIGN CREW MODAL */}
      <ReassignCrewModal
        open={!!reassignJob}
        onOpenChange={open => !open && setReassignJob(null)}
        item={reassignJob ? {
          id: reassignJob.id,
          type: 'job',
          title: reassignJob.title,
          jobNumber: reassignJob.job_number,
          startTime: reassignJob.scheduled_start,
          endTime: reassignJob.scheduled_end,
          crewId: reassignJob.crew_id,
          customerName: reassignJob.contact?.name,
          customerPhone: reassignJob.contact?.phone
        } : null}
        crews={crews}
        onSuccess={() => {
          loadJobs()
          setReassignJob(null)
        }}
      />

      {/* RECURRING PLAN MODAL */}
      <RecurringPlanModal
        isOpen={showRecurringModal}
        onClose={() => setShowRecurringModal(false)}
        customers={contacts.map(c => ({ id: c.id, name: c.name || 'Customer', phone: c.phone }))}
        services={services.map(s => ({ id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes }))}
        onSuccess={() => {
          loadRecurringTemplates()
          loadJobs()
        }}
      />

      {/* CREW CREATION MODAL */}
      <CrewModal
        open={showCrewModal}
        onOpenChange={setShowCrewModal}
        teamMembers={teamMembers}
        onSuccess={() => {
          loadReferenceData()
          setShowCrewModal(false)
        }}
      />

      {/* CALENDAR SYNC MODAL */}
      <Modal
        open={showSyncModal}
        onOpenChange={setShowSyncModal}
        title="Calendar Sync & Export"
        description="Sync your dispatch appointments with external calendar applications."
        size="sm"
      >
        <div className="space-y-4 py-2">
          <p className="text-xs text-slate-600 dark:text-zinc-400">
            Export your confirmed bookings to Google Calendar, Apple Calendar, or Outlook.
          </p>
          <div className="space-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (agendaDateJobs.length > 0) {
                  downloadIcsFile({
                    title: agendaDateJobs[0].title,
                    description: `Customer: ${agendaDateJobs[0].contact?.name || ''} (${agendaDateJobs[0].contact?.phone || ''})`,
                    location: agendaDateJobs[0].contact?.address || undefined,
                    startTime: agendaDateJobs[0].scheduled_start,
                    endTime: agendaDateJobs[0].scheduled_end || undefined
                  })
                  toast.success('Downloaded iCal event.')
                } else {
                  toast.error('No scheduled appointments to export for this day.')
                }
              }}
              className="w-full text-xs border-slate-200 dark:border-zinc-800 justify-start"
            >
              <Download className="h-3.5 w-3.5 mr-2 text-slate-500" />
              Download .ICS for Selected Day
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
