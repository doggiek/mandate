# Mandate Overview

Mandate is a programmable permission layer for autonomous agent wallets on Sui. It lets users sign once, define limits, and let an agent act only within those limits.

## The Problem

- Approval wall: every meaningful on-chain action still asks the user to sign again.
- Unsafe full access: giving an agent a funded wallet gives it too much control.
- Repeated signatures: manual approvals make true autonomous execution impractical.

## The Solution

Mandate lets an owner define a capped policy once, then delegate constrained authority to an autonomous agent. The agent can execute within budget, protocol, expiry, and revocation limits while every action remains verifiable on-chain.

Watch demo video: https://youtu.be/0ri2MwXb2GI
