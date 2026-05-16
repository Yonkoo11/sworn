#!/usr/bin/env bash
# Deploy CommitReveal to Galileo. Same safe env-loading pattern as siblings.
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .env ]]; then echo "ERROR: contracts/.env missing" >&2; exit 1; fi
set -a
# shellcheck disable=SC1091
source ./.env
set +a
if [[ -z "${PRIVATE_KEY:-}" ]]; then echo "ERROR: PRIVATE_KEY empty" >&2; exit 2; fi
if ! [[ "$PRIVATE_KEY" =~ ^0x[0-9a-fA-F]{64}$ ]]; then echo "ERROR: malformed key" >&2; exit 3; fi
RPC="${GALILEO_RPC_URL:-https://evmrpc-testnet.0g.ai}"
redact() {
  python3 -c '
import sys
key = "'"$PRIVATE_KEY"'"
short = key[:6] + "..." + key[-4:]
for line in sys.stdin:
    sys.stdout.write(line.replace(key, "<PRIVATE_KEY:" + short + ">"))
'
}
OUT=$(forge script script/DeployCommitReveal.s.sol:DeployCommitReveal \
  --rpc-url "$RPC" --private-key "$PRIVATE_KEY" --broadcast --legacy 2>&1 | redact)
echo "$OUT"
ADDR=$(echo "$OUT" | grep -oE 'CommitReveal deployed at: 0x[0-9a-fA-F]{40}' | head -1 | awk '{print $4}')
echo "================================================================"
echo "  CommitReveal at $ADDR"
echo "  Explorer: https://chainscan-galileo.0g.ai/address/$ADDR"
echo "================================================================"
