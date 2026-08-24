'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export default function ActivityFeed() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'missed_call' | 'website_form' | 'review_invite'>('all')

  useEffect(() => {
    const fetchLogs = async () => {
      let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') {
        query = query.eq('type', filter)
      }
      const { data } = await query
      if (data) setLogs(data)
    }
    fetchLogs()
  }, [filter, supabase])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Feed</h1>
        <p className="text-muted-foreground">Comprehensive log of all automated actions and leads.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            <div className="flex gap-2 mt-2">
              <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>All</Button>
              <Button variant={filter === 'missed_call' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('missed_call')}>Missed Calls</Button>
              <Button variant={filter === 'website_form' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('website_form')}>Forms</Button>
              <Button variant={filter === 'review_invite' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('review_invite')}>Reviews</Button>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">No activity found.</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      {log.type === 'missed_call' ? 'Missed Call' : log.type === 'review_invite' ? 'Review Invite' : 'Website Form'}
                    </TableCell>
                    <TableCell>{log.contact_name || 'N/A'}</TableCell>
                    <TableCell>{log.contact_phone}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'replied' || log.status === 'completed' ? 'default' : 'secondary'}>
                        {log.status}
                      </Badge>
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
