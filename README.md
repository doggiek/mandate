# Mandate

Mandate is a programmable permission layer for autonomous agent wallets on Sui.

An Owner wallet creates a revocable on-chain Mandate object that grants a
backend Trading Agent capped spending authority. The Agent can submit DeepBook
PTBs without asking the Owner for a new wallet signature each time, but every
execution is checked against Move-enforced policy limits and recorded as
on-chain activity.

## What Is Mandate

Mandate turns agent execution into scoped, revocable authority instead of an
open-ended wallet handoff.

The current executable demo uses:

```text
SUI vault -> DeepBook DEEP_SUI route -> buy DEEP -> output returned to Owner
```

The Owner signs to create or revoke a Mandate. The backend Trading Agent signs
execution transactions and pays gas, while swap input funds come from the
Owner-funded Mandate vault.

## Why Sui

Sui is a strong fit for this model because Mandate can be represented as an
object with explicit ownership, shared access, typed assets, and Move-level
policy checks. Programmable Transaction Blocks make it possible to combine:

- Mandate policy authorization
- vault coin extraction
- DeepBook swap execution
- output transfer back to the Owner
- on-chain ActivityEvent proof

in a single transaction submitted by the backend Agent.

## Key Features

- Owner-funded Mandate vault for capped agent spend
- Backend Trading Agent execution without repeat Owner signatures
- Move policy gate for max single transaction, total budget, expiration,
  revoke status, protocol scope, and spend asset vault
- Real DeepBook DEEP_SUI execution route
- Signal Engine for rule-based live signals
- Automation page with Test Agent and interval-based automation controls
- Activity Log for created, executed, blocked, and revoked events
- DeepBook Orders page for execution attempts and fill visibility
- Owner revocation and remaining-vault withdrawal path

## Demo Flow

```text
Create Mandate
  -> Select DEEP Momentum strategy
  -> Live signal check
  -> Policy gate
  -> Backend Agent PTB
  -> DeepBook execution
  -> On-chain proof
```

The live strategy is DEEP Momentum:

- Signal: DEEP/SUI quote
- Action: Buy DEEP with SUI
- Spend asset: SUI vault
- Route: DEEP_SUI

DEEP Rebalance is shown as planned work for the future sell leg. It is not
currently executable.

## Architecture

Mandate is composed of:

- Move Mandate object: owner-funded vault and policy state
- Backend Trading Agent signer: submits autonomous PTBs and pays gas
- Next.js console: wallet connection, Mandate creation, Automation, Activity,
  and Orders UI
- Signal Engine: rule-based signal evaluation
- Policy Gate: Move checks before spend leaves the vault
- DeepBook route: current executable DEEP_SUI buy route
- Activity and order indexing: RPC/event-derived proof views with local
  optimistic records for the active session

See [docs/architecture.md](docs/architecture.md) for the full component map.

## Local Setup

Install dependencies:

```bash
npm install
```

Create local env:

```bash
cp .env.example .env.local
```

Fill the required variables in the repository-root `.env.local`, then run:

```bash
npm run dev
```

Run `npm run dev` from the repository root. The web app loads environment
variables from the root `.env.local`; do not copy secrets into `apps/web`.

## Environment Variables

Core variables:

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID_TESTNET=
NEXT_PUBLIC_PACKAGE_ID_MAINNET=
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_TESTNET=DEEP_SUI
NEXT_PUBLIC_DEEPBOOK_POOL_ID_TESTNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_TESTNET=0x2::sui::SUI
NEXT_PUBLIC_BUY_COIN_TYPE_TESTNET=
NEXT_PUBLIC_EXPLORER_BASE_URL_TESTNET=https://testnet.suivision.xyz
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_MAINNET=
NEXT_PUBLIC_DEEPBOOK_POOL_ID_MAINNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_MAINNET=0x2::sui::SUI
NEXT_PUBLIC_BUY_COIN_TYPE_MAINNET=
NEXT_PUBLIC_EXPLORER_BASE_URL_MAINNET=https://suivision.xyz
BACKEND_AGENT_PRIVATE_KEY=
NEXT_PUBLIC_BACKEND_AGENT_ADDRESS=
```

`BACKEND_AGENT_PRIVATE_KEY` is the platform backend Agent signer. It pays gas
and submits autonomous PTBs. It is not a user wallet private key. User assets
come from the Mandate vault, and swap output assets return to the Owner wallet.

Generic AssetMandate<T> framework support exists, but USDC routes are disabled.
DUSDC / Circle USDC were investigated, and the current DeepBook testnet has no
registered fillable pool for those exact coin types.

## Smart Contract Tests

Run Move tests:

```bash
npm run contract:test
```

Publish or upgrade on testnet:

```bash
npm run contract:publish:testnet
UPGRADE_CAP_ID=<upgrade-cap-object-id> npm run contract:upgrade:testnet
npm run contract:extract-package
```

After publishing a new package, update `NEXT_PUBLIC_PACKAGE_ID_TESTNET`,
restart Next.js, and create a fresh Mandate object for the new package.
Switching between testnet and mainnet only requires changing
`NEXT_PUBLIC_SUI_NETWORK` and the matching network-scoped env values, then
restarting or redeploying. No code changes are required.

## Known Testnet Limitations

- The only current executable trading route is `DEEP_SUI`.
- DeepBook testnet liquidity can be thin; small orders may return `no_fill`.
- Generic AssetMandate<T> framework support exists.
- DUSDC / Circle USDC were investigated, but current DeepBook testnet has no
  registered fillable pool for those exact coin types.
- USDC routes are disabled. SUI Momentum remains visible as a planned framework
  path until a matching registered DeepBook pool exists.
- The Signal Engine is rule-based today. It does not claim to predict prices.
  AI risk signals are planned future work.

## Roadmap

- Add safe sell-side DEEP rebalance route after script and policy review
- Enable additional asset vaults only when exact coin type and DeepBook pool
  registration are verified
- Replace demo interval automation with production-grade scheduling
- Add richer signal sources such as quote depth, volatility, whale flow, and AI
  risk scoring
- Improve event indexing for longer-running deployments
