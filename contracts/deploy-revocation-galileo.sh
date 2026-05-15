#!/usr/bin/env bash
# Deploy RevocationRegistry to 0G Galileo testnet. Mirrors deploy-galileo.sh.
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then
  echo "ERROR: contracts/.env not found." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source ./.env
set +a

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: PRIVATE_KEY empty." >&2
  exit 2
fi
if ! [[ "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  echo "ERROR: PRIVATE_KEY malformed." >&2
  exit 3
fi

RPC="${GALILEO_RPC_URL:-https://evmrpc-testnet.0g.ai}"
echo "Deploying RevocationRegistry to Galileo via $RPC..."

redact() {
  python3 -c '
import sys
key = "'"$PRIVATE_KEY"'"
short = key[:6] + "..." + key[-4:]
for line in sys.stdin:
    sys.stdout.write(line.replace(key, "<PRIVATE_KEY:" + short + ">"))
'
}

OUTPUT=$(forge script script/DeployRevocation.s.sol:DeployRevocation \
  --rpc-url "$RPC" \
  --private-key "$PRIVATE_KEY" \
  --broadcast \
  --legacy 2>&1 | redact)

echo "$OUTPUT"

ADDR=$(echo "$OUTPUT" | grep -oE 'RevocationRegistry deployed at: 0x[0-9a-fA-F]{40}' | head -1 | awk '{print $4}')
if [[ -z "$ADDR" ]]; then
  echo "Could not parse deployed address." >&2
  exit 4
fi

echo ""
echo "================================================================"
echo "  RevocationRegistry deployed on Galileo testnet"
echo "  Address:  $ADDR"
echo "  Explorer: https://chainscan-galileo.0g.ai/address/$ADDR"
echo "================================================================"
