"use client";

import * as React from "react";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyableId, shortId } from "@/components/copyable-id";
import { ExplorerLink } from "@/components/explorer-link";
import { MandateFilter } from "@/components/mandate-filter";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEEPBOOK_POOL_ID,
  DEEPBOOK_POOL_ID_SUI_DUSDC,
} from "@/lib/chain-config";
import { formatSui } from "@/lib/format";
import { useMandateStore } from "@/lib/mandate-store";

const DEEPBOOK_PAIR = "DEEP/SUI";
const DEEPBOOK_SIDE = "Buy";
const PAGE_SIZE = 20;

function OrdersSkeleton() {
  return (
    <div className="divide-y divide-border">
      <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.85fr_1.15fr_0.8fr_96px] gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-3 px-4 py-4">
          <div className="grid grid-cols-[1.3fr_1fr_0.8fr_0.85fr_1.15fr_0.8fr_96px] gap-4">
            {Array.from({ length: 7 }).map((__, col) => (
              <Skeleton key={col} className="h-5 w-full" />
            ))}
          </div>
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

function executionTime(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "-";
  }

  const diffMs = Date.now() - timestamp;
  if (diffMs < 60_000) {
    return "just now";
  }

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function executionStatusLabel(execution: {
  status: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.status === "failed") {
    return "Failed";
  }
  if (execution.fillStatus === "filled") {
    return "Executed";
  }
  if (execution.fillStatus === "no_fill") {
    return "No fill";
  }
  return "Amount unavailable";
}

function executionStatusClass(execution: {
  status: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.status === "failed") {
    return "border-destructive/30 bg-destructive/10 font-medium text-destructive";
  }
  if (execution.fillStatus === "filled") {
    return "border-emerald-500/25 bg-emerald-500/10 font-medium text-emerald-400";
  }
  if (execution.fillStatus === "no_fill") {
    return "border-amber-500/25 bg-amber-500/10 font-medium text-amber-400";
  }
  return "border-border bg-background/60 font-medium text-muted-foreground";
}

function executionStatusSubtext(execution: {
  status: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.status === "failed") {
    return "Transaction failed";
  }
  if (execution.fillStatus === "filled") {
    return "Swap filled";
  }
  if (execution.fillStatus === "no_fill") {
    return "Input returned as residual";
  }
  return "Amount unavailable";
}

function outputSummary(execution: {
  outputAmount?: string;
  outputAsset?: string;
  outputCoinObjectIds?: string[];
  residualSuiAmount?: number;
  residualAmount?: number;
  residualAsset?: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  const parts: string[] = [];
  if (execution.fillStatus === "no_fill") {
    parts.push(`No ${execution.outputAsset ?? "output"} filled`);
  } else if (execution.outputAmount) {
    parts.push(execution.outputAmount);
  } else if (execution.outputCoinObjectIds?.length) {
    parts.push("Amount unavailable");
  } else {
    parts.push("Amount unavailable");
  }

  if (typeof execution.residualSuiAmount === "number") {
    parts.push(`${formatSui(execution.residualSuiAmount)} returned`);
  }
  if (typeof execution.residualAmount === "number" && execution.residualAsset) {
    parts.push(
      `${execution.residualAmount} ${execution.residualAsset} returned`,
    );
  }

  return parts;
}

export function OrdersView() {
  const { orders, mandates, loading } = useMandateStore();
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [mandateId, setMandateId] = React.useState("all");
  const [expandedOrderId, setExpandedOrderId] = React.useState<string | null>(
    null,
  );
  const selectedMandate = mandates.find((mandate) => mandate.id === mandateId);
  const sortedOrders = [...orders]
    .filter((order) => mandateId === "all" || order.mandateId === mandateId)
    .sort((a, b) => b.timestamp - a.timestamp);
  const visibleOrders = sortedOrders.slice(0, visibleCount);

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [orders.length, mandateId]);

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Order History</CardTitle>
        <CardDescription>
          Filterable record of DeepBook executions linked to each mandate.
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          <MandateFilter
            mandates={mandates}
            selectedMandateId={mandateId}
            loading={loading}
            onClear={() => setMandateId("all")}
            onSelectMandate={setMandateId}
          />
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {selectedMandate && (
          <div className="border-b border-border px-4 py-3 text-xs text-muted-foreground">
            Showing DeepBook orders for{" "}
            <span className="font-medium text-foreground">
              {selectedMandate.label}
            </span>{" "}
            <span className="font-mono">({shortId(selectedMandate.id)})</span>
          </div>
        )}
        {loading ? (
          <OrdersSkeleton />
        ) : sortedOrders.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="pl-4">Mandate</TableHead>
                  <TableHead>Digest</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[96px] pr-4 text-right">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleOrders.map((execution) => {
                  const outputParts = outputSummary(execution);
                  const outputObjectCount =
                    execution.outputCoinObjectIds?.length ?? 0;
                  const expanded = expandedOrderId === execution.id;

                  return (
                    <React.Fragment key={execution.id}>
                      <TableRow className="border-b-0 align-top hover:bg-muted/35">
                        <TableCell className="pl-4">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="font-medium">
                              {execution.mandateLabel}
                            </span>
                            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                              <CopyableId
                                value={execution.mandateId}
                                label="mandate id"
                              />
                              <ExplorerLink
                                objectId={execution.mandateId}
                                label="View mandate on Suivision"
                              />
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <CopyableId
                              value={execution.digest}
                              label="digest"
                            />
                            <ExplorerLink digest={execution.digest} />
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {execution.pair ?? DEEPBOOK_PAIR}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {execution.side ?? DEEPBOOK_SIDE}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-sm">
                              {typeof execution.inputAmount === "number"
                                ? `${execution.inputAmount} ${execution.inputAsset ?? "SUI"}`
                                : typeof execution.amountSui === "number"
                                  ? formatSui(execution.amountSui)
                                  : "0.001 SUI"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[240px]">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="truncate text-sm font-medium">
                              {outputParts[0]}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {outputParts.slice(1).join(" · ") ||
                                (outputObjectCount
                                  ? `${outputObjectCount} object${outputObjectCount === 1 ? "" : "s"}`
                                  : "Output details unavailable")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={executionStatusClass(execution)}
                          >
                            {executionStatusLabel(execution)}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {executionStatusSubtext(execution)}
                          </p>
                        </TableCell>
                        <TableCell className="pr-4 text-right text-sm text-muted-foreground tabular-nums">
                          {executionTime(execution.timestamp)}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-border hover:bg-muted/35">
                        <TableCell
                          colSpan={7}
                          className="px-4 pb-4 pt-0 whitespace-normal"
                        >
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {(() => {
                              const poolId =
                                execution.pair === "SUI_DUSDC"
                                  ? DEEPBOOK_POOL_ID_SUI_DUSDC
                                  : DEEPBOOK_POOL_ID;
                              return poolId ? (
                                <span className="inline-flex min-w-0 items-center gap-1">
                                  Pool:
                                  <CopyableId
                                    value={poolId}
                                    label="DeepBook pool object id"
                                  />
                                  <ExplorerLink
                                    objectId={poolId}
                                    label="View DeepBook pool on Suivision"
                                  />
                                </span>
                              ) : null;
                            })()}
                            {execution.outputOwner ? (
                              <span className="inline-flex min-w-0 items-center gap-1">
                                Owner:
                                <CopyableId
                                  value={execution.outputOwner}
                                  label="output owner"
                                />
                              </span>
                            ) : null}
                            <span>
                              Gas Fee:{" "}
                              <span className="font-mono">
                                {typeof execution.gasFeeSui === "number"
                                  ? formatSui(execution.gasFeeSui)
                                  : "-"}
                              </span>
                            </span>
                            <span>
                              Output objects: {outputObjectCount || "-"}
                            </span>
                            {outputObjectCount > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedOrderId(
                                    expanded ? null : execution.id,
                                  )
                                }
                                className="text-cyan-300 hover:text-cyan-200"
                              >
                                {expanded ? "Hide details" : "Details"}
                              </button>
                            )}
                          </div>
                          {expanded && execution.outputCoinObjectIds?.length ? (
                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                              <span>Output object ids:</span>
                              {execution.outputCoinObjectIds.map((objectId) => (
                                <span
                                  key={objectId}
                                  className="inline-flex min-w-0 items-center gap-1"
                                >
                                  <CopyableId
                                    value={objectId}
                                    label="output coin object id"
                                  />
                                  <ExplorerLink
                                    objectId={objectId}
                                    label="View output coin on Suivision"
                                  />
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {visibleCount < sortedOrders.length && (
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
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              {mandateId === "all"
                ? "No DeepBook executions yet"
                : "No DeepBook orders for this mandate"}
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              {mandateId === "all"
                ? "Run an active mandate to generate a real DeepBook transaction."
                : "Clear the mandate filter or run this mandate to generate an order."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
