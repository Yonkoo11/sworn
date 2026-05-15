#!/usr/bin/env bash
# List live 0G Compute providers (uses same safe env-loading as issue-one.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
source ./contracts/.env
set +a

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: PRIVATE_KEY is empty in contracts/.env." >&2
  exit 1
fi

export SWORN_RPC_URL="${GALILEO_RPC_URL:-https://evmrpc-testnet.0g.ai}"
cd sdk-ts
pnpm exec tsx scripts/list-providers.ts
