"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ActivityFeed } from "@/components/activity-feed"
import { shortId } from "@/components/copyable-id"
import { Skeleton } from "@/components/ui/skeleton"
import { sortActivitiesByTimeDesc } from "@/lib/activity-utils"
import { useMandateStore } from "@/lib/mandate-store"
import type { ActivityKind, MandateStatus } from "@/lib/mandate-data"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"

const KIND_FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "tx.executed", label: "Executed" },
  { value: "tx.blocked", label: "Blocked" },
  { value: "mandate.created", label: "Created" },
  { value: "mandate.revoked", label: "Revoked" },
]

const PAGE_SIZE = 20

function ActivityListSkeleton() {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="space-y-2 py-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
          <Skeleton className="h-3 w-3/4" />
        </div>
      ))}
    </div>
  )
}

function statusDot(status: MandateStatus) {
  if (status === "active") return "bg-emerald-400"
  if (status === "revoked") return "bg-destructive"
  return "bg-muted-foreground"
}

export function ActivityView() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activity, mandates, loading, error, isWalletScoped } = useMandateStore()
  const [kind, setKind] = React.useState<string>("all")
  const [mandateId, setMandateId] = React.useState("all")
  const [mandateQuery, setMandateQuery] = React.useState("")
  const [mandateOpen, setMandateOpen] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)

  const selectedMandate = mandates.find((mandate) => mandate.id === mandateId)
  const queryMandateId = searchParams.get("mandateId")
  const mandateOptions = React.useMemo(() => {
    const query = mandateQuery.trim().toLowerCase()
    return mandates.filter((mandate) => {
      if (!query) return true
      return (
        mandate.label.toLowerCase().includes(query) ||
        mandate.id.toLowerCase().includes(query)
      )
    })
  }, [mandateQuery, mandates])

  const filtered = sortActivitiesByTimeDesc(
    activity.filter((event) => {
      if (kind !== "all" && event.kind !== (kind as ActivityKind)) {
        return false
      }

      if (mandateId !== "all" && event.mandateId !== mandateId) {
        return false
      }

      return true
    })
  )
  const visibleEvents = filtered.slice(0, visibleCount)

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [kind, mandateId])

  React.useEffect(() => {
    if (!queryMandateId) {
      return
    }
    if (!mandates.some((mandate) => mandate.id === queryMandateId)) {
      return
    }
    setMandateId(queryMandateId)
  }, [mandates, queryMandateId])

  const clearMandateFilter = React.useCallback(() => {
    setMandateId("all")
    setMandateQuery("")
    if (searchParams.get("mandateId")) {
      router.replace(pathname)
    }
  }, [pathname, router, searchParams])

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Event stream</CardTitle>
        <CardDescription>
          Immutable, attributable record of every agent action
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <div className="relative flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMandateOpen((open) => !open)}
              className="w-[250px] justify-start overflow-hidden text-left"
            >
              <span className="truncate">
                {selectedMandate
                  ? `${selectedMandate.label} (${shortId(selectedMandate.id)})`
                  : "All mandates"}
              </span>
            </Button>
            {mandateId !== "all" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearMandateFilter}
              >
                Clear
              </Button>
            )}
            {mandateOpen && (
              <div className="absolute right-0 top-9 z-50 w-[320px] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-xl">
                <Input
                  value={mandateQuery}
                  onChange={(event) => setMandateQuery(event.target.value)}
                  placeholder="Filter by label or id"
                  className="mb-2"
                />
                <div className="max-h-72 overflow-y-auto">
                  {mandateOptions.map((mandate) => (
                    <button
                      key={mandate.id}
                      type="button"
                      onClick={() => {
                        setMandateId(mandate.id)
                        setMandateOpen(false)
                        setMandateQuery("")
                        router.replace(
                          `${pathname}?mandateId=${encodeURIComponent(mandate.id)}`
                        )
                      }}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent",
                        mandateId === mandate.id && "bg-accent"
                      )}
                    >
                      <span
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          statusDot(mandate.status)
                        )}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {mandate.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {shortId(mandate.id)} · {mandate.status}
                        </span>
                      </span>
                    </button>
                  ))}
                  {mandateOptions.length === 0 && (
                    <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No mandates match this filter.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
        {selectedMandate && (
          <div className="border-b border-border py-3 text-xs text-muted-foreground">
            Showing activity for{" "}
            <span className="font-medium text-foreground">
              {selectedMandate.label}
            </span>{" "}
            <span className="font-mono">({shortId(selectedMandate.id)})</span>
          </div>
        )}
        {loading ? (
          <ActivityListSkeleton />
        ) : error ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>Unable to load activity</EmptyTitle>
              <EmptyDescription>{error}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : filtered.length > 0 ? (
          <>
            <ActivityFeed events={visibleEvents} />
            {visibleCount < filtered.length && (
              <div className="border-t border-border py-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyTitle>
                {isWalletScoped ? "No on-chain activity yet." : "No events match this filter."}
              </EmptyTitle>
              <EmptyDescription>
                {isWalletScoped
                  ? "Create or run a mandate to generate ActivityEvents."
                  : "Try a different event filter."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  )
}
