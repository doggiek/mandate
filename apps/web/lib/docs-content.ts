export type DocsPage = {
  id: string;
  title: string;
  description: string;
  content: string;
};

export const docsPages: DocsPage[] = [
  {
    id: "overview",
    title: "Overview",
    description: "What Mandate is and why autonomous agents need it.",
    content: `# Overview

Mandate is a programmable permission layer for autonomous agent wallets on Sui.

AI agents are stuck behind the approval wall — every meaningful on-chain action requires a new signature. Full wallet access is unsafe, but repeated approvals make autonomy impractical.

Mandate solves this by letting users define execution policies once, and delegate constrained authority to autonomous agents.

Mandate defines a constrained execution policy layer.

It enforces:

- Budget limits
- Per-transaction caps
- Protocol restrictions
- Expiration windows
- Owner revocation

All rules are enforced on-chain using Move objects.

Within these constraints, agents can execute strategies like DCA on DeepBook without repeated approvals. Every execution, rejection, expiration, and revocation is fully verifiable on-chain.

Mandate enables a safer model for autonomous execution on Sui.

Sign once. Execute within limits.

Watch demo video: https://youtu.be/0ri2MwXb2GI`,
  },
  {
    id: "how-it-works",
    title: "How It Works",
    description: "The product flow from mandate creation to on-chain proof.",
    content: `# How It Works

Create Mandate → Define Limits → Agent Executes → Move Policy Checks → DeepBook Execution → On-chain Logs

The owner creates a Mandate object once, defining the budget, per-transaction cap, protocol scope, expiration window, and revocation authority.

The backend Trading Agent can then submit execution PTBs through the Mandate policy path. The Move object checks every action before it reaches DeepBook.

If the action is allowed, the agent executes a real DeepBook order. If the action exceeds policy, the attempt is rejected and recorded as on-chain activity.

Lifecycle:

Sign once → Execute within limits → Revoke/Expire → Withdraw funds`,
  },
  {
    id: "demo-guide",
    title: "Demo Guide",
    description: "A short path for reviewing the live product.",
    content: `# Demo Guide

1. Create Mandate

Define a capped Mandate with a SUI vault, max transaction size, expiration window, and DeepBook protocol scope.

2. Run Test Agent

Use Test Agent to verify that the selected strategy can pass policy checks and submit a backend Trading Agent PTB.

3. Enable Force Execution

Force execution only bypasses the signal threshold. Policy checks and DeepBook liquidity still apply.

4. Observe Execution or Block

A valid action produces DeepBook order proof. A policy violation produces a blocked on-chain activity event.

5. Revoke Mandate → Funds Return

Revoke or wait for expiration, then withdraw remaining vault funds back to the owner wallet.`,
  },
  {
    id: "architecture",
    title: "Architecture",
    description: "The minimal system model behind constrained execution.",
    content: `# Architecture

Mandate separates ownership, policy, execution, and proof.

Owner Wallet → Mandate Move Object → Backend Trading Agent → DeepBook PTB → On-chain Activity Log

Components:

- Move Mandate Object: stores vault funds and enforces policy before execution.
- Backend Trading Agent: signs and submits autonomous PTBs without owner signatures.
- Signal Engine: evaluates rule-based market signals before execution.
- Policy Gate: checks budget, per-transaction cap, protocol scope, expiration, and revocation.
- DeepBook Execution Route: executes the current DEEP_SUI route through DeepBook.
- Activity and Order Views: show executed orders, blocked attempts, revocations, withdrawals, and proof links.

The owner keeps wallet ownership. The agent receives constrained execution authority only through the Mandate object.`,
  },
  {
    id: "deployment",
    title: "Deployment",
    description: "How the hosted product is configured without changing code.",
    content: `# Deployment

The production product is deployed from the Next.js app in apps/web.

Vercel settings:

- Root Directory: apps/web
- Install Command: pnpm install
- Build Command: pnpm build

Network configuration is environment-driven. Switching between testnet and mainnet should only require changing environment variables and redeploying.

The current executable public route is DEEP_SUI on Sui testnet. Mainnet routes should remain disabled unless package, pool, and token configuration are fully provided.

The API runtime must not assume the repository root as the current working directory. Backend agent execution code is imported as server-side functions rather than shelling out to package-manager commands.`,
  },
];
