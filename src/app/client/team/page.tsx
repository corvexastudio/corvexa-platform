'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/error-state'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Mail, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export default function TeamPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'client_admin' | 'dispatcher'>('dispatcher')
  const [inviting, setInviting] = useState(false)
  const [pendingInvite, setPendingInvite] = useState<{ email: string; link?: string } | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)

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

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

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

  const roleColor = (role: string) =>
    role === 'super_admin' ? 'destructive' : role === 'client_admin' ? 'default' : 'secondary'

  return (
    <div className="flex flex-col gap-6">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-zinc-100 tracking-tight">Team Management</h1>
          <p className="text-zinc-400 text-xs mt-0.5">Authorized staff accounts and role-based permissions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {/* @ts-ignore */}
          <DialogTrigger asChild>
            <Button size="sm" className="h-9 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" /> Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4 sm:mx-0 bg-zinc-900 border-zinc-800 text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-zinc-100">Invite Team Member</DialogTitle>
              <DialogDescription className="text-zinc-400">Send an invitation email to a co-worker or dispatcher.</DialogDescription>
            </DialogHeader>
            {pendingInvite ? (
              <div className="space-y-4 py-2">
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                  <p className="font-semibold text-amber-300">
                    Invitation created, but email delivery isn&apos;t configured.
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    The member account was created for <strong>{pendingInvite.email}</strong>, but automatic SMTP email dispatch is not enabled in your platform settings.
                  </p>
                </div>

                {pendingInvite.link && (
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">One-Time Invitation Link</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={pendingInvite.link}
                        className="font-mono text-xs select-all bg-zinc-950 border-zinc-800"
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
                    <p className="text-[11px] text-zinc-500">
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
                  <Label htmlFor="email" className="text-xs text-zinc-300">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-zinc-950 border-zinc-800"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-zinc-300">Role</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger className="h-10 sm:h-9 rounded-md text-base sm:text-xs bg-zinc-950 border-zinc-800">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
                      <SelectItem value="client_admin">Client Admin — Full access</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher — Calls &amp; Inbox</SelectItem>
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
      </div>

      <div className="border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/40">
          <h2 className="text-sm font-semibold text-zinc-100">Active Members</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Authorized users with access to your dashboard.</p>
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
                <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/60">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full bg-zinc-800" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-32 bg-zinc-800" />
                      <Skeleton className="h-3 w-48 bg-zinc-800/60" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md bg-zinc-800" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-zinc-400 py-6 text-center">
              No team members found. Invite your first team member above.
            </p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="block sm:hidden divide-y divide-zinc-800/60">
                {members.map((m) => (
                  <div key={m.id} className="py-3.5 min-h-[48px] flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-200 shrink-0">
                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-200 truncate">{m.full_name || '—'}</p>
                      <p className="text-[11px] text-zinc-400 flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {m.email}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-md font-medium ${
                      m.role === 'client_admin' 
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                        : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      {m.role === 'client_admin' ? 'Admin' : 'Dispatcher'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
                      <th className="text-left py-2.5 px-3 font-semibold">Name</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Email</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Role</th>
                      <th className="text-left py-2.5 px-3 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-medium text-zinc-200">{m.full_name || '—'}</td>
                        <td className="py-2.5 px-3 text-zinc-400">{m.email}</td>
                        <td className="py-2.5 px-3">
                          <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${
                            m.role === 'client_admin' 
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}>
                            {m.role === 'client_admin' ? 'Admin' : 'Dispatcher'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-zinc-400 text-[11px]">{new Date(m.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
