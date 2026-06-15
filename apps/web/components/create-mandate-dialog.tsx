"use client"

import * as React from "react"
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
  useSuiClient,
} from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import type { SuiEvent, SuiTransactionBlockResponse } from "@mysten/sui/jsonRpc"
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { CopyableId, shortId } from "@/components/copyable-id"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  AGENTS,
  useMandateStore,
} from "@/lib/mandate-store"
import {
  CLOCK_OBJECT_ID,
  NETWORK,
  PACKAGE_ID,
  VERIFIED_AGENT_ADDRESS,
} from "@/lib/chain-config"
import { Loader2 } from "lucide-react"

const PROTOCOL_SCOPE_DEEPBOOK = 1
const MIST_PER_SUI = BigInt(1_000_000_000)
const SIGNING_TIMEOUT_MS = 60_000
const EXPIRATION_OPTIONS = [
  { label: "1h", value: "3600000", durationDays: 1 },
  { label: "12h", value: "43200000", durationDays: 1 },
  { label: "24h", value: "86400000", durationDays: 1 },
  { label: "7d", value: "604800000", durationDays: 7 },
] as const

type CreateStatus = "idle" | "signing" | "success" | "error"

function parseSuiToMist(value: string) {
  const trimmed = value.trim()
  const [wholePart, fractionalPart = ""] = trimmed.split(".")

  if (
    !wholePart ||
    !/^\d+$/.test(wholePart) ||
    !/^\d*$/.test(fractionalPart)
  ) {
    throw new Error(`Invalid SUI amount: ${value}`)
  }

  const fractional = fractionalPart.padEnd(9, "0").slice(0, 9)
  return BigInt(wholePart) * MIST_PER_SUI + BigInt(fractional || "0")
}

function formatMistAsSui(mist: bigint) {
  const whole = mist / MIST_PER_SUI
  const fractional = (mist % MIST_PER_SUI)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "")

  return `${whole.toString()}${fractional ? `.${fractional}` : ""}`
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

function withSigningTimeout<T>(promise: Promise<T>) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Wallet signing timeout or interruption"))
    }, SIGNING_TIMEOUT_MS)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  })
}

function parsedJsonRecord(event: SuiEvent) {
  return event.parsedJson && typeof event.parsedJson === "object"
    ? (event.parsedJson as Record<string, unknown>)
    : null
}

function findCreatedMandateId(result: SuiTransactionBlockResponse) {
  const mandateType = `${PACKAGE_ID}::mandate::Mandate`
  const created = result.objectChanges?.find(
    (change) =>
      change.type === "created" &&
      "objectType" in change &&
      change.objectType.includes(mandateType)
  )

  if (created && "objectId" in created) {
    return created.objectId
  }

  const createdEvent = result.events?.find(
    (event) =>
      event.type.includes(`${PACKAGE_ID}::mandate::CreatedEvent`) ||
      event.type.includes(`${PACKAGE_ID}::mandate::MandateCreatedEvent`)
  )
  const parsed = createdEvent ? parsedJsonRecord(createdEvent) : null
  const mandateId = parsed?.mandate_id ?? parsed?.mandateId

  return typeof mandateId === "string" ? mandateId : null
}

export function CreateMandateDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { createMandate, refreshMandates } = useMandateStore()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const closeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const [label, setLabel] = React.useState("")
  const [agentAddress, setAgentAddress] = React.useState(VERIFIED_AGENT_ADDRESS)
  const [budgetSui, setBudgetSui] = React.useState("0.1")
  const [txLimitSui, setTxLimitSui] = React.useState("0.01")
  const [ttlMs, setTtlMs] = React.useState(EXPIRATION_OPTIONS[2].value)
  const [isSigning, setSigning] = React.useState(false)
  const [status, setStatus] = React.useState<CreateStatus>("idle")
  const [digest, setDigest] = React.useState<string | null>(null)
  const [createdMandateId, setCreatedMandateId] = React.useState<string | null>(
    null
  )
  const [error, setError] = React.useState<string | null>(null)
  const [network, setNetwork] = React.useState<"mainnet" | "testnet">(
    NETWORK as "mainnet" | "testnet"
  )

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

  React.useEffect(() => {
    if (open && !agentAddress) {
      setAgentAddress(VERIFIED_AGENT_ADDRESS)
    }
  }, [agentAddress, open])

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      return
    }

    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [open])

  function reset() {
    setLabel("")
    setAgentAddress(VERIFIED_AGENT_ADDRESS)
    setBudgetSui("0.1")
    setTxLimitSui("0.01")
    setTtlMs(EXPIRATION_OPTIONS[2].value)
    setSigning(false)
    setStatus("idle")
    setDigest(null)
    setCreatedMandateId(null)
    setError(null)
    setNetwork(NETWORK as "mainnet" | "testnet")
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen)

    if (!nextOpen) {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
        closeTimeoutRef.current = null
      }
      reset()
    }
  }

  const valid =
    label.trim().length > 0 &&
    Boolean(account?.address) &&
    agentAddress.trim().length > 0 &&
    !isSigning
  const selectedExpiration =
    EXPIRATION_OPTIONS.find((option) => option.value === ttlMs) ??
    EXPIRATION_OPTIONS[2]

  async function handleSubmit() {
    if (!valid) return

    console.log("[MANDATE] signing started")
    setSigning(true)
    setStatus("signing")
    setDigest(null)
    setCreatedMandateId(null)
    setError(null)

    try {
      const budgetCeilingMist = parseSuiToMist(budgetSui)
      const maxSingleTxMist = parseSuiToMist(txLimitSui)

      if (budgetCeilingMist <= BigInt(0) || maxSingleTxMist <= BigInt(0)) {
        throw new Error("Budget and max single transaction must be greater than 0")
      }

      const tx = new Transaction()
      const [budgetCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(budgetCeilingMist)])
      tx.moveCall({
        target: `${PACKAGE_ID}::mandate::create_mandate`,
        arguments: [
          tx.pure.address(agentAddress.trim()),
          budgetCoin,
          tx.pure.u64(maxSingleTxMist),
          tx.pure.u8(PROTOCOL_SCOPE_DEEPBOOK),
          tx.pure.u64(ttlMs),
          tx.object(CLOCK_OBJECT_ID),
        ],
      })

      const result = await withSigningTimeout(
        signAndExecute.mutateAsync({ transaction: tx })
      )
      console.log("[MANDATE] signed", result)
      const executionStatus = result.effects?.status

      if (executionStatus?.status !== "success") {
        throw new Error(executionStatus?.error ?? "Transaction failed")
      }

      const mandateId = findCreatedMandateId(result)
      if (!mandateId) {
        throw new Error("Transaction succeeded but Mandate object id was not found")
      }

      createMandate({
        id: mandateId,
        label: label.trim(),
        agentId: AGENTS[0].id,
        ownerAddress: account?.address,
        agentAddress: agentAddress.trim(),
        budget: Number(formatMistAsSui(budgetCeilingMist)),
        txLimit: Number(formatMistAsSui(maxSingleTxMist)),
        approvalThreshold: Number(formatMistAsSui(maxSingleTxMist)),
        protocols: ["DeepBook"],
        durationDays: selectedExpiration.durationDays,
        network,
        digest: result.digest,
        ttlMs,
        expiresLabel: selectedExpiration.label,
      })

      setDigest(result.digest)
      setCreatedMandateId(mandateId)
      setStatus("success")
      toast.success("Mandate created on-chain", {
        description: `${shortId(mandateId)} · ${shortId(result.digest)}`,
      })
      refreshMandates()
      window.setTimeout(refreshMandates, 1_200)
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
      closeTimeoutRef.current = setTimeout(() => {
        handleOpenChange(false)
        refreshMandates()
        window.setTimeout(refreshMandates, 1_200)
      }, 800)
    } catch (caught) {
      console.error("[MANDATE] failed", caught)
      setStatus("error")
      setError(
        isCancellationLikeError(caught)
          ? "Transaction was cancelled or interrupted. Please try again."
          : getErrorMessage(caught)
      )
    } finally {
      setSigning(false)
      setStatus((current) => (current === "signing" ? "idle" : current))
      console.log("[MANDATE] signing finished")
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
            Grant an AI agent revocable spending authority on Sui.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4">
          <FieldGroup className="gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="mandate-label">Label</FieldLabel>
                <Input
                  id="mandate-label"
                  placeholder="DEEP_SUI trading mandate"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <FieldDescription>
                  Name used to identify this mandate.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="mandate-agent">Agent address</FieldLabel>
                <Input
                  id="mandate-agent"
                  placeholder="0x..."
                  value={agentAddress}
                  className="min-w-0 font-mono text-xs"
                  onChange={(event) => setAgentAddress(event.target.value)}
                />
                <FieldDescription>
                  This is the backend agent wallet. The owner keeps their key;
                  the agent only receives a scoped Mandate object.
                </FieldDescription>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 border-t border-cyan-400/10 pt-4 sm:grid-cols-2">
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>Budget ceiling</FieldLabel>
                  <span className="font-mono text-xs font-medium tabular-nums text-cyan-300">
                    {budgetSui} SUI
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
                  <InputGroupAddon align="inline-end">SUI</InputGroupAddon>
                </InputGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="tx-limit">Max single transaction</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="tx-limit"
                    type="number"
                    min="0"
                    step="0.001"
                    value={txLimitSui}
                    onChange={(event) => setTxLimitSui(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">SUI</InputGroupAddon>
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
                <Select value={ttlMs} onValueChange={(value) => value && setTtlMs(value)}>
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
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-cyan-200">
                {network}
              </span>
            </div>

            {!account && (
              <div className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
                Connect a Sui wallet before creating an on-chain mandate.
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
  )
}
