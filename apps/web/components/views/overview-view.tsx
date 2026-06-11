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
import { Button } from "@/components/ui/button"
import { AgentExecutionPanel } from "@/components/agent-execution-panel"
import { WalletSummary } from "@/components/wallet-summary"
import { StatCard } from "@/components/stat-card"
import { MandateTable } from "@/components/mandate-table"
import { ActivityFeed } from "@/components/activity-feed"
import { DEEPBOOK_POOL_KEY } from "@/lib/chain-config"
import { formatSui } from "@/lib/format"
import { useMandateStore } from "@/lib/mandate-store"
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Zap,
} from "lucide-react"

export function OverviewView({
  onSelectMandate,
  onCreate,
  onViewAll,
}: {
  onSelectMandate: (id: string) => void
  onCreate: () => void
  onViewAll: () => void
}) {
  const { mandates, activity, orders, loading, error, isWalletScoped } = useMandateStore()
  const activeMandates = React.useMemo(
    () => mandates.filter((m) => m.status === "active"),
    [mandates]
  )

  const stats = React.useMemo(() => {
    const activeAgentKeys = new Set(
      activeMandates
        .map((mandate) => mandate.agentAddress)
        .filter((address): address is string => Boolean(address))
    )
    const authorizedBudget = activeMandates.reduce(
      (sum, mandate) => sum + mandate.budget,
      0
    )

    return {
      activeAgents: activeAgentKeys.size,
      activeMandates: activeMandates.length,
      authorizedBudget,
      deepBookExecutions: orders.length,
      blockedActions: activity.filter((event) => event.kind === "tx.blocked").length,
    }
  }, [activeMandates, activity, orders.length])

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active Agents"
          value={String(stats.activeAgents)}
          sublabel="Authorized agent wallet"
          icon={Bot}
        />
        <StatCard
          label="Active Mandates"
          value={String(stats.activeMandates)}
          sublabel={`${formatSui(stats.authorizedBudget)} authorized`}
          icon={ShieldCheck}
        />
        <StatCard
          label="DeepBook Executions"
          value={String(stats.deepBookExecutions)}
          sublabel={`${DEEPBOOK_POOL_KEY} PTBs`}
          icon={CheckCircle2}
          accent="positive"
        />
        <StatCard
          label="Blocked Actions"
          value={String(stats.blockedActions)}
          sublabel="Move policy enforced"
          icon={Zap}
          accent="warning"
        />
      </section>

      <WalletSummary />
      {(loading || error) && (
        <Card className={error ? "border-destructive/30" : undefined}>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {loading
              ? "Loading Mandate data from Sui RPC..."
              : `Unable to load Mandate data from Sui RPC: ${error}`}
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
      <AgentExecutionPanel />

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
          </CardHeader>
          <CardContent className="py-0">
            <ActivityFeed events={activity.slice(0, 5)} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
