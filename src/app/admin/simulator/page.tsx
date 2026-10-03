'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Flame, 
  Send, 
  CheckCircle2, 
  Smartphone, 
  Sparkles, 
  PhoneCall, 
  Clock, 
  Quote,
  ShieldCheck,
  Zap
} from 'lucide-react'

const TRADE_TEMPLATES: Record<string, string> = {
  plumbing: "Hey, this is {business_name}! We are on a job and missed your call. Water leak, drain, or water heater? Let us know and we'll reply right away!",
  roofing: "Hey, this is {business_name}! Sorry we missed you, we're up on a roof. Are you needing an estimate or roof repair? How can we help?",
  hvac: "Hey, this is {business_name}! We're mid-repair and missed your call. AC not cooling or needing service? Text us here and we'll reply in minutes!",
  general: "Hey, this is {business_name}! Sorry we missed your call, we're currently on a job site. How can we help you today?"
}

export default function SimulatorPage() {
  const [businessName, setBusinessName] = useState('')
  const [phone, setPhone] = useState('')
  const [trade, setTrade] = useState('plumbing')
  const [sending, setSending] = useState(false)
  const [lastDelivered, setLastDelivered] = useState<{ name: string; phone: string; time: string } | null>(null)

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

  const previewText = TRADE_TEMPLATES[trade].replace('{business_name}', businessName || 'Your Business')

  const handleFireDemo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!businessName.trim() || phone.replace(/\D/g, '').length < 10) {
      toast.error('Enter prospect business name and a valid 10-digit cell phone number.')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/admin/demo-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          phone: phone,
          message: previewText
        })
      })

      if (res.ok) {
        toast.success(`💥 Live Demo SMS fired to ${phone}!`)
        setLastDelivered({
          name: businessName,
          phone: phone,
          time: new Date().toLocaleTimeString()
        })
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to trigger demo.')
      }
    } catch {
      toast.error('Network error triggering demo.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-black text-amber-400 border border-amber-500/20 uppercase tracking-wider flex items-center gap-1">
            <Flame className="h-3 w-3" /> Live Cold-Call Sales Weapon
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
          Prospect Missed-Call Simulator
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          While on a cold call from Corvexa Dialer, trigger a live test SMS to the contractor&apos;s personal phone to prove the speed and close the deal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* ── Left Form: The Simulator Trigger (7 Cols) ── */}
        <div className="lg:col-span-7">
          <form onSubmit={handleFireDemo} className="rounded-2xl border border-amber-500/30 bg-[#0D1322] p-5 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 h-40 w-40 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-zinc-200">
                  Prospect Business Name
                </Label>
                <Input
                  placeholder="e.g. Reyes Plumbing & Drain"
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="mt-1.5 bg-zinc-900 border-zinc-800 text-sm text-white h-11 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-200">
                  Prospect Cell Phone (The one in their hand right now)
                </Label>
                <Input
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={handlePhoneFormat}
                  className="mt-1.5 bg-zinc-900 border-zinc-800 text-sm font-mono text-white h-11 rounded-xl focus:border-amber-500"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-zinc-200">
                  Select Trade Script
                </Label>
                <select
                  value={trade}
                  onChange={e => setTrade(e.target.value)}
                  className="mt-1.5 w-full h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white px-3 focus:outline-none focus:border-amber-500"
                >
                  <option value="plumbing">Plumbing &amp; Water Heaters</option>
                  <option value="roofing">Roofing &amp; Gutters</option>
                  <option value="hvac">HVAC &amp; Air Conditioning</option>
                  <option value="general">General Contractor / Handyman</option>
                </select>
              </div>

              {/* Live Preview Bubble */}
              <div className="rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-4 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block flex items-center gap-1">
                  <Smartphone className="h-3 w-3" /> Live SMS Their Phone Receives:
                </span>
                <p className="text-xs text-zinc-200 italic leading-relaxed">
                  &ldquo;{previewText}&rdquo;
                </p>
              </div>

              <Button
                type="submit"
                disabled={sending}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold text-sm shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all"
              >
                <Zap className="h-4 w-4 fill-black" />
                <span>{sending ? 'Firing Live SMS...' : '🚀 Fire Live Missed-Call Demo Text'}</span>
              </Button>
            </div>

            {lastDelivered && (
              <div className="pt-3 border-t border-zinc-800/70 text-xs text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  Sent to {lastDelivered.phone}
                </span>
                <span className="text-zinc-500 font-mono text-[11px]">{lastDelivered.time}</span>
              </div>
            )}
          </form>
        </div>

        {/* ── Right Column: The Cold-Call Pitch Script (5 Cols) ── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-zinc-800/80 bg-[#0B0F19] p-5 sm:p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Quote className="h-4 w-4 text-blue-400" />
              What to Say on the Phone
            </h2>

            <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/70">
                <span className="font-bold text-amber-400 block text-[10px] uppercase mb-1">
                  1. The Trigger:
                </span>
                &ldquo;John, give me 5 seconds. I just triggered a simulated missed call to your cell. Look down at your phone right now.&rdquo;
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/70">
                <span className="font-bold text-amber-400 block text-[10px] uppercase mb-1">
                  2. The Punchline:
                </span>
                &ldquo;Did you see that text? That took 6 seconds. If a homeowner with a burst pipe or leaking roof reaches your voicemail, they hang up and call the next guy on Google. With CaptoDesk, that $1,500 job is yours.&rdquo;
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/70">
                <span className="font-bold text-amber-400 block text-[10px] uppercase mb-1">
                  3. The Friction Remover:
                </span>
                &ldquo;It doesn&apos;t change your number. Your phone still rings normally. You just dial *71 on your cell once and it&apos;s done. No contract, $99 a month. If it catches just one job, it paid for your whole year.&rdquo;
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}
