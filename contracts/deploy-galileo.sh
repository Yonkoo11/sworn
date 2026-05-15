#!/usr/bin/env bash
# Deploy ReceiptRegistry to 0G Galileo testnet (chain 16601).
#
# What this script does:
#   1. Source contracts/.env into THIS subshell only (key never leaves bash)
#   2. Validate PRIVATE_KEY is set + 0x-prefixed 64-hex
#   3. Run `forge script Deploy.s.sol` with --private-key $PRIVATE_KEY
#   4. Echo only the deployed registry ADDRESS (not the key) and Explorer URL
#   5. Update contracts/deployments/16601.json (Deploy.s.sol writes this)
#
# Safety:
#   - $PRIVATE_KEY is never echoed by this script
#   - forge does not print private keys in --broadcast output
#   - All stdout lines are filtered through a redactor before reaching the
#     terminal, as a belt-and-braces guard against future forge changes

set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERROR: contracts/.env not found. Paste your PRIVATE_KEY there first." >&2
  exit 1
fi

# Source into THIS shell only — key stays in env, never echoed.
set -a
# shellcheck disable=SC1091
source ./.env
set +a

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: PRIVATE_KEY is empty in contracts/.env. Paste a 0x-prefixed key." >&2
  exit 2
fi

if ! [[ "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: PRIVATE_KEY must be 0x + 64 hex chars (currently malformed)." >&2
  exit 3
fi

RPC="${GALILEO_RPC_URL:-https://evmrpc-testnet.0g.ai}"
echo "Deploying to Galileo testnet (chain 16601) via $RPC..."

# Redactor: catches accidental key prints in any future forge output.
redact() {
  python3 -c '
import sys, re
key = "'"$PRIVATE_KEY"'"
short = key[:6] + "..." + key[-4:]
for line in sys.stdin:
    line = line.replace(key, "<PRIVATE_KEY:" + short + ">")
    sys.stdout.write(line)
'
}

# Run forge. Capture stdout so we can fish out the deployed address.
OUTPUT=$(forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$RPC" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy 2>&1 | redact)

echo "$OUTPUT"

# Pull the deployed address from forge stdout (Deploy.s.sol logs it).
ADDR=$(echo "$OUTPUT" | grep -oE 'ReceiptRegistry deployed at: 0x[0-9a-fA-F]{40}' | head -1 | awk '{print $4}')

if [[ -z "$ADDR" ]]; then
  echo ""
  echo "Could not parse deployed address from forge output. Check deployments/16601.json." >&2
  exit 4
fi

echo ""
echo "================================================================"
echo "  Sworn ReceiptRegistry deployed on Galileo testnet"
echo "  Address: $ADDR"
echo "  Explorer: https://chainscan-galileo.0g.ai/address/$ADDR"
echo "  Deployment record: contracts/deployments/16601.json"
echo "================================================================"
echo ""
echo "  Tell Claude: 'deployed at $ADDR' — Claude will wire it into the"
echo "  SDK + the GitHub Pages workflow and push a redeploy."
