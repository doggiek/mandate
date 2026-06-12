"use client"

import { cn } from "@/lib/utils"
import { CopyableId } from "@/components/copyable-id"
import { ExplorerLink } from "@/components/explorer-link"
import { ActivityBadge } from "@/components/status-badges"
import { formatSui } from "@/lib/format"
import type { ActivityEvent } from "@/lib/mandate-data"

function activityTitle(event: ActivityEvent) {
  return event.title ?? event.message
}

function activityTimeLabel(event: ActivityEvent) {
  if (event.timeDisplay === "syncing") {
    return "syncing"
  }

  if (typeof event.timestampMs !== "number" || !Number.isFinite(event.timestampMs)) {
    return "-"
  }

  return event.timeDisplay ?? "-"
}

function reasonLabel(reason?: string) {
  switch (reason) {
    case "exceeds_per_tx_cap":
      return "exceeds per-tx cap"
    case "exceeds_remaining_budget":
      return "exceeds remaining budget"
    case "mandate_inactive_or_expired":
      return "mandate inactive or expired"
    default:
      return reason?.replaceAll("_", " ")
  }
}

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
            "flex min-w-0 flex-col gap-1.5 py-3",
            i !== events.length - 1 && "border-b border-border"
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <ActivityBadge kind={e.kind} />
            <span className="min-w-0 truncate text-sm font-medium leading-snug">
              {activityTitle(e)}
            </span>
            {typeof e.amount === "number" && (
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  e.kind === "tx.blocked" && "text-destructive",
                  e.kind === "tx.executed" && "text-foreground"
                )}
              >
                {formatSui(e.amount, { compact: true })}
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {activityTimeLabel(e)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="truncate">{e.agentName}</span>
            <span className="text-border">·</span>
            <CopyableId value={e.mandateId} label="mandate id" />
            {e.digest && (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <CopyableId value={e.digest} label="digest" />
                  <ExplorerLink digest={e.digest} />
                </span>
              </>
            )}
            {e.kind === "tx.blocked" && e.status && (
              <>
                <span className="text-border">·</span>
                <span>Reason: {reasonLabel(e.status)}</span>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
