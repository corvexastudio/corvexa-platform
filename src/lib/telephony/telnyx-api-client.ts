/**
 * ==============================================================================
 * TELNYX V2 API CLIENT — NUMBER SEARCH & NUMBER ORDERS
 * ==============================================================================
 * Official Telnyx v2 REST API integration for:
 * - GET  /v2/available_phone_numbers (Number Search)
 * - POST /v2/number_orders           (Purchase / Provisioning)
 * - GET  /v2/number_orders/:id       (Order Status Inspection)
 * - GET  /v2/number_orders?filter    (Crash / Timeout Reconciliation)
 * ==============================================================================
 */

export interface TelnyxSearchNumbersOptions {
  areaCode?: string
  countryCode?: string
  limit?: number
  features?: string[]
}

export interface TelnyxAvailableNumber {
  phoneNumber: string
  recordType: string
  features: string[]
  locality?: string
  region?: string
  costInformation?: {
    upfrontCost?: string
    monthlyCost?: string
    currency?: string
  }
}

export interface TelnyxCreateOrderParams {
  phoneNumber: string
  customerReference: string
  connectionId?: string
  messagingProfileId?: string
}

export interface TelnyxSubNumberOrder {
  id: string
  phoneNumber: string
  status: 'pending' | 'success' | 'failure'
  requirementsMet?: boolean
}

export interface TelnyxNumberOrderResponse {
  orderId: string
  status: 'pending' | 'success' | 'failure'
  customerReference?: string
  phoneNumbers: TelnyxSubNumberOrder[]
  createdAt: string
  updatedAt?: string
}

export class TelnyxApiError extends Error {
  statusCode: number
  errorCode?: string

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string
  ) {
    super(message)
    this.name = 'TelnyxApiError'
    this.statusCode = statusCode
    this.errorCode = errorCode
  }
}

export interface TelnyxClientOptions {
  apiKey?: string
  baseUrl?: string
  fetchFn?: typeof fetch
}

export class TelnyxApiClient {
  private apiKey: string
  private baseUrl: string
  private fetchFn: typeof fetch

  constructor(options?: TelnyxClientOptions) {
    const isProduction =
      process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production'

    const envKey = process.env.TELNYX_API_KEY?.trim() || ''
    this.apiKey = options?.apiKey?.trim() || envKey
    this.baseUrl = (options?.baseUrl || 'https://api.telnyx.com/v2').replace(/\/+$/, '')
    this.fetchFn = options?.fetchFn || globalThis.fetch

    if (!this.apiKey && isProduction) {
      console.error('[TELNYX SECURITY ERROR] TELNYX_API_KEY is not configured in production environment. Failing closed.')
    }
  }

  private getAuthHeaders(): Record<string, string> {
    if (!this.apiKey) {
      const isProduction =
        process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production'
      if (isProduction) {
        throw new TelnyxApiError('TELNYX_API_KEY is not configured in production environment', 500, 'AUTH_MISSING')
      }
      throw new TelnyxApiError('TELNYX_API_KEY is missing from environment', 500, 'AUTH_MISSING')
    }

    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'CaptoDesk-Telephony/1.0'
    }
  }

  /**
   * Search available phone numbers via GET /v2/available_phone_numbers
   */
  async searchAvailableNumbers(options?: TelnyxSearchNumbersOptions): Promise<TelnyxAvailableNumber[]> {
    const headers = this.getAuthHeaders()
    const query = new URLSearchParams()

    query.set('filter[country_code]', options?.countryCode || 'US')
    query.set('filter[phone_number_type]', 'local')
    query.set('filter[limit]', String(options?.limit || 5))

    if (options?.areaCode) {
      const cleanCode = options.areaCode.replace(/\D/g, '')
      if (cleanCode.length === 3) {
        query.set('filter[national_destination_code]', cleanCode)
      }
    }

    // Required features for CaptoDesk operations
    const features = options?.features || ['sms', 'voice']
    for (const f of features) {
      query.append('filter[features][]', f)
    }

    const url = `${this.baseUrl}/available_phone_numbers?${query.toString()}`

    const res = await this.fetchFn(url, {
      method: 'GET',
      headers
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const detail = body?.errors?.[0]?.detail || body?.message || `HTTP ${res.status} search error`
      const code = body?.errors?.[0]?.code || 'SEARCH_ERROR'
      throw new TelnyxApiError(detail, res.status, code)
    }

    const items = Array.isArray(body?.data) ? body.data : []
    return items.map((item: any) => {
      const feats = Array.isArray(item.features)
        ? item.features.map((f: any) => (typeof f === 'string' ? f : f?.name || ''))
        : []

      const localityInfo = item.region_information?.find((r: any) => r.region_type === 'locality')
      const regionInfo = item.region_information?.find((r: any) => r.region_type === 'state')

      return {
        phoneNumber: item.phone_number,
        recordType: item.record_type || 'available_phone_number',
        features: feats.filter(Boolean),
        locality: localityInfo?.region_name || item.locality,
        region: regionInfo?.region_name || item.region,
        costInformation: item.cost_information
          ? {
              upfrontCost: item.cost_information.upfront_cost,
              monthlyCost: item.cost_information.monthly_cost,
              currency: item.cost_information.currency
            }
          : undefined
      }
    })
  }

  /**
   * Submit a Number Order via POST /v2/number_orders
   */
  async createNumberOrder(params: TelnyxCreateOrderParams): Promise<TelnyxNumberOrderResponse> {
    const headers = this.getAuthHeaders()
    const url = `${this.baseUrl}/number_orders`

    const payload: Record<string, any> = {
      phone_numbers: [{ phone_number: params.phoneNumber }],
      customer_reference: params.customerReference
    }

    if (params.connectionId) {
      payload.connection_id = params.connectionId
    }
    if (params.messagingProfileId) {
      payload.messaging_profile_id = params.messagingProfileId
    }

    const res = await this.fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const detail = body?.errors?.[0]?.detail || body?.message || `HTTP ${res.status} order error`
      const code = body?.errors?.[0]?.code || 'ORDER_ERROR'
      throw new TelnyxApiError(detail, res.status, code)
    }

    const orderData = body?.data || {}
    const rawNumbers = Array.isArray(orderData.phone_numbers) ? orderData.phone_numbers : []

    const subOrders: TelnyxSubNumberOrder[] = rawNumbers.map((n: any) => ({
      id: n.id || '',
      phoneNumber: n.phone_number || params.phoneNumber,
      status: n.status || orderData.status || 'pending',
      requirementsMet: n.requirements_met
    }))

    return {
      orderId: orderData.id,
      status: orderData.status || 'pending',
      customerReference: orderData.customer_reference || params.customerReference,
      phoneNumbers: subOrders,
      createdAt: orderData.created_at || new Date().toISOString(),
      updatedAt: orderData.updated_at
    }
  }

  /**
   * Retrieve an existing Number Order by ID via GET /v2/number_orders/:id
   */
  async getNumberOrder(orderId: string): Promise<TelnyxNumberOrderResponse> {
    const headers = this.getAuthHeaders()
    const url = `${this.baseUrl}/number_orders/${encodeURIComponent(orderId)}`

    const res = await this.fetchFn(url, {
      method: 'GET',
      headers
    })

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      const detail = body?.errors?.[0]?.detail || body?.message || `HTTP ${res.status} fetch error`
      const code = body?.errors?.[0]?.code || 'FETCH_ORDER_ERROR'
      throw new TelnyxApiError(detail, res.status, code)
    }

    const orderData = body?.data || {}
    const rawNumbers = Array.isArray(orderData.phone_numbers) ? orderData.phone_numbers : []

    const subOrders: TelnyxSubNumberOrder[] = rawNumbers.map((n: any) => ({
      id: n.id || '',
      phoneNumber: n.phone_number || '',
      status: n.status || orderData.status || 'pending',
      requirementsMet: n.requirements_met
    }))

    return {
      orderId: orderData.id,
      status: orderData.status || 'pending',
      customerReference: orderData.customer_reference,
      phoneNumbers: subOrders,
      createdAt: orderData.created_at,
      updatedAt: orderData.updated_at
    }
  }

  /**
   * Reconciliation Helper: Query existing orders for a given customer_reference
   * via GET /v2/number_orders?filter[customer_reference]=...
   */
  async findExistingNumberOrderByCustomerReference(
    customerReference: string
  ): Promise<TelnyxNumberOrderResponse | null> {
    const headers = this.getAuthHeaders()
    const query = new URLSearchParams()
    query.set('filter[customer_reference]', customerReference)
    query.set('page[size]', '5')

    const url = `${this.baseUrl}/number_orders?${query.toString()}`

    const res = await this.fetchFn(url, {
      method: 'GET',
      headers
    })

    const body = await res.json().catch(() => ({}))
    if (!res.ok) return null

    const orders = Array.isArray(body?.data) ? body.data : []
    if (orders.length === 0) return null

    // Pick most recent active or successful order
    const match = orders.find((o: any) => o.status === 'success') || orders[0]
    const rawNumbers = Array.isArray(match.phone_numbers) ? match.phone_numbers : []

    return {
      orderId: match.id,
      status: match.status || 'pending',
      customerReference: match.customer_reference,
      phoneNumbers: rawNumbers.map((n: any) => ({
        id: n.id || '',
        phoneNumber: n.phone_number || '',
        status: n.status || match.status || 'pending',
        requirementsMet: n.requirements_met
      })),
      createdAt: match.created_at,
      updatedAt: match.updated_at
    }
  }

  /**
   * Poll order until settled (success or failure) or maximum attempts exhausted.
   */
  async pollNumberOrderUntilSettled(
    orderId: string,
    maxAttempts = 3,
    intervalMs = 800
  ): Promise<TelnyxNumberOrderResponse> {
    let order = await this.getNumberOrder(orderId)
    if (order.status !== 'pending') {
      return order
    }

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, intervalMs))
      order = await this.getNumberOrder(orderId)
      if (order.status !== 'pending') {
        return order
      }
    }

    return order
  }
}
