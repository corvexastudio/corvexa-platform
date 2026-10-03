'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { 
  Users, 
  Search, 
  PhoneCall, 
  MessageSquare, 
  Star, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert,
  Clock,
  MapPin
} from 'lucide-react'
import Link from 'next/link'

interface ContactItem {
  id: string
  name?: string | null
  phone: string
  email?: string | null
  address?: string | null
  opt_out: boolean
  tags: string[]
  notes?: string | null
  created_at: string
}

export default function CustomersPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadContacts = useCallback(async () => {
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
      .from('contacts')
      .select('*')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })

    if (data) setContacts(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadContacts() }, [loadContacts])

  const sendReviewQuick = async (contact: ContactItem) => {
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: contact.name || 'Valued Customer', phone: contact.phone }),
      })
      if (res.ok) {
        toast.success(`5-Star Review link sent to ${contact.name || contact.phone}!`)
      } else {
        toast.error('Failed to send review invite.')
      }
    } catch {
      toast.error('Network error.')
    }
  }

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.address?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
            <Users className="h-6 w-6 text-blue-500" />
            Customer Directory
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            All homeowners and contacts captured from calls and web enquiries.
          </p>
        </div>

        <div className="w-full sm:w-64">
          <Input
            placeholder="Search by name, phone, address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 bg-zinc-900 border-zinc-800 text-xs rounded-xl text-white placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* Contacts List / Table */}
      <div className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 border-b border-zinc-800/80 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Contact Info</th>
                <th className="py-3.5 px-4">Location</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    {loading ? 'Loading contacts...' : 'No customers captured yet.'}
                  </td>
                </tr>
              ) : (
                filtered.map(contact => (
                  <tr key={contact.id} className="hover:bg-zinc-900/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-sm text-white">
                        {contact.name || 'Unsaved Contact'}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        Added {new Date(contact.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-200">{contact.phone}</div>
                      {contact.email && (
                        <div className="text-zinc-400 text-[11px]">{contact.email}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-zinc-300">
                      {contact.address ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-zinc-400 shrink-0" />
                          <span className="truncate max-w-[200px]">{contact.address}</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      {contact.opt_out ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-500/20">
                          <ShieldAlert className="h-3 w-3" /> Opted Out (STOP)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          <ShieldCheck className="h-3 w-3" /> Subscribed
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={`tel:${contact.phone}`}
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                          title="Call phone"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                        </a>
                        <Link
                          href="/client/inbox"
                          className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
                          title="Open 2-way chat"
                        >
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
                        </Link>
                        <button
                          onClick={() => sendReviewQuick(contact)}
                          className="p-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-colors"
                          title="Send 5-Star Review Invite"
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
