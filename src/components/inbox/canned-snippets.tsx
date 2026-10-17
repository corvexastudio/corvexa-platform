import { FileText, Sparkles } from 'lucide-react'

export const CANNED_RESPONSES = [
  "Hi! When would be a good time for me to come take a look?",
  "We can be there tomorrow between 9 AM and 11 AM. Does that work?",
  "I'm on my way to your property now!",
  "Just sent over your written estimate. Let me know if you have questions!",
  "Thank you for choosing us! Would you mind leaving us a quick Google review?"
]

interface CannedSnippetsProps {
  onSelect: (snippet: string) => void
}

export function CannedSnippetsBar({ onSelect }: CannedSnippetsProps) {
  return (
    <div className="px-3 py-2 bg-slate-50/80 dark:bg-zinc-950/60 border-t border-slate-200/80 dark:border-zinc-800/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" /> Templates:
      </span>
      {CANNED_RESPONSES.map((snip, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelect(snip)}
          className="rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-white px-2.5 py-1 text-[11px] whitespace-nowrap shrink-0 transition-all shadow-2xs cursor-pointer"
        >
          {snip.slice(0, 34)}...
        </button>
      ))}
    </div>
  )
}
