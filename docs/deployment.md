# Testnet Deployment

Run contract tests:

```bash
npm run contract:test
```

Publish a new package:

```bash
npm run contract:publish:testnet
npm run contract:extract-package -- contracts/deployments/testnet/latest-publish.json
```

Upgrade an existing package:

```bash
UPGRADE_CAP_ID=<upgrade-cap-object-id> npm run contract:upgrade:testnet
npm run contract:extract-package -- contracts/deployments/testnet/latest-upgrade.json
```

Update the package id for the active network:

```bash
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID_TESTNET=<package_id>
```

For mainnet deployments, set `NEXT_PUBLIC_SUI_NETWORK=mainnet` and configure
`NEXT_PUBLIC_PACKAGE_ID_MAINNET` plus the mainnet DeepBook route and explorer
variables. Switching networks is env-only: update the root `.env.local` or
deployment environment, then restart or redeploy. No code changes are required.

Network-scoped route variables:

```bash
NEXT_PUBLIC_SUI_RPC_TESTNET=
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_TESTNET=DEEP_SUI
NEXT_PUBLIC_DEEPBOOK_POOL_ID_TESTNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_TESTNET=0x2::sui::SUI
NEXT_PUBLIC_BUY_COIN_TYPE_TESTNET=
NEXT_PUBLIC_EXPLORER_BASE_URL_TESTNET=https://testnet.suivision.xyz

NEXT_PUBLIC_SUI_RPC_MAINNET=
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_MAINNET=
NEXT_PUBLIC_DEEPBOOK_POOL_ID_MAINNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_MAINNET=0x2::sui::SUI
NEXT_PUBLIC_BUY_COIN_TYPE_MAINNET=
NEXT_PUBLIC_EXPLORER_BASE_URL_MAINNET=https://suivision.xyz
```

Configure the backend Agent signer:

```bash
BACKEND_AGENT_PRIVATE_KEY=<sui-private-key>
NEXT_PUBLIC_BACKEND_AGENT_ADDRESS=<backend-agent-address>
```

`BACKEND_AGENT_PRIVATE_KEY` is the platform backend Agent signer. It pays gas
and submits autonomous PTBs. It is not the Owner wallet private key; Owner funds
come from the Mandate vault, and swap output assets return to the Owner wallet.

Legacy names are still accepted as fallback during local migration:
`AGENT_PRIVATE_KEY` and `NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS`.

Restart the Next.js dev server from the repository root after updating
`.env.local`:

```bash
npm run dev
```

The root `.env.local` is the single source of truth for local environment
variables. Do not create a separate `apps/web/.env.local`.

If you publish a new package instead of upgrading the existing one, recreate the
Mandate object so its type belongs to the latest package.

Create a Mandate from `/console` after the package id is updated.

Verify blocked event support:

1. Select the new active Mandate in Automation.
2. Run `Per-tx guard` or `Budget guard`.
3. Confirm the result shows `BLOCKED` with a real digest.
4. Open the digest in SuiVision and confirm `BlockedEvent` was emitted.
