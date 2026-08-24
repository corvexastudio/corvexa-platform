'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

export default function ActivityFeed() {
  const supabase = createClient()
  const [logs, setLogs] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'missed_call' | 'website_form' | 'review_invite'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const fetchLogs = async () => {
      let query = supabase.from('activity_logs').select('*').order('created_at', { ascending: false })
      if (filter !== 'all') query = query.eq('type', filter)
      if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString())
      if (dateTo) {
        const end = new Date(dateTo)
        end.setHours(23, 59, 59, 999)
        query = query.lte('created_at', end.toISOString())
      }
      const { data } = await query
      if (data) setLogs(data)
    }
    fetchLogs()
  }, [filter, dateFrom, dateTo, supabase])

  const statusColor = (status: string) =>
    status === 'replied' || status === 'completed' || status === 'reviewed' ? 'default' : 'secondary'

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
            <div className="flex flex-wrap gap-2 mt-2 items-center">
              {/* Filter Pills */}
              <div className="flex gap-2">
                {(['all', 'missed_call', 'website_form', 'review_invite'] as const).map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'missed_call' ? 'Missed Calls' : f === 'website_form' ? 'Form Leads' : 'Reviews'}
                  </Button>
                ))}
              </div>
              {/* Date Range Pickers */}
              <div className="flex items-center gap-2 ml-auto">
                <Input
                  type="date"
                  className="w-36 text-xs h-8"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                />
                <span className="text-xs text-muted-foreground">to</span>
                <Input
                  type="date"
                  className="w-36 text-xs h-8"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                />
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear</Button>
                )}
              </div>
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No activity found.</TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {log.type === 'missed_call' ? 'Missed Call' : log.type === 'review_invite' ? 'Review Invite' : 'Website Form'}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.contact_name || '—'}</TableCell>
                    <TableCell>{log.contact_phone}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.source}</TableCell>
                    <TableCell>
                      <Badge variant={statusColor(log.status)}>{log.status}</Badge>
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
