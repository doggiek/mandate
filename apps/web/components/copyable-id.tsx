"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

export function shortId(value: string, prefixLength = 6, suffixLength = 4) {
  if (!value) {
    return ""
  }

  if (value.length <= prefixLength + suffixLength + 3) {
    return value
  }

  return `${value.slice(0, prefixLength)}...${value.slice(-suffixLength)}`
}

export function CopyableId({
  value,
  label = "value",
  className,
}: {
  value?: string | null
  label?: string
  className?: string
}) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) {
      return
    }

    const timeout = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(timeout)
  }, [copied])

  if (!value) {
    return null
  }

  const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()

    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1.5 align-middle font-mono",
        className
      )}
    >
      <span className="min-w-0 truncate">{shortId(value)}</span>
      <button
        type="button"
        title={copied ? "Copied" : `Copy ${label}`}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        onClick={handleCopy}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-primary/10 hover:text-primary"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </span>
  )
}
