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
import { cn } from '@/lib/utils'

export interface ModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  showCloseButton?: boolean
}

const sizeClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl'
}

/**
 * Standard Modal primitive with consistent dark-mode styling,
 * responsive width scaling, and backdrop blur.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  showCloseButton = true
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn(
          'bg-zinc-900 border-zinc-800 text-zinc-100 p-5 sm:p-6 shadow-2xl rounded-2xl max-h-[90dvh] overflow-y-auto overscroll-contain',
          'max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:left-0 max-sm:right-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-full max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:p-4',
          sizeClasses[size],
          className
        )}
      >
        {/* Mobile drag handle indicator */}
        <div className="w-10 h-1 bg-zinc-700/80 rounded-full mx-auto -mt-1 mb-2.5 sm:hidden shrink-0" />

        {(title || description) && (
          <DialogHeader className="space-y-1.5 pb-2.5 border-b border-zinc-800/80">
            {title && (
              <DialogTitle className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription className="text-xs text-zinc-400 leading-relaxed">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="py-2.5">{children}</div>

        {footer && (
          <DialogFooter className="pt-3 border-t border-zinc-800/80 flex items-center justify-end gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
