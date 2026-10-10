'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { 
  Building2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Power, 
  ExternalLink,
  PhoneCall,
  Terminal,
  Filter,
  Loader2,
  X,
  CreditCard,
  Calendar,
  DollarSign,
  Receipt
} from 'lucide-react'
import { toast } from 'sonner'
import { TenantHealthSummary } from '@/lib/admin/admin-service'

export default function AdminOrganizationsPage() {
  const [tenants, setTenants] = useState<TenantHealthSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [activating10DlcId, setActivating10DlcId] = useState<string | null>(null)
  const [batchActivating, setBatchActivating] = useState(false)

  // Super Admin Phone/DID Provisioning Modal State (P1-OPS-01)
  const [provisionModalOpen, setProvisionModalOpen] = useState(false)
  const [selectedOrgForProvision, setSelectedOrgForProvision] = useState<TenantHealthSummary | null>(null)
  const [preferredAreaCode, setPreferredAreaCode] = useState('')
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [areaCodeError, setAreaCodeError] = useState<string | null>(null)

  // Super Admin SaaS Subscription & Billing Modal State (P1-OPS-03)
  const [billingModalOpen, setBillingModalOpen] = useState(false)
  const [selectedOrgForBilling, setSelectedOrgForBilling] = useState<TenantHealthSummary | null>(null)
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingSubmitting, setBillingSubmitting] = useState(false)
  const [billingData, setBillingData] = useState<{
    organization: any
    subscription: any | null
    entitlement: { hasAccess: boolean; status: string; currentPeriodEnd: string | null; isExpired: boolean; daysRemaining: number } | null
    plan: any | null
    payments: any[]
  } | null>(null)
  const [paymentRefInput, setPaymentRefInput] = useState('')
  const [billingNotesInput, setBillingNotesInput] = useState('')
  const [billingPeriodMonths, setBillingPeriodMonths] = useState(1)
  const [cancelImmediate, setCancelImmediate] = useState(false)

  const handleOpenProvisionModal = (tenant: TenantHealthSummary) => {
    setSelectedOrgForProvision(tenant)
    setPreferredAreaCode('')
    setAreaCodeError(null)
    setProvisionModalOpen(true)
  }

  const handleCloseProvisionModal = () => {
    if (isProvisioning) return
    setProvisionModalOpen(false)
    setSelectedOrgForProvision(null)
    setPreferredAreaCode('')
    setAreaCodeError(null)
  }

  const handleConfirmProvision = async () => {
    if (!selectedOrgForProvision) return

    const trimmed = preferredAreaCode.trim()
    if (trimmed && !/^[2-9]\d{2}$/.test(trimmed)) {
      setAreaCodeError('Area code must be a 3-digit NANPA code (e.g. 214, 512, 415)')
      return
    }

    setIsProvisioning(true)
    setAreaCodeError(null)

    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrgForProvision.id}/provision-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaCode: trimmed || undefined
        })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        if (data.status === 'already_assigned') {
          toast.info(data.message || `Phone number already assigned: ${data.phoneNumber}`)
        } else {
          toast.success(`Telnyx phone number ${data.phoneNumber || ''} provisioned successfully!`)
        }

        setTenants(prev => prev.map(t => t.id === selectedOrgForProvision.id ? {
          ...t,
          phoneProvisioningStatus: data.status === 'already_assigned' ? 'active' : (data.status || 'active'),
          telnyxNumber: data.phoneNumber || t.telnyxNumber
        } : t))

        setProvisionModalOpen(false)
        setSelectedOrgForProvision(null)
        setPreferredAreaCode('')
        fetchTenants()
      } else {
        toast.error(data.error || 'Failed to provision Telnyx phone number')
        setTenants(prev => prev.map(t => t.id === selectedOrgForProvision.id ? {
          ...t,
          phoneProvisioningStatus: 'failed'
        } : t))
      }
    } catch {
      toast.error('Network error during phone provisioning')
    } finally {
      setIsProvisioning(false)
    }
  }

  const fetchBillingDetails = useCallback(async (orgId: string) => {
    setBillingLoading(true)
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/subscription`)
      if (res.ok) {
        const data = await res.json()
        setBillingData(data)
      } else {
        toast.error('Failed to load subscription details')
      }
    } catch {
      toast.error('Network error loading subscription details')
    } finally {
      setBillingLoading(false)
    }
  }, [])

  const handleOpenBillingModal = (tenant: TenantHealthSummary) => {
    setSelectedOrgForBilling(tenant)
    setPaymentRefInput('')
    setBillingNotesInput('')
    setBillingPeriodMonths(1)
    setCancelImmediate(false)
    setBillingModalOpen(true)
    fetchBillingDetails(tenant.id)
  }

  const handleCloseBillingModal = () => {
    if (billingSubmitting) return
    setBillingModalOpen(false)
    setSelectedOrgForBilling(null)
    setBillingData(null)
  }

  const handleActivateBilling = async () => {
    if (!selectedOrgForBilling) return
    setBillingSubmitting(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrgForBilling.id}/subscription/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentReference: paymentRefInput.trim() || undefined,
          notes: billingNotesInput.trim() || undefined,
          periodMonths: billingPeriodMonths,
          provider: 'paypal_manual'
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Subscription successfully activated')
        setPaymentRefInput('')
        setBillingNotesInput('')
        await fetchBillingDetails(selectedOrgForBilling.id)
        fetchTenants()
      } else {
        toast.error(data.error || 'Failed to activate subscription')
      }
    } catch {
      toast.error('Network error activating subscription')
    } finally {
      setBillingSubmitting(false)
    }
  }

  const handleRenewBilling = async () => {
    if (!selectedOrgForBilling) return
    setBillingSubmitting(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrgForBilling.id}/subscription/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentReference: paymentRefInput.trim() || undefined,
          notes: billingNotesInput.trim() || undefined,
          periodMonths: billingPeriodMonths,
          provider: 'paypal_manual'
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Subscription successfully renewed')
        setPaymentRefInput('')
        setBillingNotesInput('')
        await fetchBillingDetails(selectedOrgForBilling.id)
        fetchTenants()
      } else {
        toast.error(data.error || 'Failed to renew subscription')
      }
    } catch {
      toast.error('Network error renewing subscription')
    } finally {
      setBillingSubmitting(false)
    }
  }

  const handleCancelBilling = async () => {
    if (!selectedOrgForBilling) return
    setBillingSubmitting(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrgForBilling.id}/subscription/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          immediate: cancelImmediate,
          reason: billingNotesInput.trim() || undefined
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Subscription canceled')
        await fetchBillingDetails(selectedOrgForBilling.id)
        fetchTenants()
      } else {
        toast.error(data.error || 'Failed to cancel subscription')
      }
    } catch {
      toast.error('Network error canceling subscription')
    } finally {
      setBillingSubmitting(false)
    }
  }

  const handleReactivateBilling = async () => {
    if (!selectedOrgForBilling) return
    setBillingSubmitting(true)
    try {
      const res = await fetch(`/api/admin/organizations/${selectedOrgForBilling.id}/subscription/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || 'Subscription successfully reactivated')
        await fetchBillingDetails(selectedOrgForBilling.id)
        fetchTenants()
      } else {
        toast.error(data.error || 'Failed to reactivate subscription')
      }
    } catch {
      toast.error('Network error reactivating subscription')
    } finally {
      setBillingSubmitting(false)
    }
  }

  const handleActivate10Dlc = async (orgId: string) => {
    setActivating10DlcId(orgId)
    try {
      const res = await fetch('/api/admin/10dlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.result?.message || '10DLC Brand & Campaign registered with Telnyx!')
        setTenants(prev => prev.map(t => t.id === orgId ? {
          ...t,
          carrierRegistrationStatus: data.result?.carrierStatus || 'in_review',
          tcrBrandId: data.result?.brandId || t.tcrBrandId,
          tcrCampaignId: data.result?.campaignId || t.tcrCampaignId
        } : t))
      } else {
        toast.error(data.result?.message || data.error || 'Failed to activate 10DLC')
      }
    } catch {
      toast.error('Network error activating 10DLC')
    } finally {
      setActivating10DlcId(null)
    }
  }

  const handleBatchActivate10Dlc = async () => {
    const pendingTenants = tenants.filter(t => t.carrierRegistrationStatus === 'pending' || (t.carrierRegistrationStatus === 'unregistered' && t.legalBusinessName))
    if (pendingTenants.length === 0) {
      toast.info('No pending organizations ready for 10DLC registration.')
      return
    }

    setBatchActivating(true)
    try {
      const res = await fetch('/api/admin/10dlc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgIds: pendingTenants.map(t => t.id) })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Batch 10DLC completed: ${data.succeeded} of ${data.total} brands registered.`)
        fetchTenants()
      } else {
        toast.error(data.error || 'Batch activation encountered an issue')
      }
    } catch {
      toast.error('Network error during batch activation')
    } finally {
      setBatchActivating(false)
    }
  }

  const fetchTenants = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('query', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)

      const res = await fetch(`/api/admin/tenants?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setTenants(data.tenants || [])
      } else {
        toast.error('Failed to load tenants')
      }
    } catch {
      toast.error('Network error loading tenants')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTenants()
    }, 200)
    return () => clearTimeout(timer)
  }, [fetchTenants])

  const handleStatusChange = async (orgId: string, newStatus: string) => {
    setUpdatingId(orgId)
    try {
      const res = await fetch('/api/admin/organizations/toggle-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ org_id: orgId, status: newStatus })
      })

      if (res.ok) {
        toast.success(`Subscription status updated to ${newStatus}`)
        setTenants(tenants.map(t => t.id === orgId ? { ...t, subscriptionStatus: newStatus as any } : t))
      } else {
        const err = await res.json()
        toast.error(err.error || 'Failed to update status')
      }
    } catch {
      toast.error('Network error updating status')
    } finally {
      setUpdatingId(null)
    }
  }

  const pending10DlcCount = tenants.filter(t => t.carrierRegistrationStatus === 'pending' || (t.carrierRegistrationStatus === 'unregistered' && t.legalBusinessName)).length

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Tenant Health & Organizations
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Real-time multi-tenant health grades, message delivery integrity, and subscription lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pending10DlcCount > 0 && (
            <button
              onClick={handleBatchActivate10Dlc}
              disabled={batchActivating}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all disabled:opacity-50"
              title="Activate 10DLC for all pending businesses"
            >
              {batchActivating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>1-Click Activate All ({pending10DlcCount})</span>
            </button>
          )}

          <button
            onClick={fetchTenants}
            disabled={loading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh Tenants"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 border border-zinc-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, slug, phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          {['all', 'active', 'trial', 'suspended', 'churned'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase tracking-wider font-mono text-[10px] border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Organization</th>
                <th className="py-3.5 px-4">Health Grade</th>
                <th className="py-3.5 px-4">Subscription</th>
                <th className="py-3.5 px-4">10DLC Carrier Brand</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4">Messaging Failures</th>
                <th className="py-3.5 px-4">Automation / Webhooks</th>
                <th className="py-3.5 px-4">Telnyx Config</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/80 text-zinc-300">
              {tenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    No tenant organizations match the current filters.
                  </td>
                </tr>
              ) : (
                tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-800/30 transition-colors">
                    {/* Name & Slug */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white">{t.name}</div>
                      <div className="text-[11px] text-zinc-400">/{t.slug} • ${t.monthlyRate}/mo</div>
                    </td>

                    {/* Health Grade */}
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        t.healthGrade === 'healthy'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : t.healthGrade === 'warning'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          t.healthGrade === 'healthy' ? 'bg-emerald-400' : t.healthGrade === 'warning' ? 'bg-amber-400' : 'bg-rose-400'
                        }`} />
                        {t.healthGrade}
                      </span>
                    </td>

                    {/* Subscription Status Selector */}
                    <td className="py-3.5 px-4">
                      <select
                        value={t.subscriptionStatus}
                        disabled={updatingId === t.id}
                        onChange={(e) => handleStatusChange(t.id, e.target.value)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 bg-zinc-950 border border-zinc-800 focus:outline-none focus:border-amber-500 transition-colors capitalize ${
                          t.subscriptionStatus === 'active' ? 'text-emerald-400' :
                          t.subscriptionStatus === 'trial' ? 'text-blue-400' :
                          t.subscriptionStatus === 'suspended' ? 'text-amber-400' : 'text-zinc-400'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="trial">Trial</option>
                        <option value="suspended">Suspended</option>
                        <option value="churned">Churned</option>
                      </select>
                    </td>

                    {/* 10DLC Carrier Brand */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {t.carrierRegistrationStatus === 'verified' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Verified TCR
                            </span>
                          ) : t.carrierRegistrationStatus === 'in_review' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/20 px-2 py-0.5 rounded-md">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Under Review
                            </span>
                          ) : t.carrierRegistrationStatus === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/20 px-2 py-0.5 rounded-md">
                              Pending Filing
                            </span>
                          ) : t.carrierRegistrationStatus === 'rejected' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded-md">
                              Rejected
                            </span>
                          ) : (
                            <span className="text-[10px] text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-md">
                              Unregistered
                            </span>
                          )}

                          {t.carrierRegistrationStatus !== 'verified' && (
                            <button
                              onClick={() => handleActivate10Dlc(t.id)}
                              disabled={activating10DlcId === t.id}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors disabled:opacity-50"
                              title="Submit brand to Telnyx 10DLC"
                            >
                              {activating10DlcId === t.id ? (
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              ) : (
                                <ShieldCheck className="h-2.5 w-2.5" />
                              )}
                              <span>{activating10DlcId === t.id ? 'Filing...' : '1-Click Submit'}</span>
                            </button>
                          )}
                        </div>

                        {t.legalBusinessName && (
                          <div className="text-[10px] text-zinc-400 truncate max-w-[170px]" title={t.legalBusinessName}>
                            {t.legalBusinessName} {t.ein ? `• EIN: ${t.ein}` : t.isSoleProprietor ? '• Sole Prop' : ''}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Last Activity */}
                    <td className="py-3.5 px-4 text-zinc-400">
                      {t.lastActivity ? (
                        <div>
                          <p className="text-zinc-200">{new Date(t.lastActivity).toLocaleDateString()}</p>
                          <p className="text-[10px] text-zinc-400">{new Date(t.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">No activity</span>
                      )}
                    </td>

                    {/* Messaging Failures */}
                    <td className="py-3.5 px-4">
                      <span className="text-zinc-200 font-medium">{t.messagesCount} sent</span>
                      {t.failedMessagesCount > 0 ? (
                        <span className="text-rose-400 font-bold ml-1.5">({t.failedMessagesCount} failed)</span>
                      ) : (
                        <span className="text-emerald-400/80 text-[10px] ml-1.5 font-bold">100% OK</span>
                      )}
                    </td>

                    {/* Automation / Webhooks */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <span className={t.automationFailuresCount > 0 ? 'text-rose-400 font-bold' : 'text-zinc-400'}>
                          {t.automationFailuresCount} auto failures
                        </span>
                        {t.webhookFailuresCount > 0 && (
                          <p className="text-purple-400 font-semibold">{t.webhookFailuresCount} webhook errors</p>
                        )}
                      </div>
                    </td>

                    {/* Telnyx Config & DID Provisioning */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-1.5">
                        {t.phoneProvisioningStatus === 'active' || (t.telnyxNumber && t.phoneProvisioningStatus !== 'failed' && t.phoneProvisioningStatus !== 'provisioning') ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              DID Active
                            </span>
                            <div className="font-mono text-[11px] text-zinc-200 mt-0.5">
                              {t.telnyxNumber}
                            </div>
                          </div>
                        ) : t.phoneProvisioningStatus === 'provisioning' || (isProvisioning && selectedOrgForProvision?.id === t.id) ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/15 border border-blue-500/20 px-2 py-0.5 rounded-md">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              Provisioning...
                            </span>
                            <div className="text-[10px] text-zinc-400 mt-0.5">Order in-flight</div>
                          </div>
                        ) : t.phoneProvisioningStatus === 'failed' ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-400 bg-rose-500/15 border border-rose-500/20 px-2 py-0.5 rounded-md">
                              <AlertTriangle className="h-2.5 w-2.5" />
                              DID Failed
                            </span>
                            <div>
                              <button
                                onClick={() => handleOpenProvisionModal(t)}
                                disabled={isProvisioning}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/20 transition-colors disabled:opacity-50"
                                title="Retry phone provisioning"
                              >
                                <RefreshCw className="h-2.5 w-2.5" />
                                <span>Retry DID Provisioning</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <span className="text-[10px] text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded-md inline-block">
                              Pending Number
                            </span>
                            <div>
                              <button
                                onClick={() => handleOpenProvisionModal(t)}
                                disabled={isProvisioning}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors disabled:opacity-50"
                                title="Order dedicated Telnyx phone number"
                              >
                                <PhoneCall className="h-2.5 w-2.5" />
                                <span>Order & Provision DID</span>
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] text-zinc-400">
                          {t.isMissedCallActive ? (
                            <span className="text-emerald-400/80">Safety Net Active</span>
                          ) : (
                            <span className="text-zinc-500">Engine Paused</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenBillingModal(t)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 transition-colors"
                          title="Manage SaaS Subscription & PayPal Billing"
                        >
                          <CreditCard className="h-3 w-3" />
                          <span>Billing</span>
                        </button>
                        <Link
                          href={`/admin/events?orgId=${t.id}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1.5 rounded-lg border border-amber-500/20 transition-colors"
                        >
                          <Terminal className="h-3 w-3" />
                          <span>Inspect</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Super Admin Phone Provisioning Confirmation Modal (P1-OPS-01) */}
      {provisionModalOpen && selectedOrgForProvision && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-white">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Order & Provision DID</h3>
                  <p className="text-xs text-zinc-400">Telnyx Official Number Orders API</p>
                </div>
              </div>
              <button
                onClick={handleCloseProvisionModal}
                disabled={isProvisioning}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-zinc-300">
              <p>
                Order a dedicated CaptoDesk phone number for <strong className="text-white">{selectedOrgForProvision.name}</strong>?
              </p>
              <p className="text-zinc-400">
                This action will initiate Telnyx phone-number provisioning using the official Number Orders API. The number will be locked exclusively to this organization.
              </p>

              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-zinc-300">
                  Preferred Area Code <span className="text-zinc-500 font-normal">(Optional 3-digit NANPA code)</span>
                </label>
                <input
                  type="text"
                  maxLength={3}
                  placeholder="e.g. 214"
                  value={preferredAreaCode}
                  onChange={(e) => {
                    setPreferredAreaCode(e.target.value.replace(/\D/g, ''))
                    setAreaCodeError(null)
                  }}
                  disabled={isProvisioning}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors font-mono"
                />
                {areaCodeError && (
                  <p className="text-[11px] text-rose-400 font-medium">{areaCodeError}</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleCloseProvisionModal}
                disabled={isProvisioning}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmProvision}
                disabled={isProvisioning}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/10"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Provisioning DID...</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="h-3.5 w-3.5" />
                    <span>Order & Provision DID</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Super Admin SaaS Subscription & Billing Modal (P1-OPS-03) */}
      {billingModalOpen && selectedOrgForBilling && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">SaaS Subscription & Billing</h3>
                  <p className="text-xs text-zinc-400">
                    {selectedOrgForBilling.name} • <span className="font-mono text-zinc-500 text-[11px]">{selectedOrgForBilling.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseBillingModal}
                disabled={billingSubmitting}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {billingLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                <p className="text-xs">Loading subscription details...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Plan Card */}
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Plan & Rate</span>
                    <p className="text-sm font-bold text-white">
                      {billingData?.plan?.name || 'CaptoDesk Standard'}
                    </p>
                    <p className="text-xs font-semibold text-emerald-400">
                      ${billingData?.plan?.price || 99} <span className="text-zinc-400 text-[10px] font-normal">/ month USD</span>
                    </p>
                  </div>

                  {/* Status Card */}
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Subscription Status</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md capitalize ${
                        billingData?.subscription?.status === 'active' && !billingData?.entitlement?.isExpired
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : billingData?.subscription?.status === 'past_due'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          billingData?.subscription?.status === 'active' && !billingData?.entitlement?.isExpired
                            ? 'bg-emerald-400'
                            : 'bg-zinc-500'
                        }`} />
                        {billingData?.subscription?.status || 'No Subscription'}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Provider: <span className="text-zinc-300 font-medium">PayPal Manual (S M CREATIONS)</span>
                    </p>
                  </div>

                  {/* Period Card */}
                  <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Current Period</span>
                    <p className="text-xs font-medium text-white truncate">
                      {billingData?.subscription?.current_period_end
                        ? new Date(billingData.subscription.current_period_end).toLocaleDateString()
                        : 'Not active'}
                    </p>
                    <p className="text-[10px] text-zinc-400">
                      {billingData?.entitlement?.isExpired ? (
                        <span className="text-rose-400 font-semibold">Period Expired</span>
                      ) : billingData?.entitlement?.daysRemaining !== undefined ? (
                        <span className="text-emerald-400">{billingData.entitlement.daysRemaining} days remaining</span>
                      ) : (
                        'No active period'
                      )}
                    </p>
                  </div>
                </div>

                {/* Cancellation Alert if Scheduled */}
                {billingData?.subscription?.cancel_at_period_end && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Scheduled for cancellation</p>
                      <p className="text-amber-300/80 text-[11px] mt-0.5">
                        Access remains active until the end of the billing period ({new Date(billingData.subscription.current_period_end).toLocaleDateString()}).
                      </p>
                    </div>
                  </div>
                )}

                {/* Operator Actions Section */}
                <div className="space-y-4 border border-zinc-800 rounded-xl p-4 bg-zinc-900/40">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Manage Subscription Actions</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">
                        PayPal Transaction / Reference ID
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PAYID-M5XYZ1234..."
                        value={paymentRefInput}
                        onChange={(e) => setPaymentRefInput(e.target.value)}
                        disabled={billingSubmitting}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 font-mono text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 font-semibold mb-1">
                        Billing Period Duration
                      </label>
                      <select
                        value={billingPeriodMonths}
                        onChange={(e) => setBillingPeriodMonths(Number(e.target.value))}
                        disabled={billingSubmitting}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white font-medium text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                      >
                        <option value={1}>1 Month ($99 USD)</option>
                        <option value={3}>3 Months ($297 USD)</option>
                        <option value={6}>6 Months ($594 USD)</option>
                        <option value={12}>12 Months ($1,188 USD)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-zinc-400 font-semibold mb-1">
                        Admin Note / Reference (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Paid via PayPal invoice #1001"
                        value={billingNotesInput}
                        onChange={(e) => setBillingNotesInput(e.target.value)}
                        disabled={billingSubmitting}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
                    {(!billingData?.subscription || billingData.subscription.status !== 'active') ? (
                      <button
                        type="button"
                        onClick={handleActivateBilling}
                        disabled={billingSubmitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-50"
                      >
                        {billingSubmitting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        <span>Activate Subscription (${99 * billingPeriodMonths} USD)</span>
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleRenewBilling}
                          disabled={billingSubmitting}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 transition-colors disabled:opacity-50"
                        >
                          {billingSubmitting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                          <span>Record Payment & Extend ({billingPeriodMonths} Mo)</span>
                        </button>

                        {!billingData.subscription.cancel_at_period_end ? (
                          <div className="flex items-center gap-2 ml-auto">
                            <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={cancelImmediate}
                                onChange={(e) => setCancelImmediate(e.target.checked)}
                                disabled={billingSubmitting}
                                className="rounded bg-zinc-900 border-zinc-700 text-rose-500 focus:ring-rose-500"
                              />
                              <span>Cancel Immediately</span>
                            </label>
                            <button
                              type="button"
                              onClick={handleCancelBilling}
                              disabled={billingSubmitting}
                              className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors disabled:opacity-50"
                            >
                              <span>Cancel Subscription</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleReactivateBilling}
                            disabled={billingSubmitting}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50 ml-auto"
                          >
                            {billingSubmitting ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            <span>Reactivate (Cancel Cancellation)</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Payment History Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Receipt className="h-3.5 w-3.5 text-zinc-400" />
                      <span>SaaS Payment History</span>
                    </h4>
                    <span className="text-[11px] text-zinc-400">
                      {billingData?.payments?.length || 0} recorded
                    </span>
                  </div>

                  {(!billingData?.payments || billingData.payments.length === 0) ? (
                    <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center text-xs text-zinc-400">
                      No payments recorded yet for this organization.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-800">
                      <table className="w-full text-left text-xs text-zinc-300">
                        <thead className="bg-zinc-900/80 text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Period</th>
                            <th className="py-2.5 px-3">Amount</th>
                            <th className="py-2.5 px-3">Provider</th>
                            <th className="py-2.5 px-3">Reference</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                          {billingData.payments.map((p: any) => (
                            <tr key={p.id} className="hover:bg-zinc-900/40">
                              <td className="py-2.5 px-3 font-sans text-zinc-400">
                                {new Date(p.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-300">
                                {new Date(p.billing_period_start).toLocaleDateString()} – {new Date(p.billing_period_end).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-emerald-400">
                                ${Number(p.amount).toFixed(2)} {p.currency}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-400 font-sans capitalize">
                                {p.provider?.replace('_', ' ') || 'PayPal Manual'}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-400 truncate max-w-[120px]" title={p.provider_payment_reference}>
                                {p.provider_payment_reference || '—'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md uppercase">
                                  {p.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleCloseBillingModal}
                disabled={billingSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors disabled:opacity-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
