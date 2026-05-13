# Fix Plan — AI Receipt Layer

Atomic tasks with binary success criteria. Each task is independently verifiable; finished only when its acceptance test passes.

## Phase 1: Core Receipt Pipeline (BLOCKING — see ai/memory.md Phase 1 Gate)

- [x] **T1: Foundry project skeleton + ReceiptRegistry.sol** (commit 74e7581)
  - Files: `contracts/foundry.toml`, `contracts/src/ReceiptRegistry.sol`
  - Acceptance MET: `forge build` clean, 0 warnings

- [x] **T2: ReceiptRegistry tests (happy path + replay + zero-hash rejection)** (commit a5a7fcf)
  - Files: `contracts/test/ReceiptRegistry.t.sol`
  - Acceptance MET: 10 tests pass (including 256-run fuzz), gas reported

- [ ] **T3: Deploy ReceiptRegistry to Galileo testnet** (BLOCKED — no funded PRIVATE_KEY)
  - Files: `contracts/script/Deploy.s.sol`, `contracts/.env.example` (PREPPED, commit b68eced)
  - Acceptance: contract address recorded in `contracts/deployments/16601.json`, Explorer link in `ai/memory.md`
  - Notes: Galileo chain 16601, RPC `https://evmrpc-testnet.0g.ai`, need 0G testnet tokens
  - BLOCKER: `PRIVATE_KEY` env var not set. User must fund a Galileo wallet from 0G faucet, then `export PRIVATE_KEY=0x...` and re-run the builder.

- [ ] **T4: SDK package.json + tsconfig + types**
  - Files: `sdk-ts/package.json`, `sdk-ts/tsconfig.json`, `sdk-ts/src/types.ts`
  - Acceptance: `pnpm install` succeeds with both 0G packages installed; `pnpm tsc --noEmit` passes
  - Types: `Receipt`, `ReceiptClientOptions`, `ChatOptions`

- [ ] **T5: SDK ReceiptClient.chat() — minimum viable call**
  - Files: `sdk-ts/src/client.ts`, `sdk-ts/src/hashing.ts`
  - Acceptance: integration test against Galileo: send a 1-message chat, get back content + chatId
  - Notes: use OpenAI client with 0G broker headers; capture `ZG-Res-Key`; call `processResponse`

- [ ] **T6: SDK Storage upload + encryption**
  - Files: `sdk-ts/src/storage.ts`
  - Acceptance: integration test uploads a 1KB encrypted blob to Galileo Storage, returns rootHash + txHash; downloads, decrypts, content matches
  - Notes: AES-256-CTR client-side; user-provided key

- [ ] **T7: SDK anchor on-chain**
  - Files: `sdk-ts/src/anchor.ts`
  - Acceptance: integration test calls `recordReceipt`, transaction succeeds, `ReceiptIssued` event observed in receipt
  - Notes: ABI from forge artifacts

- [ ] **T8: SDK end-to-end ReceiptClient.chat() with attest=true**
  - Files: glue in `sdk-ts/src/client.ts`
  - Acceptance: one-call test: `client.chat({ messages, model })` returns `{ content, receipt: { url, chatId, rootHash, txHash } }`; receipt validates by re-pulling

- [ ] **T9: Verifier CLI**
  - Files: `sdk-ts/src/verifier.ts`, `sdk-ts/bin/verify.ts`
  - Acceptance: `npx verify <chatId>` against a receipt issued by SDK shows ✓ across anchor / hash / TEE signature checks. Test from a fresh shell with NO wallet config (uses public RPC only).

- [ ] **T10: PHASE 1 GATE TEST — third-party verification**
  - Files: `demo-chatbot/scripts/send-one.ts`, `verifier-web/index.html`
  - Acceptance: developer A runs `send-one.ts`, gets URL. Developer B (different machine, different wallet) pastes URL into verifier-web, sees ✓ VERIFIED with all checks green. Phase 1 Gate PASSES.

## Phase 2: Polish (BLOCKED until Phase 1 passes)

- [ ] **T11: Demo chatbot Next.js app**
- [ ] **T12: Verifier web UI (Vite, GitHub Pages)**
- [ ] **T13: GitHub Pages deploy automation**
- [ ] **T14: README EN + ZH**
- [ ] **T15: 3-minute Loom demo (Problem → Solution → Demo → Team)**
- [ ] **T16: X post draft with #0GHackathon #BuildOn0G**

## Phase 3: Hackathon Submission

- [ ] **T17: Hackquest.io submission form (after Phase 4.7 communication-pack gate)**
- [ ] **T18: Post-submission DATABASE.csv + outcome row update**

## Completed

- **T1** (commit 74e7581) — Foundry scaffold + ReceiptRegistry.sol; `forge build` clean
- **T2** (commit a5a7fcf) — 10 contract tests pass (happy path, event, replay x2, three zero-value reverts, getAnchor, isAnchored, fuzz)
- **T3 prep** (commit b68eced) — Deploy script + `.env.example` ready; awaiting funded key
