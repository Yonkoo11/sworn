# Demo video plan — Sworn

Submitted to 0G APAC Hackathon. **Hard cap: 3 minutes.** Judges scrub at 1.5×. Captions on. No music. No logos. No marketing voice. The product itself is the demo.

This file is the screenplay + storyboard + recording checklist. The TTS-safe voiceover script lives in `voiceover.txt`. Captions in `captions.vtt`.

## The one thing a judge must feel

> *"The receipt is real. They're not bullshitting me. I can click and verify it myself, right now, in my browser, without trusting their server."*

Everything else is in service of that feeling. If any second of the video doesn't push toward that, cut it.

## Anti-patterns to avoid (Toly-level discipline)

- ❌ Marketing music · ❌ Slow logo intro · ❌ Stock-footage humans in offices · ❌ "Revolutionary" / "production-ready" / "thorough" in the script · ❌ Re-using the same screenshot across two clips · ❌ AI voiceover without phonetic rewrites of brand names (per `feedback_elevenlabs_pronunciation.md`) · ❌ Switching aspect ratios · ❌ Mouse cursor hidden during demos.

## Shot list (8 beats, 3:00 total)

| # | Time | Beat | What's on screen | Voiceover beat |
|---|---|---|---|---|
| 1 | 0:00–0:15 | **Problem hook** | Black background, single line of text fades in: *"Tribunal: 'the chatbot is not a separate entity. What it says is a corporate statement.'"* Source line below: `Moffatt v. Air Canada, 2024 BCCRT 149` | "In February two thousand twenty four, a tribunal ruled that an airline's chatbot was a corporate statement. AI mistakes are now uncapped liability. Every AI agent deployment has the same problem and no audit trail." |
| 2 | 0:15–0:35 | **Pitch (Currier 5-word)** | Cut to Sworn landing page · scroll the hero into view: "Re-derive any Sworn receipt from public sources." · pause on the "no login, no upload" subtitle | "Sworn issues a cryptographic receipt under every AI agent reply, anchored on zero gee chain, persisted on zero gee storage. The U R L is the receipt. Anyone can verify it without our server." |
| 3 | 0:35–1:10 | **Demo chatbot** | Open `https://yonkoo11.github.io/sworn/demo/` · type the question "What is your refund policy for damaged goods?" · let the bot reply · zoom-cursor to the 🔒 receipt pill under the bot reply | "Here's a customer service bot built on the Sworn S D K. I ask a question. The bot answers. Under every reply, a tiny receipt pill appears. The U R L on that pill is the dispute primitive." |
| 4 | 1:10–1:55 | **Verifier — 11 of 11** | Click the receipt pill · cut to verifier page loading skeleton briefly · expand to the full case file · status banner pops green "Verified · 11 of 11 checks passed" · slow scroll through the 11 checks (anchor.exists → provider.notRevoked) | "Clicking the receipt opens the verifier in your own browser. Eleven cryptographic checks run locally, against the real zero gee chain. Anchor exists, storage retrievable, S H A two fifty six matches, body parses, T E E signature valid, provider not revoked. All eleven, all here, none of them trust us." |
| 5 | 1:55–2:15 | **Independence proof** | Click the on-chain transaction hash link · cut to chainscan-galileo.0g.ai showing the real tx + block 33370770 · cursor highlights the contract address `0xf35b...8AAA` | "The transaction lives on the zero gee chain block thirty three million three seventy thousand seven seventy. Five contracts back it. If Sworn disappears tomorrow, the receipt still verifies from the chain alone." |
| 6 | 2:15–2:35 | **What's deployed** | Cut to the verifier's `/spec` page · scroll to the contracts section · five contract addresses each linked to chainscan-galileo · cursor highlights each in turn | "Five contracts on Galileo testnet. Receipt registry. Revocation registry. Dispute escrow with bond-backed challenge. Commit reveal for prompt time-binding. And a soulbound I N F T wrapping the receipt under the new E R C seventy eight fifty seven standard. Primitive depth five out of five." |
| 7 | 2:35–2:55 | **Audience + roadmap** | Cut to the verifier's `/integrate` page · show the six-line TypeScript snippet · cut briefly to the Python S D K README on GitHub · final shot of the receipt verifier URL pinned at the bottom | "Drop-in S D K for TypeScript, read-only Python verifier, browser extension that highlights receipts on any page. Built for production AI deployments, audit teams, insurance underwriters writing AI errors and omissions policies. Available today." |
| 8 | 2:55–3:00 | **Sign-off (URL is the receipt)** | Closing card: `https://yonkoo11.github.io/sworn/r/543f06b4…` · "Receipt URL = dispute primitive" as a single line beneath. Beat of silence. End. | (silence; the URL is the closer) |

## Hard rules during recording

- **Cursor visible at all times.** No invisible hover transitions.
- **Real chatId everywhere.** The receipt I show must be `543f06b4-84c0-d19b-59ca-6b22afabd8d3` (or a freshly-minted one — never a mock).
- **Captions burned in.** Don't rely on YouTube auto-captions during judging.
- **Recording resolution: 1920×1080.** Browser zoom at 110% so monospace addresses are readable on phones.
- **One unbroken take if possible.** Edit only to cut dead air. No fade transitions.
- **Cap at 2:58 hard.** Judges hit the 3:00 mark and stop watching.

## Voiceover (TTS-safe rewrites per `feedback_elevenlabs_pronunciation.md`)

The full script is in `voiceover.txt`. Brand-name rewrites:

| Word | TTS rewrite | Why |
|---|---|---|
| Sworn | Sworn | OK as-is in most voices |
| 0G | zero gee | TTS reads "oh gee" otherwise |
| TeeML | tee em el | TTS reads as "tee-em-el" already; spelt phonetically reduces variance |
| ERC-7857 | E R C seventy eight fifty seven | Avoids "seven thousand eight hundred fifty seven" |
| chatId | chat I D | Two-letter clarity |
| rootHash | root hash | Two-word read |
| chainscan-galileo | chainscan dot galileo | Domain read |
| INFT | I N F T | Spelt out |
| keccak256 | kecak two fifty six | Phonetic |
| BCCRT 149 | B C C R T one forty nine | Spelt out |

## Recording checklist (the day-of)

- [ ] Browser: Chrome incognito, no extensions visible, 110% zoom, no bookmarks bar
- [ ] OS: macOS dark mode OFF (Sworn is light-only)
- [ ] Notifications silenced (Do Not Disturb)
- [ ] Cursor: enlarged 1.5× (System Settings → Accessibility → Display)
- [ ] Demo chatbot question pre-rehearsed: "What is your refund policy for damaged goods?"
- [ ] Pre-minted receipt URL bookmarked but not visible: `https://yonkoo11.github.io/sworn/r/543f06b4-84c0-d19b-59ca-6b22afabd8d3?k=0x6c60cf51ed0986f3334f5b33e6de53809a138aa765d5e3d5da95c19f3f9e21f2`
- [ ] Backup: same receipt without `?k=` (partial verification — also valid, 8/9 instead of 11/11)
- [ ] Microphone tested · room treatment (no echo) · 16-bit 48kHz minimum
- [ ] Captions file generated (Whisper / Loom auto-caption) and proofread for the brand-name rewrites
- [ ] Final cut < 2:58
- [ ] Uploaded to **Loom** (primary share link) + **YouTube unlisted** (backup) + thumbnail = receipt page with green VERIFIED banner

## Why this structure (Toly-level reasoning)

A 0G engineer judging this submission scrubs through dozens of videos a day. They make a verdict in the first 30 seconds. The first 30 seconds of this video pose the problem (Air Canada) and answer it with the pitch — verbatim what's on the landing page. **No marketing overhead before the substance.**

The middle 80 seconds (beats 3–5) are the only ones that matter for the verdict. They show: real input → real reply → real receipt → real chain → real explorer. Five real things in 80 seconds. Each one is a moment where a sceptical judge could pause and click through to verify the demo themselves.

The closing 40 seconds (beats 6–8) are evidence-gathering for the score: 5 contracts, primitive depth, SDK + extension surface. By the time the score is being entered, the judge has every piece they need.

**The single failure mode this avoids:** the marketing-style demo that's all hero shots and no proof. Half the submissions a judge sees are that. Sworn's structural advantage is that every claim in the script ends with a click that goes to a public, verifiable artifact. The video's job is to make those clicks happen on screen so the judge doesn't have to.
