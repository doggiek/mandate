"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Play, RotateCcw } from "lucide-react"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopyableId, shortId } from "@/components/copyable-id"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  AGENT_WALLET_ADDRESS,
  DEEPBOOK_POOL_KEY,
  VERIFIED_DEEPBOOK_DIGEST,
} from "@/lib/chain-config"
import { formatSui } from "@/lib/format"
import { useMandateStore } from "@/lib/mandate-store"
import { cn } from "@/lib/utils"

type AgentRunResult = {
  digest: string
  status: "SUCCESS" | "FAILED"
  activityEventFound: boolean
  deepBookPoolMutationFound: boolean
  balanceChangeSui: string
  error?: string
}

const AGENT_MISMATCH_MESSAGE =
  "Agent wallet mismatch. The selected mandate must authorize the backend agent wallet."

function ResultField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="rounded-lg border border-border bg-background/60 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          "mt-1 min-w-0 truncate text-sm font-medium text-foreground",
          mono && "font-mono"
        )}
      >
        {value}
      </div>
    </div>
  )
}

function mandateCreatedTime(mandate: { createdAt: string }) {
  return new Date(mandate.createdAt).getTime()
}

function normalizeAgentRunError(message: string) {
  const lower = message.toLowerCase()
  if (
    lower.includes("moveabort") &&
    lower.includes("authorize_deepbook_spend_with_coin") &&
    (lower.includes("abort code: 2") || lower.includes("abort_code: 2"))
  ) {
    return AGENT_MISMATCH_MESSAGE
  }

  return message
}

export function AgentExecutionPanel() {
  const {
    mandates,
    isWalletScoped,
    refreshMandates,
    recordAgentExecution,
  } = useMandateStore()
  const [result, setResult] = React.useState<AgentRunResult | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedMandateId, setSelectedMandateId] = React.useState<string | null>(
    null
  )

  const activeMandates = React.useMemo(() => {
    if (!isWalletScoped) {
      return []
    }

    return [...mandates]
      .filter((mandate) => mandate.status === "active")
      .sort((a, b) => mandateCreatedTime(b) - mandateCreatedTime(a))
  }, [isWalletScoped, mandates])

  React.useEffect(() => {
    const latest = activeMandates[0]
    const stillActive = activeMandates.some(
      (mandate) => mandate.id === selectedMandateId
    )

    if (!stillActive) {
      setSelectedMandateId(latest?.id ?? null)
    }
  }, [activeMandates, selectedMandateId])

  const selectedMandate = React.useMemo(
    () =>
      activeMandates.find((mandate) => mandate.id === selectedMandateId) ??
      activeMandates[0],
    [activeMandates, selectedMandateId]
  )

  const executionSummary = React.useMemo(
    () => [
      {
        label: "Agent Wallet",
        value: selectedMandate
          ? selectedMandate.agentAddress ?? "Not indexed"
          : AGENT_WALLET_ADDRESS,
        copyable: Boolean(selectedMandate?.agentAddress) || !selectedMandate,
      },
      {
        label: "Selected mandate id",
        value: selectedMandate?.id,
        copyable: Boolean(selectedMandate?.id),
      },
      {
        label: "Budget ceiling",
        value: selectedMandate ? formatSui(selectedMandate.budget) : "-",
        copyable: false,
      },
      {
        label: "Max single tx",
        value: selectedMandate ? formatSui(selectedMandate.txLimit) : "-",
        copyable: false,
      },
      {
        label: "Protocol",
        value: selectedMandate?.protocol ?? selectedMandate?.protocols[0] ?? "DeepBook",
        copyable: false,
      },
      {
        label: "Last verified digest",
        value: VERIFIED_DEEPBOOK_DIGEST,
        copyable: true,
      },
    ],
    [selectedMandate]
  )
  const selectedAgentAddress = selectedMandate?.agentAddress
  const agentWalletMatches =
    Boolean(selectedAgentAddress) &&
    selectedAgentAddress?.toLowerCase() === AGENT_WALLET_ADDRESS.toLowerCase()
  const canRunAgent = Boolean(selectedMandate) && agentWalletMatches

  React.useEffect(() => {
    setResult(null)
    setError(null)
  }, [selectedMandate?.id])

  const runAgent = async () => {
    if (!canRunAgent || !selectedMandate) {
      return
    }

    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mandateId: selectedMandate.id }),
      })
      const payload = (await response.json()) as AgentRunResult
      setResult(payload)

      if (!response.ok || payload.status !== "SUCCESS") {
        setError(normalizeAgentRunError(payload.error ?? "Agent execution failed"))
        return
      }

      recordAgentExecution({
        mandateId: selectedMandate.id,
        digest: payload.digest,
        amountSui: 0.001,
      })
      refreshMandates()
    } catch (caught) {
      setError(
        normalizeAgentRunError(
          caught instanceof Error ? caught.message : "Agent execution failed"
        )
      )
      setResult(null)
    } finally {
      setIsRunning(false)
    }
  }

  const status = result?.status
  const isSuccess = status === "SUCCESS"

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="border-b border-border">
        <CardTitle>Agent Execution</CardTitle>
        <CardDescription>
          Execute a real DeepBook PTB using the selected active Mandate.
        </CardDescription>
        <CardAction>
          <Button
            onClick={runAgent}
            disabled={isRunning || !canRunAgent}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isRunning ? (
              <RotateCcw data-icon="inline-start" className="animate-spin" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            {isRunning ? "Running" : "Run Agent"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Natural language planning is out of scope for MVP; this panel executes a predefined DeepBook strategy. */}
        {activeMandates.length > 1 && (
          <div className="rounded-lg border border-border bg-background/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Select active Mandate
                </p>
                <p className="text-xs text-muted-foreground">
                  Choose which policy object authorizes the predefined DeepBook
                  strategy.
                </p>
              </div>
            </div>
            <Select
              value={selectedMandate?.id}
              onValueChange={(value) => value && setSelectedMandateId(value)}
            >
              <SelectTrigger className="h-auto w-full border-primary/20 bg-primary/5 py-2">
                <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                  <span className="truncate text-sm font-medium">
                    {selectedMandate?.label ?? "Select mandate"}
                  </span>
                  {selectedMandate && (
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {shortId(selectedMandate.id)}
                    </span>
                  )}
                </span>
              </SelectTrigger>
              <SelectContent align="start" className="w-[min(560px,calc(100vw-2rem))]">
                <SelectGroup>
                  {activeMandates.map((mandate) => (
                    <SelectItem
                      key={mandate.id}
                      value={mandate.id}
                      className="py-2"
                    >
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-medium">
                          {mandate.label}
                        </span>
                        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="font-mono">{shortId(mandate.id)}</span>
                          <span>Budget {formatSui(mandate.budget)}</span>
                          <span>Max {formatSui(mandate.txLimit)}</span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {executionSummary.map((item) => (
            <ResultField
              key={item.label}
              label={item.label}
              value={
                item.copyable && item.value ? (
                  <CopyableId value={item.value} label={item.label.toLowerCase()} />
                ) : (
                  item.value ?? "-"
                )
              }
              mono={
                item.label === "Agent Wallet" ||
                item.label === "Selected mandate id" ||
                item.label === "Last verified digest"
              }
            />
          ))}
        </div>

        {!selectedMandate && (
          <Alert className="border-amber-500/25 bg-amber-500/10">
            <AlertCircle className="size-4 text-amber-400" />
            <AlertTitle>Create an active mandate before running the agent.</AlertTitle>
            <AlertDescription>
              Run Agent needs an active shared Mandate object from the current
              wallet so the backend PTB can authorize spend against the right id.
            </AlertDescription>
          </Alert>
        )}

        {selectedMandate && !agentWalletMatches && (
          <Alert className="border-amber-500/25 bg-amber-500/10">
            <AlertCircle className="size-4 text-amber-400" />
            <AlertTitle>
              This mandate is assigned to a different agent wallet.
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <span className="block">
                Create a mandate for the configured backend agent.
              </span>
              <span className="block">
                Configured backend agent{" "}
                <CopyableId
                  value={AGENT_WALLET_ADDRESS}
                  label="backend agent wallet"
                />
              </span>
            </AlertDescription>
          </Alert>
        )}

        {result ? (
          <>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <ResultField
                label="Selected mandate id"
                value={
                  selectedMandate ? (
                    <CopyableId value={selectedMandate.id} label="mandate id" />
                  ) : (
                    "Not selected"
                  )
                }
                mono
              />
              <ResultField
                label="Digest"
                value={
                  result.digest ? (
                    <CopyableId value={result.digest} label="digest" />
                  ) : (
                    "Not returned"
                  )
                }
                mono
              />
              <ResultField
                label="Status"
                value={
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-medium",
                      isSuccess
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                        : "border-destructive/30 bg-destructive/10 text-destructive"
                    )}
                  >
                    {result.status}
                  </Badge>
                }
              />
              <ResultField
                label="ActivityEvent"
                value={result.activityEventFound ? "FOUND" : "MISSING"}
              />
              <ResultField
                label="DeepBook Pool Mutation"
                value={result.deepBookPoolMutationFound ? "FOUND" : "MISSING"}
              />
              <ResultField
                label="SUI balance change"
                value={result.balanceChangeSui}
                mono
              />
            </div>

            {isSuccess ? (
              <Alert className="border-primary/25 bg-primary/10">
                <CheckCircle2 className="size-4 text-primary" />
                <AlertTitle>Agent execution completed</AlertTitle>
                <AlertDescription>
                  Mandate authorization and DeepBook swap result were returned
                  by the server-side wrapper.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert
                variant="destructive"
                className="border-destructive/30 bg-destructive/10"
              >
                <AlertCircle className="size-4" />
                <AlertTitle>Error running agent</AlertTitle>
                <AlertDescription className="space-y-2">
                  <span className="block">
                    {error ?? result.error ?? "No failure reason returned."}
                  </span>
                  {selectedMandate && (
                    <span className="block">
                      Selected mandate{" "}
                      <CopyableId value={selectedMandate.id} label="mandate id" />
                    </span>
                  )}
                  <span className="block">
                    Check whether the mandate is active and budget remains
                    available.
                  </span>
                </AlertDescription>
              </Alert>
            )}
          </>
        ) : error ? (
          <Alert
            variant="destructive"
            className="border-destructive/30 bg-destructive/10"
          >
            <AlertCircle className="size-4" />
            <AlertTitle>Error running agent</AlertTitle>
            <AlertDescription className="space-y-2">
              <span className="block">{error}</span>
              {selectedMandate && (
                <span className="block">
                  Selected mandate{" "}
                  <CopyableId value={selectedMandate.id} label="mandate id" />
                </span>
              )}
              <span className="block">
                Check whether the mandate is active and budget remains
                available.
              </span>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground">
            No run yet. Click Run Agent to execute the verified DeepBook PTB and
            stream the result back into the console.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
