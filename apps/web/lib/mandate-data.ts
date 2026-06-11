import {
  CURRENT_MANDATE_ID,
  DEEPBOOK_POOL_KEY,
  NETWORK,
  VERIFIED_DEEPBOOK_DIGEST,
  formatConfigId,
} from "@/lib/chain-config"
import { DEMO_NOW_ISO } from "@/lib/format"

export type MandateStatus = "active" | "expired" | "revoked" | "paused"

export type Protocol = "DeepBook" | "Cetus" | "Scallop" | "Aftermath" | "Navi" | "SuiLend"

export type Agent = {
  id: string
  name: string
  handle: string
}

export type Mandate = {
  id: string
  label: string
  agent: Agent
  ownerAddress?: string
  agentAddress?: string
  digest?: string
  status: MandateStatus
  /** total budget ceiling in SUI */
  budget: number
  /** spent so far in SUI */
  spent: number
  protocols: Protocol[]
  /** ISO timestamp */
  createdAt: string
  /** ISO timestamp */
  expiresAt: string
  /** max single transaction in SUI */
  txLimit: number
  /** requests requiring approval above this SUI value */
  approvalThreshold: number
  network: "mainnet" | "testnet"
  budgetCeilingSui?: number
  spentSui?: number
  maxSingleTxSui?: number
  protocol?: Protocol
  expiresLabel?: string
  createdAtDisplay?: string
}

export type ActivityKind =
  | "tx.executed"
  | "tx.blocked"
  | "mandate.created"
  | "mandate.revoked"
  | "budget.warning"
  | "approval.requested"

export type ActivityEvent = {
  id: string
  kind: ActivityKind
  mandateId: string
  agentName: string
  protocol?: Protocol
  /** SUI value */
  amount?: number
  message: string
  /** ISO timestamp */
  timestamp: string
  digest?: string
  title?: string
  status?: string
  amountSui?: number
  timeDisplay?: string
}

export type OrderSide = "buy" | "sell"
export type OrderStatus = "filled" | "open" | "partial" | "cancelled"

export type DeepBookOrder = {
  id: string
  mandateId: string
  agentName: string
  pair: string
  side: OrderSide
  price: number
  size: number
  filled: number
  status: OrderStatus
  timestamp: string
}

export const AGENTS: Agent[] = [
  { id: "ag_treasury", name: "Treasury Rebalancer", handle: "treasury-bot" },
  { id: "ag_market", name: "Market Maker", handle: "mm-deepbook" },
  { id: "ag_yield", name: "Yield Optimizer", handle: "yield-router" },
  { id: "ag_dca", name: "DCA Executor", handle: "dca-runner" },
  { id: "ag_arb", name: "Arbitrage Scout", handle: "arb-scout" },
]

export const ALL_PROTOCOLS: Protocol[] = ["DeepBook"]

function iso(daysFromNow: number, hoursOffset = 0): string {
  const d = new Date(DEMO_NOW_ISO)
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(d.getHours() + hoursOffset)
  return d.toISOString()
}

const MOCK_NETWORK = NETWORK as Mandate["network"]
const VERIFIED_DIGEST_SHORT = formatConfigId(VERIFIED_DEEPBOOK_DIGEST, 6, 5)
const MANDATE_ID_SHORT = formatConfigId(CURRENT_MANDATE_ID)

export const SEED_MANDATES: Mandate[] = [
  {
    id: "mnd_8Fk2Lp",
    label: `${DEEPBOOK_POOL_KEY} swap mandate`,
    agent: AGENTS[1],
    status: "active",
    budget: 1,
    spent: 0.002,
    protocols: ["DeepBook"],
    createdAt: iso(-12),
    expiresAt: iso(1),
    txLimit: 0.01,
    approvalThreshold: 0.01,
    network: MOCK_NETWORK,
  },
  {
    id: "mnd_3Qr9Xa",
    label: "DeepBook quote-side test",
    agent: AGENTS[0],
    status: "revoked",
    budget: 0.5,
    spent: 0.001,
    protocols: ["DeepBook"],
    createdAt: iso(-30),
    expiresAt: iso(60),
    txLimit: 0.01,
    approvalThreshold: 0.01,
    network: MOCK_NETWORK,
  },
  {
    id: "mnd_7Vd1Mn",
    label: "DeepBook budget breach demo",
    agent: AGENTS[2],
    status: "expired",
    budget: 0.02,
    spent: 0.02,
    protocols: ["DeepBook"],
    createdAt: iso(-6),
    expiresAt: iso(2),
    txLimit: 0.01,
    approvalThreshold: 0.01,
    network: MOCK_NETWORK,
  },
  {
    id: "mnd_2Hs5Wz",
    label: "DeepBook paused agent wallet",
    agent: AGENTS[3],
    status: "paused",
    budget: 0.1,
    spent: 0.003,
    protocols: ["DeepBook"],
    createdAt: iso(-20),
    expiresAt: iso(40),
    txLimit: 0.01,
    approvalThreshold: 0.01,
    network: MOCK_NETWORK,
  },
  {
    id: "mnd_9Bt4Kc",
    label: "DeepBook expired PTB test",
    agent: AGENTS[4],
    status: "expired",
    budget: 0.05,
    spent: 0.049,
    protocols: ["DeepBook"],
    createdAt: iso(-45),
    expiresAt: iso(-3),
    txLimit: 0.01,
    approvalThreshold: 0.01,
    network: MOCK_NETWORK,
  },
  {
    id: "mnd_5Np8Rd",
    label: "DeepBook owner revocation demo",
    agent: AGENTS[2],
    status: "revoked",
    budget: 0.1,
    spent: 0.001,
    protocols: ["DeepBook"],
    createdAt: iso(-60),
    expiresAt: iso(30),
    txLimit: 0.01,
    approvalThreshold: 0.01,
    network: MOCK_NETWORK,
  },
]

export const SEED_ACTIVITY: ActivityEvent[] = [
  {
    id: "evt_01",
    kind: "mandate.created",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    protocol: "DeepBook",
    amount: 0.001,
    message: `Mandate created for DeepBook-only ${DEEPBOOK_POOL_KEY} execution`,
    timestamp: iso(0, -1),
    digest: MANDATE_ID_SHORT,
  },
  {
    id: "evt_02",
    kind: "tx.executed",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    protocol: "DeepBook",
    amount: 0.001,
    message: "Agent authorized spend through Mandate policy object",
    timestamp: iso(0, -2),
    digest: VERIFIED_DIGEST_SHORT,
  },
  {
    id: "evt_03",
    kind: "tx.executed",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    protocol: "DeepBook",
    amount: 0.001,
    message: `DeepBook swap executed on ${DEEPBOOK_POOL_KEY} via PTB`,
    timestamp: iso(0, -3),
    digest: VERIFIED_DIGEST_SHORT,
  },
  {
    id: "evt_04",
    kind: "tx.blocked",
    mandateId: "mnd_7Vd1Mn",
    agentName: "Yield Optimizer",
    protocol: "DeepBook",
    amount: 0.2,
    message: "Budget breach blocked before DeepBook order submission",
    timestamp: iso(0, -5),
  },
  {
    id: "evt_05",
    kind: "mandate.revoked",
    mandateId: "mnd_5Np8Rd",
    agentName: "Yield Optimizer",
    protocol: "DeepBook",
    message: "Owner revoked mandate; agent actions blocked by Move policy",
    timestamp: iso(-1, -2),
  },
  {
    id: "evt_06",
    kind: "tx.executed",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    protocol: "DeepBook",
    amount: 0.001,
    message: "On-chain ActivityEvent emitted for DeepBook authorization",
    timestamp: iso(-1, -6),
    digest: VERIFIED_DIGEST_SHORT,
  },
  {
    id: "evt_07",
    kind: "mandate.revoked",
    mandateId: "mnd_5Np8Rd",
    agentName: "Yield Optimizer",
    protocol: "DeepBook",
    message: "Owner revoked mandate",
    timestamp: iso(-2),
  },
  {
    id: "evt_08",
    kind: "tx.executed",
    mandateId: "mnd_2Hs5Wz",
    agentName: "DCA Executor",
    protocol: "DeepBook",
    amount: 0.001,
    message: `DeepBook only policy checked for ${DEEPBOOK_POOL_KEY} route`,
    timestamp: iso(-2, -4),
    digest: "0x7d12…aa55",
  },
]

export const SEED_ORDERS: DeepBookOrder[] = [
  {
    id: "ord_1001",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    pair: DEEPBOOK_POOL_KEY,
    side: "buy",
    price: 0.001,
    size: 0.001,
    filled: 0.001,
    status: "filled",
    timestamp: iso(0, -1),
  },
  {
    id: "ord_1002",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    pair: DEEPBOOK_POOL_KEY,
    side: "sell",
    price: 0.001,
    size: 0.001,
    filled: 0.001,
    status: "filled",
    timestamp: iso(0, -2),
  },
  {
    id: "ord_1003",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    pair: DEEPBOOK_POOL_KEY,
    side: "buy",
    price: 0.001,
    size: 0.001,
    filled: 0,
    status: "open",
    timestamp: iso(0, -3),
  },
  {
    id: "ord_1004",
    mandateId: "mnd_9Bt4Kc",
    agentName: "Arbitrage Scout",
    pair: DEEPBOOK_POOL_KEY,
    side: "sell",
    price: 0.001,
    size: 0.001,
    filled: 0.001,
    status: "filled",
    timestamp: iso(-1, -1),
  },
  {
    id: "ord_1005",
    mandateId: "mnd_8Fk2Lp",
    agentName: "Market Maker",
    pair: DEEPBOOK_POOL_KEY,
    side: "buy",
    price: 0.001,
    size: 0.001,
    filled: 0,
    status: "cancelled",
    timestamp: iso(-1, -4),
  },
  {
    id: "ord_1006",
    mandateId: "mnd_9Bt4Kc",
    agentName: "Arbitrage Scout",
    pair: DEEPBOOK_POOL_KEY,
    side: "buy",
    price: 0.001,
    size: 0.001,
    filled: 0.001,
    status: "filled",
    timestamp: iso(-2, -2),
  },
]
