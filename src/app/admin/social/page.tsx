'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { 
  Share2, 
  Send, 
  Sparkles, 
  Video, 
  Smartphone, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  Copy, 
  ExternalLink, 
  RefreshCw, 
  Calendar, 
  Sliders, 
  Check, 
  Radio, 
  Play, 
  FileText, 
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Trash2,
  CalendarCheck2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  PLATFORM_CONFIGS, 
  PREBUILT_CAMPAIGNS, 
  SocialPlatformId, 
  SocialCampaignPreset 
} from '@/lib/social/social-engine'

export default function AdminSocialPage() {
  const [activeTab, setActiveTab] = useState<'composer' | 'scheduler' | 'video_studio' | 'channels' | 'logs'>('scheduler')
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatformId[]>(['facebook', 'instagram', 'youtube', 'tiktok'])
  
  // Post Editor State
  const [postTitle, setPostTitle] = useState(PREBUILT_CAMPAIGNS[0].title)
  const [postContent, setPostContent] = useState(PREBUILT_CAMPAIGNS[0].caption)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [mediaUrl, setMediaUrl] = useState(PREBUILT_CAMPAIGNS[0].mediaUrl)
  const [ctaUrl, setCtaUrl] = useState('https://captodesk.com')
  const [devicePreviewMode, setDevicePreviewMode] = useState<'feed' | 'vertical'>('feed')

  // Execution & Loading States
  const [publishing, setPublishing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [lastResults, setLastResults] = useState<any[] | null>(null)
  const [recentLogs, setRecentLogs] = useState<any[]>([])

  // Video Script State (for Short Video Studio)
  const [activeVideoPreset, setActiveVideoPreset] = useState<SocialCampaignPreset>(PREBUILT_CAMPAIGNS[3])
  const [copiedScript, setCopiedScript] = useState(false)

  // Scheduler & Hormozi Multiplier State
  const [scheduleSettings, setScheduleSettings] = useState({
    postsPerDay: 3,
    autoGenerateCreatives: true,
    includeVideos: true,
    includeImages: true,
    activePlatforms: ['facebook', 'instagram'] as SocialPlatformId[],
    timeSlots: [
      { id: 'morning', label: 'Morning Pre-Job (Crews Leaving Yard)', time: '06:30', preferredType: 'image' },
      { id: 'lunch', label: 'Lunch Break (Eating in the Truck)', time: '12:15', preferredType: 'video' },
      { id: 'evening', label: 'Evening Pack-Up (Teardown & Quotes)', time: '17:45', preferredType: 'image' }
    ]
  })
  const [scheduledQueue, setScheduledQueue] = useState<any[]>([])
  const [loadingSchedule, setLoadingSchedule] = useState(false)
  const [generatingQueue, setGeneratingQueue] = useState(false)
  const [multiplierPillar, setMultiplierPillar] = useState<'voicemail' | 'driveway' | 'booking' | 'reviews'>('voicemail')

  // Load scheduler queue on mount
  useEffect(() => {
    fetchSchedule()
  }, [])

  const fetchSchedule = async () => {
    try {
      setLoadingSchedule(true)
      const res = await fetch('/api/admin/social/schedule')
      const data = await res.json()
      if (data.success) {
        if (data.settings) setScheduleSettings(data.settings)
        if (data.queue) setScheduledQueue(data.queue)
      }
    } catch (e) {
      console.warn('Failed to fetch schedule', e)
    } finally {
      setLoadingSchedule(false)
    }
  }

  const handleUpdatePostsPerDay = async (num: number) => {
    const updated = { ...scheduleSettings, postsPerDay: num }
    setScheduleSettings(updated)
    try {
      await fetch('/api/admin/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_settings', settings: updated })
      })
      toast.success(`Cadence set to ${num} posts/day across ${updated.activePlatforms.length} platforms.`)
    } catch {
      toast.error('Failed to update cadence')
    }
  }

  const handleAutoGenerateQueue = async (days = 3) => {
    setGeneratingQueue(true)
    try {
      const res = await fetch('/api/admin/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_generate', days })
      })
      const data = await res.json()
      if (data.success && data.queue) {
        setScheduledQueue(data.queue)
        toast.success(`Generated & queued ${data.queue.length} posts and reels across next ${days} days!`)
      }
    } catch {
      toast.error('Failed to generate queue')
    } finally {
      setGeneratingQueue(false)
    }
  }

  const handleDispatchQueued = async (postId: string) => {
    try {
      toast.info('Dispatching scheduled post live...')
      const res = await fetch('/api/admin/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispatch_post', postId })
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Dispatched post live!')
        fetchSchedule()
      } else {
        toast.error(data.error || 'Failed to dispatch post')
      }
    } catch {
      toast.error('Error dispatching post')
    }
  }

  const handleDeleteQueued = async (postId: string) => {
    try {
      const res = await fetch('/api/admin/social/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_post', postId })
      })
      const data = await res.json()
      if (data.success && data.queue) {
        setScheduledQueue(data.queue)
        toast.success('Removed post from queue.')
      }
    } catch {
      toast.error('Failed to delete post')
    }
  }

  // Toggle platform selection
  const togglePlatform = (id: SocialPlatformId) => {
    setSelectedPlatforms(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id) 
        : [...prev, id]
    )
  }

  // Load a pre-built campaign preset
  const handleLoadPreset = (preset: SocialCampaignPreset) => {
    setPostTitle(preset.title)
    setPostContent(preset.caption)
    setMediaType(preset.mediaType)
    setMediaUrl(preset.mediaUrl)
    setSelectedPlatforms(preset.platforms)
    if (preset.mediaType === 'video') {
      setDevicePreviewMode('vertical')
    } else {
      setDevicePreviewMode('feed')
    }
    toast.success(`Loaded campaign: "${preset.title}"`)
  }

  // AI Generator Trigger
  const handleGenerateAI = async (format: 'feed' | 'video_short' = 'feed') => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/social/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: 'Missed Call Recovery & 24/7 Booking',
          trade: 'plumber',
          format
        })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setPostTitle(data.title)
        setPostContent(data.content)
        setMediaType(data.mediaType)
        if (data.videoScript) {
          setActiveVideoPreset(prev => ({
            ...prev,
            title: data.title,
            caption: data.content,
            videoScript: data.videoScript
          }))
          setDevicePreviewMode('vertical')
        }
        toast.success('✨ New campaign copy generated!')
      } else {
        toast.error(data.error || 'Failed to generate campaign')
      }
    } catch {
      toast.error('Network error contacting generation service')
    } finally {
      setGenerating(false)
    }
  }

  // Publish / Dispatch Multi-Cast
  const handlePublish = async (isTestSimulation = false) => {
    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one social media platform.')
      return
    }
    if (!postContent.trim()) {
      toast.error('Post content cannot be empty.')
      return
    }

    setPublishing(true)
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platforms: selectedPlatforms,
          title: postTitle,
          content: postContent,
          mediaUrl,
          mediaType,
          callToActionUrl: ctaUrl
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setLastResults(data.results)
        if (data.log) {
          setRecentLogs(prev => [data.log, ...prev])
        }
        toast.success(`🚀 Multi-Cast Broadcast Succeeded across ${selectedPlatforms.length} platform(s)!`)
      } else {
        toast.error(data.error || 'Dispatch encountered an error')
      }
    } catch {
      toast.error('Network error during social dispatch')
    } finally {
      setPublishing(false)
    }
  }

  const handleCopyVideoScript = () => {
    if (!activeVideoPreset.videoScript) return
    const text = activeVideoPreset.videoScript.scenes
      .map(s => `[${s.timestamp}] ${s.captionOverlay}\nVoiceover: "${s.voiceover}"\nVisual: ${s.visual}\n`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopiedScript(true)
    toast.success('Script copied to clipboard!')
    setTimeout(() => setCopiedScript(false), 2000)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                  Social Marketing &amp; Multi-Cast Engine
                </h1>
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono">
                  Engine Active
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
                Centralized command hub for publishing marketing campaigns across Facebook, Instagram, TikTok, YouTube Shorts, and LinkedIn.
              </p>
            </div>
          </div>
        </div>

        {/* Global Channel Status Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-medium">6 Platforms Ready</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center gap-2 text-xs">
            <span className="text-zinc-400">Mode:</span>
            <span className="text-blue-400 font-semibold font-mono">Auto Multi-Cast</span>
          </div>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 flex-wrap">
        <button
          onClick={() => setActiveTab('scheduler')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'scheduler'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Calendar className="h-3.5 w-3.5 text-amber-400" />
          <span>Auto-Pilot Scheduler (Daily Cadence)</span>
        </button>

        <button
          onClick={() => setActiveTab('composer')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'composer'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Multi-Cast Composer</span>
        </button>

        <button
          onClick={() => setActiveTab('video_studio')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'video_studio'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          <span>Short Video Studio (9:16)</span>
        </button>

        <button
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'channels'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          <span>Channel API Integrations</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'logs'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
          }`}
        >
          <Clock className="h-3.5 w-3.5" />
          <span>Dispatch History</span>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1.5: AUTO-PILOT SCHEDULER & CONTENT MULTIPLIER (HORMOZI ENGINE)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'scheduler' && (
        <div className="space-y-6">
          {/* 1. HORMOZI CONTENT MULTIPLIER PYRAMID */}
          <div className="rounded-xl border border-blue-500/30 bg-gradient-to-b from-[#0B132B] via-[#0A0E18] to-black p-5 sm:p-6 space-y-6 shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-400 text-black font-extrabold text-[11px] px-2.5 py-0.5">
                    Hormozi Volume Engine
                  </Badge>
                  <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>The Content Multiplier Architecture</span>
                  </h2>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  1 Core Message ➡️ 3 Hook Variations ➡️ 4 Multi-Cast Reel &amp; Short Channels = 12 Video Placements/Day + 8 Image Carousels (28 Touchpoints Daily).
                </p>
              </div>

              {/* Core Pillar Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400 font-medium">Core Message:</span>
                <select
                  value={multiplierPillar}
                  onChange={(e: any) => setMultiplierPillar(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 rounded-lg px-3 py-1.5 font-semibold focus:outline-none focus:border-blue-500"
                >
                  <option value="voicemail">Missed Calls ($1,200 Voicemail Loss)</option>
                  <option value="driveway">Driveway Apple Pay (Zero Checks)</option>
                  <option value="booking">24/7 Google &amp; IG Booking Calendar</option>
                  <option value="reviews">Automated 5-Star Google Reviews</option>
                </select>
              </div>
            </div>

            {/* VISUAL MULTIPLIER PYRAMID DIAGRAM */}
            <div className="space-y-4">
              {/* Level 1: Core Message */}
              <div className="max-w-md mx-auto text-center p-3.5 rounded-xl border border-blue-500/50 bg-blue-600/10 shadow-lg space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400">
                  Level 1 • The Core Message
                </span>
                <div className="text-sm font-extrabold text-white">
                  {multiplierPillar === 'voicemail' && '"82% of Homeowners Hang Up on Voicemail & Hire the Next Guy"'}
                  {multiplierPillar === 'driveway' && '"Never Wait 45 Days for Checks: Driveway Apple Pay"'}
                  {multiplierPillar === 'booking' && '"Lock in Emergency Jobs at 10 PM While You Sleep"'}
                  {multiplierPillar === 'reviews' && '"Hit #1 on Google Maps with 100% Automated 5-Star Reviews"'}
                </div>
              </div>

              {/* Connecting Lines */}
              <div className="h-4 w-0.5 bg-blue-500/40 mx-auto" />

              {/* Level 2: 3 Distinct Hook Angles */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-amber-400 uppercase tracking-wide">
                      Hook A • Curiosity &amp; Warning
                    </span>
                    <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-300">
                      Slot 1 • 06:30 AM
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-zinc-100">
                    &ldquo;NEVER answer this call when you&apos;re under a cast-iron sink or on a ladder.&rdquo;
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Targets contractors before leaving the yard. Stirs curiosity and addresses drop-tool accidents.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-red-400 uppercase tracking-wide">
                      Hook B • Financial Loss Aversion
                    </span>
                    <Badge variant="outline" className="text-[9px] border-red-500/40 text-red-300">
                      Slot 2 • 12:15 PM
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-zinc-100">
                    &ldquo;The $1,200 voicemail trap: why letting calls ring flushes jobs down the drain.&rdquo;
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Targets contractors during lunch in the truck. Hits direct financial pain and lost tickets.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-wide">
                      Hook C • Trade Reality &amp; Solution
                    </span>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/40 text-emerald-300">
                      Slot 3 • 05:45 PM
                    </Badge>
                  </div>
                  <div className="text-xs font-bold text-zinc-100">
                    &ldquo;10-Second Auto Text-Back: Lock in the job while your hands stay on the tools.&rdquo;
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Targets contractors during job teardown. Positions CaptoDesk as the immediate $0 free fix.
                  </p>
                </div>
              </div>

              {/* Connecting Lines */}
              <div className="h-4 w-0.5 bg-zinc-700 mx-auto" />

              {/* Level 3: 4 Multi-Cast Placement Channels */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/60 flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-zinc-200">Simultaneous Multi-Cast Distribution:</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-[10px]">
                    Instagram Reels (9:16)
                  </Badge>
                  <Badge className="bg-blue-600 text-white font-semibold text-[10px]">
                    Facebook Reels (9:16)
                  </Badge>
                  <Badge className="bg-black border border-cyan-400 text-cyan-300 font-semibold text-[10px]">
                    TikTok Business
                  </Badge>
                  <Badge className="bg-red-600 text-white font-semibold text-[10px]">
                    YouTube Shorts
                  </Badge>
                  <Badge className="bg-blue-700 text-white font-semibold text-[10px]">
                    Meta Photo Feeds (1:1)
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* 2. DAILY CADENCE & SCHEDULING CONTROLS */}
          <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-400" />
                  <span>Automated Daily Cadence &amp; Creative Generation</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Distributes posts across high-traffic contractor breaks to maximize reach without triggering spam throttles.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAutoGenerateQueue(3)}
                  disabled={generatingQueue}
                  className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-semibold gap-1.5 shadow-sm"
                >
                  <Sparkles className={`h-3.5 w-3.5 text-amber-300 ${generatingQueue ? 'animate-spin' : ''}`} />
                  <span>{generatingQueue ? 'Generating...' : '⚡ Auto-Generate Next 3 Days (9 Posts)'}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutoGenerateQueue(7)}
                  disabled={generatingQueue}
                  className="h-8.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <span>Auto-Queue 7 Days (21 Posts)</span>
                </Button>
              </div>
            </div>

            {/* Cadence Selection Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              {[
                { count: 1, label: '1 Post / Day', sub: 'Baseline Growth', tag: 'Safe' },
                { count: 2, label: '2 Posts / Day', sub: 'Morning + Evening', tag: 'Steady' },
                { count: 3, label: '3 Posts / Day', sub: 'Morning, Lunch & Evening', tag: 'Hormozi Model' },
                { count: 5, label: '5 Posts / Day', sub: 'Full Aggressive Multi-Cast', tag: 'High Scale' }
              ].map((c) => {
                const isSelected = scheduleSettings.postsPerDay === c.count
                return (
                  <button
                    key={c.count}
                    type="button"
                    onClick={() => handleUpdatePostsPerDay(c.count)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600/15 border-blue-500 text-white shadow-md'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-zinc-200">{c.label}</span>
                      <Badge className={`text-[9px] ${isSelected ? 'bg-blue-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {c.tag}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">{c.sub}</div>
                  </button>
                )
              })}
            </div>

            {/* Auto-Generation Feature Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200">Zero-EXIF Trade Photos</div>
                  <div className="text-[11px] text-zinc-500">Sanitized camera pixel arrays (Bypasses AI tags)</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200">9:16 Real B-Roll Reels</div>
                  <div className="text-[11px] text-zinc-500">Real trade footage + kinetic text overlays</div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-zinc-800/80 bg-zinc-900/30 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="font-semibold text-zinc-200">Voiceover &amp; Trending Beat</div>
                  <div className="text-[11px] text-zinc-500">Sequential contractor narration + beat (-1.2 dB)</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. UPCOMING CONTENT QUEUE */}
          <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] overflow-hidden space-y-0">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-4 w-4 text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Upcoming Scheduled Drip Queue ({scheduledQueue.filter(q => q.status === 'queued').length} Queued)
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchSchedule}
                disabled={loadingSchedule}
                className="h-7 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loadingSchedule ? 'animate-spin' : ''}`} />
                <span>Refresh Queue</span>
              </Button>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {scheduledQueue.length === 0 ? (
                <div className="p-10 text-center space-y-3">
                  <p className="text-xs text-zinc-500">Your scheduled content queue is currently empty.</p>
                  <Button
                    size="sm"
                    onClick={() => handleAutoGenerateQueue(3)}
                    disabled={generatingQueue}
                    className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold"
                  >
                    ⚡ Auto-Generate Next 3 Days of Content
                  </Button>
                </div>
              ) : (
                scheduledQueue.map((item) => {
                  const isQueued = item.status === 'queued'
                  const isVideo = item.mediaType === 'video'
                  return (
                    <div key={item.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-900/20 transition-colors">
                      {/* Left: Timing & Visual Type Badge */}
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-12 text-center pt-1">
                          {isVideo ? (
                            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-[10px] flex items-center justify-center gap-1 w-full">
                              <Video className="h-2.5 w-2.5" />
                              <span>REEL</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px] flex items-center justify-center gap-1 w-full">
                              <FileText className="h-2.5 w-2.5" />
                              <span>POST</span>
                            </Badge>
                          )}
                          <span className="text-[10px] text-zinc-500 uppercase font-mono block mt-1">
                            {item.slot}
                          </span>
                        </div>

                        {/* Middle: Content & Title */}
                        <div className="space-y-1 max-w-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-zinc-100">{item.title}</span>
                            <Badge variant="outline" className="text-[9px] text-zinc-400 border-zinc-700 capitalize">
                              {item.trade}
                            </Badge>
                            <span className="text-[11px] text-zinc-500">
                              {new Date(item.scheduledTime).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} at{' '}
                              {new Date(item.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                            {item.content}
                          </p>

                          <div className="flex items-center gap-2 pt-1 text-[10px] text-zinc-500">
                            <span>Platforms: {item.platforms.join(', ')}</span>
                            <span>•</span>
                            <a 
                              href={item.mediaUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-blue-400 hover:underline flex items-center gap-0.5"
                            >
                              <span>Preview Creative</span>
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Right: Status & Actions */}
                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <Badge 
                          className={
                            isQueued 
                              ? 'bg-amber-400/10 text-amber-300 border-amber-400/20 text-[10px]' 
                              : 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20 text-[10px]'
                          }
                        >
                          {isQueued ? 'QUEUED' : 'PUBLISHED'}
                        </Badge>

                        {isQueued && (
                          <Button
                            size="sm"
                            onClick={() => handleDispatchQueued(item.id)}
                            className="h-7 px-3 text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-semibold"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            <span>Post Now</span>
                          </Button>
                        )}

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteQueued(item.id)}
                          className="h-7 w-7 p-0 text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MULTI-CAST COMPOSER
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form & Platform Controls (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* 1. Target Platforms Selector */}
            <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Target Broadcast Channels ({selectedPlatforms.length} Selected)
                </Label>
                <button
                  type="button"
                  onClick={() => setSelectedPlatforms(['facebook', 'instagram', 'tiktok', 'youtube', 'linkedin', 'twitter'])}
                  className="text-[11px] text-blue-400 hover:underline font-medium"
                >
                  Select All
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {(Object.keys(PLATFORM_CONFIGS) as SocialPlatformId[]).map((pid) => {
                  const cfg = PLATFORM_CONFIGS[pid]
                  const isSelected = selectedPlatforms.includes(pid)
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => togglePlatform(pid)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                        isSelected 
                          ? 'bg-blue-500/10 border-blue-500/50 text-white shadow-xs' 
                          : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="h-2.5 w-2.5 rounded-full shrink-0" 
                          style={{ backgroundColor: cfg.color }}
                        />
                        <span>{cfg.displayName}</span>
                      </div>
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-zinc-600 font-mono">OFF</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Fast Campaign Presets */}
            <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-4.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  High-Converting Campaign Presets
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateAI('feed')}
                  disabled={generating}
                  className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
                >
                  <Sparkles className={`h-3.5 w-3.5 text-amber-400 ${generating ? 'animate-spin' : ''}`} />
                  <span>AI Generate New Post</span>
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PREBUILT_CAMPAIGNS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleLoadPreset(preset)}
                    className="text-left p-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-800/50 hover:border-zinc-700 transition-all text-xs group"
                  >
                    <div className="font-semibold text-zinc-200 group-hover:text-blue-400 transition-colors truncate">
                      {preset.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {preset.headline}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Post Content Editor */}
            <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-4.5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="post-title" className="text-xs font-semibold text-zinc-300">
                  Campaign Title / Internal Label
                </Label>
                <Input
                  id="post-title"
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                  placeholder="e.g. The 15-Second Missed Call Save"
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="post-content" className="text-xs font-semibold text-zinc-300">
                    Post Caption &amp; Hashtags
                  </Label>
                  <span className="text-[11px] font-mono text-zinc-400">
                    {postContent.length} chars
                  </span>
                </div>
                <textarea
                  id="post-content"
                  rows={8}
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-100 placeholder-zinc-500 font-sans focus:outline-hidden focus:ring-1 focus:ring-blue-500 leading-relaxed"
                  placeholder="Write your campaign hook, contractor pain points, value prop, and call to action..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-300">
                    Media Attachment
                  </Label>
                  <div className="flex items-center gap-2">
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as 'image' | 'video')}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200"
                    >
                      <option value="image">Image (1:1 / 4:5)</option>
                      <option value="video">Vertical Video (9:16)</option>
                    </select>
                    <Input
                      value={mediaUrl}
                      onChange={(e) => setMediaUrl(e.target.value)}
                      placeholder="/marketing/graphic.jpg"
                      className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-300">
                    Call-to-Action Link
                  </Label>
                  <Input
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="https://captodesk.com"
                    className="bg-zinc-900 border-zinc-800 text-zinc-100 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Zero-EXIF AI Sanitizer Badge */}
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-emerald-300">Zero-EXIF Sanitizer Active: </span>
                    <span className="text-zinc-400">Media is re-encoded to strip C2PA/AI provenance manifests, preventing Facebook &amp; Instagram &quot;AI Content&quot; labels.</span>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-[10px] shrink-0 font-mono">
                  CLEAN
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-zinc-400">
                  {selectedPlatforms.length} channel(s) targeted for immediate multi-cast.
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handlePublish(true)}
                    disabled={publishing}
                    className="h-9 px-3.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Simulate Run
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handlePublish(false)}
                    disabled={publishing}
                    className="h-9 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-sm"
                  >
                    <Send className={`h-3.5 w-3.5 ${publishing ? 'animate-spin' : ''}`} />
                    <span>{publishing ? 'Broadcasting...' : 'Multi-Cast Broadcast'}</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Live Results Banner (if just dispatched) */}
            {lastResults && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Broadcast Executed Successfully</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {lastResults.map((r, i) => (
                    <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-zinc-800/60 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-200 capitalize">{r.platform}</span>
                        <span className="text-[10px] text-zinc-400">({r.mode})</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-mono truncate max-w-xs">{r.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Live Device Previews (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Live Device Preview
              </span>
              <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDevicePreviewMode('feed')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    devicePreviewMode === 'feed' ? 'bg-blue-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Square Feed (1:1)
                </button>
                <button
                  type="button"
                  onClick={() => setDevicePreviewMode('vertical')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    devicePreviewMode === 'vertical' ? 'bg-blue-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Reel / Short (9:16)
                </button>
              </div>
            </div>

            {/* Phone Screen Mockup */}
            <div className="rounded-2xl border-2 border-zinc-700 bg-black p-3.5 shadow-2xl max-w-sm mx-auto space-y-3">
              {/* Phone Speaker Notch */}
              <div className="h-4 w-28 bg-zinc-800 rounded-full mx-auto" />

              {/* Feed Mode Preview */}
              {devicePreviewMode === 'feed' ? (
                <div className="space-y-3">
                  {/* Mock Post Header */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                        CD
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200">CaptoDesk</div>
                        <div className="text-[10px] text-zinc-500">Sponsored • Field Service Software</div>
                      </div>
                    </div>
                    <span className="text-zinc-500 text-xs">•••</span>
                  </div>

                  {/* Mock Image Creative */}
                  <div className="aspect-square w-full rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden relative flex items-center justify-center">
                    <div className="p-4 text-center space-y-2">
                      <div className="text-xs font-bold text-blue-400">
                        {postTitle}
                      </div>
                      <div className="text-[10px] text-zinc-400 line-clamp-3">
                        {postContent}
                      </div>
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
                        captodesk.com
                      </Badge>
                    </div>
                  </div>

                  {/* Mock Caption */}
                  <div className="text-xs text-zinc-300 leading-relaxed line-clamp-4">
                    <span className="font-bold text-zinc-100 mr-1.5">captodesk</span>
                    {postContent}
                  </div>

                  {/* Mock Call to Action Button */}
                  <div className="pt-1">
                    <div className="w-full py-2 rounded-lg bg-blue-600 text-center text-xs font-semibold text-white">
                      Claim Free 3-Job Starter Pass
                    </div>
                  </div>
                </div>
              ) : (
                /* 9:16 Vertical Short / Reel Preview */
                <div className="aspect-9/16 w-full rounded-xl bg-gradient-to-b from-zinc-900 via-zinc-950 to-black border border-zinc-800 p-4 flex flex-col justify-between relative overflow-hidden">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span className="font-bold text-red-500 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
                      Shorts / Reels
                    </span>
                    <span>9:16 HD</span>
                  </div>

                  <div className="space-y-3 my-auto text-center">
                    <Badge className="bg-amber-400 text-black font-extrabold text-xs px-2.5 py-1">
                      {activeVideoPreset.videoScript?.hook || 'NEVER ANSWER THIS CALL 🚫'}
                    </Badge>
                    <p className="text-xs text-zinc-200 font-semibold px-2">
                      {activeVideoPreset.videoScript?.scenes[0]?.voiceover || postContent.slice(0, 90)}
                    </p>
                  </div>

                  <div className="space-y-2 text-xs text-zinc-300">
                    <div className="font-bold text-white">@captodesk</div>
                    <div className="text-[11px] text-zinc-400 line-clamp-2">
                      {postContent}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SHORT VIDEO STUDIO (9:16 REELS / SHORTS / TIKTOK)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'video_studio' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Video className="h-4 w-4 text-red-400" />
                <span>Viral 25-Second Short Video Production Studio</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Optimized for cross-posting to YouTube Shorts, TikTok, Instagram Reels, and Facebook Reels simultaneously.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyVideoScript}
                className="h-8.5 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 gap-1.5"
              >
                {copiedScript ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedScript ? 'Copied Script!' : 'Copy Full Script'}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleGenerateAI('video_short')}
                disabled={generating}
                className="h-8.5 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                <span>Generate New Video Hook</span>
              </Button>
            </div>
          </div>

          {/* Scene Breakdown Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {activeVideoPreset.videoScript?.scenes.map((scene, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-4.5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                  <Badge className="bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-[10px]">
                    Scene {idx + 1} • {scene.timestamp}
                  </Badge>
                  <span className="text-[10px] text-zinc-500 uppercase font-bold">9:16 Vertical</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-400">On-Screen Kinetic Caption</span>
                  <div className="p-2 rounded-md bg-amber-400/10 border border-amber-400/20 text-xs font-bold text-amber-300">
                    &ldquo;{scene.captionOverlay}&rdquo;
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Voiceover Copy</span>
                  <p className="text-xs text-zinc-200 leading-relaxed font-serif italic">
                    &ldquo;{scene.voiceover}&rdquo;
                  </p>
                </div>

                <div className="space-y-1 pt-1 border-t border-zinc-800/60">
                  <span className="text-[10px] uppercase font-bold text-zinc-500">Visual Direction</span>
                  <p className="text-[11px] text-zinc-400 leading-normal">
                    {scene.visual}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: CHANNEL API INTEGRATIONS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'channels' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-5">
            <h2 className="text-sm font-bold text-zinc-100">
              Active Channel Connections &amp; API Health
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Add your API credentials to `.env.local` to switch from Sandbox Testing to Live Multi-Casting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.keys(PLATFORM_CONFIGS) as SocialPlatformId[]).map((pid) => {
              const cfg = PLATFORM_CONFIGS[pid]
              return (
                <div key={pid} className="rounded-xl border border-zinc-800 bg-[#0A0E18] p-5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span 
                        className="h-3 w-3 rounded-full" 
                        style={{ backgroundColor: cfg.color }}
                      />
                      <h3 className="text-sm font-bold text-zinc-200">{cfg.displayName}</h3>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={
                        cfg.status === 'connected' 
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[10px]' 
                          : 'border-blue-500/40 text-blue-400 bg-blue-500/10 text-[10px]'
                      }
                    >
                      {cfg.status === 'connected' ? 'Live Connected' : 'Sandbox Ready'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-zinc-400">
                      <span>Max Characters:</span>
                      <span className="font-mono text-zinc-200">{cfg.maxCharacters.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Aspect Ratios:</span>
                      <span className="font-mono text-zinc-200">{cfg.aspectRatios.join(', ')}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Required Environment Keys</span>
                    <div className="flex flex-wrap gap-1">
                      {cfg.envKeys.map((k) => (
                        <code key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 font-mono">
                          {k}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 4: DISPATCH HISTORY & AUDIT LOGS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="rounded-xl border border-zinc-800 bg-[#0A0E18] overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Recent Multi-Cast Broadcasts
            </h2>
            <span className="text-xs text-zinc-500">Live Telemetry</span>
          </div>

          <div className="divide-y divide-zinc-800/80">
            {recentLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500">
                No past broadcasts recorded in this session. Dispatch a campaign from the composer above to view live logs.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-zinc-200">{log.title}</div>
                    <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span>•</span>
                      <span className="capitalize">{log.mediaType}</span>
                      <span>•</span>
                      <span className="text-zinc-400">{log.platforms.join(', ')}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
                      {log.status.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-zinc-400 text-[10px] font-mono">
                      {log.mode.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
