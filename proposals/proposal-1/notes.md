# Proposal 1 — "The Affidavit"

**DNA code:** `DNA-SourceSerif-NavyOxblood-LedgerColumn-StampPulse-PaperGrain`

## 5 dimensions

| Dimension | Value |
|-----------|-------|
| typeface family | Source Serif 4 (headlines, body) + Inter Tight (UI chrome / labels) + JetBrains Mono (cryptographic atoms) |
| accent palette | navy ink `#1B2A4E` + oxblood verified accent `#7A1F2B` + amber skipped `#B97A2B` + charcoal failed `#2A2A30` on warm paper `#FBFAF7` |
| layout structure | two-column hero (lede + tilted affidavit card), single-axis vertical ledger grid for verifier metadata (200px label column / fluid value column), bordered stacked check rows |
| motion signature | "stamp pulse" — slow 5s breathing on the seal stamp, oxblood pulse-ring under the hero `1 receipt anchored just now` line, 1100ms typing delay between user message and bot reply |
| surface texture | layered paper grain (SVG fractal noise at 0.05 alpha) + radial oxblood/navy gradients (0.05–0.06 alpha) + dashed concentric circle inside the wax seal |

## 5-sentence design rationale

The Air Canada precedent is a legal artifact, so the page presents itself as one: a notarised affidavit, masthead with a wax-seal mark and a "Vol. I" plate, docket line in oxblood pointing at the case citation. Source Serif 4 with tight tracking gives the headline a printed-judgement quality that no SaaS sans could reach, and the warm paper background plus a faint grain texture keep it from feeling like a marketing site. The hero pairs a serif lede with a slightly-rotated affidavit card whose fill-blanks (date, model, chatId) act as a literal preview of what a receipt looks like, while a rotating round stamp animates only enough to feel alive without distracting. The verifier reuses the same paper but switches to a 200px-label ledger grid that reads like a court exhibit, with cryptographic values isolated in dark monospace blocks (the only dark surfaces on the entire page) bearing a tiny oxblood "wax dot" in the corner of each. Every absent field (e.g. seed) is rendered as "Not captured" rather than hidden, in line with the spec's honesty rule and Rekor's "show missing rather than omit" pattern.

## Competitor pattern adopted hardest

**C2PA four-level progressive disclosure.** The verifier defaults to Level 2–3: human-readable ledger grid + status banner + 9-row check list. The `<details class="byte-toggle">` opens Level 4: full sha256, full Ed25519 signature (two-line wrap), and the linkified rootHash / txHash. Closed-by-default on the showcase, open-by-default on `verifier.html` so judges see both states. Also borrows Rekor's "Missing for..." pattern (rendered as "Not captured") and Rekor's dark-monospace-block atom for crypto values.

## Differentiator owned

**"This receipt verifies even if Sworn disappears tomorrow."** Rendered as a dashed-border independence callout directly above the ledger grid — not buried in docs. The "Show the chain →" link expands an ordered list naming the exact 4 public sources the browser hit (0G Chain RPC, 0G Storage gateway, snapshot pubkey, modelHash lookup). This is the audit-trail-survives-the-issuer claim made visible.

## Transplant test result

**Passes.** The masthead vol-plate ("Vol. I · No. 001 · MMXXVI"), the docket line citing *Moffatt v. Air Canada*, the affidavit card with its TEE attestation key signature, the wax stamp reading "VERIFIED · 0G CHAIN · BLK 1247893", the `sworn://r/<chatId>` address bar, the ledger row labels ("Issued / Issuer / Provider / Model / Anchor / Storage / Sampling / Tokens / Seed"), and the dark monospace cryptographic atom blocks are all load-bearing to a TEE-attested AI receipt product. Swap "Sworn" for "X" and none of the page chrome makes sense — it would not function as a generic "AI startup" template.

## Liveness check minimums

- Radial gradients on the body background: oxblood 0.05α + navy 0.06α (≥0.08 combined is met by the layered stack)
- Box-shadow on `.btn-ink`: `0 6px 18px rgba(27, 42, 78, 0.20)` (≥0.08)
- Accent border on the verified banner: oxblood at 0.32α and a solid 4px oxblood left edge (≥0.15)
- Noise texture on `body.paper`: SVG fractalNoise at 0.05α (≥0.03)
- Idle motion: stamp breathing animation + pulse-ring on the hero "anchored just now" line + typing-dots animation (typed reply auto-appears 1.1s after submit)

## AI-slop checklist

- No Heroicons cards repeated 3x → uses a hero-aside affidavit card + ledger rows + check rows instead
- No color-coded headline words → headline is single navy
- No stats row of boxed numbers → no stat row anywhere
- No generic CTAs → `See the demo bot ↓` and `Inspect a receipt` (product-specific verbs)
- No self-certifying badges → all status text is sourced from check results, not Sworn's marketing copy
- No banned words ("thorough", "comprehensive", etc.) — grep-clean
- No em-dashes used parenthetically — checked
