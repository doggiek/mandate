# Demo Flow

This script is written for the current live demo:

```text
SUI vault -> DEEP via DeepBook DEEP_SUI route
```

The narrative is:

```text
Create Mandate
  -> Select strategy
  -> Live signal check
  -> Policy gate
  -> Backend Agent PTB
  -> DeepBook execution
  -> On-chain proof
```

## 1. Create Mandate

Open the console and connect the Owner wallet.

Create a Mandate with:

- spend asset: SUI vault
- strategy target: DeepBook
- budget ceiling: a small SUI amount for testnet
- max single transaction: below or equal to the budget
- expiry: short demo-friendly duration

Explain:

> The Owner signs once to create a revocable Mandate. The Mandate holds the
> budget in a vault and authorizes the backend Trading Agent to spend only within
> the on-chain limits.

## 2. Configure DEEP Momentum

Go to Automation and select the active Mandate.

Choose:

- strategy: DEEP Momentum
- signal: DEEP/SUI quote
- action: Buy DEEP with SUI
- route: DEEP_SUI
- execution amount: an amount that fits the max tx and remaining budget

Explain:

> The Signal Engine is rule-based. It checks live quote conditions and only
> triggers execution when the configured threshold is met.

## 3. Test Agent

Click Test Agent.

Show the Agent Console:

- policy passed
- DeepBook buy PTB submitted
- digest returned
- fill status shown

Explain:

> The Owner wallet does not sign this execution. The backend Trading Agent signs
> the PTB and pays gas. Swap input comes from the Mandate vault, not the Agent's
> trading balance.

## 4. Start Automation

Set an interval and start Automation.

Show:

- signal checks
- waiting or triggered decisions
- policy gate result
- execution result when triggered

Explain:

> Automation is session-based for the hackathon demo. The core point is the
> execution model: the Agent can act without a new Owner signature, but cannot
> bypass Move policy.

## 5. Show DeepBook Order

Open DeepBook Orders.

Show:

- market: DEEP/SUI
- input: SUI
- output: DEEP or no-fill status
- digest
- pool object
- gas fee
- output owner where available

Explain:

> DeepBook execution attempts are separated from blocked policy actions. Filled
> orders show fill details where available; no-fill attempts are shown honestly
> and are not presented as successful fills.

## 6. Show Policy Block

Configure an amount that exceeds max single transaction or remaining budget.

Click Test Agent.

Show:

- Policy Preview blocks the action
- Agent Console records the blocked path
- Activity Log receives a blocked event with digest
- DeepBook Orders does not add an order

Explain:

> A blocked action is still useful proof. It shows the Agent attempted an action
> and the Mandate policy prevented it before DeepBook submission.

## 7. Revoke Mandate

Open Mandates or the Mandate detail sheet and revoke the active Mandate.

Show:

- Owner signs revoke
- status becomes Revoked
- Test Agent is disabled or takes the inactive blocked path
- remaining SUI can be withdrawn through the revoke/withdraw flow

Explain:

> The Owner keeps ultimate control. Revocation disables the Agent's authority and
> prevents further autonomous execution.

## Honest Notes For The Demo

- The executable route today is SUI -> DEEP through DEEP_SUI.
- DEEP Rebalance is shown as coming soon. Sell execution is not faked.
- Generic AssetMandate<T> framework support exists.
- DUSDC / Circle USDC were investigated, but current DeepBook testnet has no
  registered fillable pool for those exact coin types.
- USDC routes are disabled.
- The Signal Engine is rule-based today; AI risk signals are planned future work.
