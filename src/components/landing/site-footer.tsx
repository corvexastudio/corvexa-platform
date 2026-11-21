import React from 'react'
import Link from 'next/link'
import { BrandIcon, BrandWordmark } from '@/components/brand/brand-logo'

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12 px-4 sm:px-6 lg:px-8 text-xs text-slate-500">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        
        {/* Brand Col (5 cols) */}
        <div className="md:col-span-5 space-y-3">
          <Link href="/" className="flex items-center gap-2.5">
            <BrandIcon className="w-7 h-7 rounded-md" size={28} />
            <BrandWordmark size="text-base" />
          </Link>
          <p className="text-xs text-slate-600 max-w-sm leading-relaxed">
            Online booking and live arrival dispatch built specifically for independent and growing home-service trade businesses.
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            Dallas, TX &bull; Proudly serving American trade contractors nationwide
          </p>
        </div>

        {/* Product Navigation (3 cols) */}
        <div className="md:col-span-3 space-y-2.5">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-900 tracking-wider block">
            Product &amp; Features
          </span>
          <ul className="space-y-2">
            <li>
              <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
                How It Works
              </a>
            </li>
            <li>
              <a href="#features" className="hover:text-slate-900 transition-colors">
                Core Capabilities
              </a>
            </li>
            <li>
              <a href="#demo" className="hover:text-slate-900 transition-colors">
                Interactive Product Demo
              </a>
            </li>
            <li>
              <a href="#who-its-for" className="hover:text-slate-900 transition-colors">
                Supported Trades
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-slate-900 transition-colors">
                Transparent Pricing
              </a>
            </li>
            <li>
              <a href="#faq" className="hover:text-slate-900 transition-colors">
                Frequently Asked Questions
              </a>
            </li>
          </ul>
        </div>

        {/* Account & Legal (4 cols) */}
        <div className="md:col-span-4 space-y-2.5">
          <span className="text-[11px] font-mono font-bold uppercase text-slate-900 tracking-wider block">
            Account &amp; Legal
          </span>
          <ul className="space-y-2">
            <li>
              <Link href="/client/login" className="hover:text-slate-900 font-semibold transition-colors">
                Contractor Login
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-slate-900 transition-colors">
                Contact &amp; Support
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-slate-900 transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>

      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} CaptoDesk. All rights reserved.</p>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>24/7 Booking</span>
          <span>&bull;</span>
          <span>Live Arrival GPS</span>
          <span>&bull;</span>
          <span>Driveway Checkout</span>
        </div>
      </div>
    </footer>
  )
}
