# Proposal 3 — "The Public Notary Modern"

**DNA code:** `DNA-InterDisplay-Teal-EditorialColumn-OversizedHero-CreamMist`

## 5 dimensions

| Dimension | Value |
|-----------|-------|
| typeface family | Inter Tight (display headlines, tight tracking -0.038em) + Inter (UI / body) + JetBrains Mono (chatId, hashes, address atoms) |
| accent palette | dark teal `#0B5754` deep / `#14807C` mid / `#E8F2F0` background tint on cream `#FAFAF7` paper. Fail `#A03020` and skip `#8B6914`. Restrained: teal only on the brand glyph, status banner, receipt pill, links, the 6px case-file left edge, and the "filed" stamp accents. |
| layout structure | single central column (max-width 760-880px) on every screen. Hero is left-aligned, oversized 84px display headline with a 16ch wrap. Verifier is a single "case file" card centred at 1080px max; the chatId itself is rendered at 28-48px mono as the visual hero of the verifier page. |
| motion signature | "brand ring" — 3.4s expanding ring around the brand glyph in the nav (one of the slowest, most editorial motions in the pack); 1.1s typing-dot delay on chat replies; status banner has a static radial glow rather than animation. |
| surface texture | cream wash + radial teal gradient 0.10α from top, radial teal 0.08α from bottom-left, SVG fractalNoise 0.045α tiled at 220px. Soft shadows only (max 0 18px 44px at 0.08α) — feels like the page is sitting on velvet, not on a screen. |

## 5-sentence design rationale

This direction reads as a published case file rather than a SaaS app: cream paper, slow expanding ring on the brand glyph, single tall column with one display headline holding 16 characters per line. The hero abandons multi-column layouts entirely — left-aligned 84px Inter Tight, a 62ch lede, two buttons, a 3-up meta strip on a hairline rule — the calmness is the message. The chatbot section reads like a magazine spread: surface label, 52px section heading, single sentence lede, then a centred thread frame whose composer sits in a cream-2 plinth rather than a chrome bar. The verifier abandons the "Rekor dense" pattern altogether and instead treats the chatId + timestamp as the design hero: a 6px teal bar marks the left edge of the case file; a 11px "FILED · 2026‑05‑13" stamp sits top-right; the chatId is rendered at 28-48px monospace as the largest type on the page below the section heading. Below that comes the verified banner, the independence callout, the parties/anchor/storage ledger (220px label column, generous 16px row padding, hairline borders), and finally the 9-check verification chain in a single-pixel-line list that reads like a court docket index.

## Competitor pattern adopted hardest

**C2PA four-level progressive disclosure, plus the editorial-magazine layout instinct from Stripe Press / Linear changelog.** The verifier defaults to Level 2-3 (parties, anchor, storage, request, response, checks). The `<details class="byte-toggle">` opens Level 4 with byte-exact promptHash, contentHash, teeSignature (two-line wrap), pubkeySnapshot, and linkified rootHash / txHash. Compared to Proposal 2 (which is Rekor's dense reference), Proposal 3 leans Apple/Stripe Press: white space is doing more work than colour, and the chatId itself is the typographic anchor (not a sidebar metadata cell). Borrows Rekor's relative+absolute timestamp pair and "Not captured" pattern; borrows C2PA's progressive-disclosure default.

## Differentiator owned

**"This receipt verifies even if Sworn disappears tomorrow."** Rendered as a two-column callout inside the case file: a large headline and a body paragraph on the left, a single secondary button on the right. Tapping it expands an ordered list naming the four exact public sources hit. Sits above the ledger grid so it's the *second* thing a viewer reads after the verified banner — same priority as a printed case-file disclaimer.

## Transplant test result

**Passes.** The hero citation line names *Moffatt v. Air Canada* 2024 BCCRT 149 in monospace caps. The verifier hero is the chatId, not a generic title. The case-file card carries a "FILED · 2026‑05‑13" stamp and a 6px teal bar that imitates a legal file binding. The independence callout names "0G Storage gateway / 0G Chain RPC / TEE provider attestation key" specifically. The ledger rows are domain-specific: Chain, Block, Anchor tx, Storage rootHash, Encryption (AES‑256‑CTR · sealed), promptHash, responseHash, teeSignature, pubkeySnapshot. The 9 checks are 1:1 with `verifier.ts`. Swap "Sworn" for "Acme SaaS" and none of these surfaces would survive — the design is welded to the receipt schema in `sdk-ts/src/types.ts`.

## Liveness check minimums

- Radial gradients on body: teal 0.10α + teal 0.08α (≥0.08 — both individually meet the floor)
- Box-shadow on `.btn-primary`: `0 8px 22px rgba(26, 31, 29, 0.14)` (≥0.08)
- Accent border on verified banner: teal-edge at 0.30α + 4px solid teal left border (≥0.15)
- Noise texture: fractalNoise at 0.045α (≥0.03)
- Idle motion: 3.4s expanding-ring on brand glyph + 1.1s typing-dots in chat. (Status banner uses a static radial glow rather than animation to keep editorial restraint — but the brand ring and chat dots cover the "one element animates without interaction" minimum.)

## AI-slop checklist

- No Heroicons cards — replaced by a hero meta strip (3 labelled items, NOT boxed numbers — they're typographic, not statistical)
- No color-coded headline words — single-ink headline
- No stats row of boxed numbers — meta strip is labelled categories, not metrics
- No generic CTAs — "See the demo bot" / "Inspect a receipt" / "Open the verifier in a new window"
- No self-certifying badges — the only "Verified" claim is sourced from the 9 check results
- No banned words (grep-clean)
- No em-dashes used parenthetically
