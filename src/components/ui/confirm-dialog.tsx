'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'default'
  loading?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * Standardized confirmation modal primitive.
 * Replaces browser `window.confirm()` calls across client pages.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm
}: ConfirmDialogProps) {
  const isDestructive = variant === 'destructive'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0D1322] border-zinc-800 text-white p-5 sm:p-6 shadow-2xl">
        <DialogHeader className="flex flex-col gap-2">
          {isDestructive && (
            <div className="h-10 w-10 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center text-red-400 mb-1">
              <AlertTriangle className="h-5 w-5" />
            </div>
          )}
          <DialogTitle className="text-base font-bold text-white tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={async () => {
              await onConfirm()
            }}
            className={cn(
              'text-xs font-semibold shadow-md',
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
            )}
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
