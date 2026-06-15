export type SignalStrategyType =
  | "price_momentum"
  | "volatility"
  | "whale_flow"
  | "ai_signal"

export type SignalDirection = "up" | "down" | "either"

export type SignalStrategyStatus = "available" | "coming_soon"

export type SignalStrategy = {
  id: string
  name: string
  description: string
  signalType: SignalStrategyType
  market: string
  direction: SignalDirection
  thresholdPct: number
  actionLabel: string
  executionAmountSui: number
  status: SignalStrategyStatus
}

export const SIGNAL_STRATEGIES: SignalStrategy[] = [
  {
    id: "price_momentum",
    name: "Price Momentum",
    description: "Trigger when DEEP/SUI moves beyond a configured threshold.",
    signalType: "price_momentum",
    market: "DEEP/SUI",
    direction: "either",
    thresholdPct: 5,
    actionLabel: "Buy DEEP with SUI",
    executionAmountSui: 0.001,
    status: "available",
  },
  {
    id: "volatility_guard",
    name: "Volatility Guard",
    description: "Pause execution when short-term volatility exceeds policy.",
    signalType: "volatility",
    market: "DEEP/SUI",
    direction: "either",
    thresholdPct: 12,
    actionLabel: "Block risky execution",
    executionAmountSui: 0,
    status: "coming_soon",
  },
  {
    id: "whale_flow",
    name: "Whale Flow",
    description: "React to large wallet or pool flow changes.",
    signalType: "whale_flow",
    market: "DEEP/SUI",
    direction: "either",
    thresholdPct: 8,
    actionLabel: "Follow flow signal",
    executionAmountSui: 0.001,
    status: "coming_soon",
  },
  {
    id: "ai_risk_signal",
    name: "AI Risk Signal",
    description: "Use an AI risk score before allowing execution.",
    signalType: "ai_signal",
    market: "DEEP/SUI",
    direction: "either",
    thresholdPct: 5,
    actionLabel: "Execute if risk approved",
    executionAmountSui: 0.001,
    status: "coming_soon",
  },
]

export function signalStrategyById(id: string | null | undefined) {
  return SIGNAL_STRATEGIES.find((strategy) => strategy.id === id)
}

export function defaultSignalStrategy() {
  return SIGNAL_STRATEGIES.find((strategy) => strategy.status === "available")!
}
