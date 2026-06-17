# Hackathon Notes

## Track Alignment

Mandate fits the Autonomous Agent Wallet track on Sui.

The project demonstrates an Owner wallet delegating scoped, revocable spending
authority to a backend Trading Agent. The Agent can execute without requesting a
fresh Owner wallet signature for each trade, while Move policy enforces hard
limits before spend leaves the Mandate vault.

The core chain is:

```text
Owner Wallet
  -> Mandate vault and policy object
  -> Backend Trading Agent
  -> DeepBook PTB
  -> On-chain Activity / Orders proof
```

## What Is Live Today

- Owner can create a SUI-funded Mandate vault.
- Backend Trading Agent can execute under the Mandate without triggering an
  Owner wallet signature.
- Current executable DeepBook route is SUI -> DEEP through `DEEP_SUI`.
- Mandate policy checks max single tx, budget ceiling, expiration, revoke
  status, protocol scope, and spend asset vault.
- Successful executions appear in DeepBook Orders.
- Blocked policy actions appear in Activity Log and do not appear as DeepBook
  orders.
- Owner can revoke authority.
- Automation page supports rule-based signal checks, Test Agent, and
  session-based interval automation.

## What Is Intentionally Disabled

### DUSDC / USDC Routes

The codebase includes generic AssetMandate<T> framework support. However, route
availability is intentionally disabled for test USDC in the UI.

Investigation results:

- wallet-held DUSDC has no registered fillable DeepBook testnet pool
- Circle testnet USDC has no registered fillable DeepBook testnet pool
- SDK known pools do not match the wallet-held DUSDC coin type

Because of that, USDC routes are disabled and the live demo does not expose
USDC-backed execution as available.

### DEEP Rebalance Sell Route

DEEP Rebalance is shown as coming soon. It represents the future sell leg:

```text
Sell DEEP back to SUI when exit conditions are met
```

It is not executable today and is not faked.

### AI Risk Signal

The Signal Engine is currently rule-based. It does not claim AI price
prediction. AI risk signals are future work.

## Why This Is Not Just A Trading Bot

The key distinction is the Mandate vault and Move policy gate.

In the current model:

- Owner funds the Mandate vault.
- Agent signs execution PTBs and pays gas.
- Agent cannot spend more than the Mandate permits.
- Move policy controls whether vault funds can be used.
- Output assets return to the Owner.
- Revocation stops future authority.

This is closer to an autonomous agent wallet than a bot trading only with its
own wallet balance.

## Future Work

- Add production scheduler for automation instead of session-only polling.
- Add verified sell routes once PTB support and policy handling are reviewed.
- Enable additional vault asset types only after exact coin type, pool id, and
  DeepBook liquidity are verified.
- Add richer signal providers: quote depth, volatility, whale flow, and AI risk
  scoring.
- Add more durable event indexing for long-running deployments.
- Add orderbook/liquidity health checks before enabling a route in UI.

## Judge-facing Summary

Mandate shows how Sui object ownership, Move policy, PTBs, and DeepBook can
compose into a safer autonomous execution system:

```text
Owner signs once
Agent executes autonomously
Move enforces limits
DeepBook handles the trade
On-chain events prove what happened
Owner can revoke
```
