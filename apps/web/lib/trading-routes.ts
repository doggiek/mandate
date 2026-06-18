import {
  getActiveDeepBookRouteConfig,
  getTestUsdcRouteConfig,
} from "@/lib/chain-config";

export type TradingRouteId = "deep_momentum_buy" | "sui_momentum_buy";
export type SignalSourceId = "deepbook_quote" | "sui_price";

export type TradingRoute = {
  id: TradingRouteId;
  label: string;
  description: string;
  signal: {
    strategyId: string;
    source: SignalSourceId;
    market: string;
    signalAsset: string;
    quoteAsset: string;
    thresholdPct: number;
  };
  action: {
    type: "buy";
    spendAsset: string;
    buyAsset: string;
    poolKey: string;
    poolId: string;
    inputDecimals: number;
    outputDecimals: number;
    executionAmount: number;
    executable: boolean;
    unavailableReason?: string;
  };
};

const activeDeepBookRoute = getActiveDeepBookRouteConfig();
const deepSuiPoolKey = activeDeepBookRoute.poolKey;
const deepSuiPoolId = activeDeepBookRoute.poolId;
const testUsdcRoute = getTestUsdcRouteConfig();

export const TRADING_ROUTES: TradingRoute[] = [
  {
    id: "deep_momentum_buy",
    label: "DEEP Momentum",
    description:
      "Monitor DEEP/SUI quote and let the agent buy DEEP with capped SUI.",
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
      executionAmount: activeDeepBookRoute.executionAmount,
      executable: activeDeepBookRoute.configured,
      unavailableReason: activeDeepBookRoute.unavailableReason,
    },
  },
  {
    id: "sui_momentum_buy",
    label: "SUI Momentum",
    description:
      "Disabled route: SUI/USD signal with future test USDC spend.",
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
      spendAsset: "DUSDC",
      buyAsset: "SUI",
      poolKey: testUsdcRoute.poolKey,
      poolId: testUsdcRoute.poolId,
      inputDecimals: 6,
      outputDecimals: 9,
      executionAmount: 1,
      executable: false,
      unavailableReason: testUsdcRoute.unavailableReason,
    },
  },
];

export function tradingRouteById(id: string | null | undefined) {
  return TRADING_ROUTES.find((route) => route.id === id);
}

export function tradingRouteByStrategyId(
  strategyId: string | null | undefined,
) {
  return TRADING_ROUTES.find((route) => route.signal.strategyId === strategyId);
}

export function defaultTradingRoute() {
  return (
    TRADING_ROUTES.find((route) => route.action.executable) ?? TRADING_ROUTES[0]
  );
}
