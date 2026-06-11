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
import { StatCard } from "@/components/stat-card"
import { MandateTable } from "@/components/mandate-table"
import { ActivityFeed } from "@/components/activity-feed"
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
  const { mandates, activity } = useMandateStore()

  const stats = React.useMemo(() => {
    return {
      activeAgents: 1,
      activeMandates: 1,
      deepBookExecutions: 2,
      blockedActions: 1,
    }
  }, [])

  const activeMandates = mandates.filter((m) => m.status === "active")

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
          sublabel="DeepBook only"
          icon={ShieldCheck}
        />
        <StatCard
          label="DeepBook Executions"
          value={String(stats.deepBookExecutions)}
          sublabel="DEEP_SUI PTBs"
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
                  No active mandates yet.
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
