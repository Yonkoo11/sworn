# Progress Log — Sworn

## Session 2026-05-13 (builder, autonomous)

Branch: `auto/build-20260513-2328`

### Done

- **T1** — Foundry scaffold + `ReceiptRegistry.sol`. `forge build` clean. (commit 74e7581)
- **T2** — Contract tests. 10 pass: happy-path storage, event emit, replay reverts (same-issuer + cross-issuer), zero chatIdHash, zero rootHash, zero provider, getAnchor struct, isAnchored toggle, 256-run fuzz over unique chatIds. Gas reported. (commit a5a7fcf)
- **T3 prep** — `script/Deploy.s.sol` and `.env.example` ready. Deploy command:
  `forge script script/Deploy.s.sol:Deploy --rpc-url galileo --private-key $PRIVATE_KEY --broadcast`
  Writes deployment record to `deployments/16601.json`. (commit b68eced)

### Blocked

- **T3** — Needs a funded Galileo testnet wallet. `PRIVATE_KEY` env var is not set.
- **T4–T10** — Most need testnet access (Compute provider top-up, Storage upload, anchor tx). T4 (SDK type scaffold) could proceed without a wallet but the integration tests T5–T10 cannot, and the Phase 1 Gate is an end-to-end test against live Galileo. Holding T4+ until T3 is unblocked so the SDK can be built and verified in one continuous pass against a known-deployed registry address.

### How to unblock

1. Generate or use an existing wallet on Galileo (chain 16601, RPC `https://evmrpc-testnet.0g.ai`)
2. Fund it from the 0G faucet (need enough gas for one contract deploy + a few `recordReceipt` calls + ~1 OG for Compute ledger)
3. `cp contracts/.env.example contracts/.env` and fill in `PRIVATE_KEY`, OR `export PRIVATE_KEY=0xYOUR_KEY`
4. Re-run the builder. It will start at T3, deploy the registry, and continue through T4–T10 against the live deploy.

## What Changed (Plain English)

There's now a working contract — the part of the app that stamps each AI answer with a tamper-proof on-chain timestamp. It's been tested 10 different ways (including 256 random inputs) to make sure no one can replay an old stamp, fake a zero stamp, or rewrite a stamp once it's recorded. The contract isn't live on the testnet yet — that step needs a funded wallet, which the user has to set up next. Once the wallet is funded, the rest of the build (the SDK that calls the AI, the receipt URL, and the verifier page) can run in one pass.
