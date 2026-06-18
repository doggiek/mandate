"use client"

import {
  SuiJsonRpcClient,
} from "@mysten/sui/jsonRpc"
import type {
  SuiEvent,
  SuiObjectResponse,
  SuiTransactionBlockResponse,
} from "@mysten/sui/jsonRpc"
import {
  NETWORK,
  PACKAGE_ID,
  PACKAGE_ID_SOURCE,
  getRpcUrl,
  type SuiNetwork,
} from "@/lib/chain-config"

const PACKAGE_ID_PATTERN = /^0x[a-fA-F0-9]{64}$/

export const MANDATE_EVENT_TYPES = {
  created: `${PACKAGE_ID}::mandate::CreatedEvent`,
  activity: `${PACKAGE_ID}::mandate::ActivityEvent`,
  revoke: `${PACKAGE_ID}::mandate::RevokeEvent`,
  reject: `${PACKAGE_ID}::mandate::RejectEvent`,
  blocked: `${PACKAGE_ID}::mandate::BlockedEvent`,
  withdraw: `${PACKAGE_ID}::mandate::WithdrawEvent`,
} as const

let rpcClient: SuiJsonRpcClient | null = null
let loggedRpcConfig = false

function browserRpcUrl() {
  return typeof window === "undefined" ? getRpcUrl() : "/api/sui-rpc"
}

function networkPackageEnvName(network: SuiNetwork) {
  return `NEXT_PUBLIC_PACKAGE_ID_${network.toUpperCase()}`
}

function assertPackageConfig() {
  if (!PACKAGE_ID) {
    throw new Error(`Missing ${networkPackageEnvName(NETWORK)}`)
  }

  if (!PACKAGE_ID_PATTERN.test(PACKAGE_ID)) {
    throw new Error(
      `Invalid ${networkPackageEnvName(NETWORK)}: expected a 32-byte 0x package id.`
    )
  }
}

export function getSuiRpcClient() {
  assertPackageConfig()

  if (!rpcClient) {
    if (process.env.NODE_ENV !== "production" && !loggedRpcConfig) {
      console.info("[MANDATE] RPC config", {
        network: NETWORK,
        rpcUrl: browserRpcUrl(),
        upstreamRpcUrl: getRpcUrl(),
        packageId: PACKAGE_ID,
        packageIdSource: PACKAGE_ID_SOURCE,
      })
      loggedRpcConfig = true
    }

    rpcClient = new SuiJsonRpcClient({
      network: NETWORK,
      url: browserRpcUrl(),
    })
  }

  return rpcClient
}

function parsedJsonRecord(event: SuiEvent) {
  return event.parsedJson && typeof event.parsedJson === "object"
    ? (event.parsedJson as Record<string, unknown>)
    : {}
}

function eventOwner(event: SuiEvent) {
  const parsed = parsedJsonRecord(event)
  return typeof parsed.owner === "string" ? parsed.owner : null
}

async function queryEventsByType(type: string) {
  assertPackageConfig()

  const response = await getSuiRpcClient().queryEvents({
    query: { MoveEventType: type },
    limit: 50,
    order: "descending",
  })

  return response.data
}

export async function queryMandateCreatedEvents(ownerAddress?: string) {
  const events = await queryEventsByType(MANDATE_EVENT_TYPES.created)

  if (!ownerAddress) {
    return events
  }

  return events.filter((event) => {
    const owner = eventOwner(event)

    // TODO(P2.3): if an older CreatedEvent shape does not include owner,
    // fall back to object content filtering after indexing all event mandate ids.
    return owner ? owner.toLowerCase() === ownerAddress.toLowerCase() : true
  })
}

export async function queryMandateActivityEvents(mandateId?: string) {
  const events = await queryEventsByType(MANDATE_EVENT_TYPES.activity)

  if (!mandateId) {
    return events
  }

  return events.filter((event) => {
    const parsed = parsedJsonRecord(event)
    return parsed.mandate_id === mandateId || parsed.mandateId === mandateId
  })
}

export async function queryMandateRevokeEvents(mandateId?: string) {
  const events = await queryEventsByType(MANDATE_EVENT_TYPES.revoke)

  if (!mandateId) {
    return events
  }

  return events.filter((event) => {
    const parsed = parsedJsonRecord(event)
    return parsed.mandate_id === mandateId || parsed.mandateId === mandateId
  })
}

export async function queryMandateRejectEvents(mandateId?: string) {
  const events = await queryEventsByType(MANDATE_EVENT_TYPES.reject)

  if (!mandateId) {
    return events
  }

  return events.filter((event) => {
    const parsed = parsedJsonRecord(event)
    return parsed.mandate_id === mandateId || parsed.mandateId === mandateId
  })
}

export async function queryMandateBlockedEvents(mandateId?: string) {
  const events = await queryEventsByType(MANDATE_EVENT_TYPES.blocked)

  if (!mandateId) {
    return events
  }

  return events.filter((event) => {
    const parsed = parsedJsonRecord(event)
    return parsed.mandate_id === mandateId || parsed.mandateId === mandateId
  })
}

export async function queryMandateWithdrawEvents(mandateId?: string) {
  const events = await queryEventsByType(MANDATE_EVENT_TYPES.withdraw)

  if (!mandateId) {
    return events
  }

  return events.filter((event) => {
    const parsed = parsedJsonRecord(event)
    return parsed.mandate_id === mandateId || parsed.mandateId === mandateId
  })
}

export async function getMandateObject(
  mandateId: string
): Promise<SuiObjectResponse> {
  return getSuiRpcClient().getObject({
    id: mandateId,
    options: {
      showContent: true,
      showOwner: true,
      showPreviousTransaction: true,
    },
  })
}

export async function getTransactionDetails(
  digest: string
): Promise<SuiTransactionBlockResponse> {
  return getSuiRpcClient().getTransactionBlock({
    digest,
    options: {
      showBalanceChanges: true,
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
  })
}
