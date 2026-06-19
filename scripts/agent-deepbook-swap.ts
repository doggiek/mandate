import "dotenv/config";

import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { deepbook } from "@mysten/deepbook-v3";

const SUI_TYPE = "0x2::sui::SUI";
const NORMALIZED_SUI_TYPE =
  "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
const MIST_PER_SUI = 1_000_000_000n;
const DEFAULT_BACKEND_AGENT_ADDRESS =
  "0x91dc52b575b3cd5703be07ee65e12b5af3a25d927b16fa8f94811b7b773ad8b2";
const OLD_PACKAGE_ERROR =
  "Selected mandate belongs to an old package. Create a new mandate with the current package.";

type SuiNetwork = "testnet" | "mainnet";

function activeNetwork(): SuiNetwork {
  const value = (
    process.env.NEXT_PUBLIC_SUI_NETWORK ??
    process.env.NEXT_PUBLIC_NETWORK ??
    "testnet"
  ).toLowerCase();

  return value === "mainnet" ? "mainnet" : "testnet";
}

function activeRpcUrl() {
  const network = activeNetwork();
  const suffix = network.toUpperCase();
  return (
    process.env.SUI_RPC_URL ??
    process.env[`NEXT_PUBLIC_SUI_RPC_${suffix}`] ??
    (network === "mainnet"
      ? "https://fullnode.mainnet.sui.io:443"
      : "https://fullnode.testnet.sui.io:443")
  );
}

type TransactionLike = {
  digest?: string;
  status?: {
    success?: boolean;
    error?: unknown;
  };
  effects?: {
    changedObjects?: Array<{ objectId?: string; object_id?: string }>;
    changed_objects?: Array<{ objectId?: string; object_id?: string }>;
    gasUsed?: GasUsedLike;
    gas_used?: GasUsedLike;
  };
  events?: Array<{ eventType?: string }>;
  balanceChanges?: Array<{
    coinType?: string;
    amount?: string;
    owner?: string | { AddressOwner?: string; ObjectOwner?: string };
  }>;
  objectChanges?: Array<{
    type?: string;
    objectType?: string;
    objectId?: string;
    owner?:
      | string
      | {
          AddressOwner?: string;
          ObjectOwner?: string;
          Shared?: unknown;
          Immutable?: boolean;
        };
  }>;
};

type GasUsedLike = {
  computationCost?: string;
  computation_cost?: string;
  storageCost?: string;
  storage_cost?: string;
  storageRebate?: string;
  storage_rebate?: string;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function requireEnvWithFallback(name: string, fallbackName: string): string {
  const value = process.env[name] ?? process.env[fallbackName];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function requireSuiAddressEnv(name: string): string {
  const value = requireEnv(name);
  if (!isValidSuiAddress(value)) {
    throw new Error(
      `${name} must be a valid Sui object/address id, got: ${value}`,
    );
  }
  return value;
}

function requireSuiAddressValue(label: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${label}`);
  }
  const trimmed = value.trim();
  if (!isValidSuiAddress(trimmed)) {
    throw new Error(
      `${label} must be a valid Sui object/address id, got: ${trimmed}`,
    );
  }
  return trimmed;
}

function activePackageId() {
  const networkSuffix = activeNetwork().toUpperCase();
  return requireSuiAddressValue(
    `PACKAGE_ID or NEXT_PUBLIC_PACKAGE_ID_${networkSuffix}`,
    process.env.PACKAGE_ID ??
      process.env[`NEXT_PUBLIC_PACKAGE_ID_${networkSuffix}`] ??
      process.env.NEXT_PUBLIC_PACKAGE_ID,
  );
}

function normalizeSuiAddress(value: string): string {
  const raw = value.trim().toLowerCase();
  const withoutPrefix = raw.startsWith("0x") ? raw.slice(2) : raw;
  const normalized = withoutPrefix.replace(/^0+/, "") || "0";
  return `0x${normalized}`;
}

function packageFromObjectType(objectType: string | undefined): string {
  return objectType?.split("::")[0] ?? "";
}

type MandateObjectInfo = {
  objectType?: string;
  owner?: string;
};

type CoinObjectInfo = {
  objectId: string;
  objectType?: string;
  owner?: string;
  balance?: string;
};

function isCurrentMandateObjectType(
  objectType: string | undefined,
  packageId: string,
): boolean {
  return (
    Boolean(
      objectType?.endsWith("::mandate::Mandate") ||
      objectType?.includes("::mandate::AssetMandate<"),
    ) &&
    normalizeSuiAddress(packageFromObjectType(objectType)) ===
      normalizeSuiAddress(packageId)
  );
}

async function fetchMandateObjectInfo(
  mandateId: string,
): Promise<MandateObjectInfo> {
  const response = await fetch(activeRpcUrl(), {
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
          fields?: Record<string, unknown>;
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
  const fields = content?.fields;
  const owner =
    fields && typeof fields.owner === "string" ? fields.owner : undefined;
  return {
    objectType: content?.dataType === "moveObject" ? content.type : undefined,
    owner,
  };
}

async function fetchCoinObjectInfo(objectId: string): Promise<CoinObjectInfo> {
  const response = await fetch(activeRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sui_getObject",
      params: [
        objectId,
        {
          showContent: true,
          showOwner: true,
          showType: true,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Unable to fetch coin object ${objectId}: HTTP ${response.status}`,
    );
  }

  const payload = (await response.json()) as {
    result?: {
      data?: {
        type?: string;
        owner?: string | { AddressOwner?: string };
        content?: {
          dataType?: string;
          fields?: {
            balance?: string;
          };
        };
      };
    };
  };
  const data = payload.result?.data;
  return {
    objectId,
    objectType: data?.type,
    owner: objectOwnerAddress(data?.owner),
    balance:
      data?.content?.dataType === "moveObject" &&
      typeof data.content.fields?.balance === "string"
        ? data.content.fields.balance
        : undefined,
  };
}

function parseSuiToMist(value: string): bigint {
  return parseDecimalToUnits(value, 9, "SUI amount");
}

function parseDecimalToUnits(
  value: string,
  decimals: number,
  label: string,
): bigint {
  const [wholePart, fractionalPart = ""] = value.split(".");
  if (!wholePart || !/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  const fractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  return (
    BigInt(wholePart) * BigInt(10) ** BigInt(decimals) +
    BigInt(fractional || "0")
  );
}

function formatMistDelta(amount: string | undefined): string {
  if (!amount) {
    return "0 SUI";
  }

  const value = BigInt(amount);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / MIST_PER_SUI;
  const fractional = (absolute % MIST_PER_SUI)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");

  return `${sign}${whole.toString()}${fractional ? `.${fractional}` : ""} SUI`;
}

function hasMandateActivityEvent(
  events: TransactionLike["events"],
  packageId: string,
): boolean {
  return (events ?? []).some(
    (event) => event.eventType === `${packageId}::mandate::ActivityEvent`,
  );
}

function hasDeepBookPoolMutation(
  effects: TransactionLike["effects"],
  expectedPoolId: string,
): boolean {
  const changedObjects =
    effects?.changedObjects ?? effects?.changed_objects ?? [];
  return changedObjects.some((object) => {
    const objectId = object.objectId ?? object.object_id;
    return objectId?.toLowerCase() === expectedPoolId.toLowerCase();
  });
}

function netSuiBalanceChange(
  balanceChanges: TransactionLike["balanceChanges"],
): string {
  const total = (balanceChanges ?? [])
    .filter(
      (change) =>
        change.coinType === SUI_TYPE || change.coinType === NORMALIZED_SUI_TYPE,
    )
    .reduce((sum, change) => sum + BigInt(change.amount ?? "0"), 0n);

  return formatMistDelta(total.toString());
}

function formatDeepAmount(amount: string | undefined): string | undefined {
  return formatBaseUnitsAmount(amount, 6, "DEEP");
}

function formatBaseUnitsAmount(
  amount: string | undefined,
  decimals: number,
  symbol: string,
): string | undefined {
  if (!amount) {
    return undefined;
  }

  const value = BigInt(amount);
  if (value <= 0n) {
    return undefined;
  }

  const scalar = BigInt(10) ** BigInt(decimals);
  const whole = value / scalar;
  const fractional = (value % scalar)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}${fractional ? `.${fractional}` : ""} ${symbol}`;
}

function sumPositiveCoinBalances(coins: CoinObjectInfo[]): string | undefined {
  const total = coins.reduce(
    (sum, coin) => sum + BigInt(coin.balance ?? "0"),
    0n,
  );
  return total > 0n ? total.toString() : undefined;
}

function ownerPositiveBalanceChange(
  balanceChanges: TransactionLike["balanceChanges"],
  ownerAddress: string,
  predicate: (coinType: string | undefined) => boolean,
): string | undefined {
  const total = (balanceChanges ?? [])
    .filter((change) => {
      const owner = objectOwnerAddress(change.owner);
      return (
        Boolean(owner) &&
        normalizeSuiAddress(owner!) === normalizeSuiAddress(ownerAddress) &&
        predicate(change.coinType)
      );
    })
    .reduce((sum, change) => sum + BigInt(change.amount ?? "0"), 0n);

  return total > 0n ? total.toString() : undefined;
}

function ownerOutputDeepAmount(
  balanceChanges: TransactionLike["balanceChanges"],
  ownerAddress: string,
): string | undefined {
  const amount = ownerPositiveBalanceChange(
    balanceChanges,
    ownerAddress,
    (coinType) =>
      Boolean(
        coinType && coinType !== SUI_TYPE && coinType !== NORMALIZED_SUI_TYPE,
      ),
  );
  return formatDeepAmount(amount);
}

function ownerPositiveCoinAmount(
  balanceChanges: TransactionLike["balanceChanges"],
  ownerAddress: string,
  coinTypePredicate: (coinType: string | undefined) => boolean,
  decimals: number,
  symbol: string,
): string | undefined {
  const amount = ownerPositiveBalanceChange(
    balanceChanges,
    ownerAddress,
    coinTypePredicate,
  );
  return formatBaseUnitsAmount(amount, decimals, symbol);
}

function ownerResidualSui(
  balanceChanges: TransactionLike["balanceChanges"],
  ownerAddress: string,
): string | undefined {
  const amount = ownerPositiveBalanceChange(
    balanceChanges,
    ownerAddress,
    (coinType) => coinType === SUI_TYPE || coinType === NORMALIZED_SUI_TYPE,
  );
  return amount ? formatMistDelta(amount) : undefined;
}

function gasFee(effects: TransactionLike["effects"]): string {
  const gasUsed = effects?.gasUsed ?? effects?.gas_used;
  if (!gasUsed) {
    return "-";
  }

  const computationCost = BigInt(
    gasUsed.computationCost ?? gasUsed.computation_cost ?? "0",
  );
  const storageCost = BigInt(
    gasUsed.storageCost ?? gasUsed.storage_cost ?? "0",
  );
  const storageRebate = BigInt(
    gasUsed.storageRebate ?? gasUsed.storage_rebate ?? "0",
  );
  return formatMistDelta(
    (computationCost + storageCost - storageRebate).toString(),
  );
}

function objectOwnerAddress(
  owner:
    | string
    | {
        AddressOwner?: string;
        ObjectOwner?: string;
        Shared?: unknown;
        Immutable?: boolean;
      }
    | undefined,
): string | undefined {
  if (typeof owner === "string") {
    return owner;
  }
  return owner?.AddressOwner;
}

function isSuiCoinObjectType(objectType: string | undefined): boolean {
  return Boolean(
    objectType?.includes("::coin::Coin<") &&
    (objectType.includes("::sui::SUI") ||
      objectType.includes(`${SUI_TYPE}>`) ||
      objectType.includes(`${NORMALIZED_SUI_TYPE}>`)),
  );
}

function outputCoinObjectIds(
  objectChanges: TransactionLike["objectChanges"],
  mandateOwner: string,
): string[] {
  return (objectChanges ?? [])
    .filter((change) => {
      const owner = objectOwnerAddress(change.owner);
      return (
        change.type === "created" &&
        Boolean(change.objectId) &&
        change.objectType?.includes("::coin::Coin<") &&
        !isSuiCoinObjectType(change.objectType) &&
        Boolean(owner) &&
        normalizeSuiAddress(owner!) === normalizeSuiAddress(mandateOwner)
      );
    })
    .map((change) => change.objectId!);
}

function outputCoinObjectIdsForCoinType(
  objectChanges: TransactionLike["objectChanges"],
  mandateOwner: string,
  coinTypePredicate: (coinType: string | undefined) => boolean,
): string[] {
  return (objectChanges ?? [])
    .filter((change) => {
      const owner = objectOwnerAddress(change.owner);
      return (
        change.type === "created" &&
        Boolean(change.objectId) &&
        change.objectType?.includes("::coin::Coin<") &&
        coinTypePredicate(change.objectType) &&
        Boolean(owner) &&
        normalizeSuiAddress(owner!) === normalizeSuiAddress(mandateOwner)
      );
    })
    .map((change) => change.objectId!);
}

function printDemoSummary({
  digest,
  success,
  mandateId,
  poolKey,
  amountSui,
  amountAsset,
  activityEventFound,
  deepBookPoolMutated,
  balanceChange,
  gasFeeSui,
  outputCoinIds,
  outputOwner,
  outputCoinType,
  outputAsset,
  outputAmount,
  residualSui,
  residualLabel,
  fillStatus,
  failureReason,
}: {
  digest: string;
  success: boolean;
  mandateId: string;
  poolKey: string;
  amountSui: string;
  amountAsset: string;
  activityEventFound: boolean;
  deepBookPoolMutated: boolean;
  balanceChange: string;
  gasFeeSui: string;
  outputCoinIds: string[];
  outputOwner: string;
  outputCoinType?: string;
  outputAsset: string;
  outputAmount?: string;
  residualSui?: string;
  residualLabel: string;
  fillStatus: "filled" | "no_fill" | "amount_unavailable";
  failureReason?: unknown;
}) {
  console.log("========================================");
  console.log("Mandate DeepBook Demo");
  console.log("========================================");
  console.log("");
  console.log("Digest:");
  console.log(digest);
  console.log("");
  console.log("Status:");
  console.log(success ? "SUCCESS" : "FAILED");
  console.log("");
  console.log("Mandate:");
  console.log(mandateId);
  console.log("");
  console.log("Pool:");
  console.log(poolKey);
  console.log("");
  console.log("Amount:");
  console.log(`${amountSui} ${amountAsset}`);
  console.log("");
  console.log("Activity Event:");
  console.log(activityEventFound ? "FOUND" : "NOT FOUND");
  console.log("");
  console.log("DeepBook Pool Mutation:");
  console.log(deepBookPoolMutated ? "FOUND" : "NOT FOUND");
  console.log("");
  console.log("Balance Change:");
  console.log(balanceChange);
  console.log("");
  console.log("Gas Fee:");
  console.log(gasFeeSui);
  console.log("");
  console.log("Output Asset:");
  console.log(outputAmount || outputCoinIds.length > 0 ? outputAsset : "-");
  console.log("");
  console.log("Output Coin Type:");
  console.log(outputCoinType ?? "-");
  console.log("");
  console.log("Output Amount:");
  console.log(outputAmount ?? "-");
  console.log("");
  console.log(residualLabel);
  console.log(residualSui ?? "-");
  console.log("");
  console.log("Fill Status:");
  console.log(fillStatus);
  console.log("");
  console.log("Output Coin Objects:");
  console.log(outputCoinIds.length > 0 ? outputCoinIds.join(",") : "-");
  console.log("");
  console.log("Output Owner:");
  console.log(outputOwner);

  if (!success) {
    console.log("");
    console.log("Failure Reason:");
    console.log(JSON.stringify(failureReason ?? null));
  }

  console.log("");
  console.log("========================================");
}

async function main() {
  const agentPrivateKey = requireEnvWithFallback(
    "BACKEND_AGENT_PRIVATE_KEY",
    "AGENT_PRIVATE_KEY",
  );
  const packageId = activePackageId();
  const mandateId = requireSuiAddressEnv("MANDATE_ID");

  const routeId = process.env.ROUTE_ID ?? "deep_momentum_buy";
  const networkSuffix = activeNetwork().toUpperCase();
  const poolKey =
    process.env.POOL_KEY ??
    process.env[`NEXT_PUBLIC_DEEPBOOK_POOL_KEY_${networkSuffix}`] ??
    (routeId === "sui_momentum_buy" ? "SUI_DUSDC" : "DEEP_SUI");
  const poolId =
    process.env.DEEPBOOK_POOL_ID ??
    process.env[`NEXT_PUBLIC_DEEPBOOK_POOL_ID_${networkSuffix}`] ??
    process.env.NEXT_PUBLIC_DEEPBOOK_POOL_ID;
  const amountSui = process.env.AMOUNT_SUI ?? "0.001";
  const strategy = process.env.STRATEGY ?? "normal";
  const minOut = Number(process.env.MIN_OUT ?? "0");
  const deepAmount = Number(process.env.DEEP_AMOUNT ?? "0");
  const isDUSDCRoute =
    routeId === "sui_momentum_buy" || poolKey === "SUI_DUSDC";
  const DUSDCCoinType =
    process.env.NEXT_PUBLIC_DBUSDC_COIN_TYPE ??
    process.env.NEXT_PUBLIC_DUSDC_COIN_TYPE;
  const amountUnits = isDUSDCRoute
    ? parseDecimalToUnits(amountSui, 6, "DUSDC amount")
    : parseSuiToMist(amountSui);

  if (poolKey !== "DEEP_SUI" && poolKey !== "SUI_DUSDC") {
    throw new Error(
      `DeepBook swap unavailable; fallback transfer disabled. Unsupported POOL_KEY ${poolKey}.`,
    );
  }
  if (isDUSDCRoute && !DUSDCCoinType) {
    throw new Error(
      "DeepBook swap unavailable; fallback transfer disabled. Missing NEXT_PUBLIC_DBUSDC_COIN_TYPE / NEXT_PUBLIC_DUSDC_COIN_TYPE.",
    );
  }
  if (!poolId || !isValidSuiAddress(poolId)) {
    throw new Error(
      "DeepBook swap unavailable; fallback transfer disabled. Missing current network DeepBook pool id.",
    );
  }

  const { secretKey, scheme } = decodeSuiPrivateKey(agentPrivateKey);
  if (scheme !== "ED25519") {
    throw new Error(
      `BACKEND_AGENT_PRIVATE_KEY must be an ED25519 Sui private key, got ${scheme}`,
    );
  }

  const keypair = Ed25519Keypair.fromSecretKey(secretKey);
  const agentAddress = keypair.toSuiAddress();
  const expectedAgentAddress =
    process.env.NEXT_PUBLIC_BACKEND_AGENT_ADDRESS ??
    process.env.NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS ??
    DEFAULT_BACKEND_AGENT_ADDRESS;
  if (
    normalizeSuiAddress(expectedAgentAddress) !==
    normalizeSuiAddress(agentAddress)
  ) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS does not match BACKEND_AGENT_PRIVATE_KEY. Update .env.local so the Mandate backend agent address and backend agent signer are the same wallet.",
    );
  }
  const mandateObject = await fetchMandateObjectInfo(mandateId);
  const mandateObjectType = mandateObject.objectType;
  const mandateOwner = mandateObject.owner;

  console.log("[MANDATE] agent execution preflight");
  console.log(`[MANDATE] package id: ${packageId}`);
  console.log(`[MANDATE] mandate id: ${mandateId}`);
  console.log(
    `[MANDATE] mandate objectType: ${mandateObjectType ?? "unknown"}`,
  );
  console.log(`[MANDATE] mandate owner: ${mandateOwner ?? "unknown"}`);
  console.log(`[MANDATE] agent wallet address: ${agentAddress}`);
  console.log(`[MANDATE] selected strategy: ${strategy}`);
  console.log(`[MANDATE] route id: ${routeId}`);
  console.log(`[MANDATE] DeepBook pool key: ${poolKey}`);
  console.log(`[MANDATE] DeepBook pool id: ${poolId}`);

  if (!isCurrentMandateObjectType(mandateObjectType, packageId)) {
    throw new Error(
      `${OLD_PACKAGE_ERROR} Expected current-package Mandate or AssetMandate, got ${
        mandateObjectType ?? "unknown object type"
      }.`,
    );
  }
  if (!mandateOwner || !isValidSuiAddress(mandateOwner)) {
    throw new Error(`Unable to read mandate owner from object ${mandateId}`);
  }

  const client = new SuiGrpcClient({
    network: activeNetwork(),
    baseUrl: activeRpcUrl(),
  }).$extend(deepbook({ address: agentAddress }));

  const tx = new Transaction();
  tx.setSender(agentAddress);

  // The agent pays gas, but the swap input coin is withdrawn from the
  // Owner-funded Mandate vault. Route config decides the vault asset type.
  let swapInputCoin;
  if (isDUSDCRoute) {
    [swapInputCoin] = tx.moveCall({
      target: `${packageId}::mandate::authorize_and_take_coin_for_deepbook`,
      typeArguments: [DUSDCCoinType!],
      arguments: [
        tx.object(mandateId),
        tx.pure.u64(amountUnits),
        tx.object.clock(),
      ],
    });
  } else {
    [swapInputCoin] = tx.moveCall({
      target: `${packageId}::mandate::authorize_and_take_sui_for_deepbook`,
      arguments: [
        tx.object(mandateId),
        tx.pure.u64(amountUnits),
        tx.object.clock(),
      ],
    });
  }

  const [baseCoinOut, quoteCoinOut, deepCoinOut] =
    client.deepbook.deepBook.swapExactQuantity({
      poolKey,
      amount: Number(amountSui),
      deepAmount,
      minOut,
      isBaseToCoin: false,
      quoteCoin: swapInputCoin,
    })(tx);

  tx.transferObjects([baseCoinOut, quoteCoinOut, deepCoinOut], mandateOwner);

  const result = await client.core.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    include: {
      effects: true,
      events: true,
      balanceChanges: true,
      objectChanges: true,
      transaction: true,
    },
  });

  const submitted = (result.Transaction ?? result.FailedTransaction) as
    | TransactionLike
    | undefined;
  const digest = submitted?.digest;
  if (!digest) {
    throw new Error(
      "signAndExecuteTransaction did not return a transaction digest",
    );
  }

  const confirmedResult = await client.core.waitForTransaction({
    digest,
    include: {
      effects: true,
      events: true,
      balanceChanges: true,
      objectChanges: true,
      transaction: true,
    },
  });

  const confirmed = (confirmedResult.Transaction ??
    confirmedResult.FailedTransaction) as TransactionLike | undefined;
  if (!confirmed?.digest) {
    throw new Error(
      `waitForTransaction did not return details for digest ${digest}`,
    );
  }

  const success = confirmed.status?.success === true;
  const activityEventFound = hasMandateActivityEvent(
    confirmed.events,
    packageId,
  );
  const deepBookPoolMutated = hasDeepBookPoolMutation(
    confirmed.effects,
    poolId,
  );
  const outputCoinIds = isDUSDCRoute
    ? outputCoinObjectIdsForCoinType(
        confirmed.objectChanges,
        mandateOwner,
        (objectType) => Boolean(objectType?.includes("::sui::SUI")),
      )
    : outputCoinObjectIds(confirmed.objectChanges, mandateOwner);
  const outputCoinInfos = await Promise.all(
    outputCoinIds.map((objectId) =>
      fetchCoinObjectInfo(objectId).catch(() => ({
        objectId,
      })),
    ),
  );
  const outputCoinType = outputCoinInfos.find(
    (coin) => coin.objectType,
  )?.objectType;
  const balanceChangeOutputAmount = isDUSDCRoute
    ? ownerPositiveCoinAmount(
        confirmed.balanceChanges,
        mandateOwner,
        (coinType) => coinType === SUI_TYPE || coinType === NORMALIZED_SUI_TYPE,
        9,
        "SUI",
      )
    : ownerOutputDeepAmount(confirmed.balanceChanges, mandateOwner);
  const objectOutputAmount = isDUSDCRoute
    ? formatBaseUnitsAmount(sumPositiveCoinBalances(outputCoinInfos), 9, "SUI")
    : formatDeepAmount(sumPositiveCoinBalances(outputCoinInfos));
  const outputAmount = balanceChangeOutputAmount ?? objectOutputAmount;
  const residualSui = isDUSDCRoute
    ? ownerPositiveCoinAmount(
        confirmed.balanceChanges,
        mandateOwner,
        (coinType) =>
          Boolean(
            DUSDCCoinType &&
            coinType?.toLowerCase() === DUSDCCoinType.toLowerCase(),
          ),
        6,
        "DUSDC",
      )
    : ownerResidualSui(confirmed.balanceChanges, mandateOwner);
  const hasParsedObjectBalances = outputCoinInfos.some(
    (coin) => typeof coin.balance === "string",
  );
  const fillStatus = outputAmount
    ? "filled"
    : outputCoinIds.length === 0 || hasParsedObjectBalances
      ? "no_fill"
      : "amount_unavailable";

  printDemoSummary({
    digest: confirmed.digest,
    success,
    mandateId,
    poolKey,
    amountSui,
    amountAsset: isDUSDCRoute ? "DUSDC" : "SUI",
    activityEventFound,
    deepBookPoolMutated,
    balanceChange: netSuiBalanceChange(confirmed.balanceChanges),
    gasFeeSui: gasFee(confirmed.effects),
    outputCoinIds,
    outputOwner: mandateOwner,
    outputCoinType,
    outputAsset: isDUSDCRoute ? "SUI" : "DEEP",
    outputAmount,
    residualSui,
    residualLabel: isDUSDCRoute ? "Residual tDUSDC:" : "Residual SUI:",
    fillStatus,
    failureReason: confirmed.status?.error,
  });

  if (!success) {
    throw new Error(
      `Transaction ${confirmed.digest} failed: ${JSON.stringify(confirmed.status?.error ?? null)}`,
    );
  }
}

main().catch((error) => {
  if (process.env.DEBUG_STACK === "1") {
    console.error(error);
    if (error && typeof error === "object" && "issues" in error) {
      console.dir((error as { issues: unknown }).issues, { depth: null });
    }
    process.exit(1);
  }

  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
