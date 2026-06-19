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
import {
  recordBlockedAction,
  runAgentDeepBookSwap,
} from "@/lib/server/agent-runner";
import { defaultTradingRoute, tradingRouteById } from "@/lib/trading-routes";

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

function runtimeEnvValue(name: string) {
  return process.env[name]?.trim();
}

function runtimeEnvReader(name: string) {
  return runtimeEnvValue(name);
}

function runtimePackageId(network: SuiNetwork) {
  const packageId = getPackageId(network, runtimeEnvReader);

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

function runtimeAgentPrivateKey() {
  const agentPrivateKey =
    runtimeEnvValue("BACKEND_AGENT_PRIVATE_KEY") ??
    runtimeEnvValue("AGENT_PRIVATE_KEY");

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

function runtimeBackendAgentAddress() {
  return (
    runtimeEnvValue("NEXT_PUBLIC_BACKEND_AGENT_ADDRESS") ??
    runtimeEnvValue("NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS") ??
    BACKEND_AGENT_ADDRESS
  );
}

function runtimeDeepBookRouteConfig(
  network: SuiNetwork,
  routeId: string,
  configuredPoolId: string,
) {
  const activeRoute = getActiveDeepBookRouteConfig(
    network,
    runtimeEnvReader,
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

function fullnodeUrl(network: SuiNetwork) {
  return getRpcUrl(network, runtimeEnvReader);
}

async function fetchMandateObjectType(
  mandateId: string,
  network: SuiNetwork,
) {
  const response = await fetch(fullnodeUrl(network), {
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
    network = getSuiNetwork(runtimeEnvReader);
    packageId = runtimePackageId(network);
    agentPrivateKey = runtimeAgentPrivateKey();
    backendAgentAddress = runtimeBackendAgentAddress();
    const routeConfig = runtimeDeepBookRouteConfig(
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
      runtimeEnvValue("NEXT_PUBLIC_DBUSDC_COIN_TYPE") ??
      runtimeEnvValue("NEXT_PUBLIC_DUSDC_COIN_TYPE") ??
      "";
    const rpcUrl = fullnodeUrl(network);
    const result = blockedReason
      ? await recordBlockedAction({
          agentPrivateKey,
          expectedAgentAddress: backendAgentAddress,
          packageId,
          mandateId,
          routeId: tradingRoute.id,
          network,
          rpcUrl,
          amountSui,
          reason: blockedReason,
          dusdcCoinType: DUSDCCoinType,
        })
      : await runAgentDeepBookSwap({
          agentPrivateKey,
          expectedAgentAddress: backendAgentAddress,
          packageId,
          mandateId,
          routeId: tradingRoute.id,
          network,
          rpcUrl,
          poolKey: deepBookPoolKey,
          poolId: deepBookPoolId,
          amountSui,
          strategy: requestStrategy(body),
          dusdcCoinType: DUSDCCoinType,
        });
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
    const error = caught instanceof Error ? caught.message : String(caught);
    const blockedReasonFromError = classifyBlockedReason(error);
    const result = {
      ...EMPTY_RESULT,
      status: blockedReasonFromError ? ("BLOCKED" as const) : ("FAILED" as const),
      ...(blockedReasonFromError ? { blockedReason: blockedReasonFromError } : {}),
      error,
    };

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
