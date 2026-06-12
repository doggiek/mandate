#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$CONTRACTS_DIR/deployments/testnet"
OUT_FILE="$DEPLOY_DIR/latest-publish.json"

mkdir -p "$DEPLOY_DIR"
cd "$CONTRACTS_DIR"

sui client publish --gas-budget 100000000 --json | tee "$OUT_FILE"

echo
echo "Saved publish output to $OUT_FILE"
node "$SCRIPT_DIR/extract-package-id.js" "$OUT_FILE"
echo
echo "Remember to update .env.local and restart Next.js"
