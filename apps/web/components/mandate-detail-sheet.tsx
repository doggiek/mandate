"use client";

import * as React from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";

import { ActivityFeed } from "@/components/activity-feed";
import { BudgetMeter } from "@/components/budget-meter";
import { CopyableId } from "@/components/copyable-id";
import { ExplorerLink } from "@/components/explorer-link";
import { StatusBadge } from "@/components/status-badges";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  CLOCK_OBJECT_ID,
  DUSDC_COIN_TYPE,
  DEEPBOOK_POOL_ID,
  DEEPBOOK_POOL_ID_SUI_DUSDC,
  DEEPBOOK_POOL_KEY,
  isCurrentMandateObjectType,
  NETWORK,
  normalizeSuiAddress,
  PACKAGE_ID,
} from "@/lib/chain-config";
import { sortActivitiesByTimeDesc } from "@/lib/activity-utils";
import { formatSui, stableExpiryLabel } from "@/lib/format";
import { useMandateStore } from "@/lib/mandate-store";
import { getMandateObject } from "@/lib/sui-rpc";
import { cn } from "@/lib/utils";

const REVOKE_TIMEOUT_MS = 180_000;
const OLD_PACKAGE_MESSAGE =
  "This mandate was created by an older package. Create a new mandate with the latest package to revoke or test policy actions.";

function executionTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  if (!Number.isFinite(timestamp) || diffMs < 60_000) {
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

function executionOutputSummary(execution: {
  outputAmount?: string;
  outputAsset?: string;
  outputCoinObjectIds?: string[];
  residualSuiAmount?: number;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.fillStatus === "no_fill") {
    return `No ${execution.outputAsset ?? "output"} filled`;
  }
  if (execution.outputAmount) {
    return execution.outputAmount;
  }
  return "Amount unavailable";
}

function formatMandateAsset(value: number, mandate?: { assetSymbol?: string }) {
  if (mandate?.assetSymbol && mandate.assetSymbol !== "SUI") {
    return `${value.toLocaleString("en-US", {
      maximumFractionDigits: 6,
      useGrouping: false,
    })} ${mandate.assetSymbol}`;
  }

  return formatSui(value);
}

function executionFillLabel(execution: {
  status: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.status === "failed") {
    return "Failed";
  }
  if (execution.fillStatus === "filled") {
    return "Executed";
  }
  if (execution.fillStatus === "no_fill") {
    return "No fill";
  }
  return "Amount unavailable";
}

function executionFillSubtext(execution: {
  status: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.status === "failed") {
    return "Transaction failed";
  }
  if (execution.fillStatus === "filled") {
    return "Swap filled";
  }
  if (execution.fillStatus === "no_fill") {
    return "Residual returned";
  }
  return "Amount unavailable";
}

function executionFillClass(execution: {
  status: string;
  fillStatus?: "filled" | "no_fill" | "amount_unavailable";
}) {
  if (execution.status === "failed") {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }
  if (execution.fillStatus === "filled") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400";
  }
  if (execution.fillStatus === "no_fill") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-400";
  }
  return "border-border bg-background/60 text-muted-foreground";
}

function executionInputLabel(execution: {
  inputAmount?: number;
  inputAsset?: string;
  amountSui?: number;
}) {
  if (typeof execution.inputAmount === "number") {
    return `${execution.inputAmount} ${execution.inputAsset ?? "SUI"}`;
  }
  if (typeof execution.amountSui === "number") {
    return formatSui(execution.amountSui);
  }
  return "0.001 SUI";
}

function executionResidualLabel(execution: {
  residualSuiAmount?: number;
  residualAmount?: number;
  residualAsset?: string;
}) {
  if (typeof execution.residualSuiAmount === "number") {
    return formatSui(execution.residualSuiAmount);
  }
  if (typeof execution.residualAmount === "number" && execution.residualAsset) {
    return `${execution.residualAmount} ${execution.residualAsset}`;
  }
  return "-";
}

function executionPoolId(execution: { pair?: string }) {
  return execution.pair === "SUI_DUSDC"
    ? DEEPBOOK_POOL_ID_SUI_DUSDC
    : DEEPBOOK_POOL_ID;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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

function withRevokeTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Wallet signing timeout or interruption"));
    }, REVOKE_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function objectTypeFromResponse(
  response: Awaited<ReturnType<typeof getMandateObject>>,
) {
  const content = response.data?.content;
  return content && content.dataType === "moveObject"
    ? content.type
    : undefined;
}

function assetMandateTypeArg(objectType?: string) {
  return objectType?.match(/AssetMandate<(.+)>/)?.[1];
}

export function MandateDetailSheet({
  mandateId,
  startRevokeNonce,
  onOpenChange,
}: {
  mandateId: string | null;
  startRevokeNonce?: number;
  onOpenChange: (open: boolean) => void;
}) {
  const {
    mandates,
    activity,
    orders,
    revokeMandate,
    withdrawMandate,
    refreshMandates,
  } = useMandateStore();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const [confirmingRevoke, setConfirmingRevoke] = React.useState(false);
  const [revokeDigest, setRevokeDigest] = React.useState<string | null>(null);
  const [withdrawDigest, setWithdrawDigest] = React.useState<string | null>(
    null,
  );
  const [isRevoking, setRevoking] = React.useState(false);
  const [isWithdrawing, setWithdrawing] = React.useState(false);
  const [revokeError, setRevokeError] = React.useState<string | null>(null);
  const [withdrawError, setWithdrawError] = React.useState<string | null>(null);
  const sheetContentRef = React.useRef<HTMLDivElement | null>(null);
  const sheetBodyRef = React.useRef<HTMLDivElement | null>(null);
  const revokeConfirmRef = React.useRef<HTMLElement | null>(null);
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const mandate = mandates.find((item) => item.id === mandateId);
  const mandateActivity = sortActivitiesByTimeDesc(
    activity.filter((event) => event.mandateId === mandateId),
  ).slice(0, 4);
  const mandateOrders = orders
    .filter((order) => order.mandateId === mandateId)
    .slice(0, 4);

  React.useEffect(() => {
    setConfirmingRevoke(false);
    setRevokeDigest(null);
    setWithdrawDigest(null);
    setRevokeError(null);
    setWithdrawError(null);
    setRevoking(false);
    setWithdrawing(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    sheetBodyRef.current?.scrollTo({ top: 0 });
    window.requestAnimationFrame(() => {
      sheetContentRef.current?.focus({ preventScroll: true });
    });
  }, [mandateId]);

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!confirmingRevoke) {
      return;
    }

    const container = sheetBodyRef.current;
    const target = revokeConfirmRef.current;
    if (!container || !target) {
      return;
    }

    const targetTop = target.offsetTop - container.offsetTop - 16;
    container.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: "smooth",
    });
  }, [confirmingRevoke]);

  React.useEffect(() => {
    if (
      !mandate ||
      !startRevokeNonce ||
      mandate.status !== "active" ||
      (Boolean(mandate.objectType) &&
        !isCurrentMandateObjectType(mandate.objectType))
    ) {
      return;
    }

    setConfirmingRevoke(true);
  }, [mandate?.id, mandate?.objectType, mandate?.status, startRevokeNonce]);

  const remaining = mandate
    ? (mandate.remainingVaultBalance ??
      Math.max(mandate.budget - mandate.spent, 0))
    : 0;
  const isLatestPackageMandate =
    Boolean(mandate) && isCurrentMandateObjectType(mandate?.objectType);
  const isKnownOlderPackageMandate =
    Boolean(mandate?.objectType) && !isLatestPackageMandate;
  const isOwnerWallet =
    !mandate?.ownerAddress ||
    normalizeSuiAddress(account?.address) ===
      normalizeSuiAddress(mandate.ownerAddress);
  const canRevoke =
    mandate?.status === "active" &&
    !isKnownOlderPackageMandate &&
    isOwnerWallet;
  const canWithdraw =
    Boolean(mandate) &&
    mandate?.status !== "active" &&
    remaining > 0 &&
    !isKnownOlderPackageMandate &&
    isOwnerWallet;
  const isWithdrawn =
    Boolean(mandate) && (mandate?.isWithdrawn || remaining <= 0);
  const fundsStatusLabel =
    isWithdrawn || remaining <= 0
      ? "Returned"
      : mandate?.status === "active"
        ? "Vaulted"
        : "Withdrawable";

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

  const handleRevoke = async () => {
    if (!mandate || isRevoking) return;

    if (!canRevoke) return;

    if (!isOwnerWallet) {
      setRevokeError("Only the owner wallet can revoke this mandate.");
      setConfirmingRevoke(false);
      return;
    }

    setRevoking(true);
    setRevokeError(null);

    try {
      const objectType =
        mandate.objectType ??
        objectTypeFromResponse(await getMandateObject(mandate.id));
      if (!isCurrentMandateObjectType(objectType)) {
        setRevokeError(OLD_PACKAGE_MESSAGE);
        setConfirmingRevoke(false);
        return;
      }

      const tx = new Transaction();
      if (objectType?.includes("::mandate::AssetMandate<")) {
        const typeArg = assetMandateTypeArg(objectType) ?? DUSDC_COIN_TYPE;
        if (!typeArg) {
          throw new Error(
            "NEXT_PUBLIC_DBUSDC_COIN_TYPE / NEXT_PUBLIC_DUSDC_COIN_TYPE is not configured.",
          );
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::revoke_asset_mandate`,
          typeArguments: [typeArg],
          arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
        });
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::withdraw_remaining_coin_after_expiry`,
          typeArguments: [typeArg],
          arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
        });
      } else {
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::revoke_mandate`,
          arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
        });
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::withdraw_remaining_sui_after_expiry`,
          arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
        });
      }

      const result = await withRevokeTimeout(
        signAndExecute.mutateAsync({ transaction: tx }),
      );
      const executionStatus = result.effects?.status;

      if (executionStatus?.status !== "success") {
        throw new Error(executionStatus?.error ?? "Transaction failed");
      }

      setRevokeDigest(result.digest);
      revokeMandate(mandate.id, result.digest);
      setConfirmingRevoke(false);
      refreshMandates();
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      closeTimeoutRef.current = setTimeout(() => {
        onOpenChange(false);
      }, 800);
    } catch (caught) {
      setRevokeError(
        isCancellationLikeError(caught)
          ? "Transaction was cancelled or interrupted. Please try again."
          : getErrorMessage(caught),
      );
    } finally {
      setRevoking(false);
    }
  };

  const handleWithdraw = async () => {
    if (!mandate || isWithdrawing || !canWithdraw) return;

    if (!isOwnerWallet) {
      setWithdrawError("Only the owner wallet can withdraw remaining funds.");
      return;
    }

    setWithdrawing(true);
    setWithdrawError(null);

    try {
      const objectType =
        mandate.objectType ??
        objectTypeFromResponse(await getMandateObject(mandate.id));
      if (!isCurrentMandateObjectType(objectType)) {
        setWithdrawError(OLD_PACKAGE_MESSAGE);
        return;
      }

      const tx = new Transaction();
      if (objectType?.includes("::mandate::AssetMandate<")) {
        const typeArg = assetMandateTypeArg(objectType) ?? DUSDC_COIN_TYPE;
        if (!typeArg) {
          throw new Error(
            "NEXT_PUBLIC_DBUSDC_COIN_TYPE / NEXT_PUBLIC_DUSDC_COIN_TYPE is not configured.",
          );
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::withdraw_remaining_coin_after_expiry`,
          typeArguments: [typeArg],
          arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
        });
      } else {
        tx.moveCall({
          target: `${PACKAGE_ID}::mandate::withdraw_remaining_sui_after_expiry`,
          arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
        });
      }

      const result = await withRevokeTimeout(
        signAndExecute.mutateAsync({ transaction: tx }),
      );
      const executionStatus = result.effects?.status;

      if (executionStatus?.status !== "success") {
        throw new Error(executionStatus?.error ?? "Transaction failed");
      }

      setWithdrawDigest(result.digest);
      withdrawMandate(mandate.id, result.digest);
      refreshMandates();
    } catch (caught) {
      setWithdrawError(
        isCancellationLikeError(caught)
          ? "Transaction was cancelled or interrupted. Please try again."
          : getErrorMessage(caught),
      );
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <Sheet
      modal="trap-focus"
      open={Boolean(mandateId)}
      onOpenChange={onOpenChange}
    >
      <SheetContent
        ref={sheetContentRef}
        tabIndex={-1}
        className="!fixed !right-0 !top-0 z-50 !h-screen w-full overflow-hidden border-border bg-background/95 p-0 backdrop-blur-xl focus:outline-none sm:max-w-2xl"
      >
        {mandate ? (
          <>
            <SheetHeader className="shrink-0 border-b border-border p-5">
              <div className="flex items-start justify-between gap-4 pr-8">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <StatusBadge status={mandate.status} />
                  </div>
                  <SheetTitle
                    className="mt-3 block max-w-[28rem] truncate whitespace-nowrap text-xl leading-tight sm:max-w-[34rem]"
                    title={mandate.label}
                  >
                    {mandate.label}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Mandate object on {NETWORK}
                  </SheetDescription>
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                    <CopyableId value={mandate.id} label="mandate id" />
                    <ExplorerLink
                      objectId={mandate.id}
                      label="View mandate object on Suivision"
                    />
                    <span aria-hidden="true">·</span>
                    <span>{NETWORK}</span>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-primary/30 bg-primary/10 text-primary"
                >
                  {DEEPBOOK_POOL_KEY}
                </Badge>
              </div>
            </SheetHeader>

            <div
              ref={sheetBodyRef}
              className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5"
            >
              {mandate.status === "revoked" && (
                <Alert
                  variant="destructive"
                  className="border-destructive/30 bg-destructive/10"
                >
                  <Ban className="size-4" />
                  <AlertTitle>
                    Agent actions are blocked by Move policy
                  </AlertTitle>
                  <AlertDescription>
                    This mandate is revoked. Future agent execution attempts
                    will be rejected by policy checks.
                  </AlertDescription>
                </Alert>
              )}

              {mandate.status === "active" && isKnownOlderPackageMandate && (
                <Alert className="border-amber-500/25 bg-amber-500/10">
                  <AlertTriangle className="size-4 text-amber-400" />
                  <AlertTitle>Older Mandate package</AlertTitle>
                  <AlertDescription>{OLD_PACKAGE_MESSAGE}</AlertDescription>
                </Alert>
              )}

              {revokeDigest && (
                <Alert className="border-primary/25 bg-primary/10">
                  <CheckCircle2 className="size-4 text-primary" />
                  <AlertTitle>Status: Revoked</AlertTitle>
                  <AlertDescription>
                    Digest{" "}
                    <CopyableId
                      value={revokeDigest}
                      label="revoke digest"
                      className="text-foreground"
                    />
                  </AlertDescription>
                </Alert>
              )}

              {withdrawDigest && (
                <Alert className="border-primary/25 bg-primary/10">
                  <CheckCircle2 className="size-4 text-primary" />
                  <AlertTitle>Remaining funds withdrawn</AlertTitle>
                  <AlertDescription>
                    Digest{" "}
                    <CopyableId
                      value={withdrawDigest}
                      label="withdraw digest"
                      className="text-foreground"
                    />
                  </AlertDescription>
                </Alert>
              )}

              {revokeError && (
                <Alert
                  variant="destructive"
                  className="border-destructive/30 bg-destructive/10"
                >
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Unable to revoke mandate</AlertTitle>
                  <AlertDescription>{revokeError}</AlertDescription>
                </Alert>
              )}

              {withdrawError && (
                <Alert
                  variant="destructive"
                  className="border-destructive/30 bg-destructive/10"
                >
                  <AlertTriangle className="size-4" />
                  <AlertTitle>Unable to withdraw funds</AlertTitle>
                  <AlertDescription>{withdrawError}</AlertDescription>
                </Alert>
              )}

              <section className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Policy limits</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Budget, per-transaction cap, protocol scope, and
                      expiration are enforced before every agent execution.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">Budget used</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatMandateAsset(mandate.spent, mandate)} /{" "}
                      {formatMandateAsset(mandate.budget, mandate)}
                    </span>
                  </div>
                  <BudgetMeter
                    spent={mandate.spent}
                    budget={mandate.budget}
                    showLabel={false}
                    symbol={mandate.assetSymbol ?? "SUI"}
                  />
                </div>
                <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
                  {[
                    {
                      label: "Budget ceiling",
                      value: formatMandateAsset(mandate.budget, mandate),
                    },
                    {
                      label: "Max tx",
                      value: formatMandateAsset(mandate.txLimit, mandate),
                    },
                    { label: "Protocol", value: "DeepBook only" },
                    {
                      label: "Expiration",
                      value:
                        mandate.expiresLabel ??
                        stableExpiryLabel(mandate.expiresAt, mandate.status),
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex min-h-16 min-w-0 flex-col justify-center rounded-lg border border-border/70 bg-background/35 px-3 py-2.5"
                    >
                      <span className="truncate text-muted-foreground">
                        {item.label}
                      </span>
                      <span
                        className="mt-1 min-w-0 truncate font-medium text-foreground"
                        title={item.value}
                      >
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card/60">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <h3 className="text-sm font-medium">Recent Activity</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Latest on-chain events for this mandate.
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="px-4">
                  {mandateActivity.length > 0 ? (
                    <ActivityFeed events={mandateActivity} />
                  ) : (
                    <p className="py-5 text-sm text-muted-foreground">
                      No activity recorded yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-border bg-card/60">
                <div className="p-4">
                  <h3 className="text-sm font-medium">DeepBook Orders</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Real swap records executed through this mandate.
                  </p>
                </div>
                <Separator />
                <div className="divide-y divide-border">
                  {mandateOrders.length > 0 ? (
                    mandateOrders.map((execution) => {
                      const poolId = executionPoolId(execution);
                      return (
                        <div key={execution.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={executionFillClass(execution)}
                                >
                                  {executionFillLabel(execution)}
                                </Badge>
                                <CopyableId
                                  value={execution.digest}
                                  label="DeepBook order digest"
                                  className="text-sm font-medium text-foreground"
                                />
                                <ExplorerLink
                                  digest={execution.digest}
                                  label="View DeepBook order on Suivision"
                                />
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {executionFillSubtext(execution)}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {execution.pair ?? DEEPBOOK_POOL_KEY} ·{" "}
                                {execution.side ?? "Buy"}
                              </p>
                              <p className="mt-2 text-sm text-foreground">
                                <span className="text-muted-foreground">
                                  Input:
                                </span>{" "}
                                {executionInputLabel(execution)}
                                <span className="text-muted-foreground">
                                  {" "}
                                  · Output:
                                </span>{" "}
                                {executionOutputSummary(execution)}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Residual returned:{" "}
                                {executionResidualLabel(execution)}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                {poolId ? (
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    Pool:
                                    <CopyableId
                                      value={poolId}
                                      label="DeepBook pool object id"
                                    />
                                    <ExplorerLink
                                      objectId={poolId}
                                      label="View DeepBook pool on Suivision"
                                    />
                                  </span>
                                ) : null}
                                {execution.outputOwner ? (
                                  <span className="inline-flex min-w-0 items-center gap-1">
                                    Owner:
                                    <CopyableId
                                      value={execution.outputOwner}
                                      label="output owner"
                                    />
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {executionTime(execution.timestamp)}
                            </span>
                          </div>
                          <div className="mt-2 text-right text-xs text-muted-foreground">
                            Gas fee:{" "}
                            <span className="font-mono">
                              {typeof execution.gasFeeSui === "number"
                                ? formatSui(execution.gasFeeSui)
                                : "-"}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="px-4 py-5 text-sm text-muted-foreground">
                      No DeepBook executions linked yet.
                    </p>
                  )}
                </div>
              </section>

              <section
                ref={revokeConfirmRef}
                className="rounded-xl border border-border bg-card/60 p-4"
              >
                {confirmingRevoke ? (
                  <Alert
                    variant="destructive"
                    className="border-destructive/30 bg-destructive/10"
                  >
                    <AlertTriangle className="size-4" />
                    <AlertTitle>Revoke this mandate?</AlertTitle>
                    <AlertDescription>
                      The agent will immediately lose spending authority under
                      the on-chain Move policy.
                    </AlertDescription>
                    <div className="col-start-2 mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={handleRevoke}
                        disabled={isRevoking}
                      >
                        {isRevoking ? "Revoking" : "Confirm revoke + withdraw"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isRevoking}
                        onClick={() => setConfirmingRevoke(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </Alert>
                ) : (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium">Owner controls</h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 font-normal",
                          remaining > 0
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                            : "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
                        )}
                      >
                        {fundsStatusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {mandate.status === "active"
                        ? "Revocation is signed by the owner wallet. Remaining vault funds are withdrawn back to the owner."
                        : canWithdraw
                          ? "Remaining vault funds can be withdrawn by the owner wallet."
                          : "No remaining vault funds are available to withdraw."}
                    </p>
                    <div className="flex justify-end">
                      {mandate.status === "active" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={!canRevoke || isRevoking}
                          onClick={() => setConfirmingRevoke(true)}
                          title={
                            isLatestPackageMandate
                              ? "Permanently revoke owner-granted agent permission"
                              : isKnownOlderPackageMandate
                                ? OLD_PACKAGE_MESSAGE
                                : "Verifying Mandate package before revoke"
                          }
                        >
                          {isRevoking ? "Revoking" : "Revoke + Withdraw"}
                        </Button>
                      ) : canWithdraw ? (
                        <Button
                          variant="default"
                          size="sm"
                          disabled={isWithdrawing}
                          onClick={handleWithdraw}
                          title="Withdraw remaining vault funds back to the owner wallet"
                        >
                          {isWithdrawing ? "Withdrawing" : "Withdraw"}
                        </Button>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No actions available.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="border-b border-border p-5">
              <SheetTitle>Mandate not found</SheetTitle>
              <SheetDescription>
                This mandate is no longer available in the console.
              </SheetDescription>
            </SheetHeader>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
