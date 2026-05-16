export function Nav() {
  const verifierUrl = process.env.NEXT_PUBLIC_VERIFIER_URL ?? "http://localhost:5173";
  return (
    <header className="nav">
      <div className="nav-inner">
        <a href="/" className="brand" aria-label="Sworn home">
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
        </a>
        <nav className="nav-links" aria-label="primary">
          <a href={`${verifierUrl}/spec`}>Spec</a>
          <a href={`${verifierUrl}/integrate`}>Integrate</a>
          <a href={verifierUrl}>Verifier</a>
          <a
            href="https://github.com/Yonkoo11/sworn"
            target="_blank"
            rel="noreferrer"
            aria-label="Sworn repository on GitHub"
          >
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
