'use client'

import React from 'react'
import Link from 'next/link'
import {
  Modal
} from '@/components/ui/modal'
import {
  Phone,
  MessageSquare,
  MapPin,
  ExternalLink,
  Key,
  FileText,
  Calendar,
  User,
  X
} from 'lucide-react'
import { formatCustomerName, formatStandardUsAddress } from '@/lib/booking/customer-input-formatter'
import { formatNationalUs } from '@/lib/telephony/phone-normalizer'
import { cn } from '@/lib/utils'

export interface CustomerDossierData {
  id?: string
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  gateCode?: string | null
  leadStatus?: string | null
  leadUrgency?: string | null
  leadSource?: string | null
  serviceNeeded?: string | null
  estimatedValue?: number | null
}

export interface CustomerDossierSheetProps {
  isOpen: boolean
  onClose: () => void
  customer: CustomerDossierData | null
  onUpdateLeadStatus?: (newStatus: string) => void
}

export function CustomerDossierSheet({
  isOpen,
  onClose,
  customer,
  onUpdateLeadStatus
}: CustomerDossierSheetProps) {
  if (!customer) return null

  const cleanPhone = (customer.phone || '').replace(/\D/g, '')
  const hasPhone = cleanPhone.length >= 10
  const hasAddress = Boolean(customer.address && customer.address.trim())

  // Extract gate code from notes if not explicitly separated
  let gateCode = customer.gateCode || null
  if (!gateCode && customer.notes) {
    const match = customer.notes.match(/gate\s*code[:\s#]*([a-zA-Z0-9#*]+)/i)
    if (match) gateCode = match[1]
  }

  const mapsUrl = hasAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(customer.address!.trim())}`
    : ''

  return (
    <Modal open={isOpen} onOpenChange={open => !open && onClose()} title="Customer Profile">
      <div className="space-y-4 py-1 text-xs">
        {/* Identity & Contact Actions */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block mb-0.5">
              Customer
            </span>
            <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100 truncate">
              {formatCustomerName(customer.name) || (hasPhone ? formatNationalUs(cleanPhone) : 'Unsaved Caller')}
            </h3>
            {hasPhone && (
              <p className="font-mono text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                {formatNationalUs(cleanPhone)}
              </p>
            )}
            {customer.email && (
              <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{customer.email}</p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            {hasPhone && (
              <>
                <a
                  href={`tel:${cleanPhone}`}
                  aria-label="Call customer"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs hover:bg-emerald-100"
                >
                  <Phone className="h-4 w-4" />
                </a>
                <Link
                  href={`/client/inbox?phone=${encodeURIComponent(cleanPhone)}${customer.id ? `&contact_id=${encodeURIComponent(customer.id)}` : ''}`}
                  aria-label="Text customer in Inbox"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-2xs hover:bg-blue-100"
                >
                  <MessageSquare className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Gate Code Banner */}
        {gateCode && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border-2 border-amber-500/40 text-amber-950 dark:text-amber-100 shadow-2xs">
            <Key className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider block text-amber-800 dark:text-amber-300">
                Gate / Access Code
              </span>
              <span className="font-mono font-black text-sm tracking-widest">{gateCode}</span>
            </div>
          </div>
        )}

        {/* Service Address */}
        {hasAddress && (
          <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-500" /> Service Location
              </span>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              >
                <span>Navigate</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <p className="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed font-medium">
              {formatStandardUsAddress(customer.address!)}
            </p>
          </div>
        )}

        {/* Lead Stage & Service Intelligence */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Lead Stage
            </span>
            {onUpdateLeadStatus ? (
              <select
                value={customer.leadStatus || 'new'}
                onChange={e => onUpdateLeadStatus(e.target.value)}
                className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-md text-xs font-bold py-1 px-1.5 text-slate-800 dark:text-zinc-100 cursor-pointer"
              >
                <option value="new">● New</option>
                <option value="contacted">● Contacted</option>
                <option value="booked">● Booked</option>
                <option value="lost">● Archived</option>
              </select>
            ) : (
              <span className="font-bold text-xs capitalize text-slate-800 dark:text-zinc-200">
                {customer.leadStatus || 'Active'}
              </span>
            )}
          </div>

          {customer.serviceNeeded && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800">
              <span className="text-[10px] text-slate-400 block font-medium">Requested Service</span>
              <span className="font-semibold text-slate-900 dark:text-zinc-100">{customer.serviceNeeded}</span>
            </div>
          )}

          {customer.leadSource && (
            <div className="pt-2 border-t border-slate-200/60 dark:border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400 font-medium">Source</span>
              <span className="font-semibold text-slate-800 dark:text-zinc-200 capitalize">
                {customer.leadSource === 'missed_call' ? '⚡ Missed Call Auto-Recovery' : customer.leadSource}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        {customer.notes && (
          <div className="space-y-1 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 block">
              Customer Notes
            </span>
            <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {customer.notes}
            </p>
          </div>
        )}

        {/* Quick Operations Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Link
            href={`/client/quotes?contact_id=${customer.id || ''}&customer_name=${encodeURIComponent(customer.name || '')}`}
            className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-xs font-bold hover:bg-slate-50 shadow-2xs"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span>+ Create Quote</span>
          </Link>

          <Link
            href={`/client/calendar?contact_id=${customer.id || ''}&customer_name=${encodeURIComponent(customer.name || '')}`}
            className="flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 text-xs font-bold hover:bg-slate-50 shadow-2xs"
          >
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span>+ Schedule Job</span>
          </Link>
        </div>

        {/* CRM Link */}
        {customer.id && (
          <div className="pt-1">
            <Link
              href={`/client/customers/${customer.id}`}
              className="w-full flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-semibold transition-colors"
            >
              <User className="h-3.5 w-3.5" />
              <span>View Full CRM Record</span>
              <ExternalLink className="h-3 w-3 opacity-60 ml-0.5" />
            </Link>
          </div>
        )}
      </div>
    </Modal>
  )
}
