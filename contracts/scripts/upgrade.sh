#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${UPGRADE_CAP_ID:-}" ]]; then
  echo "Missing UPGRADE_CAP_ID." >&2
  echo "Usage: UPGRADE_CAP_ID=<upgrade-cap-object-id> npm run contract:upgrade:testnet" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$CONTRACTS_DIR/deployments/testnet"
OUT_FILE="$DEPLOY_DIR/latest-upgrade.json"

mkdir -p "$DEPLOY_DIR"
cd "$CONTRACTS_DIR"

sui client upgrade \
  --upgrade-capability "$UPGRADE_CAP_ID" \
  --gas-budget 100000000 \
  --json | tee "$OUT_FILE"

echo
echo "Saved upgrade output to $OUT_FILE"
echo "Extract package id with:"
echo "  node contracts/scripts/extract-package-id.js $OUT_FILE"
