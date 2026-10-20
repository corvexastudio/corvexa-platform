'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Modal } from '@/components/ui/modal'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  PhoneCall, 
  Check, 
  X, 
  XCircle, 
  Sliders, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  CalendarDays,
  Plus,
  Trash2,
  Globe,
  Truck,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  UserCheck,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { cn } from '@/lib/utils'
import { generateGoogleCalendarUrl, downloadIcsFile } from '@/lib/calendar/calendar-sync'
import { getTodayInTimezone, getSelectableDatesInTimezone } from '@/lib/booking/availability'
import { ReassignCrewModal } from '@/components/crews/reassign-crew-modal'
import { CrewModal } from '@/components/crews/crew-modal'
import type { Crew } from '@/lib/crews/crew-manager'

interface AppointmentItem {
  id: string
  title: string
  service_type?: string | null
  start_time: string
  end_time?: string | null
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'scheduled'
  source?: string | null
  manage_token?: string | null
  notes?: string | null
  crew_id?: string | null
  contact: {
    id?: string
    name?: string | null
    phone: string
    address?: string | null
  }
}

interface ServiceItem {
  id: string
  name: string
  description?: string | null
  duration_minutes: number
  price?: number | null
  requires_address: boolean
  is_active: boolean
}

function getAppointmentBadge(status: AppointmentItem['status']) {
  switch (status) {
    case 'confirmed':
    case 'scheduled':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
          Confirmed
        </span>
      )
    case 'requested':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
          Pending Approval
        </span>
      )
    case 'completed':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">
          Completed
        </span>
      )
    case 'cancelled':
    case 'no_show':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
          {status === 'no_show' ? 'No Show' : 'Cancelled'}
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
          {status}
        </span>
      )
  }
}

function CalendarContent() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const contactIdParam = searchParams.get('contact_id')

  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgSlug, setOrgSlug] = useState<string>('')
  const [orgTimezone, setOrgTimezone] = useState<string>('America/Chicago')
  const [copiedLink, setCopiedLink] = useState(false)

  // Book Appointment Modal State
  const [showBookModal, setShowBookModal] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [bookContactId, setBookContactId] = useState('')
  const [bookCustomName, setBookCustomName] = useState('')
  const [bookCustomPhone, setBookCustomPhone] = useState('')
  const [bookCustomAddress, setBookCustomAddress] = useState('')
  const [bookServiceId, setBookServiceId] = useState('')
  const [bookDateTime, setBookDateTime] = useState('')
  const [bookNotes, setBookNotes] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  // Interactive slot booking state
  const [bookDate, setBookDate] = useState(() => getTodayInTimezone(orgTimezone || 'America/Chicago'))
  const [bookingSlots, setBookingSlots] = useState<Array<{ startTime: string; endTime: string; displayTime: string }>>([])
  const [bookingAllSlots, setBookingAllSlots] = useState<Array<{ startTime: string; endTime: string; displayTime: string; isAvailable?: boolean; status?: string }>>([])
  const [bookingDayStatus, setBookingDayStatus] = useState<string>('available')
  const [loadingBookingSlots, setLoadingBookingSlots] = useState(false)
  const [selectedSlotTime, setSelectedSlotTime] = useState<string>('')
  const [isManualTime, setIsManualTime] = useState(false)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  // Multi-Crew Dispatch Columns State
  const [calendarView, setCalendarView] = useState<'agenda' | 'crews'>('agenda')
  const [crews, setCrews] = useState<Crew[]>([])
  const [loadingCrews, setLoadingCrews] = useState(false)
  const [dispatchDate, setDispatchDate] = useState(() => getTodayInTimezone(orgTimezone || 'America/Chicago'))
  const [dispatchJobs, setDispatchJobs] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [reassignTargetItem, setReassignTargetItem] = useState<{
    id: string
    type: 'job' | 'appointment'
    title: string
    jobNumber?: string
    startTime: string
    endTime?: string | null
    crewId?: string | null
    customerName?: string | null
    customerPhone?: string | null
  } | null>(null)
  const [showReassignModal, setShowReassignModal] = useState(false)

  // 7-day quick date pills strictly calculated within US business timezone
  const quickDatePills = useMemo<Array<{ dateStr: string; dayOfWeek: string; dayNum: string }>>(() => {
    return getSelectableDatesInTimezone(orgTimezone || 'America/Chicago', 7)
  }, [orgTimezone])

  // Load available slots dynamically when modal opens, or bookDate or bookServiceId changes
  useEffect(() => {
    if (!showBookModal || !bookDate) return

    let isMounted = true
    async function loadSlots() {
      setLoadingBookingSlots(true)
      try {
        const query = `/api/book/${orgSlug || 'default'}/slots?date=${bookDate}&internal=true${bookServiceId ? `&serviceId=${bookServiceId}` : ''}`
        const res = await fetch(query)
        if (res.ok) {
          const data = await res.json()
          if (isMounted) {
            setBookingSlots(data.slots || [])
            setBookingAllSlots(data.allSlots || data.slots || [])
            setBookingDayStatus(data.dayStatus || (data.slots?.length > 0 ? 'available' : 'fully_booked'))
          }
        } else {
          if (isMounted) {
            setBookingSlots([])
            setBookingAllSlots([])
            setBookingDayStatus('closed')
          }
        }
      } catch {
        if (isMounted) {
          setBookingSlots([])
          setBookingAllSlots([])
          setBookingDayStatus('closed')
        }
      } finally {
        if (isMounted) setLoadingBookingSlots(false)
      }
    }

    loadSlots()
    return () => { isMounted = false }
  }, [showBookModal, bookDate, bookServiceId, orgSlug])

  // Listen to contact_id query param
  useEffect(() => {
    if (contactIdParam) {
      setBookContactId(contactIdParam)
      setShowBookModal(true)
    }
  }, [contactIdParam])

  // Load Contacts for picker
  useEffect(() => {
    fetch('/api/client/customers?limit=100')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.customers) setContacts(data.customers)
      })
      .catch(() => {})
  }, [])

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false)
  const [services, setServices] = useState<ServiceItem[]>([])
  const [bookingConfig, setBookingConfig] = useState({
    booking_mode: 'instant',
    default_duration_minutes: 60,
    buffer_minutes: 15,
    minimum_notice_hours: 2,
    max_booking_days_ahead: 30,
    blocked_dates: [] as string[]
  })
  const [newBlockedDate, setNewBlockedDate] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  // New Service Form
  const [newServiceName, setNewServiceName] = useState('')
  const [newServiceDuration, setNewServiceDuration] = useState('60')
  const [newServicePrice, setNewServicePrice] = useState('')
  const [newServiceRequiresAddress, setNewServiceRequiresAddress] = useState(true)
  const [addingService, setAddingService] = useState(false)

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setError('Authentication required to view calendar.')
        setLoading(false)
        return
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('org_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profileErr || !profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }

      // Load Org Settings & Timezone
      const { data: org } = await supabase
        .from('organizations')
        .select('slug, timezone, booking_mode, default_duration_minutes, buffer_minutes, minimum_notice_hours, max_booking_days_ahead, blocked_dates')
        .eq('id', profile.org_id)
        .single()

      if (org) {
        setOrgSlug(org.slug || '')
        if (org.timezone) {
          setOrgTimezone(org.timezone)
          setBookDate(getTodayInTimezone(org.timezone))
        }
        setBookingConfig({
          booking_mode: org.booking_mode || 'instant',
          default_duration_minutes: org.default_duration_minutes || 60,
          buffer_minutes: org.buffer_minutes ?? 15,
          minimum_notice_hours: org.minimum_notice_hours ?? 2,
          max_booking_days_ahead: org.max_booking_days_ahead ?? 30,
          blocked_dates: org.blocked_dates || []
        })
      }

      // Load Appointments
      const { data, error: aptsErr } = await supabase
        .from('appointments')
        .select(`
          id, title, service_type, start_time, end_time, status, source, manage_token, notes, crew_id,
          contact:contacts(id, name, phone, address)
        `)
        .eq('org_id', profile.org_id)
        .order('start_time', { ascending: true })

      if (aptsErr) {
        setError('Failed to load appointments. Please retry.')
      } else if (data) {
        const enriched: AppointmentItem[] = data.map((a: any) => ({
          ...a,
          contact: Array.isArray(a.contact) ? a.contact[0] : a.contact
        }))
        setAppointments(enriched)
      }

      // Load Services
      const { data: svcs } = await supabase
        .from('services')
        .select('*')
        .eq('org_id', profile.org_id)
        .order('sort_order', { ascending: true })

      if (svcs) {
        setServices(svcs)
      }

      // Load Crews
      try {
        const crewsRes = await fetch('/api/client/crews')
        if (crewsRes.ok) {
          const crewsData = await crewsRes.json()
          setCrews(crewsData.crews || [])
        }
      } catch {
        // Non-fatal
      }

      // Load Profiles / Team Members for Crew Assignment
      try {
        const { data: membersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('org_id', profile.org_id)
        if (membersData) setTeamMembers(membersData)
      } catch {
        // Non-fatal
      }

      // Load Jobs for Multi-Crew Dispatch Board
      try {
        const jobsRes = await fetch('/api/client/jobs?limit=100')
        if (jobsRes.ok) {
          const jobsData = await jobsRes.json()
          setDispatchJobs(jobsData.items || [])
        }
      } catch {
        // Non-fatal
      }
    } catch {
      setError('An unexpected error occurred while loading schedule.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  // Status Action Handler
  const handleUpdateStatus = async (appointmentId: string, newStatus: string) => {
    // Optimistic update
    setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: newStatus as any } : a))

    try {
      const res = await fetch(`/api/client/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        toast.error(errData?.error || 'Failed to update appointment status.')
        loadAppointments()
        return
      }

      const resData = await res.json().catch(() => null)
      if (resData?.appointment) {
        setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, ...resData.appointment, contact: a.contact } : a))
      }
      toast.success(`Appointment marked as ${newStatus}`)
    } catch {
      toast.error('An error occurred while updating status.')
      loadAppointments()
    }
  }

  // Save Booking Rules Configuration
  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await fetch('/api/client/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingConfig)
      })

      if (res.ok) {
        toast.success('Booking settings updated successfully')
        setShowSettings(false)
      } else {
        toast.error('Failed to save settings.')
      }
    } catch {
      toast.error('Network error saving settings.')
    } finally {
      setSavingConfig(false)
    }
  }

  // Add Blocked Date
  const handleAddBlockedDate = () => {
    if (!newBlockedDate || bookingConfig.blocked_dates.includes(newBlockedDate)) return
    setBookingConfig({
      ...bookingConfig,
      blocked_dates: [...bookingConfig.blocked_dates, newBlockedDate]
    })
    setNewBlockedDate('')
  }

  // Remove Blocked Date
  const handleRemoveBlockedDate = (dateToRemove: string) => {
    setBookingConfig({
      ...bookingConfig,
      blocked_dates: bookingConfig.blocked_dates.filter(d => d !== dateToRemove)
    })
  }

  // Create New Service
  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newServiceName.trim()) return

    setAddingService(true)
    try {
      const res = await fetch('/api/client/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newServiceName,
          duration_minutes: parseInt(newServiceDuration, 10),
          price: newServicePrice ? parseFloat(newServicePrice) : null,
          requires_address: newServiceRequiresAddress
        })
      })

      if (res.ok) {
        toast.success(`Service "${newServiceName}" created`)
        setNewServiceName('')
        setNewServicePrice('')
        await loadAppointments()
      } else {
        toast.error('Failed to add service.')
      }
    } catch {
      toast.error('Error creating service.')
    } finally {
      setAddingService(false)
    }
  }

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    const selectedContact = contacts.find(c => c.id === bookContactId)
    const phoneToUse = selectedContact ? selectedContact.phone : bookCustomPhone
    const nameToUse = selectedContact ? selectedContact.name : bookCustomName
    const addressToUse = selectedContact ? selectedContact.address : bookCustomAddress

    if (!phoneToUse?.trim()) {
      toast.error('Customer phone number is required.')
      return
    }
    if (!bookDateTime) {
      toast.error('Appointment date and time is required.')
      return
    }

    setBookingLoading(true)
    try {
      const res = await fetch('/api/client/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: bookServiceId || undefined,
          customerName: nameToUse?.trim() || 'Customer',
          customerPhone: phoneToUse.trim(),
          customerAddress: addressToUse?.trim() || undefined,
          startTime: new Date(bookDateTime).toISOString(),
          notes: bookNotes?.trim() || undefined
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Appointment booked successfully')
        setShowBookModal(false)
        setBookContactId('')
        setBookCustomName('')
        setBookCustomPhone('')
        setBookCustomAddress('')
        setBookServiceId('')
        setBookDateTime('')
        setSelectedSlotTime('')
        setIsCalendarOpen(false)
        setIsManualTime(false)
        setBookNotes('')
        await loadAppointments()
      } else {
        toast.error(data.error || 'Failed to book appointment')
      }
    } catch {
      toast.error('Network error booking appointment.')
    } finally {
      setBookingLoading(false)
    }
  }

  const handleCopyBookingLink = () => {
    if (!orgSlug) return
    const url = `${window.location.origin}/book/${orgSlug}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    toast.success('Public booking URL copied to clipboard')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleDispatchDateChange = (direction: -1 | 1 | 0) => {
    if (direction === 0) {
      setDispatchDate(getTodayInTimezone(orgTimezone || 'America/Chicago'))
      return
    }
    const current = new Date(`${dispatchDate}T12:00:00.000Z`)
    current.setDate(current.getDate() + direction)
    setDispatchDate(current.toISOString().slice(0, 10))
  }

  // Multi-Crew Dispatch Computed Items & Conflict Detection
  const itemsOnDispatchDate = useMemo(() => {
    const list: Array<{
      id: string
      type: 'job' | 'appointment'
      title: string
      jobNumber?: string
      serviceName?: string
      startTime: string
      endTime?: string | null
      status: string
      crewId?: string | null
      customerName?: string | null
      customerPhone?: string | null
      customerAddress?: string | null
      hasConflict?: boolean
    }> = []

    for (const a of appointments) {
      if (!a.start_time) continue
      let aDate = ''
      try {
        aDate = new Intl.DateTimeFormat('en-CA', { timeZone: orgTimezone }).format(new Date(a.start_time))
      } catch {
        aDate = a.start_time.slice(0, 10)
      }
      if (aDate === dispatchDate) {
        list.push({
          id: a.id,
          type: 'appointment',
          title: a.title,
          serviceName: a.service_type || 'Appointment',
          startTime: a.start_time,
          endTime: a.end_time,
          status: a.status,
          crewId: a.crew_id || null,
          customerName: a.contact?.name,
          customerPhone: a.contact?.phone,
          customerAddress: a.contact?.address
        })
      }
    }

    for (const j of dispatchJobs) {
      if (!j.scheduled_start) continue
      let jDate = ''
      try {
        jDate = new Intl.DateTimeFormat('en-CA', { timeZone: orgTimezone }).format(new Date(j.scheduled_start))
      } catch {
        jDate = j.scheduled_start.slice(0, 10)
      }
      if (jDate === dispatchDate) {
        list.push({
          id: j.id,
          type: 'job',
          title: j.title,
          jobNumber: j.job_number,
          serviceName: j.service?.name || 'Field Job',
          startTime: j.scheduled_start,
          endTime: j.scheduled_end,
          status: j.status,
          crewId: j.crew_id || null,
          customerName: j.contact?.name,
          customerPhone: j.contact?.phone,
          customerAddress: j.contact?.address
        })
      }
    }

    // Sort by startTime
    list.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

    // Overlap conflict detection per crew
    const crewGroups: Record<string, typeof list> = {}
    for (const it of list) {
      if (it.crewId && !['cancelled', 'no_show'].includes(it.status)) {
        if (!crewGroups[it.crewId]) crewGroups[it.crewId] = []
        crewGroups[it.crewId].push(it)
      }
    }

    for (const group of Object.values(crewGroups)) {
      if (group.length <= 1) continue
      for (let i = 0; i < group.length; i++) {
        const itemA = group[i]
        const startA = new Date(itemA.startTime).getTime()
        const endA = itemA.endTime ? new Date(itemA.endTime).getTime() : startA + 60 * 60 * 1000

        for (let k = i + 1; k < group.length; k++) {
          const itemB = group[k]
          const startB = new Date(itemB.startTime).getTime()
          const endB = itemB.endTime ? new Date(itemB.endTime).getTime() : startB + 60 * 60 * 1000

          if (startA < endB && startB < endA) {
            itemA.hasConflict = true
            itemB.hasConflict = true
          }
        }
      }
    }

    return list
  }, [appointments, dispatchJobs, dispatchDate, orgTimezone])

  // Filter appointments
  const filteredAppointments = appointments.filter((apt) => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'confirmed') return ['confirmed', 'scheduled'].includes(apt.status)
    return apt.status === statusFilter
  })

  const requestedCount = appointments.filter(a => a.status === 'requested').length

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Schedule & Bookings
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700 tabular-nums">
              {appointments.length}
            </span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100/80 dark:bg-zinc-800/80 text-slate-600 dark:text-zinc-400 border border-slate-200/60 dark:border-zinc-700/60">
              {orgTimezone}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => setShowBookModal(true)}
            className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>Book Appointment</span>
          </Button>
          {orgSlug && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyBookingLink}
              className="h-8.5 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-2xs"
            >
              {copiedLink ? (
                <Check className="h-3.5 w-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5 mr-1.5 text-slate-400 dark:text-zinc-400" />
              )}
              <span>Copy Booking Link</span>
            </Button>
          )}

          {orgSlug && (
            <a
              href={`/book/${orgSlug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white transition-colors shadow-2xs"
            >
              <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Public Page</span>
            </a>
          )}

          <Button
            size="sm"
            onClick={() => setShowSettings(true)}
            className="h-8.5 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 dark:border-zinc-700 shadow-2xs"
          >
            <Sliders className="h-3.5 w-3.5 mr-1.5 text-slate-400 dark:text-zinc-400" />
            <span>Booking Rules</span>
          </Button>
        </div>
      </div>

      {/* View Switcher */}
      <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1">
        <button
          type="button"
          onClick={() => setCalendarView('agenda')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
            calendarView === 'agenda'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          <span>Agenda View</span>
        </button>
        <button
          type="button"
          onClick={() => setCalendarView('crews')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
            calendarView === 'crews'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Crew Dispatch Columns</span>
          {crews.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold tabular-nums">
              {crews.length}
            </span>
          )}
        </button>
      </div>

      {calendarView === 'crews' ? (
        /* Multi-Crew Dispatch Columns Board */
        <div className="space-y-4">
          {/* Dispatch Date Navigation Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDispatchDateChange(-1)}
                className="h-8 w-8 p-0 border-slate-200 dark:border-zinc-700"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-3 py-1 text-xs font-semibold text-slate-800 dark:text-zinc-200 min-w-36 text-center">
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }).format(new Date(`${dispatchDate}T12:00:00.000Z`))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDispatchDateChange(1)}
                className="h-8 w-8 p-0 border-slate-200 dark:border-zinc-700"
                title="Next Day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleDispatchDateChange(0)}
                className="h-8 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                Today
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:inline">
                {itemsOnDispatchDate.length} item{itemsOnDispatchDate.length !== 1 ? 's' : ''} scheduled
              </span>
              <Button
                size="sm"
                onClick={() => setShowCrewModal(true)}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Crew / Van
              </Button>
            </div>
          </div>

          {/* Columns Grid */}
          {crews.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No Crews or Vans Configured"
              description="Add your first service van or field crew to unlock multi-crew column dispatch, territory routing, and double-booking protection."
              actionLabel="Add First Crew"
              onAction={() => setShowCrewModal(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start overflow-x-auto pb-4">
              {/* Active Crews Columns */}
              {crews.map(crew => {
                const crewItems = itemsOnDispatchDate.filter(it => it.crewId === crew.id)
                return (
                  <div
                    key={crew.id}
                    className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/70 p-3 flex flex-col gap-3 min-w-[280px]"
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-zinc-800/80 pb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: crew.color_code }}
                        />
                        <div className="truncate">
                          <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                            {crew.name}
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                            {crew.phone_number || (crew.crew_lead?.full_name ? `Lead: ${crew.crew_lead.full_name}` : 'Active Van')}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 tabular-nums">
                        {crewItems.length}
                      </span>
                    </div>

                    {/* Column Items */}
                    <div className="space-y-2.5 min-h-[160px]">
                      {crewItems.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-slate-400 dark:text-zinc-600 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-xs">
                          <Truck className="w-5 h-5 mb-1 opacity-40" />
                          <span>No bookings for this date</span>
                        </div>
                      ) : (
                        crewItems.map(item => (
                          <div
                            key={`${item.type}-${item.id}`}
                            className={cn(
                              "rounded-xl border p-3 bg-white dark:bg-zinc-900 shadow-2xs space-y-2 transition-all hover:border-slate-300 dark:hover:border-zinc-700",
                              item.hasConflict
                                ? "border-amber-400 dark:border-amber-500/50 ring-1 ring-amber-400/30"
                                : "border-slate-200/80 dark:border-zinc-800"
                            )}
                          >
                            {/* Time & Conflict Pill */}
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Intl.DateTimeFormat('en-US', {
                                  timeZone: orgTimezone,
                                  hour: 'numeric',
                                  minute: '2-digit'
                                }).format(new Date(item.startTime))}
                              </span>

                              {item.hasConflict ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  Double Booked
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400 uppercase">
                                  {item.type}
                                </span>
                              )}
                            </div>

                            {/* Title & Customer */}
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                                {item.jobNumber ? `#${item.jobNumber}: ` : ''}{item.title}
                              </div>
                              {item.customerName && (
                                <div className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">
                                  {item.customerName}
                                </div>
                              )}
                              {item.customerAddress && (
                                <div className="text-[10px] text-slate-500 dark:text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{item.customerAddress}</span>
                                </div>
                              )}
                            </div>

                            {/* Actions: Reassign Crew */}
                            <div className="pt-1.5 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between gap-1">
                              {getAppointmentBadge(item.status as any)}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setReassignTargetItem(item)
                                  setShowReassignModal(true)
                                }}
                                className="h-6 px-2 text-[10px] rounded-md border-slate-200 dark:border-zinc-700"
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

              {/* Unassigned Standby Column */}
              {(() => {
                const unassignedItems = itemsOnDispatchDate.filter(it => !it.crewId)
                return (
                  <div className="rounded-2xl border border-slate-200/90 dark:border-zinc-800 bg-slate-100/50 dark:bg-zinc-900/40 p-3 flex flex-col gap-3 min-w-[280px]">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 rounded-full bg-slate-400" />
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 dark:text-zinc-100">
                            Unassigned Standby
                          </h3>
                          <p className="text-[10px] text-slate-500 dark:text-zinc-400">
                            Needs van dispatch
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 tabular-nums">
                        {unassignedItems.length}
                      </span>
                    </div>

                    <div className="space-y-2.5 min-h-[160px]">
                      {unassignedItems.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-slate-400 dark:text-zinc-600 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl text-xs">
                          <CheckCircle2 className="w-5 h-5 mb-1 text-emerald-500/70" />
                          <span>All items dispatched to crews</span>
                        </div>
                      ) : (
                        unassignedItems.map(item => (
                          <div
                            key={`${item.type}-${item.id}`}
                            className="rounded-xl border border-amber-200/70 dark:border-amber-500/20 p-3 bg-amber-50/30 dark:bg-amber-950/10 shadow-2xs space-y-2"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {new Intl.DateTimeFormat('en-US', {
                                  timeZone: orgTimezone,
                                  hour: 'numeric',
                                  minute: '2-digit'
                                }).format(new Date(item.startTime))}
                              </span>
                              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 uppercase">
                                Unassigned
                              </span>
                            </div>

                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 truncate">
                                {item.jobNumber ? `#${item.jobNumber}: ` : ''}{item.title}
                              </div>
                              {item.customerName && (
                                <div className="text-[11px] text-slate-600 dark:text-zinc-400 truncate">
                                  {item.customerName}
                                </div>
                              )}
                            </div>

                            <div className="pt-1.5 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-end">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setReassignTargetItem(item)
                                  setShowReassignModal(true)
                                }}
                                className="h-6 px-2.5 text-[10px] rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium"
                              >
                                Assign Crew
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      ) : (
        /* Agenda View Wrapper */
        <>
      {/* Filter Tabs */}
      <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 overflow-x-auto max-w-full scrollbar-none">
        {[
          { key: 'all', label: 'All Bookings', count: appointments.length },
          { key: 'requested', label: 'Requests', count: requestedCount, isAlert: requestedCount > 0 },
          { key: 'confirmed', label: 'Confirmed', count: appointments.filter(a => ['confirmed', 'scheduled'].includes(a.status)).length },
          { key: 'completed', label: 'Completed', count: appointments.filter(a => a.status === 'completed').length },
          { key: 'cancelled', label: 'Cancelled', count: appointments.filter(a => a.status === 'cancelled').length }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5",
              statusFilter === tab.key
                ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
                : tab.isAlert
                ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30 font-semibold"
                : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:bg-slate-200/50 dark:hover:bg-zinc-800/50"
            )}
          >
            <span>{tab.label}</span>
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full tabular-nums font-semibold",
              statusFilter === tab.key
                ? "bg-slate-100 dark:bg-zinc-950 text-slate-800 dark:text-zinc-200"
                : "bg-slate-200/80 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Main Agenda Section */}
      {error ? (
        <ErrorState
          title="Failed to load appointments"
          message={error}
          onRetry={loadAppointments}
          retryLabel="Retry Loading"
        />
      ) : loading ? (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-xs">
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-zinc-800/60 last:border-0">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40 bg-slate-100 dark:bg-zinc-800" />
                  <Skeleton className="h-3 w-56 bg-slate-100/70 dark:bg-zinc-800/60" />
                </div>
                <Skeleton className="h-5 w-20 bg-slate-100 dark:bg-zinc-800" />
                <Skeleton className="h-8 w-24 bg-slate-100 dark:bg-zinc-800" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={statusFilter === 'all' ? 'No Bookings on Calendar' : `No ${statusFilter} Appointments`}
          description="Online bookings from your public scheduling page appear here automatically, respecting travel buffers and lead times."
          actionLabel={orgSlug ? 'Copy Public Booking Link' : undefined}
          onAction={orgSlug ? handleCopyBookingLink : undefined}
          secondaryActionLabel="Review Booking Rules"
          onSecondaryAction={() => setShowSettings(true)}
        />
      ) : (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 divide-y divide-slate-100 dark:divide-zinc-800/80 shadow-xs">
          {filteredAppointments.map(apt => {
            const startDate = new Date(apt.start_time)

            return (
              <div
                key={apt.id}
                className="p-4 hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Date badge */}
                  <div className="h-11 w-12 rounded-lg border border-slate-200 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold tabular-nums text-slate-900 dark:text-zinc-100">
                      {startDate.toLocaleDateString('en-US', { timeZone: orgTimezone, day: 'numeric' })}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-zinc-500">
                      {startDate.toLocaleDateString('en-US', { timeZone: orgTimezone, month: 'short' })}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-sm text-slate-900 dark:text-zinc-100 truncate">
                        {apt.title}
                      </h2>
                      {getAppointmentBadge(apt.status)}
                      {apt.source && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-950 dark:text-zinc-400 dark:border-zinc-800">
                          {apt.source}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1 text-slate-800 dark:text-zinc-200 font-medium tabular-nums">
                        <Clock className="h-3 w-3 text-slate-400 dark:text-zinc-500" />
                        {startDate.toLocaleTimeString('en-US', { timeZone: orgTimezone, hour: 'numeric', minute: '2-digit' })}
                      </span>

                      <span className="text-slate-600 dark:text-zinc-300 font-medium">• {apt.contact?.name || apt.contact?.phone}</span>

                      {apt.contact?.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(apt.contact.address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-slate-500 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-zinc-200 truncate max-w-xs transition-colors"
                        >
                          <MapPin className="h-3 w-3 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span className="truncate">{apt.contact.address}</span>
                        </a>
                      )}
                    </div>

                    {apt.notes && (
                      <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-1 italic pt-0.5">
                        {apt.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 pt-2 border-t border-slate-100 dark:border-zinc-800/60 md:border-t-0 md:pt-0 w-full md:w-auto justify-end flex-wrap">
                  {apt.status === 'requested' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(apt.id, 'confirmed')}
                      className="h-8 px-3 rounded-md text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                  )}

                  {['requested', 'confirmed', 'scheduled'].includes(apt.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateStatus(apt.id, 'completed')}
                      className="h-8 px-3 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 rounded-md font-medium shadow-2xs"
                    >
                      Complete
                    </Button>
                  )}

                  {['requested', 'confirmed', 'scheduled'].includes(apt.status) && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(apt.id, 'cancelled')}
                      className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-rose-400 transition-colors shadow-2xs"
                      title="Cancel Booking"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  )}

                  {apt.contact?.phone && (
                    <a
                      href={`tel:${apt.contact.phone}`}
                      className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors shadow-2xs"
                      title="Call customer"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                    </a>
                  )}

                  {apt.manage_token && (
                    <a
                      href={`/book/manage/${apt.manage_token}`}
                      target="_blank"
                      rel="noreferrer"
                      className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-800 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors shadow-2xs"
                      title="Open customer portal"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}

                  {/* Calendar Sync Shortcuts */}
                  <a
                    href={generateGoogleCalendarUrl({
                      title: apt.title,
                      description: `Customer: ${apt.contact?.name || ''} (${apt.contact?.phone || ''})\nService: ${apt.service_type || ''}\nNotes: ${apt.notes || ''}`,
                      location: apt.contact?.address || undefined,
                      startTime: apt.start_time,
                      endTime: apt.end_time || undefined,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-blue-50 text-slate-400 hover:text-blue-600 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors shadow-2xs"
                    title="Add to Google Calendar"
                  >
                    <CalendarDays className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      downloadIcsFile({
                        title: apt.title,
                        description: `Customer: ${apt.contact?.name || ''} (${apt.contact?.phone || ''})\nService: ${apt.service_type || ''}\nNotes: ${apt.notes || ''}`,
                        location: apt.contact?.address || undefined,
                        startTime: apt.start_time,
                        endTime: apt.end_time || undefined,
                      }, `${apt.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`)
                    }}
                    className="h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors cursor-pointer shadow-2xs"
                    title="Export to Apple / Outlook Calendar (.ics)"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>
      )}

      {/* Booking Rules & Services Modal */}
      <Modal
        open={showSettings}
        onOpenChange={setShowSettings}
        title="Booking Rules & Services"
        description="Configure automated slot availability, buffers, and services catalog."
        size="lg"
      >
        <div className="space-y-5">
          {/* Rules Form */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              Availability Settings
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">
                Confirmation Mode
              </label>
              <select
                aria-label="Confirmation Mode"
                value={bookingConfig.booking_mode}
                onChange={(e) => setBookingConfig({ ...bookingConfig, booking_mode: e.target.value as any })}
                className="w-full p-2 rounded-md bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500"
              >
                <option value="instant">Instant Confirmation (Auto-confirms slot & schedules SMS reminder)</option>
                <option value="request">Booking Request (Requires approval from calendar)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Buffer Time (mins)</label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={bookingConfig.buffer_minutes}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, buffer_minutes: parseInt(e.target.value, 10) || 0 })}
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Minimum Notice (hours)</label>
                <Input
                  type="number"
                  min="0"
                  value={bookingConfig.minimum_notice_hours}
                  onChange={(e) => setBookingConfig({ ...bookingConfig, minimum_notice_hours: parseInt(e.target.value, 10) || 0 })}
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Max Advance Booking (days)</label>
              <Input
                type="number"
                min="1"
                max="90"
                value={bookingConfig.max_booking_days_ahead}
                onChange={(e) => setBookingConfig({ ...bookingConfig, max_booking_days_ahead: parseInt(e.target.value, 10) || 30 })}
                className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
              />
            </div>

            {/* Blackout Dates */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Blocked Blackout Dates</label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={newBlockedDate}
                  onChange={(e) => setNewBlockedDate(e.target.value)}
                  className="h-8.5 bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddBlockedDate}
                  className="h-8.5 text-xs border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-2xs"
                >
                  Block Date
                </Button>
              </div>

              {bookingConfig.blocked_dates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {bookingConfig.blocked_dates.map((d) => (
                    <span key={d} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300">
                      {d}
                      <button type="button" onClick={() => handleRemoveBlockedDate(d)}>
                        <X className="h-3 w-3 text-slate-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              size="sm"
              disabled={savingConfig}
              onClick={handleSaveConfig}
              className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
            >
              {savingConfig ? 'Saving...' : 'Save Availability Rules'}
            </Button>
          </div>

          {/* Services Catalog */}
          <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-zinc-800">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
              Service Catalog
            </h3>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {services.map((svc) => (
                <div key={svc.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-zinc-200 block">{svc.name}</span>
                    <span className="text-[11px] text-slate-500 dark:text-zinc-500">{svc.duration_minutes} mins {svc.price ? `• $${svc.price}` : ''}</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                    Active
                  </span>
                </div>
              ))}
            </div>

            {/* Add Service Sub-Form */}
            <form onSubmit={handleAddService} className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950 border border-slate-200/80 dark:border-zinc-800 space-y-2.5">
              <span className="text-xs font-semibold text-slate-800 dark:text-zinc-300 block">Add New Service Offering</span>
              <Input
                type="text"
                required
                placeholder="Service Name (e.g. Diagnostic & Tune-Up)"
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                className="h-8 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  min="15"
                  step="15"
                  placeholder="Duration (mins)"
                  value={newServiceDuration}
                  onChange={(e) => setNewServiceDuration(e.target.value)}
                  className="h-8 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Price ($ optional)"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(e.target.value)}
                  className="h-8 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-zinc-400">
                <input
                  type="checkbox"
                  id="reqAddr"
                  checked={newServiceRequiresAddress}
                  onChange={(e) => setNewServiceRequiresAddress(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:bg-zinc-900 dark:border-zinc-700"
                />
                <label htmlFor="reqAddr">Requires service address</label>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={addingService}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
              >
                {addingService ? 'Adding...' : 'Add Service'}
              </Button>
            </form>
          </div>
        </div>
      </Modal>

      {/* Book Appointment Modal */}
      <Modal
        open={showBookModal}
        onOpenChange={(open) => {
          setShowBookModal(open)
          if (!open) {
            setIsCalendarOpen(false)
          }
        }}
        title="Book Appointment"
        description="Schedule a confirmed appointment or dispatch on your calendar."
        size="xl"
        className="sm:max-w-xl max-w-full overflow-x-hidden"
      >
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Customer</label>
            <select
              aria-label="Select Customer"
              value={bookContactId}
              onChange={(e) => setBookContactId(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="">-- Select Existing Customer or New Customer --</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || 'Customer'} ({c.phone})
                </option>
              ))}
              <option value="new">+ Enter New Customer</option>
            </select>
          </div>

          {(bookContactId === 'new' || (!bookContactId && contacts.length === 0)) && (
            <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/60 border border-slate-200/80 dark:border-zinc-800/80">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Customer Name</label>
                <Input
                  placeholder="e.g. Sarah Connor"
                  value={bookCustomName}
                  onChange={(e) => setBookCustomName(e.target.value)}
                  className="h-8.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Phone Number *</label>
                <Input
                  required
                  placeholder="e.g. +1 555-0199"
                  value={bookCustomPhone}
                  onChange={(e) => setBookCustomPhone(e.target.value)}
                  className="h-8.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-zinc-400 mb-1">Service Address</label>
                <Input
                  placeholder="e.g. 742 Evergreen Terrace"
                  value={bookCustomAddress}
                  onChange={(e) => setBookCustomAddress(e.target.value)}
                  className="h-8.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Service</label>
            <select
              aria-label="Select Service"
              value={bookServiceId}
              onChange={(e) => setBookServiceId(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="">General Appointment</option>
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} ({svc.duration_minutes}m{svc.price ? ` - $${svc.price}` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Interactive Date & Time Slot Picker */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-900 dark:text-zinc-200">
                Date & Time Selection *
              </label>
              <button
                type="button"
                onClick={() => {
                  setIsManualTime(!isManualTime)
                  if (!isManualTime) setIsCalendarOpen(false)
                }}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                {isManualTime ? '← Use Available Slots' : 'Custom / Exact Time →'}
              </button>
            </div>

            {/* Custom Manual Time Input */}
            {isManualTime ? (
              <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-950/80 border border-slate-200 dark:border-zinc-800">
                <Input
                  type="datetime-local"
                  required
                  value={bookDateTime ? (bookDateTime.length === 16 ? bookDateTime : new Date(bookDateTime).toISOString().slice(0, 16)) : ''}
                  onChange={(e) => {
                    setBookDateTime(e.target.value)
                    setSelectedSlotTime('')
                  }}
                  className="h-8.5 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-100 rounded-md focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                  Manual mode allows overriding operating hours and buffer times for special or emergency dispatches.
                </p>
              </div>
            ) : !isCalendarOpen ? (
              /* Calendar Hidden State - Click to open calendar */
              selectedSlotTime ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center font-bold">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {new Date(bookDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        Selected Time: {new Date(selectedSlotTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCalendarOpen(true)}
                    className="h-7.5 text-xs border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-transparent dark:text-emerald-300 dark:hover:bg-emerald-500/20 shadow-2xs"
                  >
                    Change Time
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsCalendarOpen(true)}
                  className="w-full p-3.5 rounded-xl border border-dashed border-slate-300 hover:border-blue-500/80 bg-slate-50/80 hover:bg-blue-50/40 dark:border-zinc-700 dark:bg-zinc-950/70 dark:hover:bg-zinc-900/90 dark:hover:border-blue-500/80 transition-all text-left flex items-center justify-between group cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                      <CalendarIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-white block">
                        Click to open calendar & select time
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-500 block">
                        Browse open slots and booked hours on your schedule
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                    <span>Open Calendar</span>
                    <span>→</span>
                  </span>
                </button>
              )
            ) : (
              /* Calendar Expanded State */
              <div className="space-y-3 p-3.5 rounded-xl bg-slate-50/80 dark:bg-zinc-950/90 border border-slate-200 dark:border-zinc-800 overflow-x-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80 dark:border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200">
                      Live Schedule & Availability
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCalendarOpen(false)}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white px-2 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Hide Calendar ▲
                  </button>
                </div>

                {/* Day selector pills + Mini Calendar date input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold text-slate-700 dark:text-zinc-300">Choose Day</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 dark:text-zinc-500">Pick date:</span>
                      <input
                        type="date"
                        aria-label="Pick calendar date"
                        value={bookDate}
                        onChange={(e) => {
                          setBookDate(e.target.value)
                          setSelectedSlotTime('')
                          setBookDateTime('')
                        }}
                        className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700/80 rounded px-2 py-0.5 text-slate-900 dark:text-zinc-200 text-xs focus:outline-none cursor-pointer shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* 7-Day quick selector buttons */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {quickDatePills.map((p) => {
                      const isSelected = bookDate === p.dateStr
                      return (
                        <button
                          key={p.dateStr}
                          type="button"
                          onClick={() => {
                            setBookDate(p.dateStr)
                            setSelectedSlotTime('')
                            setBookDateTime('')
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center min-w-[56px] py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer shrink-0",
                            isSelected
                              ? "bg-blue-600 border-blue-600 text-white font-bold shadow-xs"
                              : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200 hover:border-slate-300 dark:hover:border-zinc-700 shadow-2xs"
                          )}
                        >
                          <span className="text-[10px] uppercase font-semibold">{p.dayOfWeek}</span>
                          <span className="text-xs font-bold">{p.dayNum}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Available & Booked Time Slots Grid */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-slate-700 dark:text-zinc-400">Select Time Slot</span>
                    {selectedSlotTime && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        Selected: {new Date(selectedSlotTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {loadingBookingSlots ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="h-9 rounded-lg bg-slate-100 dark:bg-zinc-900 animate-pulse border border-slate-200/60 dark:border-zinc-800/60" />
                      ))}
                    </div>
                  ) : bookingAllSlots.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-100/70 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 text-center text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      <p>No slots generated for this day.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualTime(true)
                          setIsCalendarOpen(false)
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold inline-block text-[11px] cursor-pointer"
                      >
                        Enter a custom dispatch time →
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                      {bookingAllSlots.map((slot) => {
                        const isSelected = selectedSlotTime === slot.startTime
                        const isBooked = !slot.isAvailable && slot.status === 'booked'
                        const isPast = slot.status === 'past'

                        return (
                          <button
                            key={slot.startTime}
                            type="button"
                            onClick={() => {
                              setSelectedSlotTime(slot.startTime)
                              setBookDateTime(slot.startTime)
                            }}
                            className={cn(
                              "py-2 px-2.5 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer flex items-center justify-between gap-1 shadow-2xs",
                              isSelected
                                ? "bg-emerald-600 border-emerald-600 text-white font-bold shadow-xs ring-2 ring-emerald-400/30"
                                : isBooked
                                ? "bg-rose-50/70 dark:bg-zinc-950 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-300/80 hover:border-rose-300"
                                : isPast
                                ? "bg-amber-50/70 dark:bg-zinc-950/80 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-zinc-300 hover:border-amber-300"
                                : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-300 hover:border-blue-400 hover:text-blue-700 hover:bg-blue-50/50 dark:hover:border-zinc-700 dark:hover:text-white dark:hover:bg-zinc-850"
                            )}
                            title={isBooked ? "Booked by another appointment (Click to select/override)" : isPast ? "Earlier today (Click to dispatch)" : "Available"}
                          >
                            <span className={cn(isBooked && "line-through decoration-rose-500/50")}>
                              {slot.displayTime}
                            </span>
                            {isBooked ? (
                              <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30">
                                Booked
                              </span>
                            ) : isPast ? (
                              <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                                Past
                              </span>
                            ) : slot.isAvailable ? (
                              <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400">
                                Open
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">Notes / Job Scope</label>
            <textarea
              rows={2}
              placeholder="Special instructions, gate codes, or issue details..."
              value={bookNotes}
              onChange={(e) => setBookNotes(e.target.value)}
              className="w-full p-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs text-slate-900 dark:text-zinc-200 focus:outline-none focus:border-blue-500 resize-none shadow-2xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBookModal(false)}
              className="h-8.5 text-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-400 dark:hover:text-white shadow-2xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={bookingLoading}
              className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-xs"
            >
              {bookingLoading ? 'Booking...' : 'Confirm Appointment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reassign Crew Modal */}
      <ReassignCrewModal
        open={showReassignModal}
        onOpenChange={setShowReassignModal}
        item={reassignTargetItem}
        crews={crews}
        onSuccess={() => {
          loadAppointments()
        }}
      />

      {/* Crew Modal for quick crew/van creation */}
      <CrewModal
        open={showCrewModal}
        onOpenChange={setShowCrewModal}
        teamMembers={teamMembers}
        onSuccess={() => {
          loadAppointments()
        }}
      />

    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-zinc-500">Loading schedule...</div>}>
      <CalendarContent />
    </Suspense>
  )
}
