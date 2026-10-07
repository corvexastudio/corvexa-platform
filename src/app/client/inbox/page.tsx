'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { MessageSquare, Send, PhoneCall, Search, User, ChevronLeft, Loader2, RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ConversationRow } from '@/components/inbox/conversation-row'
import { MessageBubble } from '@/components/inbox/message-bubble'
import { CannedSnippetsBar } from '@/components/inbox/canned-snippets'

interface ConversationItem {
  id: string
  org_id: string
  contact_id: string
  last_message_at: string
  last_message_preview?: string | null
  unread_count: number
  status: string
  contact: {
    id: string
    name?: string | null
    phone: string
    address?: string | null
  }
}

interface MessageItem {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  sender_type: 'system' | 'owner' | 'customer'
  body: string
  delivery_status: string
  created_at: string
}

export default function InboxPage() {
  const supabase = createClient()
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [convError, setConvError] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [oldestCursor, setOldestCursor] = useState<string | null>(null)
  const [mobileViewThread, setMobileViewThread] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === activeConvId)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const loadConversations = useCallback(async () => {
    setLoadingConvs(true)
    setConvError(null)
    try {
      const res = await fetch('/api/client/inbox')
      if (res.ok) {
        const data = await res.json()
        const convList: ConversationItem[] = data.conversations || []
        setConversations(convList)
        if (convList.length > 0 && !activeConvId) {
          setActiveConvId(convList[0].id)
        }
      } else {
        const err = await res.json().catch(() => ({}))
        setConvError(err.error || 'Failed to load conversations.')
      }
    } catch {
      setConvError('Unable to connect to inbox service. Check network connection.')
    } finally {
      setLoadingConvs(false)
    }
  }, [activeConvId])

  const loadMessages = useCallback(async (convId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/client/inbox/messages?conversation_id=${convId}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
        setHasMoreOlder(Boolean(data.hasMore))
        setOldestCursor(data.oldestCursor || null)
        setTimeout(() => scrollToBottom('auto'), 50)

        // Mark as read in background
        supabase.from('conversations').update({ unread_count: 0 }).eq('id', convId).then(() => {
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c))
        })
      } else {
        toast.error('Failed to load message history.')
      }
    } catch {
      toast.error('Network error loading messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [supabase])

  const handleLoadOlderMessages = async () => {
    if (!activeConvId || !oldestCursor || loadingOlder) return

    setLoadingOlder(true)
    const prevScrollHeight = scrollContainerRef.current?.scrollHeight || 0

    try {
      const res = await fetch(
        `/api/client/inbox/messages?conversation_id=${activeConvId}&limit=50&before=${encodeURIComponent(oldestCursor)}`
      )
      if (res.ok) {
        const data = await res.json()
        const older = data.messages || []
        setMessages(prev => [...older, ...prev])
        setHasMoreOlder(Boolean(data.hasMore))
        setOldestCursor(data.oldestCursor || null)

        // Maintain scroll position after prepending older messages
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight
            scrollContainerRef.current.scrollTop = newScrollHeight - prevScrollHeight
          }
        }, 30)
      } else {
        toast.error('Could not load older messages.')
      }
    } catch {
      toast.error('Network error loading older messages.')
    } finally {
      setLoadingOlder(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (activeConvId) {
      loadMessages(activeConvId)
    }
  }, [activeConvId, loadMessages])

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || !activeConv || !activeConv.contact?.phone || sending) return

    setSending(true)
    const textToSend = replyText.trim()
    setReplyText('')

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConv.id, to: activeConv.contact.phone, message: textToSend })
      })

      if (res.ok) {
        const { message } = await res.json()
        if (message) {
          setMessages(prev => [...prev, message])
          setTimeout(() => scrollToBottom('smooth'), 100)
        }
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'Failed to send text.')
        setReplyText(textToSend)
      }
    } catch {
      toast.error('Network error sending message.')
      setReplyText(textToSend)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: 'new' | 'contacted' | 'booked' | 'lost') => {
    if (!activeConv) return
    const { error } = await supabase.from('leads').update({ status: newStatus }).eq('contact_id', activeConv.contact_id)
    if (!error) toast.success(`Lead marked as ${newStatus}`)
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return c.contact?.name?.toLowerCase().includes(q) || c.contact?.phone?.includes(q) || c.last_message_preview?.toLowerCase().includes(q)
  })

  return (
    <div className="h-[calc(100vh-8.5rem)] flex rounded-2xl border border-zinc-800/80 bg-[#0B101B] overflow-hidden shadow-2xl">
      {/* Directory Column */}
      <div className={cn("w-full md:w-80 lg:w-96 border-r border-zinc-800/80 flex flex-col bg-[#0B101B]", mobileViewThread ? "hidden md:flex" : "flex")}>
        <div className="p-4 border-b border-zinc-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-extrabold text-white flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              2-Way Inbox
            </h1>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {conversations.length} Active
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Search conversations..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-zinc-900/90 border-zinc-800 text-xs rounded-xl text-zinc-100 placeholder:text-zinc-400"
            />
          </div>
        </div>

        {/* Directory List Viewport */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
          {loadingConvs ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
                  <Skeleton className="h-10 w-10 rounded-full bg-zinc-800/80 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28 bg-zinc-800/80" />
                    <Skeleton className="h-3 w-40 bg-zinc-800/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : convError ? (
            <div className="p-6 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
              <p className="text-xs font-semibold text-rose-300">{convError}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={loadConversations}
                className="text-xs border-zinc-700 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-200"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-300">
                {search ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                {search
                  ? `No customer chats match "${search}". Try searching by customer phone number.`
                  : 'When a caller reaches your line and misses you, CaptoDesk sends an immediate text. Customer replies will appear here.'}
              </p>
            </div>
          ) : (
            filtered.map(conv => (
              <ConversationRow
                key={conv.id}
                id={conv.id}
                name={conv.contact?.name}
                phone={conv.contact?.phone}
                lastMessage={conv.last_message_preview}
                lastMessageAt={conv.last_message_at}
                unreadCount={conv.unread_count}
                isSelected={conv.id === activeConvId}
                onClick={() => { setActiveConvId(conv.id); setMobileViewThread(true) }}
              />
            ))
          )}
        </div>
      </div>

      {/* Message Thread Column */}
      <div className={cn("flex-1 flex flex-col bg-[#080C14]", !mobileViewThread ? "hidden md:flex" : "flex")}>
        {activeConv ? (
          <>
            <div className="h-16 border-b border-zinc-800/80 px-4 sm:px-6 flex items-center justify-between bg-[#0B101B]/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileViewThread(false)} className="md:hidden p-1.5 rounded-lg bg-zinc-800 text-zinc-300">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                  {activeConv.contact?.name ? activeConv.contact.name.slice(0, 2).toUpperCase() : <User className="h-4 w-4" />}
                </div>
                <div>
                  <h2 className="font-bold text-sm text-white">{activeConv.contact?.name || 'Customer'}</h2>
                  <p className="text-xs text-zinc-400">{activeConv.contact?.phone}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a href={`tel:${activeConv.contact?.phone}`} className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-200 border border-zinc-700/60 transition-colors">
                  <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Call Cell</span>
                </a>
                <select onChange={(e) => handleStatusChange(e.target.value as any)} defaultValue="contacted" className="h-8 rounded-xl bg-zinc-800/90 border border-zinc-700/60 text-xs font-semibold text-zinc-200 px-2.5 focus:outline-none cursor-pointer">
                  <option value="new">Status: New</option>
                  <option value="contacted">Status: Contacted</option>
                  <option value="booked">Status: Booked</option>
                  <option value="lost">Status: Lost</option>
                </select>
              </div>
            </div>

            {/* Messages Scroll Container */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Load older messages button */}
              {hasMoreOlder && (
                <div className="text-center pb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={loadingOlder}
                    onClick={handleLoadOlderMessages}
                    className="h-8 px-4 text-xs font-semibold rounded-full border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white"
                  >
                    {loadingOlder ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-blue-400" />
                        Loading older messages...
                      </>
                    ) : (
                      'Load older messages'
                    )}
                  </Button>
                </div>
              )}

              {loadingMessages ? (
                <div className="space-y-4 p-4">
                  <div className="flex justify-start">
                    <Skeleton className="h-12 w-48 rounded-2xl bg-zinc-800/60" />
                  </div>
                  <div className="flex justify-end">
                    <Skeleton className="h-14 w-64 rounded-2xl bg-blue-950/40" />
                  </div>
                  <div className="flex justify-start">
                    <Skeleton className="h-10 w-40 rounded-2xl bg-zinc-800/60" />
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No message history recorded yet for this conversation.
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble key={msg.id} {...msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <CannedSnippetsBar onSelect={snip => setReplyText(snip)} />

            <form onSubmit={handleSendReply} className="p-3 sm:p-4 border-t border-zinc-800/80 bg-[#0B101B]/95 flex items-center gap-3">
              <Input
                placeholder="Type your SMS reply to customer..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                disabled={sending}
                className="flex-1 h-11 bg-zinc-900 border-zinc-800 text-xs sm:text-sm text-white rounded-xl focus:border-blue-500 placeholder:text-zinc-400"
              />
              <Button type="submit" disabled={sending || !replyText.trim()} className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 flex items-center gap-2">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="hidden sm:inline">{sending ? 'Sending...' : 'Send SMS'}</span>
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
            <div className="h-14 w-14 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-zinc-400 shadow-inner">
              <MessageSquare className="h-7 w-7 text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-white">Select a Conversation</h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-sm leading-relaxed">
              When a caller misses you on your business line, CaptoDesk auto-replies within seconds. Homeowner replies and active SMS chats will open here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
