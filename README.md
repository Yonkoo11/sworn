# Sworn

**Evidence for what your AI agent said.**

When a chatbot speaks, it speaks for the company. *Moffatt v. Air Canada* (BCCRT 2024) made that legally binding — but there is no audit trail. Sworn issues a notarised, TEE-signed receipt under every AI reply, anchored on 0G Chain, persisted on 0G Storage, and re-derivable from public sources alone. The URL is the receipt. Anyone can verify it. Sworn's servers are never in the trust path.

Submitted to the **0G APAC Hackathon**.

---

## Live

| | URL |
|---|---|
| **Verifier landing** | https://yonkoo11.github.io/sworn/ |
| **Live receipt (real on-chain anchor)** | https://yonkoo11.github.io/sworn/r/543f06b4-84c0-d19b-59ca-6b22afabd8d3?k=0x6c60cf51ed0986f3334f5b33e6de53809a138aa765d5e3d5da95c19f3f9e21f2&detail=1 |
| **Receipt spec** | https://yonkoo11.github.io/sworn/spec |
| **Integrate guide** | https://yonkoo11.github.io/sworn/integrate |
| **Demo chatbot** | https://yonkoo11.github.io/sworn/demo/ |
| **On-chain anchor tx** | https://chainscan-galileo.0g.ai/tx/0x9f7321940ad19d3c0b3f1abd40d9893087ff47b78e6b39029d5930a4bdc81402 |

---

## What ships

| Surface | Path | Stack |
|---|---|---|
| Smart contracts (5, on Galileo) | `contracts/` | Solidity 0.8.24 + Foundry |
| TypeScript SDK | `sdk-ts/` | ethers v6, openai, vitest |
| Python SDK (read-only) | `sdk-py/` | web3.py + cryptography |
| Verifier (Vite + React) | `verifier-web/` | runs every check in the browser |
| Demo chatbot (Next.js static) | `demo-chatbot/` | static export under `/sworn/demo/` |
| Browser extension (Manifest v3) | `extension/` | content script + popup |

### Five live contracts on 0G Galileo testnet (chainId 16602)

| Contract | Address |
|---|---|
| ReceiptRegistry | `0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA` |
| RevocationRegistry | `0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B` |
| ReceiptDispute | `0xb8F4546e24e437779bC09c3b70ce70Ff9542bdD4` |
| CommitReveal | `0x9A6d36A0487EA52df43E7704a97F47844C4Eac4E` |
| SwornReceiptInft | `0x6c70b98613Cc567e3c1FeE9248aE58d291e3AfFA` |

50 Foundry tests across 5 contract suites, all green (including 256-run fuzz on each).

---

## The verifier runs 11 cryptographic checks in your browser

1. `anchor.exists`
2. `storage.retrievable`
3. `storage.rootHashBinding` — SHA-256 of the blob matches the on-chain rootHash
4. `storage.decrypts`
5. `body.parses` — refuses unknown schema versions, refuses chatId mismatches
6. `body.promptHash`
7. `body.responseHash`
8. `body.teeSignature`
9. `body.processResponseResult`
10. `anchor.modelHash`
11. `provider.notRevoked` — consults RevocationRegistry on every read

All re-derived from public sources at view time. No Sworn server in the trust path. Spec at https://yonkoo11.github.io/sworn/spec.

---

## The Air Canada precedent

In February 2024, the BC Civil Resolution Tribunal ruled Air Canada must honour a refund policy invented by its chatbot ([*Moffatt v. Air Canada* 2024 BCCRT 149](https://www.canlii.org/en/bc/bccrt/doc/2024/2024bccrt149/2024bccrt149.html)). The airline argued the chatbot was a separate entity. The tribunal said no: what the AI agent says is a corporate statement.

That ruling re-priced every production AI deployment. AI mistakes are now uncapped corporate liability. Sworn is the missing primitive.

---

## 0G primitive depth: 5 / 5

| Primitive | Role in Sworn |
|---|---|
| **0G Chain** | Five contracts anchor the protocol. Verifier reads from ReceiptRegistry + RevocationRegistry on every page load |
| **0G Compute (TeeML)** | LLM runs in TEE; output is signed by the TEE's private key |
| **0G Storage** | Encrypted receipt body persists at a content-addressable root |
| **0G Sealed Inference** | Ties model + input + output together via attestation |
| **ERC-7857 INFT (Sworn flavour)** | Each receipt mints a soulbound NFT — receipts become composable across AI-asset marketplaces |

---

## Run locally

```bash
pnpm install
pnpm test               # 39 SDK tests + 50 Foundry tests
pnpm build              # workspace builds (sdk + chatbot + verifier)
pnpm dev:demo           # http://localhost:3000  — demo chatbot
pnpm dev:verifier       # http://localhost:5173  — public verifier

# CLI verify
cd sdk-ts && pnpm exec tsx bin/verify.ts <chatId>

# Python verify
cd sdk-py && pip install -e . && pytest

# Issue one real receipt on Galileo (needs funded wallet)
./scripts/issue-one.sh
```

---

## Receipt schema (v1, frozen)

See `docs/PRD.md` §6 and https://yonkoo11.github.io/sworn/spec for the canonical version.

```typescript
{
  version: 1,
  chatId, chatIdHash,
  provider: { address, mode: "TeeML" | "TeeTLS", pubkeySnapshot },
  model,
  request: { promptHash, temperature, topP, seed?, messageCount },
  response: { contentHash, finishReason, promptTokens, completionTokens },
  attestation: { teeSignature, processResponseResult },
  storage: { rootHash, encrypted, encryptionScheme? },
  anchor: { chainId, txHash, blockNumber, blockTimestamp },
  issuer?: { address, label? }
}
```

V1.1 supports both **TeeML** (model-attested, strongest) and **TeeTLS** (transport-attested) with explicit labels — depth-of-attestation is never overstated.

---

## Security model (what the receipt proves and does NOT prove)

**Proves:** Provider P running model M produced output Y in response to input X at time T, signed by P's TEE private key, anchored on-chain in block B.

**Does NOT prove:** that Y is correct; that re-running X would produce Y; that the model is unbiased; that the TEE is itself secure (trust delegated to 0G's attestation chain).

The receipt is a dispute primitive, not an oracle. It tells you what happened, not whether what happened was right. For the actual dispute path, `ReceiptDispute` accepts bonded challenges and resolves via on-chain revocation state + a time window.

---

## What's deliberately NOT in V1 / V1.1

- 0G Compute live providers: blocked on 0G's testnet state. SDK is real-mode-ready; flip `SWORN_BROKER=real` when providers return.
- 0G Storage live upload: Flow contract reverts on fresh blobs as of submission. Falls back to a gh-pages mirror at `/sworn/blobs/<rootHash>.bin` with the same encrypted ciphertext.
- Insurance underwriter API surface (Vouch / Embroker integration) — V2.
- Reproducing 0G's Merkle root in the browser for the gateway path — V2.

The shipped framing is honest about every gap.

---

## License

MIT. Project repo: https://github.com/Yonkoo11/sworn.
