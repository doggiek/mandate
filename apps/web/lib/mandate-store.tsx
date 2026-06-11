"use client"

import * as React from "react"
import { useCurrentAccount } from "@mysten/dapp-kit"
import { NETWORK } from "@/lib/chain-config"
import {
  AGENTS,
  ALL_PROTOCOLS,
  SEED_ACTIVITY,
  SEED_MANDATES,
  SEED_ORDERS,
  type ActivityEvent,
  type DeepBookOrder,
  type Mandate,
  type Protocol,
} from "@/lib/mandate-data"
import { formatSui, stableExpiryLabel } from "@/lib/format"
import {
  getMandateObject,
  queryMandateActivityEvents,
  queryMandateCreatedEvents,
  queryMandateRejectEvents,
  queryMandateRevokeEvents,
} from "@/lib/sui-rpc"
import type { SuiEvent, SuiObjectResponse } from "@mysten/sui/jsonRpc"

const USER_MANDATES_KEY = `mandate:userMandates:${NETWORK}`
const USER_ACTIVITY_KEY = `mandate:userActivity:${NETWORK}`

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
  }) => void
  togglePause: (id: string) => void
  refreshMandates: () => void
  clearUserDemoData: () => void
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

function toggledStatus(status: Mandate["status"]): Mandate["status"] {
  if (status === "paused") return "active"
  if (status === "active") return "paused"
  return status
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

function moveObjectFields(response: SuiObjectResponse) {
  const content = response.data?.content
  if (!content || content.dataType !== "moveObject") {
    return {}
  }

  return "fields" in content && typeof content.fields === "object"
    ? (content.fields as Record<string, unknown>)
    : {}
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
  const expiresAtMs = Number(parsed.expires_at_ms ?? objectFields.expires_at_ms ?? 0)
  const isActive = objectFields.is_active !== false
  const currentSpent = objectFields.current_spent ?? 0
  const budgetCeiling = parsed.budget_ceiling ?? objectFields.budget_ceiling ?? 0
  const maxSingleTx = parsed.max_single_tx ?? objectFields.max_single_tx ?? 0
  const expiresAt = expiresAtMs > 0
    ? new Date(expiresAtMs).toISOString()
    : new Date(Number(event.timestampMs ?? Date.now()) + 86_400_000).toISOString()
  const status: Mandate["status"] = !isActive
    ? "revoked"
    : Date.now() > new Date(expiresAt).getTime()
      ? "expired"
      : "active"

  return {
    id: mandateId,
    label: "DeepBook Mandate",
    agent: AGENTS[1],
    ownerAddress: typeof owner === "string" ? owner : undefined,
    agentAddress: typeof agent === "string" ? agent : undefined,
    digest: eventDigest(event),
    status,
    budget: mistToSui(budgetCeiling),
    spent: mistToSui(currentSpent),
    protocols: ["DeepBook"],
    createdAt: parsed.created_at_ms
      ? new Date(Number(parsed.created_at_ms)).toISOString()
      : new Date(Number(event.timestampMs ?? Date.now())).toISOString(),
    expiresAt,
    txLimit: mistToSui(maxSingleTx),
    approvalThreshold: mistToSui(maxSingleTx),
    network: NETWORK === "mainnet" ? "mainnet" : "testnet",
    budgetCeilingSui: mistToSui(budgetCeiling),
    spentSui: mistToSui(currentSpent),
    maxSingleTxSui: mistToSui(maxSingleTx),
    protocol: "DeepBook",
    expiresLabel: stableExpiryLabel(expiresAt, status),
    createdAtDisplay: event.timestampMs
      ? clientTimeDisplay(new Date(Number(event.timestampMs)).toISOString())
      : undefined,
  }
}

function mapEventToActivity(event: SuiEvent): ActivityEvent | null {
  const parsed = parsedJsonRecord(event)
  const mandateId = eventMandateId(event)
  if (!mandateId) {
    return null
  }

  const digest = eventDigest(event)
  const timestamp = event.timestampMs
    ? new Date(Number(event.timestampMs)).toISOString()
    : new Date().toISOString()
  const amountSui = mistToSui(parsed.amount ?? parsed.budget_ceiling ?? 0)
  const base = {
    id: `${digest}:${event.type}:${mandateId}`,
    mandateId,
    agentName: "Market Maker",
    protocol: "DeepBook" as const,
    timestamp,
    digest,
    timeDisplay: clientTimeDisplay(timestamp),
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
      message: "Agent authorized spend through Mandate policy object",
      title: "Agent authorized spend",
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
  const [seedMandates, setSeedMandates] = React.useState<Mandate[]>(SEED_MANDATES)
  const [seedActivity] = React.useState<ActivityEvent[]>(SEED_ACTIVITY)
  const [rpcMandates, setRpcMandates] = React.useState<Mandate[]>([])
  const [rpcActivity, setRpcActivity] = React.useState<ActivityEvent[]>([])
  const [userMandates, setUserMandates] = React.useState<Mandate[]>([])
  const [userActivity, setUserActivity] = React.useState<ActivityEvent[]>([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = React.useState(0)
  const [orders] = React.useState<DeepBookOrder[]>(SEED_ORDERS)

  React.useEffect(() => {
    // Demo persistence only. P2.3 should replace this with Sui RPC/event
    // indexing for on-chain Mandate discovery.
    setUserMandates(uniqById(readStorageArray<Mandate>(USER_MANDATES_KEY)))
    setUserActivity(uniqById(readStorageArray<ActivityEvent>(USER_ACTIVITY_KEY)))
  }, [])

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
        const [activityEvents, revokeEvents, rejectEvents] = await Promise.all([
          Promise.all(mandateIds.map((id) => queryMandateActivityEvents(id))).then((pages) =>
            pages.flat()
          ),
          Promise.all(mandateIds.map((id) => queryMandateRevokeEvents(id))).then((pages) =>
            pages.flat()
          ),
          Promise.all(mandateIds.map((id) => queryMandateRejectEvents(id))).then((pages) =>
            pages.flat()
          ),
        ])
        const rpcActivities = uniqActivity(
          [...createdEvents, ...activityEvents, ...revokeEvents, ...rejectEvents]
            .map(mapEventToActivity)
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

    const createdActivity: ActivityEvent = {
      id: randomId("evt"),
      kind: "mandate.created",
      mandateId: mandate.id,
      agentName: agent.name,
      protocol: input.protocols[0],
      amount: input.budget,
      message: `Mandate created with ${formatSui(input.budget)} ceiling`,
      timestamp: now.toISOString(),
      digest: input.digest,
      title: "Mandate created",
      status: "created",
      amountSui: input.budget,
      timeDisplay: "just now",
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
      setSeedMandates((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m))
      )
      setRpcMandates((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m))
      )
      const target = [...rpcMandates, ...userMandates, ...seedMandates].find(
        (m) => m.id === id
      )
      const revokedActivity: ActivityEvent = {
        id: digest ? `${digest}:optimistic-revoke:${id}` : randomId("evt"),
        kind: "mandate.revoked",
        mandateId: id,
        agentName: target?.agent.name ?? "Agent",
        protocol: target?.protocol ?? target?.protocols[0],
        message: "Owner revoked mandate",
        timestamp: new Date().toISOString(),
        digest,
        title: "Owner revoked mandate",
        status: "revoked",
        timeDisplay: "just now",
      }
      setRpcActivity((prev) => uniqActivity([revokedActivity, ...prev]))
      setUserActivity((prev) => {
        const next = uniqById([revokedActivity, ...prev])
        writeStorageArray(USER_ACTIVITY_KEY, next)
        return next
      })
    },
    [rpcMandates, seedMandates, userMandates]
  )

  const recordAgentExecution = React.useCallback(
    ({
      mandateId,
      digest,
      amountSui = 0.001,
    }: {
      mandateId: string
      digest?: string
      amountSui?: number
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
      setSeedMandates((prev) => prev.map(incrementSpent))

      const target = [...rpcMandates, ...userMandates, ...seedMandates].find(
        (mandate) => mandate.id === mandateId
      )
      const executionActivity: ActivityEvent = {
        id: digest ? `${digest}:optimistic-agent:${mandateId}` : randomId("evt"),
        kind: "tx.executed",
        mandateId,
        agentName: target?.agent.name ?? "Market Maker",
        protocol: target?.protocol ?? target?.protocols[0] ?? "DeepBook",
        amount: amountSui,
        amountSui,
        message: "Agent authorized spend through Mandate policy object",
        timestamp: new Date().toISOString(),
        digest,
        title: "Agent authorized spend",
        status: "success",
        timeDisplay: "just now",
      }

      setRpcActivity((prev) => uniqActivity([executionActivity, ...prev]))
      setUserActivity((prev) => {
        const next = uniqById([executionActivity, ...prev])
        writeStorageArray(USER_ACTIVITY_KEY, next)
        return next
      })
    },
    [rpcMandates, seedMandates, userMandates]
  )

  const togglePause = React.useCallback((id: string) => {
    setUserMandates((prev) => {
      const next = prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: toggledStatus(m.status),
            }
          : m
      )
      writeStorageArray(USER_MANDATES_KEY, next)
      return next
    })
    setSeedMandates((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: toggledStatus(m.status),
            }
          : m
      )
    )
  }, [])

  const clearUserDemoData = React.useCallback(() => {
    window.localStorage.removeItem(USER_MANDATES_KEY)
    window.localStorage.removeItem(USER_ACTIVITY_KEY)
    setUserMandates([])
    setUserActivity([])
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
      : [...walletUserMandates, ...seedMandates]
    return uniqById(primary)
  }, [account?.address, rpcMandates, seedMandates, walletUserMandates])

  const activity = React.useMemo(() => {
    const primary = account?.address
      ? [...rpcActivity, ...walletUserActivity]
      : [...walletUserActivity, ...seedActivity]
    return uniqActivity(primary)
  }, [account?.address, rpcActivity, seedActivity, walletUserActivity])

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
      togglePause,
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
      togglePause,
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
