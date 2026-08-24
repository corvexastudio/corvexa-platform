'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Star, Send, ExternalLink, Loader2 } from 'lucide-react'

export default function ReviewsPage() {
  const supabase = createClient()
  const [org, setOrg] = useState<any>(null)
  const [totalSent, setTotalSent] = useState(0)
  const [totalPosted, setTotalPosted] = useState(0)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    const x = e.target.value.replace(/\D/g, '').match(/(\d{0,3})(\d{0,3})(\d{0,4})/)
    if (!x) return
    setPhone(!x[2] ? x[1] : `(${x[1]}) ${x[2]}` + (x[3] ? `-${x[3]}` : ''))
  }

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      if (!profile) return

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [{ data: orgData }, { count: sent }, { count: posted }] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', profile.org_id).single(),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('type', 'review_invite').gte('created_at', startOfMonth),
        supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('type', 'review_invite').eq('delivery_status', 'delivered').gte('created_at', startOfMonth),
      ])

      if (orgData) setOrg(orgData)
      setTotalSent(sent ?? 0)
      setTotalPosted(posted ?? 0)
      setLoading(false)
    }
    fetchData()
  }, [supabase])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || phone.length < 14) { toast.error('Enter a valid name and phone number.'); return }
    setSending(true)
    const res = await fetch('/api/reviews/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone }),
    })
    setSending(false)
    if (res.ok) {
      toast.success(`Review link sent to ${name}!`)
      setTotalSent(s => s + 1)
      setName(''); setPhone('')
    } else {
      toast.error('Failed to send. Try again.')
    }
  }

  const conversionRate = totalSent > 0 ? Math.round((totalPosted / totalSent) * 100) : 0

  return (
    <div className="flex flex-col gap-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground text-sm">See how many customers left a review this month.</p>
      </div>

      {/* Hero — reviews posted */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        {loading ? (
          <div className="h-10 w-24 bg-muted animate-pulse rounded-lg" />
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <p className="text-4xl font-bold">{totalPosted}</p>
              {org?.google_review_url && (
                <a
                  href={org.google_review_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-full px-3 py-1.5 hover:bg-primary/5 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> View on Google
                </a>
              )}
            </div>
            <p className="text-muted-foreground text-sm">reviews posted this month</p>
          </>
        )}
      </div>

      {/* Funnel View */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Sent vs posted this month</h2>
        {loading ? (
          <div className="h-20 bg-muted/30 animate-pulse rounded-lg" />
        ) : (
          <div className="flex items-center gap-3">
            {/* Sent */}
            <div className="flex-1 text-center">
              <div className="text-3xl font-bold">{totalSent}</div>
              <div className="text-xs text-muted-foreground mt-0.5">sent</div>
            </div>
            {/* Arrow */}
            <div className="flex flex-col items-center gap-0.5">
              <div className="h-px w-8 bg-muted-foreground/30" />
              <span className="text-[10px] text-muted-foreground">{conversionRate}%</span>
              <div className="h-px w-8 bg-muted-foreground/30" />
            </div>
            {/* Posted */}
            <div className="flex-1 text-center">
              <div className={`text-3xl font-bold ${totalPosted > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{totalPosted}</div>
              <div className="text-xs text-muted-foreground mt-0.5">posted</div>
            </div>
          </div>
        )}
        {!loading && totalSent === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            No review requests sent yet this month. Use the form below to send your first one.
          </p>
        )}
      </div>

      {/* Stars visual */}
      {!loading && totalPosted > 0 && (
        <div className="flex gap-1 justify-center">
          {Array.from({ length: Math.min(totalPosted, 5) }).map((_, i) => (
            <Star key={i} className="h-6 w-6 text-amber-400 fill-amber-400" />
          ))}
          {totalPosted > 5 && <span className="text-sm font-medium text-muted-foreground self-center">+{totalPosted - 5} more</span>}
        </div>
      )}

      {/* Send a review link */}
      <div className="bg-background border rounded-2xl px-5 py-5">
        <h2 className="text-base font-semibold mb-1">Send a review link</h2>
        <p className="text-sm text-muted-foreground mb-4">Text a customer a direct link to your Google listing.</p>
        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rname">Customer name</Label>
            <Input id="rname" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rphone">Phone number</Label>
            <Input id="rphone" placeholder="(555) 555-5555" value={phone} onChange={handlePhone} maxLength={14} required />
          </div>
          <Button type="submit" className="w-full" disabled={sending}>
            {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : <><Send className="mr-2 h-4 w-4" /> Send review link</>}
          </Button>
        </form>
      </div>
    </div>
  )
}
