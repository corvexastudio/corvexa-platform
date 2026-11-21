'use client'

import React, { useState, useEffect } from 'react'
import { ArrowRight, Sparkles } from 'lucide-react'

interface StickyMobileCtaProps {
  onOpenClaim: () => void
}

export function StickyMobileCta({ onOpenClaim }: StickyMobileCtaProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      // Show when scrolled down past hero (roughly 450px)
      if (window.scrollY > 450) {
        setVisible(true)
      } else {
        setVisible(false)
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!visible) return null

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-300">
      <div className="truncate">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-bold text-slate-900 truncate">CaptoDesk Booking Link</p>
        </div>
        <p className="text-[11px] text-emerald-600 font-semibold">First 3 Jobs Free &bull; No Credit Card</p>
      </div>

      <button
        type="button"
        onClick={onOpenClaim}
        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition-all cursor-pointer"
      >
        <span>Get Free Link</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
