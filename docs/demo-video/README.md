# Sworn demo video

Hard cap **3 minutes**. Required deliverable for the 0G APAC Hackathon.

| File | What |
|---|---|
| `plan.md` | Storyboard, shot list with timings, Toly-level recording discipline, the one thing a judge must feel |
| `voiceover.txt` | TTS-safe script. Pronunciation rewrites baked in for ElevenLabs / Whisper |
| `captions.vtt` | Time-aligned captions (burned-in during final cut) |

## Stack to record this

1. **Screen recorder.** Loom (one-take, auto-caption) is fastest. macOS QuickTime if you want a raw `.mov` to edit elsewhere. 1920×1080. Browser at 110% zoom; cursor enlarged 1.5×.
2. **Voiceover.**
   - Option A: record your own voice. Best authenticity. Use a quiet room, USB condenser mic, post-process with iZotope RX or Adobe Podcast's free enhance tool.
   - Option B: ElevenLabs (or Eleven Reader). Pick a calm voice (Adam, Daniel, or Brian). Feed `voiceover.txt` verbatim — the brand-name rewrites are already applied.
3. **Edit.** DaVinci Resolve (free) or Descript (caption-first). Cut to the timeline in `plan.md`. Burn `captions.vtt` into the video. Export at H.264 1080p, 8 Mbps target.
4. **Host.** Loom direct link (primary share) + YouTube unlisted (backup). The Loom thumbnail should be the receipt page with the green "Verified · 11 of 11" banner visible.

## Recording day checklist

The full checklist is in `plan.md`. The three you cannot skip:

- Cursor visible at all times.
- Real chatId throughout — never a mock-only URL.
- Final cut under **2:58**. Judges stop watching at 3:00.

## What this video must NOT be

- A marketing reel with logos, music, and stock footage of humans in offices.
- A code walkthrough.
- A "team story" video. The product is the demo.

The single failure mode this avoids: the marketing-style demo that's all hero shots and no proof. Half the submissions a judge sees are that. Sworn's structural advantage is that every claim in the script ends with a click that goes to a public, verifiable artifact. The video's job is to make those clicks happen on screen so the judge doesn't have to.
