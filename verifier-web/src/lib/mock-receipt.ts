/**
 * Deterministic mock receipts for offline demo / no-Anvil mode.
 *
 * Same shape as `Receipt` from @sworn/sdk so the renderer doesn't branch.
 * Same chatId in → same receipt out — useful for sharing a demo URL.
 */

import type { Receipt, VerifyCheck } from "@sworn/sdk";

function sha256ish(seed: string, len = 64): string {
  // Browser fallback for a fast deterministic-ish hex. We're not securing
  // anything — just need a reproducible byte string.
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  let out = "";
  let x = h >>> 0;
  while (out.length < len) {
    x = (Math.imul(1664525, x) + 1013904223) | 0;
    out += (x >>> 0).toString(16).padStart(8, "0");
  }
  return "0x" + out.slice(0, len);
}

function shortHash(seed: string, len = 12): string {
  return sha256ish(seed, len * 2).slice(0, 2 + len);
}

export interface MockOutcome {
  receipt: Receipt;
  checks: VerifyCheck[];
  status: "verified" | "partial" | "failed";
  passed: number;
  total: number;
}

export function buildMockOutcome(chatId: string): MockOutcome {
  const seed = chatId.toLowerCase();
  const skip = seed.startsWith("3"); // example #2 → sealed, no key
  const fail = seed.startsWith("ffff"); // explicit failure URL pattern

  const promptH = sha256ish(seed + ":prompt");
  const respH = sha256ish(seed + ":response");
  const sig = sha256ish(seed + ":sig", 128);
  const pubkey = sha256ish(seed + ":pub");
  const rootHash = sha256ish(seed + ":root");
  const txHash = sha256ish(seed + ":tx");

  const receipt: Receipt = {
    version: 1,
    chatId,
    chatIdHash: sha256ish(chatId + ":chatIdHash"),
    provider: {
      address: "0x69EbE4C002eC5e3F0E9C2bE94C3aE08000000000",
      mode: "TeeML",
      pubkeySnapshot: pubkey,
    },
    model: "gemma-3-27b-it",
    request: {
      promptHash: promptH,
      temperature: 1.0,
      topP: 1.0,
      messageCount: 2,
    },
    response: {
      contentHash: respH,
      finishReason: "stop",
      promptTokens: 18,
      completionTokens: 42,
    },
    attestation: {
      teeSignature: sig,
      processResponseResult: true,
    },
    storage: {
      rootHash,
      encrypted: skip,
      encryptionScheme: skip ? "AES-256-CTR" : undefined,
    },
    anchor: {
      chainId: 16601,
      txHash,
      blockNumber: 1_247_893,
      blockTimestamp: Math.floor(Date.now() / 1000) - 3,
    },
    issuer: { address: "0xf39FD6e51aad88F6F4ce6aB8827279cffFb92266", label: "AcmeRefunds Bot" },
  };

  const checks: VerifyCheck[] = [
    {
      name: "anchor.exists",
      status: fail ? "fail" : "pass",
      detail: fail
        ? `no anchor for chatIdHash=${receipt.chatIdHash.slice(0, 14)}...`
        : `rootHash=${rootHash.slice(0, 14)}... block#${receipt.anchor.blockNumber}`,
    },
    {
      name: "storage.retrievable",
      status: fail ? "skip" : "pass",
      detail: fail ? "skipped (no anchor)" : "412B downloaded, rootHash verified",
    },
    {
      name: "storage.decrypts",
      status: fail ? "skip" : skip ? "skip" : "skip",
      detail: skip
        ? "blob is sealed and no decryptKey supplied"
        : fail
        ? "skipped (no anchor)"
        : "blob is public (plaintext JSON); no decryption needed",
    },
    { name: "body.parses", status: fail ? "skip" : "pass", detail: `version=1 chatId=${chatId.slice(0, 8)}...` },
    { name: "body.promptHash", status: fail ? "skip" : "pass", detail: promptH.slice(0, 14) + "..." },
    { name: "body.responseHash", status: fail ? "skip" : "pass", detail: respH.slice(0, 14) + "..." },
    {
      name: "body.teeSignature",
      status: fail ? "skip" : "pass",
      detail: `sig=${sig.slice(0, 10)}... pub=${pubkey.slice(0, 10)}...`,
    },
    { name: "body.processResponseResult", status: fail ? "skip" : "pass", detail: "true at issuance" },
    { name: "anchor.modelHash", status: fail ? "skip" : "pass", detail: "model=gemma-3-27b-it" },
  ];

  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.filter((c) => c.status === "fail").length;

  let status: MockOutcome["status"] = "verified";
  if (failed > 0) status = "failed";
  else if (passed < checks.length) status = "partial";

  return { receipt, checks, status, passed, total: checks.length };
}

// kept for future use when shortHash is needed in components
export const _shortHash = shortHash;
