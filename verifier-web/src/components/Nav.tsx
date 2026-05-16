import { Link } from "react-router-dom";

export function Nav() {
  const demoUrl = (import.meta.env.VITE_DEMO_URL as string) ?? "http://localhost:3000";
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="Sworn home">
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
        <nav className="nav-links" aria-label="primary">
          <Link to="/spec">Spec</Link>
          <Link to="/integrate">Integrate</Link>
          <a href={demoUrl}>Demo bot</a>
          <a href="https://github.com/Yonkoo11/sworn" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
