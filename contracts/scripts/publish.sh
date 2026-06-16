#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEPLOY_DIR="$CONTRACTS_DIR/deployments/testnet"
OUT_FILE="$DEPLOY_DIR/latest-publish.json"
TMP_FILE="$(mktemp "$DEPLOY_DIR/latest-publish.XXXXXX.json")"

DEFAULT_PUBFILE="$CONTRACTS_DIR/Published.toml"
BACKUP_PUBFILE=""

mkdir -p "$DEPLOY_DIR"

cleanup() {
  rm -f "$TMP_FILE" 2>/dev/null || true
  if [[ -n "$BACKUP_PUBFILE" && -f "$BACKUP_PUBFILE" ]]; then
    mv "$BACKUP_PUBFILE" "$DEFAULT_PUBFILE"
  fi
}
trap cleanup EXIT

if [[ -f "$DEFAULT_PUBFILE" ]]; then
  BACKUP_PUBFILE="$DEFAULT_PUBFILE.bak.$(date +%Y%m%d%H%M%S)"
  mv "$DEFAULT_PUBFILE" "$BACKUP_PUBFILE"
  echo "Temporarily moved existing Published.toml to $BACKUP_PUBFILE"
fi

if sui client publish "$CONTRACTS_DIR" \
  --gas-budget 100000000 \
  --json > "$TMP_FILE"; then
  mv "$TMP_FILE" "$OUT_FILE"
  cat "$OUT_FILE"
else
  cat "$TMP_FILE" >&2 || true
  exit 1
fi

echo
echo "Saved publish output to $OUT_FILE"
node "$SCRIPT_DIR/extract-package-id.js" "$OUT_FILE"
echo
echo "Remember to update .env.local and restart Next.js"