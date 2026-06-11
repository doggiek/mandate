"use client"

import * as React from "react"
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

export type NewMandateInput = {
  id?: string
  label: string
  agentId: string
  budget: number
  txLimit: number
  approvalThreshold: number
  protocols: Protocol[]
  durationDays: number
  network: "mainnet" | "testnet"
}

type StoreContextValue = {
  mandates: Mandate[]
  activity: ActivityEvent[]
  orders: DeepBookOrder[]
  createMandate: (input: NewMandateInput) => Mandate
  revokeMandate: (id: string) => void
  togglePause: (id: string) => void
}

const StoreContext = React.createContext<StoreContextValue | null>(null)

function randomId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

export function MandateStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [mandates, setMandates] = React.useState<Mandate[]>(SEED_MANDATES)
  const [activity, setActivity] = React.useState<ActivityEvent[]>(SEED_ACTIVITY)
  const [orders] = React.useState<DeepBookOrder[]>(SEED_ORDERS)

  const createMandate = React.useCallback((input: NewMandateInput): Mandate => {
    const agent = AGENTS.find((a) => a.id === input.agentId) ?? AGENTS[0]
    const now = new Date()
    const expires = new Date()
    expires.setDate(expires.getDate() + input.durationDays)

    const mandate: Mandate = {
      id: input.id ?? randomId("mnd"),
      label: input.label,
      agent,
      status: "active",
      budget: input.budget,
      spent: 0,
      protocols: input.protocols,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      txLimit: input.txLimit,
      approvalThreshold: input.approvalThreshold,
      network: input.network,
    }

    setMandates((prev) => [mandate, ...prev])
    setActivity((prev) => [
      {
        id: randomId("evt"),
        kind: "mandate.created",
        mandateId: mandate.id,
        agentName: agent.name,
        message: `Mandate created with ${new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(input.budget)} ceiling`,
        timestamp: now.toISOString(),
      },
      ...prev,
    ])
    return mandate
  }, [])

  const revokeMandate = React.useCallback(
    (id: string) => {
      setMandates((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status: "revoked" } : m))
      )
      const target = mandates.find((m) => m.id === id)
      setActivity((prev) => [
        {
          id: randomId("evt"),
          kind: "mandate.revoked",
          mandateId: id,
          agentName: target?.agent.name ?? "Agent",
          message: "Mandate revoked by owner — all authority withdrawn",
          timestamp: new Date().toISOString(),
        },
        ...prev,
      ])
    },
    [mandates]
  )

  const togglePause = React.useCallback((id: string) => {
    setMandates((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              status: m.status === "paused" ? "active" : m.status === "active" ? "paused" : m.status,
            }
          : m
      )
    )
  }, [])

  const value = React.useMemo(
    () => ({ mandates, activity, orders, createMandate, revokeMandate, togglePause }),
    [mandates, activity, orders, createMandate, revokeMandate, togglePause]
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
