import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  actions?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  className,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5",
        className
      )}
      {...props}
    >
      <div className="space-y-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {subtitle}
          </div>
        )}
      </div>

      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
          {actions}
          {children}
        </div>
      )}
    </div>
  )
}
