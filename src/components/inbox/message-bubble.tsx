import { Check, CheckCheck, AlertCircle, ExternalLink } from 'lucide-react'
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

export function MessageBubble({
  direction: rawDir,
  sender_type: rawSender,
  body: rawBody,
  created_at: rawCreatedAt,
  failure_reason: rawFailureReason,
  message
}: MessageBubbleProps) {
  const dir = rawDir ?? message?.direction ?? 'inbound'
  const senderType = rawSender ?? message?.sender_type ?? 'customer'
  const text = rawBody ?? message?.body ?? ''
  const createdAt = rawCreatedAt ?? message?.created_at ?? new Date().toISOString()
  const deliveryStatus = message?.delivery_status
  const failureReason = rawFailureReason ?? message?.failure_reason

  const isInbound = dir === 'inbound'
  const isAutoReply = senderType === 'system'

  return (
    <div
      className={cn(
        "flex flex-col min-w-0 max-w-[88%] sm:max-w-[75%]",
        isInbound ? "mr-auto items-start" : "ml-auto items-end"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs break-words [overflow-wrap:anywhere] select-text min-w-0 max-w-full",
          isInbound 
            ? "bg-white text-slate-900 border border-slate-200/80 rounded-bl-xs dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700/60" 
            : isAutoReply
              ? "bg-blue-50 text-blue-950 border border-blue-200/80 rounded-br-xs dark:bg-blue-950/40 dark:text-blue-100 dark:border-blue-900/60"
              : "bg-blue-600 text-white rounded-br-xs shadow-xs"
        )}
      >
        {renderMessageBody(text, isAutoReply, isInbound)}
      </div>

      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
        {isAutoReply && (
          <span className="font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider text-[9px] mr-0.5">
            Auto-Reply •
          </span>
        )}
        <span>
          {new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        {!isInbound && (
          <span
            className="inline-flex items-center text-slate-400 dark:text-zinc-500"
            title={
              deliveryStatus === 'failed' && failureReason
                ? `Delivery failed: ${failureReason}`
                : deliveryStatus || 'Sent'
            }
          >
            {deliveryStatus === 'delivered' ? (
              <CheckCheck className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
            ) : deliveryStatus === 'failed' ? (
              <span
                className="text-red-500 dark:text-red-400 text-[10px] font-bold inline-flex items-center gap-0.5 cursor-help"
                title={failureReason ? `Failed: ${failureReason}` : 'Delivery failed'}
              >
                <AlertCircle className="h-3 w-3" />
                Failed
              </span>
            ) : deliveryStatus === 'queued' ? (
              <span className="text-amber-600 dark:text-amber-400 text-[10px] font-semibold">Queued</span>
            ) : (
              <Check className="h-3 w-3" />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
