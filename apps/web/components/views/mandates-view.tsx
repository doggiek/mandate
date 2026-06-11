"use client"

import * as React from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { MandateTable } from "@/components/mandate-table"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useMandateStore } from "@/lib/mandate-store"
import type { MandateStatus } from "@/lib/mandate-data"
import { Plus, ShieldOff } from "lucide-react"

type Filter = "all" | MandateStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "revoked", label: "Revoked" },
]

export function MandatesView({
  onSelectMandate,
  onCreate,
}: {
  onSelectMandate: (id: string) => void
  onCreate: () => void
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
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOff />
            </EmptyMedia>
            <EmptyTitle>Loading mandates</EmptyTitle>
            <EmptyDescription>
              Querying Sui RPC for Mandate events and shared objects.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
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
        <MandateTable mandates={filtered} onSelect={onSelectMandate} />
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
