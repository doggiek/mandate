"use client";

import * as React from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import {
  currentMandateObjectType,
  currentAssetMandateObjectType,
  DUSDC_COIN_TYPE,
  DEEPBOOK_POOL_KEY,
  DEEPBOOK_POOL_KEY_SUI_DUSDC,
  isCurrentMandateObjectType,
  NETWORK,
  PACKAGE_ID,
} from "@/lib/chain-config";
import {
  AGENTS,
  ALL_PROTOCOLS,
  type ActivityEvent,
  type DeepBookOrder,
  type ExecutionStatus,
  type FillStatus,
  type Mandate,
  type Protocol,
} from "@/lib/mandate-data";
import { formatSui, stableExpiryLabel } from "@/lib/format";
import {
  getMandateObject,
  getTransactionDetails,
  queryMandateActivityEvents,
  queryMandateBlockedEvents,
  queryMandateCreatedEvents,
  queryMandateRejectEvents,
  queryMandateRevokeEvents,
  queryMandateWithdrawEvents,
} from "@/lib/sui-rpc";
import type {
  SuiEvent,
  SuiObjectResponse,
  SuiTransactionBlockResponse,
} from "@mysten/sui/jsonRpc";

const USER_MANDATES_KEY = `mandate:userMandates:${NETWORK}`;
const USER_ACTIVITY_KEY = `mandate:userActivity:${NETWORK}`;
const USER_METADATA_KEY = `mandate:userMetadata:${NETWORK}`;
const USER_EXECUTIONS_KEY = `mandate:deepbookExecutions:${NETWORK}`;

export type NewMandateInput = {
  id?: string;
  label: string;
  agentId: string;
  ownerAddress?: string;
  agentAddress?: string;
  budget: number;
  txLimit: number;
  approvalThreshold: number;
  protocols: Protocol[];
  durationDays: number;
  network: Mandate["network"];
  digest?: string;
  ttlMs?: string;
  expiresLabel?: string;
  objectType?: string;
  spendAsset?: string;
  assetSymbol?: string;
  assetDecimals?: number;
};

type StoreContextValue = {
  mandates: Mandate[];
  activity: ActivityEvent[];
  orders: DeepBookOrder[];
  loading: boolean;
  error: string | null;
  isWalletScoped: boolean;
  createMandate: (input: NewMandateInput) => Mandate;
  revokeMandate: (id: string, digest?: string) => void;
  withdrawMandate: (id: string, digest?: string) => void;
  recordAgentExecution: (input: {
    mandateId: string;
    digest?: string;
    amountSui?: number;
    suiBalanceChange?: number;
    gasFeeSui?: number;
    outputCoinObjectIds?: string[];
    outputOwner?: string;
    outputAsset?: string;
    outputAmount?: string;
    outputCoinType?: string;
    residualSuiAmount?: number;
    residualAmount?: number;
    residualAsset?: string;
    inputAsset?: string;
    inputAmount?: number;
    fillStatus?: FillStatus;
    pair?: string;
    side?: "Buy" | "Sell";
  }) => void;
  recordBlockedAction: (input: {
    mandateId: string;
    digest?: string;
    amountSui?: number;
    reason: string;
  }) => void;
  refreshMandates: () => void;
  clearUserDemoData: () => void;
};

type UserMandateMetadata = {
  mandateId: string;
  label: string;
  createdDigest?: string;
  createdAt: string;
  ttl?: string;
};

const StoreContext = React.createContext<StoreContextValue | null>(null);

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

function mistToSui(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return numeric / 1_000_000_000;
}

function baseUnitsToDisplay(value: unknown, decimals = 9) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return numeric / 10 ** decimals;
}

function assetMetadataFromObjectType(objectType?: string) {
  if (objectType?.includes("::mandate::AssetMandate<")) {
    const coinType = objectType.match(/AssetMandate<(.+)>/)?.[1];
    if (
      coinType &&
      DUSDC_COIN_TYPE &&
      coinType.toLowerCase() === DUSDC_COIN_TYPE.toLowerCase()
    ) {
      return {
        spendAsset: "DUSDC",
        assetSymbol: "DUSDC",
        assetDecimals: 6,
      };
    }

    return {
      spendAsset: "asset vault",
      assetSymbol: "asset",
      assetDecimals: 9,
    };
  }

  return {
    spendAsset: "SUI",
    assetSymbol: "SUI",
    assetDecimals: 9,
  };
}

function formatAssetAmount(value: number | undefined, symbol = "SUI") {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  if (symbol === "SUI") {
    return formatSui(value);
  }

  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
    useGrouping: false,
  })} ${symbol}`;
}

function clientTimeDisplay(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;

  if (!Number.isFinite(then) || diffMs < 60_000) {
    return "just now";
  }

  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) {
    return `${mins}m ago`;
  }

  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  return `${Math.floor(hours / 24)}d ago`;
}

function displayTimeFromMs(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clientTimeDisplay(new Date(value).toISOString())
    : "-";
}

function timestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function deriveMandateStatus(mandate: Mandate): Mandate["status"] {
  if (mandate.status === "revoked") {
    return "revoked";
  }

  const expiresAt = new Date(mandate.expiresAt).getTime();
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return "expired";
  }

  return "active";
}

function normalizeMandateStatus(mandate: Mandate): Mandate {
  const status = deriveMandateStatus(mandate);
  const remainingVaultBalance =
    mandate.remainingVaultBalance ?? Math.max(mandate.budget - mandate.spent, 0);
  return {
    ...mandate,
    status,
    remainingVaultBalance,
    isWithdrawable: status !== "active" && remainingVaultBalance > 0,
    isWithdrawn: remainingVaultBalance <= 0,
    expiresLabel:
      status === "expired"
        ? "Expired"
        : (mandate.expiresLabel ??
          stableExpiryLabel(mandate.expiresAt, status)),
    createdAtDisplay: clientTimeDisplay(mandate.createdAt),
  };
}

function ttlLabel(ttl?: string) {
  switch (ttl) {
    case "3600000":
      return "1h";
    case "43200000":
      return "12h";
    case "86400000":
      return "24h";
    case "604800000":
      return "7d";
    default:
      return undefined;
  }
}

function parsedJsonRecord(event: SuiEvent) {
  return event.parsedJson && typeof event.parsedJson === "object"
    ? (event.parsedJson as Record<string, unknown>)
    : {};
}

function eventDigest(event: SuiEvent) {
  return event.id?.txDigest ?? "";
}

function eventMandateId(event: SuiEvent) {
  const parsed = parsedJsonRecord(event);
  const id = parsed.mandate_id ?? parsed.mandateId;
  return typeof id === "string" ? id : null;
}

function eventReason(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return new TextDecoder().decode(new Uint8Array(value));
  }

  return undefined;
}

function eventTimestampMs(event: SuiEvent) {
  return timestampMs(event.timestampMs);
}

function payloadTimestampMs(event: SuiEvent) {
  const parsed = parsedJsonRecord(event);
  return timestampMs(parsed.timestamp_ms) ?? timestampMs(parsed.created_at_ms);
}

function moveObjectFields(response: SuiObjectResponse) {
  const content = response.data?.content;
  if (!content || content.dataType !== "moveObject") {
    return {};
  }

  return "fields" in content && typeof content.fields === "object"
    ? (content.fields as Record<string, unknown>)
    : {};
}

function moveBalanceValue(value: unknown): unknown {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if ("value" in record) {
    return record.value;
  }

  if ("fields" in record) {
    return moveBalanceValue(record.fields);
  }

  return undefined;
}

function moveObjectType(response?: SuiObjectResponse) {
  const content = response?.data?.content;
  return content && content.dataType === "moveObject"
    ? content.type
    : undefined;
}

function mapCreatedEventToMandate(
  event: SuiEvent,
  object?: SuiObjectResponse,
): Mandate | null {
  const parsed = parsedJsonRecord(event);
  const objectFields = object ? moveObjectFields(object) : {};
  const mandateId = eventMandateId(event);
  if (!mandateId) {
    return null;
  }

  const owner = parsed.owner;
  const agent = parsed.agent ?? objectFields.agent;
  const createdAtMs =
    timestampMs(parsed.created_at_ms) ??
    timestampMs(objectFields.created_at_ms) ??
    timestampMs(event.timestampMs);
  const expiresAtMs =
    timestampMs(parsed.expires_at_ms) ??
    timestampMs(objectFields.expires_at_ms) ??
    0;
  const isActive = objectFields.is_active !== false;
  const currentSpent = objectFields.current_spent ?? 0;
  const budgetCeiling =
    parsed.budget_ceiling ?? objectFields.budget_ceiling ?? 0;
  const maxSingleTx = parsed.max_single_tx ?? objectFields.max_single_tx ?? 0;
  const expiresAt =
    expiresAtMs > 0
      ? new Date(expiresAtMs).toISOString()
      : new Date((createdAtMs ?? 0) + 86_400_000).toISOString();
  const createdAt = createdAtMs
    ? new Date(createdAtMs).toISOString()
    : new Date(0).toISOString();
  const isExpired = new Date(expiresAt).getTime() <= Date.now();
  const status: Mandate["status"] = !isActive
    ? "revoked"
    : isExpired
      ? "expired"
      : "active";
  const objectType = moveObjectType(object);
  const asset = assetMetadataFromObjectType(objectType);
  const amountDecimals = asset.assetDecimals;
  const rawVaultBalance =
    objectType?.includes("::mandate::AssetMandate<")
      ? moveBalanceValue(objectFields.vault_balance)
      : moveBalanceValue(objectFields.sui_balance);
  const remainingVaultBalance = baseUnitsToDisplay(
    rawVaultBalance ??
      Math.max(Number(budgetCeiling ?? 0) - Number(currentSpent ?? 0), 0),
    amountDecimals,
  );
  if (process.env.NODE_ENV !== "production") {
    console.info("[MANDATE] loaded mandate object", {
      mandateId,
      objectType,
      packageId: PACKAGE_ID,
      packageMatches: isCurrentMandateObjectType(objectType),
    });
  }

  return {
    id: mandateId,
    label: "Mandate",
    agent: AGENTS[0],
    ownerAddress: typeof owner === "string" ? owner : undefined,
    agentAddress: typeof agent === "string" ? agent : undefined,
    objectType,
    digest: eventDigest(event),
    status,
    spendAsset: asset.spendAsset,
    assetSymbol: asset.assetSymbol,
    assetDecimals: amountDecimals,
    budget: baseUnitsToDisplay(budgetCeiling, amountDecimals),
    spent: baseUnitsToDisplay(currentSpent, amountDecimals),
    protocols: ["DeepBook"],
    createdAt,
    expiresAt,
    txLimit: baseUnitsToDisplay(maxSingleTx, amountDecimals),
    approvalThreshold: baseUnitsToDisplay(maxSingleTx, amountDecimals),
    network: NETWORK === "mainnet" ? "mainnet" : "testnet",
    budgetCeilingSui: baseUnitsToDisplay(budgetCeiling, amountDecimals),
    spentSui: baseUnitsToDisplay(currentSpent, amountDecimals),
    maxSingleTxSui: baseUnitsToDisplay(maxSingleTx, amountDecimals),
    protocol: "DeepBook",
    expiresLabel:
      status === "expired" ? "Expired" : stableExpiryLabel(expiresAt, status),
    createdAtDisplay: clientTimeDisplay(createdAt),
    remainingVaultBalance,
    isWithdrawable: status !== "active" && remainingVaultBalance > 0,
    isWithdrawn: remainingVaultBalance <= 0,
  };
}

function gasFeeSuiFromTransaction(tx?: SuiTransactionBlockResponse) {
  const gasUsed = tx?.effects?.gasUsed;
  if (!gasUsed) {
    return undefined;
  }

  const computationCost = BigInt(gasUsed.computationCost);
  const storageCost = BigInt(gasUsed.storageCost);
  const storageRebate = BigInt(gasUsed.storageRebate);
  const gasMist = computationCost + storageCost - storageRebate;
  return Number(gasMist) / 1_000_000_000;
}

function formatDeepBaseUnits(amount: string | undefined) {
  if (!amount) {
    return undefined;
  }

  const value = BigInt(amount);
  if (value <= BigInt(0)) {
    return undefined;
  }

  const decimals = BigInt(1_000_000);
  const whole = value / decimals;
  const fractional = (value % decimals)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}${fractional ? `.${fractional}` : ""} DEEP`;
}

function deriveFillStatus({
  outputAmount,
  outputCoinObjectIds,
  residualSuiAmount,
  inputAmountSui,
}: {
  outputAmount?: string;
  outputCoinObjectIds?: string[];
  residualSuiAmount?: number;
  inputAmountSui?: number;
}): FillStatus {
  if (outputAmount) {
    return "filled";
  }

  if (
    typeof inputAmountSui === "number" &&
    typeof residualSuiAmount === "number" &&
    residualSuiAmount >= inputAmountSui
  ) {
    return "no_fill";
  }

  if (outputCoinObjectIds?.length) {
    return "amount_unavailable";
  }

  return "no_fill";
}

function objectOwnerAddress(owner: unknown) {
  if (typeof owner === "string") {
    return owner;
  }
  if (owner && typeof owner === "object" && "AddressOwner" in owner) {
    const address = (owner as { AddressOwner?: unknown }).AddressOwner;
    return typeof address === "string" ? address : undefined;
  }
  return undefined;
}

function isSuiCoinObjectType(objectType?: string) {
  return Boolean(
    objectType?.includes("::coin::Coin<") && objectType.includes("::sui::SUI"),
  );
}

function isSuiCoinType(coinType?: string) {
  return Boolean(coinType?.includes("::sui::SUI"));
}

function ownerPositiveBalanceChange(
  tx: SuiTransactionBlockResponse | undefined,
  ownerAddress: string | undefined,
  predicate: (coinType?: string) => boolean,
) {
  if (!ownerAddress) {
    return undefined;
  }

  const balanceChanges = (
    tx as
      | {
          balanceChanges?: Array<{
            owner?: unknown;
            coinType?: string;
            amount?: string;
          }>;
        }
      | undefined
  )?.balanceChanges;
  const total = (balanceChanges ?? [])
    .filter((change) => {
      const owner = objectOwnerAddress(change.owner);
      return (
        Boolean(owner) &&
        owner?.toLowerCase() === ownerAddress.toLowerCase() &&
        predicate(change.coinType)
      );
    })
    .reduce((sum, change) => sum + BigInt(change.amount ?? "0"), BigInt(0));

  return total > BigInt(0) ? total.toString() : undefined;
}

function swapOutputFromTransaction(
  tx: SuiTransactionBlockResponse | undefined,
  ownerAddress?: string,
  mandate?: Mandate,
) {
  const objectChanges = (
    tx as
      | {
          objectChanges?: Array<{
            type?: string;
            objectType?: string;
            objectId?: string;
            owner?: unknown;
          }>;
        }
      | undefined
  )?.objectChanges;

  const isTestUsdcRoute = mandate?.assetSymbol === "DUSDC";
  const outputObjects = (objectChanges ?? []).filter((change) => {
    const owner = objectOwnerAddress(change.owner);
    return (
      change.type === "created" &&
      Boolean(change.objectId) &&
      change.objectType?.includes("::coin::Coin<") &&
      (isTestUsdcRoute
        ? isSuiCoinObjectType(change.objectType)
        : !isSuiCoinObjectType(change.objectType)) &&
      (!ownerAddress ||
        (owner && owner.toLowerCase() === ownerAddress.toLowerCase()))
    );
  });
  const inferredOwner =
    ownerAddress ?? objectOwnerAddress(outputObjects[0]?.owner);
  const outputCoinObjectIds = outputObjects.map((change) => change.objectId!);

  const positiveSuiMist = ownerPositiveBalanceChange(
    tx,
    inferredOwner,
    isSuiCoinType,
  );
  const positiveTestUsdcUnits = ownerPositiveBalanceChange(
    tx,
    inferredOwner,
    (coinType) =>
      Boolean(
        DUSDC_COIN_TYPE &&
        coinType?.toLowerCase() === DUSDC_COIN_TYPE.toLowerCase(),
      ),
  );

  const outputAmount = isTestUsdcRoute
    ? positiveSuiMist
      ? `${baseUnitsToDisplay(positiveSuiMist, 9)} SUI`
      : undefined
    : formatDeepBaseUnits(
        ownerPositiveBalanceChange(tx, inferredOwner, (coinType) =>
          Boolean(coinType && !isSuiCoinType(coinType)),
        ),
      );
  const residualSuiAmount =
    !isTestUsdcRoute && positiveSuiMist
      ? mistToSui(positiveSuiMist)
      : undefined;
  const residualAmount =
    isTestUsdcRoute && positiveTestUsdcUnits
      ? baseUnitsToDisplay(positiveTestUsdcUnits, 6)
      : undefined;

  return {
    outputCoinObjectIds,
    outputOwner: outputCoinObjectIds.length > 0 ? inferredOwner : undefined,
    outputAsset:
      outputCoinObjectIds.length > 0
        ? isTestUsdcRoute
          ? "SUI"
          : "DEEP"
        : undefined,
    outputCoinType: outputObjects[0]?.objectType,
    outputAmount,
    residualSuiAmount,
    residualAmount,
    residualAsset: isTestUsdcRoute ? "DUSDC" : undefined,
  };
}

function mapEventToActivity(
  event: SuiEvent,
  tx?: SuiTransactionBlockResponse,
  mandate?: Mandate,
): ActivityEvent | null {
  const parsed = parsedJsonRecord(event);
  const mandateId = eventMandateId(event);
  if (!mandateId) {
    return null;
  }

  const digest = eventDigest(event);
  const activityTimestampMs =
    eventTimestampMs(event) ??
    timestampMs(tx?.timestampMs) ??
    payloadTimestampMs(event);
  const timestamp = activityTimestampMs
    ? new Date(activityTimestampMs).toISOString()
    : "";
  const assetDecimals = mandate?.assetDecimals ?? 9;
  const assetSymbol = mandate?.assetSymbol ?? "SUI";
  const amountValue = baseUnitsToDisplay(
    parsed.amount ?? parsed.attempted_amount ?? parsed.budget_ceiling ?? 0,
    assetDecimals,
  );
  const gasFeeSui = gasFeeSuiFromTransaction(tx);
  const swapOutput = swapOutputFromTransaction(
    tx,
    mandate?.ownerAddress,
    mandate,
  );
  const fillStatus = deriveFillStatus({
    outputAmount: swapOutput.outputAmount,
    outputCoinObjectIds: swapOutput.outputCoinObjectIds,
    residualSuiAmount: swapOutput.residualSuiAmount,
    inputAmountSui: amountValue,
  });
  const base = {
    id: `${digest}:${event.type}:${mandateId}`,
    mandateId,
    agentName: "Agent Wallet",
    protocol: "DeepBook" as const,
    timestamp,
    timestampMs: activityTimestampMs,
    digest,
    timeDisplay: displayTimeFromMs(activityTimestampMs),
    ...(typeof gasFeeSui === "number" ? { gasFeeSui } : {}),
    ...(swapOutput.outputCoinObjectIds.length > 0
      ? {
          outputCoinObjectIds: swapOutput.outputCoinObjectIds,
          outputAsset: swapOutput.outputAsset,
          outputOwner: swapOutput.outputOwner,
          outputAmount: swapOutput.outputAmount,
          residualSuiAmount: swapOutput.residualSuiAmount,
          residualAmount: swapOutput.residualAmount,
          residualAsset: swapOutput.residualAsset,
          outputCoinType: swapOutput.outputCoinType,
          fillStatus,
        }
      : {}),
  };

  if (event.type.endsWith("CreatedEvent")) {
    return {
      ...base,
      kind: "mandate.created",
      amount: amountValue,
      amountSui: amountValue,
      amountAsset: formatAssetAmount(amountValue, assetSymbol),
      assetSymbol,
      message: `Mandate created with ${formatAssetAmount(amountValue, assetSymbol)} ceiling`,
      title: "Mandate created",
      status: "created",
    };
  }

  if (event.type.endsWith("ActivityEvent")) {
    return {
      ...base,
      kind: "tx.executed",
      amount: amountValue,
      amountSui: amountValue,
      amountAsset: formatAssetAmount(amountValue, assetSymbol),
      assetSymbol,
      message: "Agent executed DeepBook PTB under mandate",
      title: "Agent executed DeepBook PTB",
      status: "success",
    };
  }

  if (event.type.endsWith("RevokeEvent")) {
    return {
      ...base,
      kind: "mandate.revoked",
      message: "Owner revoked mandate",
      title: "Owner revoked mandate",
      status: "revoked",
    };
  }

  if (event.type.endsWith("WithdrawEvent")) {
    return {
      ...base,
      kind: "mandate.withdrawn",
      amount: amountValue,
      amountSui: amountValue,
      amountAsset: formatAssetAmount(amountValue, assetSymbol),
      assetSymbol,
      message: "Remaining funds withdrawn",
      title: "Remaining funds withdrawn",
      status: "withdrawn",
    };
  }

  if (event.type.endsWith("RejectEvent")) {
    return {
      ...base,
      kind: "tx.blocked",
      amount: amountValue,
      amountSui: amountValue,
      amountAsset: formatAssetAmount(amountValue, assetSymbol),
      assetSymbol,
      message: "Policy rejected agent action",
      title: "Policy rejected action",
      status: "blocked",
    };
  }

  if (event.type.endsWith("BlockedEvent")) {
    const reason = eventReason(parsed.reason) ?? "blocked_by_policy";
    return {
      ...base,
      kind: "tx.blocked",
      amount: amountValue,
      amountSui: amountValue,
      amountAsset: formatAssetAmount(amountValue, assetSymbol),
      assetSymbol,
      message: "Policy block recorded on-chain before DeepBook submission.",
      title: "Agent action blocked by Mandate policy",
      status: reason,
    };
  }

  return null;
}

function uniqActivity(events: ActivityEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = `${event.digest ?? event.id}:${event.kind}:${event.mandateId}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

function uniqExecutions(executions: DeepBookOrder[]) {
  const seen = new Set<string>();
  return executions.filter((execution) => {
    const key = execution.digest || execution.id;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function activityToExecution(
  event: ActivityEvent,
  mandate?: Mandate,
): DeepBookOrder | null {
  if (
    event.kind !== "tx.executed" ||
    event.protocol !== "DeepBook" ||
    !event.digest
  ) {
    return null;
  }

  const timestamp = new Date(event.timestamp).getTime();
  const amountSui = event.amountSui ?? event.amount;
  const fillStatus =
    event.fillStatus ??
    deriveFillStatus({
      outputAmount: event.outputAmount,
      outputCoinObjectIds: event.outputCoinObjectIds,
      residualSuiAmount: event.residualSuiAmount,
      inputAmountSui: amountSui,
    });
  return {
    id: `${event.digest}:${event.mandateId}`,
    mandateId: event.mandateId,
    mandateLabel: mandate?.label ?? event.agentName ?? "Mandate",
    digest: event.digest,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    protocol: "DeepBook",
    pair: DEEPBOOK_POOL_KEY,
    side: "Buy",
    amountSui,
    inputAmount: amountSui,
    inputAsset: event.assetSymbol ?? mandate?.assetSymbol ?? "SUI",
    status: "executed",
    gasFeeSui: event.gasFeeSui,
    outputCoinObjectIds: event.outputCoinObjectIds,
    outputOwner: event.outputCoinObjectIds?.length
      ? (event.outputOwner ?? mandate?.ownerAddress)
      : undefined,
    outputAsset: event.outputAsset,
    outputAmount: event.outputAmount,
    residualSuiAmount: event.residualSuiAmount,
    residualAmount: event.residualAmount,
    residualAsset: event.residualAsset,
    outputCoinType: event.outputCoinType,
    fillStatus,
  };
}

function readStorageArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (error) {
    console.warn(`[MANDATE] failed to read ${key}`, error);
    return [];
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[MANDATE] failed to write ${key}`, error);
  }
}

function readStorageRecord<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, T>)
      : {};
  } catch (error) {
    console.warn(`[MANDATE] failed to read ${key}`, error);
    return {};
  }
}

function writeStorageRecord<T>(key: string, value: Record<string, T>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[MANDATE] failed to write ${key}`, error);
  }
}

function mergeMandateMetadata(
  mandate: Mandate,
  metadata?: UserMandateMetadata,
): Mandate {
  if (!metadata) {
    return mandate;
  }

  return {
    ...mandate,
    label: metadata.label || mandate.label,
    digest: mandate.digest || metadata.createdDigest,
    expiresLabel: ttlLabel(metadata.ttl) ?? mandate.expiresLabel,
  };
}

declare global {
  interface Window {
    __MANDATE_CLEAR_USER_DEMO_DATA__?: () => void;
  }
}

export function MandateStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const account = useCurrentAccount();
  const [rpcMandates, setRpcMandates] = React.useState<Mandate[]>([]);
  const [rpcActivity, setRpcActivity] = React.useState<ActivityEvent[]>([]);
  const [userMandates, setUserMandates] = React.useState<Mandate[]>([]);
  const [userActivity, setUserActivity] = React.useState<ActivityEvent[]>([]);
  const [executionHistory, setExecutionHistory] = React.useState<
    DeepBookOrder[]
  >([]);
  const [userMetadata, setUserMetadata] = React.useState<
    Record<string, UserMandateMetadata>
  >({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = React.useState(0);

  React.useEffect(() => {
    // Demo persistence only. P2.3 should replace this with Sui RPC/event
    // indexing for on-chain Mandate discovery.
    const storedMandates = uniqById(
      readStorageArray<Mandate>(USER_MANDATES_KEY),
    );
    const storedActivity = uniqById(
      readStorageArray<ActivityEvent>(USER_ACTIVITY_KEY),
    );
    const storedExecutions = uniqById(
      readStorageArray<DeepBookOrder>(USER_EXECUTIONS_KEY),
    );
    const storedMetadata =
      readStorageRecord<UserMandateMetadata>(USER_METADATA_KEY);
    const backfilledMetadata = storedMandates.reduce(
      (acc, mandate) => {
        acc[mandate.id] = acc[mandate.id] ?? {
          mandateId: mandate.id,
          label: mandate.label,
          createdDigest: mandate.digest,
          createdAt: mandate.createdAt,
          ttl: undefined,
        };
        return acc;
      },
      { ...storedMetadata } as Record<string, UserMandateMetadata>,
    );

    setUserMandates(storedMandates);
    setUserActivity(storedActivity);
    setExecutionHistory(
      storedExecutions.sort((a, b) => b.timestamp - a.timestamp),
    );
    setUserMetadata(backfilledMetadata);
    writeStorageRecord(USER_METADATA_KEY, backfilledMetadata);
  }, []);

  React.useEffect(() => {
    const missingObjectType = userMandates.filter(
      (mandate) => mandate.id && !mandate.objectType,
    );
    if (missingObjectType.length === 0) {
      return;
    }

    let cancelled = false;

    async function backfillObjectTypes() {
      const entries = await Promise.all(
        missingObjectType.map(async (mandate) => {
          try {
            const object = await getMandateObject(mandate.id);
            return [mandate.id, moveObjectType(object)] as const;
          } catch {
            return [mandate.id, undefined] as const;
          }
        }),
      );
      const objectTypes = new Map(
        entries.filter((entry): entry is readonly [string, string] =>
          Boolean(entry[1]),
        ),
      );

      if (cancelled || objectTypes.size === 0) {
        return;
      }

      setUserMandates((prev) => {
        const next = prev.map((mandate) =>
          mandate.objectType || !objectTypes.has(mandate.id)
            ? mandate
            : { ...mandate, objectType: objectTypes.get(mandate.id) },
        );
        writeStorageArray(USER_MANDATES_KEY, next);
        return next;
      });
    }

    void backfillObjectTypes();

    return () => {
      cancelled = true;
    };
  }, [userMandates]);

  React.useEffect(() => {
    const missingGasFee = executionHistory.filter(
      (execution) =>
        execution.digest && typeof execution.gasFeeSui !== "number",
    );
    if (missingGasFee.length === 0) {
      return;
    }

    let cancelled = false;

    async function backfillGasFees() {
      const entries = await Promise.all(
        missingGasFee.map(async (execution) => {
          try {
            const tx = await getTransactionDetails(execution.digest);
            return [execution.digest, gasFeeSuiFromTransaction(tx)] as const;
          } catch {
            return [execution.digest, undefined] as const;
          }
        }),
      );
      const gasFees = new Map(
        entries.filter(
          (entry): entry is readonly [string, number] =>
            typeof entry[1] === "number",
        ),
      );

      if (cancelled || gasFees.size === 0) {
        return;
      }

      setExecutionHistory((prev) => {
        const next = prev.map((execution) =>
          typeof execution.gasFeeSui === "number" ||
          !gasFees.has(execution.digest)
            ? execution
            : { ...execution, gasFeeSui: gasFees.get(execution.digest) },
        );
        writeStorageArray(USER_EXECUTIONS_KEY, next);
        return next;
      });
    }

    void backfillGasFees();

    return () => {
      cancelled = true;
    };
  }, [executionHistory]);

  const refreshMandates = React.useCallback(() => {
    setRefreshVersion((version) => version + 1);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadRpcMandates() {
      if (!account?.address) {
        setRpcMandates([]);
        setRpcActivity([]);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const createdEvents = await queryMandateCreatedEvents(account.address);
        const objectResults = await Promise.all(
          createdEvents.map(async (event) => {
            const mandateId = eventMandateId(event);
            if (!mandateId) {
              return null;
            }

            try {
              return await getMandateObject(mandateId);
            } catch {
              return null;
            }
          }),
        );
        const createdMandates = createdEvents
          .map((event, index) =>
            mapCreatedEventToMandate(event, objectResults[index] ?? undefined),
          )
          .filter((mandate): mandate is Mandate => Boolean(mandate))
          .filter(
            (mandate) =>
              mandate.ownerAddress?.toLowerCase() ===
                account.address.toLowerCase() &&
              isCurrentMandateObjectType(mandate.objectType),
          );
        const mandateIds = createdMandates.map((mandate) => mandate.id);
        const [
          activityEvents,
          revokeEvents,
          rejectEvents,
          blockedEvents,
          withdrawEvents,
        ] = await Promise.all([
            Promise.all(
              mandateIds.map((id) => queryMandateActivityEvents(id)),
            ).then((pages) => pages.flat()),
            Promise.all(
              mandateIds.map((id) => queryMandateRevokeEvents(id)),
            ).then((pages) => pages.flat()),
            Promise.all(
              mandateIds.map((id) => queryMandateRejectEvents(id)),
            ).then((pages) => pages.flat()),
            Promise.all(
              mandateIds.map((id) => queryMandateBlockedEvents(id)),
            ).then((pages) => pages.flat()),
            Promise.all(
              mandateIds.map((id) => queryMandateWithdrawEvents(id)),
            ).then((pages) => pages.flat()),
          ]);
        const mandateByIdForEvents = new Map(
          createdMandates.map((mandate) => [mandate.id, mandate]),
        );
        const allRpcEvents = [
          ...createdEvents,
          ...activityEvents,
          ...revokeEvents,
          ...rejectEvents,
          ...blockedEvents,
          ...withdrawEvents,
        ];
        const txDigests = Array.from(
          new Set(allRpcEvents.map(eventDigest).filter(Boolean)),
        );
        const txEntries = await Promise.all(
          txDigests.map(async (digest) => {
            try {
              return [digest, await getTransactionDetails(digest)] as const;
            } catch {
              return [digest, undefined] as const;
            }
          }),
        );
        const txByDigest = new Map(txEntries);
        const rpcActivities = uniqActivity(
          allRpcEvents
            .map((event) =>
              mapEventToActivity(
                event,
                txByDigest.get(eventDigest(event)),
                mandateByIdForEvents.get(eventMandateId(event) ?? ""),
              ),
            )
            .filter((event): event is ActivityEvent => Boolean(event)),
        );

        if (!cancelled) {
          setRpcMandates(uniqById(createdMandates));
          setRpcActivity(rpcActivities);
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
          setRpcMandates([]);
          setRpcActivity([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadRpcMandates();

    return () => {
      cancelled = true;
    };
  }, [account?.address, refreshVersion]);

  const createMandate = React.useCallback((input: NewMandateInput): Mandate => {
    const agent = AGENTS.find((a) => a.id === input.agentId) ?? AGENTS[0];
    const now = new Date();
    const expires = new Date();
    if (input.ttlMs) {
      expires.setTime(now.getTime() + Number(input.ttlMs));
    } else {
      expires.setDate(expires.getDate() + input.durationDays);
    }

    const mandate: Mandate = {
      id: input.id ?? randomId("mnd"),
      label: input.label,
      agent,
      ownerAddress: input.ownerAddress,
      agentAddress: input.agentAddress,
      objectType: input.objectType ?? currentMandateObjectType(),
      digest: input.digest,
      status: "active",
      spendAsset: input.spendAsset ?? "SUI",
      assetSymbol: input.assetSymbol ?? "SUI",
      assetDecimals: input.assetDecimals ?? 9,
      budget: input.budget,
      spent: 0,
      protocols: input.protocols,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      txLimit: input.txLimit,
      approvalThreshold: input.approvalThreshold,
      network: input.network,
      budgetCeilingSui: input.budget,
      spentSui: 0,
      maxSingleTxSui: input.txLimit,
      protocol: input.protocols[0],
      expiresLabel: input.expiresLabel,
      createdAtDisplay: "just now",
      remainingVaultBalance: input.budget,
      isWithdrawable: false,
      isWithdrawn: false,
    };
    const metadata: UserMandateMetadata = {
      mandateId: mandate.id,
      label: mandate.label,
      createdDigest: input.digest,
      createdAt: mandate.createdAt,
      ttl: input.ttlMs,
    };

    const createdActivity: ActivityEvent = {
      id: randomId("evt"),
      kind: "mandate.created",
      mandateId: mandate.id,
      agentName: mandate.label,
      protocol: input.protocols[0],
      amount: input.budget,
      message: `Mandate created with ${formatSui(input.budget)} ceiling`,
      timestamp: "",
      digest: input.digest,
      title: "Mandate created",
      status: "created",
      amountSui: input.budget,
      amountAsset: formatAssetAmount(input.budget, input.assetSymbol ?? "SUI"),
      assetSymbol: input.assetSymbol ?? "SUI",
      timeDisplay: "syncing",
    };

    setUserMandates((prev) => {
      const next = uniqById([mandate, ...prev]);
      writeStorageArray(USER_MANDATES_KEY, next);
      return next;
    });
    setUserActivity((prev) => {
      const next = uniqById([createdActivity, ...prev]);
      writeStorageArray(USER_ACTIVITY_KEY, next);
      return next;
    });
    setUserMetadata((prev) => {
      const next = { ...prev, [mandate.id]: metadata };
      writeStorageRecord(USER_METADATA_KEY, next);
      return next;
    });
    return mandate;
  }, []);

  const revokeMandate = React.useCallback(
    (id: string, digest?: string) => {
      setUserMandates((prev) => {
        const next = prev.map((m) =>
          m.id === id
            ? {
                ...m,
                status: "revoked" as const,
                remainingVaultBalance: 0,
                isWithdrawable: false,
                isWithdrawn: true,
              }
            : m,
        );
        writeStorageArray(USER_MANDATES_KEY, next);
        return next;
      });
      setRpcMandates((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                status: "revoked",
                remainingVaultBalance: 0,
                isWithdrawable: false,
                isWithdrawn: true,
              }
            : m,
        ),
      );
      const target = [...rpcMandates, ...userMandates].find((m) => m.id === id);
      const withdrawnAmount =
        target?.remainingVaultBalance ??
        (target ? Math.max(target.budget - target.spent, 0) : 0);
      const revokedActivity: ActivityEvent = {
        id: digest ? `${digest}:optimistic-revoke:${id}` : randomId("evt"),
        kind: "mandate.revoked",
        mandateId: id,
        agentName: target?.label ?? "Agent Wallet",
        protocol: target?.protocol ?? target?.protocols[0],
        message: "Owner revoked mandate",
        timestamp: "",
        digest,
        title: "Owner revoked mandate",
        status: "revoked",
        timeDisplay: "syncing",
      };
      const withdrawnActivity: ActivityEvent | null =
        withdrawnAmount > 0
          ? {
              id: digest
                ? `${digest}:optimistic-withdraw:${id}`
                : randomId("evt"),
              kind: "mandate.withdrawn",
              mandateId: id,
              agentName: target?.label ?? "Agent Wallet",
              protocol: target?.protocol ?? target?.protocols[0],
              amount: withdrawnAmount,
              message: "Remaining funds withdrawn",
              timestamp: "",
              digest,
              title: "Remaining funds withdrawn",
              status: "withdrawn",
              amountSui: withdrawnAmount,
              amountAsset: formatAssetAmount(
                withdrawnAmount,
                target?.assetSymbol ?? "SUI",
              ),
              assetSymbol: target?.assetSymbol ?? "SUI",
              timeDisplay: "syncing",
            }
          : null;
      const optimisticActivities = withdrawnActivity
        ? [withdrawnActivity, revokedActivity]
        : [revokedActivity];
      setRpcActivity((prev) => uniqActivity([...optimisticActivities, ...prev]));
      setUserActivity((prev) => {
        const next = uniqById([...optimisticActivities, ...prev]);
        writeStorageArray(USER_ACTIVITY_KEY, next);
        return next;
      });
    },
    [rpcMandates, userMandates],
  );

  const withdrawMandate = React.useCallback(
    (id: string, digest?: string) => {
      const updateWithdrawn = (m: Mandate): Mandate =>
        m.id === id
          ? {
              ...m,
              status: m.status === "active" ? "expired" : m.status,
              remainingVaultBalance: 0,
              isWithdrawable: false,
              isWithdrawn: true,
            }
          : m;

      const target = [...rpcMandates, ...userMandates].find((m) => m.id === id);
      const withdrawnAmount =
        target?.remainingVaultBalance ??
        (target ? Math.max(target.budget - target.spent, 0) : 0);

      setUserMandates((prev) => {
        const next = prev.map(updateWithdrawn);
        writeStorageArray(USER_MANDATES_KEY, next);
        return next;
      });
      setRpcMandates((prev) => prev.map(updateWithdrawn));

      const withdrawnActivity: ActivityEvent = {
        id: digest ? `${digest}:optimistic-withdraw:${id}` : randomId("evt"),
        kind: "mandate.withdrawn",
        mandateId: id,
        agentName: target?.label ?? "Agent Wallet",
        protocol: target?.protocol ?? target?.protocols[0],
        amount: withdrawnAmount,
        message: "Remaining funds withdrawn",
        timestamp: "",
        digest,
        title: "Remaining funds withdrawn",
        status: "withdrawn",
        amountSui: withdrawnAmount,
        amountAsset: formatAssetAmount(
          withdrawnAmount,
          target?.assetSymbol ?? "SUI",
        ),
        assetSymbol: target?.assetSymbol ?? "SUI",
        timeDisplay: "syncing",
      };

      setRpcActivity((prev) => uniqActivity([withdrawnActivity, ...prev]));
      setUserActivity((prev) => {
        const next = uniqById([withdrawnActivity, ...prev]);
        writeStorageArray(USER_ACTIVITY_KEY, next);
        return next;
      });
    },
    [rpcMandates, userMandates],
  );

  const recordAgentExecution = React.useCallback(
    ({
      mandateId,
      digest,
      amountSui = 0.001,
      suiBalanceChange,
      gasFeeSui,
      outputCoinObjectIds,
      outputOwner,
      outputAsset,
      outputAmount,
      outputCoinType,
      residualSuiAmount,
      residualAmount,
      residualAsset,
      inputAsset,
      inputAmount,
      fillStatus,
      pair = DEEPBOOK_POOL_KEY,
      side = "Buy",
    }: {
      mandateId: string;
      digest?: string;
      amountSui?: number;
      suiBalanceChange?: number;
      gasFeeSui?: number;
      outputCoinObjectIds?: string[];
      outputOwner?: string;
      outputAsset?: string;
      outputAmount?: string;
      outputCoinType?: string;
      residualSuiAmount?: number;
      residualAmount?: number;
      residualAsset?: string;
      inputAsset?: string;
      inputAmount?: number;
      fillStatus?: FillStatus;
      pair?: string;
      side?: "Buy" | "Sell";
    }) => {
      const incrementSpent = (mandate: Mandate) =>
        mandate.id === mandateId
          ? {
              ...mandate,
              spent: Math.min(mandate.spent + amountSui, mandate.budget),
              spentSui: Math.min(
                (mandate.spentSui ?? mandate.spent) + amountSui,
                mandate.budgetCeilingSui ?? mandate.budget,
              ),
            }
          : mandate;

      setUserMandates((prev) => {
        const next = prev.map(incrementSpent);
        writeStorageArray(USER_MANDATES_KEY, next);
        return next;
      });
      setRpcMandates((prev) => prev.map(incrementSpent));

      const target = [...rpcMandates, ...userMandates].find(
        (mandate) => mandate.id === mandateId,
      );
      const assetSymbol = inputAsset ?? target?.assetSymbol ?? "SUI";
      const displayInputAmount = inputAmount ?? amountSui;
      const executionActivity: ActivityEvent = {
        id: digest
          ? `${digest}:optimistic-agent:${mandateId}`
          : randomId("evt"),
        kind: "tx.executed",
        mandateId,
        agentName: target?.label ?? "Agent Wallet",
        protocol: target?.protocol ?? target?.protocols[0] ?? "DeepBook",
        amount: displayInputAmount,
        amountSui: displayInputAmount,
        amountAsset: formatAssetAmount(displayInputAmount, assetSymbol),
        assetSymbol,
        message: "Agent executed DeepBook PTB under mandate",
        timestamp: "",
        digest,
        title: "Agent executed DeepBook PTB",
        status: "success",
        timeDisplay: "syncing",
        outputCoinObjectIds,
        outputOwner,
        outputAsset,
        outputAmount,
        outputCoinType,
        residualSuiAmount,
        fillStatus,
      };

      setRpcActivity((prev) => uniqActivity([executionActivity, ...prev]));
      setUserActivity((prev) => {
        const next = uniqById([executionActivity, ...prev]);
        writeStorageArray(USER_ACTIVITY_KEY, next);
        return next;
      });

      const executionRecord: DeepBookOrder = {
        id: digest ? `${digest}:${mandateId}` : randomId("exec"),
        mandateId,
        mandateLabel: target?.label ?? "Mandate",
        digest: digest ?? "",
        timestamp: Date.now(),
        protocol: "DeepBook",
        pair,
        side,
        amountSui,
        inputAmount: displayInputAmount,
        inputAsset: assetSymbol,
        status: "executed",
        ...(typeof suiBalanceChange === "number" ? { suiBalanceChange } : {}),
        ...(typeof gasFeeSui === "number" ? { gasFeeSui } : {}),
        ...(outputCoinObjectIds?.length ? { outputCoinObjectIds } : {}),
        ...(outputOwner ? { outputOwner } : {}),
        ...(outputAsset ? { outputAsset } : {}),
        ...(outputAmount ? { outputAmount } : {}),
        ...(outputCoinType ? { outputCoinType } : {}),
        ...(typeof residualSuiAmount === "number" ? { residualSuiAmount } : {}),
        ...(typeof residualAmount === "number" ? { residualAmount } : {}),
        ...(residualAsset ? { residualAsset } : {}),
        fillStatus:
          fillStatus ??
          deriveFillStatus({
            outputAmount,
            outputCoinObjectIds,
            residualSuiAmount,
            inputAmountSui: amountSui,
          }),
      };

      setExecutionHistory((prev) => {
        const next = uniqById([executionRecord, ...prev]).sort(
          (a, b) => b.timestamp - a.timestamp,
        );
        writeStorageArray(USER_EXECUTIONS_KEY, next);
        return next;
      });
    },
    [rpcMandates, userMandates],
  );

  const recordBlockedAction = React.useCallback(
    ({
      mandateId,
      digest,
      amountSui,
      reason,
    }: {
      mandateId: string;
      digest?: string;
      amountSui?: number;
      reason: string;
    }) => {
      const target = [...rpcMandates, ...userMandates].find(
        (mandate) => mandate.id === mandateId,
      );
      const assetSymbol = target?.assetSymbol ?? "SUI";
      const blockedActivity: ActivityEvent = {
        id: digest
          ? `${digest}:optimistic-blocked:${mandateId}`
          : randomId("blocked"),
        kind: "tx.blocked",
        mandateId,
        agentName: target?.label ?? "Agent Wallet",
        protocol: target?.protocol ?? target?.protocols[0] ?? "DeepBook",
        amount: amountSui,
        amountSui,
        amountAsset:
          typeof amountSui === "number"
            ? formatAssetAmount(amountSui, assetSymbol)
            : undefined,
        assetSymbol,
        message: "Policy block recorded on-chain before DeepBook submission.",
        timestamp: "",
        digest,
        title: "Agent action blocked by Mandate policy",
        status: reason,
        timeDisplay: "syncing",
      };

      setRpcActivity((prev) => uniqActivity([blockedActivity, ...prev]));
      setUserActivity((prev) => {
        const next = uniqById([blockedActivity, ...prev]);
        writeStorageArray(USER_ACTIVITY_KEY, next);
        return next;
      });
    },
    [rpcMandates, userMandates],
  );

  const clearUserDemoData = React.useCallback(() => {
    window.localStorage.removeItem(USER_MANDATES_KEY);
    window.localStorage.removeItem(USER_ACTIVITY_KEY);
    window.localStorage.removeItem(USER_METADATA_KEY);
    window.localStorage.removeItem(USER_EXECUTIONS_KEY);
    setUserMandates([]);
    setUserActivity([]);
    setUserMetadata({});
    setExecutionHistory([]);
  }, []);

  React.useEffect(() => {
    window.__MANDATE_CLEAR_USER_DEMO_DATA__ = clearUserDemoData;
    return () => {
      delete window.__MANDATE_CLEAR_USER_DEMO_DATA__;
    };
  }, [clearUserDemoData]);

  const walletUserMandates = React.useMemo(() => {
    if (!account?.address) {
      return [];
    }

    return userMandates.filter(
      (mandate) =>
        mandate.ownerAddress?.toLowerCase() === account.address.toLowerCase() &&
        isCurrentMandateObjectType(mandate.objectType),
    );
  }, [account?.address, userMandates]);

  const walletUserActivity = React.useMemo(() => {
    const mandateIds = new Set(walletUserMandates.map((mandate) => mandate.id));
    return userActivity.filter((event) => mandateIds.has(event.mandateId));
  }, [userActivity, walletUserMandates]);

  const mandates = React.useMemo(() => {
    const primary = account?.address
      ? [...rpcMandates, ...walletUserMandates]
      : [];
    return uniqById(primary).map((mandate) =>
      normalizeMandateStatus(
        mergeMandateMetadata(mandate, userMetadata[mandate.id]),
      ),
    );
  }, [account?.address, rpcMandates, userMetadata, walletUserMandates]);

  const activity = React.useMemo(() => {
    const primary = account?.address
      ? [...rpcActivity, ...walletUserActivity]
      : [];
    const mandateById = new Map(
      mandates.map((mandate) => [mandate.id, mandate]),
    );
    return uniqActivity(primary).map((event) => {
      if (!account?.address) {
        return event;
      }

      const mandate = mandateById.get(event.mandateId);
      return {
        ...event,
        timeDisplay:
          event.timeDisplay === "just now" &&
          typeof event.timestampMs !== "number"
            ? undefined
            : event.timeDisplay,
        agentName:
          mandate?.label ??
          (mandate?.agentAddress ? "Agent Wallet" : event.agentName),
      };
    });
  }, [account?.address, mandates, rpcActivity, walletUserActivity]);

  const orders = React.useMemo(() => {
    if (!account?.address) {
      return [];
    }

    const mandateById = new Map(
      mandates.map((mandate) => [mandate.id, mandate]),
    );
    const activityExecutions = activity
      .map((event) =>
        activityToExecution(event, mandateById.get(event.mandateId)),
      )
      .filter((execution): execution is DeepBookOrder => Boolean(execution));
    const localExecutions: DeepBookOrder[] = executionHistory
      .filter((execution) => mandateById.has(execution.mandateId))
      .map((execution) => {
        const status: ExecutionStatus =
          execution.status === "failed" ? "failed" : "executed";

        return {
          ...execution,
          pair: execution.pair ?? DEEPBOOK_POOL_KEY,
          side: execution.side ?? "Buy",
          amountSui: execution.amountSui ?? 0.001,
          status,
          fillStatus:
            execution.fillStatus ??
            deriveFillStatus({
              outputAmount: execution.outputAmount,
              outputCoinObjectIds: execution.outputCoinObjectIds,
              residualSuiAmount: execution.residualSuiAmount,
              inputAmountSui: execution.amountSui ?? 0.001,
            }),
          mandateLabel:
            mandateById.get(execution.mandateId)?.label ??
            execution.mandateLabel,
        };
      });

    return uniqExecutions([...activityExecutions, ...localExecutions]).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  }, [account?.address, activity, executionHistory, mandates]);

  const value = React.useMemo(
    () => ({
      mandates,
      activity,
      orders,
      loading,
      error,
      isWalletScoped: Boolean(account?.address),
      createMandate,
      revokeMandate,
      withdrawMandate,
      recordAgentExecution,
      recordBlockedAction,
      refreshMandates,
      clearUserDemoData,
    }),
    [
      mandates,
      activity,
      orders,
      loading,
      error,
      account?.address,
      createMandate,
      revokeMandate,
      withdrawMandate,
      recordAgentExecution,
      recordBlockedAction,
      refreshMandates,
      clearUserDemoData,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useMandateStore() {
  const ctx = React.useContext(StoreContext);
  if (!ctx) {
    throw new Error("useMandateStore must be used within MandateStoreProvider");
  }
  return ctx;
}

export { ALL_PROTOCOLS, AGENTS };
