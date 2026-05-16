#!/usr/bin/env bash
# Generate the Sworn demo voiceover.
#
# Tries providers in this order; first that works wins:
#   1. ElevenLabs (if ELEVENLABS_API_KEY set and tier active)
#   2. OpenAI TTS (if OPENAI_API_KEY set)
#   3. macOS `say` (always available on macOS; fallback)
#
# Output: docs/demo-video/audio/voiceover.mp3 (mp3 for OpenAI/EL, aiff→mp3
# for `say`). The script never prints any API key.
#
# Brand-name pronunciation rewrites are already applied in voiceover.txt.

set -euo pipefail
cd "$(dirname "$0")"

OUT_DIR="audio"
OUT_FILE="$OUT_DIR/voiceover.mp3"
mkdir -p "$OUT_DIR"

# ElevenLabs voice + model.
EL_VOICE_ID="${SWORN_VOICE_ID:-nPczCjzI2devNBz1zQrb}"      # Brian — calm narrator
EL_MODEL="${SWORN_VOICE_MODEL:-eleven_multilingual_v2}"
# OpenAI TTS voice — onyx is deep and authoritative, fits the legal/notarial tone.
OPENAI_VOICE="${SWORN_OPENAI_VOICE:-onyx}"
OPENAI_MODEL="${SWORN_OPENAI_MODEL:-tts-1-hd}"

mkdir -p "$OUT_DIR"

# Strip:
#   - lines starting with #   (file-level comments)
#   - lines starting with [   (beat-label headers like [0:00 PROBLEM HOOK])
#   - lines starting with (   (parenthetical stage directions like "(silence)")
# Collapse multiple newlines into single. Trim leading/trailing whitespace per line.
NARRATION=$(awk '
  /^[[:space:]]*$/ { print ""; next }
  /^[[:space:]]*#/ { next }
  /^[[:space:]]*\[/ { next }
  /^[[:space:]]*\(/ { next }
  { sub(/^[[:space:]]+/, ""); sub(/[[:space:]]+$/, ""); print }
' voiceover.txt | awk 'BEGIN{p=1} /./{print; p=0; next} {if(!p)print; p=1}')

if [[ -z "$NARRATION" ]]; then
  echo "ERROR: no narration extracted from voiceover.txt" >&2
  exit 2
fi

echo "Narration length: $(echo "$NARRATION" | wc -c) chars."

report() {
  local file="$1" provider="$2"
  local size; size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file")
  local duration=""
  if command -v ffprobe >/dev/null 2>&1; then
    duration=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$file" 2>/dev/null | awk '{printf "%.1f", $1}')
  fi
  echo ""
  echo "================================================================"
  echo "  Voiceover generated via $provider"
  echo "  File:     $file"
  echo "  Size:     $size bytes"
  if [[ -n "$duration" ]]; then
    echo "  Duration: ${duration}s"
  fi
  echo "================================================================"
}

# ----------------- Provider 1: ElevenLabs -----------------
try_elevenlabs() {
  [[ -n "${ELEVENLABS_API_KEY:-}" ]] || return 10
  echo "Trying ElevenLabs (voice $EL_VOICE_ID, model $EL_MODEL)…"
  local payload
  payload=$(python3 -c "
import json, sys
print(json.dumps({
  'text': sys.argv[1],
  'model_id': sys.argv[2],
  'voice_settings': {'stability': 0.55, 'similarity_boost': 0.65, 'style': 0.3, 'use_speaker_boost': True}
}))
" "$NARRATION" "$EL_MODEL")
  local status
  status=$(curl -sS -o "$OUT_FILE" -w "%{http_code}" \
    -X POST \
    -H "xi-api-key: $ELEVENLABS_API_KEY" \
    -H "accept: audio/mpeg" \
    -H "content-type: application/json" \
    --data-raw "$payload" \
    "https://api.elevenlabs.io/v1/text-to-speech/${EL_VOICE_ID}?output_format=mp3_44100_128")
  if [[ "$status" == "200" ]]; then
    report "$OUT_FILE" "ElevenLabs"
    return 0
  fi
  echo "  ElevenLabs returned HTTP $status — falling back."
  rm -f "$OUT_FILE"
  return 1
}

# ----------------- Provider 2: OpenAI TTS -----------------
try_openai() {
  [[ -n "${OPENAI_API_KEY:-}" ]] || return 10
  echo "Trying OpenAI TTS (voice $OPENAI_VOICE, model $OPENAI_MODEL)…"
  local payload
  payload=$(python3 -c "
import json, sys
print(json.dumps({'model': sys.argv[2], 'input': sys.argv[1], 'voice': sys.argv[3], 'response_format': 'mp3', 'speed': 1.0}))
" "$NARRATION" "$OPENAI_MODEL" "$OPENAI_VOICE")
  local status
  status=$(curl -sS -o "$OUT_FILE" -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $OPENAI_API_KEY" \
    -H "content-type: application/json" \
    --data-raw "$payload" \
    "https://api.openai.com/v1/audio/speech")
  if [[ "$status" == "200" ]]; then
    report "$OUT_FILE" "OpenAI TTS"
    return 0
  fi
  echo "  OpenAI returned HTTP $status — falling back."
  cat "$OUT_FILE" >&2 || true
  rm -f "$OUT_FILE"
  return 1
}

# ----------------- Provider 3: macOS `say` -----------------
try_say() {
  command -v say >/dev/null 2>&1 || return 10
  command -v ffmpeg >/dev/null 2>&1 || {
    echo "  macOS 'say' present but ffmpeg missing — install ffmpeg to encode to mp3."
    return 1
  }
  echo "Falling back to macOS 'say' (voice Daniel, en_GB)…"
  local tmp_aiff="$OUT_DIR/voiceover.aiff"
  say -v "Daniel" -r 170 -o "$tmp_aiff" "$NARRATION"
  ffmpeg -y -loglevel error -i "$tmp_aiff" -codec:a libmp3lame -b:a 128k "$OUT_FILE"
  rm -f "$tmp_aiff"
  report "$OUT_FILE" "macOS say"
  return 0
}

if try_elevenlabs; then exit 0; fi
if try_openai; then exit 0; fi
if try_say; then exit 0; fi

echo "ERROR: no working TTS provider. Set ELEVENLABS_API_KEY or OPENAI_API_KEY, or install ffmpeg for the say fallback." >&2
exit 1
