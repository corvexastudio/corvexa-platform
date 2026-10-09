/**
 * CaptoDesk Open-Redirect Prevention & Path Sanitizer (HIGH-01)
 * Enforces strict relative-path redirect boundaries against CRLF,
 * protocol scheme injection, double-encoding, and backslash evasion.
 */

const DEFAULT_FALLBACK = '/client/dashboard'

export function sanitizeRedirectDestination(
  input: string | null | undefined,
  fallback = DEFAULT_FALLBACK
): string {
  if (!input || typeof input !== 'string') {
    return fallback
  }

  // 1. Initial trim
  const target = input.trim()
  if (!target) return fallback

  // 2. Reject control characters / CRLF immediately to stop header injection
  if (/[\x00-\x1f\x7f\r\n]/.test(target)) {
    return fallback
  }

  // 3. Iteratively decode URL-encoded components to catch double/triple encoding bypasses
  // E.g. %252f%252fevil.com -> %2f%2fevil.com -> //evil.com
  let decoded = target
  try {
    for (let i = 0; i < 3; i++) {
      const nextDecode = decodeURIComponent(decoded)
      if (nextDecode === decoded) break
      decoded = nextDecode
      if (/[\x00-\x1f\x7f\r\n]/.test(decoded)) {
        return fallback
      }
    }
  } catch {
    // Malformed URI encoding -> reject
    return fallback
  }

  // 4. Reject backslashes anywhere in the raw or decoded path
  // Browsers normalize \ to / in URLs (e.g., /\evil.com -> //evil.com)
  if (target.includes('\\') || decoded.includes('\\')) {
    return fallback
  }

  // 5. Reject explicit protocol schemes (http:, https:, javascript:, data:, vbscript:, file:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(target) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return fallback
  }

  // 6. Must start with a single '/' and NOT '//' or '/\'
  if (!target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
    return fallback
  }

  // 7. Reject directory traversal sequences (../, /.., etc.)
  if (/(^|\/)\.\.(\/|$)/.test(decoded) || decoded.includes('/..')) {
    return fallback
  }

  // 7. Verify URL parser semantics relative to a dummy base
  try {
    const dummyBase = 'https://captodesk.internal'
    const parsed = new URL(target, dummyBase)
    // Must remain on the dummy base origin (not navigated off-origin)
    if (parsed.origin !== dummyBase) {
      return fallback
    }
    // Pathname must begin with single '/'
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) {
      return fallback
    }
  } catch {
    return fallback
  }

  return target
}
