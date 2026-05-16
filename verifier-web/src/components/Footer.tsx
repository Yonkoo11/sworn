import { Link } from "react-router-dom";

const REGISTRY = "0xf35bE6FFEBF91AcC27A78696cf912595C6b08AAA";
const REVOCATION = "0xf9e5a9E147856D9B26aB04202D79C2c3dA4a326B";
const DISPUTE = "0xb8F4546e24e437779bC09c3b70ce70Ff9542bdD4";
const COMMIT_REVEAL = "0x9A6d36A0487EA52df43E7704a97F47844C4Eac4E";
const INFT = "0x6c70b98613Cc567e3c1FeE9248aE58d291e3AfFA";

function ExplorerLink({ addr, label }: { addr: string; label: string }) {
  return (
    <a
      href={`https://chainscan-galileo.0g.ai/address/${addr}`}
      target="_blank"
      rel="noreferrer"
      title={addr}
    >
      {label}
    </a>
  );
}

export function Footer() {
  return (
    <footer className="site-foot" aria-label="Site footer">
      <div className="site-foot-inner">
        <div className="site-foot-col">
          <p className="site-foot-cap">Sworn</p>
          <p className="site-foot-prose">
            Cryptographic receipts for AI agent replies. Anchored on 0G Chain,
            persisted on 0G Storage, re-derivable from public sources alone.
          </p>
        </div>
        <div className="site-foot-col">
          <p className="site-foot-cap">Contracts · Galileo testnet</p>
          <ul className="site-foot-list">
            <li><ExplorerLink addr={REGISTRY} label="ReceiptRegistry" /></li>
            <li><ExplorerLink addr={REVOCATION} label="RevocationRegistry" /></li>
            <li><ExplorerLink addr={DISPUTE} label="ReceiptDispute" /></li>
            <li><ExplorerLink addr={COMMIT_REVEAL} label="CommitReveal" /></li>
            <li><ExplorerLink addr={INFT} label="SwornReceiptInft" /></li>
          </ul>
        </div>
        <div className="site-foot-col">
          <p className="site-foot-cap">Docs &amp; source</p>
          <ul className="site-foot-list">
            <li><Link to="/spec">Receipt spec</Link></li>
            <li><Link to="/integrate">Integrate</Link></li>
            <li>
              <a href="https://github.com/Yonkoo11/sworn" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </li>
            <li>
              <a
                href="https://www.canlii.org/en/bc/bccrt/doc/2024/2024bccrt149/2024bccrt149.html"
                target="_blank"
                rel="noreferrer"
                title="Moffatt v. Air Canada 2024 BCCRT 149"
              >
                Moffatt v. Air Canada
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="site-foot-bottom">
        <span>MIT · 0G Galileo · chain 16602</span>
        <span>Sworn's servers are not in the trust path.</span>
      </div>
    </footer>
  );
}
