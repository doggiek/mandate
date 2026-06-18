"use client"

import { AgentExecutionPanel } from "@/components/agent-execution-panel"

export function AutomationView({
  onSelectMandate,
}: {
  onSelectMandate: (id: string) => void
}) {
  return <AgentExecutionPanel onSelectMandate={onSelectMandate} />
}
