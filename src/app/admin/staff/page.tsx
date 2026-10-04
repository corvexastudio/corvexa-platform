'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy
} from 'lucide-react'
import { toast } from 'sonner'

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [copiedSql, setCopiedSql] = useState(false)

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (roleFilter !== 'all') params.set('role', roleFilter)

      const res = await fetch(`/api/admin/staff?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setStaff(data.staff || [])
      } else {
        toast.error('Failed to load platform staff')
      }
    } catch {
      toast.error('Network error loading staff')
    } finally {
      setLoading(false)
    }
  }, [search, roleFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStaff()
    }, 200)
    return () => clearTimeout(timer)
  }, [fetchStaff])

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingId(userId)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newRole })
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(data.message || `Role updated to ${newRole}`)
        setStaff(staff.map((s) => (s.id === userId ? { ...s, role: newRole } : s)))
      } else {
        toast.error(data.error || 'Failed to update role')
      }
    } catch {
      toast.error('Network error updating role')
    } finally {
      setUpdatingId(null)
    }
  }

  const copySqlSnippet = () => {
    const sql = "UPDATE profiles SET role = 'super_admin' WHERE email = 'YOUR_EMAIL@EXAMPLE.COM';"
    navigator.clipboard.writeText(sql)
    setCopiedSql(true)
    toast.success('SQL snippet copied to clipboard!')
    setTimeout(() => setCopiedSql(false), 2000)
  }

  const superAdminCount = staff.filter((s) => s.role === 'super_admin').length

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Platform Staff & Access Control
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-400 border border-amber-500/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              {superAdminCount} Super Admin{superAdminCount === 1 ? '' : 's'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Exclusively manage who can access the CaptoDesk operations console and delegate administrative privileges.
          </p>
        </div>

        <button
          onClick={fetchStaff}
          disabled={loading}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 self-start sm:self-auto"
          title="Refresh Staff List"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Security Governance Notice Card */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">
              Exclusive Platform Access Rules
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Only accounts designated as <span className="font-bold text-amber-400 font-mono">super_admin</span> can access the <span className="font-mono text-white">/admin</span> operations console. All tenant customers, business owners (<span className="font-mono">owner</span>), managers (<span className="font-mono">admin</span>), and technicians (<span className="font-mono">member</span>) are strictly forbidden from platform operations.
            </p>
          </div>
        </div>

        {/* Quick SQL Bootstrap Helper */}
        <div className="mt-2 pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="text-zinc-400 font-mono text-[11px]">
            To grant yourself super admin directly in Supabase SQL Editor:
          </span>
          <button
            onClick={copySqlSnippet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border border-amber-500/40 text-amber-300 hover:text-white font-mono text-[11px] transition-colors"
          >
            {copiedSql ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span>{copiedSql ? 'Copied!' : 'Copy SQL Grant Command'}</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search and Filter */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, email, org..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          {['all', 'super_admin', 'owner', 'admin', 'member'].map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                roleFilter === role
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {role === 'super_admin' ? 'Super Admins' : role}
            </button>
          ))}
        </div>
      </div>

      {/* Staff Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Current Role</th>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Joined</th>
                <th className="py-3.5 px-4 text-right">Access Delegation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-500">
                    No users found matching the query.
                  </td>
                </tr>
              ) : (
                staff.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                    {/* User Info */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{user.full_name || 'Anonymous User'}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">{user.email || 'No email registered'}</div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                        user.role === 'super_admin'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : user.role === 'owner'
                          ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          user.role === 'super_admin' ? 'bg-amber-400 animate-pulse' : 'bg-zinc-500'
                        }`} />
                        {user.role}
                      </span>
                    </td>

                    {/* Organization */}
                    <td className="py-3.5 px-4">
                      <span className="text-zinc-200">
                        {(user.organizations as any)?.name || 'Platform Level'}
                      </span>
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 px-4 text-zinc-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>

                    {/* Actions / Role Delegation Dropdown */}
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={user.role}
                        disabled={updatingId === user.id}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-amber-500 transition-colors capitalize ${
                          user.role === 'super_admin' ? 'text-amber-400 font-bold border-amber-500/40' : 'text-zinc-300'
                        }`}
                      >
                        <option value="super_admin">★ Super Admin (Platform Operator)</option>
                        <option value="owner">Owner (Tenant Admin)</option>
                        <option value="admin">Admin (Manager)</option>
                        <option value="member">Member (Technician/Staff)</option>
                      </select>
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
