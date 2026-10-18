/**
 * CaptoDesk RFC-4180 Compliant CSV Export Utility
 * Provides deterministic, browser-safe CSV generation with UTF-8 BOM encoding for Excel/Google Sheets.
 */

export interface CsvColumn<T> {
  header: string
  accessor: (item: T) => string | number | boolean | null | undefined
}

/**
 * Escapes a single CSV cell value according to RFC-4180 rules.
 */
function escapeCsvCell(value: any): string {
  if (value === null || value === undefined) {
    return ''
  }
  const str = String(value)
  // If string contains comma, double-quote, or newline, wrap in quotes and escape internal quotes
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/**
 * Serializes and triggers browser file download for a dataset.
 */
export function exportToCsv<T>(
  filenamePrefix: string,
  columns: CsvColumn<T>[],
  data: T[]
): void {
  if (typeof window === 'undefined') return

  const headers = columns.map(col => escapeCsvCell(col.header)).join(',')
  const rows = data.map(item =>
    columns.map(col => escapeCsvCell(col.accessor(item))).join(',')
  )

  // Prepend UTF-8 BOM (\uFEFF) so Excel reliably parses UTF-8 without garbled characters
  const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const dateStamp = new Date().toISOString().slice(0, 10)
  const filename = `${filenamePrefix}_${dateStamp}.csv`

  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Standard formatters for common field types
 */
export const CsvFormatters = {
  currency: (amount?: number | null): string => {
    if (amount === null || amount === undefined || isNaN(amount)) return '$0.00'
    return `$${Number(amount).toFixed(2)}`
  },
  date: (isoDate?: string | null): string => {
    if (!isoDate) return ''
    try {
      return new Date(isoDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return isoDate
    }
  },
  dateTime: (isoDate?: string | null): string => {
    if (!isoDate) return ''
    try {
      return new Date(isoDate).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    } catch {
      return isoDate
    }
  },
  status: (statusStr?: string | null): string => {
    if (!statusStr) return ''
    return statusStr.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  },
  boolean: (val?: boolean | null): string => {
    return val ? 'Yes' : 'No'
  }
}
