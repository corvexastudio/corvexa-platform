'use client'

import React from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  className?: string
  showCloseButton?: boolean
}

/**
 * Standard Drawer primitive with slide-over panel behaviors,
 * backdrop blur, and scrollable container body.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  side = 'right',
  className,
  showCloseButton = true
}: DrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        showCloseButton={showCloseButton}
        className={cn(
          'bg-[#0D1322] border-zinc-800 text-white p-5 sm:p-6 shadow-2xl flex flex-col justify-between overflow-y-auto',
          className
        )}
      >
        <div className="space-y-4">
          {(title || description) && (
            <SheetHeader className="space-y-1.5 pb-3 border-b border-zinc-800/70">
              {title && (
                <SheetTitle className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  {title}
                </SheetTitle>
              )}
              {description && (
                <SheetDescription className="text-xs text-zinc-400 leading-relaxed">
                  {description}
                </SheetDescription>
              )}
            </SheetHeader>
          )}

          <div className="py-2">{children}</div>
        </div>

        {footer && (
          <SheetFooter className="pt-4 border-t border-zinc-800/70 flex items-center justify-end gap-2">
            {footer}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
