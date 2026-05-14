/**
 * Deterministic mock generator for the "recent anchors" stream.
 * No live RPC required. Same seed produces the same sequence so SSR + CSR
 * agree on initial frame.
 */

const HEX = "0123456789abcdef";

/** Tiny deterministic PRNG (mulberry32). */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface AnchorRow {
  ts: string;
  chatId: string;
  rootHash: string;
  block: number;
}

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function randomHex(rnd: () => number, n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[Math.floor(rnd() * 16)];
  return s;
}

/** Format a chatId-shortened display like `9a4f8d2b…2c3d`. */
function chatIdShort(rnd: () => number): string {
  return `${randomHex(rnd, 8)}…2${randomHex(rnd, 3)}`;
}

/** Build N rows ending at `nowMs`, spaced ~15-25s apart. */
export function buildAnchorRows(opts: {
  count: number;
  seed: number;
  nowMs: number;
}): AnchorRow[] {
  const rnd = mulberry32(opts.seed);
  const rows: AnchorRow[] = [];
  let t = opts.nowMs;
  for (let i = 0; i < opts.count; i++) {
    const date = new Date(t);
    const ts = `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
    rows.push({
      ts,
      chatId: chatIdShort(rnd),
      rootHash: "0x" + randomHex(rnd, 12),
      block: 1247800 + i,
    });
    t -= 14_000 + Math.floor(rnd() * 12_000);
  }
  return rows;
}

/** Build one fresh row at `nowMs`. */
export function buildFreshAnchorRow(seed: number, nowMs: number): AnchorRow {
  const rnd = mulberry32(seed);
  const date = new Date(nowMs);
  return {
    ts: `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
    chatId: chatIdShort(rnd),
    rootHash: "0x" + randomHex(rnd, 12),
    block: 1247893,
  };
}
