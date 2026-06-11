"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { OrderStatusBadge } from "@/components/status-badges"
import { cn } from "@/lib/utils"
import { formatNumber, relativeTime } from "@/lib/format"
import { useMandateStore } from "@/lib/mandate-store"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

export function OrdersView() {
  const { orders } = useMandateStore()

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Order book activity</CardTitle>
        <CardDescription>
          Limit and market orders routed to DeepBook under active mandates
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="pl-4">Order</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="hidden text-right sm:table-cell">
                Filled
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden pr-4 text-right md:table-cell">
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const fillPct = o.size > 0 ? (o.filled / o.size) * 100 : 0
              return (
                <TableRow key={o.id} className="border-border">
                  <TableCell className="pl-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{o.pair}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{o.agentName}</span>
                        <span className="text-border">·</span>
                        <span className="font-mono">{o.id}</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        "gap-1 font-medium capitalize",
                        o.side === "buy"
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                          : "border-destructive/30 bg-destructive/10 text-destructive"
                      )}
                    >
                      {o.side === "buy" ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {o.side}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm tabular-nums">
                    {`$${o.price.toLocaleString("en-US", {
                      minimumFractionDigits: o.price < 1 ? 3 : 2,
                      maximumFractionDigits: o.price < 1 ? 4 : 2,
                    })}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(o.size)}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {fillPct.toFixed(0)}%
                  </TableCell>
                  <TableCell>
                    <OrderStatusBadge status={o.status} />
                  </TableCell>
                  <TableCell className="hidden pr-4 text-right text-sm text-muted-foreground tabular-nums md:table-cell">
                    {relativeTime(o.timestamp)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
