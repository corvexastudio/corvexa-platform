'use client'

import React, { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Crew } from '@/lib/crews/crew-manager'

interface CrewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  crew?: Crew | null
  teamMembers: Array<{ id: string; full_name?: string | null; email?: string | null }>
  onSuccess: () => void
}

const COLOR_PRESETS = [
  { label: 'Blue', value: '#3B82F6' },
  { label: 'Emerald', value: '#10B981' },
  { label: 'Purple', value: '#8B5CF6' },
  { label: 'Amber', value: '#F59E0B' },
  { label: 'Rose', value: '#F43F5E' },
  { label: 'Indigo', value: '#6366F1' },
  { label: 'Cyan', value: '#06B6D4' },
  { label: 'Orange', value: '#F97316' },
]

export function CrewModal({
  open,
  onOpenChange,
  crew,
  teamMembers,
  onSuccess
}: CrewModalProps) {
  const [name, setName] = useState('')
  const [colorCode, setColorCode] = useState('#3B82F6')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [crewLeadId, setCrewLeadId] = useState<string>('none')
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (crew) {
      setName(crew.name || '')
      setColorCode(crew.color_code || '#3B82F6')
      setPhoneNumber(crew.phone_number || '')
      setServiceArea(crew.service_area || '')
      setCrewLeadId(crew.crew_lead_id || 'none')
      setSelectedMemberIds(Array.isArray(crew.member_ids) ? crew.member_ids : [])
    } else {
      setName('')
      setColorCode('#3B82F6')
      setPhoneNumber('')
      setServiceArea('')
      setCrewLeadId('none')
      setSelectedMemberIds([])
    }
  }, [crew, open])

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Crew or Van name is required')
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        colorCode,
        phoneNumber: phoneNumber.trim() || null,
        serviceArea: serviceArea.trim() || null,
        crewLeadId: crewLeadId === 'none' ? null : crewLeadId,
        memberIds: selectedMemberIds
      }

      const url = crew ? `/api/client/crews/${crew.id}` : '/api/client/crews'
      const method = crew ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(crew ? 'Crew updated successfully' : 'Crew created successfully')
        onSuccess()
        onOpenChange(false)
      } else {
        toast.error(data.error || 'Failed to save crew')
      }
    } catch {
      toast.error('Network error saving crew')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={crew ? 'Edit Crew / Van' : 'Add New Crew or Van'}
      description="Configure dispatch resource, assigned technician lead, route color, and service territory."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Crew Name & Color */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
              Crew / Van Name *
            </Label>
            <div className="relative">
              <Truck className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-zinc-500" />
              <Input
                placeholder="e.g. Van #1 (North Route)"
                value={name}
                onChange={e => setName(e.target.value)}
                className="pl-9 h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
              Direct Phone Number
            </Label>
            <Input
              type="tel"
              placeholder="+1 (555) 234-5678"
              value={phoneNumber}
              onChange={e => setPhoneNumber(e.target.value)}
              className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
            />
          </div>
        </div>

        {/* Color Palette Picker */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
            Calendar & Badge Color
          </Label>
          <div className="flex flex-wrap items-center gap-2">
            {COLOR_PRESETS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColorCode(c.value)}
                className="group relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all"
                style={{
                  backgroundColor: colorCode === c.value ? `${c.value}18` : undefined,
                  borderColor: colorCode === c.value ? c.value : 'transparent'
                }}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 border border-black/10"
                  style={{ backgroundColor: c.value }}
                >
                  {colorCode === c.value && <Check className="w-2.5 h-2.5 text-white" />}
                </span>
                <span className="text-slate-700 dark:text-zinc-300">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Service Area */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
            Service Territory / Area
          </Label>
          <Input
            placeholder="e.g. Downtown, North Metro, Zipcodes 90210, 90211"
            value={serviceArea}
            onChange={e => setServiceArea(e.target.value)}
            className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800"
          />
        </div>

        {/* Crew Lead */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
            Crew Lead Technician
          </Label>
          <Select value={crewLeadId} onValueChange={(val) => setCrewLeadId(val || 'none')}>
            <SelectTrigger className="h-9 text-xs bg-white dark:bg-zinc-950 border-slate-200 dark:border-zinc-800">
              <SelectValue placeholder="Select lead technician..." />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectItem value="none">No Lead Assigned</SelectItem>
              {teamMembers.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name || m.email || 'Team Member'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Crew Members Multi-Select */}
        {teamMembers.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-slate-700 dark:text-zinc-300">
              Assigned Crew Members ({selectedMemberIds.length} selected)
            </Label>
            <div className="max-h-36 overflow-y-auto border border-slate-200 dark:border-zinc-800 rounded-lg p-2 space-y-1 bg-slate-50/60 dark:bg-zinc-950/60">
              {teamMembers.map(m => {
                const isSelected = selectedMemberIds.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50'
                        : 'hover:bg-slate-100 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    <span>{m.full_name || m.email || 'Team Member'}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Modal Actions */}
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
            disabled={saving}
            className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Saving...
              </>
            ) : crew ? (
              'Save Changes'
            ) : (
              'Create Crew'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
