# Deployment

Mandate is deployed as a Next.js app from the `apps/web` workspace. Local
development can start from the repository root through the root `pnpm dev`
script, while Vercel builds from `apps/web`.

## Local Development

Install dependencies from the repository root:

```bash
pnpm install
```

Create local env at the repository root:

```bash
cp .env.example .env.local
```

Recommended local development command:

```bash
pnpm dev
```

The root `dev` script delegates to `apps/web`, and `apps/web/next.config.mjs`
loads the repository-root `.env.local`. The root env file remains the source of
truth.

You can also run the web app directly from the workspace when needed:

```bash
cd apps/web
pnpm dev
```

For a local production build, run from the web workspace:

```bash
cd apps/web
pnpm build
```

The repository root currently exposes `pnpm dev`, but not a root `pnpm build`
script. This matches the Vercel setup because Vercel's Root Directory is
`apps/web`; in Vercel, `pnpm build` runs inside that workspace.

## Vercel Deployment

Use these project settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | `pnpm install` |
| Build Command | `pnpm build` |
| Output Directory | Next.js default |

Do not deploy with npm commands. The project is expected to run through pnpm in
the `apps/web` workspace.

## Runtime Model

The production API route `/api/agent/run` runs in the Next.js Node.js runtime.
It directly imports the server-side agent runner from:

```text
apps/web/lib/server/agent-runner.ts
```

This is important for Vercel:

- The API route does not spawn `npm`, `pnpm`, `yarn`, or any package manager.
- The API route does not assume the current working directory is the repository
  root.
- Agent execution and blocked-action recording are called as server-side
  functions.

The scripts in `apps/web/package.json`:

```text
agent:swap
agent:block
agent:record-blocked
```

are local CLI/debug entrypoints only. Production request handling must not call
those scripts through a shell.

## Environment Variables

Configure environment variables in Vercel for each environment. For local
development, keep a single `.env.local` at the repository root. Do not create or
copy secrets into `apps/web/.env.local`.

The active network is selected by:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
```

Supported values:

```text
testnet
mainnet
```

Network switching is env-only. Change `NEXT_PUBLIC_SUI_NETWORK` and the matching
network-scoped variables, then redeploy or restart the app. No code changes are
required.

Required testnet values:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID_TESTNET=
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_TESTNET=DEEP_SUI
NEXT_PUBLIC_DEEPBOOK_POOL_ID_TESTNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_TESTNET=0x2::sui::SUI
NEXT_PUBLIC_BUY_COIN_TYPE_TESTNET=
NEXT_PUBLIC_EXECUTION_AMOUNT_TESTNET=1
NEXT_PUBLIC_EXPLORER_BASE_URL_TESTNET=https://testnet.suivision.xyz
BACKEND_AGENT_PRIVATE_KEY=
NEXT_PUBLIC_BACKEND_AGENT_ADDRESS=
```

Required mainnet values, when mainnet is intentionally enabled:

```env
NEXT_PUBLIC_SUI_NETWORK=mainnet
NEXT_PUBLIC_PACKAGE_ID_MAINNET=
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_MAINNET=
NEXT_PUBLIC_DEEPBOOK_POOL_ID_MAINNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_MAINNET=0x2::sui::SUI
NEXT_PUBLIC_BUY_COIN_TYPE_MAINNET=
NEXT_PUBLIC_EXECUTION_AMOUNT_MAINNET=
NEXT_PUBLIC_EXPLORER_BASE_URL_MAINNET=https://suivision.xyz
BACKEND_AGENT_PRIVATE_KEY=
NEXT_PUBLIC_BACKEND_AGENT_ADDRESS=
```

`BACKEND_AGENT_PRIVATE_KEY` is the platform backend Agent signer. It pays gas
and submits autonomous PTBs. It is not a user wallet private key. Owner assets
come from the Mandate vault, and swap output assets return to the Owner wallet.

Legacy env names are supported only as deprecated fallbacks during migration:

```env
AGENT_PRIVATE_KEY=
NEXT_PUBLIC_VERIFIED_AGENT_ADDRESS=
```

New deployments should use `BACKEND_AGENT_PRIVATE_KEY` and
`NEXT_PUBLIC_BACKEND_AGENT_ADDRESS`.

## Contract Deployment

Run Move tests before publishing:

```bash
pnpm contract:test
```

Publish or upgrade on testnet from the repository root:

```bash
pnpm contract:publish:testnet
UPGRADE_CAP_ID=<upgrade-cap-object-id> pnpm contract:upgrade:testnet
pnpm contract:extract-package
```

After publishing a new package, update the corresponding network-scoped package
id, for example:

```env
NEXT_PUBLIC_PACKAGE_ID_TESTNET=<new-package-id>
```

Then restart local Next.js or redeploy Vercel, and create a fresh Mandate for
the new package.

## Testnet Route Notes

The current executable testnet route is:

```text
SUI vault -> DEEP_SUI -> DEEP output
```

DUSDC / Circle USDC support was investigated through the generic
`AssetMandate<T>` framework, but the current DeepBook testnet does not have a
registered fillable pool for those exact coin types. USDC routes remain disabled
until the exact coin type and registered DeepBook pool are verified.

## Troubleshooting

If Mandates fail to load, verify the active network and matching package id:

```env
NEXT_PUBLIC_SUI_NETWORK=testnet
NEXT_PUBLIC_PACKAGE_ID_TESTNET=
```

If a route appears disabled, verify the active network has a complete route
configuration:

```env
NEXT_PUBLIC_DEEPBOOK_POOL_KEY_TESTNET=
NEXT_PUBLIC_DEEPBOOK_POOL_ID_TESTNET=
NEXT_PUBLIC_SPEND_COIN_TYPE_TESTNET=
NEXT_PUBLIC_BUY_COIN_TYPE_TESTNET=
```

If `/api/agent/run` reports an agent signer mismatch, verify that
`BACKEND_AGENT_PRIVATE_KEY` derives to `NEXT_PUBLIC_BACKEND_AGENT_ADDRESS`.

If Vercel logs ever show `spawn pnpm ENOENT`, `spawn npm ENOENT`, or
`Command failed: npm run agent:swap`, the API route has regressed to shelling
out to a package manager. The production API path should directly call the
server-side runner.
