import { execFile } from "node:child_process"
import path from "node:path"
import { promisify } from "node:util"
import {
  CURRENT_MANDATE_ID,
  DEEPBOOK_POOL_KEY,
  PACKAGE_ID,
} from "@/lib/chain-config"

const execFileAsync = promisify(execFile)

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type AgentRunStatus = "SUCCESS" | "BLOCKED" | "FAILED"

type AgentRunResult = {
  digest: string
  status: AgentRunStatus
  activityEventFound: boolean
  deepBookPoolMutationFound: boolean
  balanceChangeSui: string
  gasFeeSui: string
  blockedReason?: string
  error?: string
}

type AgentRunRequest = {
  mandateId?: unknown
  strategy?: unknown
  amountSui?: unknown
  mandateMetadata?: unknown
}

const EMPTY_RESULT: AgentRunResult = {
  digest: "",
  status: "FAILED",
  activityEventFound: false,
  deepBookPoolMutationFound: false,
  balanceChangeSui: "0 SUI",
  gasFeeSui: "-",
}

function readSection(output: string, label: string) {
  const match = output.match(new RegExp(`${label}:\\s*\\n([^\\n]*)`))
  return match?.[1]?.trim() ?? ""
}

function parseAgentOutput(output: string, error?: string): AgentRunResult {
  const status = readSection(output, "Status")
  const blockedReasonText = readSection(output, "Blocked Reason")
  const errorText = error ?? readSection(output, "Failure Reason")
  const blockedReason = classifyBlockedReason(errorText)
  return {
    digest: readSection(output, "Digest"),
    status:
      status === "SUCCESS"
        ? "SUCCESS"
        : status === "BLOCKED"
          ? "BLOCKED"
          : blockedReason
            ? "BLOCKED"
            : "FAILED",
    activityEventFound: readSection(output, "Activity Event") === "FOUND",
    deepBookPoolMutationFound:
      readSection(output, "DeepBook Pool Mutation") === "FOUND",
    balanceChangeSui: readSection(output, "Balance Change") || "0 SUI",
    gasFeeSui: readSection(output, "Gas Fee") || "-",
    ...(blockedReasonText || blockedReason
      ? { blockedReason: blockedReasonText || blockedReason }
      : {}),
    ...(errorText ? { error: errorText } : {}),
  }
}

function classifyBlockedReason(message?: string) {
  const lower = message?.toLowerCase() ?? ""
  if (!lower) {
    return undefined
  }

  if (lower.includes("abort code: 2") || lower.includes("abort_code: 2")) {
    return "agent wallet mismatch"
  }
  if (lower.includes("abort code: 3") || lower.includes("abort_code: 3")) {
    return "revoked"
  }
  if (lower.includes("abort code: 4") || lower.includes("abort_code: 4")) {
    return "expired"
  }
  if (lower.includes("abort code: 5") || lower.includes("abort_code: 5")) {
    return "protocol not allowed"
  }
  if (lower.includes("abort code: 6") || lower.includes("abort_code: 6")) {
    return "exceeds per-tx cap"
  }
  if (lower.includes("abort code: 7") || lower.includes("abort_code: 7")) {
    return "exceeds remaining budget"
  }
  if (lower.includes("moveabort") || lower.includes("move abort")) {
    return "Move policy rejected the agent action"
  }

  return undefined
}

async function readAgentRequest(request: Request) {
  try {
    return (await request.json()) as AgentRunRequest
  } catch {
    return {}
  }
}

function requestMandateId(body: AgentRunRequest) {
  return typeof body.mandateId === "string" && body.mandateId.trim()
      ? body.mandateId.trim()
      : CURRENT_MANDATE_ID
}

function requestAmountSui(body: AgentRunRequest) {
  return typeof body.amountSui === "number" && Number.isFinite(body.amountSui)
    ? String(body.amountSui)
    : "0.001"
}

function requestStrategy(body: AgentRunRequest) {
  return typeof body.strategy === "string" ? body.strategy : "normal"
}

function requestBlockedReason(body: AgentRunRequest) {
  const strategy = requestStrategy(body)
  if (strategy === "exceed_per_tx") {
    return "exceeds_per_tx_cap"
  }
  if (strategy === "exceed_budget") {
    return "exceeds_remaining_budget"
  }
  if (strategy === "revoked_expired") {
    return "inactive_mandate"
  }

  return undefined
}

export async function POST(request: Request) {
  const repoRoot = path.resolve(process.cwd(), "../..")
  const body = await readAgentRequest(request)
  const mandateId = requestMandateId(body)
  const amountSui = requestAmountSui(body)
  const blockedReason = requestBlockedReason(body)

  try {
    const { stdout, stderr } = await execFileAsync(
      "npm",
      ["run", blockedReason ? "agent:block" : "agent:swap", "--silent"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          PACKAGE_ID,
          MANDATE_ID: mandateId,
          POOL_KEY: DEEPBOOK_POOL_KEY,
          AMOUNT_SUI: amountSui,
          ...(blockedReason ? { BLOCK_REASON: blockedReason } : {}),
        },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      }
    )

    const result = parseAgentOutput(stdout, stderr.trim() || undefined)
    return Response.json(result, { status: result.status === "FAILED" ? 500 : 200 })
  } catch (caught) {
    const error = caught as {
      stdout?: string
      stderr?: string
      message?: string
    }
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`
    const result = output.trim()
      ? parseAgentOutput(output, error.stderr?.trim() || error.message)
      : { ...EMPTY_RESULT, error: error.message ?? "Agent execution failed" }

    return Response.json(result, { status: result.status === "BLOCKED" ? 200 : 500 })
  }
}
