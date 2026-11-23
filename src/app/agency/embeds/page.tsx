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
  CheckCircle2,
  Shield,
  Plus,
  Trash2,
  AlertCircle,
  Eye,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AgencyPortfolioOverview, AgencyClientSlot, ContractorEmbedDomain } from '@/lib/agency/agency-types'
import { validateAndNormalizeDomain } from '@/lib/agency/embed-domain-sanitizer'

export default function AgencyEmbedsPage() {
  const [overview, setOverview] = useState<AgencyPortfolioOverview | null>(null)
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  // UTM Campaign State (Phase 3 Aligned)
  const [utmSource, setUtmSource] = useState('contractor-website')
  const [utmMedium, setUtmMedium] = useState('embed')
  const [utmCampaign, setUtmCampaign] = useState('spring-ac-tuneup')
  const [utmContent, setUtmContent] = useState('header-cta')
  const [utmTerm, setUtmTerm] = useState('')

  // Domain Allowlist State
  const [approvedDomains, setApprovedDomains] = useState<ContractorEmbedDomain[]>([])
  const [newDomainInput, setNewDomainInput] = useState('')
  const [domainError, setDomainError] = useState<string | null>(null)
  const [domainSuccess, setDomainSuccess] = useState<string | null>(null)
  const [domainLoading, setDomainLoading] = useState(false)

  // Safe Preview Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

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

  // Fetch approved domains when current contractor changes
  useEffect(() => {
    if (!currentSlot?.organization_id) return

    async function loadDomains() {
      try {
        setDomainLoading(true)
        const res = await fetch(`/api/agency/embeds/domains?orgId=${currentSlot?.organization_id}`)
        if (res.ok) {
          const data = await res.json()
          setApprovedDomains(data.domains || [])
        }
      } catch (err) {
        console.error('[AGENCY EMBEDS] Domains fetch error:', err)
      } finally {
        setDomainLoading(false)
      }
    }

    loadDomains()
  }, [currentSlot?.organization_id])

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault()
    setDomainError(null)
    setDomainSuccess(null)

    if (!currentSlot?.organization_id) {
      setDomainError('Select an active contractor client first')
      return
    }

    const validation = validateAndNormalizeDomain(newDomainInput)
    if (!validation.isValid || !validation.normalized) {
      setDomainError(validation.error || 'Invalid domain format')
      return
    }

    try {
      setDomainLoading(true)
      const res = await fetch('/api/agency/embeds/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentSlot.organization_id,
          domain: validation.normalized
        })
      })

      const data = await res.json()
      if (!res.ok) {
        setDomainError(data.error || 'Failed to add domain')
        return
      }

      setApprovedDomains(prev => [data.domain, ...prev])
      setNewDomainInput('')
      setDomainSuccess(`Domain ${validation.normalized} successfully authorized for embedding.`)
      setTimeout(() => setDomainSuccess(null), 3500)
    } catch {
      setDomainError('Network error while authorizing domain')
    } finally {
      setDomainLoading(false)
    }
  }

  async function handleRemoveDomain(domainId: string, domainName: string) {
    if (!currentSlot?.organization_id) return
    setDomainError(null)

    try {
      const res = await fetch(`/api/agency/embeds/domains?orgId=${currentSlot.organization_id}&domainId=${domainId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        setDomainError(data.error || 'Failed to revoke domain')
        return
      }

      setApprovedDomains(prev => prev.filter(d => d.id !== domainId))
      setDomainSuccess(`Domain ${domainName} authorization revoked.`)
      setTimeout(() => setDomainSuccess(null), 3500)
    } catch {
      setDomainError('Network error while revoking domain')
    }
  }

  // Construct full tagged booking URL matching Phase 3 attribution model
  const baseBookingUrl = currentSlot?.public_booking_url || 'https://captodesk.com/book/demo'
  const queryParts: string[] = []
  if (utmSource.trim()) queryParts.push(`utm_source=${encodeURIComponent(utmSource.trim())}`)
  if (utmMedium.trim()) queryParts.push(`utm_medium=${encodeURIComponent(utmMedium.trim())}`)
  if (utmCampaign.trim()) queryParts.push(`utm_campaign=${encodeURIComponent(utmCampaign.trim())}`)
  if (utmContent.trim()) queryParts.push(`utm_content=${encodeURIComponent(utmContent.trim())}`)
  if (utmTerm.trim()) queryParts.push(`utm_term=${encodeURIComponent(utmTerm.trim())}`)

  const taggedUrl = queryParts.length > 0 ? `${baseBookingUrl}?${queryParts.join('&')}` : baseBookingUrl
  const previewUrl = `${taggedUrl}${taggedUrl.includes('?') ? '&' : '?'}preview=true`

  // Format 1: Header / Hero Button Code
  const htmlButtonCode = `<a href="${taggedUrl}" class="captodesk-book-btn" style="background:#059669;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:700;font-family:sans-serif;text-decoration:none;display:inline-block;transition:background 0.2s;">
  Schedule Diagnostic Online
</a>`

  // Format 2: Sticky Mobile Floating Widget Code (Non-obstructive z-index and spacing)
  const floatingWidgetCode = `<!-- CaptoDesk Rapid Booking Button -->
<div style="position:fixed;bottom:24px;right:24px;z-index:99999;">
  <a href="${taggedUrl}" target="_blank" rel="noopener noreferrer" style="background:#059669;color:#ffffff;padding:14px 22px;border-radius:50px;box-shadow:0 10px 25px -5px rgba(5,150,105,0.4);font-weight:700;font-family:sans-serif;text-decoration:none;display:flex;align-items:center;gap:8px;">
    <span>Book Appointment</span>
  </a>
</div>`

  // Format 3: Inline Responsive Iframe Snippet
  const iframeCode = `<iframe
  src="${taggedUrl}"
  style="width:100%;max-width:680px;height:820px;border:none;border-radius:12px;display:block;margin:0 auto;"
  title="Online Appointment Booking"
  loading="lazy"
></iframe>`

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
            <span>Website Booking Embeds and Security Policies</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Generate embeddable booking buttons, widgets, and configure approved framing domains for your contractor clients.
          </p>
        </div>

        {currentSlot && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPreviewOpen(true)}
              className="h-9 px-3 text-xs bg-white hover:bg-slate-50 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 gap-1.5 rounded-lg shadow-2xs cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Safe Preview Mode</span>
            </Button>
          </div>
        )}
      </div>

      {/* Contractor Selector Ribbon or Empty State */}
      {activeSlots.length === 0 ? (
        <div className="p-8 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs text-center max-w-lg mx-auto space-y-4">
          <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-500">
            <Code2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No active clients
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Deploy a contractor client in your portfolio to generate booking buttons, widgets, and tracking links.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-2xs cursor-pointer"
          >
            <span>Deploy Client</span>
            <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </Link>
        </div>
      ) : (
        <>
          {/* Contractor Selector Ribbon */}
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-colors">
            <div>
              <span className="text-xs font-semibold text-slate-900 dark:text-white block">Select Contractor Client:</span>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400">Snippets and domain security policies update dynamically with client booking slug.</span>
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

          {/* Approved Domain Allowlist Card (F-AGY-11) */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Authorized Embedding Domains (Frame Security Policy)</h2>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono">
                {approvedDomains.length === 0 ? 'Framing Restricted (Default)' : `${approvedDomains.length} domain(s) authorized`}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              To prevent clickjacking while allowing third-party integration, only authorized website domains can embed this contractor's booking page inside an iframe. If no domains are configured, framing is restricted to CaptoDesk itself.
            </p>

            {domainError && (
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{domainError}</span>
              </div>
            )}

            {domainSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{domainSuccess}</span>
              </div>
            )}

            {/* Domain Input Form */}
            <form onSubmit={handleAddDomain} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="e.g. contractorwebsite.com or www.contractorwebsite.com"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  className="pl-9 h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
              <Button
                type="submit"
                disabled={domainLoading || !newDomainInput.trim()}
                className="h-9 px-4 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shrink-0 gap-1.5 cursor-pointer shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Authorize Domain</span>
              </Button>
            </form>

            {/* Approved Domains List */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300 block mb-2">Approved Domain Allowlist:</span>
              {approvedDomains.length === 0 ? (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 text-xs text-slate-500 dark:text-zinc-400">
                  No third-party domains authorized yet. This booking page is currently protected with <code className="font-mono text-emerald-600 dark:text-emerald-400">X-Frame-Options: SAMEORIGIN</code> and <code className="font-mono text-emerald-600 dark:text-emerald-400">frame-ancestors 'self'</code>.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {approvedDomains.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs font-mono font-medium text-slate-800 dark:text-zinc-200 truncate">
                          {d.domain}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDomain(d.id, d.domain)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors"
                        title="Revoke domain authorization"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Snippet Grid: CTA Buttons & Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Format 1: Header / Hero CTA Button */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Format 1: Header / Hero Booking CTA</h2>
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
                Direct booking link styled as a call-to-action button for website navigation menus and hero banners.
              </p>

              <pre className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-950 border border-slate-800 dark:border-zinc-800 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre-wrap">
{htmlButtonCode}
              </pre>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Button Preview:</span>
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

            {/* Format 2: Sticky Mobile Floating Widget */}
            <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Format 2: Sticky Mobile Floating Widget</h2>
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
                Floating quick-access widget positioned at the bottom-right. Optimized with proper padding and z-index to avoid covering essential mobile website navigation.
              </p>

              <pre className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-950 border border-slate-800 dark:border-zinc-800 text-[11px] font-mono text-blue-300 overflow-x-auto whitespace-pre-wrap">
{floatingWidgetCode}
              </pre>

              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Widget Preview:</span>
                <span className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-2xs">
                  Book Appointment
                </span>
              </div>
            </div>

          </div>

          {/* Format 3: Inline Iframe Booking Widget */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Format 3: Inline Iframe Booking Widget</h2>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleCopy(iframeCode, 'iframe-snippet')}
                className="h-7 px-2.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 gap-1 border border-slate-200 dark:border-zinc-700 cursor-pointer"
              >
                {copiedKey === 'iframe-snippet' ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>Copy Iframe Code</span>
              </Button>
            </div>

            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Embeds the full interactive booking schedule directly into the contractor's website page (e.g. WordPress, Webflow, Squarespace). Ensure the contractor's domain is added to the Authorized Embedding Domains list above.
            </p>

            <pre className="p-3 rounded-lg bg-slate-900 dark:bg-zinc-950 border border-slate-800 dark:border-zinc-800 text-[11px] font-mono text-purple-300 overflow-x-auto whitespace-pre-wrap">
{iframeCode}
            </pre>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600 dark:text-zinc-400">
                <span className="font-semibold block">Responsive Recommendations:</span>
                <span>Width: 100% (max 680px) | Height: 820px | Loading: lazy | Zero third-party cookie dependency</span>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg gap-1.5 cursor-pointer shadow-2xs shrink-0"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Test Live Preview</span>
              </Button>
            </div>
          </div>

          {/* Interactive UTM Campaign URL Builder Section (Phase 3 Model) */}
          <div className="p-5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Interactive UTM Campaign URL Builder (Phase 3 Attribution Model)</h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
              Tag all Google Ads, Local Services Ads (LSA), Facebook campaigns, or website buttons. The booking flow automatically captures and attributes appointments and invoiced revenue back to these exact campaign parameters.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
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
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Campaign Medium (`utm_medium`)</label>
                <Input
                  type="text"
                  value={utmMedium}
                  onChange={(e) => setUtmMedium(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                  placeholder="e.g. cpc"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Campaign Name (`utm_campaign`)</label>
                <Input
                  type="text"
                  value={utmCampaign}
                  onChange={(e) => setUtmCampaign(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                  placeholder="e.g. spring-ac-tuneup"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Ad Content (`utm_content`)</label>
                <Input
                  type="text"
                  value={utmContent}
                  onChange={(e) => setUtmContent(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                  placeholder="e.g. banner-variant-a"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">Search Term (`utm_term`)</label>
                <Input
                  type="text"
                  value={utmTerm}
                  onChange={(e) => setUtmTerm(e.target.value)}
                  className="h-9 text-xs font-mono bg-slate-50 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-lg"
                  placeholder="e.g. ac repair near me"
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

      {/* Safe Preview Modal (Section 6) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                  Safe Embed Preview Mode
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Warning Banner */}
            <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                Isolated Preview: Submissions in preview mode are simulated. No real appointments, customer records, SMS notifications, or billing charges will be triggered.
              </span>
            </div>

            {/* Iframe Preview Container */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-zinc-950 flex justify-center">
              <iframe
                src={previewUrl}
                className="w-full max-w-[620px] h-[720px] rounded-xl border border-slate-200 dark:border-zinc-800 shadow-xs bg-white dark:bg-zinc-900"
                title="Booking Preview"
              />
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono text-[11px] truncate max-w-md">
                Source: {previewUrl}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewOpen(false)}
                className="h-8 px-3 text-xs"
              >
                Close Preview
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
