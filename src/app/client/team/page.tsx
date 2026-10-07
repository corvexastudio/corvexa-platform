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
      const { data: profile, error: profileErr } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (profileErr || !profile) {
        setError('Failed to resolve organization profile.')
        setLoading(false)
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
    <div className="flex flex-col gap-4">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-muted-foreground text-sm">Manage your co-workers and dispatchers.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          {/* @ts-ignore */}
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <UserPlus className="mr-2 h-4 w-4" /> Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4 sm:mx-0">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
              <DialogDescription>Send an invitation email to a co-worker or dispatcher.</DialogDescription>
            </DialogHeader>
            {pendingInvite ? (
              <div className="space-y-4 py-2">
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-200">
                  <p className="font-semibold text-amber-300">
                    Invitation created, but email delivery isn&apos;t configured.
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    The member account was created for <strong>{pendingInvite.email}</strong>, but automatic SMTP email dispatch is not enabled in your platform settings.
                  </p>
                </div>

                {pendingInvite.link && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">One-Time Invitation Link</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={pendingInvite.link}
                        className="font-mono text-xs select-all"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCopyLink}
                        className="shrink-0"
                      >
                        {copiedLink ? 'Copied' : 'Copy Link'}
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
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
                    className="w-full sm:w-auto"
                  >
                    Done
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={(v: any) => setInviteRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client_admin">Client Admin — Full access</SelectItem>
                      <SelectItem value="dispatcher">Dispatcher — Calls &amp; Inbox</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={inviting} className="w-full sm:w-auto">
                    {inviting ? 'Sending...' : 'Send Invitation'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Members</CardTitle>
          <CardDescription>All users with access to your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-center space-y-3">
              <p className="text-sm font-medium text-red-400">{error}</p>
              <Button onClick={fetchMembers} variant="outline" size="sm" className="border-red-500/30 text-red-300 hover:bg-red-500/20">
                Retry Loading Members
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-3 py-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full bg-muted" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32 bg-muted" />
                      <Skeleton className="h-3 w-48 bg-muted/60" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No team members found. Invite your first team member above.
            </p>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="block sm:hidden divide-y">
                {members.map((m) => (
                  <div key={m.id} className="py-3 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold shrink-0">
                      {(m.full_name || m.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name || '—'}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {m.email}
                      </p>
                    </div>
                    <Badge variant={roleColor(m.role)} className="shrink-0 text-xs">
                      {m.role === 'client_admin' ? 'Admin' : 'Member'}
                    </Badge>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Name</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Role</th>
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {members.map((m) => (
                      <tr key={m.id} className="hover:bg-muted/30">
                        <td className="py-2 px-2 font-medium">{m.full_name || '—'}</td>
                        <td className="py-2 px-2 text-muted-foreground">{m.email}</td>
                        <td className="py-2 px-2"><Badge variant={roleColor(m.role)}>{m.role.replace('_', ' ')}</Badge></td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
