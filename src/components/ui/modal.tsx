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
          'bg-[#0D1322] border-zinc-800 text-white p-5 sm:p-6 shadow-2xl rounded-2xl',
          sizeClasses[size],
          className
        )}
      >
        {(title || description) && (
          <DialogHeader className="space-y-1.5 pb-2 border-b border-zinc-800/60">
            {title && (
              <DialogTitle className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
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

        <div className="py-2">{children}</div>

        {footer && (
          <DialogFooter className="pt-3 border-t border-zinc-800/60 flex items-center justify-end gap-2">
            {footer}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
