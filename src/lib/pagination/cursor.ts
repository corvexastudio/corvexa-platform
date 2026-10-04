/**
 * CaptoDesk High-Performance Keyset / Cursor Pagination Engine
 * Eliminates slow SQL OFFSET/LIMIT scans on high-cardinality tables.
 */

export interface CursorPayload {
  timestamp: string
  id: string
  [key: string]: any
}

export interface PaginatedResult<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
  totalCount?: number
}

/**
 * Encodes an operational record's sorting key and UUID into a safe URL cursor string
 */
export function encodeCursor(payload: CursorPayload): string {
  try {
    const json = JSON.stringify(payload)
    return Buffer.from(json, 'utf8').toString('base64url')
  } catch {
    return ''
  }
}

/**
 * Decodes a cursor string back into its constituent keyset parameters
 */
export function decodeCursor(cursorStr?: string | null): CursorPayload | null {
  if (!cursorStr || typeof cursorStr !== 'string') return null
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf8')
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.timestamp) {
      return parsed as CursorPayload
    }
    return null
  } catch {
    return null
  }
}

/**
 * In-memory Keyset Pagination helper for pre-filtered/enriched datasets
 */
export function paginateArrayKeyset<T extends { id: string; created_at?: string; timestamp?: string; [key: string]: any }>(
  items: T[],
  options: {
    limit?: number
    cursor?: string | null
    sortField?: string
    direction?: 'asc' | 'desc'
  } = {}
): PaginatedResult<T> {
  const limit = Math.max(1, Math.min(options.limit || 50, 100))
  const direction = options.direction || 'desc'
  const sortField = options.sortField || 'created_at'
  const cursor = decodeCursor(options.cursor)

  let filtered = [...items]

  if (cursor) {
    const cursorTime = new Date(cursor.timestamp).getTime()
    filtered = filtered.filter(item => {
      const itemVal = item[sortField] || item.created_at || item.timestamp
      const itemTime = itemVal ? new Date(itemVal).getTime() : 0

      if (direction === 'desc') {
        if (itemTime < cursorTime) return true
        if (itemTime === cursorTime && item.id < cursor.id) return true
        return false
      } else {
        if (itemTime > cursorTime) return true
        if (itemTime === cursorTime && item.id > cursor.id) return true
        return false
      }
    })
  }

  const pageItems = filtered.slice(0, limit)
  const hasMore = filtered.length > limit

  let nextCursor: string | null = null
  if (hasMore && pageItems.length > 0) {
    const last = pageItems[pageItems.length - 1]
    const lastVal = last[sortField] || last.created_at || last.timestamp || new Date().toISOString()
    nextCursor = encodeCursor({
      timestamp: lastVal,
      id: last.id
    })
  }

  return {
    items: pageItems,
    nextCursor,
    hasMore,
    totalCount: items.length
  }
}
