export type SignalStrategyType =
  | "price_momentum"
  | "volatility"
  | "whale_flow"
  | "ai_signal"

export type SignalDirection = "up" | "down" | "either"

export type SignalStrategyStatus = "available" | "coming_soon"
export type SignalSourceId = "deepbook_quote" | "sui_price"

export type SignalStrategy = {
  id: string
  name: string
  description: string
  source: SignalSourceId
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
    id: "deep_sui_quote_momentum",
    name: "DEEP Momentum",
    description: "Signal: DEEP/SUI quote. Action: Buy DEEP with SUI.",
    source: "deepbook_quote",
    signalType: "price_momentum",
    market: "DEEP/SUI",
    direction: "either",
    thresholdPct: 5,
    actionLabel: "Buy DEEP with SUI",
    executionAmountSui: 1,
    status: tradingRouteByStrategyId("deep_sui_quote_momentum")?.action.executable
      ? "available"
      : "coming_soon",
  },
  {
    id: "sui_price_momentum",
    name: "SUI Momentum",
    description: "Signal: SUI/USD price. Action: Buy SUI with DBUSDC.",
    source: "sui_price",
    signalType: "price_momentum",
    market: "SUI/USD",
    direction: "either",
    thresholdPct: 1,
    actionLabel: "Buy SUI with DBUSDC",
    executionAmountSui: 1,
    status: tradingRouteByStrategyId("sui_price_momentum")?.action.executable
      ? "available"
      : "coming_soon",
  },
  {
    id: "volatility_guard",
    name: "Volatility Guard",
    description: "Pause execution when short-term volatility exceeds policy.",
    source: "deepbook_quote",
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
    source: "deepbook_quote",
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
    source: "deepbook_quote",
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
  if (id === "price_momentum") {
    return SIGNAL_STRATEGIES.find(
      (strategy) => strategy.id === "deep_sui_quote_momentum"
    )
  }
  return SIGNAL_STRATEGIES.find((strategy) => strategy.id === id)
}

export function defaultSignalStrategy() {
  const defaultRoute = TRADING_ROUTES.find((route) => route.action.executable)
  return (
    SIGNAL_STRATEGIES.find((strategy) => strategy.id === defaultRoute?.signal.strategyId) ??
    SIGNAL_STRATEGIES.find((strategy) => strategy.status === "available") ??
    SIGNAL_STRATEGIES[0]
  )
}
import { TRADING_ROUTES, tradingRouteByStrategyId } from "@/lib/trading-routes"
