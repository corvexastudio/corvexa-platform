'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { EmptyState } from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import { 
  UserPlus, 
  Mail, 
  Truck, 
  Send, 
  Plus, 
  Users, 
  Phone, 
  MapPin, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Edit2, 
  Trash2,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { CrewModal } from '@/components/crews/crew-modal'
import type { Crew, CrewPerformanceMetric } from '@/lib/crews/crew-manager'
import { cn } from '@/lib/utils'

export default function TeamPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'members' | 'crews'>('members')
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'client_admin' | 'dispatcher' | 'technician'>('dispatcher')
  const [inviting, setInviting] = useState(false)
  const [pendingInvite, setPendingInvite] = useState<{ email: string; link?: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

  // Crews & Fleet State
  const [crews, setCrews] = useState<Crew[]>([])
  const [crewMetrics, setCrewMetrics] = useState<CrewPerformanceMetric[]>([])
  const [loadingCrews, setLoadingCrews] = useState(false)
  const [showCrewModal, setShowCrewModal] = useState(false)
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null)
  const [broadcasting, setBroadcasting] = useState(false)

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setError('Authentication required to view team members.')
        setLoading(false)
        return
      }
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('org_id').eq('id', user.id).maybeSingle()
      if (profileErr || !profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }
      const { data, error: membersErr } = await supabase.from('profiles').select('*').eq('org_id', profile.org_id)
      if (membersErr) {
        setError('Failed to load team members. Please retry.')
      } else if (data) {
        setMembers(data)
      }
    } catch {
      setError('An unexpected error occurred while loading team members.')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const fetchCrews = useCallback(async () => {
    setLoadingCrews(true)
    try {
      const [crewsRes, metricsRes] = await Promise.all([
        fetch('/api/client/crews'),
        fetch('/api/client/crews/metrics?days=30')
      ])

      if (crewsRes.ok) {
        const data = await crewsRes.json()
        setCrews(data.crews || [])
      }

      if (metricsRes.ok) {
        const mData = await metricsRes.json()
        setCrewMetrics(mData.metrics || [])
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingCrews(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
    fetchCrews()
  }, [fetchMembers, fetchCrews])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      })
      const data = await res.json()
      setInviting(false)

      if (data.status === 'INVITE_SENT') {
        toast.success(`Invitation sent to ${inviteEmail}!`)
        setOpen(false)
        setInviteEmail('')
        setPendingInvite(null)
        fetchMembers()
      } else if (data.status === 'INVITE_CREATED_BUT_EMAIL_PENDING') {
        toast.warning("Invitation created, but email delivery isn't configured.")
        setPendingInvite({ email: inviteEmail, link: data.inviteLink })
        fetchMembers()
      } else {
        toast.error(data.error || data.message || 'Failed to send invite.')
      }
    } catch {
      setInviting(false)
      toast.error('Network error while creating invite.')
    }
  }

  const handleCopyLink = () => {
    if (!pendingInvite?.link) return
    navigator.clipboard.writeText(pendingInvite.link)
    setCopiedLink(true)
    toast.success('Invitation link copied to clipboard!')
    setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleBroadcastSchedule = async () => {
    setBroadcasting(true)
    try {
      const res = await fetch('/api/client/crews/broadcast-schedule', {
        method: 'POST'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Morning route schedule sent to ${data.totalSent} crew phone(s)!`)
      } else {
        toast.error(data.error || 'Failed to send route broadcast')
      }
    } catch {
      toast.error('Network error sending route broadcast')
    } finally {
      setBroadcasting(false)
    }
  }

  const handleDeactivateCrew = async (crewId: string) => {
    try {
      const res = await fetch(`/api/client/crews/${crewId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Crew deactivated')
        fetchCrews()
      } else {
        toast.error('Failed to deactivate crew')
      }
    } catch {
      toast.error('Network error deactivating crew')
    }
  }

  // Combined fleet totals
  const totalFleetRevenue = crewMetrics.reduce((acc, m) => acc + (m.totalRevenue || 0), 0)
  const totalJobsCompleted = crewMetrics.reduce((acc, m) => acc + (m.completedJobs || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-zinc-100 tracking-tight">
            Team &amp; Fleet Management
          </h1>
          <p className="text-slate-500 dark:text-zinc-400 text-xs mt-0.5">
            Manage authorized staff, technician field roles, and multi-van dispatch crews.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'crews' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBroadcastSchedule}
                disabled={broadcasting || crews.length === 0}
                className="h-9 rounded-md border-slate-200 dark:border-zinc-800 text-xs text-slate-700 dark:text-zinc-300"
              >
                {broadcasting ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                )}
                <span>Send 7 AM Routes Now</span>
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setEditingCrew(null)
                  setShowCrewModal(true)
                }}
                className="h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
              >
                <Plus className="mr-1.5 h-4 w-4" /> Add Crew / Van
              </Button>
            </>
          ) : (
            <Dialog open={open} onOpenChange={setOpen}>
              {/* @ts-ignore */}
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs w-full sm:w-auto">
                  <UserPlus className="mr-2 h-4 w-4" /> Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="mx-4 sm:mx-0 bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 shadow-lg">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-zinc-100">Invite Team Member</DialogTitle>
                  <DialogDescription className="text-slate-500 dark:text-zinc-400">
                    Send an invitation email to a dispatcher, technician, or manager.
                  </DialogDescription>
                </DialogHeader>
                {pendingInvite ? (
                  <div className="space-y-4 py-2">
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                      <p className="font-semibold text-amber-900 dark:text-amber-300">
                        Invitation created, but email delivery isn&apos;t configured.
                      </p>
                      <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
                        The member account was created for <strong>{pendingInvite.email}</strong>, but automatic SMTP email dispatch is not enabled in your platform settings.
                      </p>
                    </div>

                    {pendingInvite.link && (
                      <div className="space-y-2">
                        <Label className="text-xs text-slate-600 dark:text-zinc-400">One-Time Invitation Link</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            value={pendingInvite.link}
                            className="font-mono text-xs select-all bg-slate-50 dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100"
                          />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleCopyLink}
                            className="shrink-0 h-9 rounded-md text-xs"
                          >
                            {copiedLink ? 'Copied' : 'Copy Link'}
                          </Button>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-500">
                          Share this secure link with your teammate so they can accept their invite.
                        </p>
                      </div>
                    )}

                    <DialogFooter>
                      <Button
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          setPendingInvite(null)
                          setInviteEmail('')
                        }}
                        className="w-full sm:w-auto h-9 rounded-md text-xs"
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <form onSubmit={handleInvite} className="space-y-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="email" className="text-xs text-slate-700 dark:text-zinc-300">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="teammate@example.com"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100"
                        required
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label className="text-xs text-slate-700 dark:text-zinc-300">Role &amp; Permissions</Label>
                      <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                        <SelectTrigger className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200">
                          <SelectItem value="client_admin">Client Admin — Full access to settings &amp; finances</SelectItem>
                          <SelectItem value="dispatcher">Dispatcher — Calendar, Calls &amp; Inbox</SelectItem>
                          <SelectItem value="technician">Technician — Field Mobile View &amp; Daily Route Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={inviting} className="w-full sm:w-auto h-10 sm:h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm sm:text-xs">
                        {inviting ? 'Sending...' : 'Send Invitation'}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-slate-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-slate-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 self-start">
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
            activeTab === 'members'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Staff &amp; Members</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 font-bold tabular-nums">
            {members.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('crews')}
          className={cn(
            "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5",
            activeTab === 'crews'
              ? "bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-xs font-semibold"
              : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-200"
          )}
        >
          <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Crews &amp; Fleet</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold tabular-nums">
            {crews.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Staff & Permissions */}
      {activeTab === 'members' && (
        <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200/80 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-950/40">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">Authorized Team Members</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Authorized staff accounts with role-based permissions.</p>
          </div>
          <div className="p-4">
            {error ? (
              <ErrorState
                title="Failed to load team members"
                message={error}
                onRetry={fetchMembers}
                retryLabel="Retry Loading Members"
              />
            ) : loading ? (
              <div className="space-y-3 py-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-zinc-800/60">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full bg-slate-200 dark:bg-zinc-800" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-3.5 w-32 bg-slate-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-48 bg-slate-100 dark:bg-zinc-800/60" />
                      </div>
                    </div>
                    <Skeleton className="h-5 w-16 rounded-md bg-slate-200 dark:bg-zinc-800" />
                  </div>
                ))}
              </div>
            ) : members.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-zinc-400 py-6 text-center">
                No team members found. Invite your first team member above.
              </p>
            ) : (
              <>
                {/* Mobile: card list */}
                <div className="block sm:hidden divide-y divide-slate-100 dark:divide-zinc-800/60">
                  {members.map((m) => (
                    <div key={m.id} className="py-3.5 min-h-[48px] flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-center text-xs font-semibold text-slate-700 dark:text-zinc-200 shrink-0">
                        {(m.full_name || m.email || '?')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 dark:text-zinc-200 truncate">{m.full_name || '—'}</p>
                        <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 shrink-0" /> {m.email}
                        </p>
                      </div>
                      <span className={cn(
                        "shrink-0 text-[11px] px-2 py-0.5 rounded-md font-medium border",
                        m.role === 'client_admin'
                          ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                          : m.role === 'technician'
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                      )}>
                        {m.role === 'client_admin' ? 'Admin' : m.role === 'technician' ? 'Technician' : 'Dispatcher'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Desktop: table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                        <th className="text-left py-2.5 px-3 font-semibold">Name</th>
                        <th className="text-left py-2.5 px-3 font-semibold">Email</th>
                        <th className="text-left py-2.5 px-3 font-semibold">Role</th>
                        <th className="text-left py-2.5 px-3 font-semibold">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-zinc-200">{m.full_name || '—'}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-zinc-400">{m.email}</td>
                          <td className="py-2.5 px-3">
                            <span className={cn(
                              "text-[11px] px-2 py-0.5 rounded-md font-medium border",
                              m.role === 'client_admin'
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : m.role === 'technician'
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700"
                            )}>
                              {m.role === 'client_admin' ? 'Admin' : m.role === 'technician' ? 'Technician' : 'Dispatcher'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 dark:text-zinc-400 text-[11px]">{new Date(m.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Crews & Fleet Management */}
      {activeTab === 'crews' && (
        <div className="space-y-6">
          {/* Fleet Performance KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Active Crews &amp; Vans</span>
              <div className="text-xl font-bold text-slate-900 dark:text-zinc-100 mt-1">{crews.length}</div>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Completed Jobs (30d)</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{totalJobsCompleted}</div>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Fleet Revenue (30d)</span>
              <div className="text-xl font-bold text-slate-900 dark:text-zinc-100 mt-1">${totalFleetRevenue.toLocaleString()}</div>
            </div>
            <div className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-[11px] font-medium text-slate-500 dark:text-zinc-400">Daily 7 AM Route SMS</span>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active Automation
              </div>
            </div>
          </div>

          {/* Crews Grid */}
          {loadingCrews ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-44 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 animate-pulse" />
              ))}
            </div>
          ) : crews.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No Crews or Vans Added Yet"
              description="Add your first van or crew to unlock multi-crew calendar dispatch, 7 AM morning route SMS broadcasts, and per-van revenue analytics."
              actionLabel="Add First Crew"
              onAction={() => {
                setEditingCrew(null)
                setShowCrewModal(true)
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {crews.map(c => {
                const metric = crewMetrics.find(m => m.crewId === c.id)
                return (
                  <div
                    key={c.id}
                    className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3.5 shadow-2xs hover:border-slate-300 dark:hover:border-zinc-700 transition-colors"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-4 h-4 rounded-full shrink-0 border border-black/10 shadow-2xs"
                          style={{ backgroundColor: c.color_code }}
                        />
                        <div className="truncate">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 truncate">
                            {c.name}
                          </h3>
                          {c.phone_number && (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span>{c.phone_number}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCrew(c)
                            setShowCrewModal(true)
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Edit Crew"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeactivateCrew(c.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Deactivate Crew"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Territory & Lead */}
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400 pt-1 border-t border-slate-100 dark:border-zinc-800/80">
                      {c.service_area && (
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{c.service_area}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 truncate">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {c.crew_lead?.full_name ? `Lead: ${c.crew_lead.full_name}` : 'No lead'} • {c.member_ids?.length || 0} member{c.member_ids?.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Per-Crew Performance Stats */}
                    {metric && (
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800/80 text-center">
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60">
                          <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-medium">Jobs</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                            {metric.completedJobs}/{metric.totalJobs}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60">
                          <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-medium">Revenue</div>
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            ${metric.totalRevenue.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-zinc-950/60">
                          <div className="text-[10px] text-slate-500 dark:text-zinc-500 uppercase font-medium">Avg Site</div>
                          <div className="text-xs font-bold text-slate-900 dark:text-zinc-100 mt-0.5">
                            {metric.avgDurationMinutes ? `${metric.avgDurationMinutes}m` : '—'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Crew Create/Edit Modal */}
      <CrewModal
        open={showCrewModal}
        onOpenChange={setShowCrewModal}
        crew={editingCrew}
        teamMembers={members}
        onSuccess={() => {
          fetchCrews()
        }}
      />
    </div>
  )
}
