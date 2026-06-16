export type TradingRouteId = "deep_momentum_buy" | "sui_momentum_buy"
export type SignalSourceId = "deepbook_quote" | "sui_price"

export type TradingRoute = {
  id: TradingRouteId
  label: string
  description: string
  signal: {
    strategyId: string
    source: SignalSourceId
    market: string
    signalAsset: string
    quoteAsset: string
    thresholdPct: number
  }
  action: {
    type: "buy"
    spendAsset: string
    buyAsset: string
    poolKey: string
    poolId: string
    inputDecimals: number
    outputDecimals: number
    executionAmount: number
    executable: boolean
    unavailableReason?: string
  }
}

const deepSuiPoolKey =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY_DEEP_SUI ??
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY ??
  "DEEP_SUI"
const deepSuiPoolId =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID_DEEP_SUI ??
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID ??
  ""
const suiDbusdcPoolKey =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_KEY_SUI_DBUSDC ?? "SUI_DBUSDC"
const suiDbusdcPoolId =
  process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID_SUI_DBUSDC ?? ""
const dbusdcCoinType = process.env.NEXT_PUBLIC_DBUSDC_COIN_TYPE ?? ""

export const TRADING_ROUTES: TradingRoute[] = [
  {
    id: "deep_momentum_buy",
    label: "DEEP Momentum",
    description: "Signal: DEEP/SUI quote. Action: Buy DEEP with SUI.",
    signal: {
      strategyId: "deep_sui_quote_momentum",
      source: "deepbook_quote",
      market: "DEEP/SUI",
      signalAsset: "DEEP",
      quoteAsset: "SUI",
      thresholdPct: 5,
    },
    action: {
      type: "buy",
      spendAsset: "SUI",
      buyAsset: "DEEP",
      poolKey: deepSuiPoolKey,
      poolId: deepSuiPoolId,
      inputDecimals: 9,
      outputDecimals: 6,
      executionAmount: 1,
      executable: Boolean(deepSuiPoolId),
      unavailableReason: deepSuiPoolId
        ? undefined
        : "DEEP_SUI route missing pool id.",
    },
  },
  {
    id: "sui_momentum_buy",
    label: "SUI Momentum",
    description: "Signal: SUI/USD price. Action: Buy SUI with DeepBook test USDC.",
    signal: {
      strategyId: "sui_price_momentum",
      source: "sui_price",
      market: "SUI/USD",
      signalAsset: "SUI",
      quoteAsset: "USD",
      thresholdPct: 1,
    },
    action: {
      type: "buy",
      spendAsset: "DBUSDC",
      buyAsset: "SUI",
      poolKey: suiDbusdcPoolKey,
      poolId: suiDbusdcPoolId,
      inputDecimals: 6,
      outputDecimals: 9,
      executionAmount: 1,
      executable: false,
      unavailableReason:
        suiDbusdcPoolId && dbusdcCoinType
          ? "DeepBook test USDC generic vault execution script pending."
          : "SUI_DBUSDC route not configured.",
    },
  },
]

export function tradingRouteById(id: string | null | undefined) {
  return TRADING_ROUTES.find((route) => route.id === id)
}

export function tradingRouteByStrategyId(strategyId: string | null | undefined) {
  return TRADING_ROUTES.find((route) => route.signal.strategyId === strategyId)
}

export function defaultTradingRoute() {
  return TRADING_ROUTES.find((route) => route.action.executable) ?? TRADING_ROUTES[0]
}
