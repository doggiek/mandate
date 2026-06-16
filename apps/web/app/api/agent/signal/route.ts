import { deepbook, mainnetCoins, mainnetPools, testnetCoins, testnetPools } from "@mysten/deepbook-v3"
import { SuiGrpcClient } from "@mysten/sui/grpc"
import {
  BACKEND_AGENT_ADDRESS,
  DEEPBOOK_POOL_ID,
  DEEPBOOK_POOL_KEY,
  NETWORK,
  normalizeSuiAddress,
} from "@/lib/chain-config"
import {
  defaultSignalStrategy,
  signalStrategyById,
  type SignalDirection,
} from "@/lib/signal-strategies"

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

function fullnodeUrl() {
  if (NETWORK === "mainnet") {
    return "https://fullnode.mainnet.sui.io:443"
  }
  return "https://fullnode.testnet.sui.io:443"
}

function deepbookConfig() {
  if (NETWORK !== "testnet" && NETWORK !== "mainnet") {
    throw new Error(`DeepBook quote source only supports testnet/mainnet, got ${NETWORK}`)
  }

  const pools = NETWORK === "mainnet" ? mainnetPools : testnetPools
  const coins = NETWORK === "mainnet" ? mainnetCoins : testnetCoins
  const pool = pools[DEEPBOOK_POOL_KEY]

  if (!DEEPBOOK_POOL_ID) {
    throw new Error("pool config missing: NEXT_PUBLIC_DEEPBOOK_POOL_ID is required")
  }
  if (!pool) {
    throw new Error(`pool config missing: ${DEEPBOOK_POOL_KEY} is not in DeepBook SDK ${NETWORK} pools`)
  }
  if (normalizeSuiAddress(pool.address) !== normalizeSuiAddress(DEEPBOOK_POOL_ID)) {
    throw new Error(
      `pool config mismatch: ${DEEPBOOK_POOL_KEY} SDK pool id ${pool.address} does not match NEXT_PUBLIC_DEEPBOOK_POOL_ID ${DEEPBOOK_POOL_ID}`
    )
  }

  const baseCoin = coins[pool.baseCoin]
  const quoteCoin = coins[pool.quoteCoin]
  if (!baseCoin || !quoteCoin) {
    throw new Error(`pool config missing coin metadata for ${DEEPBOOK_POOL_KEY}`)
  }

  return { coins, pool, baseCoin, quoteCoin }
}

function normalizeCoinType(type: string) {
  const [address, moduleName, structName] = type.split("::")
  if (!address || !moduleName || !structName) {
    return type
  }

  return `${normalizeSuiAddress(address)}::${moduleName}::${structName}`
}

async function quoteSuiInput(inputAmountSui: number) {
  const { pool, baseCoin, quoteCoin } = deepbookConfig()
  const suiType = `${normalizeSuiAddress("0x2")}::sui::SUI`
  const baseIsSui = normalizeCoinType(baseCoin.type).toLowerCase() === suiType.toLowerCase()
  const quoteIsSui = normalizeCoinType(quoteCoin.type).toLowerCase() === suiType.toLowerCase()

  if (!baseIsSui && !quoteIsSui) {
    throw new Error(`${DEEPBOOK_POOL_KEY} does not support SUI input`)
  }

  const client = new SuiGrpcClient({
    network: NETWORK === "mainnet" ? "mainnet" : "testnet",
    baseUrl: fullnodeUrl(),
  }).$extend(deepbook({ address: BACKEND_AGENT_ADDRESS }))

  if (quoteIsSui) {
    const quote = await client.deepbook.getBaseQuantityOut(DEEPBOOK_POOL_KEY, inputAmountSui)
    return {
      market: `${pool.baseCoin}/${pool.quoteCoin}`,
      inputAsset: pool.quoteCoin,
      outputAsset: pool.baseCoin,
      inputAmount: inputAmountSui,
      outputAmount: quote.baseOut,
      residualSui: quote.quoteOut,
    }
  }

  const quote = await client.deepbook.getQuoteQuantityOut(DEEPBOOK_POOL_KEY, inputAmountSui)
  return {
    market: `${pool.baseCoin}/${pool.quoteCoin}`,
    inputAsset: pool.baseCoin,
    outputAsset: pool.quoteCoin,
    inputAmount: inputAmountSui,
    outputAmount: quote.quoteOut,
    residualSui: quote.baseOut,
  }
}

function decide(changePct: number, thresholdPct: number, direction: SignalDirection) {
  const thresholdMet = Math.abs(changePct) >= thresholdPct
  const directionMatches =
    direction === "either" ||
    (direction === "up" && changePct >= thresholdPct) ||
    (direction === "down" && changePct <= -thresholdPct)

  return thresholdMet && directionMatches
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const force = url.searchParams.get("force")
  const strategy =
    signalStrategyById(url.searchParams.get("strategyId")) ??
    defaultSignalStrategy()
  const thresholdPct = Math.max(
    0,
    numericParam(url.searchParams.get("thresholdPct"), strategy.thresholdPct)
  )
  const direction = directionParam(
    url.searchParams.get("direction") ?? strategy.direction
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
    const quote = await quoteSuiInput(inputAmount || 1)
    const baselineScope = [
      NETWORK,
      DEEPBOOK_POOL_KEY,
      DEEPBOOK_POOL_ID,
      strategy.id,
      quote.inputAsset,
      quote.outputAsset,
      quote.inputAmount,
    ].join(":")
    const existingBaseline = baselineByScope.get(baselineScope)
    const baselineValue = existingBaseline ?? quote.outputAmount
    if (existingBaseline == null) {
      baselineByScope.set(baselineScope, quote.outputAmount)
    }

    const changePct =
      baselineValue > 0
        ? Number((((quote.outputAmount - baselineValue) / baselineValue) * 100).toFixed(4))
        : 0
    const triggered = decide(changePct, thresholdPct, direction)
    const decision: SignalDecision =
      force === "triggered" || (existingBaseline != null && triggered)
        ? "triggered"
        : "waiting"

    return Response.json({
      strategyId: strategy.id,
      signalType: strategy.signalType,
      source: "deepbook_quote",
      market: quote.market,
      poolKey: DEEPBOOK_POOL_KEY,
      poolId: DEEPBOOK_POOL_ID,
      inputAsset: quote.inputAsset,
      outputAsset: quote.outputAsset,
      inputAmount: quote.inputAmount,
      baselineValue,
      currentValue: quote.outputAmount,
      residualSui: quote.residualSui,
      changePct,
      thresholdPct,
      direction,
      decision,
      reason:
        force === "triggered"
          ? `Force-triggered with live DeepBook quote ${quote.inputAmount} ${quote.inputAsset} -> ${quote.outputAmount} ${quote.outputAsset}.`
          : existingBaseline == null
          ? `DeepBook quote baseline initialized at ${quote.inputAmount} ${quote.inputAsset} -> ${quote.outputAmount} ${quote.outputAsset}.`
          : decision === "triggered"
            ? `DeepBook quote moved ${changePct.toFixed(2)}%, meeting the ${thresholdPct}% ${direction} trigger.`
            : `DeepBook quote moved ${changePct.toFixed(2)}%, below the ${thresholdPct}% ${direction} trigger.`,
      checkedAt,
    })
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught)
    return Response.json({
      strategyId: strategy.id,
      signalType: strategy.signalType,
      source: "deepbook_quote",
      market: strategy.market,
      poolKey: DEEPBOOK_POOL_KEY,
      poolId: DEEPBOOK_POOL_ID,
      inputAsset: "SUI",
      outputAsset: "DEEP",
      inputAmount,
      baselineValue: 0,
      currentValue: 0,
      changePct: 0,
      thresholdPct,
      direction,
      decision: "waiting" satisfies SignalDecision,
      reason: `DeepBook quote unavailable: ${error}`,
      checkedAt,
    })
  }
}
