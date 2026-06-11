"use client"

import * as React from "react"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ActivityFeed } from "@/components/activity-feed"
import { useMandateStore } from "@/lib/mandate-store"
import type { ActivityKind } from "@/lib/mandate-data"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"

const KIND_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "tx.executed", label: "Executed" },
  { value: "tx.blocked", label: "Blocked" },
  { value: "approval.requested", label: "Approvals" },
  { value: "budget.warning", label: "Budget warnings" },
  { value: "mandate.created", label: "Created" },
  { value: "mandate.revoked", label: "Revoked" },
]

export function ActivityView() {
  const { activity, loading, error, isWalletScoped } = useMandateStore()
  const [kind, setKind] = React.useState<string>("all")

  const filtered =
    kind === "all"
      ? activity
      : activity.filter((e) => e.kind === (kind as ActivityKind))

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Event stream</CardTitle>
        <CardDescription>
          Immutable, attributable record of every agent action
        </CardDescription>
        <CardAction>
          <Select value={kind} onValueChange={(value) => value && setKind(value)}>
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {KIND_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="py-0">
        {loading ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>Loading activity</EmptyTitle>
              <EmptyDescription>
                Querying Sui RPC for Mandate events.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : error ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>Unable to load activity</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length > 0 ? (
          <ActivityFeed events={filtered} />
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {isWalletScoped
              ? "No Mandate activity found for this wallet."
              : "No events match this filter."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
