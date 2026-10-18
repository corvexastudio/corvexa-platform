'use client'

import { useState, useEffect, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Camera, Image as ImageIcon, Trash2, Upload, Loader2, Sparkles, CheckCircle2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface JobPhoto {
  id: string
  photo_type: 'before' | 'after' | 'progress' | 'completion'
  url: string
  caption?: string | null
  created_at: string
}

interface JobPhotosModalProps {
  isOpen: boolean
  onClose: () => void
  job: {
    id: string
    job_number: string
    title: string
  } | null
  onPhotosUpdated?: () => void
}

export function JobPhotosModal({
  isOpen,
  onClose,
  job,
  onPhotosUpdated
}: JobPhotosModalProps) {
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before')
  const [photos, setPhotos] = useState<JobPhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState<JobPhoto | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch photos for current job
  useEffect(() => {
    if (!isOpen || !job?.id) return
    let isMounted = true

    async function loadPhotos() {
      setLoading(true)
      try {
        const res = await fetch(`/api/client/jobs/${job?.id}/photos`)
        const data = await res.json()
        if (res.ok && isMounted) {
          setPhotos(data.photos || [])
        }
      } catch {
        toast.error('Failed to load job photos')
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadPhotos()
    return () => { isMounted = false }
  }, [isOpen, job?.id])

  // Handle direct file upload
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !job?.id) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('photoType', activeTab)
    if (caption.trim()) {
      formData.append('caption', caption.trim())
    }

    try {
      const res = await fetch(`/api/client/jobs/${job.id}/photos`, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()

      if (res.ok && data.photo) {
        setPhotos(prev => [...prev, data.photo])
        setCaption('')
        toast.success(`${activeTab === 'before' ? 'Before' : 'After'} photo uploaded successfully!`)
        onPhotosUpdated?.()
      } else {
        toast.error(data.error || 'Failed to upload photo')
      }
    } catch {
      toast.error('Network error uploading photo')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Handle deleting a photo
  const handleDeletePhoto = async (photoId: string) => {
    if (!job?.id) return
    try {
      const res = await fetch(`/api/client/jobs/${job.id}/photos/${photoId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId))
        toast.success('Photo removed')
        onPhotosUpdated?.()
      } else {
        toast.error('Failed to delete photo')
      }
    } catch {
      toast.error('Network error deleting photo')
    }
  }

  const beforePhotos = photos.filter(p => p.photo_type === 'before')
  const afterPhotos = photos.filter(p => p.photo_type === 'after')
  const currentPhotos = activeTab === 'before' ? beforePhotos : afterPhotos

  return (
    <>
      <Modal
        open={isOpen}
        onOpenChange={(open) => !open && onClose()}
        title={`Work Proof Photos • #${job?.job_number || ''}`}
        description="Capture before and after photos from the field. Photos automatically show up on the customer's live tracking pulse."
        size="xl"
      >
        <div className="space-y-4 pt-1">
          {/* Segmented Tab Bar */}
          <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800/80 border border-slate-200/80 dark:border-zinc-700/80 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('before')}
              className={cn(
                'py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer',
                activeTab === 'before'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              )}
            >
              <Camera className="w-3.5 h-3.5 text-amber-500" />
              <span>Before Photos</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                {beforePhotos.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('after')}
              className={cn(
                'py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer',
                activeTab === 'after'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              )}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>After Photos</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                {afterPhotos.length}
              </span>
            </button>
          </div>

          {/* Upload Area */}
          <div className="p-3.5 rounded-xl border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-950/50 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder={`Optional ${activeTab} note / caption (e.g. Broken valve, Repaired copper line)...`}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="text-xs h-9 bg-white dark:bg-zinc-900"
              />

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden"
              />

              <Button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-3.5 h-3.5" />
                    <span>Take / Add Photo</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-slate-400 dark:text-zinc-500 text-center sm:text-left">
              Tip: On mobile, tapping &ldquo;Take / Add Photo&rdquo; directly opens your phone camera.
            </p>
          </div>

          {/* Photos Grid */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span className="text-xs">Loading photos...</span>
            </div>
          ) : currentPhotos.length === 0 ? (
            <div className="py-10 text-center space-y-2 rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-200/60 dark:border-zinc-800/60 p-4">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-slate-400">
                <ImageIcon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                No {activeTab} photos uploaded yet
              </p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 max-w-xs mx-auto">
                Snap photos from the job site before starting and after completion for verification.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto p-1">
              {currentPhotos.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-850 aspect-square shadow-2xs"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption || 'Job photo'}
                    className="w-full h-full object-cover cursor-pointer transition-transform group-hover:scale-105"
                    onClick={() => setPreviewPhoto(p)}
                  />

                  {p.caption && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-[10px] text-white truncate">
                      {p.caption}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(p.id)}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/60 hover:bg-red-600 text-white transition-colors opacity-90 group-hover:opacity-100 cursor-pointer"
                    title="Delete photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-2 flex justify-between items-center text-xs text-slate-500 dark:text-zinc-400 border-t border-slate-100 dark:border-zinc-800">
            <span>{photos.length} total verification photo{photos.length === 1 ? '' : 's'}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8"
            >
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox Photo Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto.url}
              alt={previewPhoto.caption || 'Full preview'}
              className="max-h-[75vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            {previewPhoto.caption && (
              <p className="mt-3 text-sm text-white font-medium text-center">
                {previewPhoto.caption}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
