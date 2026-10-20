'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { FilterTabs } from '@/components/ui/filter-tabs'
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
  AlertCircle,
  Inbox as InboxIcon,
  Sparkles
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
  const queryClient = useQueryClient()
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [replyText, setReplyText] = useState('')
  const [search, setSearch] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all')
  const [sending, setSending] = useState(false)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(false)
  const [oldestCursor, setOldestCursor] = useState<string | null>(null)
  const [mobileViewThread, setMobileViewThread] = useState(false)
  const [leadStatus, setLeadStatus] = useState<string | null>(null)

  // React Query for instant in-memory conversation list retrieval
  const { data: convData, isLoading: loadingConvs, isError: isConvError, error: convQueryError, refetch: refetchConvs } = useQuery({
    queryKey: ['inbox-conversations'],
    queryFn: async () => {
      const res = await fetch('/api/client/inbox')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        if (res.status === 403 && (err.error?.includes('profile not registered') || err.error?.includes('not linked to an organization'))) {
          window.location.href = '/client/onboarding'
          return { conversations: [] }
        }
        throw new Error(err.error || 'Failed to load conversations.')
      }
      return res.json()
    },
    staleTime: 30 * 1000
  })

  const conversations: ConversationItem[] = convData?.conversations || []
  const convError = isConvError ? (convQueryError?.message || 'Failed to load conversations.') : null

  // Ensure active conversation is selected
  useEffect(() => {
    if (conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[0].id)
    }
  }, [conversations, activeConvId])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find(c => c.id === activeConvId)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior })
  }

  const loadConversations = useCallback(async () => {
    await refetchConvs()
  }, [refetchConvs])

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

        // Mark as read in background without race condition or stale closure
        supabase.from('conversations').update({ unread_count: 0 }).eq('id', convId).then(() => {
          queryClient.setQueryData<{ conversations?: ConversationItem[] }>(['inbox-conversations'], (old) => {
            if (!old?.conversations) return old
            return {
              ...old,
              conversations: old.conversations.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)
            }
          })
        })
      } else {
        toast.error('Failed to load message history.')
      }
    } catch {
      toast.error('Network error loading messages.')
    } finally {
      setLoadingMessages(false)
    }
  }, [supabase, queryClient])

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
      .then(({ data }: { data: any }) => {
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
    if (activeConvId) {
      loadMessages(activeConvId)
    }
  }, [activeConvId, loadMessages])

  // Realtime subscription for incoming messages
  useEffect(() => {
    if (!activeConvId) return

    const channel = supabase
      .channel(`inbox_messages_${activeConvId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConvId}`
        },
        (payload: any) => {
          const newMsg = payload.new as MessageItem
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          setTimeout(() => scrollToBottom('smooth'), 100)

          queryClient.setQueryData<{ conversations?: ConversationItem[] }>(['inbox-conversations'], (old) => {
            if (!old?.conversations) return old
            return {
              ...old,
              conversations: old.conversations.map(c => c.id === activeConvId ? {
                ...c,
                last_message_preview: newMsg.body,
                last_message_at: newMsg.created_at || new Date().toISOString()
              } : c)
            }
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConvId, supabase, queryClient])

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

          queryClient.setQueryData<{ conversations?: ConversationItem[] }>(['inbox-conversations'], (old) => {
            if (!old?.conversations) return old
            return {
              ...old,
              conversations: old.conversations.map(c => c.id === activeConv.id ? {
                ...c,
                last_message_preview: textToSend,
                last_message_at: new Date().toISOString()
              } : c)
            }
          })
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

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0)

  const filtered = conversations.filter(c => {
    if (filterTab === 'unread' && c.unread_count === 0) return false
    const q = search.toLowerCase()
    return c.contact?.name?.toLowerCase().includes(q) || c.contact?.phone?.includes(q) || c.last_message_preview?.toLowerCase().includes(q)
  })

  return (
    <div className="h-[calc(100dvh-3.5rem-3.5rem)] md:h-[calc(100vh-8.5rem)] flex md:rounded-2xl md:border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
      
      {/* ── Left Pane: Conversation Directory (Hidden on mobile when viewing thread) ── */}
      <div className={cn(
        "w-full md:w-80 border-r border-slate-200 dark:border-zinc-800 flex flex-col bg-white dark:bg-zinc-950 shrink-0",
        mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {/* Header, Filter Pills & Search */}
        <div className="p-3.5 border-b border-slate-200 dark:border-zinc-800 space-y-2.5 bg-slate-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <h1 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Conversations
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 dark:text-zinc-400 font-semibold tabular-nums">
                {conversations.length} total
              </span>
              <button
                type="button"
                onClick={loadConversations}
                disabled={loadingConvs}
                className="h-6 w-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
                title="Refresh conversations"
              >
                <RefreshCw className={cn("h-3 w-3", loadingConvs && "animate-spin")} />
              </button>
            </div>
          </div>

          {/* Quick Filter Segment */}
          <FilterTabs
            tabs={[
              { id: 'all', label: 'All', count: conversations.length },
              { id: 'unread', label: 'Unread', count: totalUnread > 0 ? totalUnread : undefined }
            ]}
            activeTab={filterTab}
            onChange={(val) => setFilterTab(val as 'all' | 'unread')}
            className="w-full justify-stretch grid grid-cols-2"
            size="sm"
            ariaLabel="Filter conversations"
          />

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
            <Input
              placeholder="Search customer, phone, text..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8.5 h-9 text-xs sm:text-sm bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-lg text-slate-900 dark:text-zinc-100"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800/60">
          {loadingConvs ? (
            <div className="p-3.5 space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-1.5 animate-pulse">
                  <div className="flex justify-between">
                    <div className="h-3 w-28 bg-slate-200 dark:bg-zinc-800 rounded" />
                    <div className="h-3 w-10 bg-slate-100 dark:bg-zinc-800/60 rounded" />
                  </div>
                  <div className="h-3 w-44 bg-slate-100/70 dark:bg-zinc-800/40 rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 dark:text-zinc-400">
              <InboxIcon className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="font-semibold text-slate-700 dark:text-zinc-300">No conversations found</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                {filterTab === 'unread' ? "You're caught up with all messages." : "Incoming customer messages will show up here."}
              </p>
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
        "flex-1 flex flex-col bg-slate-50/50 dark:bg-zinc-950 min-w-0",
        !mobileViewThread ? "hidden md:flex" : "flex"
      )}>
        {activeConv ? (
          <>
            {/* Thread Header */}
            <div className="h-14 border-b border-slate-200 dark:border-zinc-800 px-4 flex items-center justify-between shrink-0 bg-white dark:bg-zinc-950">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setMobileViewThread(false)}
                  className="flex h-10 w-10 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-900 md:hidden shrink-0 cursor-pointer"
                  aria-label="Back to conversations"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-zinc-100 truncate">
                      {activeConv.contact?.name || activeConv.contact?.phone}
                    </span>
                    {activeConv.contact?.name && (
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400 font-mono truncate">
                        {activeConv.contact.phone}
                      </span>
                    )}
                  </div>
                  {activeConv.contact?.address && (
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                      <span>{activeConv.contact.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Quick Actions in Thread Header */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`tel:${activeConv.contact?.phone}`}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:min-w-0 sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-colors shadow-2xs cursor-pointer"
                  title="Call customer directly"
                  aria-label="Call customer directly"
                >
                  <PhoneCall className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Call</span>
                </a>
                <Link
                  href={`/client/customers/${activeConv.contact_id}`}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] sm:min-w-0 sm:min-h-[38px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
                  title="View customer record"
                  aria-label="View customer profile"
                >
                  <User className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>
              </div>
            </div>

            {/* Messages Scroll View */}
            <div 
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/40 dark:bg-zinc-950"
            >
              {hasMoreOlder && (
                <div className="text-center py-1">
                  <button
                    type="button"
                    onClick={handleLoadOlderMessages}
                    disabled={loadingOlder}
                    className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors disabled:opacity-50"
                  >
                    {loadingOlder ? 'Loading older messages...' : 'Load older messages'}
                  </button>
                </div>
              )}

              {loadingMessages ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className="h-10 w-48 rounded-xl bg-slate-200 dark:bg-zinc-900 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500 dark:text-zinc-400 space-y-2">
                  <MessageSquare className="h-8 w-8 text-slate-300 dark:text-zinc-600 mx-auto" />
                  <p className="font-semibold text-slate-700 dark:text-zinc-300">No messages in this conversation yet</p>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-500">Send an SMS below to start the conversation.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <MessageBubble key={msg.id} message={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Canned Snippets & Composer */}
            <div className="border-t border-slate-200 dark:border-zinc-800 p-3 bg-white dark:bg-zinc-950 space-y-2.5 shrink-0 shadow-xs">
              <CannedSnippetsBar onSelect={text => setReplyText(text)} />

              <form onSubmit={handleSendReply} className="flex gap-2 items-center">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Type an SMS reply (or select template)..."
                  aria-label="Type an SMS reply"
                  className="flex-1 min-h-[44px] h-11 text-xs sm:text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 rounded-xl text-slate-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 px-3.5"
                  disabled={sending}
                />
                <Button 
                  type="submit" 
                  disabled={!replyText.trim() || sending}
                  size="touch"
                  aria-label="Send SMS message"
                  className="min-h-[44px] h-11 px-4 gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0 shadow-xs transition-colors cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="hidden sm:inline">Send</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-zinc-400 space-y-2">
            <InboxIcon className="h-10 w-10 text-slate-300 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Select a conversation</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-xs">
              Choose a customer on the left to review incoming missed calls, SMS history, or dispatch a quick reply.
            </p>
          </div>
        )}
      </div>

      {/* ── Right Pane: Contextual Customer Details (Desktop >= 1024px) ── */}
      {activeConv && (
        <div className="hidden lg:flex w-76 border-l border-slate-200 dark:border-zinc-800 flex-col bg-white dark:bg-zinc-950 p-4 space-y-4 shrink-0 overflow-y-auto">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Customer Dossier
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 mt-1 truncate">
              {activeConv.contact?.name || 'Unsaved Caller'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono mt-0.5">{activeConv.contact?.phone}</p>
          </div>

          {/* Quick Workflow Actions */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              1-Click Actions
            </div>

            <Link
              href={`/client/calendar?contact_id=${activeConv.contact_id}`}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-800 transition-all shadow-2xs"
            >
              <div className="h-6 w-6 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Calendar className="h-3.5 w-3.5" />
              </div>
              <span>Book Appointment</span>
            </Link>

            <Link
              href={`/client/quotes?contact_id=${activeConv.contact_id}`}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all shadow-2xs"
            >
              <div className="h-6 w-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <FileText className="h-3.5 w-3.5" />
              </div>
              <span>Create Estimate</span>
            </Link>

            <Link
              href={`/client/invoices?contact_id=${activeConv.contact_id}`}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 dark:hover:border-amber-800 transition-all shadow-2xs"
            >
              <div className="h-6 w-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <CreditCard className="h-3.5 w-3.5" />
              </div>
              <span>Create Invoice</span>
            </Link>
          </div>

          {/* Lead Lifecycle Status */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              Lead Stage
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(['new', 'contacted', 'booked', 'lost'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={leadStatus === st}
                  onClick={() => handleStatusChange(st)}
                  className={cn(
                    'px-2.5 py-2 min-h-[38px] text-xs font-semibold rounded-lg border transition-all capitalize text-center shadow-2xs cursor-pointer',
                    leadStatus === st
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs font-bold'
                      : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800'
                  )}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Customer Address */}
          {activeConv.contact?.address && (
            <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-zinc-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Service Address
              </div>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-slate-50 dark:bg-zinc-900 p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800">
                {activeConv.contact.address}
              </p>
            </div>
          )}

          {/* Full History Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 mt-auto">
            <Link
              href={`/client/customers/${activeConv.contact_id}`}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline transition-colors flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900"
            >
              <span>Full customer profile</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}
