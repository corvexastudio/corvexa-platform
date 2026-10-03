'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  PhoneCall, 
  MessageSquare, 
  Plus, 
  CheckCircle2, 
  CalendarDays
} from 'lucide-react'
import Link from 'next/link'

interface AppointmentItem {
  id: string
  title: string
  service_type?: string | null
  start_time: string
  end_time?: string | null
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled'
  notes?: string | null
  contact: {
    name?: string | null
    phone: string
    address?: string | null
  }
}

export default function CalendarPage() {
  const supabase = createClient()
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile) return

    const { data } = await supabase
      .from('appointments')
      .select(`
        id, title, service_type, start_time, end_time, status, notes,
        contact:contacts(name, phone, address)
      `)
      .eq('org_id', profile.org_id)
      .order('start_time', { ascending: true })

    if (data) {
      const enriched: AppointmentItem[] = data.map((a: any) => ({
        ...a,
        contact: Array.isArray(a.contact) ? a.contact[0] : a.contact
      }))
      setAppointments(enriched)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <CalendarIcon className="h-6 w-6 text-blue-500" />
            Appointments & Schedule
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Service visits, estimates, and consultations booked from recovered calls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-zinc-900 text-zinc-300 border border-zinc-800 flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
            {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Agenda Feed */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/70 mb-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Upcoming Bookings
          </h2>
          <span className="text-xs text-zinc-400">
            {appointments.length} Scheduled
          </span>
        </div>

        {appointments.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-3">
            <CalendarDays className="h-12 w-12 text-zinc-700 mx-auto" />
            <h3 className="text-sm font-semibold text-white">No upcoming appointments yet</h3>
            <p className="text-xs text-zinc-400 max-w-sm mx-auto">
              When leads book estimates or service calls through your CaptoDesk 2-way inbox, appointments will automatically appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map(apt => (
              <div
                key={apt.id}
                className="rounded-xl bg-[#0B0F19] border border-zinc-800/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-zinc-700 transition-all shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex flex-col items-center justify-center shrink-0 text-blue-400">
                    <span className="text-xs font-black">
                      {new Date(apt.start_time).toLocaleDateString([], { day: 'numeric' })}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-zinc-400">
                      {new Date(apt.start_time).toLocaleDateString([], { month: 'short' })}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white">
                        {apt.title}
                      </h3>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400 border border-emerald-500/20">
                        {apt.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span className="flex items-center gap-1 text-zinc-300 font-medium">
                        <Clock className="h-3 w-3 text-blue-400" />
                        {new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {apt.contact?.address && (
                        <span className="flex items-center gap-1 text-zinc-400">
                          <MapPin className="h-3 w-3" />
                          {apt.contact.address}
                        </span>
                      )}
                      <span>• {apt.contact?.name || apt.contact?.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={`tel:${apt.contact?.phone}`}
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                  </a>
                  <Link
                    href="/client/inbox"
                    className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                  >
                    <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
