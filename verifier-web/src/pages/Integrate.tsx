/**
 * /integrate — six-line SDK example + Python equivalent + browser extension
 * pointer. Editorial restraint, no marketing fluff.
 */
import { Link } from "react-router-dom";

export function Integrate() {
  return (
    <main className="spec-section">
      <article className="spec-frame">
        <p className="ver-surface-label">Integration · v1.1</p>
        <h1 className="spec-h">Drop Sworn into any AI agent stack.</h1>
        <p className="spec-lede">
          Same shape as the OpenAI client. The receipt URL is the dispute
          primitive your audit, legal, and insurance teams can paste anywhere.
        </p>

        <section className="spec-block">
          <h2>TypeScript / Node — production issuer</h2>
          <pre className="spec-code">{`import { ReceiptClient, generateEncryptionKey } from "@sworn/sdk";
import { Wallet, JsonRpcProvider } from "ethers";

const provider = new JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new Wallet(process.env.SWORN_KEY!, provider);

const client = new ReceiptClient({
  wallet,
  registry: "0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA",
  providerAddress: "0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08",
  providerMode: "TeeML",
  attest: true,
  receiptEncryption: "sealed",
  encryptionKey: generateEncryptionKey(),
  brokerBackend: "real",
  storageBackend: "real",
});

const { content, receipt } = await client.chat({
  messages: [{ role: "user", content: "What is your refund policy?" }],
  model: "gemma-3-27b-it",
});

console.log(content);
console.log(receipt.url);  // sworn://r/<chatId>
`}</pre>
          <p className="spec-prose">
            Flip <code>brokerBackend</code> + <code>storageBackend</code> to{" "}
            <code>"mock"</code> for local development; same receipt shape, no
            on-chain spend.
          </p>
        </section>

        <section className="spec-block">
          <h2>Python — read-only verifier</h2>
          <pre className="spec-code">{`pip install sworn-verify

from sworn_verify import verify

result = verify(
    chat_id="9a4f8d2b-1c3e-4f5a-b6d7-8e9f0a1b2c3d",
    rpc_url="https://evmrpc-testnet.0g.ai",
    registry="0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA",
    revocation="0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B",
    decrypt_key=None,  # leave None for partial verification
)

assert result.ok, result.checks  # 11 of 11 should pass for valid receipts
`}</pre>
          <p className="spec-prose">
            Covers the audience that uses AI agents from Python — LangChain,
            LlamaIndex, FastAPI services. Read-only by design: this SDK only
            verifies, it does not issue.
          </p>
        </section>

        <section className="spec-block">
          <h2>Browser extension</h2>
          <p className="spec-prose">
            Install the Sworn extension and any <code>sworn://r/</code> URL on
            any page becomes a clickable verify-badge. Receipts become a first-
            class web primitive without each site adopting a library.
          </p>
          <p className="spec-prose">
            Source: <a href="https://github.com/Yonkoo11/sworn/tree/main/extension" target="_blank" rel="noreferrer">github.com/Yonkoo11/sworn/extension</a>
          </p>
        </section>

        <section className="spec-block">
          <h2>Dispute primitive</h2>
          <p className="spec-prose">
            Any party that wants to challenge a receipt can post a bond to the{" "}
            <code>ReceiptDispute</code> contract. The challenge auto-resolves
            on-chain via revocation status and a time window; the loser's bond
            pays the winner. Sworn server-side is never the arbiter.
          </p>
          <pre className="spec-code">{`// challenger side
const tx = await disputeContract.challenge(chatIdHash, { value: parseEther("0.01") });
await tx.wait();
// wait disputeWindow blocks (~5 min on Galileo)
await disputeContract.resolve(disputeId);
`}</pre>
        </section>

        <footer className="spec-foot">
          <Link to="/spec">← Receipt spec</Link>
          <Link to="/">Verifier home →</Link>
        </footer>
      </article>
    </main>
  );
}
