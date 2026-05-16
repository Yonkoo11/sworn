import { useState } from "react";
import { Link } from "react-router-dom";

export function Nav() {
  const demoUrl = (import.meta.env.VITE_DEMO_URL as string) ?? "http://localhost:3000";
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="Sworn home" onClick={close}>
          <span className="brand-glyph" aria-hidden="true">
            <svg viewBox="0 0 12 12" fill="none">
              <path
                d="M3 6l2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="brand-name">Sworn</span>
        </Link>
        <button
          type="button"
          className="nav-burger"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <>
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </>
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
        <nav id="primary-nav" className={`nav-links ${open ? "open" : ""}`} aria-label="primary">
          <Link to="/spec" onClick={close}>Spec</Link>
          <Link to="/integrate" onClick={close}>Integrate</Link>
          <a href={demoUrl} onClick={close}>Demo</a>
          <a
            href="https://github.com/Yonkoo11/sworn"
            target="_blank"
            rel="noreferrer"
            aria-label="Sworn repository on GitHub"
            onClick={close}
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
