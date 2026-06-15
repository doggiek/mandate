import {
  defaultSignalStrategy,
  signalStrategyById,
  type SignalDirection,
} from "@/lib/signal-strategies"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SignalDecision = "waiting" | "triggered"

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
  const baselineValue = 1
  const timeBucket = Math.floor(Date.now() / 30_000)
  const generatedChangePct = Number(
    (Math.sin(timeBucket / 2) * 7.5).toFixed(2)
  )
  const changePct = force === "triggered" ? thresholdPct + 1.25 : generatedChangePct
  const currentValue = Number(
    (baselineValue * (1 + changePct / 100)).toFixed(6)
  )

  const directionMatches =
    direction === "either" ||
    (direction === "up" && changePct >= thresholdPct) ||
    (direction === "down" && changePct <= -thresholdPct)
  const thresholdMet = Math.abs(changePct) >= thresholdPct
  const decision: SignalDecision =
    force === "triggered" || (thresholdMet && directionMatches)
      ? "triggered"
      : "waiting"

  return Response.json({
    strategyId: strategy.id,
    signalType: strategy.signalType,
    market: strategy.market,
    source: "mock",
    baselineValue,
    currentValue,
    changePct,
    thresholdPct,
    decision,
    reason:
      decision === "triggered"
        ? `Demo ${strategy.name} signal moved ${changePct.toFixed(2)}%, meeting the ${thresholdPct}% ${direction} trigger.`
        : `Demo ${strategy.name} signal moved ${changePct.toFixed(2)}%, below the ${thresholdPct}% ${direction} trigger.`,
    checkedAt: new Date().toISOString(),
  })
}
