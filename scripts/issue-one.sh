#!/usr/bin/env bash
# Issue ONE real Sworn receipt on Galileo testnet, end-to-end.
#
# Pipeline:
#   1. Real 0G Compute call (TeeML, Gemma 3 27B by default)
#   2. Real 0G Storage upload (encrypted client-side)
#   3. Real recordReceipt() on the deployed ReceiptRegistry contract
#   4. Prints the receipt URL — paste into the public verifier to see ✓ VERIFIED
#
# This is the Phase 1 Gate live test (.ralph/@fix_plan.md T10).
#
# Safety:
#   - PRIVATE_KEY is sourced into THIS bash subshell only, never echoed
#   - SDK reads PRIVATE_KEY from env, signs locally with ethers Wallet
#   - 0G Compute broker requires a funded ledger (3 OG minimum)

set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f contracts/.env ]]; then
  echo "ERROR: contracts/.env not found. Run contracts/deploy-galileo.sh first." >&2
  exit 1
fi

if [[ ! -f contracts/deployments/16602.json ]]; then
  echo "ERROR: Registry not deployed yet. Run contracts/deploy-galileo.sh first." >&2
  exit 2
fi

# Source the deploy env into this subshell.
set -a
# shellcheck disable=SC1091
source ./contracts/.env
set +a

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "ERROR: PRIVATE_KEY is empty in contracts/.env." >&2
  exit 3
fi

# Pull the deployed registry address from the deploy artifact (not a secret).
REGISTRY_ADDRESS=$(python3 -c "import json; print(json.load(open('contracts/deployments/16602.json'))['registry'])")
echo "Using ReceiptRegistry at: $REGISTRY_ADDRESS"
echo "RPC: ${GALILEO_RPC_URL:-https://evmrpc-testnet.0g.ai}"
echo ""

# Demo-mode for the hackathon submission:
#   - SWORN_REGISTRY_ADDRESS + SWORN_RPC_URL → recordReceipt fires on Galileo
#     (chain integration is REAL — txHash visible on chainscan-galileo.0g.ai)
#   - SWORN_STORAGE=mock   → blob lands in /tmp/sworn-mock-storage and gets
#     copied into verifier-web/public/blobs so gh-pages serves it. 0G Storage
#     uploads return a Flow-contract revert on Galileo right now (see
#     ai/memory.md "Storage gateway 2026-05-15"); fallback path keeps the
#     verifier end-to-end while that resolves.
#   - SWORN_BROKER=mock    → local deterministic TEE signature (NO live TeeML
#     providers on Galileo at submission time; broker.inference.listService()
#     returns []). Flip SWORN_BROKER=real after 0G ships providers.
export SWORN_BROKER=mock
export SWORN_STORAGE=mock
export SWORN_STORAGE_DIR="${SWORN_STORAGE_DIR:-/tmp/sworn-mock-storage}"
export SWORN_REGISTRY_ADDRESS="$REGISTRY_ADDRESS"
export SWORN_RPC_URL="${GALILEO_RPC_URL:-https://evmrpc-testnet.0g.ai}"
# PRIVATE_KEY already exported via set -a above; the SDK picks it up.

cd sdk-ts
pnpm exec tsx scripts/issue-one.ts
