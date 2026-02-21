/**
 * Format XP/numbers in compact form: 13910 → "13.9k", 1500000 → "1.5M"
 */
export function formatCompact(value: number): string {
  if (value >= 1_000_000) {
    const v = value / 1_000_000
    return v >= 100 ? `${Math.round(v)}M` : `${v.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const v = value / 1_000
    return v >= 100 ? `${Math.round(v)}k` : `${v.toFixed(1)}k`
  }
  return value.toString()
}

/**
 * Format XP with commas: 1587727 → "1,587,727"
 */
export function formatFull(value: number): string {
  return value.toLocaleString()
}

/**
 * Format a number with +/- sign: 3379 → "+3,379"
 */
export function formatSigned(value: number): string {
  const prefix = value > 0 ? '+' : ''
  return prefix + value.toLocaleString()
}

/**
 * Format milliseconds duration into human readable: "2h 15m"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

/**
 * Format a percentage: 68.2 → "68.2%"
 */
export function formatPercent(value: number): string {
  if (value >= 100) return '100%'
  return `${value.toFixed(1)}%`
}

/**
 * Format XP/hr for display: automatically chooses compact or full
 * depending on context. For dashboard cards, always compact.
 */
export function formatXpRate(value: number): string {
  if (value === 0) return '—'
  return `${formatCompact(value)}/hr`
}

/**
 * Format time-to-level from the plugin (which sends it as a string like "29:07:48" or "∞")
 */
export function formatTimeToLevel(value: string): string {
  if (!value || value === '∞' || value === 'Infinity') return '∞'
  return value
}

/**
 * Get a relative time string: "2m ago", "1h ago"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
