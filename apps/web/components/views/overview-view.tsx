"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight, ShieldOff } from "lucide-react";

import { ActivityFeed } from "@/components/activity-feed";
import { BudgetMeter } from "@/components/budget-meter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyableId } from "@/components/copyable-id";
import { ExplorerLink, transactionUrl } from "@/components/explorer-link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { sortActivitiesByTimeDesc } from "@/lib/activity-utils";
import { formatSui, stableExpiryLabel } from "@/lib/format";
import { useMandateStore } from "@/lib/mandate-store";
import { cn } from "@/lib/utils";
import type { Mandate } from "@/lib/mandate-data";

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-[420px] max-w-full" />
        </div>
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  helper,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  valueClassName?: string;
}) {
  return (
    <Card className="min-h-[112px] border-border/80 bg-card/80">
      <CardContent className="flex h-full flex-col justify-between p-3.5">
        <div className="truncate text-xs text-muted-foreground">{label}</div>
        <div
          className={cn(
            "mt-3 min-w-0 truncate font-mono text-lg font-semibold text-foreground",
            valueClassName,
          )}
        >
          {value}
        </div>
        <div className="mt-2 truncate text-xs text-muted-foreground/75">
          {helper}
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewMandatesTable({
  mandates,
  onSelect,
}: {
  mandates: Mandate[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/70 hover:bg-transparent">
            <TableHead className="pl-4">Mandate</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[160px]">Budget used</TableHead>
            <TableHead className="hidden md:table-cell">Protocols</TableHead>
            <TableHead className="hidden lg:table-cell">Created</TableHead>
            <TableHead className="hidden lg:table-cell">Expires</TableHead>
            <TableHead className="w-[140px] pr-3 text-center">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {mandates.map((mandate) => (
            <TableRow key={mandate.id} className="border-border/70">
              <TableCell className="pl-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium leading-tight">
                    {mandate.label}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <CopyableId value={mandate.id} label="mandate id" />
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={mandate.status} />
              </TableCell>
              <TableCell>
                <BudgetMeter spent={mandate.spent} budget={mandate.budget} />
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <div className="flex flex-wrap gap-1">
                  {mandate.protocols.slice(0, 2).map((protocol) => (
                    <Badge
                      key={protocol}
                      variant="secondary"
                      className="bg-secondary font-normal text-secondary-foreground"
                    >
                      {protocol}
                    </Badge>
                  ))}
                  {mandate.protocols.length > 2 && (
                    <Badge
                      variant="secondary"
                      className="bg-secondary font-normal"
                    >
                      +{mandate.protocols.length - 2}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span className="text-sm text-muted-foreground tabular-nums">
                  {mandate.createdAtDisplay ?? "-"}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <span
                  className={cn(
                    "text-sm tabular-nums",
                    mandate.status === "expired"
                      ? "text-muted-foreground"
                      : "text-foreground",
                  )}
                >
                  {mandate.expiresLabel ??
                    stableExpiryLabel(mandate.expiresAt, mandate.status)}
                </span>
              </TableCell>
              <TableCell className="pr-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/console/automation?mandateId=${mandate.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "h-8 gap-1.5",
                    })}
                  >
                    Automation
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => onSelect(mandate.id)}
                    aria-label={`Open ${mandate.label} details`}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function OverviewView({
  onSelectMandate,
  onCreate,
  onViewAll,
}: {
  onSelectMandate: (id: string) => void;
  onCreate: () => void;
  onViewAll: () => void;
}) {
  const { mandates, activity, orders, loading, error, isWalletScoped } =
    useMandateStore();

  const activeMandates = React.useMemo(
    () => mandates.filter((mandate) => mandate.status === "active"),
    [mandates],
  );

  const successfulOrders = React.useMemo(
    () => orders.filter((order) => order.status !== "failed"),
    [orders],
  );

  const sortedOrders = React.useMemo(
    () => [...successfulOrders].sort((a, b) => b.timestamp - a.timestamp),
    [successfulOrders],
  );

  const recentActivity = React.useMemo(
    () => sortActivitiesByTimeDesc(activity).slice(0, 5),
    [activity],
  );

  const summary = React.useMemo(() => {
    const totalExecutedAmount = successfulOrders.reduce(
      (sum, order) => sum + (order.amountSui ?? 0),
      0,
    );
    const blockedActivities = activity.filter(
      (event) => event.kind === "tx.blocked",
    );
    const totalBlockedAmount = blockedActivities.reduce(
      (sum, event) => sum + (event.amountSui ?? event.amount ?? 0),
      0,
    );

    return {
      activeMandates: activeMandates.length,
      totalExecutedAmount,
      totalBlockedAmount,
      deepBookExecutions: successfulOrders.length,
      blockedActions: blockedActivities.length,
      latestExecution: sortedOrders[0],
    };
  }, [activeMandates.length, activity, sortedOrders, successfulOrders]);

  const isInitialLoading =
    loading &&
    mandates.length === 0 &&
    activity.length === 0 &&
    orders.length === 0;

  if (isInitialLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-medium leading-snug text-foreground">
            Autonomous Execution Summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track autonomous spend, policy blocks, DeepBook executions, and
            on-chain proof.
          </p>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <SummaryMetric
          label="Active Mandates"
          value={String(summary.activeMandates)}
          helper="Active permissions"
        />
        <SummaryMetric
          label="Executed Volume"
          value={formatSui(summary.totalExecutedAmount)}
          helper="Approved autonomous spend"
        />
        <SummaryMetric
          label="Blocked Volume"
          value={formatSui(summary.totalBlockedAmount)}
          helper="Prevented by policy"
        />
        <SummaryMetric
          label="DeepBook Executions"
          value={String(summary.deepBookExecutions)}
          helper="Successful swaps"
        />
        <SummaryMetric
          label="Blocked Actions"
          value={String(summary.blockedActions)}
          helper="Policy blocks"
        />
        <SummaryMetric
          label="Latest Execution"
          value={
            summary.latestExecution?.digest ? (
              <span className="flex min-w-0 flex-col items-start gap-1.5">
                <span className="inline-flex min-w-0 max-w-full items-center gap-1">
                  <CopyableId
                    value={summary.latestExecution.digest}
                    label="latest execution digest"
                    className="min-w-0"
                  />
                  <ExplorerLink digest={summary.latestExecution.digest} />
                </span>
              </span>
            ) : (
              "-"
            )
          }
          helper="Latest successful PTB"
          valueClassName="whitespace-normal font-normal"
        />
      </section>

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {`Unable to load Mandate data from Sui RPC: ${error}`}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Active Mandates</CardTitle>
          <CardDescription>
            Active policy-protected vault permissions available to the Trading
            Agent.
          </CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View all
              <ArrowRight data-icon="inline-end" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          {activeMandates.length > 0 ? (
            <OverviewMandatesTable
              mandates={activeMandates}
              onSelect={onSelectMandate}
            />
          ) : (
            <Empty className="rounded-none border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldOff />
                </EmptyMedia>
                <EmptyTitle>
                  {isWalletScoped
                    ? "No active mandates"
                    : "Connect wallet to view mandates"}
                </EmptyTitle>
                <EmptyDescription>
                  {isWalletScoped
                    ? "Create a mandate to fund a capped vault and authorize autonomous DeepBook execution."
                    : "Connect an owner wallet to inspect active spending mandates."}
                </EmptyDescription>
                {isWalletScoped && (
                  <Button size="sm" onClick={onCreate}>
                    Create Mandate
                  </Button>
                )}
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            On-chain activity proof from Mandate policy objects.
          </CardDescription>
          <CardAction>
            <Link
              href="/console/activity"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              View all
              <ArrowRight data-icon="inline-end" />
            </Link>
          </CardAction>
        </CardHeader>
        <CardContent className="py-0">
          {recentActivity.length > 0 ? (
            <ActivityFeed events={recentActivity} />
          ) : (
            <Empty className="rounded-none border-0 py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ShieldOff />
                </EmptyMedia>
                <EmptyTitle>No on-chain activity yet</EmptyTitle>
                <EmptyDescription>
                  Create or run a mandate to generate ActivityEvents.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
