import { execFile } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography"
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519"
import {
  CURRENT_MANDATE_ID,
  DEEPBOOK_POOL_KEY,
  LEGACY_POLICY_PACKAGE_IDS,
  BACKEND_AGENT_ADDRESS,
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

const OLD_PACKAGE_ERROR =
  "Selected mandate belongs to an old package. Create a new mandate with the current package."

let loggedPackageId = false

function readSection(output: string, label: string) {
  const match = output.match(new RegExp(`${label}:\\s*\\n([^\\n]*)`))
  return match?.[1]?.trim() ?? ""
}

function readEnvFileValue(filePath: string, name: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf8")
    const line = raw
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`))
    if (!line) {
      return undefined
    }
    return line.slice(line.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "")
  } catch {
    return undefined
  }
}

function runtimeEnvValue(name: string, repoRoot: string) {
  return (
    process.env[name]?.trim() ||
    readEnvFileValue(path.join(process.cwd(), ".env.local"), name) ||
    readEnvFileValue(path.join(repoRoot, ".env.local"), name) ||
    readEnvFileValue(path.join(repoRoot, ".env"), name)
  )
}

function findRepoRoot() {
  const cwd = process.cwd()
  const candidates = [
    cwd,
    path.resolve(cwd, "../.."),
    path.resolve(cwd, ".."),
  ]

  return (
    candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "scripts/agent-deepbook-swap.ts"))
    ) ?? path.resolve(cwd, "../..")
  )
}

function runtimePackageId(repoRoot: string) {
  const serverPackageId = runtimeEnvValue("PACKAGE_ID", repoRoot)
  const publicPackageId = runtimeEnvValue("NEXT_PUBLIC_PACKAGE_ID", repoRoot)

  if (!serverPackageId && !publicPackageId) {
    throw new Error(
      "PACKAGE_ID is not configured. Set PACKAGE_ID and NEXT_PUBLIC_PACKAGE_ID in .env.local, then restart Next.js."
    )
  }

  if (
    serverPackageId &&
    publicPackageId &&
    serverPackageId.toLowerCase() !== publicPackageId.toLowerCase()
  ) {
    throw new Error(
      "PACKAGE_ID and NEXT_PUBLIC_PACKAGE_ID do not match. Update .env.local so frontend and backend use the same Mandate package."
    )
  }

  const packageId = serverPackageId ?? publicPackageId
  if (!packageId) {
    throw new Error("PACKAGE_ID is not configured.")
  }
  if (
    LEGACY_POLICY_PACKAGE_IDS.some(
      (legacyPackageId) =>
        normalizeSuiAddress(legacyPackageId) === normalizeSuiAddress(packageId)
    )
  ) {
    throw new Error(
      "PACKAGE_ID points to a legacy policy-only package. Publish the vault package, update PACKAGE_ID/NEXT_PUBLIC_PACKAGE_ID, and restart Next.js."
    )
  }

  if (process.env.NODE_ENV !== "production" && !loggedPackageId) {
    console.info(`[MANDATE] API using PACKAGE_ID ${packageId}`)
    loggedPackageId = true
  }

  return packageId
}

function runtimeAgentPrivateKey(repoRoot: string) {
  const agentPrivateKey =
    runtimeEnvValue("BACKEND_AGENT_PRIVATE_KEY", repoRoot) ??
    runtimeEnvValue("AGENT_PRIVATE_KEY", repoRoot)

  if (!agentPrivateKey) {
    throw new Error(
      "BACKEND_AGENT_PRIVATE_KEY is not configured. Set BACKEND_AGENT_PRIVATE_KEY in .env.local so Run Agent can be signed by the backend agent signer."
    )
  }

  return agentPrivateKey
}

function agentAddressFromPrivateKey(agentPrivateKey: string) {
  const { secretKey, scheme } = decodeSuiPrivateKey(agentPrivateKey)
  if (scheme !== "ED25519") {
    throw new Error(`BACKEND_AGENT_PRIVATE_KEY must be an ED25519 Sui private key, got ${scheme}.`)
  }

  return Ed25519Keypair.fromSecretKey(secretKey).toSuiAddress()
}

function runtimeBackendAgentAddress(repoRoot: string) {
  return (
    runtimeEnvValue("NEXT_PUBLIC_BACKEND_AGENT_ADDRESS", repoRoot) ??
    runtimeEnvValue("NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS", repoRoot) ??
    BACKEND_AGENT_ADDRESS
  )
}

function assertBackendAgentMatchesSigner(
  expectedAgentAddress: string,
  agentPrivateKey: string
) {
  const signerAddress = agentAddressFromPrivateKey(agentPrivateKey)

  if (
    normalizeSuiAddress(expectedAgentAddress) !== normalizeSuiAddress(signerAddress)
  ) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS does not match BACKEND_AGENT_PRIVATE_KEY. Update .env.local so the Mandate backend agent address and backend agent signer are the same wallet."
    )
  }
}

function normalizeSuiAddress(value?: string | null) {
  const raw = value?.trim().toLowerCase()
  if (!raw) {
    return ""
  }

  const withoutPrefix = raw.startsWith("0x") ? raw.slice(2) : raw
  const normalized = withoutPrefix.replace(/^0+/, "") || "0"
  return `0x${normalized}`
}

function mandatePackageFromObjectType(objectType?: string | null) {
  return objectType?.split("::")[0] ?? ""
}

function isCurrentMandateObjectType(objectType: string | undefined, packageId: string) {
  if (!objectType?.endsWith("::mandate::Mandate")) {
    return false
  }

  return (
    normalizeSuiAddress(mandatePackageFromObjectType(objectType)) ===
    normalizeSuiAddress(packageId)
  )
}

function fullnodeUrl() {
  const network = runtimeEnvValue("NEXT_PUBLIC_SUI_NETWORK", findRepoRoot()) ?? "testnet"
  if (network === "mainnet") {
    return "https://fullnode.mainnet.sui.io:443"
  }
  if (network === "devnet") {
    return "https://fullnode.devnet.sui.io:443"
  }
  if (network === "localnet") {
    return "http://127.0.0.1:9000"
  }
  return "https://fullnode.testnet.sui.io:443"
}

async function fetchMandateObjectType(mandateId: string) {
  const response = await fetch(fullnodeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getObject",
      params: [
        mandateId,
        {
          showContent: true,
        },
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch mandate object type: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as {
    error?: { message?: string }
    result?: {
      data?: {
        content?: {
          dataType?: string
          type?: string
        }
      }
    }
  }

  if (payload.error) {
    throw new Error(payload.error.message ?? "Unable to fetch mandate object type")
  }

  const content = payload.result?.data?.content
  return content?.dataType === "moveObject" ? content.type : undefined
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
    return "mandate_inactive_or_expired"
  }

  return undefined
}

export async function POST(request: Request) {
  const repoRoot = findRepoRoot()
  const body = await readAgentRequest(request)
  const mandateId = requestMandateId(body)
  const amountSui = requestAmountSui(body)
  const blockedReason = requestBlockedReason(body)
  let packageId: string
  let agentPrivateKey: string
  let backendAgentAddress: string

  try {
    packageId = runtimePackageId(repoRoot)
    agentPrivateKey = runtimeAgentPrivateKey(repoRoot)
    backendAgentAddress = runtimeBackendAgentAddress(repoRoot)
    assertBackendAgentMatchesSigner(backendAgentAddress, agentPrivateKey)
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught)
    return Response.json({ ...EMPTY_RESULT, error }, { status: 500 })
  }

  try {
    const objectType = await fetchMandateObjectType(mandateId)
    if (!isCurrentMandateObjectType(objectType, packageId)) {
      return Response.json(
        {
          ...EMPTY_RESULT,
          error: `${OLD_PACKAGE_ERROR} Expected ${packageId}::mandate::Mandate, got ${objectType ?? "unknown object type"}.`,
        },
        { status: 400 }
      )
    }
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught)
    return Response.json({ ...EMPTY_RESULT, error }, { status: 500 })
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      "npm",
      ["run", blockedReason ? "agent:block" : "agent:swap", "--silent"],
      {
        cwd: repoRoot,
        env: {
          ...process.env,
          BACKEND_AGENT_PRIVATE_KEY: agentPrivateKey,
          AGENT_PRIVATE_KEY: agentPrivateKey,
          PACKAGE_ID: packageId,
          NEXT_PUBLIC_PACKAGE_ID: packageId,
          NEXT_PUBLIC_BACKEND_AGENT_ADDRESS: backendAgentAddress,
          MANDATE_ID: mandateId,
          POOL_KEY: DEEPBOOK_POOL_KEY,
          AMOUNT_SUI: amountSui,
          STRATEGY: requestStrategy(body),
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
