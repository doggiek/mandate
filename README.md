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
- `sui move test` passed: 7/7
- Testnet mock flow verified
- DeepBook real order integration pending

## Commands

```bash
sui move test
sui client publish --gas-budget 100000000
```
