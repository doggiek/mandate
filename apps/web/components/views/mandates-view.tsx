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
  const { mandates } = useMandateStore()
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

      {filtered.length > 0 ? (
        <MandateTable mandates={filtered} onSelect={onSelectMandate} />
      ) : (
        <Empty className="rounded-xl border border-dashed border-border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldOff />
            </EmptyMedia>
            <EmptyTitle>No {filter} mandates</EmptyTitle>
            <EmptyDescription>
              There are no mandates matching this filter.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  )
}
