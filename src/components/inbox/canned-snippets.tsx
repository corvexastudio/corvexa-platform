import { Sparkles } from 'lucide-react'

export const CANNED_RESPONSES = [
  "Hi! When would be a good time for me to come take a look?",
  "We can be there tomorrow between 9 AM and 11 AM. Does that work?",
  "I'm on my way to your property now!",
  "Just sent over the written estimate. Let me know if you have questions!"
]

interface CannedSnippetsProps {
  onSelect: (snippet: string) => void
}

export function CannedSnippetsBar({ onSelect }: CannedSnippetsProps) {
  return (
    <div className="px-4 py-2 bg-zinc-950/60 border-t border-zinc-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
        <Sparkles className="h-3 w-3 text-amber-400" /> Quick:
      </span>
      {CANNED_RESPONSES.map((snip, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(snip)}
          className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white px-2.5 py-1 text-[11px] whitespace-nowrap shrink-0 transition-colors"
        >
          {snip.slice(0, 32)}...
        </button>
      ))}
    </div>
  )
}
