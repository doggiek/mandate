export const DEMO_NOW_ISO = "2026-06-11T04:00:00.000Z"

export function formatUsd(n: number, opts?: { compact?: boolean }): string {
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n)
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatNumber(n: number, maxFractionDigits = 2): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: maxFractionDigits,
  }).format(n)
}

export function formatSui(n: number, opts?: { compact?: boolean }): string {
  return `${new Intl.NumberFormat("en-US", {
    notation: opts?.compact && Math.abs(n) >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 4,
  }).format(n)} SUI`
}

export function relativeTime(iso: string, referenceIso = DEMO_NOW_ISO): string {
  const then = new Date(iso).getTime()
  const now = new Date(referenceIso).getTime()
  const diffMs = then - now
  const abs = Math.abs(diffMs)
  const mins = Math.round(abs / 60000)
  const hours = Math.round(abs / 3600000)
  const days = Math.round(abs / 86400000)
  const past = diffMs < 0

  let value: string
  if (mins < 60) value = `${mins}m`
  else if (hours < 24) value = `${hours}h`
  else value = `${days}d`

  return past ? `${value} ago` : `in ${value}`
}

export function stableExpiryLabel(
  iso: string,
  status?: "active" | "expired" | "revoked" | "paused"
): string {
  if (status === "expired") {
    return "Expired"
  }

  const then = new Date(iso).getTime()
  const now = new Date(DEMO_NOW_ISO).getTime()
  const diffMs = then - now

  if (diffMs <= 0) {
    return "Expired"
  }

  const hours = Math.round(diffMs / 3600000)
  if (hours <= 24) {
    return `${hours}h`
  }

  return `${Math.round(hours / 24)}d`
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

export function shortId(id: string): string {
  return id
}
