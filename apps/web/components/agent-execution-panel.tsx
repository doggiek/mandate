"use client"

import * as React from "react"
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Play,
  RotateCcw,
} from "lucide-react"

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
import { ExplorerLink } from "@/components/explorer-link"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import {
  DEEPBOOK_POOL_KEY,
  DEEPBOOK_POOL_ID,
  VERIFIED_AGENT_ADDRESS,
} from "@/lib/chain-config"
import { formatSui, stableExpiryLabel } from "@/lib/format"
import { useMandateStore } from "@/lib/mandate-store"
import { cn } from "@/lib/utils"

type AgentRunResult = {
  digest: string
  status: "SUCCESS" | "BLOCKED" | "FAILED"
  activityEventFound: boolean
  deepBookPoolMutationFound: boolean
  balanceChangeSui: string
  gasFeeSui: string
  blockedReason?: string
  error?: string
}

type StrategyKey =
  | "normal"
  | "exceed_per_tx"
  | "exceed_budget"
  | "revoked_expired"

const STRATEGIES: Record<
  StrategyKey,
  {
    label: string
    description: string
    expectation: string
  }
> = {
  normal: {
    label: "Normal order",
    description: "Swap 0.001 SUI through DeepBook.",
    expectation: "Executed",
  },
  exceed_per_tx: {
    label: "Per-tx guard",
    description: "Attempt an amount above max single tx.",
    expectation: "Blocked",
  },
  exceed_budget: {
    label: "Budget guard",
    description: "Attempt an amount above remaining budget.",
    expectation: "Blocked",
  },
  revoked_expired: {
    label: "Revocation / expiry guard",
    description: "Verify inactive mandates cannot be used.",
    expectation: "Blocked",
  },
}

const AGENT_MISMATCH_MESSAGE =
  "Agent wallet mismatch. The selected mandate must authorize the backend agent wallet."
const PACKAGE_VERSION_MISMATCH_MESSAGE =
  "Blocked event requires the latest Mandate package. Update PACKAGE_ID after publishing the upgraded contract."

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
    <div className="flex min-h-[76px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          "mt-2 min-w-0 truncate text-sm font-medium text-foreground",
          mono && "font-mono"
        )}
      >
        {value ?? "-"}
      </div>
    </div>
  )
}

function SummaryChip({
  label,
  value,
  mono = false,
  title,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
  title?: string
}) {
  return (
    <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <div
        className={cn(
          "mt-2 min-w-0 truncate text-sm font-medium text-foreground",
          mono && "font-mono"
        )}
        title={title}
      >
        {value ?? "-"}
      </div>
    </div>
  )
}

function mandateCreatedTime(mandate: { createdAt: string }) {
  return new Date(mandate.createdAt).getTime()
}

function mandateExpiryLabel(mandate: {
  expiresAt: string
  expiresLabel?: string
  status: "active" | "expired" | "revoked"
}) {
  if (mandate.status === "expired") {
    return "Expired"
  }
  return mandate.expiresLabel ?? stableExpiryLabel(mandate.expiresAt, mandate.status)
}

function normalizeAgentRunError(message: string) {
  const lower = message.toLowerCase()
  if (
    lower.includes("record_blocked_action") &&
    (lower.includes("unable to find function") || lower.includes("function"))
  ) {
    return PACKAGE_VERSION_MISMATCH_MESSAGE
  }

  if (
    lower.includes("moveabort") &&
    lower.includes("authorize_deepbook_spend_with_coin") &&
    (lower.includes("abort code: 2") || lower.includes("abort_code: 2"))
  ) {
    return AGENT_MISMATCH_MESSAGE
  }

  return message
}

function isPackageVersionMismatch(message?: string | null) {
  if (!message) {
    return false
  }

  const lower = message.toLowerCase()
  return (
    message === PACKAGE_VERSION_MISMATCH_MESSAGE ||
    (lower.includes("record_blocked_action") &&
      (lower.includes("unable to find function") || lower.includes("function")))
  )
}

function parseSuiBalanceChange(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*SUI$/i)
  return match ? Number(match[1]) : undefined
}

function parseSuiAmount(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*SUI$/i)
  return match ? Number(match[1]) : undefined
}

function strategyAmount(strategy: StrategyKey, mandate?: {
  budget: number
  spent: number
  txLimit: number
}) {
  if (!mandate) {
    return 0.001
  }

  const remaining = Math.max(mandate.budget - mandate.spent, 0)
  if (strategy === "exceed_per_tx") {
    return Number((mandate.txLimit + 0.001).toFixed(6))
  }
  if (strategy === "exceed_budget") {
    return Number((remaining + 0.001).toFixed(6))
  }

  return 0.001
}

function strategyBlockedReason(reason?: string) {
  switch (reason) {
    case "exceeds_per_tx_cap":
      return "exceeds per-tx cap"
    case "exceeds_remaining_budget":
      return "exceeds remaining budget"
    case "mandate_inactive_or_expired":
      return "mandate inactive or expired"
    default:
      return reason ?? "Move policy rejected the agent action"
  }
}

function isStrategyDisabled(
  strategy: StrategyKey,
  mandate?: { status: "active" | "expired" | "revoked" }
) {
  if (!mandate) {
    return true
  }

  if (mandate.status === "active") {
    return strategy === "revoked_expired"
  }

  return strategy !== "revoked_expired"
}

function mandateStatusDot(status: "active" | "expired" | "revoked") {
  if (status === "active") {
    return "bg-emerald-400"
  }
  if (status === "revoked") {
    return "bg-destructive"
  }
  return "bg-muted-foreground"
}

export function AgentExecutionPanel() {
  const {
    mandates,
    loading,
    isWalletScoped,
    refreshMandates,
    recordAgentExecution,
    recordBlockedAction,
  } = useMandateStore()
  const [result, setResult] = React.useState<AgentRunResult | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [strategy, setStrategy] = React.useState<StrategyKey>("normal")
  const [selectedMandateId, setSelectedMandateId] = React.useState<string | null>(
    null
  )

  const selectableMandates = React.useMemo(() => {
    if (!isWalletScoped) {
      return []
    }

    return [...mandates].sort((a, b) => mandateCreatedTime(b) - mandateCreatedTime(a))
  }, [isWalletScoped, mandates])

  const activeMandates = React.useMemo(() => {
    return selectableMandates
      .filter((mandate) => mandate.status === "active")
  }, [selectableMandates])

  React.useEffect(() => {
    const latest = activeMandates[0]
    const stillPresent = selectableMandates.some(
      (mandate) => mandate.id === selectedMandateId
    )

    if (!stillPresent) {
      setSelectedMandateId(latest?.id ?? selectableMandates[0]?.id ?? null)
    }
  }, [activeMandates, selectableMandates, selectedMandateId])

  const selectedMandate = React.useMemo(
    () =>
      selectableMandates.find((mandate) => mandate.id === selectedMandateId) ??
      activeMandates[0] ??
      selectableMandates[0],
    [activeMandates, selectableMandates, selectedMandateId]
  )

  const selectedAmountSui = React.useMemo(
    () => strategyAmount(strategy, selectedMandate),
    [selectedMandate, strategy]
  )

  const mandateSummary = React.useMemo(
    () => [
      {
        label: "Agent Wallet",
        value: selectedMandate?.agentAddress,
        copyable: Boolean(selectedMandate?.agentAddress),
      },
      {
        label: "Mandate ID",
        value: selectedMandate?.id,
        copyable: Boolean(selectedMandate?.id),
      },
      {
        label: "Budget",
        value: selectedMandate
          ? `${formatSui(selectedMandate.spent)} / ${formatSui(selectedMandate.budget)}`
          : "-",
        copyable: false,
      },
      {
        label: "Max tx",
        value: selectedMandate ? formatSui(selectedMandate.txLimit) : "-",
        copyable: false,
      },
      {
        label: "Expires",
        value: selectedMandate ? mandateExpiryLabel(selectedMandate) : "-",
        copyable: false,
      },
      {
        label: "Created",
        value: selectedMandate?.createdAtDisplay ?? "-",
        copyable: false,
      },
    ],
    [selectedMandate]
  )
  const selectedAgentAddress = selectedMandate?.agentAddress
  const selectedProtocol =
    selectedMandate?.protocol ?? selectedMandate?.protocols[0]
  const agentWalletMatches =
    Boolean(selectedAgentAddress) &&
    selectedAgentAddress?.toLowerCase() === VERIFIED_AGENT_ADDRESS.toLowerCase()
  const protocolAllowed = selectedProtocol === "DeepBook"
  const remainingBudget = selectedMandate
    ? Math.max(selectedMandate.budget - selectedMandate.spent, 0)
    : 0
  const canRunAgent =
    Boolean(selectedMandate) &&
    agentWalletMatches &&
    protocolAllowed &&
    !isStrategyDisabled(strategy, selectedMandate)
  React.useEffect(() => {
    setResult(null)
    setError(null)
  }, [selectedMandate?.id, strategy])

  React.useEffect(() => {
    if (
      selectedMandate &&
      isStrategyDisabled(strategy, selectedMandate)
    ) {
      setStrategy(selectedMandate.status === "active" ? "normal" : "revoked_expired")
    }
  }, [selectedMandate, strategy])

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
        body: JSON.stringify({
          mandateId: selectedMandate.id,
          strategy,
          amountSui: selectedAmountSui,
          mandateMetadata: {
            budgetSui: selectedMandate.budget,
            spentSui: selectedMandate.spent,
            remainingSui: remainingBudget,
            maxSingleTxSui: selectedMandate.txLimit,
            protocol: selectedProtocol,
            status: selectedMandate.status,
          },
        }),
      })
      const payload = (await response.json()) as AgentRunResult
      setResult(payload)

      if (payload.status === "BLOCKED") {
        const reason = payload.blockedReason ?? "Move policy rejected the agent action"
        recordBlockedAction({
          mandateId: selectedMandate.id,
          digest: payload.digest,
          amountSui: selectedAmountSui,
          reason,
        })
        setError(null)
        refreshMandates()
        return
      }

      if (!response.ok || payload.status !== "SUCCESS") {
        setError(normalizeAgentRunError(payload.error ?? "Agent execution failed"))
        return
      }

      recordAgentExecution({
        mandateId: selectedMandate.id,
        digest: payload.digest,
        pair: DEEPBOOK_POOL_KEY,
        side: "Buy",
        amountSui: selectedAmountSui,
        suiBalanceChange: parseSuiBalanceChange(payload.balanceChangeSui),
        gasFeeSui: parseSuiAmount(payload.gasFeeSui),
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
  const isBlocked = status === "BLOCKED"

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="border-b border-border">
        <CardTitle>Run Agent Strategy</CardTitle>
        <CardDescription>
          Run the backend agent under a selected Mandate; reconnect Slush if the
          owner wallet changed.
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
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Select Mandate
          </h3>
          {loading ? (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <Skeleton className="h-9 w-full" />
            </div>
          ) : selectableMandates.length > 0 && (
            <div className="rounded-lg border border-border bg-background/60 p-3">
            <Select
              value={selectedMandate?.id}
              onValueChange={(value) => value && setSelectedMandateId(value)}
            >
              <SelectTrigger className="h-auto w-full border-primary/20 bg-primary/5 py-2">
                <span className="min-w-0 truncate text-left text-sm font-medium">
                  {selectedMandate
                    ? `${selectedMandate.label} (${shortId(selectedMandate.id)})`
                    : "Select mandate"}
                </span>
              </SelectTrigger>
              <SelectContent align="start" className="w-[min(560px,calc(100vw-2rem))]">
                <SelectGroup>
                  {selectableMandates.map((mandate) => (
                    <SelectItem
                      key={mandate.id}
                      value={mandate.id}
                      className="py-2"
                    >
                      <span className="flex min-w-0 items-start gap-2">
                        <span
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            mandateStatusDot(mandate.status)
                          )}
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate font-medium">
                            {mandate.label}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            <span className="font-mono">{shortId(mandate.id)}</span>
                            {" · "}
                            <span className="capitalize">{mandate.status}</span>
                            {" · "}Budget {formatSui(mandate.budget)}
                            {" · "}Max {formatSui(mandate.txLimit)}
                            {" · "}Created {mandate.createdAtDisplay ?? "-"}
                            {" · "}Expires {mandateExpiryLabel(mandate)}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            </div>
          )}

          {loading ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-[58px] rounded-lg" />
              ))}
            </div>
          ) : selectedMandate && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {mandateSummary.map((item) => (
                <SummaryChip
                  key={item.label}
                  label={item.label}
                  value={
                    item.copyable && item.value ? (
                      <CopyableId value={item.value} label={item.label.toLowerCase()} />
                    ) : (
                      item.value ?? "-"
                    )
                  }
                  mono={item.label === "Agent Wallet" || item.label === "Mandate ID"}
                  title={typeof item.value === "string" ? item.value : undefined}
                />
              ))}
            </div>
          )}

          {selectedMandate && !agentWalletMatches && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              This mandate authorizes a different agent wallet. Create a mandate
              for the verified backend agent.
            </div>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Select Strategy
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(STRATEGIES).map(([key, option]) => {
            const value = key as StrategyKey
            const selected = strategy === value
            const isExpectedExecuted = option.expectation === "Executed"
            const disabled = isStrategyDisabled(value, selectedMandate)

            return (
              <button
                key={key}
                type="button"
                onClick={() => !disabled && setStrategy(value)}
                disabled={disabled}
                className={cn(
                  "flex min-h-[132px] flex-col items-start gap-3 rounded-lg border bg-background/60 p-3 text-left transition",
                  "hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                  disabled && "cursor-not-allowed opacity-45 hover:border-border hover:bg-background/60",
                  selected
                    ? "border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                    : "border-border"
                )}
                aria-pressed={selected}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">
                    {option.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[11px] font-medium",
                      isExpectedExecuted
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                        : "border-amber-500/25 bg-amber-500/10 text-amber-400"
                    )}
                  >
                    Expected: {option.expectation}
                  </Badge>
                </div>
                <span className="text-sm leading-snug text-muted-foreground">
                  {option.description}
                </span>
                <span className="mt-auto font-mono text-xs text-muted-foreground">
                  Input {formatSui(strategyAmount(value, selectedMandate))}
                </span>
              </button>
            )
          })}
          </div>
        </section>

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

        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Execution Result
          </h3>
          {result ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ResultField
                  label="Status"
                  value={
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-medium",
                        isSuccess
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                          : isBlocked
                            ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                            : "border-destructive/30 bg-destructive/10 text-destructive"
                      )}
                    >
                      {result.status}
                    </Badge>
                  }
                />
                <ResultField
                  label="Strategy"
                  value={STRATEGIES[strategy].label}
                />
                <ResultField
                  label="Input amount"
                  value={formatSui(selectedAmountSui)}
                  mono
                />
                <ResultField
                  label="Digest"
                  value={
                    result.digest ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <CopyableId value={result.digest} label="digest" />
                        <ExplorerLink digest={result.digest} />
                      </span>
                    ) : (
                      "-"
                    )
                  }
                  mono
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ResultField
                  label="Mandate ID"
                  value={
                    selectedMandate ? (
                      <CopyableId value={selectedMandate.id} label="mandate id" />
                    ) : (
                      "-"
                    )
                  }
                  mono
                />
                <ResultField
                  label="ActivityEvent"
                  value={
                    result.activityEventFound && result.digest ? (
                      <CopyableId value={result.digest} label="activity event digest" />
                    ) : (
                      "-"
                    )
                  }
                  mono={result.activityEventFound && Boolean(result.digest)}
                />
                <ResultField
                  label="DeepBook Pool Object"
                  value={
                    result.deepBookPoolMutationFound ? (
                      <CopyableId
                        value={DEEPBOOK_POOL_ID}
                        label="DeepBook pool object id"
                      />
                    ) : (
                      "-"
                    )
                  }
                  mono={result.deepBookPoolMutationFound}
                />
                <ResultField
                  label="Gas Fee"
                  value={result.gasFeeSui || "-"}
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
              ) : isBlocked ? (
                <Alert className="border-amber-500/25 bg-amber-500/10">
                  <Ban className="size-4 text-amber-400" />
                  <AlertTitle>Agent action blocked by Mandate policy</AlertTitle>
                  <AlertDescription className="mt-2 space-y-3 text-sm">
                    <p>
                      Policy block recorded on-chain. No DeepBook order was
                      submitted.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <span>
                      Attempted amount:{" "}
                      <span className="font-mono text-foreground">
                        {formatSui(selectedAmountSui)}
                      </span>
                    </span>
                    <span>
                      Remaining budget:{" "}
                      <span className="font-mono text-foreground">
                        {formatSui(remainingBudget)}
                      </span>
                    </span>
                    <span>
                      Max single tx:{" "}
                      <span className="font-mono text-foreground">
                        {selectedMandate ? formatSui(selectedMandate.txLimit) : "-"}
                      </span>
                    </span>
                    <span>
                      Block reason:{" "}
                      <span className="text-foreground">
                        {strategyBlockedReason(result.blockedReason)}
                      </span>
                    </span>
                    </div>
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
                    {!isPackageVersionMismatch(error ?? result.error) && (
                      <span className="block">
                        Check whether the mandate is active and budget remains
                        available.
                      </span>
                    )}
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
              {!isPackageVersionMismatch(error) && (
                <span className="block">
                  Check whether the mandate is active and budget remains
                  available.
                </span>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground">
            No execution yet.
          </div>
        )}
        </section>
      </CardContent>
    </Card>
  )
}
