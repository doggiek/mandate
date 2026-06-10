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
