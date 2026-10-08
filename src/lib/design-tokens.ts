/**
 * CaptoDesk Canonical Design Tokens
 * 
 * Centralized, restrained design system for a practical field-service operating system.
 * Prioritizes high legibility, clean density, subtle borders, controlled radiuses,
 * and calm neutral surfaces.
 * 
 * References for maturity: Stripe, Linear, Square, ServiceTitan.
 */

export const designTokens = {
  // Surface / Background Palette (Neutral Zinc / Slate)
  surfaces: {
    app: '#09090b',          // Deep canvas background (zinc-950)
    subtle: '#121215',       // Secondary surfaces, list headers, tables
    card: '#18181b',         // Panels, grouped sections (zinc-900)
    cardHover: '#202024',    // Hover states for list rows
    elevated: '#27272a',     // Dropdowns, dialogs, popovers (zinc-800)
    overlay: 'rgba(0, 0, 0, 0.70)' // Dialog backdrop
  },

  // Border Palette (Subtle 1px architectural lines)
  borders: {
    subtle: '#27272a',       // zinc-800 (1px divider)
    default: '#3f3f46',      // zinc-700
    hover: '#52525b',        // zinc-600
    focus: '#2563eb',        // blue-600 focus ring
    danger: 'rgba(239, 68, 68, 0.35)',
    warning: 'rgba(245, 158, 11, 0.35)',
    success: 'rgba(16, 185, 129, 0.35)'
  },

  // Brand & Semantic Colors
  colors: {
    brand: {
      primary: '#2563eb',    // blue-600
      hover: '#1d4ed8',      // blue-700
      subtle: 'rgba(37, 99, 235, 0.10)',
      text: '#93c5fd'        // blue-300
    },
    success: {
      default: '#10b981',    // emerald-500
      subtle: 'rgba(16, 185, 129, 0.10)',
      text: '#6ee7b7'        // emerald-300
    },
    warning: {
      default: '#f59e0b',    // amber-500
      subtle: 'rgba(245, 158, 11, 0.10)',
      text: '#fcd34d'        // amber-300
    },
    danger: {
      default: '#ef4444',    // red-500
      subtle: 'rgba(239, 68, 68, 0.10)',
      text: '#fca5a5'        // red-300
    },
    neutral: {
      white: '#ffffff',
      textPrimary: '#f4f4f5',   // zinc-100
      textSecondary: '#a1a1aa', // zinc-400
      textMuted: '#71717a',     // zinc-500
      textDisabled: '#52525b'   // zinc-600
    }
  },

  // Typography Scale (Restrained, business-density scale)
  typography: {
    fontSans: 'var(--font-sans)',
    fontMono: 'var(--font-geist-mono)',
    sizes: {
      xs: '0.75rem',    // 12px (captions, tags, metadata)
      sm: '0.8125rem',  // 13px (compact table body, navigation)
      base: '0.875rem',  // 14px (standard UI text, inputs)
      md: '1rem',       // 16px (body text, list titles)
      lg: '1.125rem',   // 18px (card headings, section headers)
      xl: '1.25rem',    // 20px (page titles)
      '2xl': '1.5rem',  // 24px (metrics, statistics)
      '3xl': '1.875rem' // 30px (major hero stats)
    }
  },

  // Controlled Radius Scale (6px to 10px — avoid giant pill bubbles)
  radius: {
    sm: '0.25rem',    // 4px (badges, micro tags)
    md: '0.375rem',   // 6px (buttons, inputs)
    lg: '0.5rem',     // 8px (panels, dialogs, cards)
    xl: '0.625rem',   // 10px (main containers)
    '2xl': '0.75rem',  // 12px (large modal dialogs)
    full: '9999px'
  },

  // Restrained Shadows (Subtle elevation without floating glow)
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.5), 0 1px 2px -1px rgba(0, 0, 0, 0.5)',
    elevated: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.5)'
  },

  // Breakpoints
  breakpoints: {
    xs: '375px',
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
} as const

export type DesignTokens = typeof designTokens
