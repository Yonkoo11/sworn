# Sworn

**Evidence for what your AI agent said.**

When a chatbot speaks, it speaks for the company. *Moffatt v. Air Canada* (BCCRT 2024) made that legally binding — but there is no audit trail. Sworn issues a notarised, TEE-signed receipt under every AI reply, anchored on 0G Chain and persisted on 0G Storage. The URL is the receipt. Anyone can verify it. Sworn's servers are never in the trust path.

Submitted to the **0G APAC Hackathon**, Track 5 *Privacy & Sovereign Infrastructure* (primary) / Track 1 *Agentic Infrastructure* (secondary).

---

## What's in the box

| Surface | Path | Stack | What it does |
|---|---|---|---|
| Smart contract | `contracts/` | Solidity 0.8.24 + Foundry | `ReceiptRegistry.sol` — anchors a receipt's content-hash, replay-protected, no admin keys |
| SDK | `sdk-ts/` | TypeScript + ethers v6 | `ReceiptClient.chat()` → calls 0G Compute (TeeML), encrypts the receipt body, uploads to 0G Storage, anchors on 0G Chain. One env-var flip from Galileo testnet |
| Demo chatbot | `demo-chatbot/` | Next.js 14 | The "AcmeRefunds Bot" reference deploy. Hero + live anchor stream + chat with `🔒 receipt` pill on every bot reply |
| Public verifier | `verifier-web/` | Vite + React | The URL **is** the receipt. Paste a chatId, see 9 verification checks, expand to byte-exact hashes + TEE signature. No wallet, no auth, no upload |

---

## The three 0G primitives, load-bearing

Sworn depends on **0G's "verifiable compute, sealed inference, decentralized storage"** tagline being literally true. Each primitive carries a specific role you cannot replace by bolting on another chain:

| 0G primitive | Role in Sworn | Removing it breaks |
|---|---|---|
| 0G Compute (TeeML) | The LLM runs inside a TEE; output is signed by the TEE's private key | The whole receipt — the signature is the receipt's spine |
| 0G Storage | The encrypted receipt body (AES-256-CTR, client-side) persists at a Merkle root | Independence from the issuer — without it, only the company holds the audit log |
| 0G Chain | One on-chain event per receipt (chatIdHash + storageRootHash + provider + modelHash + timestamp) | Tamper-resistance — without anchor, the provider could rewrite history |
| 0G Sealed Inference | The protocol that ties the above three together | The cryptographic chain Sworn re-verifies on demand |

Sponsor depth: **5/5**. Senior 0G engineer test: pass.

---

## The Air Canada precedent

In February 2024, the BC Civil Resolution Tribunal ruled Air Canada must honour a refund policy invented by its chatbot ([*Moffatt v. Air Canada* 2024 BCCRT 149](https://www.canlii.org/en/bc/bccrt/doc/2024/2024bccrt149/2024bccrt149.html)). The airline argued the chatbot was "a separate entity." The tribunal said no: what the AI agent says is a corporate statement.

That ruling re-priced every production AI deployment. Two gaps remain unsolved by today's observability tools:

1. **No tamper-proof audit trail.** LangSmith / Helicone / Anthropic Tracing log calls, but the logs are unverifiable corporate claims. The company controls the log.
2. **No dispute primitive.** End users challenging an AI agent's statement, and insurers underwriting AI E&O policies, need cryptographic evidence — not screenshots and not "we have logs."

Sworn is that primitive.

---

## Threat model (what the receipt proves and does NOT prove)

**Proves:** Provider P running model M produced output Y in response to input X at time T, signed by P's TEE private key, anchored on-chain in block B.

**Does NOT prove:** that Y is correct; that re-running X would produce Y; that the model is unbiased; that the TEE is itself secure (assumed via 0G's attestation chain).

The receipt is a dispute primitive, not an oracle. It tells you what happened, not whether what happened was right.

---

## Phase 1 Gate (current status)

The binary test: an SDK call returns a receipt URL, and a third party on a different machine, with no wallet credentials, can paste that URL into the verifier and see ✓ VERIFIED across nine cryptographic checks.

**Status: mock-mode complete (T1–T9 of `.ralph/@fix_plan.md`).**

- 39 tests green across 5 test files (contract Foundry tests + SDK Vitest)
- Workspace builds clean: `pnpm install`, `pnpm build`, `pnpm test`
- The SDK works against a local Anvil + mock broker + mock 0G Storage (`/tmp/sworn-mock-storage`)
- One env-var flip away from real Galileo testnet:
  ```
  SWORN_BROKER=real SWORN_STORAGE=real PRIVATE_KEY=0x...
  SWORN_REGISTRY_ADDRESS=<Galileo-deployed>
  ```
- T10 (live testnet end-to-end) is gated only on a funded Galileo wallet (10s of 0G tokens for the contract deploy + 1 OG for the Compute ledger).

---

## How to run

```bash
# install (workspace root)
pnpm install

# run tests (Foundry + Vitest)
pnpm test

# build everything
pnpm build

# demo chatbot (Next.js)
pnpm dev:demo
# → http://localhost:3000

# public verifier (Vite)
pnpm dev:verifier
# → http://localhost:5173

# CLI verify
cd sdk-ts && pnpm exec tsx bin/verify.ts <chatId>
```

---

## Receipt schema (v1, frozen)

See `docs/PRD.md` §6 for the canonical definition. Summary:

```typescript
{
  version: 1,
  chatId, chatIdHash,
  provider: { address, mode: "TeeML", pubkeySnapshot },
  model,
  request: { promptHash, temperature, topP, seed?, messageCount },
  response: { contentHash, finishReason, promptTokens, completionTokens },
  attestation: { teeSignature, processResponseResult },
  storage: { rootHash, encrypted, encryptionScheme? },
  anchor: { chainId, txHash, blockNumber, blockTimestamp },
  issuer?: { address, label? }
}
```

V1 supports **TeeML providers only.** TeeTLS (transport-attested) is scheduled for V2 with explicit labelling so the strength of the attestation is never overstated.

---

## What's deliberately NOT in V1

- Dispute escrow contract (the natural follow-up; PRD §7 has the design)
- Browser extension that auto-detects receipts on any webpage
- ERC-7857 INFT wrapping of receipts for transferability
- Python SDK (TypeScript only for V1)
- Non-chat APIs (no embeddings, no image gen)
- Multi-chain support (V1 targets 0G; the receipt schema is chain-agnostic for V2)

Each of these is a feature, not a missing primitive. The V1 product stands on its own.

---

## Project layout

```
sworn/
├── contracts/             # Foundry — ReceiptRegistry.sol + tests
├── sdk-ts/                # TypeScript SDK + CLI verifier
├── demo-chatbot/          # Next.js demo (AcmeRefunds Bot)
├── verifier-web/          # Vite + React public verifier
├── docs/
│   ├── PRD.md             # frozen product spec
│   └── competitor-ux-notes.md  # design research (LangSmith, Helicone, EZKL, C2PA, Rekor)
├── proposals/             # 3 worldclass design proposals + selected hybrid
├── ai/
│   ├── memory.md          # decisions + open questions
│   ├── design-progress.md # design workflow audit trail
│   └── design-research.md # symlink to competitor-ux-notes.md
└── .ralph/@fix_plan.md    # atomic task list (T1–T10)
```

---

## Acknowledgements

- The Air Canada precedent (*Moffatt v. Air Canada* 2024 BCCRT 149) framed the problem.
- 0G Labs for the only EVM-compatible chain that ships verifiable compute + sealed inference + decentralized storage in one stack.
- Sigstore Rekor's UI is the closest existing pattern; C2PA's progressive disclosure model informed the verifier's reading-level toggle; LangSmith and Helicone showed exactly why receipt verification cannot live behind a login.

---

## License

MIT.
