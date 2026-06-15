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
import { Button, buttonVariants } from "@/components/ui/button";
import { AgentExecutionPanel } from "@/components/agent-execution-panel";
import { MandateTable } from "@/components/mandate-table";
import { ActivityFeed } from "@/components/activity-feed";
import { CopyableId } from "@/components/copyable-id";
import { ExplorerLink } from "@/components/explorer-link";
import { Skeleton } from "@/components/ui/skeleton";
import { sortActivitiesByTimeDesc } from "@/lib/activity-utils";
import { formatSui } from "@/lib/format";
import { useMandateStore } from "@/lib/mandate-store";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";

function SummaryMetricSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[92px] rounded-xl border border-border bg-card p-3"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function MiniMetricsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="min-h-[92px] rounded-xl border border-border bg-card/50 p-3"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-6 w-24" />
          <Skeleton className="mt-2 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function ConsoleOverviewSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <SummaryMetricSkeleton />
      <MiniMetricsSkeleton />
    </section>
  );
}

function RunAgentSkeleton() {
  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="border-b border-border">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-3 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        <Skeleton className="h-8 w-full rounded-lg" />
        <section className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[58px] rounded-lg" />
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[132px] rounded-lg" />
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </section>
      </CardContent>
    </Card>
  );
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <ConsoleOverviewSkeleton />
      <RunAgentSkeleton />
      <OverviewListSkeleton />
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  helper,
  mini = false,
  title,
}: {
  label: string;
  value: React.ReactNode;
  helper: string;
  mini?: boolean;
  title?: string;
}) {
  return (
    <div
      className={
        mini
          ? "flex min-h-[92px] min-w-0 flex-col justify-between rounded-xl border border-border bg-card/50 p-3"
          : "flex min-h-[92px] min-w-0 flex-col justify-between rounded-xl border border-border bg-card p-3"
      }
    >
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <div
        className="mt-2 min-w-0 truncate font-mono text-xl font-semibold leading-tight tracking-tight text-foreground"
        title={title}
      >
        {value}
      </div>
      <p className="mt-1 truncate text-[11px] text-muted-foreground/70">
        {helper}
      </p>
    </div>
  );
}

function OverviewListSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="border-b border-border">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-60" />
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="border-b border-border">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-40" />
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
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
    () => mandates.filter((m) => m.status === "active"),
    [mandates],
  );

  const stats = React.useMemo(() => {
    const activeAgentKeys = new Set(
      activeMandates
        .map((mandate) => mandate.agentAddress)
        .filter((address): address is string => Boolean(address))
        .map((address) => address.toLowerCase()),
    );
    const authorizedBudget = activeMandates.reduce(
      (sum, mandate) => sum + mandate.budget,
      0,
    );
    const successfulOrders = orders.filter(
      (order) => order.status !== "failed",
    );
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
    const latestExecution = [...successfulOrders].sort(
      (a, b) => b.timestamp - a.timestamp,
    )[0];

    return {
      activeAgents: activeAgentKeys.size,
      activeMandates: activeMandates.length,
      authorizedBudget,
      deepBookExecutions: successfulOrders.length,
      totalExecutedAmount,
      blockedActions: blockedActivities.length,
      totalBlockedAmount,
      latestExecution,
    };
  }, [activeMandates, activity, orders]);
  const recentActivity = React.useMemo(
    () => sortActivitiesByTimeDesc(activity).slice(0, 5),
    [activity],
  );
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
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Summary</h2>
          <p className="text-sm text-muted-foreground">
            Delegated agent spending, executions, and policy blocks
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryMetricCard
            label="Active Agents"
            value={String(stats.activeAgents)}
            helper="Authorized executors"
          />
          <SummaryMetricCard
            label="Active Mandates"
            value={String(stats.activeMandates)}
            helper={`${formatSui(stats.authorizedBudget)} delegated`}
          />
          <SummaryMetricCard
            label="Executed Volume"
            value={formatSui(stats.totalExecutedAmount)}
            helper={`${stats.deepBookExecutions} DeepBook runs`}
          />
          <SummaryMetricCard
            label="Blocked Volume"
            value={formatSui(stats.totalBlockedAmount)}
            helper={`${stats.blockedActions} policy blocks`}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryMetricCard
            mini
            label="DeepBook Executions"
            value={String(stats.deepBookExecutions)}
            helper="Successful swaps"
          />
          <SummaryMetricCard
            mini
            label="Blocked Actions"
            value={String(stats.blockedActions)}
            helper="Prevented by policy"
          />
          <SummaryMetricCard
            mini
            label="Latest Execution"
            value={
              stats.latestExecution?.digest ? (
                <span className="inline-flex min-w-0 items-center gap-1">
                  <CopyableId
                    value={stats.latestExecution.digest}
                    label="latest execution digest"
                  />
                  <ExplorerLink digest={stats.latestExecution.digest} />
                </span>
              ) : (
                "-"
              )
            }
            helper="Most recent successful PTB"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Policy rules: Max tx, budget, expiry, and revoke are enforced before
          execution.
        </p>
      </section>

      <AgentExecutionPanel />

      {error && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {`Unable to load Mandate data from Sui RPC: ${error}`}
          </CardContent>
        </Card>
      )}

      {isWalletScoped && activeMandates.length === 0 && (
        <Card className="border-primary/15 bg-card/80">
          <CardContent className="grid gap-3 p-4 sm:grid-cols-4">
            {[
              "Step 1. Create a Mandate",
              "Step 2. Run the Agent",
              "Step 3. Inspect ActivityEvent and DeepBook execution",
              "Step 4. Revoke authority",
            ].map((step) => (
              <div
                key={step}
                className="rounded-lg border border-border bg-background/60 p-3 text-sm font-medium text-foreground"
              >
                {step}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-border">
            <CardTitle>Active mandates</CardTitle>
            <CardDescription>
              Permissions currently delegated to autonomous agents
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
              <div className="p-3">
                <MandateTable
                  mandates={activeMandates.slice(0, 4)}
                  onSelect={onSelectMandate}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  {isWalletScoped
                    ? "No mandates yet. Create a mandate to grant an agent capped DeepBook authority."
                    : "No active mandates yet."}
                </p>
                <Button size="sm" onClick={onCreate}>
                  <Plus data-icon="inline-start" />
                  Create Mandate
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest on-chain actions</CardDescription>
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
            <ActivityFeed events={recentActivity} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
