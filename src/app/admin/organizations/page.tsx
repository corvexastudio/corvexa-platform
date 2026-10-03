'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { 
  Building2, 
  PhoneCall, 
  Eye, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  ExternalLink,
  ShieldCheck,
  Power
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminOrganizationsPage() {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newBizName, setNewBizName] = useState('')
  const [newOwnerPhone, setNewOwnerPhone] = useState('')

  const fetchOrgs = useCallback(async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) setOrgs(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchOrgs() }, [fetchOrgs])

  const toggleEngine = async (orgId: string, currentActive: boolean) => {
    const updated = !currentActive
    const { error } = await supabase
      .from('organizations')
      .update({ is_missed_call_active: updated })
      .eq('id', orgId)

    if (error) {
      toast.error('Failed to update status.')
    } else {
      setOrgs(orgs.map(o => o.id === orgId ? { ...o, is_missed_call_active: updated } : o))
      toast.success(`Missed-Call Engine ${updated ? 'Activated' : 'Paused'}.`)
    }
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBizName.trim()) return
    setCreating(true)

    const baseSlug = newBizName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const uniqueSlug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`

    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: newBizName.trim(),
        slug: uniqueSlug,
        owner_phone: newOwnerPhone.trim() || null,
        telnyx_phone_number: process.env.NEXT_PUBLIC_TELNYX_PHONE_NUMBER || '+16823808060',
        is_missed_call_active: true,
        is_review_engine_active: true,
        subscription_status: 'active'
      })
      .select()
      .single()

    setCreating(false)
    if (error) {
      toast.error(error.message || 'Failed to create organization.')
    } else {
      toast.success(`Created tenant: ${newBizName}!`)
      setNewBizName('')
      setNewOwnerPhone('')
      setShowAddModal(false)
      fetchOrgs()
    }
  }

  const filtered = orgs.filter(o => 
    o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.telnyx_phone_number?.includes(search) ||
    o.owner_phone?.includes(search)
  )

  return (
    <div className="space-y-6">
      {/* Header with Title & Add Tenant Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Client Tenants &amp; Organizations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage small business client accounts, forwarding phone lines, and automation states.
          </p>
        </div>

        <Button 
          onClick={() => setShowAddModal(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-9 px-3.5 gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus className="h-4 w-4" />
          <span>Provision New Tenant</span>
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
        <Input
          placeholder="Search by business name or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-10 bg-[#0A0E18] border-zinc-800 text-zinc-200 text-xs placeholder:text-zinc-500"
        />
      </div>

      {/* Modal: Quick Provision Tenant */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0A0E18] border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">Provision New Client Tenant</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Business Name</label>
                <Input
                  placeholder="e.g. Mike's Premium Roofing"
                  value={newBizName}
                  onChange={e => setNewBizName(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white text-sm"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-medium block mb-1">Contractor Cell Phone (Optional)</label>
                <Input
                  placeholder="e.g. (512) 555-0199"
                  value={newOwnerPhone}
                  onChange={e => setNewOwnerPhone(e.target.value)}
                  className="bg-zinc-900 border-zinc-800 text-white text-sm"
                />
              </div>
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
                Will be assigned active Telnyx number and default $99/mo rate.
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-zinc-700 text-zinc-400 text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold">
                  {creating ? "Provisioning..." : "Create Tenant"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tenants Table */}
      <Card className="bg-[#0A0E18] border-zinc-800/80">
        <CardHeader className="pb-3 border-b border-zinc-800/60">
          <CardTitle className="text-base text-white font-bold">All Registered Contractors</CardTitle>
          <CardDescription className="text-xs text-zinc-400">Total {filtered.length} client organizations</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-sm">
              <Building2 className="h-8 w-8 mx-auto mb-2 text-zinc-600" />
              <p>No client organizations found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-left bg-zinc-950/40">
                    <th className="py-3 px-4 font-semibold">Contractor Business</th>
                    <th className="py-3 px-4 font-semibold">Telnyx Forwarding #</th>
                    <th className="py-3 px-4 font-semibold">Owner Mobile</th>
                    <th className="py-3 px-4 font-semibold">Subscription</th>
                    <th className="py-3 px-4 font-semibold text-center">Missed Call Engine</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {filtered.map(org => (
                    <tr key={org.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-bold text-white text-sm">{org.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono">slug: {org.slug}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-200">
                        {org.telnyx_phone_number || <span className="text-zinc-600 italic">Not set</span>}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {org.owner_phone || <span className="text-zinc-600 italic">—</span>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-blue-500/30 text-blue-400 bg-blue-500/10 text-[10px] capitalize">
                          {org.subscription_status || 'active'} (${org.monthly_rate || 99}/mo)
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleEngine(org.id, org.is_missed_call_active)}
                          className={org.is_missed_call_active ? "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 h-7 text-xs gap-1.5" : "text-zinc-500 hover:text-zinc-400 h-7 text-xs gap-1.5"}
                        >
                          <Power className="h-3 w-3" />
                          <span>{org.is_missed_call_active ? "Active" : "Paused"}</span>
                        </Button>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link href="/client/dashboard">
                          <Button size="sm" variant="outline" className="h-7 text-xs border-zinc-700 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300 gap-1.5">
                            <Eye className="h-3 w-3 text-blue-400" />
                            <span>View Portal</span>
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
