'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  BarChart3, 
  ArrowLeft, 
  Download, 
  Printer, 
  Search, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Sparkles,
  ExternalLink,
  Layers
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AgencyCampaignAttribution } from '@/lib/agency/agency-types'

export default function AgencyAttributionPage() {
  const [attribution, setAttribution] = useState<AgencyCampaignAttribution[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')

  useEffect(() => {
    async function fetchAttribution() {
      try {
        setLoading(true)
        const res = await fetch('/api/agency/attribution')
        if (res.ok) {
          const data = await res.json()
          setAttribution(data.attribution || [])
        }
      } catch (err) {
        console.error('[AGENCY ATTRIBUTION] Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttribution()
  }, [])

  // Filter attribution items
  const filteredItems = attribution.filter(item => {
    if (selectedClient !== 'all' && item.client_name !== selectedClient) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        item.utm_source.toLowerCase().includes(q) ||
        item.utm_campaign.toLowerCase().includes(q) ||
        item.client_name.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Unique clients for filter
  const uniqueClients = Array.from(new Set(attribution.map(a => a.client_name)))

  // Aggregated totals
  const totalBookings = filteredItems.reduce((acc, i) => acc + i.bookings_count, 0)
  const totalRevenue = filteredItems.reduce((acc, i) => acc + i.invoiced_revenue, 0)

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 font-mono">
            <Link href="/agency/dashboard" className="hover:text-emerald-400 flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              <span>Portfolio</span>
            </Link>
            <span>/</span>
            <span className="text-slate-300">Closed-Loop UTM Attribution</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Marketing Campaign ROI & Attribution</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Indisputable proof for monthly client review meetings: every booked appointment and invoiced dollar tied directly to your agency’s ad and SEO campaigns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => window.print()}
            className="h-9 px-3 text-xs bg-slate-900 border-slate-800 text-slate-200 hover:text-white hover:bg-slate-800 gap-1.5 rounded-lg"
          >
            <Printer className="h-3.5 w-3.5 text-slate-400" />
            <span>Print Report</span>
          </Button>
        </div>
      </div>

      {/* Summary Stat Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <span className="text-xs text-slate-400 font-medium">Attributed Booked Jobs</span>
          <div className="mt-2 text-2xl font-extrabold text-white font-mono">
            {totalBookings} <span className="text-xs text-slate-500 font-sans font-normal">Appointments</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Tagged with UTM parameters</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-900/40">
          <span className="text-xs text-slate-400 font-medium">Verified Invoiced Cash</span>
          <div className="mt-2 text-2xl font-extrabold text-emerald-400 font-mono">
            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-emerald-300/80 mt-1 block">Directly collected on-site by trucks</span>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Average Retainer Defense Factor</span>
          <div className="mt-2 text-2xl font-extrabold text-white font-mono flex items-center gap-2">
            <span>8.8x</span>
            <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              High Retention
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">Zero client churn risk</span>
        </div>

      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <Input
            type="text"
            placeholder="Search source or campaign..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-slate-950 border-slate-800 text-slate-200 rounded-lg placeholder:text-slate-500"
          />
        </div>

        {/* Client selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 whitespace-nowrap">Filter Contractor:</span>
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="h-9 px-3 text-xs bg-slate-950 border border-slate-800 text-white rounded-lg focus:outline-none focus:border-emerald-500 font-medium"
          >
            <option value="all">All Active Contractors ({uniqueClients.length})</option>
            {uniqueClients.map(client => (
              <option key={client} value={client}>{client}</option>
            ))}
          </select>
        </div>

      </div>

      {/* Attribution Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Contractor Client</th>
                <th className="py-3 px-4">Campaign / UTM Source</th>
                <th className="py-3 px-4">Medium</th>
                <th className="py-3 px-4 text-center">Booked Jobs</th>
                <th className="py-3 px-4 text-center">Conversion Rate</th>
                <th className="py-3 px-4 text-right">Invoiced Cash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredItems.map((item, idx) => (
                <tr key={`attr-${idx}`} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-100">
                    {item.client_name}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-emerald-400 font-semibold text-xs">
                        {item.utm_campaign}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">
                        source: {item.utm_source}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                      {item.utm_medium || 'cpc'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-200">
                    {item.bookings_count} jobs
                  </td>
                  <td className="py-3.5 px-4 text-center font-mono text-emerald-400 font-semibold">
                    {item.conversion_rate}%
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 text-sm">
                    ${item.invoiced_revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
