/**
 * CaptoDesk Production Structured Logger
 * Emits JSON logs with standard correlation identifiers and enforces zero-credential exposure.
 */

import { redactSensitiveData } from './redactor.ts'
import type { LogLevel, StructuredLogEntry } from './types.ts'

// In-memory circular buffer for live platform administrator log tailing
const LOG_BUFFER_SIZE = 250
const logBuffer: StructuredLogEntry[] = []

export interface LoggerContext {
  organization_id?: string | null
  request_id?: string | null
  event_id?: string | null
  automation_run_id?: string | null
  provider_event_id?: string | null
  orgId?: string | null
  requestId?: string | null
  eventId?: string | null
  automationRunId?: string | null
  providerEventId?: string | null
}

export class StructuredLogger {
  private context: {
    organization_id?: string | null
    request_id?: string | null
    event_id?: string | null
    automation_run_id?: string | null
    provider_event_id?: string | null
  }

  constructor(context: LoggerContext = {}) {
    this.context = {
      organization_id: context.organization_id || context.orgId || null,
      request_id: context.request_id || context.requestId || null,
      event_id: context.event_id || context.eventId || null,
      automation_run_id: context.automation_run_id || context.automationRunId || null,
      provider_event_id: context.provider_event_id || context.providerEventId || null
    }
  }

  child(additionalContext: Partial<LoggerContext>): StructuredLogger {
    return new StructuredLogger({
      ...this.context,
      ...additionalContext
    })
  }

  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, any>,
    err?: Error | any
  ): StructuredLogEntry {
    const timestamp = new Date().toISOString()
    const sanitizedMeta = meta ? redactSensitiveData(meta) : undefined

    let errorObj: { name?: string; message: string; stack?: string } | undefined
    if (err) {
      errorObj = {
        name: err.name || 'Error',
        message: err.message || String(err),
        stack: err.stack ? err.stack.split('\n').slice(0, 4).join('\n') : undefined
      }
    }

    const entry: StructuredLogEntry = {
      timestamp,
      level,
      message,
      organization_id: this.context.organization_id || undefined,
      request_id: this.context.request_id || undefined,
      event_id: this.context.event_id || undefined,
      automation_run_id: this.context.automation_run_id || undefined,
      provider_event_id: this.context.provider_event_id || undefined,
      duration_ms: meta?.duration_ms,
      status_code: meta?.status_code,
      error: errorObj,
      metadata: sanitizedMeta
    }

    // Append to in-memory circular ring buffer
    logBuffer.unshift(entry)
    if (logBuffer.length > LOG_BUFFER_SIZE) {
      logBuffer.pop()
    }

    // Structured JSON stdout emission
    const jsonOutput = JSON.stringify(entry)
    if (level === 'error' || level === 'fatal') {
      console.error(jsonOutput)
    } else if (level === 'warn') {
      console.warn(jsonOutput)
    } else {
      console.log(jsonOutput)
    }

    return entry
  }

  debug(message: string, meta?: Record<string, any>): StructuredLogEntry {
    return this.log('debug', message, meta)
  }

  info(message: string, meta?: Record<string, any>): StructuredLogEntry {
    return this.log('info', message, meta)
  }

  warn(message: string, meta?: Record<string, any>): StructuredLogEntry {
    return this.log('warn', message, meta)
  }

  error(message: string, err?: Error | any, meta?: Record<string, any>): StructuredLogEntry {
    return this.log('error', message, meta, err)
  }

  fatal(message: string, err?: Error | any, meta?: Record<string, any>): StructuredLogEntry {
    return this.log('fatal', message, meta, err)
  }
}

/**
 * Creates a configured structured logger instance with initial correlation IDs
 */
export function createStructuredLogger(context: LoggerContext = {}): StructuredLogger {
  return new StructuredLogger(context)
}

/**
 * Retrieves recently captured structured logs with optional filtering for Admin UI
 */
export function getRecentStructuredLogs(filters?: {
  level?: string
  organization_id?: string
  request_id?: string
  query?: string
  limit?: number
}): StructuredLogEntry[] {
  let logs = [...logBuffer]

  if (filters?.level && filters.level !== 'all') {
    logs = logs.filter((l) => l.level === filters.level)
  }

  if (filters?.organization_id) {
    logs = logs.filter((l) => l.organization_id === filters.organization_id)
  }

  if (filters?.request_id) {
    logs = logs.filter((l) => l.request_id === filters.request_id)
  }

  if (filters?.query) {
    const q = filters.query.toLowerCase()
    logs = logs.filter(
      (l) =>
        l.message.toLowerCase().includes(q) ||
        l.request_id?.toLowerCase().includes(q) ||
        l.event_id?.toLowerCase().includes(q) ||
        l.automation_run_id?.toLowerCase().includes(q) ||
        l.provider_event_id?.toLowerCase().includes(q)
    )
  }

  const limit = filters?.limit || 100
  return logs.slice(0, limit)
}

/**
 * Default global structured logger
 */
export const defaultLogger = new StructuredLogger()
