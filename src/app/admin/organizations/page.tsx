'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function AdminOrganizations() {
  const supabase = createClient()
  const [orgs, setOrgs] = useState<any[]>([])

  useEffect(() => {
    const fetchOrgs = async () => {
      const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false })
      if (data) setOrgs(data)
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
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Client Organizations</h1>
        <p className="text-slate-400">Manage all agency clients, toggle access, and impersonate accounts.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800 text-slate-50">
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription className="text-slate-400">List of all onboarded businesses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-slate-800">
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Business Name</TableHead>
                <TableHead className="text-slate-400">Industry</TableHead>
                <TableHead className="text-slate-400">Phone</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500">No organizations found.</TableCell>
                </TableRow>
              ) : (
                orgs.map((org) => (
                  <TableRow key={org.id} className="border-slate-800 hover:bg-slate-800/50">
                    <TableCell className="font-medium text-white">{org.name}</TableCell>
                    <TableCell className="capitalize text-slate-300">{org.industry.replace('_', ' ')}</TableCell>
                    <TableCell className="text-slate-300">{org.phone_number}</TableCell>
                    <TableCell>
                      <Badge variant={org.status === 'active' ? 'default' : 'destructive'} className={org.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : ''}>
                        {org.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white mr-2" onClick={() => toggleStatus(org.id, org.status)}>
                        {org.status === 'active' ? 'Suspend' : 'Activate'}
                      </Button>
                      <Button variant="secondary" size="sm" className="bg-blue-600 text-white hover:bg-blue-700">
                        Impersonate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
