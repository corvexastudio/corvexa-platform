/**
 * CaptoDesk Canonical Design Tokens
 * 
 * Centralized design tokens for colors, typography, surfaces, borders, and breakpoints.
 * Individual UI pages must reference these tokens or their mapped Tailwind classes
 * rather than inventing arbitrary one-off hex values.
 */

export const designTokens = {
  // Surface / Background Palette
  surfaces: {
    app: '#070A12',          // Deepest canvas background
    subtle: '#0B0F19',       // Nested containers, list rows
    card: '#0D1322',         // Standard dashboard & panel cards
    cardHover: '#131B2E',    // Interactive card hover
    elevated: '#172036',     // Popovers, dropdown menus, modals
    overlay: 'rgba(0, 0, 0, 0.75)' // Dialog backdrops
  },

  // Border Palette
  borders: {
    subtle: 'rgba(255, 255, 255, 0.08)',
    default: 'rgba(255, 255, 255, 0.12)',
    hover: 'rgba(255, 255, 255, 0.20)',
    focus: '#3B82F6',        // Blue focus ring
    danger: 'rgba(239, 68, 68, 0.30)',
    warning: 'rgba(245, 158, 11, 0.30)',
    success: 'rgba(16, 185, 129, 0.30)'
  },

  // Brand & Semantic Colors
  colors: {
    brand: {
      primary: '#2563EB',    // Blue-600
      hover: '#1D4ED8',      // Blue-700
      subtle: 'rgba(37, 99, 235, 0.12)',
      text: '#60A5FA'        // Blue-400
    },
    success: {
      default: '#10B981',    // Emerald-500
      subtle: 'rgba(16, 185, 129, 0.12)',
      text: '#34D399'        // Emerald-400
    },
    warning: {
      default: '#F59E0B',    // Amber-500
      subtle: 'rgba(245, 158, 11, 0.12)',
      text: '#FBBF24'        // Amber-400
    },
    danger: {
      default: '#EF4444',    // Red-500
      subtle: 'rgba(239, 68, 68, 0.12)',
      text: '#F87171'        // Red-400
    },
    neutral: {
      white: '#FFFFFF',
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
      textDisabled: '#475569'
    }
  },

  // Typography Scale
  typography: {
    fontSans: 'var(--font-sans)',
    fontMono: 'var(--font-geist-mono)',
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem' // 30px
    }
  },

  // Radius Scale
  radius: {
    sm: '0.375rem',   // 6px
    md: '0.5rem',     // 8px
    lg: '0.75rem',    // 12px
    xl: '1rem',       // 16px
    '2xl': '1.25rem', // 20px
    full: '9999px'
  },

  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px'
  }
} as const

export type DesignTokens = typeof designTokens
