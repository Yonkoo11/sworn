# Sworn — Memory & Decisions

## Phase 1 Gate (MUST PASS BEFORE ANY OTHER WORK)

**Core Action:** Drop-in OpenAI-shaped SDK call returns a receipt URL; a third party on a different machine with a different wallet can paste the URL into the verifier and see ✓ VERIFIED.

**Success Test:**
1. `npm run send-one-message` from demo chatbot
2. URL returned
3. Open URL on different machine + wallet → verifier shows green across (anchor event, TEE signature, hash match)

**Min Tech:** TypeScript SDK, `ReceiptRegistry.sol` deployed on Galileo testnet (chain 16602), 0G Compute Gemma 3 27B provider, 0G Storage upload, verifier CLI

**NOT Phase 1:** Dispute escrow contract, browser extension, INFT wrapping, mainnet deploy, Python SDK, image/embedding receipts, multi-provider routing, batch receipts, custom-domain UI polish

**Status:** [ ] NOT STARTED

---

## Hackathon Context

- **Event:** 0G APAC Hackathon (hackquest.io)
- **Submission deadline:** 2026-05-16 23:59 UTC+8 — but user issued NO-TIME-BIAS rule (2026-05-13), so build for the strongest version not the safest one. Submit when V1 is genuinely shippable; if that misses 0G APAC, submit to next 0G event.
- **Track:** 5 (Privacy & Sovereign Infrastructure) primary; 1 (Agentic Infrastructure) secondary
- **Prize pool:** $150K — $100K Grand, $37K Excellence, $13K Community
- **Required deliverables:** GitHub repo + mainnet contract + Explorer link + ≤3min demo video + README EN/ZH + X post tagging @0G_labs

## Why This Idea (file-first reasoning)

- File source: `~/Projects/IDEAS-SUMMARY.md` #23 (Tier 2) — "zkML dispute resolver — ZK proofs that AI output came from registered model — research-stage; model size limitations"
- 0G TEE-attested sealed inference resolves the file's documented fatal flaw (heavy ZK SNARKs replaced with cheap TEE attestations)
- Archetype A4 (open-source dev/security tooling, Public Goods archetype) + A6 (privacy/sovereign primitive)
- Named precedent: Attest Protocol (Colosseum Radar PGA, A4); PayGate (ETHMumbai 2026 1st x2, A5 middleware pattern); Latinum (Colosseum Breakout AI 1st Cohort 4, A5)
- Genuine problem (Air Canada precedent: Moffatt v. Air Canada 2024 BCCRT 149)

## Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| TeeML vs TeeTLS | V1 = TeeML only | TeeTLS only attests transport, not model — would mislabel guarantee |
| Receipt persistence | 0G Storage with on-chain anchor event | Storage alone is rewriteable by provider; event anchors block timestamp |
| Privacy default | "Sealed" (AES-256-CTR encrypted, issuer holds key) | Prompts may contain PII (HIPAA, GDPR); public is opt-in |
| Replay protection | Contract mapping `chatIdHash → Anchor`; revert if already anchored | Stops re-use of old chatId for new receipt |
| Provider key rotation | Snapshot provider pubkey into receipt body at issuance | Old receipts still verifiable after rotation |
| Off-chain verifier | Re-run `broker.inference.processResponse` + read anchor event + re-hash content | Verification doesn't depend on issuer or runtime gas |
| Mainnet vs testnet | Deploy on Galileo testnet first; mainnet after V1 verified | Faster iteration; submission rules accept testnet contract + mainnet plan |

## Open Questions (P0)

1. `processResponse` offline-verifiable or live? — need to read broker source
2. Provider key rotation policy — need 0G Discord answer
3. Mainnet TeeML provider list — pc.0g.ai check
4. `processResponse` stateless or one-shot — need broker source check
5. `recordReceipt` gas cost on Aristotle mainnet — measure post-deploy

## Senior-Dev Critique Captured

(see `docs/PRD.md` sections 1-7 for the five hard pushbacks)

Five things V1 must do right or the product is hollow:
1. TeeML-only issuance, label it explicitly
2. Include temperature/seed/topP for reproducibility attempt
3. On-chain `ReceiptIssued` event at issuance time (not just Storage)
4. Snapshot provider pubkey to survive rotation
5. Drop-in OpenAI shape — devs change `baseURL` + `apiKey`, that's it

## Build Order (no time bias — pick strongest, not safest)

1. Contracts + Foundry tests (deterministic, ship first)
2. SDK + integration test against testnet
3. Verifier CLI
4. Demo chatbot (Next.js)
5. Verifier web UI
6. Deploy + README + 3-min video
7. Submit

## Banned scope-creep (will NOT add to V1)

- Browser extension (V2)
- INFT wrapping (V2)
- Python SDK (V2)
- Image gen / embeddings receipts (V2)
- Dispute escrow contract (V2)
- Insurance underwriter API (V2)
- Multi-chain support (V2)
- Batch receipts (V2)
- Custom domain / fancy UI (V2)
