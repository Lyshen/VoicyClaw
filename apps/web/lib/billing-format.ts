const creditsFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
})

export function formatCredits(value: number) {
  return creditsFormatter.format(value / 1000)
}

export function formatCreditsDelta(value: number) {
  const prefix = value > 0 ? "+" : value < 0 ? "-" : ""
  return `${prefix}${formatCredits(Math.abs(value))}`
}

export function formatDurationMs(value: number) {
  if (value <= 0) {
    return "0s"
  }

  if (value < 1000) {
    return `${value}ms`
  }

  return `${(value / 1000).toFixed(2)}s`
}

export function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed)
}

export function formatDateTimeInputValue(value: string | null) {
  if (!value) {
    return ""
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ""
  }

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  const hour = String(parsed.getHours()).padStart(2, "0")
  const minute = String(parsed.getMinutes()).padStart(2, "0")

  return `${year}-${month}-${day}T${hour}:${minute}`
}

export function toIsoDateTimeOrNull(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) {
    return null
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

export function shortId(value: string) {
  return value.length <= 12 ? value : `${value.slice(0, 8)}...`
}
