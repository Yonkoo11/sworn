# CLAUDE.md — Sworn

## Phase 1 Gate (READ FIRST EVERY SESSION)

See `ai/memory.md`. Do not start Phase 2/3/4 work until Phase 1 binary test passes on a live testnet deploy.

## Plain-English Mode (user is a vibecoder)

- Say "save point" not "commit", "publish" not "push", "version" not "branch"
- Summarize terminal output in one sentence; no raw error dumps
- Describe changes by what the user sees in the app, not what files changed
- Auto-save (git add + commit) after every task — never ask
- Fix failing tests silently — don't explain test frameworks
- Update `ai/progress.md` with "What Changed (Plain English)" each session

## Banned in Output

- Words: "thorough", "comprehensive", "exhaustive", "battle-tested", "production-ready", "revolutionary", "game-changing"
- Em dashes for parenthetical phrases
- AI-slop phrases: "delve", "vibrant", "tapestry", "In today's world"

## Project Rules

- **Build order:** Contracts → SDK → Verifier → Demo → Polish. No CSS animations before Phase 1 Gate passes on live testnet.
- **0G primitive depth target:** ≥ 4/5 (see PRD §11). Removing any one breaks the demo.
- **Receipt schema is law:** v1 schema in PRD §6 is frozen. New fields = v2.
- **TeeML only in V1.** Reject TeeTLS providers at SDK level until V2 ships labels.
- **No mocks in tests.** Hit Galileo testnet for integration. Unit tests only for deterministic code (hashing, encoding).
- **Verifier must work without access to issuer wallet.** Third-party verification is the product.

## Stack

- Contracts: Foundry, Solidity 0.8.24
- SDK: TypeScript, `@0gfoundation/0g-compute-ts-sdk`, `@0gfoundation/0g-storage-ts-sdk`, ethers v6
- Demo chatbot: Next.js 14, React 18
- Verifier: same SDK + a Vite static page (GitHub Pages)
- Deploy: GitHub Pages for static; contract on Galileo testnet (chain 16601, RPC `https://evmrpc-testnet.0g.ai`)

## Sponsor Depth Targets (ENFORCED per `feedback_hackathon_deep_integration.md`)

| 0G primitive | Load-bearing role | V1 must use? |
|--------------|-------------------|--------------|
| 0G Compute (TeeML) | Model execution + TEE signature | YES |
| 0G Storage | Receipt blob persistence | YES |
| 0G Chain | `ReceiptIssued` event anchor | YES |
| 0G Sealed Inference | The signature semantics | YES (via Compute) |
| Agent ID | Issuer identity (optional) | NO (V2) |
| ERC-7857 INFT | Receipt-as-transferable-NFT | NO (V2) |

Depth target: 4/5 (V1, four load-bearing primitives). V2 reaches 5/5 with INFT wrapping.

## Files

- `docs/PRD.md` — frozen product spec
- `ai/memory.md` — decisions, status, open questions
- `ai/progress.md` — session log
- `contracts/` — Foundry project
- `sdk-ts/` — TypeScript SDK
- `verifier-web/` — Vite static verifier
- `demo-chatbot/` — Next.js demo
- `.ralph/@fix_plan.md` — atomic build task list for overnight builds
