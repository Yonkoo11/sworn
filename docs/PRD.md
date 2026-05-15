# Sworn — Product Requirements Document

**Status:** Draft v0.1 (2026-05-13)
**Hackathon:** 0G APAC Hackathon, Track 5 Privacy & Sovereign Infrastructure (primary) / Track 1 Agentic Infrastructure (secondary)
**Author:** yonkoo11

---

## 1. Problem Statement

In February 2024, the BC Civil Resolution Tribunal ruled Air Canada must honour a refund policy invented by its customer-service chatbot (Moffatt v. Air Canada, 2024 BCCRT 149). The airline argued the chatbot was a "separate entity." The tribunal ruled it isn't — what the AI agent says is a corporate statement, and the company is liable for it.

That ruling re-priced every production AI deployment. AI mistakes are now uncapped corporate liability. Two structural gaps follow:

1. **No tamper-proof audit trail.** When an AI agent gives wrong information, neither the user nor the company can produce cryptographic evidence of what the agent saw or said. LangSmith / Helicone / Anthropic Tracing log calls but the logs are unverifiable corporate claims — the company controls the log.
2. **No dispute primitive.** When a user wants to challenge an AI agent's statement (refund denied based on AI advice, medical triage missed, financial recommendation wrong), there is no chain of evidence to submit. Insurance underwriters writing AI E&O policies (Vouch, Embroker, Munich Re) have nothing to underwrite against.

The EU AI Act (compliance phases through 2026) and NIST AI RMF require audit trails for high-risk AI deployments. Vendors today have logs; they do not have evidence.

## 2. What we ship

**Sworn** — a drop-in OpenAI-compatible SDK that wraps any LLM call to 0G Compute (TeeML mode), produces a cryptographic receipt anchored on 0G Chain, persisted on 0G Storage, verifiable by any third party.

Receipt = `{ chatId, providerAddress, model, promptHash, responseHash, temperature, seed, topP, timestamp, teeSignature, storageRootHash, txHash }`. The receipt is the dispute primitive.

Three components:
1. **SDK** (`@sworn/sdk` TS). One-line replacement for the OpenAI client. Receipts emit by default; opt-out per call.
2. **Registry contract** (`ReceiptRegistry.sol`). Anchors each receipt with an on-chain event. Maps `chatIdHash → storageRootHash`. One function: `recordReceipt`.
3. **Verifier** (web page + CLI). Takes a receipt URL or chatId, pulls from 0G Storage, re-runs `broker.inference.processResponse`, shows verification chain (storage Merkle proof → TEE signature → provider attestation key → contract anchor event).

## 3. Audience (three concentric)

| Tier | Audience | Why they care |
|------|----------|---------------|
| 1 | Production-AI-agent teams (customer support, healthcare triage, fintech advice, coding agents) | Air Canada precedent makes them liable; need defensible audit trail |
| 2 | AI E&O insurance underwriters (Vouch, Embroker, Munich Re Re) | Cannot underwrite without verifiable claims data |
| 3 | End users disputing AI-agent statements | Need provable evidence to file CRT / small-claims / FTC complaints |

Hackathon demo focuses on Tier 1; pitches Tier 2 + Tier 3 in the README.

## 4. Threat Model

| Adversary | Attack | Mitigation |
|-----------|--------|-----------|
| User | Forges a receipt claiming the chatbot said X | chatId is provider-TEE-signed; can't forge without compromising TEE |
| Company | Forges a receipt to override user claim | Both parties pull from the same on-chain anchor + Storage rootHash |
| Provider colludes with company | Retroactively rewrites a receipt | `ReceiptIssued` event with `block.timestamp` anchors original; provider can mint a new receipt but not rewrite the event |
| Provider goes offline | User can't dispute | Receipt persists on 0G Storage independently of provider; verifier reads from Storage |
| Replay (same chatId reused) | Adversary submits old receipt as new | Registry contract: `require(receipts[chatIdHash].storageRootHash == 0)` — one chatId, one rootHash, ever |
| Receipt-of-receipt | Bad-faith link points to fake URL | The contract anchor event is source of truth; URL is a convenience pointer |
| Provider key rotation | Old receipts unverifiable | Snapshot provider pubkey into the receipt itself at issuance time |

**What the receipt proves:** "Provider P running model M produced output Y in response to input X at time T, signed by P's TEE private key, anchored on-chain in block B."

**What the receipt does NOT prove:** that Y is correct; that re-running X would produce Y; that the model is unbiased; that the provider's TEE is itself secure (assumed via 0G's attestation chain).

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│ Developer Code                                                       │
│   import { ReceiptClient } from "@sworn/sdk"             │
│   const client = new ReceiptClient({ wallet, attest: true })        │
│   const { content, receiptUrl } =                                   │
│     await client.chat({ messages, model: "gemma-3-27b" })           │
└──────────────────┬──────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ ReceiptClient SDK (TypeScript)                                       │
│   1. broker = createZGComputeNetworkBroker(wallet)                  │
│   2. broker.inference.acknowledgeProviderSigner(provider)           │
│   3. broker.inference.transferFund(provider, "inference", 1e18)     │
│   4. headers = broker.inference.getRequestHeaders(provider, query)  │
│   5. response = await openai.chat.completions.create(...)           │
│   6. isValid = broker.inference.processResponse(provider, chatId, …)│
│   7. assemble Receipt object                                        │
│   8. encrypt + upload to 0G Storage  →  rootHash                    │
│   9. contract.recordReceipt(chatIdHash, rootHash, ...)              │
│   10. return { content, receiptUrl: "https://receipt.../" + chatId }│
└──────────────────┬──────────────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   0G Compute   0G Storage  0G Chain (Aristotle/Galileo)
   (TeeML)     (encrypted)  ReceiptRegistry.sol
```

Verifier flow:
```
User pastes receipt URL or chatId
   ↓
1. Read on-chain event log for ReceiptIssued(chatIdHash)
   → confirms anchor block + rootHash + provider
2. Download Storage rootHash → encrypted Receipt blob
3. Decrypt with user key (if private) OR public if owner published
4. Re-run broker.inference.processResponse(provider, chatId, content)
   → returns boolean
5. Display: ✓ VERIFIED  (or ✗ with specific failure reason)
```

## 6. Receipt Schema (v1)

```typescript
interface Receipt {
  version: 1;
  chatId: string;              // ZG-Res-Key header from provider response
  chatIdHash: string;          // keccak256(chatId), for indexing
  provider: {
    address: string;           // 0x69Eb... etc
    mode: "TeeML" | "TeeTLS";  // V1: TeeML only
    pubkeySnapshot: string;    // provider's attestation pubkey at issuance
  };
  model: string;               // "gemma-3-27b-it" etc
  request: {
    promptHash: string;        // sha256 of the canonicalised messages
    temperature: number;
    seed?: number;
    topP: number;
    messageCount: number;
  };
  response: {
    contentHash: string;       // sha256 of completion text
    finishReason: string;
    promptTokens: number;
    completionTokens: number;
  };
  attestation: {
    teeSignature: string;      // raw signature from response
    processResponseResult: boolean;  // 0G's verifier output at issuance
  };
  storage: {
    rootHash: string;          // 0G Storage Merkle root
    encrypted: boolean;
    encryptionScheme?: "AES-256-CTR" | "ECIES";
  };
  anchor: {
    chainId: number;           // 16602 testnet / 16661 mainnet
    txHash: string;
    blockNumber: number;
    blockTimestamp: number;
  };
  issuer?: {
    address: string;           // wallet that called recordReceipt
    label?: string;            // optional human-readable label ("Acme Support Bot v3")
  };
}
```

Privacy modes:
- **Public receipt**: full Receipt body uploaded plaintext to 0G Storage. Anyone with chatId can verify.
- **Sealed receipt** (default): Receipt body AES-256-CTR encrypted client-side. Issuer holds key. Verification still possible because hashes + signatures + anchor remain checkable; only `prompt` and `response` plaintext are hidden until issuer reveals.

## 7. Contracts

### ReceiptRegistry.sol (v1)

```solidity
pragma solidity ^0.8.24;

contract ReceiptRegistry {
    struct Anchor {
        bytes32 storageRootHash;
        address provider;
        address issuer;
        uint64 blockTimestamp;
        bytes32 modelHash; // keccak256(model_string)
    }

    mapping(bytes32 => Anchor) public anchors; // chatIdHash → Anchor

    event ReceiptIssued(
        bytes32 indexed chatIdHash,
        bytes32 indexed storageRootHash,
        address indexed provider,
        address issuer,
        bytes32 modelHash,
        uint64 blockTimestamp
    );

    error AlreadyAnchored(bytes32 chatIdHash);

    function recordReceipt(
        bytes32 chatIdHash,
        bytes32 storageRootHash,
        address provider,
        bytes32 modelHash
    ) external {
        if (anchors[chatIdHash].storageRootHash != bytes32(0)) {
            revert AlreadyAnchored(chatIdHash);
        }
        anchors[chatIdHash] = Anchor({
            storageRootHash: storageRootHash,
            provider: provider,
            issuer: msg.sender,
            blockTimestamp: uint64(block.timestamp),
            modelHash: modelHash
        });
        emit ReceiptIssued(
            chatIdHash,
            storageRootHash,
            provider,
            msg.sender,
            modelHash,
            uint64(block.timestamp)
        );
    }

    function isAnchored(bytes32 chatIdHash) external view returns (bool) {
        return anchors[chatIdHash].storageRootHash != bytes32(0);
    }
}
```

That's the entire V1 contract. Single function, single event, replay-resistant via mapping check, no admin keys.

### ReceiptDispute.sol (v2, not now)
Escrow + automatic resolution by re-running verifier. Out of scope for V1.

## 8. SDK Surface (V1)

```typescript
import { ReceiptClient } from "@sworn/sdk";
import { ethers } from "ethers";

const wallet = new ethers.Wallet(privateKey, provider);

const client = new ReceiptClient({
  wallet,
  registry: "0x...",          // deployed ReceiptRegistry.sol
  providerAddress: "0x69Eb...aE08", // Gemma 3 27B TeeML
  attest: true,                // emit receipts; can be false per call
  receiptEncryption: "sealed", // "public" | "sealed" (default)
});

const { content, receipt } = await client.chat({
  messages: [{ role: "user", content: "What's your refund policy?" }],
});

console.log(content);            // the AI response
console.log(receipt.url);        // https://receipt.airl.dev/r/<chatId>
console.log(receipt.txHash);     // on-chain anchor
console.log(receipt.rootHash);   // 0G Storage rootHash
```

Single-call API. Drop-in shape mirrors OpenAI's `.chat.completions.create`.

## 9. Verifier Surface (V1)

CLI:
```bash
npx @sworn/verify <chatId>
# or
npx @sworn/verify <receiptUrl>
```

Output:
```
Receipt: <chatId>
  Anchor:    block 18234567 @ 2026-05-13 14:23 UTC (0x abc...def)
  Provider:  0x69Eb...aE08 (Gemma 3 27B, TeeML mode)
  Storage:   0G Storage rootHash 0x... (encrypted: yes / no)
  Hash check:
    promptHash:   ✓ matches stored
    responseHash: ✓ matches stored
  TEE signature: ✓ valid via broker.inference.processResponse
  Anchor event:  ✓ found at expected block
Result: VERIFIED ✓
```

Web verifier: same flow at `https://receipt.<domain>/r/<chatId>`.

## 10. Demo Flow (60-second judge run)

1. Judge opens `https://receipt-demo.<domain>` — a customer-service chatbot for "AcmeRefunds Co"
2. Judge asks: "What's your refund policy for damaged goods?"
3. Bot replies (real LLM call via 0G Compute Gemma 3 27B TeeML). Receipt link appears under the bot message.
4. Judge clicks "Dispute this answer" — copies the receipt URL
5. Judge opens `https://receipt-verify.<domain>/r/<chatId>` — sees the verification chain (anchor block, TEE signature OK, content hash OK)
6. Judge clicks the 0G Explorer link — sees the `ReceiptIssued` event on-chain

Total click-path: ~6 clicks, ~45 seconds. No words required.

## 11. Non-Goals (V1)

- We are NOT proving the AI's answer is correct.
- We are NOT building a TEE attestation chain — 0G's is the source of trust.
- We are NOT supporting TeeTLS in V1 (transport-attested ≠ model-attested; would mislabel guarantees).
- We are NOT supporting non-chat APIs in V1 (no embeddings, image gen, etc.)
- We are NOT building the dispute escrow contract in V1.
- We are NOT building the browser extension in V1.

## 12. Success Metrics

| Metric | V1 target | Source |
|--------|-----------|--------|
| End-to-end demo works on testnet (Galileo) | Yes | Phase 1 Gate |
| Receipt verifiable by third party with no access to issuer's wallet | Yes | Verifier test |
| `recordReceipt` revert on replay | Yes | Foundry test |
| One reference customer-service chatbot live | Yes | Demo deploy |
| 0G primitive depth | ≥ 4/5 | Self-audit per skill rule |
| Submission to 0G APAC hackathon | Submitted | Phase 4.5 |

## 13. Open Questions (P0 to verify before code)

1. Is `broker.inference.processResponse` offline-verifiable, or does it need a live call to the provider? If round-trip, what happens when the provider is offline?
2. Provider key rotation policy — what happens to old receipts when a provider rotates keys?
3. Mainnet (Aristotle) provider list — are there TeeML providers on mainnet, or testnet-only at submission time?
4. `processResponse` semantics — stateless or one-shot per chatId?
5. Gas cost of `recordReceipt` on mainnet — does batching make sense?

I will document the answer for each in `ai/memory.md` as I find it. V1 scaffold proceeds with the conservative assumption (worst-case for each).

## 14. Phase 1 Gate (BLOCKING — must pass before any V2 work)

**Core action:** A developer running `npm install @sworn/sdk`, dropping in 5 lines of code, gets back a receipt URL that a third party can verify on the verifier page.

**Binary test:**
1. Run the demo chatbot's `npm run send-one-message` script
2. Receive a receipt URL
3. Open the URL in incognito Chrome on a different machine with a different wallet
4. Verifier shows ✓ VERIFIED with the anchor block, model, and TEE check all green

If step 4 is red on any sub-check, Phase 1 has not passed.

## 15. Build Order (no time bias)

1. Contracts: `ReceiptRegistry.sol` + Foundry tests for replay-resistance + happy path
2. SDK: TypeScript `ReceiptClient` wrapping `@0gfoundation/0g-compute-ts-sdk` + `@0gfoundation/0g-storage-ts-sdk`
3. Verifier: CLI first, web second
4. Demo chatbot: minimal Next.js page calling the SDK
5. Deploy: contract on Galileo testnet, demo on GitHub Pages, verifier on GitHub Pages
6. README + 3-min Loom + X post
7. Submit
