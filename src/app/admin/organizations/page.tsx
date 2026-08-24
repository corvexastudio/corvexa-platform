'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Eye, PhoneMissed } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminOrganizations() {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<any[]>([])
  const [volumes, setVolumes] = useState<Record<string, number>>({})

  useEffect(() => {
    const fetchOrgs = async () => {
      const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
      if (data) {
        setOrgs(data)
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const volMap: Record<string, number> = {}
        await Promise.all(data.map(async (org) => {
          const { count } = await supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', org.id).gte('created_at', startOfMonth)
          volMap[org.id] = count ?? 0
        }))
        setVolumes(volMap)
      }
    }
    fetchOrgs()
  }, [supabase])

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    await fetch('/api/admin/organizations/toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ org_id: id, status: newStatus })
    })
    setOrgs(orgs.map(org => org.id === id ? { ...org, status: newStatus } : org))
    toast.success(`${currentStatus === 'active' ? 'Suspended' : 'Activated'} successfully.`)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Client Organizations</h1>
        <p className="text-slate-400 text-sm">Manage all agency clients and toggle access.</p>
      </div>

      {/* Mobile: Card stack */}
      <div className="block sm:hidden space-y-3">
        {orgs.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="py-10 text-center text-slate-500 text-sm">No organizations yet.</CardContent>
          </Card>
        ) : (
          orgs.map((org) => (
            <Card key={org.id} className="bg-slate-900 border-slate-800 text-slate-50">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base text-white">{org.name}</CardTitle>
                    <CardDescription className="text-slate-400 capitalize">{org.industry?.replace('_', ' ')}</CardDescription>
                  </div>
                  <Badge
                    variant={org.status === 'active' ? 'default' : 'destructive'}
                    className={org.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0' : 'shrink-0'}
                  >
                    {org.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <PhoneMissed className="h-3.5 w-3.5" />
                  <span>{org.twilio_number || <span className="italic text-slate-600">No Twilio number</span>}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{volumes[org.id] ?? 0} actions this month</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
                    onClick={() => toggleStatus(org.id, org.status)}
                  >
                    {org.status === 'active' ? 'Suspend' : 'Activate'}
                  </Button>
                  <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                    <Eye className="mr-1 h-3 w-3" /> View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop: Table */}
      <Card className="hidden sm:block bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription className="text-slate-400">{orgs.length} onboarded businesses</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-2 px-4 font-medium text-slate-400">Business</th>
                <th className="text-left py-2 px-4 font-medium text-slate-400">Twilio Number</th>
                <th className="text-left py-2 px-4 font-medium text-slate-400">Status</th>
                <th className="text-center py-2 px-4 font-medium text-slate-400">Activity</th>
                <th className="text-right py-2 px-4 font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orgs.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-500 py-10">No organizations found.</td></tr>
              ) : (
                orgs.map((org) => (
                  <tr key={org.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{org.name}</div>
                      <div className="text-xs text-slate-500 capitalize">{org.industry?.replace('_', ' ')}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300 text-xs">{org.twilio_number || <span className="text-slate-600 italic">Not assigned</span>}</td>
                    <td className="py-3 px-4">
                      <Badge variant={org.status === 'active' ? 'default' : 'destructive'} className={org.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : ''}>{org.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-base font-bold text-white">{volumes[org.id] ?? '—'}</span>
                      <span className="text-xs text-slate-500 block">this month</span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800" onClick={() => toggleStatus(org.id, org.status)}>
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Eye className="mr-1 h-3 w-3" /> View as Client
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
