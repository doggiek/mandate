"use client"

import * as React from "react"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import type { SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc"
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ShieldCheck,
  WalletCards,
} from "lucide-react"

import { ActivityFeed } from "@/components/activity-feed"
import { BudgetMeter } from "@/components/budget-meter"
import { CopyableId } from "@/components/copyable-id"
import { StatusBadge } from "@/components/status-badges"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import {
  CLOCK_OBJECT_ID,
  DEEPBOOK_POOL_KEY,
  NETWORK,
  PACKAGE_ID,
} from "@/lib/chain-config"
import { formatSui, relativeTime, stableExpiryLabel } from "@/lib/format"
import { useMandateStore } from "@/lib/mandate-store"
import { cn } from "@/lib/utils"

const MOCK_OWNER_ADDRESS =
  "0x91dc52b8d4b6e7815f4c7a2fb9b4384f7b32d1f0c69a4f1be265a8d94dd8b2c1"

const MOCK_AGENT_ADDRESSES: Record<string, string> = {
  ag_market:
    "0x5f2a9c4b61d7e0a3c8f91b257de44a8c92301c5f77b1e839d0a5c16f22a4be90",
  ag_treasury:
    "0x74a6d91f0e43c8b2a51d069fe3b8472276ef19a3d8c402b5c0f119de642a9f0c",
  ag_lp:
    "0x2c7b803e5d16a9f4b8170e2f63d9c45a0bf7e8136c29d520ae4f731b8c09d2a4",
  ag_arbitrage:
    "0x39e71fabc50486d2a8f11c64b0ef5d9229a30478c2dc77a91ef4b6306dd9c5af",
}

const REVOKE_TIMEOUT_MS = 180_000

function executionTime(timestamp: number) {
  const diffMs = Date.now() - timestamp
  if (!Number.isFinite(timestamp) || diffMs < 60_000) {
    return "just now"
  }

  const mins = Math.floor(diffMs / 60_000)
  if (mins < 60) {
    return `${mins}m ago`
  }

  const hours = Math.floor(diffMs / 3_600_000)
  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function isCancellationLikeError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase()
  return (
    message.includes("cancel") ||
    message.includes("reject") ||
    message.includes("interrupt") ||
    message.includes("timeout") ||
    message.includes("closed") ||
    message.includes("user denied")
  )
}

function withRevokeTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Wallet signing timeout or interruption"))
    }, REVOKE_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

function DetailMetric({
  label,
  value,
  tone,
}: {
  label: string
  value: React.ReactNode
  tone?: "danger" | "primary"
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/70 p-3",
        tone === "danger" && "border-destructive/25 bg-destructive/10",
        tone === "primary" && "border-primary/25 bg-primary/10"
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-medium text-foreground">
        {value}
      </div>
    </div>
  )
}

export function MandateDetailSheet({
  mandateId,
  onOpenChange,
}: {
  mandateId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const {
    mandates,
    activity,
    orders,
    revokeMandate,
    refreshMandates,
  } = useMandateStore()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const [confirmingRevoke, setConfirmingRevoke] = React.useState(false)
  const [revokeDigest, setRevokeDigest] = React.useState<string | null>(null)
  const [isRevoking, setRevoking] = React.useState(false)
  const [revokeError, setRevokeError] = React.useState<string | null>(null)
  const sheetBodyRef = React.useRef<HTMLDivElement | null>(null)
  const revokeConfirmRef = React.useRef<HTMLElement | null>(null)
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const mandate = mandates.find((item) => item.id === mandateId)
  const mandateActivity = activity
    .filter((event) => event.mandateId === mandateId)
    .slice(0, 4)
  const mandateOrders = orders
    .filter((order) => order.mandateId === mandateId)
    .slice(0, 4)

  React.useEffect(() => {
    setConfirmingRevoke(false)
    setRevokeDigest(null)
    setRevokeError(null)
    setRevoking(false)
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    sheetBodyRef.current?.scrollTo({ top: 0 })
  }, [mandateId])

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (!confirmingRevoke) {
      return
    }

    const container = sheetBodyRef.current
    const target = revokeConfirmRef.current
    if (!container || !target) {
      return
    }

    const targetTop = target.offsetTop - container.offsetTop - 16
    container.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: "smooth",
    })
  }, [confirmingRevoke])

  const remaining = mandate ? Math.max(mandate.budget - mandate.spent, 0) : 0
  const agentAddress = mandate
    ? mandate.agentAddress ??
      MOCK_AGENT_ADDRESSES[mandate.agent.id] ??
      MOCK_AGENT_ADDRESSES.ag_market
    : MOCK_AGENT_ADDRESSES.ag_market
  const ownerAddress = mandate?.ownerAddress ?? MOCK_OWNER_ADDRESS
  const canRevoke = mandate?.status === "active"
  const isOwnerWallet =
    !mandate?.ownerAddress ||
    account?.address?.toLowerCase() === mandate.ownerAddress.toLowerCase()

  const signAndExecute = useSignAndExecuteTransaction<SuiTransactionBlockResponse>({
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
  })

  const handleRevoke = async () => {
    if (!mandate || !canRevoke || isRevoking) return

    if (!isOwnerWallet) {
      setRevokeError("Only the owner wallet can revoke this mandate.")
      setConfirmingRevoke(false)
      return
    }

    setRevoking(true)
    setRevokeError(null)

    try {
      const tx = new Transaction()
      tx.moveCall({
        target: `${PACKAGE_ID}::mandate::revoke_mandate`,
        arguments: [tx.object(mandate.id), tx.object(CLOCK_OBJECT_ID)],
      })

      const result = await withRevokeTimeout(
        signAndExecute.mutateAsync({ transaction: tx })
      )
      const executionStatus = result.effects?.status

      if (executionStatus?.status !== "success") {
        throw new Error(executionStatus?.error ?? "Transaction failed")
      }

      setRevokeDigest(result.digest)
      revokeMandate(mandate.id, result.digest)
      setConfirmingRevoke(false)
      refreshMandates()
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
      closeTimeoutRef.current = setTimeout(() => {
        onOpenChange(false)
      }, 800)
    } catch (caught) {
      setRevokeError(
        isCancellationLikeError(caught)
          ? "Transaction was cancelled or interrupted. Please try again."
          : getErrorMessage(caught)
      )
    } finally {
      setRevoking(false)
    }
  }

  return (
    <Sheet modal="trap-focus" open={Boolean(mandateId)} onOpenChange={onOpenChange}>
      <SheetContent className="!fixed !right-0 !top-0 z-50 !h-screen w-full overflow-hidden border-border bg-background/95 p-0 backdrop-blur-xl sm:max-w-xl">
        {mandate ? (
          <>
            <SheetHeader className="shrink-0 border-b border-border p-5">
              <div className="flex items-start justify-between gap-4 pr-8">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <StatusBadge status={mandate.status} />
                  </div>
                  <SheetTitle className="mt-3 truncate text-xl">
                    {mandate.label}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Mandate object on {NETWORK}
                  </SheetDescription>
                  <div className="mt-1 flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
                    <CopyableId value={mandate.id} label="mandate id" /> ·{" "}
                    {NETWORK}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="border-primary/30 bg-primary/10 text-primary"
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
                  <AlertTitle>Agent actions are blocked by Move policy</AlertTitle>
                  <AlertDescription>
                    This mandate is revoked. Future agent execution attempts will
                    be rejected by policy checks.
                  </AlertDescription>
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

              <section className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-medium">Budget policy</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Spend is enforced before every mocked or DeepBook action.
                    </p>
                  </div>
                  <WalletCards className="size-4 text-primary" />
                </div>
                <BudgetMeter
                  spent={mandate.spent}
                  budget={mandate.budget}
                  className="mt-4"
                />
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <DetailMetric
                    label="Budget ceiling"
                    value={formatSui(mandate.budget)}
                    tone="primary"
                  />
                  <DetailMetric
                    label="Remaining"
                    value={formatSui(remaining)}
                  />
                  <DetailMetric
                    label="Spent"
                    value={formatSui(mandate.spent)}
                  />
                  <DetailMetric
                    label="Max single transaction"
                    value={formatSui(mandate.txLimit)}
                  />
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <DetailMetric
                  label="Owner address"
                  value={
                    <CopyableId value={ownerAddress} label="owner address" />
                  }
                />
                <DetailMetric
                  label="Agent address"
                  value={
                    <CopyableId value={agentAddress} label="agent address" />
                  }
                />
                <DetailMetric label="Protocol scope" value="DeepBook only" />
                <DetailMetric
                  label="Expiration"
                  value={
                    mandate.expiresLabel ??
                    stableExpiryLabel(mandate.expiresAt, mandate.status)
                  }
                />
              </section>

              <section className="rounded-xl border border-border bg-card/60">
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <h3 className="text-sm font-medium">Recent activity</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      On-chain activity log preview.
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
                  <h3 className="text-sm font-medium">
                    Related DeepBook executions
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Successful Run Agent records linked to this mandate.
                  </p>
                </div>
                <Separator />
                <div className="divide-y divide-border">
                  {mandateOrders.length > 0 ? (
                    mandateOrders.map((execution) => (
                      <div
                        key={execution.id}
                        className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <CopyableId
                              value={execution.digest}
                              label="digest"
                              className="text-sm text-foreground"
                            />
                            <Badge
                              variant="outline"
                              className="border-emerald-500/25 bg-emerald-500/10 capitalize text-emerald-400"
                            >
                              {execution.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {execution.protocol} · {executionTime(execution.timestamp)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {typeof execution.suiBalanceChange === "number"
                              ? formatSui(execution.suiBalanceChange)
                              : "-"}
                          </span>
                        </div>
                      </div>
                    ))
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
                        {isRevoking ? "Revoking" : "Confirm revoke"}
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-medium">Owner controls</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Revocation is signed by the owner wallet and enforced
                        by the Mandate Move policy.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      disabled={!canRevoke || isRevoking}
                      onClick={() => setConfirmingRevoke(true)}
                    >
                      {isRevoking ? "Revoking" : "Revoke Mandate"}
                    </Button>
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
                This mocked mandate is no longer available in the console.
              </SheetDescription>
            </SheetHeader>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
