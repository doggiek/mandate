export type MandateStatus = "active" | "expired" | "revoked"

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

export type ExecutionSide = "Buy" | "Sell"
export type ExecutionStatus = "executed" | "success" | "failed"

export type DeepBookOrder = {
  id: string
  mandateId: string
  mandateLabel: string
  digest: string
  timestamp: number
  protocol: "DeepBook"
  pair: string
  side: ExecutionSide
  amountSui?: number
  status: ExecutionStatus
  suiBalanceChange?: number
}

export const AGENTS: Agent[] = [
  { id: "ag_deepbook", name: "Agent Wallet", handle: "backend-agent" },
]

export const ALL_PROTOCOLS: Protocol[] = ["DeepBook"]
