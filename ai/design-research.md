# Competitor UX Notes — Verifier / Trace / Trust-Chain UIs

**Status:** Research notes (2026-05-13)
**Purpose:** Steal what works, deliberately diverge where we should own the differentiator.

Five products studied: LangSmith, Helicone, EZKL, C2PA Content Credentials, Sigstore Rekor.

Method: WebFetch + live Puppeteer capture where the UI rendered. Where a page was behind auth or did not render publicly, that fact is itself a finding.

---

## 1. LangSmith — single-trace detail page

URLs cited:
- https://docs.langchain.com/langsmith/observability-concepts
- https://docs.langchain.com/langsmith/share-trace

### What we found

- Trace is a tree of "runs." Each run has inputs, outputs, metadata (free-form key/value), tags. The UI renders this as a hierarchical run tree on the left and a detail pane on the right (standard pattern).
- **Public share trace is a real, named feature.** Click the vertical-dots menu on any trace, hit "Share", copy a public link. No account needed to view. Read-only. Can be revoked at Settings → Shared URLs.
- Self-hosted deployments restrict public links to VPC members. Sharing on the SaaS is wide-open by default.
- Documentation explicitly warns: "Sharing a trace publicly will make it accessible to anyone with the link. Make sure you're not sharing sensitive information." Operators carry the disclosure burden.
- The conceptual unit shown to viewers: a single operation, decomposed into its sequence of model calls and tool calls. Inputs, outputs, metadata.

### What is NOT publicly documented

- Color coding for success vs error states.
- How long completions are truncated or expanded.
- Whether prompts get markdown rendering vs JSON pretty-print.
- Metadata field list (tokens, latency, cost) — referenced but never enumerated on the public docs.

This is itself a finding: **LangSmith treats the trace UI as a behind-login product surface.** The public docs are conceptual. Implication for us: a public-by-default verifier is a real differentiator, not a parity feature.

### Patterns to consider

- Share-via-URL with no auth required (steal).
- Explicit "this is public, careful with secrets" disclosure on the share dialog (steal).
- Centralized "Shared URLs" management panel for revocation (steal — important for trust).
- Hierarchical run tree on the left, detail pane on the right (steal for any multi-step receipt).

---

## 2. Helicone — observability dashboard

URLs cited:
- https://www.helicone.ai/
- https://www.helicone.ai/pricing
- https://docs.helicone.ai/features/sessions
- https://docs.helicone.ai/use-cases/debugging

### What we found

- Dashboard sections: Requests, Segments, Sessions, Users, HQL (their query language), Prompts, Datasets, Playground, Rate Limits, Alerts.
- Sessions group related requests with parent-child paths. Same hierarchy pattern as LangSmith.
- Pricing is a 4-tier ladder: Hobby (free, 10K requests), Pro ($79/mo, "POPULAR"), Team ($799/mo, "BEST VALUE", SOC-2 + HIPAA), Enterprise (custom). Interactive cost calculator on the page.
- Trust signals on the pricing page: real customer logos (Sunrun, QAWolf, Filevine), outcome metrics ("Saved 386 hours by using cached responses"), compliance badges (SOC-2, HIPAA) — all at the Team tier, not Pro.
- Filter UI uses status-code filtering for errors. They mention "dedicated error filters" are still being developed.

### What is NOT publicly documented

- The actual request-detail card layout (fields, expand/collapse, color).
- Whether single requests are shareable by URL. Their landing surface and docs do not show this.

Implication: **Helicone, like LangSmith, keeps the receipt-equivalent surface behind login.** No public verifier exists at either.

### Patterns to consider

- HQL query language for log slicing (probably overkill for V1).
- Compliance-badge placement adjacent to enterprise tier (steal for our enterprise pitch page, not V1).
- Outcome metrics in customer logos block ("X hours saved", not "X% improvement") — concrete numbers, no adjectives (steal for any landing page).
- 4-tier pricing with one "POPULAR" and one "BEST VALUE" stamp (steal pattern).

---

## 3. EZKL — zkML proving and verification

URLs cited:
- https://ezkl.xyz/
- https://app.ezkl.xyz/
- https://docs.ezkl.xyz/
- https://github.com/zkonduit/ezkl
- https://cryptoidol.tech/

### What we found

- Landing copy is outcome-language, not crypto-language: "Guarantee AI Integrity," "Verify that AI models are running exactly as intended, without compromise." Partners on top: MIT, Microsoft, Circle.
- 3-step process narrative: Import → Generate → Deploy. They never say "proof" prominently on the landing.
- **No public verifier playground.** The app at app.ezkl.xyz is a deployment/model-upload surface, not a "paste a proof, see verified/failed" page.
- Third-party reference apps exist (cryptoidol.tech) but no canonical hosted verifier.
- Docs mention "Anyone with the verification key can verify the proof" but do not describe a hosted verification UI.
- Verification happens via CLI or programmatic API. Non-technical viewers have no path.

### Pattern this exposes

- **The biggest UX gap in zk-proof systems is the absent verifier-for-humans.** A non-technical viewer cannot independently confirm anything. They must trust the issuing party's word that the proof verified.
- EZKL's language pattern (outcomes, not crypto-jargon) is good and worth stealing — but the lack of a public verifier is the gap to attack.

### Patterns to consider

- Outcome language on the landing ("AI did what it said" not "Merkle-anchored signature verified") — **steal**.
- Partner logos high on the page when partners are reputable — steal if we have any.
- The absent hosted verifier — **deliberately differentiate**. Our verifier is the product.

---

## 4. C2PA Content Credentials — verify.contentauthenticity.org

URLs cited:
- https://verify.contentauthenticity.org/
- https://contentcredentials.org/
- https://contentauthenticity.org/how-it-works
- https://opensource.contentauthenticity.org/docs/getting-started/

### What we found (live capture)

Landing page (captured):
- Two columns: large heading + supporting copy on the left, dashed-border drop zone on the right.
- Heading: "Inspect content to dig deeper."
- Body: "Drag content into Verify to inspect its Content Credentials in detail and see how it has changed over time."
- Important honesty line: "Content Credentials are still rolling out, so the content you choose to inspect may not have information to view." They preempt the empty-result case.
- Footer: language picker (~22 languages — strong international posture).
- The drop zone accepts AVI, AVIF, DNG, HEIC, HEIF, JPEG, M4A, MOV, MP3, MP4, PDF, PNG, SVG, TIFF, WAV, WebP. Format breadth telegraphs "we work everywhere."

The result page did not render via deep-link (`?source=...` returned 404 / fallback). Content loads client-side from the dropped file, not from a URL parameter. **This is a finding: the C2PA verifier is not URL-shareable for a specific verified result.** A viewer must possess the file and drop it in.

### What the C2PA spec defines for UI

From their open-source docs, the spec recommends four progressive disclosure levels for any verifier UI:

- **Level 1:** Indicates that manifest data is present and whether it has been validated. (The "pin" badge.)
- **Level 2:** Summarizes provenance (who, when, what tools).
- **Level 3:** Detailed manifest display (all assertions, ingredients, edit history).
- **Level 4:** Full signature and trust-signal details — certificate chain, hash values, raw bytes.

The verifier defaults the viewer to Level 2-3. Level 4 is opt-in, behind expansion.

Trust chain renders as: **claim signer (the app) → certificate authority → root.** AI tool labels are first-class (Generative AI ingredients flagged explicitly). Edit history renders as a timeline of "ingredients" (parent media + assertion = how this was made).

### Patterns to consider

- **The four-level disclosure model is the single most useful pattern in this entire research pass.** Steal it directly. Default the receipt page to Level 2-3 (who issued, when, that it verifies); put hashes, signatures, raw bytes behind an expand control.
- "Pin" badge for content provenance (steal the concept: a single visual atom that means "verified receipt exists").
- Preempt the empty case in the landing copy ("you may not have info to view") — honest, defuses bounce.
- Format breadth as a trust signal — listing every input format adjacent to the dropzone (steal for our verifier: list every chain/storage source we support).

### Patterns to deliberately diverge from

- **Drop-the-file UX without URL shareability is wrong for us.** Receipts are blob URLs; the verifier must accept a URL parameter and render the page. C2PA's choice makes sense for images (private content); ours makes sense for AI calls (auditor needs to forward the link).
- 22-language i18n is over-engineering for V1 of a dev-tool product.

---

## 5. Sigstore Rekor — search.sigstore.dev

URLs cited:
- https://search.sigstore.dev/
- https://search.sigstore.dev/?logIndex=158606428 (live capture below)
- https://docs.sigstore.dev/logging/overview/
- https://github.com/sigstore/rekor-search-ui

### What we found (live capture)

The page IS URL-shareable. `?logIndex=N` fully loads a specific entry. This is the model we want.

Layout, top to bottom:
1. Top bar: small Sigstore-Rekor logo (purple hex), centered "Rekor Search" title, settings + GitHub icons on the right. Minimal chrome.
2. Search card: white card, two fields ("Attribute" dropdown defaulting to Log Index, value input), blue SEARCH button. Same search bar persists below results — you stay grounded.
3. "Showing 1 - 1 of 1" results count.
4. **Entry card**, white background, sections separated by thin horizontal rules. Top row of the card is a small metadata header `Entry UUID: <full hex hash, linkified>`.
5. Three-column metadata strip: `TYPE` (intoto), `LOG INDEX` (linkified, 158606428), `INTEGRATED TIME` (relative + absolute: "a year ago (2025-01-01T03:35:08+01:00)"). Both relative and absolute timestamps — important UX choice.
6. **Hash** section: heading + dark monospace code block, full sha256 hash visible inline.
7. **Signature** section: dark monospace block. For this intoto entry, it says "Missing for intoto v0.0.1 entries." They show the absence rather than hide the field.
8. **Public Key Certificate** section: large dark code block with syntax-colored YAML. Includes serial number, issuer (`O=sigstore.dev, CN=sigstore-intermediate`), validity window (Not Before / Not After, both absolute timestamps), algorithm (ECDSA P-256), and the long X509v3 extensions block with subject alternative name, OIDC issuer, GitHub workflow trigger / SHA / repo / ref / runner environment.
9. Below: Raw Body, Attestation, Verification tabs/sections (loaded lazily on scroll).

### Specific design choices worth naming

- **Default-expanded full data, no "click to expand."** This is the polar opposite of C2PA's progressive-disclosure model. Rekor is for engineers; C2PA is for the public. Both are correct for their audience.
- **Dark monospace code blocks for cryptographic values.** Strong visual atom for "this is the receipt, byte-exact." Light page chrome, dark proof cards.
- **Linkified hashes and log indices.** Every identifier is a navigable link. Means you can walk the trust chain by clicking.
- **Both relative + absolute timestamps** ("a year ago (2025-01-01T03:35:08+01:00)"). Steal directly.
- **Show "Missing" rather than hide.** When a field is absent for this entry version, they say so. This builds trust — no fields are quietly omitted.
- **The cert chain is rendered as readable YAML, not hex.** Issuer, validity, algorithm, subject all named. The raw bytes (X509 extension blob) is shown after the named fields. Best-of-both.
- **No "Verified ✓" green badge anywhere on this entry.** Verification is implicit: the entry is in the log, the cert is shown, the viewer derives trust from the data. No theater. (For our audience this may be wrong — see decisions below.)

### Patterns to steal

- URL is the receipt. `?logIndex=N` opens the exact entry.
- Dark monospace code blocks for hashes, signatures, certs — bordered visual atom.
- Linkified identifiers everywhere.
- Relative + absolute timestamp pair.
- Show absent fields explicitly with a "Missing for..." or "Not applicable" message.
- Named YAML rendering of certificate fields with raw bytes available below.

### Patterns to differentiate from

- No big "VERIFIED" status banner. For an AI-call receipt aimed at insurance underwriters, support managers, and end users disputing AI statements, **we need the green/red status banner Rekor refuses to show.** Our audience is not just engineers.

---

## Decisions for Sworn verifier UI

### 5 patterns to ADOPT

1. **URL-shareable receipts (Rekor model).** `/verify?receiptId=<id>` or `/r/<chatIdHash>` opens the exact receipt page. No file upload. No auth. The link IS the artifact. (Diverges from C2PA's drop-the-file pattern, matches Rekor and LangSmith share-trace.)

2. **C2PA four-level progressive disclosure.** Default the page to Level 2-3 (who issued, when, model + temperature, "verifies" status with the trust chain summary). Behind an "Show cryptographic detail" toggle: Level 4 — full hashes, TEE signature bytes, storage Merkle proof, contract event log. Vibecoder defaults to readable; auditor expands to byte-exact.

3. **Rekor's dark monospace code-block visual atom for proof values.** Light page, dark bordered cards for `responseHash`, `teeSignature`, `storageRootHash`, `txHash`. Linkify the txHash to the 0G chain explorer. Linkify the storageRootHash to the 0G storage gateway.

4. **Relative + absolute timestamp pair, always.** "3 minutes ago (2026-05-13T14:32:08+01:00)." Receipts may be reviewed years later in litigation; absolute is non-negotiable.

5. **Show absent fields explicitly.** If the receipt was opt-out for one field (e.g. seed not captured), render the row with "Not captured" rather than hide it. Hidden fields look like tampering. Rekor's "Missing for intoto v0.0.1" model.

### 3 patterns to AVOID

1. **Drop-the-file-only UX (C2PA pattern).** Auditors and disputants forward links over email; they don't drop blobs into a webpage.

2. **No-status-banner stoicism (Rekor pattern).** Our audience includes non-engineers (insurance underwriters, end users with refund disputes). A clear color-coded status banner at the top — green "Verified" / red "Failed verification" / amber "Partially verified, see details" — is the first thing a non-technical viewer needs. Rekor's choice not to show one is correct for their audience and wrong for ours.

3. **Behind-login receipt surface (LangSmith + Helicone pattern).** Both keep their detail UI for logged-in customers. For us, the public-by-default verifier IS the product — a receipt nobody else can independently check has no third-party trust value. (This is also our headline differentiator vs LangSmith.)

### 1 DIFFERENTIATOR we should own

**"This receipt verifies even if our company disappears tomorrow."**

LangSmith's trace link goes dead if LangSmith goes dead. Helicone's logs are gone if Helicone is gone. EZKL has no hosted verifier at all. C2PA verifies on-device but is not URL-addressable. Rekor verifies but is engineer-only.

Our verifier should display a banner near the top, not buried in docs: **"Re-verifiable from these public sources alone: 0G Storage gateway, 0G Chain RPC, TEE provider attestation key registry. Our servers are not in the trust path. [Show me the chain.]"** Clicking the link enumerates the four checks the page just did — each shows the public URL it pulled from and the result.

This is the one thing none of the five competitors have: **verifiability that survives the issuer's death.** It's the entire dispute primitive. Make it visible on the page, not just true under the hood.

---

## Honest limits of this research

- LangSmith and Helicone trace-detail UIs are behind login. The patterns inferred for them are from public docs + the share-trace article; the actual visual layout was not seen.
- C2PA verifier result page did not render via deep-link. Drop-file is the only public path; result-page screenshots in this research are inferred from the spec's disclosure-level docs, not captured live.
- EZKL has no hosted verifier — the section is mostly about the gap, not the patterns. The gap is the finding.
- Rekor is the only competitor where the full UI was captured live and inspected pixel-by-pixel.

Confidence on the 5 adopt patterns: high (each grounded in a captured pattern or a stated spec). Confidence on the differentiator: high — it is structurally absent from all five, not just stylistically.
