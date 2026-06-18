import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  LEGACY_POLICY_PACKAGE_IDS,
  BACKEND_AGENT_ADDRESS,
  getActiveDeepBookRouteConfig,
  getPackageId,
  getRpcUrl,
  getSuiNetwork,
  type SuiNetwork,
} from "@/lib/chain-config";
import { defaultTradingRoute, tradingRouteById } from "@/lib/trading-routes";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AgentRunStatus = "SUCCESS" | "BLOCKED" | "FAILED";

type AgentRunResult = {
  digest: string;
  status: AgentRunStatus;
  activityEventFound: boolean;
  deepBookPoolMutationFound: boolean;
  balanceChangeSui: string;
  gasFeeSui: string;
  outputAsset?: string;
  outputCoinType?: string;
  outputAmount?: string;
  residualSui?: string;
  outputCoinObjectIds?: string[];
  outputOwner?: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
  blockedReason?: string;
  error?: string;
};

type AgentRunRequest = {
  mandateId?: unknown;
  ownerAddress?: unknown;
  strategy?: unknown;
  amountSui?: unknown;
  routeId?: unknown;
  spendAsset?: unknown;
  buyAsset?: unknown;
  mandateMetadata?: unknown;
};

const EMPTY_RESULT: AgentRunResult = {
  digest: "",
  status: "FAILED",
  activityEventFound: false,
  deepBookPoolMutationFound: false,
  balanceChangeSui: "0 SUI",
  gasFeeSui: "-",
};

const OLD_PACKAGE_ERROR =
  "Selected mandate belongs to an old package. Create a new mandate with the current package.";

let loggedPackageId = false;

function readSection(output: string, label: string) {
  const match = output.match(new RegExp(`${label}:\\s*\\n([^\\n]*)`));
  return match?.[1]?.trim() ?? "";
}

function readEnvFileValue(filePath: string, name: string) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const line = raw
      .split(/\r?\n/)
      .find((entry) => entry.trim().startsWith(`${name}=`));
    if (!line) {
      return undefined;
    }
    return line
      .slice(line.indexOf("=") + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

function runtimeEnvValue(name: string, repoRoot: string) {
  return (
    process.env[name]?.trim() ||
    readEnvFileValue(path.join(process.cwd(), ".env.local"), name) ||
    readEnvFileValue(path.join(repoRoot, ".env.local"), name) ||
    readEnvFileValue(path.join(repoRoot, ".env"), name)
  );
}

function runtimeEnvReader(repoRoot: string) {
  return (name: string) => runtimeEnvValue(name, repoRoot);
}

function findRepoRoot() {
  const cwd = process.cwd();
  const candidates = [cwd, path.resolve(cwd, "../.."), path.resolve(cwd, "..")];

  return (
    candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, "scripts/agent-deepbook-swap.ts")),
    ) ?? path.resolve(cwd, "../..")
  );
}

function runtimePackageId(repoRoot: string, network: SuiNetwork) {
  const env = runtimeEnvReader(repoRoot);
  const packageId = getPackageId(network, env);

  if (!packageId) {
    throw new Error(
      `Package id is not configured for ${network}. Set NEXT_PUBLIC_PACKAGE_ID_${network.toUpperCase()} in .env.local, then restart Next.js.`,
    );
  }

  if (
    LEGACY_POLICY_PACKAGE_IDS.some(
      (legacyPackageId) =>
        normalizeSuiAddress(legacyPackageId) === normalizeSuiAddress(packageId),
    )
  ) {
    throw new Error(
      "PACKAGE_ID points to a legacy policy-only package. Publish the vault package, update the current network package id, and restart Next.js.",
    );
  }

  if (process.env.NODE_ENV !== "production" && !loggedPackageId) {
    console.info(`[MANDATE] API using ${network} PACKAGE_ID ${packageId}`);
    loggedPackageId = true;
  }

  return packageId;
}

function runtimeAgentPrivateKey(repoRoot: string) {
  const agentPrivateKey =
    runtimeEnvValue("BACKEND_AGENT_PRIVATE_KEY", repoRoot) ??
    runtimeEnvValue("AGENT_PRIVATE_KEY", repoRoot);

  if (!agentPrivateKey) {
    throw new Error(
      "BACKEND_AGENT_PRIVATE_KEY is not configured. Set BACKEND_AGENT_PRIVATE_KEY in .env.local so Run Agent can be signed by the backend agent signer.",
    );
  }

  return agentPrivateKey;
}

function agentAddressFromPrivateKey(agentPrivateKey: string) {
  const { secretKey, scheme } = decodeSuiPrivateKey(agentPrivateKey);
  if (scheme !== "ED25519") {
    throw new Error(
      `BACKEND_AGENT_PRIVATE_KEY must be an ED25519 Sui private key, got ${scheme}.`,
    );
  }

  return Ed25519Keypair.fromSecretKey(secretKey).toSuiAddress();
}

function runtimeBackendAgentAddress(repoRoot: string) {
  return (
    runtimeEnvValue("NEXT_PUBLIC_BACKEND_AGENT_ADDRESS", repoRoot) ??
    runtimeEnvValue("NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS", repoRoot) ??
    BACKEND_AGENT_ADDRESS
  );
}

function runtimeDeepBookRouteConfig(
  repoRoot: string,
  network: SuiNetwork,
  routeId: string,
  configuredPoolId: string,
) {
  const activeRoute = getActiveDeepBookRouteConfig(
    network,
    runtimeEnvReader(repoRoot),
  );
  const poolId = activeRoute.poolId || configuredPoolId;
  const poolKey = activeRoute.poolKey;

  if (!poolId) {
    throw new Error(
      `DeepBook swap unavailable; fallback transfer disabled. Route is not configured for current network (${network}).`,
    );
  }

  return { ...activeRoute, poolId, poolKey };
}

function assertBackendAgentMatchesSigner(
  expectedAgentAddress: string,
  agentPrivateKey: string,
) {
  const signerAddress = agentAddressFromPrivateKey(agentPrivateKey);

  if (
    normalizeSuiAddress(expectedAgentAddress) !==
    normalizeSuiAddress(signerAddress)
  ) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS does not match BACKEND_AGENT_PRIVATE_KEY. Update .env.local so the Mandate backend agent address and backend agent signer are the same wallet.",
    );
  }
}

function normalizeSuiAddress(value?: string | null) {
  const raw = value?.trim().toLowerCase();
  if (!raw) {
    return "";
  }

  const withoutPrefix = raw.startsWith("0x") ? raw.slice(2) : raw;
  const normalized = withoutPrefix.replace(/^0+/, "") || "0";
  return `0x${normalized}`;
}

function mandatePackageFromObjectType(objectType?: string | null) {
  return objectType?.split("::")[0] ?? "";
}

function isCurrentMandateObjectType(
  objectType: string | undefined,
  packageId: string,
) {
  if (
    !objectType?.endsWith("::mandate::Mandate") &&
    !objectType?.includes("::mandate::AssetMandate<")
  ) {
    return false;
  }

  return (
    normalizeSuiAddress(mandatePackageFromObjectType(objectType)) ===
    normalizeSuiAddress(packageId)
  );
}

function mandateObjectMatchesRoute(
  objectType: string | undefined,
  routeId: string,
) {
  if (routeId === "sui_momentum_buy") {
    return Boolean(objectType?.includes("::mandate::AssetMandate<"));
  }

  return Boolean(objectType?.endsWith("::mandate::Mandate"));
}

function fullnodeUrl(repoRoot: string, network: SuiNetwork) {
  return getRpcUrl(network, runtimeEnvReader(repoRoot));
}

async function fetchMandateObjectType(
  mandateId: string,
  repoRoot: string,
  network: SuiNetwork,
) {
  const response = await fetch(fullnodeUrl(repoRoot, network), {
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
  });

  if (!response.ok) {
    throw new Error(
      `Unable to fetch mandate object type: HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    error?: { message?: string };
    result?: {
      data?: {
        content?: {
          dataType?: string;
          type?: string;
          fields?: {
            owner?: string;
          };
        };
      };
    };
  };

  if (payload.error) {
    throw new Error(
      payload.error.message ?? "Unable to fetch mandate object type",
    );
  }

  const content = payload.result?.data?.content;
  return content?.dataType === "moveObject"
    ? { objectType: content.type, owner: content.fields?.owner }
    : { objectType: undefined, owner: undefined };
}

function parseAgentOutput(output: string, error?: string): AgentRunResult {
  const status = readSection(output, "Status");
  const blockedReasonText = readSection(output, "Blocked Reason");
  const errorText = error ?? readSection(output, "Failure Reason");
  const blockedReason = classifyBlockedReason(errorText);
  const outputCoinObjects = readSection(output, "Output Coin Objects");
  const outputCoinObjectIds =
    outputCoinObjects && outputCoinObjects !== "-"
      ? outputCoinObjects
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
  const outputAsset = readSection(output, "Output Asset");
  const outputCoinType = readSection(output, "Output Coin Type");
  const outputAmount = readSection(output, "Output Amount");
  const residualSui =
    readSection(output, "Residual SUI") ||
    readSection(output, "Residual DeepBook USDC");
  const outputOwner = readSection(output, "Output Owner");
  const fillStatus = readSection(output, "Fill Status");
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
    ...(outputAsset && outputAsset !== "-" ? { outputAsset } : {}),
    ...(outputCoinType && outputCoinType !== "-" ? { outputCoinType } : {}),
    ...(outputAmount && outputAmount !== "-" ? { outputAmount } : {}),
    ...(residualSui && residualSui !== "-" ? { residualSui } : {}),
    ...(outputCoinObjectIds.length > 0 ? { outputCoinObjectIds } : {}),
    ...(outputOwner && outputOwner !== "-" ? { outputOwner } : {}),
    ...(fillStatus === "filled" ||
    fillStatus === "no_fill" ||
    fillStatus === "amount_unavailable"
      ? { fillStatus }
      : {}),
    ...(blockedReasonText || blockedReason
      ? { blockedReason: blockedReasonText || blockedReason }
      : {}),
    ...(errorText ? { error: errorText } : {}),
  };
}

function classifyBlockedReason(message?: string) {
  const lower = message?.toLowerCase() ?? "";
  if (!lower) {
    return undefined;
  }

  if (lower.includes("abort code: 2") || lower.includes("abort_code: 2")) {
    return "agent wallet mismatch";
  }
  if (lower.includes("abort code: 3") || lower.includes("abort_code: 3")) {
    return "revoked";
  }
  if (lower.includes("abort code: 4") || lower.includes("abort_code: 4")) {
    return "expired";
  }
  if (lower.includes("abort code: 5") || lower.includes("abort_code: 5")) {
    return "protocol not allowed";
  }
  if (lower.includes("abort code: 6") || lower.includes("abort_code: 6")) {
    return "exceeds per-tx cap";
  }
  if (lower.includes("abort code: 7") || lower.includes("abort_code: 7")) {
    return "exceeds remaining budget";
  }
  if (lower.includes("moveabort") || lower.includes("move abort")) {
    return "Move policy rejected the agent action";
  }

  return undefined;
}

function executionLogStatus(result: AgentRunResult) {
  if (result.status === "BLOCKED") {
    return "blocked";
  }
  if (result.status === "FAILED") {
    return "failed";
  }
  return result.fillStatus ?? "success";
}

async function readAgentRequest(request: Request) {
  try {
    return (await request.json()) as AgentRunRequest;
  } catch {
    return {};
  }
}

function requestMandateId(body: AgentRunRequest) {
  if (typeof body.mandateId === "string" && body.mandateId.trim()) {
    return body.mandateId.trim();
  }

  throw new Error(
    "mandateId is required. Automation must explicitly select a Mandate; MANDATE_ID is only a local script/debug fallback.",
  );
}

function requestOwnerAddress(body: AgentRunRequest) {
  if (typeof body.ownerAddress === "string" && body.ownerAddress.trim()) {
    return body.ownerAddress.trim();
  }

  throw new Error("ownerAddress is required for stateless agent execution.");
}

function requestAmountSui(body: AgentRunRequest) {
  return typeof body.amountSui === "number" && Number.isFinite(body.amountSui)
    ? String(body.amountSui)
    : "0.001";
}

function requestStrategy(body: AgentRunRequest) {
  return typeof body.strategy === "string" ? body.strategy : "normal";
}

function requestTradingRoute(body: AgentRunRequest) {
  const route =
    typeof body.routeId === "string"
      ? tradingRouteById(body.routeId)
      : defaultTradingRoute();

  if (!route) {
    throw new Error(`Unknown trading route: ${String(body.routeId)}`);
  }
  if (!route.action.executable) {
    throw new Error(
      route.action.unavailableReason ??
        `Trading route ${route.id} is not executable in this build.`,
    );
  }

  return route;
}

function requestBlockedReason(body: AgentRunRequest) {
  const strategy = requestStrategy(body);
  if (strategy === "exceed_per_tx") {
    return "exceeds_per_tx_cap";
  }
  if (strategy === "exceed_budget") {
    return "exceeds_remaining_budget";
  }
  if (strategy === "revoked_expired") {
    return "mandate_inactive_or_expired";
  }

  return undefined;
}

export async function POST(request: Request) {
  const repoRoot = findRepoRoot();
  const body = await readAgentRequest(request);
  let mandateId: string;
  let ownerAddress: string;
  let amountSui: string;
  let blockedReason: string | undefined;
  let packageId: string;
  let network: SuiNetwork;
  let agentPrivateKey: string;
  let backendAgentAddress: string;
  let deepBookPoolId: string;
  let deepBookPoolKey: string;
  let tradingRoute: ReturnType<typeof requestTradingRoute>;

  try {
    mandateId = requestMandateId(body);
    ownerAddress = requestOwnerAddress(body);
    amountSui = requestAmountSui(body);
    blockedReason = requestBlockedReason(body);
    tradingRoute = requestTradingRoute(body);
    network = getSuiNetwork(runtimeEnvReader(repoRoot));
    packageId = runtimePackageId(repoRoot, network);
    agentPrivateKey = runtimeAgentPrivateKey(repoRoot);
    backendAgentAddress = runtimeBackendAgentAddress(repoRoot);
    const routeConfig = runtimeDeepBookRouteConfig(
      repoRoot,
      network,
      tradingRoute.id,
      tradingRoute.action.poolId,
    );
    deepBookPoolId = routeConfig.poolId;
    deepBookPoolKey = routeConfig.poolKey;
    assertBackendAgentMatchesSigner(backendAgentAddress, agentPrivateKey);
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught);
    return Response.json({ ...EMPTY_RESULT, error }, { status: 400 });
  }

  console.info("[MANDATE] agent run request", {
    owner: ownerAddress,
    mandateId,
    amountSui,
    strategy: requestStrategy(body),
    routeId: tradingRoute.id,
    packageId,
    network,
    poolKey: deepBookPoolKey,
    poolId: deepBookPoolId,
    spendAsset: tradingRoute.action.spendAsset,
    buyAsset: tradingRoute.action.buyAsset,
  });

  try {
    const { objectType, owner } = await fetchMandateObjectType(
      mandateId,
      repoRoot,
      network,
    );
    if (!isCurrentMandateObjectType(objectType, packageId)) {
      return Response.json(
        {
          ...EMPTY_RESULT,
          error: `${OLD_PACKAGE_ERROR} Expected current-package Mandate or AssetMandate, got ${objectType ?? "unknown object type"}.`,
        },
        { status: 400 },
      );
    }
    if (!mandateObjectMatchesRoute(objectType, tradingRoute.id)) {
      return Response.json(
        {
          ...EMPTY_RESULT,
          error:
            tradingRoute.id === "sui_momentum_buy"
              ? "Selected mandate uses SUI vault, but this route requires DUSDC vault."
              : "Selected mandate uses an asset vault, but this route requires SUI vault.",
        },
        { status: 400 },
      );
    }
    if (
      owner &&
      normalizeSuiAddress(owner) !== normalizeSuiAddress(ownerAddress)
    ) {
      return Response.json(
        {
          ...EMPTY_RESULT,
          error: `Selected mandate owner mismatch. Request owner ${ownerAddress}, object owner ${owner}.`,
        },
        { status: 403 },
      );
    }
  } catch (caught) {
    const error = caught instanceof Error ? caught.message : String(caught);
    return Response.json({ ...EMPTY_RESULT, error }, { status: 500 });
  }

  try {
    const DUSDCCoinType =
      runtimeEnvValue("NEXT_PUBLIC_DBUSDC_COIN_TYPE", repoRoot) ??
      runtimeEnvValue("NEXT_PUBLIC_DUSDC_COIN_TYPE", repoRoot) ??
      "";

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
          NEXT_PUBLIC_SUI_NETWORK: network,
          SUI_RPC_URL: fullnodeUrl(repoRoot, network),
          NEXT_PUBLIC_BACKEND_AGENT_ADDRESS: backendAgentAddress,
          MANDATE_ID: mandateId,
          ROUTE_ID: tradingRoute.id,
          POOL_KEY: deepBookPoolKey,
          DEEPBOOK_POOL_ID: deepBookPoolId,
          NEXT_PUBLIC_DEEPBOOK_POOL_ID: deepBookPoolId,
          NEXT_PUBLIC_DBUSDC_COIN_TYPE: DUSDCCoinType,
          NEXT_PUBLIC_DUSDC_COIN_TYPE: DUSDCCoinType,
          AMOUNT_SUI: amountSui,
          SPEND_ASSET: tradingRoute.action.spendAsset,
          BUY_ASSET: tradingRoute.action.buyAsset,
          STRATEGY: requestStrategy(body),
          ...(blockedReason ? { BLOCK_REASON: blockedReason } : {}),
        },
        timeout: 120_000,
        maxBuffer: 1024 * 1024,
      },
    );

    const result = parseAgentOutput(stdout, stderr.trim() || undefined);
    console.info("[MANDATE] agent run result", {
      owner: ownerAddress,
      mandateId,
      amountSui,
      packageId,
      routeId: tradingRoute.id,
      network,
      poolKey: deepBookPoolKey,
      poolId: deepBookPoolId,
      status: executionLogStatus(result),
    });
    return Response.json(result, {
      status: result.status === "FAILED" ? 500 : 200,
    });
  } catch (caught) {
    const error = caught as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
    const result = output.trim()
      ? parseAgentOutput(output, error.stderr?.trim() || error.message)
      : { ...EMPTY_RESULT, error: error.message ?? "Agent execution failed" };

    console.info("[MANDATE] agent run result", {
      owner: ownerAddress,
      mandateId,
      amountSui,
      packageId,
      routeId: tradingRoute.id,
      network,
      poolKey: deepBookPoolKey,
      poolId: deepBookPoolId,
      status: executionLogStatus(result),
    });
    return Response.json(result, {
      status: result.status === "BLOCKED" ? 200 : 500,
    });
  }
}
