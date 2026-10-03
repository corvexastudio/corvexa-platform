import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Star, Send } from 'lucide-react'

interface ReviewBoosterProps {
  businessName?: string
  reviewUrl?: string
  onSent?: () => void
}

export function ReviewBoosterCard({ businessName, reviewUrl, onSent }: ReviewBoosterProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)

  const handlePhoneFormat = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    let formatted = raw
    if (raw.length > 6) {
      formatted = `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`
    } else if (raw.length > 3) {
      formatted = `(${raw.slice(0, 3)}) ${raw.slice(3)}`
    } else if (raw.length > 0) {
      formatted = `(${raw}`
    }
    setPhone(formatted)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || phone.replace(/\D/g, '').length < 10) {
      toast.error('Please enter customer name and a valid 10-digit phone number.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/reviews/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      })
      if (res.ok) {
        toast.success(`Google Review request sent to ${name}!`)
        setName('')
        setPhone('')
        if (onSent) onSent()
      } else {
        toast.error('Failed to send text. Verify phone number.')
      }
    } catch {
      toast.error('Network error.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-[#0D1322] p-5 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 h-32 w-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />

      <p className="text-xs text-zinc-400 leading-relaxed">
        Finished a job? Type the customer&apos;s name and phone number. CaptoDesk texts them a direct link to leave a 5-star Google review.
      </p>

      <form onSubmit={handleSend} className="mt-4 space-y-3.5">
        <div>
          <Label className="text-xs text-zinc-300 font-medium">Customer Name</Label>
          <Input
            placeholder="e.g. Dana Miller"
            value={name}
            onChange={e => setName(e.target.value)}
            className="mt-1 bg-zinc-900/90 border-zinc-800 text-white text-xs h-10 rounded-xl focus:border-blue-500"
          />
        </div>

        <div>
          <Label className="text-xs text-zinc-300 font-medium">Cell Phone Number</Label>
          <Input
            placeholder="(555) 000-0000"
            value={phone}
            onChange={handlePhoneFormat}
            className="mt-1 bg-zinc-900/90 border-zinc-800 text-white text-xs h-10 rounded-xl focus:border-blue-500"
          />
        </div>

        <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/70 p-3 text-[11px] text-zinc-400 space-y-1">
          <span className="font-semibold text-zinc-400 block text-[10px] uppercase tracking-wider">SMS Preview:</span>
          <p className="italic text-zinc-300">
            &ldquo;Hey {name || 'there'}, thank you for choosing {businessName || 'our team'}! If you were happy with the work, could you take 30 seconds to drop us a quick 5-star review here: {reviewUrl || '[Your Google Link]'}&rdquo;
          </p>
        </div>

        <Button
          type="submit"
          disabled={sending}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Send className="h-3.5 w-3.5" />
          <span>{sending ? 'Sending Text...' : 'Send Review Request Now'}</span>
        </Button>
      </form>
    </div>
  )
}
