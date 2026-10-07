export interface ApiSuccessResponse<T> {
  success: true
  data: T
}

export interface ApiErrorResponse {
  success: false
  error: {
    message: string
    code?: string
    details?: any
  }
}

export interface ApiPaginatedResponse<T> {
  success: true
  data: T[]
  pagination: {
    hasMore: boolean
    nextCursor?: string | null
    total?: number
    count: number
  }
}

/**
 * Standardized success envelope for API handlers.
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return Response.json(
    {
      success: true,
      data
    },
    { status }
  )
}

/**
 * Standardized error envelope for API handlers.
 */
export function apiError(
  message: string,
  status: number = 400,
  code?: string,
  details?: any
) {
  return Response.json(
    {
      success: false,
      error: {
        message,
        ...(code ? { code } : {}),
        ...(details ? { details } : {})
      }
    },
    { status }
  )
}

/**
 * Standardized cursor-paginated response envelope.
 */
export function apiPaginated<T>(
  items: T[],
  pagination: {
    hasMore: boolean
    nextCursor?: string | null
    total?: number
  },
  status: number = 200
) {
  return Response.json(
    {
      success: true,
      data: items,
      pagination: {
        ...pagination,
        count: items.length
      }
    },
    { status }
  )
}
