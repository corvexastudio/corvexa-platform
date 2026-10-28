'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
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
  Loader2, 
  UserX, 
  Shield, 
  ShieldCheck, 
  ShieldAlert,
  Smartphone, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Building2, 
  Sparkles, 
  ArrowRight, 
  Briefcase, 
  Calendar, 
  BadgeCheck,
  Radio,
  SlidersHorizontal
} from 'lucide-react'
import { toast } from 'sonner'
import { CrewModal } from '@/components/crews/crew-modal'
import type { Crew, CrewPerformanceMetric } from '@/lib/crews/crew-manager'
import { useWorkspace } from '@/lib/context/workspace-context'
import { ProUpgradeModal } from '@/components/billing/pro-upgrade-modal'
import { getIndustryPreset } from '@/lib/constants/industries'
import { cn } from '@/lib/utils'

function formatPhoneNumber(num?: string | null) {
  if (!num) return ''
  const cleaned = num.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
  }
  return num
}

export default function TeamPage() {
  const supabase = createClient()
  const { planId, subscriptionStatus, orgName, operationMode } = useWorkspace()
  const isFleetEntitled = ['fleet', 'multi_crew', 'multi_crew_yearly', 'fleet_monthly', 'fleet_yearly'].includes((planId || '').toLowerCase()) && subscriptionStatus === 'active'

  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeFeature, setUpgradeFeature] = useState('Staff & Crew Management')

  // Contextual View Mode: Solo Operator vs Fleet Operations
  const [viewModeOverride, setViewModeOverride] = useState<'solo' | 'fleet' | null>(null)
  const [activeTab, setActiveTab] = useState<'members' | 'crews' | 'permissions'>('members')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'dispatcher' | 'technician'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Data states
  const [members, setMembers] = useState<any[]>([])
  const [organization, setOrganization] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invites state
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'client_admin' | 'dispatcher' | 'technician'>('dispatcher')
  const [inviting, setInviting] = useState(false)
  const [pendingInvite, setPendingInvite] = useState<{ email: string; link?: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedFieldLink, setCopiedFieldLink] = useState(false)

  // Current User & Staff Management State
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [editingMember, setEditingMember] = useState<any | null>(null)
  const [targetRole, setTargetRole] = useState<string>('dispatcher')
  const [savingRole, setSavingRole] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<any | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

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
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).maybeSingle()
      if (profileErr || !profile || !profile.org_id) {
        window.location.href = '/client/onboarding'
        return
      }
      setCurrentUserId(user.id)
      setCurrentUserRole(profile.role || 'member')

      // Fetch organization profile for solo field credentials & dispatch metadata
      const [membersRes, orgRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('org_id', profile.org_id),
        supabase.from('organizations')
          .select('id, name, slug, industry, owner_phone, telnyx_phone_number, address_street, address_city, address_state, address_postal_code, license_number, carrier_registration_status')
          .eq('id', profile.org_id)
          .maybeSingle()
      ])

      if (membersRes.error) {
        setError('Failed to load team members. Please retry.')
      } else if (membersRes.data) {
        setMembers(membersRes.data)
      }

      if (orgRes.data) {
        setOrganization(orgRes.data)
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

  const handleCopyFieldLink = () => {
    const fieldUrl = typeof window !== 'undefined' ? `${window.location.origin}/client/field` : 'https://app.captodesk.com/client/field'
    navigator.clipboard.writeText(fieldUrl)
    setCopiedFieldLink(true)
    toast.success('Mobile field route link copied!')
    setTimeout(() => setCopiedFieldLink(false), 2000)
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

  // Staff Management Helpers & Handlers
  const canManageTeam = ['owner', 'admin', 'client_admin', 'super_admin'].includes(currentUserRole || '')
  const isOwnerOrSuper = ['owner', 'super_admin'].includes(currentUserRole || '')

  const canEditTarget = (target: any) => {
    if (!canManageTeam) return false
    if (target.id === currentUserId) return false
    if (['owner', 'super_admin'].includes(target.role) && !isOwnerOrSuper) return false
    return true
  }

  const openRoleModal = (m: any) => {
    setEditingMember(m)
    setTargetRole(m.role === 'admin' ? 'client_admin' : (m.role || 'dispatcher'))
  }

  const handleSaveRole = async () => {
    if (!editingMember) return
    setSavingRole(true)
    try {
      const res = await fetch(`/api/team/${editingMember.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Member role updated successfully')
        setEditingMember(null)
        fetchMembers()
      } else {
        toast.error(data.error || 'Failed to update member role')
      }
    } catch {
      toast.error('Network error updating member role')
    } finally {
      setSavingRole(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return
    setRemovingMember(true)
    try {
      const res = await fetch(`/api/team/${memberToRemove.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success('Member removed from organization')
        setMemberToRemove(null)
        fetchMembers()
      } else {
        toast.error(data.error || 'Failed to remove member')
      }
    } catch {
      toast.error('Network error removing member')
    } finally {
      setRemovingMember(false)
    }
  }

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return { label: 'Owner', className: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/40' }
      case 'admin':
      case 'client_admin':
        return { label: 'Admin', className: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/40' }
      case 'technician':
        return { label: 'Technician', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' }
      case 'dispatcher':
        return { label: 'Dispatcher', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/40' }
      default:
        return { label: role || 'Member', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700' }
    }
  }

  // Combined fleet totals
  const totalFleetRevenue = crewMetrics.reduce((acc, m) => acc + (m.totalRevenue || 0), 0)
  const totalJobsCompleted = crewMetrics.reduce((acc, m) => acc + (m.completedJobs || 0), 0)

  // Counts by role
  const adminCount = members.filter(m => ['owner', 'admin', 'client_admin', 'super_admin'].includes(m.role)).length
  const dispCount = members.filter(m => m.role === 'dispatcher').length
  const techCount = members.filter(m => m.role === 'technician').length

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      // Role filter
      if (roleFilter === 'admin' && !['owner', 'admin', 'client_admin', 'super_admin'].includes(m.role)) return false
      if (roleFilter === 'dispatcher' && m.role !== 'dispatcher') return false
      if (roleFilter === 'technician' && m.role !== 'technician') return false

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const name = (m.full_name || '').toLowerCase()
        const email = (m.email || '').toLowerCase()
        const phone = (m.phone || '').toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !phone.includes(q)) return false
      }
      return true
    })
  }, [members, roleFilter, searchQuery])

  // Contextual Mode Determination:
  // If operationMode is explicitly solo or multi_crew, respect it; otherwise fall back to member/crew heuristic.
  const isSoloNatural = operationMode ? (operationMode === 'solo') : (members.length <= 1 && crews.length === 0 && !isFleetEntitled)
  const currentMode = viewModeOverride ?? (isSoloNatural ? 'solo' : 'fleet')

  // Find primary solo user data
  const currentUser = members.find(m => m.id === currentUserId) || members[0]
  const tradePreset = getIndustryPreset(organization?.industry)

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Top Header & Contextual View Switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {currentMode === 'solo' ? 'My Profile & Field Credentials' : 'Team & Fleet Management'}
            </h1>
            <span className={cn(
              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border",
              currentMode === 'solo'
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40"
                : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/40"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                currentMode === 'solo' ? "bg-emerald-500" : "bg-sky-500"
              )} />
              {currentMode === 'solo' ? 'Solo Operator Mode' : 'Multi-Crew Fleet Mode'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {currentMode === 'solo'
              ? 'Personal dispatch credentials, connected virtual phone line, and field mobile route portal.'
              : 'Dispatch staff directory, 7 AM morning route broadcasts, and multi-crew van fleet operations.'}
          </p>
        </div>

        {/* Action Controls & Mode Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Mode Override Switcher Pill */}
          <button
            type="button"
            onClick={() => setViewModeOverride(currentMode === 'solo' ? 'fleet' : 'solo')}
            className="inline-flex items-center gap-1.5 h-10 sm:h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer min-h-[48px] sm:min-h-0"
            title="Toggle between Solo Operator View and Fleet Crew View"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-500" />
            <span>{currentMode === 'solo' ? 'Preview Fleet Mode' : 'Solo Dossier View'}</span>
          </button>

          {currentMode === 'solo' ? (
            <>
              <Link
                href="/client/field"
                className="inline-flex items-center justify-center gap-1.5 h-10 sm:h-9 px-3.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition-colors shadow-2xs min-h-[48px] sm:min-h-0"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Open Field App</span>
                <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
              </Link>

              {!isFleetEntitled && (
                <Button
                  size="sm"
                  onClick={() => {
                    setUpgradeFeature('Multi-Crew Dispatch & Fleet Van Assignment')
                    setShowUpgradeModal(true)
                  }}
                  className="h-10 sm:h-9 px-3.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-2xs cursor-pointer min-h-[48px] sm:min-h-0"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-blue-200" />
                  <span>Scale to Crew</span>
                </Button>
              )}
            </>
          ) : (
            <>
              {activeTab === 'crews' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBroadcastSchedule}
                  disabled={broadcasting || crews.length === 0}
                  className="h-10 sm:h-9 rounded-lg border-zinc-200 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 shadow-2xs min-h-[48px] sm:min-h-0"
                >
                  {broadcasting ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span>Send 7 AM Routes Now</span>
                </Button>
              )}

              {activeTab === 'crews' ? (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!isFleetEntitled) {
                      setUpgradeFeature('Multi-Crew Dispatch & Van Assignment')
                      setShowUpgradeModal(true)
                      return
                    }
                    setEditingCrew(null)
                    setShowCrewModal(true)
                  }}
                  className="h-10 sm:h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer shadow-2xs min-h-[48px] sm:min-h-0"
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add Crew / Van
                </Button>
              ) : !isFleetEntitled ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setUpgradeFeature('Staff & Dispatcher Seats')
                    setShowUpgradeModal(true)
                  }}
                  className="h-10 sm:h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs w-full sm:w-auto cursor-pointer shadow-2xs min-h-[48px] sm:min-h-0"
                >
                  <UserPlus className="mr-1.5 h-4 w-4" /> Invite Member
                </Button>
              ) : (
                <Dialog open={open} onOpenChange={setOpen}>
                  {/* @ts-ignore */}
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-10 sm:h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs w-full sm:w-auto shadow-2xs cursor-pointer min-h-[48px] sm:min-h-0">
                      <UserPlus className="mr-1.5 h-4 w-4" /> Invite Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="mx-4 sm:mx-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="text-zinc-900 dark:text-zinc-100 text-base font-semibold">Invite Team Member</DialogTitle>
                      <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
                        Grant secure access to a dispatcher, field technician, or manager.
                      </DialogDescription>
                    </DialogHeader>

                    {pendingInvite ? (
                      <div className="space-y-4 py-2">
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                          <p className="font-semibold text-amber-900 dark:text-amber-300">
                            Invitation created, but email delivery isn&apos;t configured.
                          </p>
                          <p className="mt-1 text-xs text-amber-800/80 dark:text-amber-200/80">
                            Account prepared for <strong>{pendingInvite.email}</strong>. Copy and share the direct activation link below:
                          </p>
                        </div>

                        {pendingInvite.link && (
                          <div className="space-y-2">
                            <Label className="text-xs text-zinc-600 dark:text-zinc-400">One-Time Activation Link</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                readOnly
                                value={pendingInvite.link}
                                className="font-mono text-xs select-all bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 h-10"
                              />
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handleCopyLink}
                                className="shrink-0 h-10 rounded-lg text-xs"
                              >
                                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                {copiedLink ? 'Copied' : 'Copy Link'}
                              </Button>
                            </div>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
                              This secure link expires in 7 days.
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
                            className="w-full sm:w-auto h-10 sm:h-9 rounded-lg text-xs"
                          >
                            Done
                          </Button>
                        </DialogFooter>
                      </div>
                    ) : (
                      <form onSubmit={handleInvite} className="space-y-4">
                        <div className="grid gap-1.5">
                          <Label htmlFor="email" className="text-xs text-zinc-700 dark:text-zinc-300">Teammate Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="tech@example.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            className="h-10 sm:h-9 rounded-lg text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100"
                            required
                          />
                        </div>

                        <div className="grid gap-1.5">
                          <Label className="text-xs text-zinc-700 dark:text-zinc-300">Assign Role &amp; Permissions</Label>
                          <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                            <SelectTrigger className="h-10 sm:h-9 rounded-lg text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                              <SelectItem value="client_admin">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Client Admin</span> — Full operational &amp; financial access
                              </SelectItem>
                              <SelectItem value="dispatcher">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Dispatcher</span> — Calendar, 2-Way Calls &amp; Inbox (No banking)
                              </SelectItem>
                              <SelectItem value="technician">
                                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Technician</span> — Field Mobile Route &amp; On-Site Jobs Only
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 p-3 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                          <div className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-blue-600" />
                            <span>Privacy &amp; Security Shield</span>
                          </div>
                          <p className="text-[11px] leading-relaxed">
                            Technicians cannot see customer billing cards, SaaS subscription plans, or banking payouts. They only see their assigned daily route stops.
                          </p>
                        </div>

                        <DialogFooter className="pt-2">
                          <Button type="submit" disabled={inviting} className="w-full sm:w-auto h-10 sm:h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs cursor-pointer">
                            {inviting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                            {inviting ? 'Creating Invite...' : 'Send Invitation'}
                          </Button>
                        </DialogFooter>
                      </form>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>
      </div>

      {/* 4 Contextual Operational Metric Tokens */}
      {currentMode === 'solo' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Operator Identity</span>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1 truncate">
              {currentUser?.full_name || 'Primary Owner'}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Primary Field Dispatcher
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Virtual Telnyx DID</span>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono tabular-nums truncate">
              {formatPhoneNumber(organization?.telnyx_phone_number) || 'Provisioned Line'}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
              <Radio className="w-3 h-3 text-blue-500 shrink-0" />
              24/7 Missed-Call Autopilot
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Call Forwarding Target</span>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono tabular-nums truncate">
              {formatPhoneNumber(organization?.owner_phone) || 'Mobile Phone'}
            </div>
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Forwarding Active
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Truck Route Portal</span>
            <div className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-1 flex items-center gap-1.5">
              <span>/client/field</span>
              <Smartphone className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5">
              Optimized for Truck Dashboards
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active Crews &amp; Vans</span>
            <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono tabular-nums">
              {crews.length}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {crews.length === 1 ? '1 Van in Service' : `${crews.length} Vans in Service`}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Field Staff &amp; Team</span>
            <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1 font-mono tabular-nums">
              {members.length}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {techCount} Techs • {dispCount} Dispatchers
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Completed Jobs (30d)</span>
            <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono tabular-nums">
              {totalJobsCompleted}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono tabular-nums">
              ${totalFleetRevenue.toLocaleString()} Revenue
            </div>
          </div>

          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Daily 7 AM Route SMS</span>
            <div className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Automated Schedule</span>
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              Dispatches each morning to tech phones
            </div>
          </div>
        </div>
      )}

      {/* Solo Operator Mode Cockpit */}
      {currentMode === 'solo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Operator Dossier, Truck Portal, and Expansion Card */}
          <div className="lg:col-span-7 space-y-6">
            {/* Operator Credentials Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0 shadow-xs">
                    {(currentUser?.full_name || organization?.name || 'O')[0].toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                      {currentUser?.full_name || 'Primary Operator'}
                    </h2>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{currentUser?.email || 'operator@business.com'}</span>
                    </p>
                  </div>
                </div>

                <span className="shrink-0 text-xs px-2.5 py-1 rounded-md font-medium border bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/40">
                  Owner &amp; Lead Technician
                </span>
              </div>

              {/* Trade & Dispatch Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-zinc-400" />
                    Operating Trade
                  </span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {tradePreset.name}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <BadgeCheck className="w-3.5 h-3.5 text-zinc-400" />
                    Contractor License
                  </span>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                    {organization?.license_number ? `Lic #${organization.license_number}` : 'Registered Sole Operator'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                    Dispatch Base &amp; Territory
                  </span>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {[organization?.address_city, organization?.address_state].filter(Boolean).join(', ') || 'Headquarters Base'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/80 space-y-1">
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    10DLC Carrier Status
                  </span>
                  <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {organization?.carrier_registration_status === 'registered' ? 'A2P Verified & Active' : 'Active Telephony Line'}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Link
                  href="/client/settings?tab=profile"
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 py-1"
                >
                  Edit Business Profile in Settings <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Mobile Truck Field Portal Card */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shrink-0">
                  <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Field Truck Mobile Route Portal (`/client/field`)
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Streamlined, distraction-free dispatch cockpit designed for phone screens and truck dashboards.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-zinc-50 dark:bg-zinc-950/60 p-3.5 border border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
                <p className="leading-relaxed">
                  When you&apos;re driving or on a service call, switch to the Field Portal for:
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Today&apos;s chronological stops &amp; routes</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Turn-by-turn Google Maps navigation</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Gate codes &amp; property equipment notes</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>On-site credit card &amp; tap-to-pay terminal</span>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Link
                  href="/client/field"
                  className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs min-h-[48px] sm:min-h-0 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Open Truck Field Portal</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-70 ml-0.5" />
                </Link>

                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCopyFieldLink}
                  className="h-10 px-3.5 rounded-lg border-zinc-200 dark:border-zinc-800 text-xs font-medium min-h-[48px] sm:min-h-0"
                >
                  {copiedFieldLink ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                  {copiedFieldLink ? 'Link Copied!' : 'Copy Portal URL for Mobile'}
                </Button>
              </div>
            </div>

            {/* Expansion Card: Growing to Multi-Crew */}
            <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/50 via-white to-sky-50/30 dark:from-blue-950/20 dark:via-zinc-900 dark:to-zinc-900 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-600 text-white shrink-0 shadow-xs">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    Ready to add your first helper or second truck?
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Scale into multi-van calendar dispatch without operational friction.
                  </p>
                </div>
              </div>

              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                When you hire an apprentice, helper, or office dispatcher, unlock the full multi-crew suite:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
                  <span className="text-zinc-700 dark:text-zinc-300">Multi-column calendar partitioned by technician and van.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
                  <span className="text-zinc-700 dark:text-zinc-300">Automated 7 AM morning route SMS broadcasts.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
                  <span className="text-zinc-700 dark:text-zinc-300">Per-technician job completion &amp; revenue analytics.</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
                  <span className="text-zinc-700 dark:text-zinc-300">Role-based security: keep banking payouts private.</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2.5 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => {
                    setUpgradeFeature('Multi-Crew Dispatch & Van Management')
                    setShowUpgradeModal(true)
                  }}
                  className="h-10 sm:h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer min-h-[48px] sm:min-h-0"
                >
                  <span>Upgrade to Crew Plan ($199/mo)</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewModeOverride('fleet')}
                  className="h-10 sm:h-9 px-3.5 rounded-lg border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 min-h-[48px] sm:min-h-0"
                >
                  Explore Fleet Dispatch View
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column: Educational Role & Permissions Matrix Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <Shield className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Role &amp; Permissions Blueprint
                </h3>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Understand exactly what access each staff role has before you invite team members.
              </p>

              {/* Role 1: Owner / Client Admin */}
              <div className="p-3.5 rounded-xl border border-sky-100 dark:border-sky-900/30 bg-sky-50/40 dark:bg-sky-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-sky-600" />
                    Client Admin / Owner
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200">
                    Full Access
                  </span>
                </div>
                <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 pl-1">
                  <li>• Stripe payouts, bank account, and SaaS subscription billing</li>
                  <li>• Staff invites, role assignments, and team removal</li>
                  <li>• Service catalog price book &amp; flat rate adjustments</li>
                  <li>• 10DLC telephony compliance and call forwarding configuration</li>
                </ul>
              </div>

              {/* Role 2: Dispatcher */}
              <div className="p-3.5 rounded-xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    Office Dispatcher
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    Front-Desk Ops
                  </span>
                </div>
                <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 pl-1">
                  <li>• Calendar scheduling and van dispatch assignment</li>
                  <li>• 2-Way customer SMS messaging and phone call logs</li>
                  <li>• Work order management and estimate creation</li>
                  <li>• <strong className="text-rose-600 dark:text-rose-400">Strictly blocked:</strong> Company bank payouts &amp; SaaS billing</li>
                </ul>
              </div>

              {/* Role 3: Field Technician */}
              <div className="p-3.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" />
                    Field Technician
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-semibold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200">
                    Mobile Field Only
                  </span>
                </div>
                <ul className="text-[11px] text-zinc-600 dark:text-zinc-400 space-y-1 pl-1">
                  <li>• Distraction-free mobile field route portal (`/client/field`)</li>
                  <li>• Property gate codes, equipment history, and job notes</li>
                  <li>• On-site invoice payment collection via mobile terminal</li>
                  <li>• <strong className="text-rose-600 dark:text-rose-400">Strictly blocked:</strong> Customer database export, settings, and finances</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fleet / Multi-Crew Management Mode */}
      {currentMode === 'fleet' && (
        <div className="space-y-6">
          {/* Main Tab Navigation */}
          <div className="bg-zinc-100 dark:bg-zinc-900/60 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 inline-flex items-center gap-1 self-start flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0",
                activeTab === 'members'
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Staff &amp; Members</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold tabular-nums">
                {members.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('crews')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0",
                activeTab === 'crews'
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Truck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Crews &amp; Fleet Vans</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-bold tabular-nums">
                {crews.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('permissions')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer min-h-[44px] sm:min-h-0",
                activeTab === 'permissions'
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Shield className="h-3.5 w-3.5 text-zinc-500" />
              <span>Permissions Matrix</span>
            </button>
          </div>

          {/* TAB 1: Staff Directory & Members */}
          {activeTab === 'members' && (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
              {/* Filter & Search Header */}
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRoleFilter('all')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] sm:min-h-0",
                      roleFilter === 'all'
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                    )}
                  >
                    All Staff ({members.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('admin')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] sm:min-h-0",
                      roleFilter === 'admin'
                        ? "bg-sky-600 text-white"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                    )}
                  >
                    Admins ({adminCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('dispatcher')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] sm:min-h-0",
                      roleFilter === 'dispatcher'
                        ? "bg-amber-600 text-white"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                    )}
                  >
                    Dispatchers ({dispCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoleFilter('technician')}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[44px] sm:min-h-0",
                      roleFilter === 'technician'
                        ? "bg-emerald-600 text-white"
                        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100"
                    )}
                  >
                    Technicians ({techCount})
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Search by name, email..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-lg"
                  />
                </div>
              </div>

              {/* Members Content */}
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
                      <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800/60">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800" />
                            <Skeleton className="h-3 w-48 bg-zinc-100 dark:bg-zinc-800/60" />
                          </div>
                        </div>
                        <Skeleton className="h-6 w-20 rounded-md bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    ))}
                  </div>
                ) : filteredMembers.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      No team members matched the current filter criteria.
                    </p>
                    {searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setSearchQuery(''); setRoleFilter('all'); }}
                        className="text-xs h-8"
                      >
                        Clear Filters
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Mobile & Tablet Card Layout (48px Ergonomic Targets) */}
                    <div className="block lg:hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
                      {filteredMembers.map((m) => {
                        const badge = getRoleBadge(m.role)
                        const isSelf = m.id === currentUserId
                        const editable = canEditTarget(m)
                        return (
                          <div key={m.id} className="py-4 flex flex-col gap-3 min-h-[48px]">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-700 dark:text-zinc-200 shrink-0">
                                  {(m.full_name || m.email || '?')[0].toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
                                    <span>{m.full_name || '—'}</span>
                                    {isSelf && (
                                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold">
                                        You
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate mt-0.5">
                                    <Mail className="h-3 w-3 shrink-0" />
                                    <span>{m.email}</span>
                                  </p>
                                </div>
                              </div>

                              <span className={cn(
                                "shrink-0 text-xs px-2.5 py-0.5 rounded-md font-medium border",
                                badge.className
                              )}>
                                {badge.label}
                              </span>
                            </div>

                            {/* Action Row for Mobile: Call, Email, Edit, Delete */}
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/40 flex-wrap">
                              {m.email && (
                                <a
                                  href={`mailto:${m.email}`}
                                  className="inline-flex items-center justify-center gap-1 h-9 px-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px] sm:min-h-0"
                                >
                                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                                  <span>Email</span>
                                </a>
                              )}

                              {m.phone && (
                                <a
                                  href={`tel:${m.phone}`}
                                  className="inline-flex items-center justify-center gap-1 h-9 px-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 min-h-[44px] sm:min-h-0"
                                >
                                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Call</span>
                                </a>
                              )}

                              {editable && (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openRoleModal(m)}
                                    className="h-9 px-3 text-xs rounded-lg border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 min-h-[44px] sm:min-h-0"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                                    Role
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setMemberToRemove(m)}
                                    className="h-9 px-3 text-xs rounded-lg border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 min-h-[44px] sm:min-h-0"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    Remove
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Desktop High-Density Table Layout */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            <th className="text-left py-3 px-3.5 font-semibold">Team Member</th>
                            <th className="text-left py-3 px-3.5 font-semibold">Email &amp; Direct Phone</th>
                            <th className="text-left py-3 px-3.5 font-semibold">Assigned Role</th>
                            <th className="text-left py-3 px-3.5 font-semibold">Member Since</th>
                            {canManageTeam && (
                              <th className="text-right py-3 px-3.5 font-semibold">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                          {filteredMembers.map((m) => {
                            const badge = getRoleBadge(m.role)
                            const isSelf = m.id === currentUserId
                            const editable = canEditTarget(m)
                            return (
                              <tr key={m.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                <td className="py-3 px-3.5 font-medium text-zinc-900 dark:text-zinc-200">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200 shrink-0">
                                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                                        <span>{m.full_name || '—'}</span>
                                        {isSelf && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                                            You
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-3.5 text-zinc-600 dark:text-zinc-400 font-mono">
                                  <div>{m.email}</div>
                                  {m.phone && <div className="text-[11px] text-zinc-400 mt-0.5">{formatPhoneNumber(m.phone)}</div>}
                                </td>
                                <td className="py-3 px-3.5">
                                  <span className={cn(
                                    "text-xs px-2.5 py-0.5 rounded-md font-medium border inline-block",
                                    badge.className
                                  )}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-3 px-3.5 text-zinc-500 dark:text-zinc-400 text-xs font-mono">
                                  {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}
                                </td>
                                {canManageTeam && (
                                  <td className="py-3 px-3.5 text-right">
                                    {editable ? (
                                      <div className="inline-flex items-center gap-1.5">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => openRoleModal(m)}
                                          className="h-8 px-2.5 text-xs rounded-md border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                                        >
                                          <Edit2 className="w-3 h-3 mr-1 text-zinc-500" />
                                          Role
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setMemberToRemove(m)}
                                          className="h-8 px-2.5 text-xs rounded-md border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                        >
                                          <Trash2 className="w-3 h-3 mr-1" />
                                          Remove
                                        </Button>
                                      </div>
                                    ) : isSelf ? (
                                      <span className="text-xs text-zinc-400 dark:text-zinc-500 italic">Current User</span>
                                    ) : (
                                      <span className="text-xs text-zinc-400 dark:text-zinc-500">—</span>
                                    )}
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Crews & Fleet Vans */}
          {activeTab === 'crews' && (
            <div className="space-y-6">
              {loadingCrews ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-48 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 animate-pulse" />
                  ))}
                </div>
              ) : crews.length === 0 ? (
                <EmptyState
                  icon={Truck}
                  title="No Crews or Fleet Vans Added Yet"
                  description="Add your first van or crew to unlock multi-crew calendar dispatch, 7 AM morning route SMS broadcasts, and per-van revenue analytics."
                  actionLabel="Add First Crew / Van"
                  onAction={() => {
                    if (!isFleetEntitled) {
                      setUpgradeFeature('Multi-Crew Dispatch & Van Assignment')
                      setShowUpgradeModal(true)
                      return
                    }
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
                        className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3.5 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                      >
                        {/* Van Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-4 h-4 rounded-full shrink-0 border border-black/10 shadow-2xs"
                              style={{ backgroundColor: c.color_code }}
                            />
                            <div className="truncate">
                              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                                {c.name}
                              </h3>
                              {c.phone_number && (
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 mt-0.5 font-mono">
                                  <Phone className="w-3 h-3 shrink-0" />
                                  <span>{formatPhoneNumber(c.phone_number)}</span>
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
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                              title="Edit Van"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeactivateCrew(c.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center"
                              title="Deactivate Van"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Territory & Lead */}
                        <div className="space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                          {c.service_area && (
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate">{c.service_area}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 truncate">
                            <Users className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate">
                              {c.crew_lead?.full_name ? `Lead: ${c.crew_lead.full_name}` : 'No lead assigned'} • {c.member_ids?.length || 0} tech{c.member_ids?.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>

                        {/* Performance Stats */}
                        {metric && (
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                            <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60">
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase font-medium">Jobs</div>
                              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 font-mono">
                                {metric.completedJobs}/{metric.totalJobs}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60">
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase font-medium">Revenue</div>
                              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                                ${metric.totalRevenue.toLocaleString()}
                              </div>
                            </div>
                            <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950/60">
                              <div className="text-[10px] text-zinc-500 dark:text-zinc-500 uppercase font-medium">Avg Site</div>
                              <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 font-mono">
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

          {/* TAB 3: Permissions Matrix */}
          {activeTab === 'permissions' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Client Admin */}
              <div className="rounded-xl border border-sky-200 dark:border-sky-900/40 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-sky-600" />
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Client Admin</h3>
                      <p className="text-[11px] text-zinc-500">Business Owner &amp; GM</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300">
                    Full Access
                  </span>
                </div>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Financial Payouts:</strong> Stripe bank account connections &amp; customer invoice settlements.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>SaaS Subscriptions:</strong> Free, Solo ($99), and Crew ($199) plan management.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Staff Control:</strong> Invite, change roles, or remove team members.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Price Book:</strong> Edit services, flat rates, and pricing models.</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Dispatcher */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Dispatcher</h3>
                      <p className="text-[11px] text-zinc-500">Front Desk &amp; Scheduling</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                    Operational
                  </span>
                </div>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Calendar &amp; Routing:</strong> Book jobs, assign technicians to vans, and reschedule.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Unified Inbox:</strong> 2-Way customer SMS messaging and live phone calling.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>CRM Access:</strong> View property details, customer history, and past jobs.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><strong>Restricted:</strong> Cannot access owner bank payouts or SaaS plan billing.</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Field Technician */}
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Technician</h3>
                      <p className="text-[11px] text-zinc-500">Truck &amp; On-Site Field</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    Field Portal
                  </span>
                </div>
                <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Daily Field Stops:</strong> Clean mobile truck cockpit at `/client/field`.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>Turn-by-Turn GPS:</strong> 1-click Google Maps navigation to job site.</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><strong>On-Site Payments:</strong> Collect credit card or cash on site via mobile card reader.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-rose-600 dark:text-rose-400">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span><strong>Restricted:</strong> Cannot export customer database, view billing, or change settings.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Role Edit Modal */}
      <Dialog open={!!editingMember} onOpenChange={(isOpen) => !isOpen && setEditingMember(null)}>
        <DialogContent className="mx-4 sm:mx-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100 text-base font-semibold">Update Team Member Role</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
              Change permissions and system access for {editingMember?.full_name || editingMember?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs text-zinc-700 dark:text-zinc-300">Select Role</Label>
              <Select value={targetRole} onValueChange={(val) => val && setTargetRole(val)}>
                <SelectTrigger className="h-10 sm:h-9 rounded-lg text-sm bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
                  {isOwnerOrSuper && (
                    <SelectItem value="owner">Owner — Primary organization owner &amp; billing authority</SelectItem>
                  )}
                  <SelectItem value="client_admin">Client Admin — Full operational &amp; financial access</SelectItem>
                  <SelectItem value="dispatcher">Dispatcher — Calendar, Calls &amp; Inbox (No banking)</SelectItem>
                  <SelectItem value="technician">Technician — Field Mobile View &amp; Daily Route Only</SelectItem>
                  <SelectItem value="member">General Member — Basic Read-Only Access</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingMember(null)}
              disabled={savingRole}
              className="text-xs h-10 sm:h-9 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveRole}
              disabled={savingRole}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-10 sm:h-9 rounded-lg font-medium cursor-pointer"
            >
              {savingRole ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Modal */}
      <Dialog open={!!memberToRemove} onOpenChange={(isOpen) => !isOpen && setMemberToRemove(null)}>
        <DialogContent className="mx-4 sm:mx-0 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-rose-600 dark:text-rose-400 flex items-center gap-2 text-base font-semibold">
              <UserX className="w-5 h-5" /> Remove Team Member
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400 text-xs">
              Are you sure you want to remove <strong>{memberToRemove?.full_name || memberToRemove?.email}</strong> from this organization?
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
            <p>
              They will immediately lose access to your company&apos;s leads, appointments, customer inbox, and financial records.
            </p>
            <p className="text-zinc-500 dark:text-zinc-500">
              Active crew assignments and scheduled job dispatches will be automatically unlinked.
            </p>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMemberToRemove(null)}
              disabled={removingMember}
              className="text-xs h-10 sm:h-9 rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRemoveMember}
              disabled={removingMember}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-10 sm:h-9 rounded-lg font-medium cursor-pointer"
            >
              {removingMember ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Remove Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Contextual Pro Upgrade Modal */}
      <ProUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        featureName={upgradeFeature}
        requiredTier="fleet"
        currentPlanId={planId}
      />
    </div>
  )
}
