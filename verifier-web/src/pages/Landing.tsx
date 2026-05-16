import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

// Inlined from @sworn/sdk so the static page doesn't pull Node-only modules
// into the browser bundle. Behaviour kept identical to verifier.ts.
function chatIdFromInput(input: string): string {
  const prefix = "sworn://r/";
  if (input.startsWith(prefix)) return input.slice(prefix.length);
  const httpsMatch = input.match(/\/r\/([^/?#]+)/);
  if (httpsMatch) return httpsMatch[1];
  return input;
}

const EXAMPLES = [
  {
    chatId: "9a4f8d2b-1c3e-4f5a-b6d7-8e9f0a1b2c3d",
    tag: "Verified · 9 of 9 checks passed",
    desc: "Reference receipt issued by AcmeRefunds Bot under sealed inference. Carries all four 0G primitives.",
  },
  {
    chatId: "3c81fe0a-7b22-4c11-9d8e-2901f6e7a107",
    tag: "Partial · 1 skipped",
    desc: "Sealed receipt with no decryption key supplied. Demonstrates degraded but still meaningful verification.",
  },
];

export function Landing() {
  const navigate = useNavigate();
  const [input, setInput] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const raw = input.trim();
    if (!raw) return;
    const id = chatIdFromInput(raw);
    navigate(`/r/${encodeURIComponent(id)}`);
  }

  return (
    <main className="landing-wrap">
      <p className="surface-label">Public verifier · no login, no upload</p>
      <h1 className="landing-h">Re-derive any Sworn receipt from public sources.</h1>
      <p className="landing-lede">
        Paste a chatId or a <code>sworn://r/&lt;id&gt;</code> URL. Your browser will pull
        the anchor from 0G Chain and the encrypted body from 0G Storage, then run all 9
        checks locally. No Sworn server is in the trust path.
      </p>

      <form className="lookup-form" onSubmit={onSubmit}>
        <label htmlFor="lookup" className="visually-hidden">
          Receipt chatId or sworn:// URL
        </label>
        <input
          id="lookup"
          type="text"
          placeholder="Paste a chatId or sworn://r/<id>"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        <button type="submit">Inspect</button>
      </form>
      <p className="lookup-hint">
        Tip: the chatId is everything after <code>sworn://r/</code>. Hashed with keccak256,
        it is the on-chain index for the anchor.
      </p>

      <h2 className="surface-label" style={{ marginTop: 32 }}>Example receipts</h2>
      <div className="example-cards">
        {EXAMPLES.map((ex) => (
          <a key={ex.chatId} className="example-card" href={`/r/${ex.chatId}`}>
            <p className="ec-tag">{ex.tag}</p>
            <p className="ec-id">{ex.chatId}</p>
            <p className="ec-desc">{ex.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
