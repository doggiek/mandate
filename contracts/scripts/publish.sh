#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$CONTRACTS_DIR/deployments/testnet"
OUT_FILE="$DEPLOY_DIR/latest-publish.json"
PUBFILE="$DEPLOY_DIR/Published.toml"
TMP_FILE="$(mktemp "$DEPLOY_DIR/latest-publish.XXXXXX.json")"

mkdir -p "$DEPLOY_DIR"

if sui client publish "$CONTRACTS_DIR" \
  --gas-budget 100000000 \
  --json \
  --pubfile-path "$PUBFILE" > "$TMP_FILE"; then
  mv "$TMP_FILE" "$OUT_FILE"
  cat "$OUT_FILE"
else
  cat "$TMP_FILE" >&2 || true
  rm -f "$TMP_FILE"
  exit 1
fi

echo
echo "Saved publish output to $OUT_FILE"
echo "Using pubfile $PUBFILE"
node "$SCRIPT_DIR/extract-package-id.js" "$OUT_FILE"
echo
echo "Remember to update .env.local and restart Next.js"
