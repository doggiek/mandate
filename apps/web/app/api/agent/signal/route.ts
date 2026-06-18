import { deepbook, mainnetCoins, mainnetPools, testnetCoins, testnetPools } from "@mysten/deepbook-v3"
import { SuiGrpcClient } from "@mysten/sui/grpc"
import {
  BACKEND_AGENT_ADDRESS,
  NETWORK,
  getActiveDeepBookRouteConfig,
  getRpcUrl,
  normalizeSuiAddress,
} from "@/lib/chain-config"
import {
  defaultSignalStrategy,
  signalStrategyById,
  type SignalDirection,
} from "@/lib/signal-strategies"
import {
  defaultSignalSource,
  signalBaselineScope,
  signalDecisionMet,
  signalSourceById,
  signalSourceBySource,
  type SignalQuotePayload,
  type SignalSourceId,
} from "@/lib/signal-sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SignalDecision = "waiting" | "triggered"

const baselineByScope = new Map<string, number>()

function numericParam(value: string | null, fallback: number) {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function directionParam(value: string | null): SignalDirection {
  return value === "up" || value === "down" || value === "either"
    ? value
    : "either"
}

function sourceParam(value: string | null): SignalSourceId | null {
  return value === "deepbook_quote" || value === "sui_price" ? value : null
}

function fullnodeUrl() {
  return getRpcUrl()
}

function deepbookConfig() {
  const route = getActiveDeepBookRouteConfig()
  const pools = NETWORK === "mainnet" ? mainnetPools : testnetPools
  const coins = NETWORK === "mainnet" ? mainnetCoins : testnetCoins
  const pool = pools[route.poolKey]

  if (!route.poolId) {
    throw new Error("pool config missing: Route is not configured for current network.")
  }
  if (!pool) {
    throw new Error(`pool config missing: ${route.poolKey} is not in DeepBook SDK ${NETWORK} pools`)
  }
  if (normalizeSuiAddress(pool.address) !== normalizeSuiAddress(route.poolId)) {
    throw new Error(
      `pool config mismatch: ${route.poolKey} SDK pool id ${pool.address} does not match configured pool id ${route.poolId}`
    )
  }

  const baseCoin = coins[pool.baseCoin]
  const quoteCoin = coins[pool.quoteCoin]
  if (!baseCoin || !quoteCoin) {
    throw new Error(`pool config missing coin metadata for ${route.poolKey}`)
  }

  return { coins, pool, baseCoin, quoteCoin, route }
}

function normalizeCoinType(type: string) {
  const [address, moduleName, structName] = type.split("::")
  if (!address || !moduleName || !structName) {
    return type
  }

  return `${normalizeSuiAddress(address)}::${moduleName}::${structName}`
}

async function quoteSuiInput(inputAmountSui: number) {
  const { pool, baseCoin, quoteCoin, route } = deepbookConfig()
  const suiType = `${normalizeSuiAddress("0x2")}::sui::SUI`
  const baseIsSui = normalizeCoinType(baseCoin.type).toLowerCase() === suiType.toLowerCase()
  const quoteIsSui = normalizeCoinType(quoteCoin.type).toLowerCase() === suiType.toLowerCase()

  if (!baseIsSui && !quoteIsSui) {
    throw new Error(`${route.poolKey} does not support SUI input`)
  }

  const client = new SuiGrpcClient({
    network: NETWORK === "mainnet" ? "mainnet" : "testnet",
    baseUrl: fullnodeUrl(),
  }).$extend(deepbook({ address: BACKEND_AGENT_ADDRESS }))

  if (quoteIsSui) {
    const quote = await client.deepbook.getBaseQuantityOut(route.poolKey, inputAmountSui)
    return {
      market: `${pool.baseCoin}/${pool.quoteCoin}`,
      inputAsset: pool.quoteCoin,
      outputAsset: pool.baseCoin,
      inputAmount: inputAmountSui,
      outputAmount: quote.baseOut,
      residualSui: quote.quoteOut,
    }
  }

  const quote = await client.deepbook.getQuoteQuantityOut(route.poolKey, inputAmountSui)
  return {
    market: `${pool.baseCoin}/${pool.quoteCoin}`,
    inputAsset: pool.baseCoin,
    outputAsset: pool.quoteCoin,
    inputAmount: inputAmountSui,
    outputAmount: quote.quoteOut,
    residualSui: quote.baseOut,
  }
}

async function fetchSuiUsdPrice() {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd",
    {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    }
  )

  if (!response.ok) {
    throw new Error(`price unavailable: CoinGecko returned ${response.status}`)
  }

  const payload = (await response.json()) as { sui?: { usd?: number } }
  const price = payload.sui?.usd
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    throw new Error("price unavailable: SUI/USD price missing")
  }

  return price
}

function formatCurrentValue(quote: SignalQuotePayload) {
  if (
    quote.source === "deepbook_quote" &&
    quote.inputAsset &&
    quote.outputAsset &&
    typeof quote.inputAmount === "number"
  ) {
    return `${quote.inputAmount} ${quote.inputAsset} -> ${quote.currentValue} ${quote.outputAsset}`
  }

  return `${quote.currentValue} ${quote.quoteAsset}`
}

function signalReason(params: {
  force: boolean
  initialized: boolean
  decision: SignalDecision
  quote: SignalQuotePayload
  changePct: number
  thresholdPct: number
  direction: SignalDirection
}) {
  const value = formatCurrentValue(params.quote)
  const sourceLabel =
    params.quote.source === "sui_price" ? "SUI price" : "DeepBook quote"

  if (params.force) {
    return `Force-triggered with live ${sourceLabel} ${value}.`
  }
  if (params.initialized) {
    return `${sourceLabel} baseline initialized at ${value}.`
  }
  if (params.decision === "triggered") {
    return `${sourceLabel} moved ${params.changePct.toFixed(2)}%, meeting the ${params.thresholdPct}% ${params.direction} trigger.`
  }
  return `${sourceLabel} moved ${params.changePct.toFixed(2)}%, below the ${params.thresholdPct}% ${params.direction} trigger.`
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const force = url.searchParams.get("force")
  const requestedSource = sourceParam(url.searchParams.get("source"))
  const strategyFromId =
    signalStrategyById(url.searchParams.get("strategyId")) ??
    (requestedSource ? undefined : defaultSignalStrategy())
  const sourceDefinition =
    signalSourceById(strategyFromId?.id) ??
    signalSourceBySource(requestedSource) ??
    defaultSignalSource()
  const strategy = strategyFromId ?? signalStrategyById(sourceDefinition.id) ?? defaultSignalStrategy()
  const source = requestedSource ?? strategy.source ?? sourceDefinition.source
  const activeSource =
    signalSourceBySource(source) ?? signalSourceById(strategy.id) ?? sourceDefinition
  const thresholdPct = Math.max(
    0,
    numericParam(url.searchParams.get("thresholdPct"), activeSource.defaultThresholdPct)
  )
  const direction = directionParam(
    url.searchParams.get("direction") ?? activeSource.defaultDirection
  )
  const inputAmount = Math.max(
    0,
    numericParam(
      url.searchParams.get("amountSui") ?? url.searchParams.get("inputAmountSui"),
      1
    )
  )
  const checkedAt = new Date().toISOString()

  try {
    let quote: SignalQuotePayload
    if (activeSource.source === "sui_price") {
      quote = {
        source: "sui_price",
        market: activeSource.market,
        targetAsset: activeSource.targetAsset,
        quoteAsset: activeSource.quoteAsset,
        currentValue: await fetchSuiUsdPrice(),
      }
    } else {
      const deepbookQuote = await quoteSuiInput(inputAmount || 1)
      quote = {
        source: "deepbook_quote",
        market: deepbookQuote.market,
        targetAsset: deepbookQuote.outputAsset,
        quoteAsset: deepbookQuote.inputAsset,
        poolKey: getActiveDeepBookRouteConfig().poolKey,
        poolId: getActiveDeepBookRouteConfig().poolId,
        inputAsset: deepbookQuote.inputAsset,
        outputAsset: deepbookQuote.outputAsset,
        inputAmount: deepbookQuote.inputAmount,
        currentValue: deepbookQuote.outputAmount,
        residualSui: deepbookQuote.residualSui,
      }
    }

    const baselineScope = signalBaselineScope({
      network: NETWORK,
      strategyId: activeSource.id,
      source: activeSource.source,
      market: activeSource.market,
      window: activeSource.defaultWindow,
      thresholdPct,
      direction,
      inputAmount: activeSource.source === "deepbook_quote" ? quote.inputAmount : undefined,
    })
    const existingBaseline = baselineByScope.get(baselineScope)
    const baselineValue = existingBaseline ?? quote.currentValue
    if (existingBaseline == null) {
      baselineByScope.set(baselineScope, quote.currentValue)
    }

    const changePct =
      baselineValue > 0
        ? Number((((quote.currentValue - baselineValue) / baselineValue) * 100).toFixed(4))
        : 0
    const triggered = signalDecisionMet(changePct, thresholdPct, direction)
    const decision: SignalDecision =
      force === "triggered" || (existingBaseline != null && triggered)
        ? "triggered"
        : "waiting"

    return Response.json({
      strategyId: activeSource.id,
      signalType: activeSource.type,
      source: activeSource.source,
      market: quote.market,
      targetAsset: quote.targetAsset,
      quoteAsset: quote.quoteAsset,
      poolKey: quote.poolKey,
      poolId: quote.poolId,
      inputAsset: quote.inputAsset,
      outputAsset: quote.outputAsset,
      inputAmount: quote.inputAmount,
      baselineValue,
      currentValue: quote.currentValue,
      residualSui: quote.residualSui,
      changePct,
      thresholdPct,
      direction,
      decision,
      reason: signalReason({
        force: force === "triggered",
        initialized: existingBaseline == null,
        decision,
        quote,
        changePct,
        thresholdPct,
        direction,
      }),
      checkedAt,
    })
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught)
    return Response.json({
      strategyId: activeSource.id,
      signalType: activeSource.type,
      source: activeSource.source,
      market: activeSource.market,
      targetAsset: activeSource.targetAsset,
      quoteAsset: activeSource.quoteAsset,
      poolKey: activeSource.source === "deepbook_quote" ? getActiveDeepBookRouteConfig().poolKey : undefined,
      poolId: activeSource.source === "deepbook_quote" ? getActiveDeepBookRouteConfig().poolId : undefined,
      inputAsset: activeSource.source === "deepbook_quote" ? "SUI" : undefined,
      outputAsset: activeSource.source === "deepbook_quote" ? "DEEP" : undefined,
      inputAmount: activeSource.source === "deepbook_quote" ? inputAmount : undefined,
      baselineValue: 0,
      currentValue: 0,
      changePct: 0,
      thresholdPct,
      direction,
      decision: "waiting" satisfies SignalDecision,
      reason:
        activeSource.source === "sui_price"
          ? `SUI price unavailable: ${error}`
          : `DeepBook quote unavailable: ${error}`,
      checkedAt,
    })
  }
}
