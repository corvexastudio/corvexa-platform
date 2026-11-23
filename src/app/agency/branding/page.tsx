'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Globe, 
  Palette, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  ExternalLink,
  ArrowRight,
  Eye,
  Loader2,
  Copy
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AgencyBrandingConfig } from '@/lib/agency/agency-types'

export default function AgencyBrandingPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [agencyName, setAgencyName] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<string>('growth_10')
  const [isWhiteLabelEligible, setIsWhiteLabelEligible] = useState(false)

  // Form state
  const [portalTitle, setPortalTitle] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#10b981')
  const [accentColor, setAccentColor] = useState('#047857')
  const [customDomain, setCustomDomain] = useState('')
  const [hidePoweredBy, setHidePoweredBy] = useState(false)

  useEffect(() => {
    async function fetchBranding() {
      try {
        setLoading(true)
        const res = await fetch('/api/agency/branding')
        if (res.ok) {
          const data = await res.json()
          setAgencyName(data.name || 'Your Agency')
          setSubscriptionTier(data.subscriptionTier || 'growth_10')
          setIsWhiteLabelEligible(Boolean(data.isWhiteLabelEligible))
          setCustomDomain(data.customDomain || '')

          const b: AgencyBrandingConfig = data.branding || {}
          setPortalTitle(b.portalTitle || data.name || '')
          setLogoUrl(b.logoUrl || '')
          setFaviconUrl(b.faviconUrl || '')
          setPrimaryColor(b.primaryColor || '#10b981')
          setAccentColor(b.accentColor || '#047857')
          setHidePoweredBy(Boolean(b.hidePoweredBy))
        }
      } catch (err) {
        console.error('[BRANDING LOAD ERROR]', err)
        toast.error('Failed to load agency branding settings')
      } finally {
        setLoading(false)
      }
    }
    fetchBranding()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await fetch('/api/agency/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customDomain: customDomain.trim() || null,
          branding: {
            portalTitle: portalTitle.trim() || null,
            logoUrl: logoUrl.trim() || null,
            faviconUrl: faviconUrl.trim() || null,
            primaryColor: primaryColor.trim() || null,
            accentColor: accentColor.trim() || null,
            hidePoweredBy
          }
        })
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to save branding settings')
        return
      }

      toast.success('Branding and white-label settings saved successfully')
    } catch (err) {
      console.error('[BRANDING SAVE ERROR]', err)
      toast.error('An unexpected error occurred while saving')
    } finally {
      setSaving(false)
    }
  }

  function copyCnameTarget() {
    navigator.clipboard.writeText('cname.captodesk.com')
    toast.success('Copied cname.captodesk.com to clipboard')
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 dark:text-zinc-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold">Loading White-Label & Domain Configuration...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            White-Label & Custom Domain
          </h1>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
            Rebrand the contractor portal, connect your own CNAME domain, and customize portal themes for your agency.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs gap-1.5 h-9 px-4 shrink-0 shadow-2xs"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Save Changes</span>
        </Button>
      </div>

      {/* Plan Status Banner */}
      {isWhiteLabelEligible ? (
        <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-emerald-900 dark:text-emerald-200">Scale Tier Active: Full White-Label Unlocked</span>
            <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">
              Your wholesale subscription includes custom CNAME domain mapping, complete badge removal, and custom CSS branding.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 text-xs">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-900 dark:text-amber-200">Custom Domain & Badge Removal are locked</span>
              <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                You can customize your agency logo and colors on your current tier. Upgrading to the Scale 25+ plan ($899/mo) unlocks your own custom CNAME domain and completely removes the "Powered by" footer badge.
              </p>
            </div>
          </div>
          <Link href="/agency/billing">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shrink-0 gap-1 h-8">
              <span>Upgrade to Scale</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Two Columns: Settings Form */}
        <div className="lg:col-span-2 space-y-6">

          {/* 1. Brand Identity */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
              <Palette className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Agency Brand Identity</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Portal Header Title
                </label>
                <input
                  type="text"
                  value={portalTitle}
                  onChange={(e) => setPortalTitle(e.target.value)}
                  placeholder={agencyName || "Apex Media Dispatch"}
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500">Displayed in portal navigation for your clients</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Logo Image URL
                </label>
                <input
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/agency-logo.png"
                  className="w-full text-xs px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500">Square or horizontal PNG/SVG with transparent background</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-8 w-10 border border-slate-200 dark:border-zinc-800 rounded cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full text-xs px-3 py-2 font-mono border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Brand Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="h-8 w-10 border border-slate-200 dark:border-zinc-800 rounded cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-full text-xs px-3 py-2 font-mono border border-slate-200 dark:border-zinc-800 rounded-lg bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 2. Custom CNAME Domain */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Custom CNAME Domain Mapping</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                Scale Tier Perk
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Custom Domain Hostname
              </label>
              <input
                type="text"
                disabled={!isWhiteLabelEligible}
                value={customDomain}
                onChange={(e) => setCustomDomain(e.target.value)}
                placeholder="portal.youragency.com"
                className={cn(
                  "w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1",
                  isWhiteLabelEligible
                    ? "border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white focus:ring-emerald-500"
                    : "border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 text-slate-400 cursor-not-allowed"
                )}
              />
              <p className="text-[10px] text-slate-500">
                Point a DNS CNAME record from your domain to CaptoDesk
              </p>
            </div>

            {/* DNS Instructions Card */}
            <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 dark:text-zinc-300">Required DNS Configuration:</span>
                <button
                  type="button"
                  onClick={copyCnameTarget}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-mono"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy CNAME</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-[11px] bg-white dark:bg-zinc-900 p-2.5 rounded border border-slate-200 dark:border-zinc-800">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Type</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">CNAME</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Host / Name</span>
                  <span className="font-bold text-slate-800 dark:text-zinc-200">{customDomain ? customDomain.split('.')[0] : 'portal'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Value / Target</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">cname.captodesk.com</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Powered-by Badge Suppression */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Badge Suppression & Attribution</h2>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 uppercase tracking-wider">
                Full White-Label
              </span>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Hide "Powered by CaptoDesk" Footer Badge
                </label>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                  Removes all CaptoDesk branding from contractor login views, customer tracking links, and booking confirmations.
                </p>
              </div>

              <input
                type="checkbox"
                disabled={!isWhiteLabelEligible}
                checked={hidePoweredBy}
                onChange={(e) => setHidePoweredBy(e.target.checked)}
                className={cn(
                  "h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500",
                  !isWhiteLabelEligible && "cursor-not-allowed opacity-50"
                )}
              />
            </div>
          </div>

        </div>

        {/* Right Column: Live Visual Preview */}
        <div className="space-y-4">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-zinc-300">
            <Eye className="h-4 w-4 text-slate-500" />
            <span>Live Client View Preview</span>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-4 sticky top-24">
            
            {/* Simulated Header */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Contractor Header
              </span>
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-6 w-auto object-contain max-w-[80px]" />
                  ) : (
                    <div 
                      className="h-6 px-2 rounded text-[10px] font-bold text-white flex items-center justify-center"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {portalTitle ? portalTitle.slice(0, 3).toUpperCase() : 'AGY'}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                    {portalTitle || 'Your Agency Dispatch'}
                  </span>
                </div>
                <div className="h-4 w-12 rounded bg-slate-200 dark:bg-zinc-800" />
              </div>
            </div>

            {/* Simulated Accent UI Button */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Primary Button / Accent
              </span>
              <button
                type="button"
                className="w-full py-2 rounded-lg text-xs font-bold text-white shadow-xs cursor-default"
                style={{ backgroundColor: primaryColor }}
              >
                Schedule Appointment (5-Sec Reply)
              </button>
            </div>

            {/* Simulated Footer Badge */}
            <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Footer Attribution
              </span>
              <div className="text-center py-2 text-[11px] text-slate-500">
                {hidePoweredBy ? (
                  <span className="font-semibold text-slate-700 dark:text-zinc-300">
                    © 2026 {portalTitle || agencyName}. All rights reserved.
                  </span>
                ) : (
                  <span>
                    Powered by <strong className="font-semibold text-slate-700 dark:text-zinc-300">CaptoDesk</strong> for {portalTitle || agencyName}
                  </span>
                )}
              </div>
            </div>

            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 shadow-2xs gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Branding Changes</span>
            </Button>
          </div>
        </div>

      </form>

    </div>
  )
}
