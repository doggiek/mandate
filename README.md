# Mandate

Policy-based autonomous wallets for AI agents on Sui.

**Track:** Sui Overflow 2026 / Agentic Web / Autonomous Agent Wallet

## What it does

- Owner creates a shared Mandate object
- Agent executes within budget/protocol/time limits
- Move enforces spending ceiling
- Events provide on-chain activity logs
- Owner can revoke anytime

## Current status

- Move MVP implemented
- `sui move test` passed: 10/10
- Testnet mock flow verified
- DeepBook real order integration verified

## Verified Testnet Flow

- Create Mandate
- Authorize Spend
- DeepBook Swap
- Activity Event
- Owner Revocation

## Commands

```bash
sui move test
sui client publish --gas-budget 100000000
npm run agent:swap
```

## Quick Start

```bash
npm install
cp .env.example .env.local
```

Fill in the environment variables, then run:

```bash
npm run contract:test
npm run dev
```

Run `npm run dev` from the repository root. The web app loads environment
variables from the root `.env.local`; do not copy secrets into `apps/web`.

Agent execution uses `BACKEND_AGENT_PRIVATE_KEY` as the platform backend Agent
signer. It pays gas and submits autonomous PTBs; it is not a user wallet private
key. User SUI budget comes from the Mandate vault, and swap output assets return
to the Owner wallet. `NEXT_PUBLIC_BACKEND_AGENT_ADDRESS` must match that signer.

## Testnet Deployment

Publish contract:

```bash
npm run contract:publish:testnet
```

Upgrade contract:

```bash
UPGRADE_CAP_ID=<upgrade-cap-object-id> npm run contract:upgrade:testnet
```

Extract package id:

```bash
npm run contract:extract-package
```

Update `NEXT_PUBLIC_PACKAGE_ID` and `PACKAGE_ID` with the extracted package id.
If you publish a new package instead of upgrading, recreate the Mandate object.
