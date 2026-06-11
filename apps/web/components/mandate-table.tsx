"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/status-badges"
import { BudgetMeter } from "@/components/budget-meter"
import { CopyableId } from "@/components/copyable-id"
import { cn } from "@/lib/utils"
import { stableExpiryLabel } from "@/lib/format"
import type { Mandate } from "@/lib/mandate-data"
import { ChevronRight } from "lucide-react"

export function MandateTable({
  mandates,
  onSelect,
}: {
  mandates: Mandate[]
  onSelect: (id: string) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="pl-4">Mandate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[180px]">Budget used</TableHead>
            <TableHead className="hidden md:table-cell">Protocols</TableHead>
            <TableHead className="hidden lg:table-cell">Expires</TableHead>
            <TableHead className="w-10 pr-3" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {mandates.map((m) => (
            <TableRow
              key={m.id}
              onClick={() => onSelect(m.id)}
              className="cursor-pointer border-border"
            >
              <TableCell className="pl-4">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium leading-tight">{m.label}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="truncate">{m.agent.name}</span>
                    <span className="text-border">·</span>
                    <CopyableId value={m.id} label="mandate id" />
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={m.status} />
              </TableCell>
              <TableCell>
                <BudgetMeter spent={m.spent} budget={m.budget} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {m.protocols.slice(0, 2).map((p) => (
                    <Badge
                      key={p}
                      variant="secondary"
                      className="bg-secondary font-normal text-secondary-foreground"
                    >
                      {p}
                    </Badge>
                  ))}
                  {m.protocols.length > 2 && (
                    <Badge variant="secondary" className="bg-secondary font-normal">
                      +{m.protocols.length - 2}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    m.status === "expired"
                      ? "text-muted-foreground"
                      : "text-foreground"
                  )}
                >
                  {stableExpiryLabel(m.expiresAt, m.status)}
                </span>
              </TableCell>
              <TableCell className="pr-3 text-right">
                <ChevronRight className="ml-auto size-4 text-muted-foreground" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
