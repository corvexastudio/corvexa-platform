import React from 'react'
import Image from 'next/image'

interface BrandIconProps {
  className?: string
  size?: number
  priority?: boolean
}

/**
 * Official CaptoDesk App Icon (Squircle with vibrant C-arrow gradient)
 */
export function BrandIcon({ className = 'w-8 h-8', size = 32, priority = false }: BrandIconProps) {
  return (
    <div className={`relative shrink-0 overflow-hidden rounded-xl shadow-xs ${className}`}>
      <Image
        src="/brand/captodesk-icon-rounded.png"
        alt="CaptoDesk Icon"
        width={size}
        height={size}
        priority={priority}
        className="w-full h-full object-contain"
      />
    </div>
  )
}

interface BrandLogoProps {
  className?: string
  priority?: boolean
}

/**
 * Official CaptoDesk Full Logo Banner (Icon + CaptoDesk Typography + Tagline)
 */
export function BrandLogo({ className = 'h-9 w-auto', priority = false }: BrandLogoProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      <Image
        src="/brand/captodesk-logo.png"
        alt="CaptoDesk - Capture more leads. Close more jobs. Keep more customers."
        width={1024}
        height={341}
        priority={priority}
        className="h-full w-auto object-contain"
      />
    </div>
  )
}
