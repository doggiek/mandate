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

If you publish a new package instead of upgrading the existing one, recreate the
Mandate object so its type belongs to the latest package.
