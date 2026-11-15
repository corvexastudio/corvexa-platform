'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Code2, 
  ArrowLeft, 
  Copy, 
  Check, 
  ExternalLink, 
  Layers, 
  Sparkles,
  Smartphone,
  Globe,
  CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AgencyPortfolioOverview, AgencyClientSlot } from '@/lib/agency/agency-types'

export default function AgencyEmbedsPage() {
  const [overview, setOverview] = useState<AgencyPortfolioOverview | null>(null)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [campaignName, setCampaignName] = useState('spring-ac-tuneup')
  const [utmSource, setUtmSource] = useState('google-ads')

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/agency/overview')
        if (res.ok) {
          const data = await res.json()
          setOverview(data)
        }
      } catch (err) {
        console.error('[AGENCY EMBEDS] Fetch error:', err)
      }
    }
    loadData()
  }, [])

  const activeSlots = overview?.slots.filter(s => s.status === 'active') || []
  const currentSlot: AgencyClientSlot | undefined = activeSlots[selectedSlotIndex] || activeSlots[0]

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const bookingUrl = currentSlot?.public_booking_url || 'https://captodesk.com/book/demo'
  const taggedUrl = `${bookingUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(campaignName)}`

  const htmlButtonCode = `<a href="${taggedUrl}" class="captodesk-book-btn" style="background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;font-family:sans-serif;text-decoration:none;display:inline-block;transition:background 0.2s;">
  Schedule Diagnostic Online
</a>`

  const floatingWidgetCode = `<!-- CaptoDesk Rapid Booking Button -->
<div style="position:fixed;bottom:24px;right:24px;z-index:99999;">
  <a href="${taggedUrl}" target="_blank" style="background:#059669;color:#ffffff;padding:14px 22px;border-radius:50px;box-shadow:0 10px 25px -5px rgba(5,150,105,0.4);font-weight:700;font-family:sans-serif;text-decoration:none;display:flex;align-items:center;gap:8px;">
    <span>📅 Book Appointment</span>
  </a>
</div>`

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 mb-1 font-mono">
            <Link href="/dashboard" className="hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              <span>Portfolio</span>
            </Link>
            <span>/</span>
            <span className="text-slate-800 dark:text-zinc-200">Client Embeds</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Website Booking Embeds</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Generate embeddable booking buttons and links for your contractor clients' websites.
          </p>
        </div>
      </div>

      {/* Contractor Selector Ribbon or Empty State */}
      {activeSlots.length === 0 ? (
        <div className="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs text-center max-w-lg mx-auto space-y-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-500">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Active Contractor Clients Deployed
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Connect a contractor client in your portfolio to generate custom booking buttons, floating widgets, and UTM tracking links.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs cursor-pointer"
          >
            <span>Deploy First Client</span>
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </Link>
        </div>
      ) : (
        <>
          {/* Contractor Selector Ribbon */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-colors">
            <div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white block">Select Contractor Client:</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">Snippets update dynamically with client booking slug and brand.</span>
            </div>

            <select
              value={selectedSlotIndex}
              onChange={(e) => setSelectedSlotIndex(Number(e.target.value))}
              className="h-10 px-3 text-xs bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:border-emerald-500 font-semibold"
            >
              {activeSlots.map((slot, idx) => (
                <option key={`slot-opt-${idx}`} value={idx}>
                  {slot.business_name} ({slot.industry?.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* Snippet Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Left: Standard Header / Hero CTA Button */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Header / Hero Booking CTA</h2>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCopy(htmlButtonCode, 'header-btn')}
                  className="h-7 px-2.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 gap-1 border border-slate-200 dark:border-zinc-700 cursor-pointer"
                >
                  {copiedKey === 'header-btn' ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Copy HTML</span>
                </Button>
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Place this button in the contractor’s website header next to the phone number. When visitors land after 6 PM, this captures bookings with zero phone friction.
              </p>

              <pre className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-950 border border-slate-800 dark:border-zinc-800 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
    {htmlButtonCode}
              </pre>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Live Button Preview:</span>
                <a 
                  href={taggedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg inline-block shadow-2xs"
                >
                  Schedule Diagnostic Online
                </a>
              </div>
            </div>

            {/* Right: Floating Mobile Emergency Button */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sticky Mobile Floating Widget</h2>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCopy(floatingWidgetCode, 'float-widget')}
                  className="h-7 px-2.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 gap-1 border border-slate-200 dark:border-zinc-700 cursor-pointer"
                >
                  {copiedKey === 'float-widget' ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  <span>Copy HTML</span>
                </Button>
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                Floats cleanly in the bottom right corner of mobile devices. Tested to increase mobile appointment conversion by 28% on plumbing and HVAC landing pages.
              </p>

              <pre className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-950 border border-slate-800 dark:border-zinc-800 text-[11px] font-mono text-blue-300 overflow-x-auto whitespace-pre-wrap">
    {floatingWidgetCode}
              </pre>
            </div>

          </div>

          {/* UTM Campaign URL Builder Section */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Interactive UTM Campaign URL Builder</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Tag all Google Ads, Local Services Ads (LSA), and Facebook ad links so CaptoDesk automatically attributes booked revenue to your specific marketing campaigns.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Campaign Source (`utm_source`)</label>
                <Input
                  type="text"
                  value={utmSource}
                  onChange={(e) => setUtmSource(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                  placeholder="e.g. google-ads"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Campaign Name (`utm_campaign`)</label>
                <Input
                  type="text"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                  placeholder="e.g. spring-ac-tuneup"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-1.5">Generated Tracking URL</label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={taggedUrl}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-emerald-600 dark:text-emerald-400 select-all rounded-lg font-bold"
                />
                <Button
                  type="button"
                  onClick={() => handleCopy(taggedUrl, 'tagged-url')}
                  className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 rounded-lg shrink-0 cursor-pointer shadow-2xs"
                >
                  {copiedKey === 'tagged-url' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy URL</span>
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  )
}
