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
import { CopyableId } from "@/components/copyable-id"
import {
  CURRENT_MANDATE_ID,
  DEEPBOOK_POOL_KEY,
  VERIFIED_DEEPBOOK_DIGEST,
} from "@/lib/chain-config"
import { cn } from "@/lib/utils"

type AgentRunResult = {
  digest: string
  status: "SUCCESS" | "FAILED"
  activityEventFound: boolean
  deepBookPoolMutationFound: boolean
  balanceChangeSui: string
  error?: string
}

const AGENT_WALLET_ADDRESS =
  "0x91dc52b8d4b6e7815f4c7a2fb9b4384f7b32d1f0c69a4f1be265a8d94dd8b2c1"

const EXECUTION_SUMMARY = [
  { label: "Agent Wallet", value: AGENT_WALLET_ADDRESS, copyable: true },
  { label: "Mandate ID", value: CURRENT_MANDATE_ID, copyable: true },
  {
    label: "Strategy",
    value: `Swap 0.001 SUI through DeepBook ${DEEPBOOK_POOL_KEY}`,
    copyable: false,
  },
  {
    label: "Policy",
    value: "DeepBook only / Max tx 0.01 SUI / 24h expiry",
    copyable: false,
  },
  {
    label: "Last verified digest",
    value: VERIFIED_DEEPBOOK_DIGEST,
    copyable: true,
  },
] as const

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

export function AgentExecutionPanel() {
  const [result, setResult] = React.useState<AgentRunResult | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const runAgent = async () => {
    setIsRunning(true)
    setError(null)

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
      })
      const payload = (await response.json()) as AgentRunResult
      setResult(payload)

      if (!response.ok || payload.status !== "SUCCESS") {
        setError(payload.error ?? "Agent execution failed")
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agent execution failed")
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
          Run the verified DeepBook PTB through the backend wrapper.
        </CardDescription>
        <CardAction>
          <Button
            onClick={runAgent}
            disabled={isRunning}
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
        <div className="grid gap-3 md:grid-cols-5">
          {EXECUTION_SUMMARY.map((item) => (
            <ResultField
              key={item.label}
              label={item.label}
              value={
                item.copyable ? (
                  <CopyableId value={item.value} label={item.label.toLowerCase()} />
                ) : (
                  item.value
                )
              }
              mono={item.label !== "Strategy" && item.label !== "Policy"}
            />
          ))}
        </div>

        {result ? (
          <>
            <div className="grid gap-3 md:grid-cols-5">
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
                value={result.activityEventFound ? "FOUND" : "NOT FOUND"}
              />
              <ResultField
                label="DeepBook Pool Mutation"
                value={result.deepBookPoolMutationFound ? "FOUND" : "NOT FOUND"}
              />
              <ResultField
                label="Balance Change"
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
                <AlertTitle>Agent execution failed</AlertTitle>
                <AlertDescription>
                  {error ?? result.error ?? "No failure reason returned."}
                </AlertDescription>
              </Alert>
            )}
          </>
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
