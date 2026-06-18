"use client";

import * as React from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type {
  SuiEvent,
  SuiTransactionBlockResponse,
} from "@mysten/sui/jsonRpc";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { CopyableId, shortId } from "@/components/copyable-id";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AGENTS, useMandateStore } from "@/lib/mandate-store";
import {
  CLOCK_OBJECT_ID,
  currentAssetMandateObjectType,
  DUSDC_COIN_TYPE,
  IS_PUBLIC_PACKAGE_ID_CONFIGURED,
  IS_BACKEND_AGENT_ADDRESS_CONFIGURED,
  IS_LEGACY_POLICY_PACKAGE_ID,
  LEGACY_POLICY_PACKAGE_IDS,
  NETWORK,
  NETWORK_LABEL,
  PACKAGE_ID,
  PACKAGE_ID_SOURCE,
  PUBLIC_PACKAGE_ID,
  PUBLIC_BACKEND_AGENT_ADDRESS,
  BACKEND_AGENT_ADDRESS,
  BACKEND_AGENT_ADDRESS_SOURCE,
  getActiveDeepBookRouteConfig,
} from "@/lib/chain-config";
import { Loader2 } from "lucide-react";

const PROTOCOL_SCOPE_DEEPBOOK = 1;
const SIGNING_TIMEOUT_MS = 60_000;
const DUSDC_DECIMALS = 6;
const TEST_USDC_VAULT_UNAVAILABLE_REASON =
  "No fillable DeepBook pool on the current network.";
const EXPIRATION_OPTIONS = [
  { label: "1h", value: "3600000", durationDays: 1 },
  { label: "12h", value: "43200000", durationDays: 1 },
  { label: "24h", value: "86400000", durationDays: 1 },
  { label: "7d", value: "604800000", durationDays: 7 },
] as const;

type CreateStatus = "idle" | "signing" | "success" | "error";
type SpendAsset = "SUI" | "DUSDC";
const DEFAULT_BUDGET = "3";
const DEFAULT_MAX_TX = (() => {
  const executionAmount = getActiveDeepBookRouteConfig().executionAmount;
  return executionAmount > 0
    ? String(Math.max(executionAmount + 0.1, 1.1))
    : "1.1";
})();

function defaultMandateLabel() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `Trading Mandate-${month}${day}-${hour}${minute}`;
}

function parseDecimalToUnits(value: string, decimals: number, label: string) {
  const trimmed = value.trim();
  const [wholePart, fractionalPart = ""] = trimmed.split(".");

  if (!wholePart || !/^\d+$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) {
    throw new Error(`Invalid ${label}: ${value}`);
  }

  const fractional = fractionalPart.padEnd(decimals, "0").slice(0, decimals);
  const scalar = BigInt(`1${"0".repeat(decimals)}`);
  return BigInt(wholePart) * scalar + BigInt(fractional || "0");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isLikelySuiAddress(value: string) {
  return /^0x[a-fA-F0-9]{1,64}$/.test(value.trim());
}

function isCancellationLikeError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("cancel") ||
    message.includes("reject") ||
    message.includes("interrupt") ||
    message.includes("timeout") ||
    message.includes("closed") ||
    message.includes("user denied")
  );
}

function withSigningTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Wallet signing timeout or interruption"));
    }, SIGNING_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function parsedJsonRecord(event: SuiEvent) {
  return event.parsedJson && typeof event.parsedJson === "object"
    ? (event.parsedJson as Record<string, unknown>)
    : null;
}

function findCreatedMandateId(result: SuiTransactionBlockResponse) {
  const mandateType = `${PACKAGE_ID}::mandate::Mandate`;
  const assetMandateType = `${PACKAGE_ID}::mandate::AssetMandate<`;
  const created = result.objectChanges?.find(
    (change) =>
      change.type === "created" &&
      "objectType" in change &&
      (change.objectType.includes(mandateType) ||
        change.objectType.includes(assetMandateType)),
  );

  if (created && "objectId" in created) {
    return created.objectId;
  }

  const createdEvent = result.events?.find(
    (event) =>
      event.type.includes(`${PACKAGE_ID}::mandate::CreatedEvent`) ||
      event.type.includes(`${PACKAGE_ID}::mandate::MandateCreatedEvent`),
  );
  const parsed = createdEvent ? parsedJsonRecord(createdEvent) : null;
  const mandateId = parsed?.mandate_id ?? parsed?.mandateId;

  return typeof mandateId === "string" ? mandateId : null;
}

export function CreateMandateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createMandate, refreshMandates } = useMandateStore();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const wasOpenRef = React.useRef(false);

  const [label, setLabel] = React.useState("");
  const [agentAddress, setAgentAddress] = React.useState(BACKEND_AGENT_ADDRESS);
  const [spendAsset, setSpendAsset] = React.useState<SpendAsset>("SUI");
  const [budgetSui, setBudgetSui] = React.useState(DEFAULT_BUDGET);
  const [txLimitSui, setTxLimitSui] = React.useState(DEFAULT_MAX_TX);
  const [ttlMs, setTtlMs] = React.useState(EXPIRATION_OPTIONS[2].value);
  const [isSigning, setSigning] = React.useState(false);
  const [status, setStatus] = React.useState<CreateStatus>("idle");
  const [digest, setDigest] = React.useState<string | null>(null);
  const [createdMandateId, setCreatedMandateId] = React.useState<string | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);
  const [network, setNetwork] = React.useState(NETWORK);

  const signAndExecute =
    useSignAndExecuteTransaction<SuiTransactionBlockResponse>({
      execute: ({ bytes, signature }) =>
        client.executeTransactionBlock({
          transactionBlock: bytes,
          signature,
          requestType: "WaitForLocalExecution",
          options: {
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
          },
        }),
    });

  React.useEffect(() => {
    if (open && !agentAddress) {
      setAgentAddress(BACKEND_AGENT_ADDRESS);
    }
  }, [agentAddress, open]);

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    console.info("[MANDATE] create config", {
      rawNextPublicPackageId: process.env.NEXT_PUBLIC_PACKAGE_ID,
      nextPublicPackageId: PUBLIC_PACKAGE_ID || "(not configured)",
      packageId: PACKAGE_ID,
      packageIdSource: PACKAGE_ID_SOURCE,
      isPublicPackageIdConfigured: IS_PUBLIC_PACKAGE_ID_CONFIGURED,
      legacyPolicyPackageIds: LEGACY_POLICY_PACKAGE_IDS,
      isLegacyPolicyPackage: IS_LEGACY_POLICY_PACKAGE_ID,
      rawNextPublicBackendAgentAddress:
        process.env.NEXT_PUBLIC_BACKEND_AGENT_ADDRESS,
      nextPublicBackendAgentAddress:
        PUBLIC_BACKEND_AGENT_ADDRESS || "(not configured)",
      backendAgentAddressSource: BACKEND_AGENT_ADDRESS_SOURCE,
      isBackendAgentAddressConfigured: IS_BACKEND_AGENT_ADDRESS_CONFIGURED,
    });
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      return;
    }

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, [open]);

  function reset() {
    setLabel(defaultMandateLabel());
    setAgentAddress(BACKEND_AGENT_ADDRESS);
    setSpendAsset("SUI");
    setBudgetSui(DEFAULT_BUDGET);
    setTxLimitSui(DEFAULT_MAX_TX);
    setTtlMs(EXPIRATION_OPTIONS[2].value);
    setSigning(false);
    setStatus("idle");
    setDigest(null);
    setCreatedMandateId(null);
    setError(null);
    setNetwork(NETWORK);
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);

    if (nextOpen) {
      reset();
    }

    if (!nextOpen) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      reset();
    }
  }

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      reset();
    }
    wasOpenRef.current = open;
  }, [open]);

  const selectedAssetLabel =
    spendAsset === "SUI" ? "SUI vault" : "DeepBook USDC vault";
  const selectedAssetDecimals = spendAsset === "SUI" ? 9 : DUSDC_DECIMALS;
  const selectedAssetUnit = spendAsset === "SUI" ? "SUI" : "test USDC";
  const budgetIssue = (() => {
    try {
      const units = parseDecimalToUnits(
        budgetSui,
        selectedAssetDecimals,
        "Budget",
      );
      return units > BigInt(0) ? null : "Budget must be greater than 0";
    } catch {
      return `Budget must be a valid ${selectedAssetLabel} amount`;
    }
  })();
  const txLimitIssue = (() => {
    try {
      const units = parseDecimalToUnits(
        txLimitSui,
        selectedAssetDecimals,
        "Max tx",
      );
      return units > BigInt(0) ? null : "Max tx must be greater than 0";
    } catch {
      return `Max tx must be a valid ${selectedAssetLabel} amount`;
    }
  })();
  const assetIssue =
    spendAsset === "DUSDC"
      ? `DeepBook USDC vault is disabled: ${TEST_USDC_VAULT_UNAVAILABLE_REASON}`
      : null;
  const agentAddressIssue = !IS_BACKEND_AGENT_ADDRESS_CONFIGURED
    ? "Backend agent address is missing from NEXT_PUBLIC_BACKEND_AGENT_ADDRESS."
    : !agentAddress.trim()
      ? "Backend agent address is missing."
      : !isLikelySuiAddress(agentAddress)
        ? "Backend agent address is invalid."
        : null;
  const disabledReasons = [
    !account?.address ? "wallet not connected" : null,
    !label.trim() ? "label missing" : null,
    !IS_PUBLIC_PACKAGE_ID_CONFIGURED ? "package id missing" : null,
    IS_LEGACY_POLICY_PACKAGE_ID ? "legacy package" : null,
    !IS_BACKEND_AGENT_ADDRESS_CONFIGURED
      ? "backend agent address missing"
      : null,
    agentAddressIssue && IS_BACKEND_AGENT_ADDRESS_CONFIGURED
      ? "backend agent address invalid"
      : null,
    budgetIssue ? "invalid budget" : null,
    txLimitIssue ? "invalid max tx" : null,
    assetIssue ? "asset config missing" : null,
    isSigning ? "submitting" : null,
  ].filter((reason): reason is string => Boolean(reason));
  const valid = disabledReasons.length === 0;
  const visibleDisabledReason = disabledReasons[0] ?? null;
  const selectedExpiration =
    EXPIRATION_OPTIONS.find((option) => option.value === ttlMs) ??
    EXPIRATION_OPTIONS[2];

  React.useEffect(() => {
    if (process.env.NODE_ENV === "production" || !open) {
      return;
    }

    console.info("[MANDATE] create disabled reasons", {
      disabled: !valid,
      reasons: disabledReasons,

      packageId: PACKAGE_ID,
      packageIdSource: PACKAGE_ID_SOURCE,
      isPublicPackageIdConfigured: IS_PUBLIC_PACKAGE_ID_CONFIGURED,
      legacyPolicyPackageIds: LEGACY_POLICY_PACKAGE_IDS,
      isLegacyPolicyPackage: IS_LEGACY_POLICY_PACKAGE_ID,

      backendAgentAddress: BACKEND_AGENT_ADDRESS,
      backendAgentAddressSource: BACKEND_AGENT_ADDRESS_SOURCE,
      isBackendAgentAddressConfigured: IS_BACKEND_AGENT_ADDRESS_CONFIGURED,

      walletConnected: Boolean(account?.address),
      budgetIssue,
      txLimitIssue,
      agentAddressIssue,
      submitting: isSigning,
    });
  }, [
    account?.address,
    agentAddressIssue,
    budgetIssue,
    disabledReasons,
    isSigning,
    open,
    txLimitIssue,
    valid,
  ]);

  async function handleSubmit() {
    if (!valid) return;

    console.log("[MANDATE] signing started");
    setSigning(true);
    setStatus("signing");
    setDigest(null);
    setCreatedMandateId(null);
    setError(null);

    try {
      if (!IS_PUBLIC_PACKAGE_ID_CONFIGURED) {
        throw new Error(
          "NEXT_PUBLIC_PACKAGE_ID_TESTNET or NEXT_PUBLIC_PACKAGE_ID_MAINNET is not loaded in the frontend bundle. Update root .env.local and restart Next.js from the repository root.",
        );
      }

      if (!IS_BACKEND_AGENT_ADDRESS_CONFIGURED) {
        throw new Error(
          "NEXT_PUBLIC_BACKEND_AGENT_ADDRESS is not loaded in the frontend bundle. Update root .env.local and restart Next.js from the repository root.",
        );
      }

      if (IS_LEGACY_POLICY_PACKAGE_ID) {
        throw new Error(
          "PACKAGE_ID still points to a legacy policy-only package. Publish the vault package, update the current network package id, and restart Next.js.",
        );
      }

      const budgetUnits = parseDecimalToUnits(
        budgetSui,
        selectedAssetDecimals,
        "Budget",
      );
      const maxSingleTxUnits = parseDecimalToUnits(
        txLimitSui,
        selectedAssetDecimals,
        "Max tx",
      );

      if (budgetUnits <= BigInt(0) || maxSingleTxUnits <= BigInt(0)) {
        throw new Error(
          "Budget and max single transaction must be greater than 0",
        );
      }

      const tx = new Transaction();
      let objectType = `${PACKAGE_ID}::mandate::Mandate`;
      if (spendAsset === "SUI") {
        const [budgetCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(budgetUnits)]);
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::create_mandate`,
          arguments: [
            tx.pure.address(agentAddress.trim()),
            budgetCoin,
            tx.pure.u64(maxSingleTxUnits),
            tx.pure.u8(PROTOCOL_SCOPE_DEEPBOOK),
            tx.pure.u64(ttlMs),
            tx.object(CLOCK_OBJECT_ID),
          ],
        });
      } else {
        if (!DUSDC_COIN_TYPE) {
          throw new Error(
            "NEXT_PUBLIC_DBUSDC_COIN_TYPE / NEXT_PUBLIC_DUSDC_COIN_TYPE is not configured.",
          );
        }
        const coins = await client.getCoins({
          owner: account!.address,
          coinType: DUSDC_COIN_TYPE,
        });
        const sourceCoin = coins.data.find(
          (coin) => BigInt(coin.balance) >= budgetUnits,
        );
        if (!sourceCoin) {
          throw new Error("No DeepBook USDC coin found in wallet.");
        }
        const [budgetCoin] = tx.splitCoins(tx.object(sourceCoin.coinObjectId), [
          tx.pure.u64(budgetUnits),
        ]);
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::create_mandate_with_coin`,
          typeArguments: [DUSDC_COIN_TYPE],
          arguments: [
            tx.pure.address(agentAddress.trim()),
            budgetCoin,
            tx.pure.u64(maxSingleTxUnits),
            tx.pure.u8(PROTOCOL_SCOPE_DEEPBOOK),
            tx.pure.u64(ttlMs),
            tx.object(CLOCK_OBJECT_ID),
          ],
        });
        objectType = currentAssetMandateObjectType(DUSDC_COIN_TYPE);
      }

      const result = await withSigningTimeout(
        signAndExecute.mutateAsync({ transaction: tx }),
      );
      console.log("[MANDATE] signed", result);
      const executionStatus = result.effects?.status;

      if (executionStatus?.status !== "success") {
        throw new Error(executionStatus?.error ?? "Transaction failed");
      }

      const mandateId = findCreatedMandateId(result);
      if (!mandateId) {
        throw new Error(
          "Transaction succeeded but Mandate object id was not found",
        );
      }

      createMandate({
        id: mandateId,
        label: label.trim(),
        agentId: AGENTS[0].id,
        ownerAddress: account?.address,
        agentAddress: agentAddress.trim(),
        budget: Number(budgetSui),
        txLimit: Number(txLimitSui),
        approvalThreshold: Number(txLimitSui),
        protocols: ["DeepBook"],
        durationDays: selectedExpiration.durationDays,
        network,
        digest: result.digest,
        ttlMs,
        expiresLabel: selectedExpiration.label,
        objectType,
        spendAsset: selectedAssetLabel,
        assetSymbol: selectedAssetLabel,
        assetDecimals: selectedAssetDecimals,
      });

      setDigest(result.digest);
      setCreatedMandateId(mandateId);
      setStatus("success");
      toast.success("Mandate created on-chain", {
        description: `${shortId(mandateId)} · ${shortId(result.digest)}`,
      });
      refreshMandates();
      window.setTimeout(refreshMandates, 1_200);
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        handleOpenChange(false);
        refreshMandates();
        window.setTimeout(refreshMandates, 1_200);
      }, 800);
    } catch (caught) {
      console.error("[MANDATE] failed", caught);
      setStatus("error");
      setError(
        isCancellationLikeError(caught)
          ? "Transaction was cancelled or interrupted. Please try again."
          : getErrorMessage(caught),
      );
    } finally {
      setSigning(false);
      setStatus((current) => (current === "signing" ? "idle" : current));
      console.log("[MANDATE] signing finished");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100vw-2rem)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col gap-0 overflow-hidden border border-cyan-400/20 bg-zinc-950/95 p-0 shadow-2xl shadow-cyan-500/10 before:pointer-events-none before:absolute before:inset-0 before:rounded-xl before:shadow-[0_0_80px_rgba(34,211,238,0.12)] before:content-[''] sm:max-w-[720px]">
        <DialogHeader className="shrink-0 border-b border-cyan-400/10 px-5 py-4 pr-12">
          <DialogTitle className="text-xl font-semibold sm:text-2xl">
            Create Mandate
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm">
            Define a capped mandate once. Let the agent execute within policy.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-1 gap-4">
              <Field>
                <FieldLabel htmlFor="mandate-label">Label</FieldLabel>
                <Input
                  id="mandate-label"
                  placeholder="Enter a mandate label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <FieldDescription>
                  Name used to identify this mandate.
                </FieldDescription>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-cyan-400/10 pt-4">
              <Field>
                <FieldLabel>Spend asset</FieldLabel>
                <Select
                  value={spendAsset}
                  onValueChange={(value) => setSpendAsset(value as SpendAsset)}
                >
                  <SelectTrigger className="w-full border-cyan-400/15 bg-white/[0.03]">
                    <span>{selectedAssetLabel}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="SUI">SUI vault</SelectItem>
                      <SelectItem value="DUSDC" disabled>
                        <span className="flex min-w-0 flex-col items-start">
                          <span>DeepBook USDC vault</span>
                          <span className="text-xs text-muted-foreground">
                            {TEST_USDC_VAULT_UNAVAILABLE_REASON}
                          </span>
                        </span>
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription className="truncate">
                  {spendAsset === "SUI"
                    ? "SUI is deposited into the Mandate vault and spent under policy limits."
                    : "Asset deposited into the Mandate vault and used by the agent."}
                </FieldDescription>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-cyan-400/10 pt-4 sm:grid-cols-2">
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>Budget ceiling</FieldLabel>
                  <span className="font-mono text-xs font-medium tabular-nums text-cyan-300">
                    {budgetSui} {selectedAssetUnit}
                  </span>
                </div>
                <InputGroup>
                  <InputGroupInput
                    type="number"
                    min="0"
                    step="0.001"
                    value={budgetSui}
                    onChange={(event) => setBudgetSui(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    {selectedAssetUnit}
                  </InputGroupAddon>
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="tx-limit">
                  Max single transaction
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="tx-limit"
                    type="number"
                    min="0"
                    step="0.001"
                    value={txLimitSui}
                    onChange={(event) => setTxLimitSui(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    {selectedAssetUnit}
                  </InputGroupAddon>
                </InputGroup>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-cyan-400/10 pt-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Protocol</FieldLabel>
                <div className="inline-flex h-8 w-fit items-center rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 text-sm font-medium text-cyan-200">
                  DeepBook
                </div>
              </Field>

              <Field>
                <FieldLabel>Expiration</FieldLabel>
                <Select
                  value={ttlMs}
                  onValueChange={(value) => value && setTtlMs(value)}
                >
                  <SelectTrigger className="w-full border-cyan-400/15 bg-white/[0.03]">
                    <span>{selectedExpiration.label}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {EXPIRATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="flex items-center gap-2 border-t border-cyan-400/10 pt-4 text-sm">
              <span className="text-muted-foreground">Network:</span>
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium tracking-wide text-cyan-200">
                {NETWORK_LABEL}
              </span>
            </div>

            {!account && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                Connect a Sui wallet before creating an on-chain mandate.
              </div>
            )}

            {account && !IS_PUBLIC_PACKAGE_ID_CONFIGURED && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Current network package id is not loaded in the frontend
                bundle. Restart Next.js from the repository root after updating
                .env.local.
              </div>
            )}

            {account && agentAddressIssue && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {agentAddressIssue}
              </div>
            )}

            {account && (budgetIssue || txLimitIssue) && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {budgetIssue ?? txLimitIssue}
              </div>
            )}

            {account && assetIssue && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {assetIssue}
              </div>
            )}

            {status === "success" && (
              <div className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-cyan-200">Status: Active</p>
                  <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[11px] font-medium uppercase text-cyan-200">
                    Created
                  </span>
                </div>
                <div className="mt-2 grid gap-1.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Digest</span>
                    {digest ? (
                      <CopyableId
                        value={digest}
                        label="digest"
                        className="text-zinc-100"
                      />
                    ) : (
                      <span className="text-zinc-100">-</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Mandate ID</span>
                    {createdMandateId ? (
                      <CopyableId
                        value={createdMandateId}
                        label="mandate id"
                        className="text-zinc-100"
                      />
                    ) : (
                      <span className="text-zinc-100">-</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {status === "error" && error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
          </FieldGroup>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-cyan-400/10 bg-zinc-950/95 px-5 py-4">
          <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={!valid}
            title={visibleDisabledReason ?? undefined}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSigning && <Loader2 className="animate-spin" />}
            {!account
              ? "Connect Wallet"
              : isSigning
                ? "Signing"
                : "Create Mandate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
