'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Truck, AlertTriangle, Check, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import type { Crew } from '@/lib/crews/crew-manager'

interface ReassignCrewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: {
    id: string
    type: 'job' | 'appointment'
    title: string
    jobNumber?: string
    startTime: string
    endTime?: string | null
    crewId?: string | null
    customerName?: string | null
    customerPhone?: string | null
  } | null
  crews: Crew[]
  onSuccess: () => void
}

export function ReassignCrewModal({
  open,
  onOpenChange,
  item,
  crews,
  onSuccess
}: ReassignCrewModalProps) {
  const [selectedCrewId, setSelectedCrewId] = useState<string>('')
  const [notifyCrew, setNotifyCrew] = useState(true)
  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conflictWarning, setConflictWarning] = useState<string | null>(null)
  const [checkingConflict, setCheckingConflict] = useState(false)

  useEffect(() => {
    if (item) {
      setSelectedCrewId(item.crewId || 'unassigned')
      setConflictWarning(null)
    }
  }, [item, open])

  // Conflict check whenever selected crew changes
  useEffect(() => {
    if (!item || !selectedCrewId || selectedCrewId === 'unassigned') {
      setConflictWarning(null)
      return
    }

    let isMounted = true
    const checkConflict = async () => {
      setCheckingConflict(true)
      try {
        const res = await fetch('/api/client/crews/reassign', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkConflictOnly: true,
            crewId: selectedCrewId,
            startTime: item.startTime,
            endTime: item.endTime,
            jobId: item.type === 'job' ? item.id : undefined,
            appointmentId: item.type === 'appointment' ? item.id : undefined
          })
        })
        const data = await res.json()
        if (isMounted) {
          if (data.hasConflict) {
            setConflictWarning(`Overlap Warning: This crew already has "${data.conflictingTitle}" booked in this time window.`)
          } else {
            setConflictWarning(null)
          }
        }
      } catch {
        // Non-fatal
      } finally {
        if (isMounted) setCheckingConflict(false)
      }
    }

    checkConflict()
    return () => {
      isMounted = false
    }
  }, [selectedCrewId, item])

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!item) return

    setSaving(true)
    try {
      const payload: Record<string, any> = {
        crewId: selectedCrewId === 'unassigned' ? null : selectedCrewId,
        notifyCrew,
        notifyCustomer
      }

      if (item.type === 'job') {
        payload.jobId = item.id
      } else {
        payload.appointmentId = item.id
      }

      const res = await fetch('/api/client/crews/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (data.conflictWarning) {
          toast.warning(data.conflictWarning)
        } else {
          toast.success('Crew reassigned successfully')
        }
        onSuccess()
        onOpenChange(false)
      } else {
        toast.error(data.error || 'Failed to reassign crew')
      }
    } catch {
      toast.error('Network error while reassigning crew')
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Reassign Crew / Van"
      description={`Move ${item.jobNumber ? `Job #${item.jobNumber}` : item.title} to another crew or return to unassigned standby.`}
      size="md"
    >
      <form onSubmit={handleReassign} className="space-y-4 pt-1">
        {/* Item Summary Card */}
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 p-3 text-xs space-y-1">
          <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center justify-between">
            <span>{item.title}</span>
            {item.jobNumber && (
              <span className="text-[11px] font-mono text-slate-500">#{item.jobNumber}</span>
            )}
          </div>
          {item.customerName && (
            <div className="text-slate-500 dark:text-zinc-400">
              Customer: {item.customerName} {item.customerPhone ? `(${item.customerPhone})` : ''}
            </div>
          )}
        </div>

        {/* Crew Selector Radios */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
            Select Destination Crew
          </Label>
          <div className="space-y-2 max-h-56 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-xl p-2 bg-white dark:bg-zinc-900">
            {/* Unassigned Option */}
            <button
              type="button"
              onClick={() => setSelectedCrewId('unassigned')}
              className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors text-left ${
                selectedCrewId === 'unassigned'
                  ? 'bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 font-semibold text-slate-900 dark:text-white'
                  : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-600 dark:text-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-400" />
                <span>Unassigned Standby</span>
              </div>
              {selectedCrewId === 'unassigned' && <Check className="w-4 h-4 text-slate-700 dark:text-zinc-200" />}
            </button>

            {/* Active Crews */}
            {crews.map(c => {
              const isSelected = selectedCrewId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCrewId(c.id)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors text-left border ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 font-semibold'
                      : 'border-transparent hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: c.color_code }}
                    />
                    <div className="truncate">
                      <div className="font-medium text-slate-900 dark:text-zinc-100">{c.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                        {c.service_area ? `${c.service_area} • ` : ''}
                        {c.phone_number || (c.crew_lead ? `Lead: ${c.crew_lead.full_name}` : 'No phone')}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Double-Booking / Conflict Alert */}
        {conflictWarning && (
          <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>{conflictWarning}</span>
          </div>
        )}

        {/* SMS Notification Checkboxes */}
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-zinc-800">
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyCrew}
              onChange={e => setNotifyCrew(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Dispatch SMS alert to newly assigned Crew Lead</span>
          </label>

          {item.type === 'job' && item.customerPhone && (
            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyCustomer}
                onChange={e => setNotifyCustomer(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Send SMS update to customer ({item.customerName || 'Homeowner'})</span>
            </label>
          )}
        </div>

        {/* Modal Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200/80 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs h-9"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={saving || checkingConflict}
            className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Reassigning...
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Confirm Reassignment
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
