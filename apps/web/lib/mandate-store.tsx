"use client"

import * as React from "react"
import { useCurrentAccount } from "@mysten/dapp-kit"
import {
  currentMandateObjectType,
  DEEPBOOK_POOL_KEY,
  isCurrentMandateObjectType,
  NETWORK,
  PACKAGE_ID,
} from "@/lib/chain-config"
import {
  AGENTS,
  ALL_PROTOCOLS,
  type ActivityEvent,
  type DeepBookOrder,
  type ExecutionStatus,
  type Mandate,
  type Protocol,
} from "@/lib/mandate-data"
import { formatSui, stableExpiryLabel } from "@/lib/format"
import {
  getMandateObject,
  getTransactionDetails,
  queryMandateActivityEvents,
  queryMandateBlockedEvents,
  queryMandateCreatedEvents,
  queryMandateRejectEvents,
  queryMandateRevokeEvents,
} from "@/lib/sui-rpc"
import type {
  SuiEvent,
  SuiObjectResponse,
  SuiTransactionBlockResponse,
} from "@mysten/sui/jsonRpc"

const USER_MANDATES_KEY = `mandate:userMandates:${NETWORK}`
const USER_ACTIVITY_KEY = `mandate:userActivity:${NETWORK}`
const USER_METADATA_KEY = `mandate:userMetadata:${NETWORK}`
const USER_EXECUTIONS_KEY = `mandate:deepbookExecutions:${NETWORK}`

export type NewMandateInput = {
  id?: string
  label: string
  agentId: string
  ownerAddress?: string
  agentAddress?: string
  budget: number
  txLimit: number
  approvalThreshold: number
  protocols: Protocol[]
  durationDays: number
  network: "mainnet" | "testnet"
  digest?: string
  ttlMs?: string
  expiresLabel?: string
}

type StoreContextValue = {
  mandates: Mandate[]
  activity: ActivityEvent[]
  orders: DeepBookOrder[]
  loading: boolean
  error: string | null
  isWalletScoped: boolean
  createMandate: (input: NewMandateInput) => Mandate
  revokeMandate: (id: string, digest?: string) => void
  recordAgentExecution: (input: {
    mandateId: string
    digest?: string
    amountSui?: number
    suiBalanceChange?: number
    gasFeeSui?: number
    pair?: string
    side?: "Buy" | "Sell"
  }) => void
  recordBlockedAction: (input: {
    mandateId: string
    digest?: string
    amountSui?: number
    reason: string
  }) => void
  refreshMandates: () => void
  clearUserDemoData: () => void
}

type UserMandateMetadata = {
  mandateId: string
  label: string
  createdDigest?: string
  createdAt: string
  ttl?: string
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function mistToSui(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0)
  return numeric / 1_000_000_000
}

function clientTimeDisplay(iso: string) {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = now - then

  if (!Number.isFinite(then) || diffMs < 60_000) {
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

function displayTimeFromMs(value?: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? clientTimeDisplay(new Date(value).toISOString())
    : "-"
}

function timestampMs(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function deriveMandateStatus(mandate: Mandate): Mandate["status"] {
  if (mandate.status === "revoked") {
    return "revoked"
  }

  const expiresAt = new Date(mandate.expiresAt).getTime()
  if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return "expired"
  }

  return "active"
}

function normalizeMandateStatus(mandate: Mandate): Mandate {
  const status = deriveMandateStatus(mandate)
  return {
    ...mandate,
    status,
    expiresLabel:
      status === "expired"
        ? "Expired"
        : mandate.expiresLabel ?? stableExpiryLabel(mandate.expiresAt, status),
    createdAtDisplay: clientTimeDisplay(mandate.createdAt),
  }
}

function ttlLabel(ttl?: string) {
  switch (ttl) {
    case "3600000":
      return "1h"
    case "43200000":
      return "12h"
    case "86400000":
      return "24h"
    case "604800000":
      return "7d"
    default:
      return undefined
  }
}

function parsedJsonRecord(event: SuiEvent) {
  return event.parsedJson && typeof event.parsedJson === "object"
    ? (event.parsedJson as Record<string, unknown>)
    : {}
}

function eventDigest(event: SuiEvent) {
  return event.id?.txDigest ?? ""
}

function eventMandateId(event: SuiEvent) {
  const parsed = parsedJsonRecord(event)
  const id = parsed.mandate_id ?? parsed.mandateId
  return typeof id === "string" ? id : null
}

function eventReason(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return new TextDecoder().decode(new Uint8Array(value))
  }

  return undefined
}

function eventTimestampMs(event: SuiEvent) {
  return timestampMs(event.timestampMs)
}

function payloadTimestampMs(event: SuiEvent) {
  const parsed = parsedJsonRecord(event)
  return timestampMs(parsed.timestamp_ms) ?? timestampMs(parsed.created_at_ms)
}

function moveObjectFields(response: SuiObjectResponse) {
  const content = response.data?.content
  if (!content || content.dataType !== "moveObject") {
    return {}
  }

  return "fields" in content && typeof content.fields === "object"
    ? (content.fields as Record<string, unknown>)
    : {}
}

function moveObjectType(response?: SuiObjectResponse) {
  const content = response?.data?.content
  return content && content.dataType === "moveObject" ? content.type : undefined
}

function mapCreatedEventToMandate(
  event: SuiEvent,
  object?: SuiObjectResponse
): Mandate | null {
  const parsed = parsedJsonRecord(event)
  const objectFields = object ? moveObjectFields(object) : {}
  const mandateId = eventMandateId(event)
  if (!mandateId) {
    return null
  }

  const owner = parsed.owner
  const agent = parsed.agent ?? objectFields.agent
  const createdAtMs =
    timestampMs(parsed.created_at_ms) ??
    timestampMs(objectFields.created_at_ms) ??
    timestampMs(event.timestampMs)
  const expiresAtMs =
    timestampMs(parsed.expires_at_ms) ??
    timestampMs(objectFields.expires_at_ms) ??
    0
  const isActive = objectFields.is_active !== false
  const currentSpent = objectFields.current_spent ?? 0
  const budgetCeiling = parsed.budget_ceiling ?? objectFields.budget_ceiling ?? 0
  const maxSingleTx = parsed.max_single_tx ?? objectFields.max_single_tx ?? 0
  const expiresAt = expiresAtMs > 0
    ? new Date(expiresAtMs).toISOString()
    : new Date((createdAtMs ?? 0) + 86_400_000).toISOString()
  const createdAt = createdAtMs
    ? new Date(createdAtMs).toISOString()
    : new Date(0).toISOString()
  const status: Mandate["status"] = !isActive
    ? "revoked"
    : new Date(expiresAt).getTime() <= Date.now()
      ? "expired"
      : "active"
  const objectType = moveObjectType(object)
  if (process.env.NODE_ENV !== "production") {
    console.info("[MANDATE] loaded mandate object", {
      mandateId,
      objectType,
      packageId: PACKAGE_ID,
      packageMatches: isCurrentMandateObjectType(objectType),
    })
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
    budget: mistToSui(budgetCeiling),
    spent: mistToSui(currentSpent),
    protocols: ["DeepBook"],
    createdAt,
    expiresAt,
    txLimit: mistToSui(maxSingleTx),
    approvalThreshold: mistToSui(maxSingleTx),
    network: NETWORK === "mainnet" ? "mainnet" : "testnet",
    budgetCeilingSui: mistToSui(budgetCeiling),
    spentSui: mistToSui(currentSpent),
    maxSingleTxSui: mistToSui(maxSingleTx),
    protocol: "DeepBook",
    expiresLabel: status === "expired" ? "Expired" : stableExpiryLabel(expiresAt, status),
    createdAtDisplay: clientTimeDisplay(createdAt),
  }
}

function gasFeeSuiFromTransaction(tx?: SuiTransactionBlockResponse) {
  const gasUsed = tx?.effects?.gasUsed
  if (!gasUsed) {
    return undefined
  }

  const computationCost = BigInt(gasUsed.computationCost)
  const storageCost = BigInt(gasUsed.storageCost)
  const storageRebate = BigInt(gasUsed.storageRebate)
  const gasMist = computationCost + storageCost - storageRebate
  return Number(gasMist) / 1_000_000_000
}

function mapEventToActivity(
  event: SuiEvent,
  tx?: SuiTransactionBlockResponse
): ActivityEvent | null {
  const parsed = parsedJsonRecord(event)
  const mandateId = eventMandateId(event)
  if (!mandateId) {
    return null
  }

  const digest = eventDigest(event)
  const activityTimestampMs =
    eventTimestampMs(event) ??
    timestampMs(tx?.timestampMs) ??
    payloadTimestampMs(event)
  const timestamp = activityTimestampMs
    ? new Date(activityTimestampMs).toISOString()
    : ""
  const amountSui = mistToSui(
    parsed.amount ?? parsed.attempted_amount ?? parsed.budget_ceiling ?? 0
  )
  const gasFeeSui = gasFeeSuiFromTransaction(tx)
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
  }

  if (event.type.endsWith("CreatedEvent")) {
    return {
      ...base,
      kind: "mandate.created",
      amount: mistToSui(parsed.budget_ceiling),
      amountSui: mistToSui(parsed.budget_ceiling),
      message: `Mandate created with ${formatSui(mistToSui(parsed.budget_ceiling))} ceiling`,
      title: "Mandate created",
      status: "created",
    }
  }

  if (event.type.endsWith("ActivityEvent")) {
    return {
      ...base,
      kind: "tx.executed",
      amount: amountSui,
      amountSui,
      message: "Agent executed DeepBook PTB under mandate",
      title: "Agent executed DeepBook PTB",
      status: "success",
    }
  }

  if (event.type.endsWith("RevokeEvent")) {
    return {
      ...base,
      kind: "mandate.revoked",
      message: "Owner revoked mandate",
      title: "Owner revoked mandate",
      status: "revoked",
    }
  }

  if (event.type.endsWith("RejectEvent")) {
    return {
      ...base,
      kind: "tx.blocked",
      amount: amountSui,
      amountSui,
      message: "Policy rejected agent action",
      title: "Policy rejected action",
      status: "blocked",
    }
  }

  if (event.type.endsWith("BlockedEvent")) {
    const reason = eventReason(parsed.reason) ?? "blocked_by_policy"
    return {
      ...base,
      kind: "tx.blocked",
      amount: amountSui,
      amountSui,
      message: "Policy block recorded on-chain before DeepBook submission.",
      title: "Agent action blocked by Mandate policy",
      status: reason,
    }
  }

  return null
}

function uniqActivity(events: ActivityEvent[]) {
  const seen = new Set<string>()
  return events.filter((event) => {
    const key = `${event.digest ?? event.id}:${event.kind}:${event.mandateId}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function uniqById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false
    }
    seen.add(item.id)
    return true
  })
}

function uniqExecutions(executions: DeepBookOrder[]) {
  const seen = new Set<string>()
  return executions.filter((execution) => {
    const key = execution.digest || execution.id
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function activityToExecution(
  event: ActivityEvent,
  mandate?: Mandate
): DeepBookOrder | null {
  if (
    event.kind !== "tx.executed" ||
    event.protocol !== "DeepBook" ||
    !event.digest
  ) {
    return null
  }

  const timestamp = new Date(event.timestamp).getTime()
  return {
    id: `${event.digest}:${event.mandateId}`,
    mandateId: event.mandateId,
    mandateLabel: mandate?.label ?? event.agentName ?? "Mandate",
    digest: event.digest,
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    protocol: "DeepBook",
    pair: DEEPBOOK_POOL_KEY,
    side: "Buy",
    amountSui: event.amountSui ?? event.amount,
    status: "executed",
    gasFeeSui: event.gasFeeSui,
  }
}

function readStorageArray<T>(key: string): T[] {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch (error) {
    console.warn(`[MANDATE] failed to read ${key}`, error)
    return []
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`[MANDATE] failed to write ${key}`, error)
  }
}

function readStorageRecord<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") {
    return {}
  }

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, T>)
      : {}
  } catch (error) {
    console.warn(`[MANDATE] failed to read ${key}`, error)
    return {}
  }
}

function writeStorageRecord<T>(key: string, value: Record<string, T>) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn(`[MANDATE] failed to write ${key}`, error)
  }
}

function mergeMandateMetadata(
  mandate: Mandate,
  metadata?: UserMandateMetadata
): Mandate {
  if (!metadata) {
    return mandate
  }

  return {
    ...mandate,
    label: metadata.label || mandate.label,
    digest: mandate.digest || metadata.createdDigest,
    expiresLabel: ttlLabel(metadata.ttl) ?? mandate.expiresLabel,
  }
}

declare global {
  interface Window {
    __MANDATE_CLEAR_USER_DEMO_DATA__?: () => void
  }
}

export function MandateStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const account = useCurrentAccount()
  const [rpcMandates, setRpcMandates] = React.useState<Mandate[]>([])
  const [rpcActivity, setRpcActivity] = React.useState<ActivityEvent[]>([])
  const [userMandates, setUserMandates] = React.useState<Mandate[]>([])
  const [userActivity, setUserActivity] = React.useState<ActivityEvent[]>([])
  const [executionHistory, setExecutionHistory] = React.useState<DeepBookOrder[]>([])
  const [userMetadata, setUserMetadata] = React.useState<
    Record<string, UserMandateMetadata>
  >({})
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = React.useState(0)

  React.useEffect(() => {
    // Demo persistence only. P2.3 should replace this with Sui RPC/event
    // indexing for on-chain Mandate discovery.
    const storedMandates = uniqById(readStorageArray<Mandate>(USER_MANDATES_KEY))
    const storedActivity = uniqById(readStorageArray<ActivityEvent>(USER_ACTIVITY_KEY))
    const storedExecutions = uniqById(
      readStorageArray<DeepBookOrder>(USER_EXECUTIONS_KEY)
    )
    const storedMetadata = readStorageRecord<UserMandateMetadata>(USER_METADATA_KEY)
    const backfilledMetadata = storedMandates.reduce(
      (acc, mandate) => {
        acc[mandate.id] = acc[mandate.id] ?? {
          mandateId: mandate.id,
          label: mandate.label,
          createdDigest: mandate.digest,
          createdAt: mandate.createdAt,
          ttl: undefined,
        }
        return acc
      },
      { ...storedMetadata } as Record<string, UserMandateMetadata>
    )

    setUserMandates(storedMandates)
    setUserActivity(storedActivity)
    setExecutionHistory(
      storedExecutions.sort((a, b) => b.timestamp - a.timestamp)
    )
    setUserMetadata(backfilledMetadata)
    writeStorageRecord(USER_METADATA_KEY, backfilledMetadata)
  }, [])

  React.useEffect(() => {
    const missingObjectType = userMandates.filter(
      (mandate) => mandate.id && !mandate.objectType
    )
    if (missingObjectType.length === 0) {
      return
    }

    let cancelled = false

    async function backfillObjectTypes() {
      const entries = await Promise.all(
        missingObjectType.map(async (mandate) => {
          try {
            const object = await getMandateObject(mandate.id)
            return [mandate.id, moveObjectType(object)] as const
          } catch {
            return [mandate.id, undefined] as const
          }
        })
      )
      const objectTypes = new Map(
        entries.filter((entry): entry is readonly [string, string] =>
          Boolean(entry[1])
        )
      )

      if (cancelled || objectTypes.size === 0) {
        return
      }

      setUserMandates((prev) => {
        const next = prev.map((mandate) =>
          mandate.objectType || !objectTypes.has(mandate.id)
            ? mandate
            : { ...mandate, objectType: objectTypes.get(mandate.id) }
        )
        writeStorageArray(USER_MANDATES_KEY, next)
        return next
      })
    }

    void backfillObjectTypes()

    return () => {
      cancelled = true
    }
  }, [userMandates])

  React.useEffect(() => {
    const missingGasFee = executionHistory.filter(
      (execution) => execution.digest && typeof execution.gasFeeSui !== "number"
    )
    if (missingGasFee.length === 0) {
      return
    }

    let cancelled = false

    async function backfillGasFees() {
      const entries = await Promise.all(
        missingGasFee.map(async (execution) => {
          try {
            const tx = await getTransactionDetails(execution.digest)
            return [execution.digest, gasFeeSuiFromTransaction(tx)] as const
          } catch {
            return [execution.digest, undefined] as const
          }
        })
      )
      const gasFees = new Map(
        entries.filter((entry): entry is readonly [string, number] =>
          typeof entry[1] === "number"
        )
      )

      if (cancelled || gasFees.size === 0) {
        return
      }

      setExecutionHistory((prev) => {
        const next = prev.map((execution) =>
          typeof execution.gasFeeSui === "number" || !gasFees.has(execution.digest)
            ? execution
            : { ...execution, gasFeeSui: gasFees.get(execution.digest) }
        )
        writeStorageArray(USER_EXECUTIONS_KEY, next)
        return next
      })
    }

    void backfillGasFees()

    return () => {
      cancelled = true
    }
  }, [executionHistory])

  const refreshMandates = React.useCallback(() => {
    setRefreshVersion((version) => version + 1)
  }, [])

  React.useEffect(() => {
    let cancelled = false

    async function loadRpcMandates() {
      if (!account?.address) {
        setRpcMandates([])
        setRpcActivity([])
        setLoading(false)
        setError(null)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const createdEvents = await queryMandateCreatedEvents(account.address)
        const objectResults = await Promise.all(
          createdEvents.map(async (event) => {
            const mandateId = eventMandateId(event)
            if (!mandateId) {
              return null
            }

            try {
              return await getMandateObject(mandateId)
            } catch {
              return null
            }
          })
        )
        const createdMandates = createdEvents
          .map((event, index) => mapCreatedEventToMandate(event, objectResults[index] ?? undefined))
          .filter((mandate): mandate is Mandate => Boolean(mandate))
          .filter(
            (mandate) =>
              !mandate.ownerAddress ||
              mandate.ownerAddress.toLowerCase() === account.address.toLowerCase()
          )
        const mandateIds = createdMandates.map((mandate) => mandate.id)
        const [activityEvents, revokeEvents, rejectEvents, blockedEvents] = await Promise.all([
          Promise.all(mandateIds.map((id) => queryMandateActivityEvents(id))).then((pages) =>
            pages.flat()
          ),
          Promise.all(mandateIds.map((id) => queryMandateRevokeEvents(id))).then((pages) =>
            pages.flat()
          ),
          Promise.all(mandateIds.map((id) => queryMandateRejectEvents(id))).then((pages) =>
            pages.flat()
          ),
          Promise.all(mandateIds.map((id) => queryMandateBlockedEvents(id))).then((pages) =>
            pages.flat()
          ),
        ])
        const allRpcEvents = [
          ...createdEvents,
          ...activityEvents,
          ...revokeEvents,
          ...rejectEvents,
          ...blockedEvents,
        ]
        const txDigests = Array.from(
          new Set(allRpcEvents.map(eventDigest).filter(Boolean))
        )
        const txEntries = await Promise.all(
          txDigests.map(async (digest) => {
            try {
              return [digest, await getTransactionDetails(digest)] as const
            } catch {
              return [digest, undefined] as const
            }
          })
        )
        const txByDigest = new Map(txEntries)
        const rpcActivities = uniqActivity(
          allRpcEvents
            .map((event) =>
              mapEventToActivity(event, txByDigest.get(eventDigest(event)))
            )
            .filter((event): event is ActivityEvent => Boolean(event))
        )

        if (!cancelled) {
          setRpcMandates(uniqById(createdMandates))
          setRpcActivity(rpcActivities)
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught))
          setRpcMandates([])
          setRpcActivity([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadRpcMandates()

    return () => {
      cancelled = true
    }
  }, [account?.address, refreshVersion])

  const createMandate = React.useCallback((input: NewMandateInput): Mandate => {
    const agent = AGENTS.find((a) => a.id === input.agentId) ?? AGENTS[0]
    const now = new Date()
    const expires = new Date()
    if (input.ttlMs) {
      expires.setTime(now.getTime() + Number(input.ttlMs))
    } else {
      expires.setDate(expires.getDate() + input.durationDays)
    }

    const mandate: Mandate = {
      id: input.id ?? randomId("mnd"),
      label: input.label,
      agent,
      ownerAddress: input.ownerAddress,
      agentAddress: input.agentAddress,
      objectType: currentMandateObjectType(),
      digest: input.digest,
      status: "active",
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
    }
    const metadata: UserMandateMetadata = {
      mandateId: mandate.id,
      label: mandate.label,
      createdDigest: input.digest,
      createdAt: mandate.createdAt,
      ttl: input.ttlMs,
    }

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
      timeDisplay: "syncing",
    }

    setUserMandates((prev) => {
      const next = uniqById([mandate, ...prev])
      writeStorageArray(USER_MANDATES_KEY, next)
      return next
    })
    setUserActivity((prev) => {
      const next = uniqById([createdActivity, ...prev])
      writeStorageArray(USER_ACTIVITY_KEY, next)
      return next
    })
    setUserMetadata((prev) => {
      const next = { ...prev, [mandate.id]: metadata }
      writeStorageRecord(USER_METADATA_KEY, next)
      return next
    })
    return mandate
  }, [])

  const revokeMandate = React.useCallback(
    (id: string, digest?: string) => {
      setUserMandates((prev) => {
        const next = prev.map((m) =>
          m.id === id ? { ...m, status: "revoked" as const } : m
        )
        writeStorageArray(USER_MANDATES_KEY, next)
        return next
      })
      setRpcMandates((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m))
      )
      const target = [...rpcMandates, ...userMandates].find(
        (m) => m.id === id
      )
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
      }
      setRpcActivity((prev) => uniqActivity([revokedActivity, ...prev]))
      setUserActivity((prev) => {
        const next = uniqById([revokedActivity, ...prev])
        writeStorageArray(USER_ACTIVITY_KEY, next)
        return next
      })
    },
    [rpcMandates, userMandates]
  )

  const recordAgentExecution = React.useCallback(
    ({
      mandateId,
      digest,
      amountSui = 0.001,
      suiBalanceChange,
      gasFeeSui,
      pair = DEEPBOOK_POOL_KEY,
      side = "Buy",
    }: {
      mandateId: string
      digest?: string
      amountSui?: number
      suiBalanceChange?: number
      gasFeeSui?: number
      pair?: string
      side?: "Buy" | "Sell"
    }) => {
      const incrementSpent = (mandate: Mandate) =>
        mandate.id === mandateId
          ? {
              ...mandate,
              spent: Math.min(mandate.spent + amountSui, mandate.budget),
              spentSui: Math.min(
                (mandate.spentSui ?? mandate.spent) + amountSui,
                mandate.budgetCeilingSui ?? mandate.budget
              ),
            }
          : mandate

      setUserMandates((prev) => {
        const next = prev.map(incrementSpent)
        writeStorageArray(USER_MANDATES_KEY, next)
        return next
      })
      setRpcMandates((prev) => prev.map(incrementSpent))

      const target = [...rpcMandates, ...userMandates].find(
        (mandate) => mandate.id === mandateId
      )
      const executionActivity: ActivityEvent = {
        id: digest ? `${digest}:optimistic-agent:${mandateId}` : randomId("evt"),
        kind: "tx.executed",
        mandateId,
        agentName: target?.label ?? "Agent Wallet",
        protocol: target?.protocol ?? target?.protocols[0] ?? "DeepBook",
        amount: amountSui,
        amountSui,
        message: "Agent executed DeepBook PTB under mandate",
        timestamp: "",
        digest,
        title: "Agent executed DeepBook PTB",
        status: "success",
        timeDisplay: "syncing",
      }

      setRpcActivity((prev) => uniqActivity([executionActivity, ...prev]))
      setUserActivity((prev) => {
        const next = uniqById([executionActivity, ...prev])
        writeStorageArray(USER_ACTIVITY_KEY, next)
        return next
      })

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
        status: "executed",
        ...(typeof suiBalanceChange === "number" ? { suiBalanceChange } : {}),
        ...(typeof gasFeeSui === "number" ? { gasFeeSui } : {}),
      }

      setExecutionHistory((prev) => {
        const next = uniqById([executionRecord, ...prev]).sort(
          (a, b) => b.timestamp - a.timestamp
        )
        writeStorageArray(USER_EXECUTIONS_KEY, next)
        return next
      })
    },
    [rpcMandates, userMandates]
  )

  const recordBlockedAction = React.useCallback(
    ({
      mandateId,
      digest,
      amountSui,
      reason,
    }: {
      mandateId: string
      digest?: string
      amountSui?: number
      reason: string
    }) => {
      const target = [...rpcMandates, ...userMandates].find(
        (mandate) => mandate.id === mandateId
      )
      const blockedActivity: ActivityEvent = {
        id: digest ? `${digest}:optimistic-blocked:${mandateId}` : randomId("blocked"),
        kind: "tx.blocked",
        mandateId,
        agentName: target?.label ?? "Agent Wallet",
        protocol: target?.protocol ?? target?.protocols[0] ?? "DeepBook",
        amount: amountSui,
        amountSui,
        message: "Policy block recorded on-chain before DeepBook submission.",
        timestamp: "",
        digest,
        title: "Agent action blocked by Mandate policy",
        status: reason,
        timeDisplay: "syncing",
      }

      setRpcActivity((prev) => uniqActivity([blockedActivity, ...prev]))
      setUserActivity((prev) => {
        const next = uniqById([blockedActivity, ...prev])
        writeStorageArray(USER_ACTIVITY_KEY, next)
        return next
      })
    },
    [rpcMandates, userMandates]
  )

  const clearUserDemoData = React.useCallback(() => {
    window.localStorage.removeItem(USER_MANDATES_KEY)
    window.localStorage.removeItem(USER_ACTIVITY_KEY)
    window.localStorage.removeItem(USER_METADATA_KEY)
    window.localStorage.removeItem(USER_EXECUTIONS_KEY)
    setUserMandates([])
    setUserActivity([])
    setUserMetadata({})
    setExecutionHistory([])
  }, [])

  React.useEffect(() => {
    window.__MANDATE_CLEAR_USER_DEMO_DATA__ = clearUserDemoData
    return () => {
      delete window.__MANDATE_CLEAR_USER_DEMO_DATA__
    }
  }, [clearUserDemoData])

  const walletUserMandates = React.useMemo(() => {
    if (!account?.address) {
      return userMandates
    }

    return userMandates.filter(
      (mandate) =>
        !mandate.ownerAddress ||
        mandate.ownerAddress.toLowerCase() === account.address.toLowerCase()
    )
  }, [account?.address, userMandates])

  const walletUserActivity = React.useMemo(() => {
    const mandateIds = new Set(walletUserMandates.map((mandate) => mandate.id))
    return userActivity.filter((event) => mandateIds.has(event.mandateId))
  }, [userActivity, walletUserMandates])

  const mandates = React.useMemo(() => {
    const primary = account?.address
      ? [...rpcMandates, ...walletUserMandates]
      : []
    return uniqById(primary).map((mandate) =>
      normalizeMandateStatus(mergeMandateMetadata(mandate, userMetadata[mandate.id]))
    )
  }, [account?.address, rpcMandates, userMetadata, walletUserMandates])

  const activity = React.useMemo(() => {
    const primary = account?.address
      ? [...rpcActivity, ...walletUserActivity]
      : []
    const mandateById = new Map(mandates.map((mandate) => [mandate.id, mandate]))
    return uniqActivity(primary).map((event) => {
      if (!account?.address) {
        return event
      }

      const mandate = mandateById.get(event.mandateId)
      return {
        ...event,
        timeDisplay:
          event.timeDisplay === "just now" && typeof event.timestampMs !== "number"
            ? undefined
            : event.timeDisplay,
        agentName:
          mandate?.label ??
          (mandate?.agentAddress ? "Agent Wallet" : event.agentName),
      }
    })
  }, [account?.address, mandates, rpcActivity, walletUserActivity])

  const orders = React.useMemo(() => {
    if (!account?.address) {
      return []
    }

    const mandateById = new Map(mandates.map((mandate) => [mandate.id, mandate]))
    const activityExecutions = activity
      .map((event) => activityToExecution(event, mandateById.get(event.mandateId)))
      .filter((execution): execution is DeepBookOrder => Boolean(execution))
    const localExecutions: DeepBookOrder[] = executionHistory.map((execution) => {
      const status: ExecutionStatus =
        execution.status === "failed" ? "failed" : "executed"

      return {
        ...execution,
        pair: execution.pair ?? DEEPBOOK_POOL_KEY,
        side: execution.side ?? "Buy",
        amountSui: execution.amountSui ?? 0.001,
        status,
        mandateLabel:
          mandateById.get(execution.mandateId)?.label ?? execution.mandateLabel,
      }
    })

    return uniqExecutions([...activityExecutions, ...localExecutions]).sort(
      (a, b) => b.timestamp - a.timestamp
    )
  }, [account?.address, activity, executionHistory, mandates])

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
      recordAgentExecution,
      recordBlockedAction,
      refreshMandates,
      clearUserDemoData,
    ]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useMandateStore() {
  const ctx = React.useContext(StoreContext)
  if (!ctx) {
    throw new Error("useMandateStore must be used within MandateStoreProvider")
  }
  return ctx
}

export { ALL_PROTOCOLS, AGENTS }
