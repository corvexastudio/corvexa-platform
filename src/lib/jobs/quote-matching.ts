/**
 * Shared pure quote-to-job matching and billable amount resolution helpers.
 * Used identically across server job hydration, completion invoicing, and client UI.
 */

const GENERIC_TOKENS = new Set([
  'the',
  'and',
  'for',
  'with',
  'job',
  'quote',
  'estimate',
  'service',
  'work',
  'repair',
  'completed',
])

export interface QuoteMatchCandidate {
  id: string
  quote_number?: string | null
  title?: string | null
  description?: string | null
  total?: number | null
  subtotal?: number | null
  tax?: number | null
  discount?: number | null
  status?: string | null
  manage_token?: string | null
  contact_id?: string | null
  lead_id?: string | null
  accepted_at?: string | null
  created_at?: string | null
  deposit_invoice_id?: string | null
  items?: Array<{
    description?: string | null
    quantity?: number | null
    unit_price?: number | null
  }> | null
  jobs?: Array<{ id: string; quote_id?: string | null; status?: string | null }> | null
}

export interface JobMatchTarget {
  id: string
  contact_id?: string | null
  contact?: { id?: string | null } | null
  lead_id?: string | null
  quote_id?: string | null
  quote?: { id?: string | null; total?: number | null; status?: string | null } | null
  title?: string | null
  status?: string | null
  service?: { name?: string | null; price?: number | null } | null
  items?: Array<{ quantity?: number | null; unit_price?: number | null }> | null
}

function tokenize(text?: string | null): Set<string> {
  if (!text) return new Set()
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((tok) => tok.length >= 3 && !GENERIC_TOKENS.has(tok))
  return new Set(tokens)
}

/**
 * Selects the best matching approved ('accepted') or directly linked quote for a job
 * without double-claiming quotes already assigned to another active/completed job.
 */
export function selectBestAcceptedQuoteForJob<T extends QuoteMatchCandidate>(
  job: JobMatchTarget,
  candidateQuotes: T[],
  claimedQuoteIds: Set<string> = new Set()
): T | null {
  if (!job || !Array.isArray(candidateQuotes) || candidateQuotes.length === 0) {
    return null
  }

  const directQuoteId = job.quote_id || job.quote?.id || null
  const directMatch = directQuoteId
    ? candidateQuotes.find((q) => q.id === directQuoteId) || null
    : null
  if (directMatch && directMatch.status === 'accepted') {
    return directMatch
  }

  const directlyLinkedViaJobs = candidateQuotes.find(
    (q) =>
      q.status === 'accepted' &&
      Array.isArray(q.jobs) &&
      q.jobs.some((linked) => linked.id === job.id)
  )
  if (directlyLinkedViaJobs) return directlyLinkedViaJobs

  const jobContactId = job.contact_id || job.contact?.id || null
  const jobTokens = tokenize(`${job.service?.name || ''} ${job.title || ''}`)

  let best: T | null = null
  let bestScore = -1
  let bestTime = -1

  for (const quote of candidateQuotes) {
    if (quote.status !== 'accepted') continue
    if (!(Number(quote.total) > 0)) continue
    if (jobContactId && quote.contact_id && quote.contact_id !== jobContactId) continue
    if (claimedQuoteIds.has(quote.id)) continue

    // If quote metadata lists linked jobs, do not steal one owned by another non-cancelled job
    if (Array.isArray(quote.jobs) && quote.jobs.length > 0) {
      const ownedByAnotherJob = quote.jobs.some(
        (lj) =>
          lj.id !== job.id &&
          !['cancelled', 'no_show'].includes((lj.status || '').toLowerCase())
      )
      if (ownedByAnotherJob) continue
    }

    let score = 0
    if (job.lead_id && quote.lead_id && job.lead_id === quote.lead_id) {
      score += 1000
    }

    if (jobTokens.size > 0) {
      const quoteTokens = tokenize(`${quote.title || ''} ${quote.description || ''}`)
      for (const tok of jobTokens) {
        if (quoteTokens.has(tok)) score += 25
      }
    }

    const parsedTime = Date.parse(quote.accepted_at || quote.created_at || '') || 0
    if (score > bestScore || (score === bestScore && parsedTime > bestTime)) {
      best = quote
      bestScore = score
      bestTime = parsedTime
    }
  }

  if (best) return best

  if (directMatch && !['declined', 'expired'].includes((directMatch.status || '').toLowerCase())) {
    return directMatch
  }

  return candidateQuotes.find(
    (q) => Array.isArray(q.jobs) && q.jobs.some((linked) => linked.id === job.id)
  ) || null
}

/**
 * Resolves the initial pre-filled billable dollar amount for a job completion dialog.
 */
export function resolveInitialBillableAmount(job: JobMatchTarget): number | null {
  if (job.quote && Number(job.quote.total) > 0) {
    return Number(job.quote.total)
  }

  if (Array.isArray(job.items) && job.items.length > 0) {
    const itemsSum = job.items.reduce(
      (sum, it) => sum + (Number(it.unit_price) || 0) * (Number(it.quantity) || 1),
      0
    )
    if (itemsSum > 0) {
      return Math.round(itemsSum * 100) / 100
    }
  }

  if (job.service?.price && Number(job.service.price) > 0) {
    return Number(job.service.price)
  }

  return null
}
