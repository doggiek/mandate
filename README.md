# Mandate

## Programmable Permission Layer · Sui

Mandate is a programmable permission layer for autonomous agent wallets on Sui.

## Core Problem

AI agents are stuck behind the approval wall — every meaningful on-chain action requires a new signature. Full wallet access is unsafe, but repeated approvals make autonomy impractical.

## Solution

Mandate solves this by letting users define execution policies once, and delegate constrained authority to autonomous agents.

Mandate defines a constrained execution policy layer.

All rules are enforced on-chain using Move objects. Within these constraints, agents can execute strategies like DCA on DeepBook without repeated approvals. Every execution, rejection, expiration, and revocation is fully verifiable on-chain.

Mandate enables a safer model for autonomous execution on Sui.

## What It Enforces

Budget limits · Per-transaction caps · Protocol restrictions · Expiration windows · Owner revocation

## System Capabilities

- Move object policy enforcement for constrained agent execution.
- Owner-funded Mandate vaults with budget and per-transaction limits.
- Backend Trading Agent execution without repeated owner signatures.
- DeepBook `DEEP_SUI` execution through the current live route.
- On-chain activity logs for executions, rejections, expirations, revocations, and withdrawals.
- Owner revocation or expiration triggers automatic withdrawal of remaining funds back to the owner wallet.

## How It Works

```text
Create Mandate
  -> Backend Trading Agent executes
  -> Move policy checks budget, cap, protocol, expiry, and revocation
  -> DeepBook DEEP_SUI PTB
  -> On-chain activity log and order proof
  -> Revocation / expiration triggers remaining funds withdrawal back to owner wallet
```

The current executable flow uses an owner-funded SUI vault, a backend Trading Agent, and the DeepBook `DEEP_SUI` route. Swap execution and policy rejections are recorded as on-chain activity.

## Key Message

Sign once. Execute within limits.

## Hackathon Context

Mandate is built for Sui Overflow and the Autonomous Agent Wallet track.

It demonstrates constrained autonomous execution: users keep wallet ownership, while agents receive only policy-scoped authority enforced by Move objects.

## Links

- Demo Video: https://youtu.be/0ri2MwXb2GI
- Docs: https://github.com/doggiek/mandate/wiki
- GitHub: https://github.com/doggiek/mandate
- Product: https://usemandate.vercel.app/
- X: https://x.com/BuildMandate
- Sui Overflow: https://overflow.sui.io/
