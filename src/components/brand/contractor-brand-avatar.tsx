'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/brand/initials'

export { getInitials }

export interface ContractorBrandAvatarProps {
  logoUrl?: string | null
  name?: string | null
  industry?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  rounded?: 'md' | 'lg' | 'xl' | '2xl' | 'full'
  alt?: string
}

const SIZE_CLASSES: Record<string, { container: string; text: string; img: string }> = {
  xs: { container: 'h-6 w-6', text: 'text-[10px]', img: 'h-6 w-6' },
  sm: { container: 'h-8 w-8', text: 'text-xs', img: 'h-8 w-8' },
  md: { container: 'h-10 w-10', text: 'text-sm font-bold', img: 'h-10 w-10' },
  lg: { container: 'h-14 w-14', text: 'text-lg font-extrabold', img: 'h-14 w-14' },
  xl: { container: 'h-20 w-20', text: 'text-2xl font-black', img: 'h-20 w-20' }
}

const ROUNDED_CLASSES: Record<string, string> = {
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  full: 'rounded-full'
}

const TRADE_GRADIENTS: Record<string, { gradient: string; text: string; border: string }> = {
  hvac: {
    gradient: 'from-blue-600 via-sky-600 to-cyan-500',
    text: 'text-white',
    border: 'border-blue-400/40'
  },
  plumbing: {
    gradient: 'from-blue-700 via-indigo-600 to-blue-500',
    text: 'text-white',
    border: 'border-blue-500/40'
  },
  electrical: {
    gradient: 'from-amber-500 via-orange-500 to-amber-600',
    text: 'text-black font-black',
    border: 'border-amber-400/50'
  },
  roofing: {
    gradient: 'from-slate-700 via-zinc-800 to-slate-900',
    text: 'text-white',
    border: 'border-slate-500/40'
  },
  landscaping: {
    gradient: 'from-emerald-600 via-green-600 to-teal-700',
    text: 'text-white',
    border: 'border-emerald-400/40'
  },
  cleaning: {
    gradient: 'from-teal-500 via-cyan-600 to-sky-600',
    text: 'text-white',
    border: 'border-teal-400/40'
  },
  pest_control: {
    gradient: 'from-purple-600 via-violet-700 to-indigo-800',
    text: 'text-white',
    border: 'border-purple-400/40'
  },
  handyman: {
    gradient: 'from-orange-600 via-amber-700 to-stone-800',
    text: 'text-white',
    border: 'border-orange-400/40'
  },
  general: {
    gradient: 'from-slate-800 via-slate-900 to-zinc-950',
    text: 'text-white',
    border: 'border-slate-600/40'
  }
}

export function ContractorBrandAvatar({
  logoUrl,
  name = 'Service Provider',
  industry = 'general',
  size = 'md',
  className,
  rounded = 'xl',
  alt
}: ContractorBrandAvatarProps) {
  const [imgError, setImgError] = useState(false)

  const sizeCfg = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const roundedClass = ROUNDED_CLASSES[rounded] || ROUNDED_CLASSES.xl
  const initials = useMemo(() => getInitials(name), [name])
  const tradeTheme = TRADE_GRADIENTS[industry?.toLowerCase() || 'general'] || TRADE_GRADIENTS.general

  const hasValidLogo = Boolean(logoUrl && !imgError && logoUrl.trim().length > 0)

  if (hasValidLogo) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xs flex items-center justify-center p-0.5',
          sizeCfg.container,
          roundedClass,
          className
        )}
      >
        <img
          src={logoUrl!}
          alt={alt || `${name || 'Contractor'} Logo`}
          onError={() => setImgError(true)}
          className={cn(
            'w-full h-full object-contain',
            roundedClass
          )}
          loading="lazy"
        />
      </div>
    )
  }

  // Monogram Avatar Fallback
  return (
    <div
      className={cn(
        'relative shrink-0 flex items-center justify-center bg-gradient-to-br shadow-2xs border select-none transition-transform',
        tradeTheme.gradient,
        tradeTheme.text,
        tradeTheme.border,
        sizeCfg.container,
        sizeCfg.text,
        roundedClass,
        className
      )}
      title={name || 'Service Provider'}
      aria-label={name || 'Service Provider'}
    >
      <span className="tracking-wider leading-none">
        {initials}
      </span>
    </div>
  )
}
