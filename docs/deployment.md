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

Update both runtime configs with the extracted value:

```bash
NEXT_PUBLIC_PACKAGE_ID=<package_id>
PACKAGE_ID=<package_id>
```

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

1. Select the new active Mandate in Run Agent Strategy.
2. Run `Per-tx guard` or `Budget guard`.
3. Confirm the result shows `BLOCKED` with a real digest.
4. Open the digest in SuiVision and confirm `BlockedEvent` was emitted.
