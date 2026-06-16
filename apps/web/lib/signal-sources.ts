import type {
  SignalDirection,
  SignalStrategyStatus,
  SignalStrategyType,
} from "@/lib/signal-strategies"

export type SignalSourceId = "deepbook_quote" | "sui_price"
export type SignalDecision = "waiting" | "triggered"

export type SignalSourceDefinition = {
  id: string
  name: string
  type: SignalStrategyType
  source: SignalSourceId
  targetAsset: string
  quoteAsset: string
  market: string
  defaultWindow: string
  defaultThresholdPct: number
  defaultDirection: SignalDirection
  actionLabel: string
  executionAmountSui: number
  status: SignalStrategyStatus
}

export type SignalQuotePayload = {
  source: SignalSourceId
  market: string
  targetAsset: string
  quoteAsset: string
  poolKey?: string
  poolId?: string
  inputAsset?: string
  outputAsset?: string
  inputAmount?: number
  currentValue: number
  residualSui?: number
}

export type SignalResult = {
  strategyId: string
  signalType: SignalStrategyType
  source: SignalSourceId
  market: string
  targetAsset: string
  quoteAsset: string
  poolKey?: string
  poolId?: string
  inputAsset?: string
  outputAsset?: string
  inputAmount?: number
  baselineValue: number
  currentValue: number
  residualSui?: number
  changePct: number
  thresholdPct: number
  direction: SignalDirection
  decision: SignalDecision
  reason: string
  checkedAt: string
}

export const SIGNAL_SOURCES: SignalSourceDefinition[] = [
  {
    id: "deep_sui_quote_momentum",
    name: "DeepBook Quote",
    type: "price_momentum",
    source: "deepbook_quote",
    targetAsset: "DEEP",
    quoteAsset: "SUI",
    market: "DEEP/SUI",
    defaultWindow: "session",
    defaultThresholdPct: 5,
    defaultDirection: "either",
    actionLabel: "Buy DEEP with SUI",
    executionAmountSui: 1,
    status: "available",
  },
  {
    id: "sui_price_momentum",
    name: "SUI Price",
    type: "price_momentum",
    source: "sui_price",
    targetAsset: "SUI",
    quoteAsset: "USD",
    market: "SUI/USD",
    defaultWindow: "session",
    defaultThresholdPct: 1,
    defaultDirection: "either",
    actionLabel: "Buy DEEP with SUI",
    executionAmountSui: 1,
    status: "available",
  },
]

export function signalSourceById(id: string | null | undefined) {
  if (id === "price_momentum") {
    return SIGNAL_SOURCES[0]
  }
  return SIGNAL_SOURCES.find((source) => source.id === id)
}

export function signalSourceBySource(source: string | null | undefined) {
  if (source !== "deepbook_quote" && source !== "sui_price") {
    return undefined
  }
  return SIGNAL_SOURCES.find((definition) => definition.source === source)
}

export function defaultSignalSource() {
  return SIGNAL_SOURCES[0]
}

export function signalDecisionMet(
  changePct: number,
  thresholdPct: number,
  direction: SignalDirection
) {
  const thresholdMet = Math.abs(changePct) >= thresholdPct
  const directionMatches =
    direction === "either" ||
    (direction === "up" && changePct >= thresholdPct) ||
    (direction === "down" && changePct <= -thresholdPct)

  return thresholdMet && directionMatches
}

export function signalBaselineScope(params: {
  network: string
  strategyId: string
  source: SignalSourceId
  market: string
  window: string
  thresholdPct: number
  direction: SignalDirection
  inputAmount?: number
}) {
  return [
    params.network,
    params.source,
    params.strategyId,
    params.market,
    params.window,
    params.thresholdPct,
    params.direction,
    params.inputAmount ?? "na",
  ].join(":")
}
