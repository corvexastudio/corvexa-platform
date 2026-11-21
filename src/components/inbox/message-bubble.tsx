import { Check, CheckCheck, AlertCircle, ExternalLink, RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MessageBubbleProps {
  id?: string
  direction?: 'inbound' | 'outbound'
  sender_type?: 'system' | 'owner' | 'customer'
  body?: string
  created_at?: string
  failure_reason?: string | null
  message?: {
    id: string
    direction: 'inbound' | 'outbound'
    sender_type?: 'system' | 'owner' | 'customer'
    body: string
    delivery_status?: string
    failure_reason?: string | null
    created_at: string
  }
  onRetry?: (messageId: string, body: string) => void
  isRetrying?: boolean
}

function renderMessageBody(text: string, isAutoReply: boolean, isInbound: boolean) {
  if (!text) return null
  
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)

  if (parts.length === 1) {
    return <span className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{text}</span>
  }

  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      let url = part
      let trailing = ''
      if (/[.,;:!?]$/.test(url)) {
        trailing = url.slice(-1)
        url = url.slice(0, -1)
      }

      const isManageLink = url.includes('/manage/') || url.includes('/t/')

      return (
        <span key={index} className="inline">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "break-all [word-break:break-all] underline underline-offset-2 font-mono text-[11px] sm:text-xs transition-opacity hover:opacity-85 inline-flex items-center gap-1 font-medium",
              isInbound
                ? "text-blue-600 dark:text-blue-400"
                : isAutoReply
                  ? "text-blue-800 dark:text-blue-300 font-semibold"
                  : "text-white/95 underline hover:text-white"
            )}
            title={isManageLink ? "Open customer management link" : url}
          >
            <span>{url}</span>
            <ExternalLink className="h-3 w-3 shrink-0 opacity-70 inline" />
          </a>
          {trailing && <span>{trailing}</span>}
        </span>
      )
    }
    return (
      <span key={index} className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {part}
      </span>
    )
  })
}

function formatFailureReason(reason?: string | null): string {
  if (!reason) return 'Carrier delivery failed. Tap retry to resend.'
  const lower = reason.toLowerCase()
  if (lower.includes('10dlc') || lower.includes('brand') || lower.includes('campaign')) {
    return 'Carrier filtered: 10DLC campaign registration required for US numbers.'
  }
  if (lower.includes('unreachable') || lower.includes('invalid') || lower.includes('landline')) {
    return 'Number unreachable or landline unable to receive SMS.'
  }
  if (lower.includes('quiet') || lower.includes('hours')) {
    return 'Blocked by TCPA quiet hours window (resend during 8 AM to 9 PM recipient time).'
  }
  if (lower.includes('opt_out') || lower.includes('stop')) {
    return 'Customer opted out with STOP. Cannot send marketing or automated texts.'
  }
  return reason
}

export function MessageBubble({
  direction: rawDir,
  sender_type: rawSender,
  body: rawBody,
  created_at: rawCreatedAt,
  failure_reason: rawFailureReason,
  message,
  onRetry,
  isRetrying
}: MessageBubbleProps) {
  const messageId = message?.id || rawBody || ''
  const dir = rawDir ?? message?.direction ?? 'inbound'
  const senderType = rawSender ?? message?.sender_type ?? 'customer'
  const text = rawBody ?? message?.body ?? ''
  const createdAt = rawCreatedAt ?? message?.created_at ?? new Date().toISOString()
  const deliveryStatus = message?.delivery_status
  const failureReason = rawFailureReason ?? message?.failure_reason

  const isInbound = dir === 'inbound'
  const isAutoReply = senderType === 'system'
  const isFailed = !isInbound && deliveryStatus === 'failed'

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 max-w-[88%] sm:max-w-[75%]",
        isInbound ? "mr-auto items-start" : "ml-auto items-end"
      )}
    >
      {/* Auto-Reply Header Pill */}
      {isAutoReply && (
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-1 px-1">
          <Zap className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span>Missed-Call Auto-Text</span>
        </div>
      )}

      {/* Message Bubble Body */}
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs break-words [overflow-wrap:anywhere] select-text min-w-0 max-w-full",
          isInbound 
            ? "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60" 
            : isAutoReply
              ? "bg-blue-50 text-blue-950 border border-blue-200/80 rounded-br-xs dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900/60"
              : isFailed
                ? "bg-rose-50 text-slate-900 border border-rose-300 dark:bg-rose-950/40 dark:text-rose-100 dark:border-rose-900/60 rounded-br-xs"
                : "bg-blue-600 text-white rounded-br-xs shadow-xs"
        )}
      >
        {renderMessageBody(text, isAutoReply, isInbound)}
      </div>

      {/* Failure Alert Banner & 1-Tap Retry Action */}
      {isFailed && (
        <div className="mt-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/50 dark:border-rose-900/70 dark:text-rose-200 text-[11px] max-w-full">
          <div className="flex items-start gap-1.5 min-w-0">
            <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-tight break-words">{formatFailureReason(failureReason)}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message?.id || '', text)}
              disabled={isRetrying}
              aria-label="Retry sending failed SMS"
              className="inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-[28px] px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-semibold shrink-0 cursor-pointer transition-colors disabled:opacity-50 shadow-2xs"
            >
              <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
              <span>{isRetrying ? 'Retrying...' : 'Retry SMS'}</span>
            </button>
          )}
        </div>
      )}

      {/* Meta Footer (Timestamp + Delivery Indicator) */}
      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
        <span>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!isInbound && (
          <span
            className="inline-flex items-center text-slate-400 dark:text-zinc-500"
            title={
              deliveryStatus === 'failed'
                ? `Delivery failed: ${failureReason || 'Carrier issue'}`
                : deliveryStatus || 'Sent'
            }
          >
            {deliveryStatus === 'delivered' ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCheck className="h-3 w-3" />
                <span>Delivered</span>
              </span>
            ) : deliveryStatus === 'failed' ? (
              <span className="text-rose-500 dark:text-rose-400 text-[10px] font-bold inline-flex items-center gap-0.5">
                <AlertCircle className="h-3 w-3" />
                Failed
              </span>
            ) : deliveryStatus === 'queued' ? (
              <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold">Queued</span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-slate-500 dark:text-zinc-400">
                <Check className="h-3 w-3" />
                <span>Sent</span>
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
