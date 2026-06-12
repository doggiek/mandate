"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { MandateTable } from "@/components/mandate-table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { useMandateStore } from "@/lib/mandate-store"
import type { MandateStatus } from "@/lib/mandate-data"
import { Plus, ShieldOff } from "lucide-react"

type Filter = "all" | MandateStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
]

function MandatesTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-[1.8fr_0.7fr_1fr_1fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, row) => (
        <div
          key={row}
          className="grid grid-cols-[1.8fr_0.7fr_1fr_1fr_0.8fr_0.8fr_0.8fr] gap-4 border-b border-border px-4 py-4 last:border-b-0"
        >
          {Array.from({ length: 7 }).map((__, col) => (
            <Skeleton key={col} className="h-5 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function MandatesView({
  onSelectMandate,
  onCreate,
  onRevokeMandate,
}: {
  onSelectMandate: (id: string) => void
  onCreate: () => void
  onRevokeMandate: (id: string) => void
}) {
  const { mandates, loading, error, isWalletScoped } = useMandateStore()
  const [filter, setFilter] = React.useState<Filter>("all")

  const filtered =
    filter === "all"
      ? mandates
      : mandates.filter((m) => m.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button size="sm" onClick={onCreate}>
          <Plus data-icon="inline-start" />
          Create Mandate
        </Button>
      </div>

      {loading ? (
        <MandatesTableSkeleton />
      ) : error ? (
        <Empty className="rounded-xl border border-dashed border-destructive/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOff />
            </EmptyMedia>
            <EmptyTitle>Unable to load mandates</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : filtered.length > 0 ? (
        <MandateTable
          mandates={filtered}
          onSelect={onSelectMandate}
          onRevoke={onRevokeMandate}
        />
      ) : (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOff />
            </EmptyMedia>
            <EmptyTitle>
              {isWalletScoped ? "No mandates yet." : `No ${filter} mandates`}
            </EmptyTitle>
            <EmptyDescription>
              {isWalletScoped
                ? "Create a mandate to grant an agent capped DeepBook authority."
                : "There are no mandates matching this filter."}
            </EmptyDescription>
            {isWalletScoped && (
              <Button size="sm" onClick={onCreate}>
                <Plus data-icon="inline-start" />
                Create Mandate
              </Button>
            )}
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
