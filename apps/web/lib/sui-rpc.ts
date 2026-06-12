"use client"

import {
  SuiJsonRpcClient,
  getJsonRpcFullnodeUrl,
} from "@mysten/sui/jsonRpc"
import type {
  SuiEvent,
  SuiObjectResponse,
} from "@mysten/sui/jsonRpc"
import { NETWORK, PACKAGE_ID } from "@/lib/chain-config"

export const MANDATE_EVENT_TYPES = {
  created: `${PACKAGE_ID}::mandate::CreatedEvent`,
  activity: `${PACKAGE_ID}::mandate::ActivityEvent`,
  revoke: `${PACKAGE_ID}::mandate::RevokeEvent`,
  reject: `${PACKAGE_ID}::mandate::RejectEvent`,
  blocked: `${PACKAGE_ID}::mandate::BlockedEvent`,
} as const

let rpcClient: SuiJsonRpcClient | null = null

export function getSuiRpcClient() {
  if (!rpcClient) {
    rpcClient = new SuiJsonRpcClient({
      network: NETWORK,
      url: getJsonRpcFullnodeUrl(NETWORK),
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
