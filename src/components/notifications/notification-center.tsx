'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  PhoneCall,
  MessageSquare,
  Calendar,
  CreditCard,
  Star,
  AlertCircle,
  Trash2,
  ExternalLink,
  Loader2,
  Settings,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface InAppNotification {
  id: string
  org_id: string
  user_id?: string | null
  title: string
  message: string
  link?: string | null
  event_type?: string | null
  priority?: 'critical' | 'important' | 'normal' | 'low' | null
  is_read: boolean
  created_at: string
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHour / 24)

    if (diffSec < 45) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHour < 24) return `${diffHour}h ago`
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

function getEventIcon(eventType?: string | null) {
  switch (eventType) {
    case 'missed_call_recovered':
      return {
        icon: PhoneCall,
        bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      }
    case 'customer_reply':
      return {
        icon: MessageSquare,
        bgColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      }
    case 'new_booking':
      return {
        icon: Calendar,
        bgColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }
    case 'booking_cancelled':
    case 'booking_rescheduled':
      return {
        icon: Calendar,
        bgColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      }
    case 'payment_received':
      return {
        icon: CreditCard,
        bgColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      }
    case 'payment_failed':
      return {
        icon: AlertCircle,
        bgColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      }
    case 'review_received':
      return {
        icon: Star,
        bgColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      }
    default:
      return {
        icon: Bell,
        bgColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
      }
  }
}

export function NotificationCenter({ className }: { className?: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [markingAll, setMarkingAll] = useState<boolean>(false)
  const [orgId, setOrgId] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch notifications
  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const res = await fetch('/api/client/notifications?limit=30')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications || [])
        setUnreadCount(data.unread_count || 0)
      }
    } catch (err) {
      console.warn('[NOTIFICATIONS_FETCH_ERROR]', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Initial load & organization ID detection for Realtime subscription
  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && isMounted) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('org_id')
            .eq('id', user.id)
            .maybeSingle()

          if (profile?.org_id && isMounted) {
            setOrgId(profile.org_id)
          }
        }
      } catch {
        // non-blocking
      }
      if (isMounted) {
        fetchNotifications()
      }
    }

    init()

    // Polling interval every 25 seconds
    const interval = setInterval(() => {
      fetchNotifications(true)
    }, 25000)

    // Window focus refresh
    const onFocus = () => fetchNotifications(true)
    window.addEventListener('focus', onFocus)

    return () => {
      isMounted = false
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchNotifications, supabase])

  // Realtime subscription on notifications table
  useEffect(() => {
    if (!orgId) return

    const channel = supabase
      .channel(`inapp_notifications:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `org_id=eq.${orgId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRow = payload.new as InAppNotification
            setNotifications(prev => [newRow, ...prev.filter(n => n.id !== newRow.id)])
            setUnreadCount(prev => prev + 1)
            toast.info(newRow.title, {
              description: newRow.message,
              action: newRow.link ? {
                label: 'View',
                onClick: () => router.push(newRow.link!)
              } : undefined
            })
          } else {
            fetchNotifications(true)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, supabase, fetchNotifications, router])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)

    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)

    try {
      const res = await fetch('/api/client/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all_read: true })
      })

      if (!res.ok) {
        fetchNotifications(true)
      } else {
        toast.success('All notifications marked as read')
      }
    } catch {
      fetchNotifications(true)
    } finally {
      setMarkingAll(false)
    }
  }

  // Toggle single notification read / unread
  const handleToggleRead = async (e: React.MouseEvent, item: InAppNotification) => {
    e.stopPropagation()
    const targetState = !item.is_read

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === item.id ? { ...n, is_read: targetState } : n))
    )
    setUnreadCount(prev => Math.max(0, prev + (targetState ? -1 : 1)))

    try {
      await fetch(`/api/client/notifications/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: targetState })
      })
    } catch {
      fetchNotifications(true)
    }
  }

  // Delete notification
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const deletedItem = notifications.find(n => n.id === id)

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (deletedItem && !deletedItem.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }

    try {
      await fetch(`/api/client/notifications/${id}`, { method: 'DELETE' })
    } catch {
      fetchNotifications(true)
    }
  }

  // Clear all read notifications
  const handleClearRead = async () => {
    setNotifications(prev => prev.filter(n => !n.is_read))
    try {
      await fetch('/api/client/notifications?clear_all_read=true', { method: 'DELETE' })
      toast.success('Cleared read notifications')
    } catch {
      fetchNotifications(true)
    }
  }

  // Click on a notification item
  const handleItemClick = async (item: InAppNotification) => {
    if (!item.is_read) {
      // Mark as read in background
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, is_read: true } : n))
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      fetch(`/api/client/notifications/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true })
      }).catch(() => null)
    }

    setIsOpen(false)

    if (item.link) {
      router.push(item.link)
    }
  }

  const filteredNotifications = notifications.filter(n =>
    activeTab === 'unread' ? !n.is_read : true
  )

  return (
    <div className={cn('relative inline-flex items-center', className)} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-md border text-zinc-400 transition-colors cursor-pointer',
          isOpen
            ? 'bg-zinc-800 border-zinc-700 text-zinc-100'
            : 'bg-zinc-950 border-zinc-800 hover:border-zinc-700 hover:text-zinc-100 hover:bg-zinc-900'
        )}
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />

        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-zinc-950 tabular-nums animate-in zoom-in-50">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Flyout Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 sm:w-96 rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3 bg-zinc-900/90 backdrop-blur-xs">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-100">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 border border-blue-500/20">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Mark all as read"
                >
                  {markingAll ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <CheckCheck className="h-3 w-3 text-blue-400" />
                  )}
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close notifications"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 border-b border-zinc-800/60 px-3 py-1.5 bg-zinc-950/40 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                activeTab === 'all'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unread')}
              className={cn(
                'rounded px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer',
                activeTab === 'unread'
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 sm:max-h-96 overflow-y-auto divide-y divide-zinc-800/40">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-zinc-500 text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                <span>Loading notifications...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="p-3 rounded-full bg-zinc-800/50 text-zinc-500 mb-2.5 border border-zinc-800">
                  <BellOff className="h-5 w-5" />
                </div>
                <p className="text-xs font-medium text-zinc-300">
                  {activeTab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
                  {activeTab === 'unread'
                    ? "You're all caught up! Check back when new calls or bookings arrive."
                    : 'Missed-call alerts, customer replies, and bookings will appear here.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const iconMeta = getEventIcon(item.event_type)
                const IconComponent = iconMeta.icon

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'group relative flex items-start gap-3 p-3 transition-colors cursor-pointer',
                      item.is_read
                        ? 'bg-transparent hover:bg-zinc-800/40 opacity-75 hover:opacity-100'
                        : 'bg-blue-950/20 hover:bg-blue-950/30'
                    )}
                  >
                    {/* Unread indicator dot */}
                    {!item.is_read && (
                      <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                    )}

                    {/* Event Icon */}
                    <div
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border mt-0.5',
                        iconMeta.bgColor
                      )}
                    >
                      <IconComponent className="h-3.5 w-3.5" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-xs font-medium truncate',
                            item.is_read ? 'text-zinc-300' : 'text-zinc-100 font-semibold'
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 shrink-0 font-mono">
                          {formatRelativeTime(item.created_at)}
                        </span>
                      </div>

                      <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
                        {item.message}
                      </p>

                      {item.link && (
                        <div className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 mt-1.5 font-medium">
                          <span>Open details</span>
                          <ExternalLink className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Quick actions on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 self-start">
                      <button
                        type="button"
                        onClick={(e) => handleToggleRead(e, item)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        title={item.is_read ? 'Mark as unread' : 'Mark as read'}
                      >
                        <Check className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, item.id)}
                        className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Dismiss notification"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-800/80 px-3 py-2 bg-zinc-950/60 text-[11px] text-zinc-400">
            <Link
              href="/client/settings"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <Settings className="h-3 w-3" />
              <span>Notification settings</span>
            </Link>

            {notifications.some(n => n.is_read) && (
              <button
                type="button"
                onClick={handleClearRead}
                className="text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Clear read
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
