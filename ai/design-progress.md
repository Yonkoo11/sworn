# Design Progress: sworn

started: 2026-05-14
style_config: skill defaults (no ~/.claude/style.config.md found at project init; vibecoder mode uses CLAUDE.md banned-word list as anti-pattern source)
color_mode: light-only — infrastructure / legal-evidence product. Notarial, durable, slightly austere per spec. Dark accents on light page; dark monospace blocks for cryptographic atoms only.
flags: --skip-state

phase_0: completed
phase_1: skipped — frontends consume frozen receipt schema from sdk-ts/src/types.ts; no app state to architect
state_design_output: skipped — types.ts is the canonical state

phase_1.5: completed
comparables: LangSmith, Helicone, EZKL, C2PA Content Credentials, Sigstore Rekor
research_output: ai/design-research.md (= docs/competitor-ux-notes.md — 5 ADOPT + 3 AVOID + 1 DIFFERENTIATOR)

phase_2: completed
proposals_output: proposals/proposal-1 + proposal-2 + proposal-3 (each has index.html / chatbot.html / verifier.html / notes.md / preview.png + style.css + chat.js)
proposal_1_dna: DNA-SourceSerif-NavyOxblood-LedgerColumn-StampPulse-PaperGrain  -- "The Affidavit"
proposal_2_dna: DNA-Inter-SolanaGreen-DenseGrid-MicroPulse-PaperWash             -- "The Engineer's Receipt"
proposal_3_dna: DNA-InterDisplay-Teal-EditorialColumn-OversizedHero-CreamMist   -- "The Public Notary Modern"
liveness_check: all 3 proposals meet gradient >=0.08, box-shadow >=0.08, accent border >=0.15, noise texture >=0.03, with idle motion (stamp pulse / heartbeat / brand ring + typing dots)
ai_slop_check: clean — no Heroicons cards, no boxed stat rows, no color-coded headline words, no generic CTAs, no self-certifying badges, no banned words (grep-clean), no parenthetical em-dashes in user-facing copy
transplant_test: passes for all 3 — design surfaces (case citation, ledger row labels, cryptographic atoms, sworn://r/ address bar, 9-check verifier mapping, 0G primitive names) are welded to the product and would not survive a brand swap

phase_3: pending  -- proposal selection (Claude's job in parent context)
phase_4: pending
phase_5: pending

phase_2: completed
proposals: [proposal-1/index.html, proposal-2/index.html, proposal-3/index.html]
dna_codes: [DNA-SourceSerif-NavyOxblood-LedgerColumn-StampPulse-PaperGrain, DNA-Inter-SolanaGreen-DenseGrid-MicroPulse-PaperWash, DNA-InterDisplay-Teal-EditorialColumn-OversizedHero-CreamMist]

phase_3: completed
selected: hybrid — Proposal 3 base + (P2 live anchors stream on chatbot home) + (P2 "PROOF" chip treatment for independence callout) + (P1 "FILED · YYYY-MM-DD" stamp aesthetic on verifier case-file card). Drop P1 wax seal, P1 rotated affidavit card, P2 Solana green (use P3 teal), P2 dense two-column verifier body (keep P3 single column).

phase_4: completed
audit_result: pass
issues_fixed: TS strict warnings (unused modelHashFn / MOCK_KEY / Receipt), browser bundle (chatIdFromInput inlined), 11px non-uppercase label bumped to 12, focus rings paired with box-shadow on global focus-visible

phase_5: completed
qa_result: APPROVED
qa_notes:
  - banned words: clean
  - cubic-bezier(0.23, 1, 0.32, 1) Emil easing used
  - touch targets >= 44px verified
  - prefers-reduced-motion respected in both apps
  - outline:none paired with box-shadow focus ring on global focus-visible + accent border replacement on inputs
  - liveness: teal-soft 0.1 + radial gradient 0.1 on hero + brand glow 0.22 + box-shadow shadows 4-tier
  - all 39 SDK tests still green
