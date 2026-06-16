"use client"

import * as React from "react"
import Link from "next/link"
import { AlertCircle, Play, RotateCcw } from "lucide-react"
import { useCurrentAccount } from "@mysten/dapp-kit"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ActivityFeed } from "@/components/activity-feed"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  NETWORK,
  PACKAGE_ID,
  isCurrentMandateObjectType,
  BACKEND_AGENT_ADDRESS,
} from "@/lib/chain-config"
import { formatSui, stableExpiryLabel } from "@/lib/format"
import { sortActivitiesByTimeDesc } from "@/lib/activity-utils"
import { useMandateStore } from "@/lib/mandate-store"
import {
  SIGNAL_STRATEGIES,
  defaultSignalStrategy,
  signalStrategyById,
  type SignalDirection,
} from "@/lib/signal-strategies"
import { cn } from "@/lib/utils"

type AgentRunResult = {
  digest: string
  status: "SUCCESS" | "BLOCKED" | "FAILED"
  activityEventFound: boolean
  deepBookPoolMutationFound: boolean
  balanceChangeSui: string
  gasFeeSui: string
  outputAsset?: string
  outputCoinType?: string
  outputAmount?: string
  residualSui?: string
  outputCoinObjectIds?: string[]
  outputOwner?: string
  fillStatus?: "filled" | "no_fill" | "amount_unavailable"
  timestampMs?: number
  blockedReason?: string
  error?: string
}

type StrategyKey =
  | "normal"
  | "exceed_per_tx"
  | "exceed_budget"
  | "revoked_expired"

type RunContext = {
  mandateId: string
  mandateLabel: string
  agentAddress?: string
  amountSui: number
  strategy: StrategyKey
  remainingBudget: number
  txLimit: number
}

type LastRunReceipt = {
  result: AgentRunResult | null
  error: string | null
  context: RunContext | null
}

type AutoRunStatus = "off" | "running" | "stopped" | "error"
type AutoRunInterval = "off" | "30000" | "60000" | "300000"
type ExecutionMode = "test_only" | "auto_execute"
type AutomationSessionState = {
  selectedMandateId: string | null
  autoInterval: AutoRunInterval
  executionMode: ExecutionMode
  signalStrategyId: string
  signalDirection: SignalDirection
  signalThresholdPct: string
  executionAmountSui: string
  executionAsset: "SUI"
  running: boolean
}
type AutomationActiveLock = {
  sessionId: string
  scope: string
  updatedAt: number
}
type SignalStatus = {
  strategyId: string
  signalType: "price_momentum" | "volatility" | "whale_flow" | "ai_signal"
  market: string
  source: "mock" | "deepbook"
  baselineValue: number
  currentValue: number
  changePct: number
  thresholdPct: number
  decision: "waiting" | "triggered"
  reason: string
  checkedAt: string
}

let lastRunReceipt: LastRunReceipt = {
  result: null,
  error: null,
  context: null,
}

const AUTOMATION_SESSION_PREFIX = "mandate:automation-session:v1"
const AUTOMATION_SELECTED_MANDATE_PREFIX =
  "mandate:automation-selected-mandate:v1"
const AUTOMATION_ACTIVE_LOCK_KEY = "mandate:automation-active-session:v1"
const AUTOMATION_LOCK_STALE_MS = 15_000

const AGENT_MISMATCH_MESSAGE =
  "Agent wallet mismatch. The selected mandate must authorize the backend Trading Agent wallet."
const PACKAGE_VERSION_MISMATCH_MESSAGE =
  "Blocked event requires the latest Mandate package. Update PACKAGE_ID after publishing the upgraded contract."
const OLD_PACKAGE_MANDATE_MESSAGE =
  "Selected mandate belongs to an old package. Create a new mandate with the current package."

const AUTO_RUN_INTERVALS: Array<{
  label: string
  value: AutoRunInterval
}> = [
  { label: "Off", value: "off" },
  { label: "30s", value: "30000" },
  { label: "1m", value: "60000" },
  { label: "5m", value: "300000" },
]

const SIGNAL_DIRECTIONS: Array<{ label: string; value: SignalDirection }> = [
  { label: "Up", value: "up" },
  { label: "Down", value: "down" },
  { label: "Either", value: "either" },
]

const EXECUTION_ASSETS = [{ label: "SUI", value: "SUI" as const }]

const EXECUTION_MODES: Array<{ label: string; value: ExecutionMode }> = [
  { label: "Test only", value: "test_only" },
  { label: "Auto execute", value: "auto_execute" },
]

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

function ResultStatusBadge({ status }: { status: AgentRunResult["status"] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        status === "SUCCESS"
          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
          : status === "BLOCKED"
            ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
            : "border-destructive/30 bg-destructive/10 text-destructive"
      )}
    >
      {status}
    </Badge>
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

  if (lower.includes("old package")) {
    return OLD_PACKAGE_MANDATE_MESSAGE
  }

  if (
    lower.includes("moveabort") &&
    lower.includes("authorize_and_take_sui_for_deepbook") &&
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

function belongsToCurrentPackage(mandate?: { objectType?: string }) {
  return Boolean(mandate?.objectType && isCurrentMandateObjectType(mandate.objectType))
}

function parseSuiBalanceChange(value: string) {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*SUI$/i)
  return match ? Number(match[1]) : undefined
}

function parseSuiAmount(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*SUI$/i)
  return match ? Number(match[1]) : undefined
}

function parseExecutionAmount(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function deriveStrategyFromPolicy(
  mandate: { status: "active" | "expired" | "revoked"; budget: number; spent: number; txLimit: number } | undefined,
  amountSui: number
): StrategyKey {
  if (!mandate) {
    return "normal"
  }

  if (mandate.status !== "active") {
    return "revoked_expired"
  }

  if (amountSui > mandate.txLimit) {
    return "exceed_per_tx"
  }

  if (amountSui > Math.max(mandate.budget - mandate.spent, 0)) {
    return "exceed_budget"
  }

  return "normal"
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

function autoRunStatusLabel(status: AutoRunStatus) {
  if (status === "off") {
    return "Off"
  }
  if (status === "running") {
    return "Running"
  }
  if (status === "error") {
    return "Error"
  }
  return "Stopped"
}

function autoRunStatusClass(status: AutoRunStatus) {
  if (status === "running") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
  }
  if (status === "error") {
    return "border-destructive/30 bg-destructive/10 text-destructive"
  }
  if (status === "stopped") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-400"
  }
  return "border-border bg-background/60 text-muted-foreground"
}

function signalDecisionClass(decision?: SignalStatus["decision"]) {
  if (decision === "triggered") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
  }
  return "border-border bg-background/60 text-muted-foreground"
}

function formatSignalValue(value?: number) {
  return typeof value === "number" ? value.toFixed(6) : "-"
}

function formatSignalChange(value?: number) {
  if (typeof value !== "number") {
    return "-"
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`
}

function formatSignalCheckedAt(value?: string) {
  if (!value) {
    return "-"
  }

  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) {
    return "-"
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp)
}

function formatAutoRunTime(timestampMs?: number | null) {
  if (!timestampMs) {
    return "-"
  }

  return new Date(timestampMs).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function readJsonStorage<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJsonStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Demo persistence only; ignore private browsing / quota failures.
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Demo persistence only; ignore private browsing / quota failures.
  }
}

function scopedStorageKey(prefix: string, scope: string) {
  return `${prefix}:${scope}`
}

function activeAutomationLock() {
  return readJsonStorage<AutomationActiveLock>(AUTOMATION_ACTIVE_LOCK_KEY)
}

function isActiveAutomationLock(lock: AutomationActiveLock | null) {
  return Boolean(lock && Date.now() - lock.updatedAt < AUTOMATION_LOCK_STALE_MS)
}

function writeActiveAutomationLock(sessionId: string, scope: string) {
  writeJsonStorage<AutomationActiveLock>(AUTOMATION_ACTIVE_LOCK_KEY, {
    sessionId,
    scope,
    updatedAt: Date.now(),
  })
}

function releaseActiveAutomationLock(sessionId: string) {
  const lock = activeAutomationLock()
  if (!lock || lock.sessionId === sessionId) {
    removeStorage(AUTOMATION_ACTIVE_LOCK_KEY)
  }
}

function releaseActiveAutomationLockForScope(scope: string) {
  const lock = activeAutomationLock()
  if (lock?.scope === scope) {
    removeStorage(AUTOMATION_ACTIVE_LOCK_KEY)
  }
}

function formatCountdown(nextRunAt: number | null, nowMs: number) {
  if (!nextRunAt) {
    return "-"
  }

  const seconds = Math.max(0, Math.ceil((nextRunAt - nowMs) / 1000))
  return `in ${seconds}s`
}

export function AgentExecutionPanel() {
  const account = useCurrentAccount()
  const {
    mandates,
    activity,
    loading,
    isWalletScoped,
    refreshMandates,
    recordAgentExecution,
    recordBlockedAction,
  } = useMandateStore()
  const [result, setResult] = React.useState<AgentRunResult | null>(null)
  const [isRunning, setIsRunning] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selectedMandateId, setSelectedMandateId] = React.useState<string | null>(
    null
  )
  const [runContext, setRunContext] = React.useState<RunContext | null>(null)
  const [autoInterval, setAutoInterval] =
    React.useState<AutoRunInterval>("off")
  const [signalStrategyId, setSignalStrategyId] = React.useState(
    () => defaultSignalStrategy().id
  )
  const [signalDirection, setSignalDirection] =
    React.useState<SignalDirection>(() => defaultSignalStrategy().direction)
  const [signalThresholdPct, setSignalThresholdPct] = React.useState(() =>
    String(defaultSignalStrategy().thresholdPct)
  )
  const [executionMode, setExecutionMode] =
    React.useState<ExecutionMode>("test_only")
  const [executionAmountSui, setExecutionAmountSui] = React.useState("0.001")
  const [executionAsset, setExecutionAsset] = React.useState<"SUI">("SUI")
  const [forceSignalTriggered, setForceSignalTriggered] = React.useState(false)
  const [liveSignal, setLiveSignal] = React.useState<SignalStatus | null>(null)
  const [isCheckingSignal, setIsCheckingSignal] = React.useState(false)
  const [autoStatus, setAutoStatus] = React.useState<AutoRunStatus>("off")
  const [autoMessage, setAutoMessage] = React.useState<string | null>(null)
  const [autoRunCount, setAutoRunCount] = React.useState(0)
  const [autoCheckCount, setAutoCheckCount] = React.useState(0)
  const [autoStartedAt, setAutoStartedAt] = React.useState<number | null>(null)
  const [autoLastDigest, setAutoLastDigest] = React.useState<string | null>(null)
  const [autoNextRunAt, setAutoNextRunAt] = React.useState<number | null>(null)
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  const autoTimerRef = React.useRef<number | null>(null)
  const autoInFlightRef = React.useRef(false)
  const loadedScopeRef = React.useRef<string | null>(null)
  const skipNextPersistRef = React.useRef(false)
  const automationSessionIdRef = React.useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  )
  const selectedSignalStrategy =
    signalStrategyById(signalStrategyId) ?? defaultSignalStrategy()

  React.useEffect(() => {
    setResult(lastRunReceipt.result)
    setError(lastRunReceipt.error)
    setRunContext(lastRunReceipt.context)
  }, [])

  React.useEffect(() => {
    if (autoStatus !== "running") {
      return
    }

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [autoStatus])

  React.useEffect(() => {
    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current)
      }
      releaseActiveAutomationLock(automationSessionIdRef.current)
    }
  }, [])

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

  const currentPackageActiveMandates = React.useMemo(() => {
    return activeMandates.filter((mandate) => belongsToCurrentPackage(mandate))
  }, [activeMandates])
  const ownerPackageScope = React.useMemo(() => {
    const ownerAddress = account?.address
    if (!ownerAddress || !PACKAGE_ID) {
      return null
    }

    return [NETWORK, ownerAddress.toLowerCase(), PACKAGE_ID.toLowerCase()].join(
      ":"
    )
  }, [account?.address])

  React.useEffect(() => {
    if (loading || selectableMandates.length === 0) {
      return
    }

    const latest = currentPackageActiveMandates[0]
    const stillPresent = selectableMandates.some(
      (mandate) => mandate.id === selectedMandateId
    )
    const currentSelection = selectableMandates.find(
      (mandate) => mandate.id === selectedMandateId
    )
    const savedSelectedMandateId = ownerPackageScope
      ? readJsonStorage<string>(
          scopedStorageKey(AUTOMATION_SELECTED_MANDATE_PREFIX, ownerPackageScope)
        )
      : null
    const savedSelection = selectableMandates.find(
      (mandate) => mandate.id === savedSelectedMandateId
    )

    if (!stillPresent || (!belongsToCurrentPackage(currentSelection) && latest)) {
      setSelectedMandateId(savedSelection?.id ?? latest?.id ?? null)
    }
  }, [
    currentPackageActiveMandates,
    loading,
    ownerPackageScope,
    selectableMandates,
    selectedMandateId,
  ])

  React.useEffect(() => {
    if (!ownerPackageScope || !selectedMandateId) {
      return
    }

    writeJsonStorage(
      scopedStorageKey(AUTOMATION_SELECTED_MANDATE_PREFIX, ownerPackageScope),
      selectedMandateId
    )
  }, [ownerPackageScope, selectedMandateId])

  const selectedMandate = React.useMemo(
    () =>
      selectableMandates.find((mandate) => mandate.id === selectedMandateId),
    [selectableMandates, selectedMandateId]
  )
  const selectedMandateActivity = React.useMemo(() => {
    if (!selectedMandate?.id) {
      return []
    }

    return sortActivitiesByTimeDesc(
      activity.filter((event) => event.mandateId === selectedMandate.id)
    ).slice(0, 5)
  }, [activity, selectedMandate?.id])
  const automationScope = React.useMemo(() => {
    const ownerAddress = account?.address
    if (!ownerAddress || !PACKAGE_ID || !selectedMandate?.id) {
      return null
    }

    return [
      NETWORK,
      ownerAddress.toLowerCase(),
      PACKAGE_ID.toLowerCase(),
      selectedMandate.id.toLowerCase(),
    ].join(":")
  }, [account?.address, selectedMandate?.id])

  React.useEffect(() => {
    if (autoStatus !== "running" || !automationScope) {
      return
    }

    writeActiveAutomationLock(automationSessionIdRef.current, automationScope)
    const heartbeat = window.setInterval(() => {
      writeActiveAutomationLock(automationSessionIdRef.current, automationScope)
    }, 5_000)

    return () => window.clearInterval(heartbeat)
  }, [autoStatus, automationScope])

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
    selectedAgentAddress?.toLowerCase() === BACKEND_AGENT_ADDRESS.toLowerCase()
  const protocolAllowed = selectedProtocol === "DeepBook"
  const packageAllowed = belongsToCurrentPackage(selectedMandate)
  const remainingBudget = selectedMandate
    ? Math.max(selectedMandate.budget - selectedMandate.spent, 0)
    : 0
  const actionAmountSui = React.useMemo(
    () => parseExecutionAmount(executionAmountSui),
    [executionAmountSui]
  )
  const actionAmountValid = actionAmountSui > 0
  const policyStrategy = React.useMemo(
    () => deriveStrategyFromPolicy(selectedMandate, actionAmountSui),
    [actionAmountSui, selectedMandate]
  )
  const policyChecks = React.useMemo(
    () => ({
      maxTx: Boolean(selectedMandate && actionAmountValid && actionAmountSui <= selectedMandate.txLimit),
      budget: Boolean(selectedMandate && actionAmountValid && actionAmountSui <= remainingBudget),
      active: selectedMandate?.status === "active",
    }),
    [actionAmountSui, actionAmountValid, remainingBudget, selectedMandate]
  )
  const validateRunStrategy = React.useCallback(
    (runStrategy: StrategyKey) => {
      if (!selectedMandate) {
        return {
          ok: false,
          reason: "Create an active mandate before running the agent.",
        }
      }

      if (!packageAllowed) {
        return {
          ok: false,
          reason: OLD_PACKAGE_MANDATE_MESSAGE,
        }
      }

      if (!agentWalletMatches) {
        return {
          ok: false,
          reason:
            "Selected Mandate must authorize the backend Trading Agent address.",
        }
      }

      if (!protocolAllowed) {
        return {
          ok: false,
          reason: "Selected Mandate must be scoped to DeepBook.",
        }
      }

      if (!actionAmountValid) {
        return {
          ok: false,
          reason: "Enter a positive execution amount.",
        }
      }

      if (isStrategyDisabled(runStrategy, selectedMandate)) {
        return {
          ok: false,
          reason:
            selectedMandate.status === "active"
              ? "Inactive guard only applies to revoked or expired mandates."
              : "Only the inactive guard can run against revoked or expired mandates.",
        }
      }

      if (runStrategy === "normal" && actionAmountSui > remainingBudget) {
        return {
          ok: false,
          reason: "Mandate budget is insufficient for the configured action.",
        }
      }

      return {
        ok: true,
        reason: null,
      }
    },
    [
      actionAmountSui,
      actionAmountValid,
      agentWalletMatches,
      packageAllowed,
      protocolAllowed,
      remainingBudget,
      selectedMandate,
    ]
  )
  const canRunAgent = validateRunStrategy(policyStrategy).ok
  const thresholdPct = React.useMemo(() => {
    const parsed = Number(signalThresholdPct)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5
  }, [signalThresholdPct])
  const thresholdValid = Number.isFinite(Number(signalThresholdPct)) && Number(signalThresholdPct) > 0
  const canStartAutoRun =
    executionMode === "auto_execute" &&
    autoInterval !== "off" &&
    thresholdValid &&
    validateRunStrategy(policyStrategy).ok
  const showMandateLoading = loading && selectableMandates.length === 0 && !result

  const clearRunResult = React.useCallback(() => {
    lastRunReceipt = {
      result: null,
      error: null,
      context: null,
    }
    setResult(null)
    setError(null)
    setRunContext(null)
  }, [])

  const resetAutomationUi = React.useCallback(() => {
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    releaseActiveAutomationLock(automationSessionIdRef.current)
    autoInFlightRef.current = false
    setAutoStatus("off")
    setAutoMessage(null)
    setAutoRunCount(0)
    setAutoCheckCount(0)
    setAutoStartedAt(null)
    setAutoLastDigest(null)
    setAutoNextRunAt(null)
    setLiveSignal(null)
    clearRunResult()
  }, [clearRunResult])

  React.useEffect(() => {
    if (!automationScope) {
      loadedScopeRef.current = null
      resetAutomationUi()
      return
    }

    if (loadedScopeRef.current === automationScope) {
      return
    }

    resetAutomationUi()
    skipNextPersistRef.current = true
    loadedScopeRef.current = automationScope

    const sessionKey = scopedStorageKey(AUTOMATION_SESSION_PREFIX, automationScope)
    const savedSession = readJsonStorage<AutomationSessionState>(sessionKey)
    if (!savedSession || savedSession.selectedMandateId !== selectedMandate?.id) {
      return
    }

    setAutoInterval(savedSession.autoInterval)
    setExecutionMode(savedSession.executionMode)
    setSignalStrategyId(savedSession.signalStrategyId)
    setSignalDirection(savedSession.signalDirection)
    setSignalThresholdPct(savedSession.signalThresholdPct)
    setExecutionAmountSui(savedSession.executionAmountSui ?? "0.001")
    setExecutionAsset(savedSession.executionAsset ?? "SUI")

    if (savedSession.running) {
      releaseActiveAutomationLockForScope(automationScope)
      setAutoStatus("stopped")
      setAutoMessage("Automation session interrupted. Click Start to resume.")
    }
  }, [automationScope, resetAutomationUi, selectedMandate?.id])

  React.useEffect(() => {
    if (!automationScope || loadedScopeRef.current !== automationScope) {
      return
    }
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }

    writeJsonStorage<AutomationSessionState>(
      scopedStorageKey(AUTOMATION_SESSION_PREFIX, automationScope),
      {
        selectedMandateId: selectedMandate?.id ?? null,
        autoInterval,
        executionMode,
        signalStrategyId,
        signalDirection,
        signalThresholdPct,
        executionAmountSui,
        executionAsset,
        running: autoStatus === "running",
      }
    )
  }, [
    autoInterval,
    autoStatus,
    automationScope,
    executionMode,
    executionAmountSui,
    executionAsset,
    selectedMandate?.id,
    signalDirection,
    signalStrategyId,
    signalThresholdPct,
  ])

  const stopAutoRun = React.useCallback(
    (status: AutoRunStatus = "stopped", message?: string) => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current)
        autoTimerRef.current = null
      }
      releaseActiveAutomationLock(automationSessionIdRef.current)
      autoInFlightRef.current = false
      setAutoStatus(status)
      setAutoNextRunAt(null)
      setAutoMessage(message ?? null)
    },
    []
  )

  React.useEffect(() => {
    if (autoStatus !== "running") {
      return
    }

    const validation = validateRunStrategy(policyStrategy)
    if (!validation.ok) {
      stopAutoRun("error", validation.reason ?? "Auto Run stopped.")
    }
  }, [autoStatus, policyStrategy, stopAutoRun, validateRunStrategy])

  React.useEffect(() => {
    if (autoStatus === "running" && executionMode !== "auto_execute") {
      stopAutoRun("stopped", "Automation stopped after switching to Test only mode.")
    }
  }, [autoStatus, executionMode, stopAutoRun])

  const handleMandateChange = React.useCallback(
    (value: string | null) => {
      if (!value || value === selectedMandateId) {
        return
      }

      if (autoStatus === "running") {
        stopAutoRun("stopped", "Auto Run stopped after mandate change.")
      }
      setSelectedMandateId(value)
      clearRunResult()
    },
    [autoStatus, clearRunResult, selectedMandateId, stopAutoRun]
  )

  const handleSignalStrategyChange = React.useCallback((value: string) => {
    const nextStrategy = signalStrategyById(value)
    if (!nextStrategy || nextStrategy.status !== "available") {
      return
    }

    setSignalStrategyId(nextStrategy.id)
    setSignalDirection(nextStrategy.direction)
    setSignalThresholdPct(String(nextStrategy.thresholdPct))
    setExecutionAmountSui(String(nextStrategy.executionAmountSui || 0.001))
    setLiveSignal(null)
  }, [])

  const handleExecutionAmountChange = React.useCallback(
    (value: string) => {
      setExecutionAmountSui(value)
      clearRunResult()
    },
    [clearRunResult]
  )

  const scheduleRefresh = React.useCallback(() => {
    window.setTimeout(() => {
      refreshMandates()
    }, 0)
  }, [refreshMandates])

  const executeAgentRun = React.useCallback(
    async (runStrategy: StrategyKey) => {
      if (!selectedMandate) {
        return {
          result: null,
          error: "Create an active mandate before running the agent.",
        }
      }

      const validation = validateRunStrategy(runStrategy)
      const amountSui = actionAmountSui
      const context: RunContext = {
        mandateId: selectedMandate.id,
        mandateLabel: selectedMandate.label,
        agentAddress: selectedMandate.agentAddress,
        amountSui,
        strategy: runStrategy,
        remainingBudget,
        txLimit: selectedMandate.txLimit,
      }

      setIsRunning(true)
      setError(null)
      setResult(null)
      setRunContext(context)
      lastRunReceipt = {
        result: null,
        error: null,
        context,
      }

      if (!validation.ok) {
        const failedResult: AgentRunResult = {
          digest: "",
          status: "FAILED",
          activityEventFound: false,
          deepBookPoolMutationFound: false,
          balanceChangeSui: "0 SUI",
          gasFeeSui: "-",
          error: validation.reason ?? "Agent execution failed",
        }
        setError(failedResult.error ?? null)
        setResult(failedResult)
        lastRunReceipt = {
          result: failedResult,
          error: failedResult.error ?? null,
          context,
        }
        setIsRunning(false)
        return {
          result: failedResult,
          error: failedResult.error ?? null,
        }
      }

      try {
        const response = await fetch("/api/agent/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mandateId: selectedMandate.id,
            ownerAddress: account?.address,
            strategy: runStrategy,
            amountSui,
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
        lastRunReceipt = {
          result: payload,
          error: null,
          context,
        }

        if (payload.status === "BLOCKED") {
          const reason =
            payload.blockedReason ?? "Move policy rejected the agent action"
          recordBlockedAction({
            mandateId: selectedMandate.id,
            digest: payload.digest,
            amountSui,
            reason,
          })
          setError(null)
          scheduleRefresh()
          return {
            result: payload,
            error: null,
          }
        }

        if (!response.ok || payload.status !== "SUCCESS") {
          const normalizedError =
            normalizeAgentRunError(
              payload.error?.includes("old package")
                ? OLD_PACKAGE_MANDATE_MESSAGE
                : payload.error ?? "Agent execution failed"
            )
          setError(normalizedError)
          lastRunReceipt = {
            result: payload,
            error: normalizedError,
            context,
          }
          scheduleRefresh()
          return {
            result: payload,
            error: normalizedError,
          }
        }

        recordAgentExecution({
          mandateId: selectedMandate.id,
          digest: payload.digest,
          pair: DEEPBOOK_POOL_KEY,
          side: "Buy",
          amountSui,
          suiBalanceChange: parseSuiBalanceChange(payload.balanceChangeSui),
          gasFeeSui: parseSuiAmount(payload.gasFeeSui),
          outputAsset: payload.outputAsset,
          outputCoinType: payload.outputCoinType,
          outputAmount: payload.outputAmount,
          residualSuiAmount: parseSuiAmount(payload.residualSui ?? ""),
          outputCoinObjectIds: payload.outputCoinObjectIds,
          outputOwner: payload.outputOwner,
          fillStatus: payload.fillStatus,
        })
        scheduleRefresh()
        return {
          result: payload,
          error: null,
        }
      } catch (caught) {
        const normalizedError =
          normalizeAgentRunError(
            caught instanceof Error ? caught.message : "Agent execution failed"
          )
        const failedResult: AgentRunResult = {
          digest: "",
          status: "FAILED",
          activityEventFound: false,
          deepBookPoolMutationFound: false,
          balanceChangeSui: "0 SUI",
          gasFeeSui: "-",
          error: normalizedError,
        }
        setError(normalizedError)
        setResult(failedResult)
        lastRunReceipt = {
          result: failedResult,
          error: normalizedError,
          context,
        }
        scheduleRefresh()
        return {
          result: failedResult,
          error: normalizedError,
        }
      } finally {
        setIsRunning(false)
      }
    },
    [
      account?.address,
      recordAgentExecution,
      recordBlockedAction,
      remainingBudget,
      scheduleRefresh,
      selectedMandate,
      selectedProtocol,
      validateRunStrategy,
      actionAmountSui,
    ]
  )

  const runAgent = React.useCallback(() => {
    void executeAgentRun(policyStrategy)
  }, [executeAgentRun, policyStrategy])

  const checkSignal = React.useCallback(
    async (force?: "triggered") => {
      setIsCheckingSignal(true)
      try {
        const params = new URLSearchParams({
          strategyId: selectedSignalStrategy.id,
          thresholdPct: String(thresholdPct),
          direction: signalDirection,
        })
        const forcedDecision = force ?? (forceSignalTriggered ? "triggered" : undefined)
        if (forcedDecision) {
          params.set("force", forcedDecision)
        }
        const response = await fetch(`/api/agent/signal?${params.toString()}`)
        if (!response.ok) {
          throw new Error("Unable to read market signal")
        }
        const signal = (await response.json()) as SignalStatus
        setLiveSignal(signal)
        return signal
      } finally {
        setIsCheckingSignal(false)
      }
    },
    [forceSignalTriggered, selectedSignalStrategy.id, signalDirection, thresholdPct]
  )

  const runAutoOnce = React.useCallback(async () => {
    if (autoInFlightRef.current) {
      return
    }

    const validation = validateRunStrategy(policyStrategy)
    if (!validation.ok) {
      stopAutoRun("error", validation.reason ?? "Auto Run stopped.")
      return
    }

    autoInFlightRef.current = true
    let signal: SignalStatus
    try {
      signal = await checkSignal()
      setAutoCheckCount((count) => count + 1)
    } catch (caught) {
      autoInFlightRef.current = false
      stopAutoRun(
        "error",
        caught instanceof Error ? caught.message : "Signal check failed."
      )
      return
    }

    if (signal.decision !== "triggered") {
      autoInFlightRef.current = false
      setAutoMessage(signal.reason)
      return
    }

    setAutoMessage("Signal triggered. Submitting backend agent execution.")
    const outcome = await executeAgentRun(policyStrategy)
    autoInFlightRef.current = false

    if (outcome.result?.digest) {
      setAutoLastDigest(outcome.result.digest)
    }
    if (outcome.result?.status === "SUCCESS") {
      setAutoRunCount((count) => count + 1)
      setAutoMessage(null)
      return
    }

    if (outcome.result?.status === "BLOCKED") {
      setAutoRunCount((count) => count + 1)
      stopAutoRun(
        "stopped",
        "Policy block recorded on-chain. Auto Run stopped before another DeepBook submission."
      )
      return
    }

    stopAutoRun("error", outcome.error ?? "Auto Run failed.")
  }, [checkSignal, executeAgentRun, policyStrategy, stopAutoRun, validateRunStrategy])

  const startAutoRun = React.useCallback(() => {
    const validation = validateRunStrategy(policyStrategy)
    if (autoStatus === "running") {
      setAutoMessage("Automation is already running in this browser session.")
      return
    }
    if (executionMode !== "auto_execute") {
      setAutoStatus("error")
      setAutoMessage("Switch execution mode to Auto execute before starting Automation.")
      return
    }
    if (autoInterval === "off") {
      setAutoStatus("error")
      setAutoMessage("Choose an interval before starting Auto Run.")
      return
    }
    if (!thresholdValid) {
      setAutoStatus("error")
      setAutoMessage("Enter a positive signal threshold before starting Automation.")
      return
    }
    if (!validation.ok) {
      setAutoStatus("error")
      setAutoMessage(validation.reason ?? "Auto Run cannot start.")
      return
    }
    if (!automationScope) {
      setAutoStatus("error")
      setAutoMessage("Select a mandate before starting Automation.")
      return
    }

    const lock = activeAutomationLock()
    if (
      isActiveAutomationLock(lock) &&
      lock?.sessionId !== automationSessionIdRef.current
    ) {
      setAutoStatus("error")
      setAutoMessage("Another automation session is already running in this browser.")
      return
    }
    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    writeActiveAutomationLock(automationSessionIdRef.current, automationScope)

    setAutoStatus("running")
    setAutoMessage(null)
    setAutoStartedAt(Date.now())
    setAutoRunCount(0)
    setAutoCheckCount(0)
    setAutoLastDigest(null)
    setAutoNextRunAt(null)
    void runAutoOnce()
  }, [
    autoInterval,
    autoStatus,
    automationScope,
    executionMode,
    policyStrategy,
    runAutoOnce,
    thresholdValid,
    validateRunStrategy,
  ])

  React.useEffect(() => {
    if (autoStatus !== "running" || autoInterval === "off") {
      return
    }

    if (autoTimerRef.current) {
      window.clearTimeout(autoTimerRef.current)
    }

    const intervalMs = Number(autoInterval)
    const nextRunAt = Date.now() + intervalMs
    setAutoNextRunAt(nextRunAt)

    autoTimerRef.current = window.setTimeout(() => {
      void runAutoOnce()
    }, intervalMs)

    return () => {
      if (autoTimerRef.current) {
        window.clearTimeout(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [autoCheckCount, autoInterval, autoStatus, runAutoOnce])

  const autoRunValidation = validateRunStrategy(policyStrategy)
  const selectedAutoIntervalLabel =
    AUTO_RUN_INTERVALS.find((option) => option.value === autoInterval)?.label ??
    "Off"

  return (
    <Card className="border-primary/15 bg-card/80">
      <CardHeader className="border-b border-border">
        <CardTitle>Automation</CardTitle>
        <CardDescription>
          Signal, action amount, and Mandate policy determine whether the
          backend Trading Agent executes.
        </CardDescription>
        <CardAction>
          <Button
            onClick={runAgent}
            disabled={isRunning || autoStatus === "running" || !canRunAgent}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isRunning ? (
              <RotateCcw data-icon="inline-start" className="animate-spin" />
            ) : (
              <Play data-icon="inline-start" />
            )}
            {isRunning ? "Testing" : "Test Run"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 p-4">
        {/* Natural language planning is out of scope for MVP; this panel executes a configured DeepBook action. */}
        <p className="text-xs text-muted-foreground">
          Owner signs only to create or revoke a Mandate; execution is submitted
          by the backend Trading Agent within the on-chain policy limits.
        </p>
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Select Mandate
          </h3>
          {showMandateLoading ? (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <Skeleton className="h-9 w-full" />
            </div>
          ) : selectableMandates.length > 0 && (
            <div className="rounded-lg border border-border bg-background/60 p-3">
            <Select
              value={selectedMandateId ?? ""}
              onValueChange={handleMandateChange}
            >
              <SelectTrigger className="h-auto w-full border-primary/20 bg-primary/5 py-2">
                <span className="min-w-0 truncate text-left text-sm font-medium">
                  {selectedMandate
                    ? `${selectedMandate.label} (${shortId(selectedMandate.id)})`
                    : currentPackageActiveMandates.length === 0
                      ? "No current-package active mandate"
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
                            {!belongsToCurrentPackage(mandate) && " · old package"}
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

          {showMandateLoading ? (
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
              for the backend Trading Agent.
            </div>
          )}

          {selectedMandate && !packageAllowed && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {OLD_PACKAGE_MANDATE_MESSAGE}
            </div>
          )}
        </section>

        {!selectedMandate && (
          <Alert className="border-amber-500/25 bg-amber-500/10">
            <AlertCircle className="size-4 text-amber-400" />
            <AlertTitle>Create an active mandate before running the agent.</AlertTitle>
            <AlertDescription>
              Test Run needs an active shared Mandate object from the current
              wallet so the backend PTB can authorize spend against the right id.
            </AlertDescription>
          </Alert>
        )}

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Signal Strategy
            </h3>
            <p className="text-xs text-muted-foreground">
              Signal Engine → Trigger Decision → Mandate Policy Gate → Backend
              Agent Execution → On-chain Activity
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SIGNAL_STRATEGIES.map((option) => {
              const selected = option.id === selectedSignalStrategy.id
              const available = option.status === "available"

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!available}
                  onClick={() => handleSignalStrategyChange(option.id)}
                  className={cn(
                    "flex min-h-[132px] flex-col items-start gap-2 rounded-lg border bg-background/60 p-3 text-left transition",
                    available &&
                      "hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    !available &&
                      "cursor-not-allowed opacity-55 hover:border-border hover:bg-background/60",
                    selected
                      ? "border-cyan-400/50 bg-cyan-400/10 shadow-[0_0_24px_rgba(34,211,238,0.08)]"
                      : "border-border"
                  )}
                >
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {option.name}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[11px]",
                        available
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {available ? "Available" : "Coming soon"}
                    </Badge>
                  </div>
                  <span className="text-xs leading-snug text-muted-foreground">
                    {option.description}
                  </span>
                  <span className="mt-auto text-xs text-muted-foreground">
                    {option.actionLabel}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Trigger Conditions
            </h3>
            <p className="text-xs text-muted-foreground">
              Demo signal source; replaceable with DeepBook quote or oracle feed.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <SummaryChip label="Market" value={selectedSignalStrategy.market} mono />
            <SummaryChip
              label="Signal type"
              value={selectedSignalStrategy.signalType.replaceAll("_", " ")}
            />
            <SummaryChip
              label="Action"
              value={selectedSignalStrategy.actionLabel}
            />
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">Direction</span>
              <Select
                value={signalDirection}
                onValueChange={(value) => setSignalDirection(value as SignalDirection)}
              >
                <SelectTrigger className="mt-2 h-8 w-full bg-background/70">
                  <span className="truncate text-left text-sm">
                    {
                      SIGNAL_DIRECTIONS.find(
                        (option) => option.value === signalDirection
                      )?.label
                    }
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {SIGNAL_DIRECTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">Threshold</span>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={signalThresholdPct}
                  onChange={(event) => setSignalThresholdPct(event.target.value)}
                  className="h-8 bg-background/70"
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">Check interval</span>
              <Select
                value={autoInterval}
                onValueChange={(value) => {
                  if (autoStatus === "running") {
                    stopAutoRun("stopped", "Automation stopped after interval change.")
                  }
                  setAutoInterval(value as AutoRunInterval)
                }}
              >
                <SelectTrigger className="mt-2 h-8 w-full bg-background/70">
                  <span className="truncate text-left text-sm">
                    {selectedAutoIntervalLabel}
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {AUTO_RUN_INTERVALS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">Execution mode</span>
              <Select
                value={executionMode}
                onValueChange={(value) => setExecutionMode(value as ExecutionMode)}
              >
                <SelectTrigger className="mt-2 h-8 w-full bg-background/70">
                  <span className="truncate text-left text-sm">
                    {
                      EXECUTION_MODES.find(
                        (option) => option.value === executionMode
                      )?.label
                    }
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {EXECUTION_MODES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">
                Demo force
              </span>
              <Button
                type="button"
                variant={forceSignalTriggered ? "default" : "outline"}
                onClick={() => setForceSignalTriggered((value) => !value)}
                className="mt-2 h-8 justify-start"
              >
                {forceSignalTriggered ? "force=triggered" : "Off"}
              </Button>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Execution Action
            </h3>
            <p className="text-xs text-muted-foreground">
              This action amount is passed to Test Run and Auto Execute.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">
                Execution Amount
              </span>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min="0.000001"
                  step="0.001"
                  value={executionAmountSui}
                  onChange={(event) =>
                    handleExecutionAmountChange(event.target.value)
                  }
                  className="h-8 bg-background/70 font-mono"
                />
                <span className="text-xs text-muted-foreground">SUI</span>
              </div>
            </div>
            <div className="flex min-h-[58px] min-w-0 flex-col justify-between rounded-lg border border-border bg-background/60 p-3">
              <span className="text-xs text-muted-foreground">Asset</span>
              <Select
                value={executionAsset}
                onValueChange={(value) => setExecutionAsset(value as "SUI")}
              >
                <SelectTrigger className="mt-2 h-8 w-full bg-background/70">
                  <span className="truncate text-left text-sm">
                    {executionAsset}
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectGroup>
                    {EXECUTION_ASSETS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Policy Preview
            </h3>
            <p className="text-xs text-muted-foreground">
              The Mandate policy gate is evaluated before DeepBook execution.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              {
                label: "Within max tx",
                ok: policyChecks.maxTx,
                detail: selectedMandate
                  ? `${formatSui(actionAmountSui)} <= ${formatSui(selectedMandate.txLimit)}`
                  : "-",
              },
              {
                label: "Within budget",
                ok: policyChecks.budget,
                detail: selectedMandate
                  ? `${formatSui(actionAmountSui)} <= ${formatSui(remainingBudget)}`
                  : "-",
              },
              {
                label: "Mandate active",
                ok: policyChecks.active,
                detail: selectedMandate
                  ? selectedMandate.status
                  : "-",
              },
            ].map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex min-h-[58px] items-center gap-3 rounded-lg border bg-background/60 px-3 py-2",
                  item.ok
                    ? "border-emerald-500/20"
                    : "border-amber-500/25 bg-amber-500/5"
                )}
              >
                <span
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-full text-xs",
                    item.ok
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                  )}
                >
                  {item.ok ? "✓" : "!"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Live Signal status
              </h3>
              <p className="text-xs text-muted-foreground">
                Demo signal source; replaceable with DeepBook quote or oracle
                feed. Use
                <span className="font-mono"> /api/agent/signal?force=triggered </span>
                for demo triggering.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("w-fit font-medium", signalDecisionClass(liveSignal?.decision))}
            >
              {isCheckingSignal
                ? "Checking"
                : liveSignal?.decision
                  ? liveSignal.decision
                  : "waiting"}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <SummaryChip
              label="Signal source"
              value={liveSignal?.source ?? "mock"}
            />
            <SummaryChip
              label="Signal type"
              value={
                liveSignal?.signalType.replaceAll("_", " ") ??
                selectedSignalStrategy.signalType.replaceAll("_", " ")
              }
            />
            <SummaryChip
              label="Market"
              value={liveSignal?.market ?? selectedSignalStrategy.market}
              mono
            />
            <SummaryChip
              label="Baseline"
              value={formatSignalValue(liveSignal?.baselineValue)}
              mono
            />
            <SummaryChip
              label="Current"
              value={formatSignalValue(liveSignal?.currentValue)}
              mono
            />
            <SummaryChip
              label="Change"
              value={formatSignalChange(liveSignal?.changePct)}
              mono
            />
            <SummaryChip
              label="Decision"
              value={liveSignal?.decision ?? "-"}
            />
            <SummaryChip
              label="Last checked"
              value={formatSignalCheckedAt(liveSignal?.checkedAt)}
              mono
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {liveSignal?.reason ?? "No signal check has run yet."}
          </p>
        </section>

        <section className="flex flex-col gap-3 rounded-lg border border-border bg-background/45 p-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Automation controls</h3>
              <p className="text-xs text-muted-foreground">
                Start signal polling. A transaction is submitted only when the
                live signal decision is triggered.
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("w-fit font-medium", autoRunStatusClass(autoStatus))}
            >
              {autoRunStatusLabel(autoStatus)}
            </Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-2 sm:grid-cols-3">
              <SummaryChip
                label="Action"
                value={formatSui(actionAmountSui)}
                mono
              />
              <SummaryChip
                label="Policy outcome"
                value={
                  policyStrategy === "normal"
                    ? "Executable"
                    : policyStrategy === "exceed_per_tx"
                      ? "Blocked: max tx"
                      : policyStrategy === "exceed_budget"
                        ? "Blocked: budget"
                        : "Blocked: inactive"
                }
              />
              <SummaryChip label="Asset" value={executionAsset} />
            </div>

            <div className="flex items-end gap-2">
              {autoStatus === "running" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => stopAutoRun("stopped", "Auto Run stopped by user.")}
                  className="h-9 w-full lg:w-auto"
                >
                  Stop
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={startAutoRun}
                  disabled={
                    isRunning || autoInterval === "off" || !canStartAutoRun
                  }
                  className="h-9 w-full bg-primary text-primary-foreground hover:bg-primary/90 lg:w-auto"
                >
                  Start
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryChip
              label="Started at"
              value={
                autoStatus === "running" && autoStartedAt
                  ? formatAutoRunTime(autoStartedAt)
                  : "-"
              }
              mono
            />
            <SummaryChip label="Run count" value={autoRunCount} mono />
            <SummaryChip
              label="Last execution"
              value={
                autoLastDigest ? (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <CopyableId value={autoLastDigest} label="auto run digest" />
                    <ExplorerLink digest={autoLastDigest} />
                  </span>
                ) : (
                  "-"
                )
              }
              mono={Boolean(autoLastDigest)}
            />
            <SummaryChip
              label="Next execution"
              value={
                autoStatus === "running"
                  ? formatCountdown(autoNextRunAt, nowMs)
                  : autoInterval === "off"
                    ? "-"
                    : selectedAutoIntervalLabel
              }
              mono
            />
          </div>

          {(autoMessage || (autoInterval !== "off" && !autoRunValidation.ok)) && (
            <p
              className={cn(
                "text-xs",
                autoStatus === "error" ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {autoMessage ?? autoRunValidation.reason}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Recent Activity
              </h3>
              <p className="text-xs text-muted-foreground">
                Latest events for the selected Mandate.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {result && <ResultStatusBadge status={result.status} />}
              {selectedMandate?.id && (
                <Link
                  href={`/console/activity?mandateId=${encodeURIComponent(
                    selectedMandate.id
                  )}`}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  View all →
                </Link>
              )}
            </div>
          </div>

          {selectedMandateActivity.length > 0 ? (
            <div className="rounded-lg border border-border bg-background/45 px-3">
              <ActivityFeed events={selectedMandateActivity} />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/50 p-4 text-sm text-muted-foreground">
              No activity for this mandate yet.
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
