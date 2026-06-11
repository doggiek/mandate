"use client"

import { cn } from "@/lib/utils"
import { ActivityBadge } from "@/components/status-badges"
import { formatUsd, relativeTime } from "@/lib/format"
import type { ActivityEvent } from "@/lib/mandate-data"

export function ActivityFeed({
  events,
  className,
}: {
  events: ActivityEvent[]
  className?: string
}) {
  return (
    <ul className={cn("flex flex-col", className)}>
      {events.map((e, i) => (
        <li
          key={e.id}
          className={cn(
            "flex items-start gap-3 py-3",
            i !== events.length - 1 && "border-b border-border"
          )}
        >
          <div className="mt-0.5 shrink-0">
            <ActivityBadge kind={e.kind} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="text-sm leading-snug">{e.message}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              <span className="truncate">{e.agentName}</span>
              {e.protocol && (
                <>
                  <span className="text-border">·</span>
                  <span>{e.protocol}</span>
                </>
              )}
              {e.digest && (
                <>
                  <span className="text-border">·</span>
                  <span className="font-mono">{e.digest}</span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            {typeof e.amount === "number" && (
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  e.kind === "tx.blocked" && "text-destructive",
                  e.kind === "tx.executed" && "text-foreground"
                )}
              >
                {formatUsd(e.amount, { compact: true })}
              </span>
            )}
            <span className="text-xs text-muted-foreground tabular-nums">
              {relativeTime(e.timestamp)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
