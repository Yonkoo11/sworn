# Proposal 2 — "The Engineer's Receipt"

**DNA code:** `DNA-Inter-SolanaGreen-DenseGrid-MicroPulse-PaperWash`

## 5 dimensions

| Dimension | Value |
|-----------|-------|
| typeface family | Inter (everything) + JetBrains Mono (cryptographic atoms, key/value labels, address bar, hashes) |
| accent palette | Solana green `#14F195` / `#0FBE74` deep — single saturated colour, only in the status banner, receipt pill, and the `kicker` rule. Coral `#FF5C5C` reserved for failed checks. Amber `#D98700` for skipped. Grayscale chrome otherwise. |
| layout structure | Sigstore Rekor model. Sticky top bar, hero with live anchor stream on the right, search card above the verifier card, 4-cell metadata strip, two-column body (main column with dense kv lists + dark code blocks; right rail with three small cards) |
| motion signature | "micro pulse" — 1.9s heartbeat on the green status dot in the brand mark, 1.7s ring-pulse on the stream "recent anchors" indicator, 800ms green flash on the freshest stream row, typing-dots in the chat |
| surface texture | radial Solana-green wash 0.09α from top-left, radial ink-black wash 0.06α from right; SVG fractalNoise grain at 0.04α tiled at 200px; near-white #FFFFFF page chrome with #FAFBFC soft surface for cards-in-cards |

## 5-sentence design rationale

Sworn here presents itself as developer infrastructure rather than a marketing site: the masthead is a compact `SWN /receipt-registry · v1` plate, the headline calls the Air Canada precedent by case number (2024 BCCRT 149) in a monospace strip, and the right side of the hero is a live "recent anchors" stream that quietly proves the chain is alive. The Solana-green accent is rationed: it appears only on the verified status banner, the receipt pill, the streaming-row badge, and the kicker rule — every other surface is grayscale, so colour itself becomes the verified signal. The verifier is the densest screen in the entire pack: a Rekor-style 4-cell metadata strip across the top, a two-column body with key/value lists of every receipt field (no fields hidden), and dark monospace blocks holding the byte-exact promptHash / responseHash / teeSignature / pubkeySnapshot with syntax highlighting on the address prefixes. Sharp 4–6px radii throughout (no bubbly rounding) keep it feeling like a CLI port, and the right rail enumerates the actual public sources the browser hit, so the "Sworn is not in the trust path" claim is checkable rather than asserted. The chat panel uses lowercase mono labels for the role line and a tiny "lock + receipt + id" pill, deliberately understated so the chat doesn't look like another LLM toy — it looks like a piece of audited infrastructure.

## Competitor pattern adopted hardest

**Sigstore Rekor.** The metastrip with CHATID / CHAIN ID / BLOCK / INTEGRATED TIME mirrors Rekor's TYPE / LOG INDEX / INTEGRATED TIME row. The dark monospace code-block atom for cryptographic values, with a label-row above and a "copy" button on the right, is taken directly. Linkified identifiers throughout. The two-column body (main + side rail) and the search card at the top with a select+input+button combo are the Rekor layout. The relative+absolute timestamp pair (`re-verified 3 sec ago` over `2026‑05‑13T10:42:08+01:00`) is the Rekor pattern verbatim. Where it differs from Rekor: we add the green status banner Rekor refuses to show — because our audience includes insurance underwriters and end users disputing AI statements, not just engineers.

## Differentiator owned

**"This receipt verifies even if Sworn disappears tomorrow."** Rendered as a flat row with a `PROOF` chip on the left, the claim and explanation in the middle, and a `Show the chain →` button on the right. Expanding it reveals the actual public URLs the browser hit (`evmrpc-testnet.0g.ai`, `indexer-storage.0g.ai`, etc.) — and the same endpoints are duplicated in the right-rail "Public sources used" card, so the claim is visible from two angles at once.

## Transplant test result

**Passes.** Every load-bearing surface is sworn-specific: the `0xroot…` / `0xtx…` linkifications target the 0G Storage gateway and 0G Explorer; the metastrip's CHAIN ID column reads "16601 · Galileo"; the right-rail rpc list names the actual Galileo endpoints; the code blocks show TEE signature + pubkeySnapshot semantics that map to the receipt schema in `sdk-ts/src/types.ts`; the precedent strip cites 2024 BCCRT 149; the verifier checks list maps 1:1 to `verifier.ts` (9 checks, in order). Swap "Sworn" for any other brand and most of the chrome is meaningless — the design is welded to the receipt schema and 0G's primitive surface.

## Liveness check minimums

- Radial gradients on body: green at 0.09α + ink at 0.06α (≥0.08 satisfied)
- Box-shadow on `.btn-primary`: `0 6px 18px rgba(14, 17, 22, 0.16)` (≥0.08)
- Accent border on verified banner: green-edge at 0.45α plus 4px solid green-deep left border (≥0.15)
- Noise texture on body: fractalNoise at 0.04α (≥0.03)
- Idle motion: brand-mark heartbeat (1.9s loop), stream-head ring-pulse (1.7s loop), `.fresh` row green-flash animation on the most-recent anchor row, typing-dots in the chat

## AI-slop checklist

- No Heroicons cards — uses a stream component + key/value lists + dense kv rows
- No color-coded headline words — single-ink headline with the second clause in grayscale italic
- No stats row — replaced by the live anchor stream (which is product-meaningful, not decorative)
- No generic CTAs — "Run the demo bot", "Inspect a receipt" (product verbs)
- No self-certifying badges — `verified` badge appears only on rows that have an actual check result behind them
- No banned words (grep-clean for "thorough", "comprehensive", "battle-tested", etc.)
- No em-dashes used parenthetically
