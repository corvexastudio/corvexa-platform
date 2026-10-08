'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { 
  MessageSquare, 
  Send, 
  PhoneCall, 
  Search, 
  User, 
  ChevronLeft, 
  Loader2, 
  RefreshCw, 
  Calendar,
  FileText,
  CreditCard,
  MapPin,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
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
  const [leadStatus, setLeadStatus] = useState<string | null>(null)
  
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
      setConvError('Unable to connect to inbox service. Check your connection.')
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

  // Load active lead status for the selected contact
  useEffect(() => {
    if (!activeConv?.contact_id) return
    supabase
      .from('leads')
      .select('status')
      .eq('contact_id', activeConv.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setLeadStatus(data?.status || null)
      })
  }, [activeConv?.contact_id, supabase])

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
    if (!error) {
      setLeadStatus(newStatus)
      toast.success(`Lead marked as ${newStatus}`)
    }
  }

  const filtered = conversations.filter(c => {
    const q = search.toLowerCase()
    return c.contact?.name?.toLowerCase().includes(q) || c.contact?.phone?.includes(q) || c.last_message_preview?.toLowerCase().includes(q)
  })

  return (
    <div className="h-[calc(100vh-7.5rem)] flex rounded-md border border-zinc-800 bg-zinc-950 overflow-hidden">
      
      {/* ── Left Pane: Conversation Directory (Hidden on mobile when viewing thread) ── */}
      <div className={cn(
        "w-full md:w-80 border-r border-zinc-800 flex flex-col bg-zinc-950 shrink-0",
        mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {/* Header & Search */}
        <div className="p-3 border-b border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Conversations
            </h1>
            <span className="text-xs text-zinc-400 tabular-nums">
              {conversations.length} total
            </span>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <Input
              placeholder="Search by name, phone, message..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-zinc-900 border-zinc-800 rounded-md"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
          {loadingConvs ? (
            <div className="p-3 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-1.5 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3 w-28 bg-zinc-800 rounded" />
                    <div className="h-3 w-10 bg-zinc-800/60 rounded" />
                  </div>
                  <div className="h-3 w-44 bg-zinc-800/40 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              No conversations found.
            </div>
          ) : (
            filtered.map(conv => (
              <ConversationRow
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConvId}
                onClick={() => {
                  setActiveConvId(conv.id)
                  setMobileViewThread(true)
                }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Center Pane: Active Message Thread ── */}
      <div className={cn(
        "flex-1 flex flex-col bg-zinc-950 min-w-0",
        !mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {activeConv ? (
          <>
            {/* Thread Header */}
            <div className="h-13 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0 bg-zinc-950">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  onClick={() => setMobileViewThread(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 text-zinc-400 hover:text-zinc-100 md:hidden"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-zinc-100 truncate">
                      {activeConv.contact?.name || activeConv.contact?.phone}
                    </span>
                    {activeConv.contact?.name && (
                      <span className="text-[11px] text-zinc-400 truncate">
                        {activeConv.contact.phone}
                      </span>
                    )}
                  </div>
                  {activeConv.contact?.address && (
                    <p className="text-[11px] text-zinc-400 truncate">
                      {activeConv.contact.address}
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={`tel:${activeConv.contact?.phone}`}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="Call customer"
                >
                  <PhoneCall className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">Call</span>
                </a>
                <Link
                  href={`/client/customers/${activeConv.contact_id}`}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
                  title="View customer record"
                >
                  <User className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>
              </div>
            </div>

            {/* Messages Scroll View */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-950"
            >
              {hasMoreOlder && (
                <div className="text-center py-1">
                  <button
                    onClick={handleLoadOlderMessages}
                    disabled={loadingOlder}
                    className="text-[11px] font-medium text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                  >
                    {loadingOlder ? 'Loading older messages...' : 'Load older messages'}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="h-10 w-48 rounded-md bg-zinc-900 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  No messages yet. Send a text below to initiate communication.
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Canned Snippets & Composer */}
            <div className="border-t border-zinc-800 p-3 bg-zinc-950 space-y-2">
              <CannedSnippetsBar onSelect={text => setReplyText(text)} />

              <form onSubmit={handleSendReply} className="flex gap-2">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type an SMS reply (or select a template above)..."
                  className="flex-1 h-9 text-xs bg-zinc-900 border-zinc-800 rounded-md"
                  disabled={sending}
                />
                <Button 
                  type="submit" 
                  disabled={!replyText.trim() || sending}
                  size="sm"
                  className="h-9 px-3 gap-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
                >
                  {sending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-zinc-400">
            Select a conversation on the left to read messages and reply.
          </div>
        )}
      </div>

      {/* ── Right Pane: Contextual Customer Dossier (Desktop >= 1024px) ── */}
      {activeConv && (
        <div className="hidden lg:flex w-72 border-l border-zinc-800 flex-col bg-zinc-950 p-4 space-y-4 shrink-0 overflow-y-auto">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Customer Dossier
            </div>
            <h3 className="text-sm font-semibold text-zinc-100 mt-1 truncate">
              {activeConv.contact?.name || 'Unsaved Caller'}
            </h3>
            <p className="text-xs text-zinc-400">{activeConv.contact?.phone}</p>
          </div>

          {/* Quick Workflow Actions */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Quick Actions
            </div>

            <Link
              href={`/client/calendar?contact_id=${activeConv.contact_id}`}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5 text-blue-400" />
              <span>Book Appointment</span>
            </Link>

            <Link
              href={`/client/quotes?contact_id=${activeConv.contact_id}`}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              <span>Create Estimate</span>
            </Link>

            <Link
              href={`/client/invoices?contact_id=${activeConv.contact_id}`}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <CreditCard className="h-3.5 w-3.5 text-amber-400" />
              <span>Create Invoice</span>
            </Link>
          </div>

          {/* Lead Lifecycle Status */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Lead Stage
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['new', 'contacted', 'booked', 'lost'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => handleStatusChange(st)}
                  className={cn(
                    'px-2 py-1 text-xs font-medium rounded-md border transition-colors capitalize text-center',
                    leadStatus === st
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Address */}
          {activeConv.contact?.address && (
            <div className="space-y-1 pt-2 border-t border-zinc-800">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Service Address
              </div>
              <p className="text-xs text-zinc-300">{activeConv.contact.address}</p>
            </div>
          )}

          {/* Full History Link */}
          <div className="pt-2 border-t border-zinc-800">
            <Link
              href={`/client/customers/${activeConv.contact_id}`}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <span>View full customer history</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}
