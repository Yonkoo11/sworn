/**
 * /spec — the published receipt spec. Editorial restraint: this page is the
 * spec doc itself, not a marketing page about the spec. Linear-changelog,
 * Stripe-Press ethos.
 */
import { Link } from "react-router-dom";

const REGISTRY = "0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA";
const REVOCATION = "0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B";
const DISPUTE = "0xb8F4546e24e437779bC09c3b70ce70Ff9542bdD4";
const COMMIT_REVEAL = "0x9A6d36A0487EA52df43E7704a97F47844C4Eac4E";
const INFT = "0x6c70b98613Cc567e3c1FeE9248aE58d291e3AfFA";

function ExpAddr({ to }: { to: string }) {
  return (
    <a
      href={`https://chainscan-galileo.0g.ai/address/${to}`}
      target="_blank"
      rel="noreferrer"
    >
      <code>{to}</code>
    </a>
  );
}

export function Spec() {
  return (
    <main className="spec-section">
      <article className="spec-frame">
        <p className="ver-surface-label">Specification · v1.1</p>
        <h1 className="spec-h">
          Sworn receipt schema and verification chain.
        </h1>
        <p className="spec-lede">
          A Sworn receipt is a TEE-signed record of one AI agent reply,
          anchored on 0G Chain, persisted on 0G Storage, and re-derivable from
          public sources alone. This page is the canonical spec the verifier
          implements.
        </p>

        <section className="spec-block">
          <h2>1. Receipt body (v1, JSON)</h2>
          <p className="spec-prose">
            One JSON object per receipt. Schema is frozen; unknown{" "}
            <code>version</code> values cause the verifier to refuse to render.
          </p>
          <pre className="spec-code">{`{
  "version": 1,
  "chatId": "9a4f8d2b-1c3e-4f5a-b6d7-8e9f0a1b2c3d",
  "chatIdHash": "0x<keccak256(chatId)>",
  "provider": {
    "address": "0x69EbE4...",
    "mode": "TeeML" | "TeeTLS",
    "pubkeySnapshot": "0x<Ed25519 pubkey at issuance>"
  },
  "model": "gemma-3-27b-it",
  "request": {
    "promptHash": "sha256:<hex>",
    "temperature": 1.0,
    "topP": 1.0,
    "seed": null | <int>,
    "messageCount": 2
  },
  "response": {
    "contentHash": "sha256:<hex>",
    "finishReason": "stop",
    "promptTokens": 18,
    "completionTokens": 42
  },
  "attestation": {
    "teeSignature": "0x<provider signature over chatId|content>",
    "processResponseResult": true
  },
  "storage": {
    "rootHash": "0x<32 bytes>",
    "encrypted": true,
    "encryptionScheme": "AES-256-CTR"
  },
  "anchor": {
    "chainId": 16602,
    "txHash": "0x<spliced at verify time from ReceiptIssued log>",
    "blockNumber": <int>,
    "blockTimestamp": <epoch>
  },
  "issuer": { "address": "0x...", "label": "AcmeRefunds Bot" }
}`}</pre>
        </section>

        <section className="spec-block">
          <h2>2. Attestation tiers</h2>
          <p className="spec-prose">
            <strong>TeeML</strong> is the strongest tier: the model itself runs
            inside the TEE, so the provider's signature binds input hash,
            output hash, and model identity to the same execution. A judge
            sees "model-attested" on the verifier page.
          </p>
          <p className="spec-prose">
            <strong>TeeTLS</strong> is the weaker tier: the TEE proxies an
            upstream provider's response over TLS. The attestation binds the
            transport, not the model run. A judge sees "transport-attested"
            with an amber tone. Sworn supports both tiers but never conflates
            them.
          </p>
        </section>

        <section className="spec-block">
          <h2>3. Verification chain (11 checks, all run in the browser)</h2>
          <ol className="spec-checks">
            <li><code>anchor.exists</code> — registry.getAnchor(chatIdHash) returns non-zero rootHash.</li>
            <li><code>storage.retrievable</code> — blob downloadable from 0G Storage gateway or Sworn /blobs/ mirror.</li>
            <li><code>storage.rootHashBinding</code> — for the mirror path, sha256(blob) equals anchor.storageRootHash.</li>
            <li><code>storage.decrypts</code> — AES-256-CTR opens with supplied <code>?k=</code> key (or skipped if absent).</li>
            <li><code>body.parses</code> — JSON parses, version equals 1, body.chatId matches URL chatId.</li>
            <li><code>body.promptHash</code> — sha256 of canonicalised messages.</li>
            <li><code>body.responseHash</code> — sha256 of completion text.</li>
            <li><code>body.teeSignature</code> — Ed25519 signature over chatId|content bound to provider.pubkeySnapshot.</li>
            <li><code>body.processResponseResult</code> — true at issuance.</li>
            <li><code>anchor.modelHash</code> — keccak256(model_string) equals on-chain modelHash.</li>
            <li><code>provider.notRevoked</code> — RevocationRegistry has no entry for provider at or before anchor.blockNumber.</li>
          </ol>
        </section>

        <section className="spec-block">
          <h2>4. Deployed contracts (Galileo testnet, chainId 16602)</h2>
          <ul className="spec-addrs">
            <li>ReceiptRegistry · anchor receipts · <ExpAddr to={REGISTRY} /></li>
            <li>RevocationRegistry · provider revocation list · <ExpAddr to={REVOCATION} /></li>
            <li>ReceiptDispute · bond-backed challenge escrow · <ExpAddr to={DISPUTE} /></li>
            <li>CommitReveal · prompt-hash time-binding · <ExpAddr to={COMMIT_REVEAL} /></li>
            <li>SwornReceiptInft · soulbound receipt-as-NFT (ERC-7857 flavour) · <ExpAddr to={INFT} /></li>
          </ul>
        </section>

        <section className="spec-block">
          <h2>5. Threat model (what the receipt proves and does NOT prove)</h2>
          <p className="spec-prose">
            <strong>Proves.</strong> Provider P running model M produced output Y in
            response to input X at time T, signed by P's TEE private key,
            anchored on-chain in block B.
          </p>
          <p className="spec-prose">
            <strong>Does NOT prove.</strong> That Y is correct; that re-running X
            would produce Y (LLM outputs are non-deterministic); that the
            model is unbiased; that the TEE is itself secure (trust delegated
            to 0G's attestation chain).
          </p>
          <p className="spec-prose">
            The receipt is a dispute primitive, not an oracle. It tells you
            what happened, not whether what happened was right.
          </p>
        </section>

        <section className="spec-block">
          <h2>6. Independence guarantee</h2>
          <p className="spec-prose">
            Every check on this page is re-derived from public sources at view
            time. Sworn's servers are not in the trust path. If Sworn
            disappears tomorrow, the receipt still verifies from:
          </p>
          <ul className="spec-addrs">
            <li>0G Storage gateway → blob bytes</li>
            <li>0G Chain RPC → anchor event</li>
            <li>provider's TEE attestation key → signature check</li>
            <li>browser's Web Crypto → all hashing</li>
          </ul>
        </section>

        <footer className="spec-foot">
          <Link to="/">← Back to verifier</Link>
          <Link to="/integrate">Integrate Sworn in your stack →</Link>
        </footer>
      </article>
    </main>
  );
}
