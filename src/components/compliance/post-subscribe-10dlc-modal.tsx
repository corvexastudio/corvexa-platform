'use client'

import React, { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldCheck, Loader2, CheckCircle2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export interface PostSubscribe10DlcModalProps {
  isOpen: boolean
  onClose: () => void
  planTierName?: string
  initialData?: {
    legal_business_name?: string
    business_type?: string
    ein?: string
    is_sole_proprietor?: boolean
    address_street?: string
    address_city?: string
    address_state?: string
    address_postal_code?: string
  }
  onSuccess?: () => void
}

export function PostSubscribe10DlcModal({
  isOpen,
  onClose,
  planTierName = 'Solo Pro',
  initialData = {},
  onSuccess
}: PostSubscribe10DlcModalProps) {
  const [formData, setFormData] = useState({
    legal_business_name: initialData.legal_business_name || '',
    business_type: initialData.business_type || 'llc',
    ein: initialData.ein || '',
    is_sole_proprietor: initialData.is_sole_proprietor ?? false,
    address_street: initialData.address_street || '',
    address_city: initialData.address_city || '',
    address_state: initialData.address_state || '',
    address_postal_code: initialData.address_postal_code || ''
  })

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.legal_business_name.trim()) {
      toast.error('Please enter your legal business name.')
      return
    }

    if (!formData.is_sole_proprietor && !formData.ein.trim()) {
      toast.error('Please enter your Federal EIN or check Sole Proprietorship.')
      return
    }

    if (!formData.address_street.trim() || !formData.address_city.trim() || !formData.address_state.trim()) {
      toast.error('Please enter your complete business street address.')
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/client/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legal_business_name: formData.legal_business_name.trim(),
          business_type: formData.business_type,
          ein: formData.is_sole_proprietor ? null : formData.ein.trim(),
          is_sole_proprietor: formData.is_sole_proprietor,
          address_street: formData.address_street.trim(),
          address_city: formData.address_city.trim(),
          address_state: formData.address_state.trim(),
          address_postal_code: formData.address_postal_code.trim(),
          submit_carrier_verification: true
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSubmitted(true)
        toast.success('Carrier 10DLC registration submitted successfully!')
        if (onSuccess) onSuccess()
      } else {
        toast.error(data.error || 'Failed to submit carrier registration.')
      }
    } catch {
      toast.error('Network error submitting carrier registration.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 dark:text-zinc-100">
              {submitted ? 'Carrier Registration Submitted!' : `Welcome to ${planTierName}! Carrier Setup`}
            </span>
          </div>
        </div>
      }
      description={
        submitted
          ? 'Your dedicated business line is now queued for A2P 10DLC brand approval.'
          : 'US wireless carriers (Verizon, AT&T, T-Mobile) require 1-time 10DLC registration so your 3-second missed-call text-backs deliver reliably and are never filtered as spam.'
      }
    >
      {submitted ? (
        <div className="py-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Application Under Carrier Review
            </h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              Our carrier team has queued your brand with TCR. In the meantime, your online booking link and mobile field portal are 100% active immediately.
            </p>
          </div>
          <div className="pt-2">
            <Button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-6 py-2 rounded-xl"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Legal Business Name / DBA *
              </Label>
              <Input
                required
                placeholder="e.g. Austin Pro Plumbing LLC"
                value={formData.legal_business_name}
                onChange={(e) => setFormData({ ...formData, legal_business_name: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Business Type
              </Label>
              <select
                value={formData.business_type}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
                className="mt-1 w-full h-9 rounded-md border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs text-slate-900 dark:text-zinc-100 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="llc">LLC (Limited Liability Co)</option>
                <option value="corporation">Corporation (C-Corp / S-Corp)</option>
                <option value="sole_proprietorship">Sole Proprietorship</option>
                <option value="partnership">Partnership</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  Federal EIN / Tax ID
                </Label>
                <label className="flex items-center gap-1 text-[10.5px] text-slate-500 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_sole_proprietor}
                    onChange={(e) => setFormData({ ...formData, is_sole_proprietor: e.target.checked })}
                    className="rounded text-blue-600 h-3 w-3"
                  />
                  <span>Sole Prop (No EIN)</span>
                </label>
              </div>
              <Input
                placeholder="12-3456789"
                disabled={formData.is_sole_proprietor}
                value={formData.is_sole_proprietor ? '' : formData.ein}
                onChange={(e) => setFormData({ ...formData, ein: e.target.value })}
                className="mt-1 text-xs font-mono disabled:opacity-50"
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                Physical Street Address *
              </Label>
              <Input
                required
                placeholder="123 Trade Way, Suite 100"
                value={formData.address_street}
                onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                City *
              </Label>
              <Input
                required
                placeholder="Austin"
                value={formData.address_city}
                onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  State *
                </Label>
                <Input
                  required
                  placeholder="TX"
                  maxLength={2}
                  value={formData.address_state}
                  onChange={(e) => setFormData({ ...formData, address_state: e.target.value.toUpperCase() })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                  ZIP Code *
                </Label>
                <Input
                  required
                  placeholder="78701"
                  maxLength={10}
                  value={formData.address_postal_code}
                  onChange={(e) => setFormData({ ...formData, address_postal_code: e.target.value })}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 cursor-pointer font-medium"
            >
              I&apos;ll do this later in Settings
            </button>

            <Button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Submit for Carrier Registration</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
