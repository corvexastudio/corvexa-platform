/**
 * Computes a clean 1-2 character monogram for trade contractors
 * when no custom brand logo is uploaded.
 */
export function getInitials(name?: string | null): string {
  if (!name || !name.trim()) return 'CD'
  const cleaned = name
    .trim()
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter(Boolean)

  if (cleaned.length === 0) return 'CD'
  if (cleaned.length === 1) {
    const single = cleaned[0]
    return single.slice(0, 2).toUpperCase()
  }
  return (cleaned[0][0] + cleaned[1][0]).toUpperCase()
}
