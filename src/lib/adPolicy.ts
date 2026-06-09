'use client'

// Central guard to determine if a route is eligible to render ads.
// Keep this conservative to avoid showing ads on non-editorial or utility pages.
// Adjust patterns as needed, but default to deny.

// Allowlist of routes that typically contain editorial content
const allowlistPatterns = ['/', '/semester/', '/games', '/games/']

// Blocklist of routes that should never show ads
const blocklistPatterns = ['/login', '/admin/', '/drawpad/', '/notepad/', '/secretextras/']

function pathMatches(pathname: string, pattern: string): boolean {
  // Treat trailing slash in pattern as a prefix match; otherwise exact.
  if (pattern.endsWith('/')) return pathname.startsWith(pattern)
  return pathname === pattern
}

export function isAdEligiblePath(pathname: string): boolean {
  // Explicit blocks first
  for (const p of blocklistPatterns) {
    if (pathMatches(pathname, p)) return false
  }
  // Only allow known content routes
  for (const p of allowlistPatterns) {
    if (pathMatches(pathname, p)) return true
  }
  return false
}

// Optional environment kill switch for emergencies
export function adsGloballyEnabled(): boolean {
  return String(process.env.NEXT_PUBLIC_ADSENSE_ENABLED || '1') === '1'
}