# Mandate Architecture

Mandate is an Autonomous Agent Wallet on Sui. The system separates ownership,
policy, execution, and proof:

```text
Owner Wallet
  signs Create Mandate / Revoke Mandate
  funds Mandate vault
        |
        v
Move Mandate Object
  stores owner, backend agent, budget, spent, max tx, expiry, revoke state
  holds vault balance
  enforces policy before spend leaves the vault
        |
        v
Backend Trading Agent
  signs execution PTBs with BACKEND_AGENT_PRIVATE_KEY
  pays gas
  cannot bypass Mandate policy
        |
        v
DeepBook Route
  current executable route: SUI vault -> DEEP via DEEP_SUI
        |
        v
On-chain Proof
  ActivityEvent / BlockedEvent
  DeepBook execution attempt / fill record where applicable
  digest links in Console
```

## Components

### Move Mandate Object

The Move contract defines the on-chain authority object. The current vault model
lets the Owner deposit a SUI budget into the Mandate when it is created.

The Mandate policy checks:

- sender is the authorized backend Agent
- Mandate is active
- Mandate has not expired
- requested amount is below max single transaction
- requested amount is within remaining budget
- requested amount is available in the vault balance
- protocol scope is DeepBook
- spend asset matches the Mandate vault type

If the check passes, the Mandate releases a coin for the PTB and emits activity.
If the action is intentionally blocked, the contract records an on-chain blocked
event without submitting a DeepBook order.

### Backend Trading Agent Signer

The backend Agent uses `BACKEND_AGENT_PRIVATE_KEY` to sign autonomous execution
transactions. It pays gas, but it does not provide swap input funds. Swap input
comes from the Mandate vault.

This key is a platform executor key, not a user wallet private key.

### Next.js Console

The console provides:

- wallet connection for the Owner
- Mandate creation and revocation
- Automation setup
- rule-based Signal Engine views
- Activity Log
- DeepBook Orders
- Mandate detail sheets

Owner-signed actions are limited to creating and revoking authority. Execution
actions are submitted by the backend Agent.

### Signal Engine

The Signal Engine is rule-based today. It evaluates live or demo-compatible
signals and returns a decision:

```text
waiting | triggered
```

Current executable strategy:

- DEEP Momentum
- signal: DEEP/SUI quote
- action: buy DEEP with SUI
- route: DEEP_SUI

Planned signal types include volatility guard, whale flow, and AI risk signal.
The project does not currently claim AI price prediction.

### Policy Gate

The Policy Gate is enforced on-chain by Move. Frontend previews help the user
understand what will pass or block, but the final authority is the Mandate
object.

For blocked strategies, the backend Agent can record an on-chain blocked event
without submitting a DeepBook order.

### DeepBook Execution Route

The current executable route is:

```text
SUI vault -> DEEP_SUI pool -> DEEP output -> Owner wallet
```

The PTB flow is:

1. backend Agent signs the transaction
2. Mandate releases SUI from the Owner-funded vault
3. DeepBook swap is called
4. output and residual coins are transferred to the Owner
5. ActivityEvent and execution/fill proof are shown in the console

### Activity / Order Indexing

The console reads chain data through Sui RPC and maintains session-local
optimistic records where useful. Activity and order views are scoped by current
Owner wallet and current package id.

Activity shows:

- Mandate created
- Agent executed DeepBook PTB
- Agent action blocked by Mandate policy
- Owner revoked mandate

Orders show DeepBook execution attempts and fill status where applicable.
Blocked actions do not create DeepBook orders. No-fill attempts may create
execution and activity proof, but they are not described as successful fills.

## Multi-asset Framework

The contract and app framework include generic AssetMandate<T> support. USDC
routes are disabled in the current UI until a matching registered DeepBook pool
exists for the exact spend coin type.

Current testnet limitation:

- wallet-held DUSDC was investigated
- Circle testnet USDC was investigated
- no registered fillable DeepBook testnet pool was found for those exact coin
  types
- USDC routes are disabled

Therefore the live executable route remains DEEP_SUI.
