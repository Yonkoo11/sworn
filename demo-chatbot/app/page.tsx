import { Nav } from "./components/Nav";
import { AnchorStream } from "./components/AnchorStream";
import { ChatPanel } from "./components/ChatPanel";
import { buildAnchorRows } from "../lib/mock-anchors";

// Static export: the page is fully static. The "current-minute" seed is
// generated once at build time and the live ticker (client component) takes
// over for animated freshness once hydrated.
export default function Home() {
  const now = Date.now();
  const seed = Math.floor(now / 60_000);
  const initialRows = buildAnchorRows({ count: 6, seed, nowMs: now });

  return (
    <>
      <Nav />
      <main>
        <section className="section-inner">
          <p className="surface-label">Demo · every reply produces a receipt</p>
          <h1 className="hero-h">Evidence for what your AI agent said.</h1>
          <p className="hero-lede">
            When a chatbot speaks, it speaks for the company. Sworn issues a notarised,
            TEE-signed receipt under every AI reply, anchored on 0G Chain and persisted on
            0G Storage. The URL is the receipt; anyone can verify it.
          </p>

          <div className="hero-meta">
            <div className="item">
              <p>Anchor</p>
              <strong>0G Chain · Galileo</strong>
            </div>
            <div className="item">
              <p>Inference</p>
              <strong>TeeML sealed</strong>
            </div>
            <div className="item">
              <p>Schema</p>
              <strong>v1 frozen</strong>
            </div>
          </div>

          <AnchorStream initial={initialRows} />

          <ChatPanel />
        </section>

        <footer className="colophon">
          <p className="colophon-citation">
            Citation · <em>Moffatt v. Air Canada</em>, 2024 BCCRT 149. The tribunal held
            that what a customer-service chatbot says is a corporate statement.
          </p>
          <p className="colophon-meta">
            Open source · MIT ·{" "}
            <a href="https://github.com/yonko/sworn" target="_blank" rel="noreferrer">
              github.com/yonko/sworn
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}
