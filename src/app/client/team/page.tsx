'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { UserPlus, Mail, Calendar } from 'lucide-react'
import { toast } from 'sonner'

export default function TeamPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'client_admin' | 'client_member'>('client_member')
  const [inviting, setInviting] = useState(false)

  useEffect(() => {
    const fetchMembers = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (!profile) return
      const { data } = await supabase.from('profiles').select('*').eq('org_id', profile.org_id)
      if (data) setMembers(data)
    }
    fetchMembers()
  }, [supabase])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail) return
    setInviting(true)
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole })
    })
    setInviting(false)
    if (res.ok) {
      toast.success(`Invitation sent to ${inviteEmail}!`)
      setOpen(false)
      setInviteEmail('')
    } else {
      toast.error('Failed to send invite. Please try again.')
    }
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
                    <SelectItem value="client_member">Client Member — View only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={inviting} className="w-full sm:w-auto">
                  {inviting ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Members</CardTitle>
          <CardDescription>All users with access to your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
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
