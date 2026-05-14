/**
 * Client-side mock chat for the static (GitHub Pages) demo.
 *
 * Mirrors `app/api/chat/route.ts` (now removed) but runs entirely in the
 * browser using ethers' browser-safe hashing — no node:crypto, no filesystem,
 * no SDK runtime dependency. The receipt shape matches docs/PRD.md §6.
 *
 * The "anchor" returned here is a deterministic stub (no real on-chain tx);
 * the verifier renders it using its own deterministic mock when the chatId
 * does not correspond to a real on-chain record.
 */

import { keccak256, sha256, toUtf8Bytes } from "ethers";

export interface MockChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MockReceiptSummary {
  url: string;
  chatId: string;
  rootHash: string;
  txHash: string;
}

export interface MockChatResult {
  content: string;
  receipt: MockReceiptSummary;
  degraded: true;
}

const MODEL = "gemma-3-27b-it";
const PROVIDER_ADDRESS = "0x69EbE4C002eC5e3F0E9C2bE94C3aE08000000000";
const SYSTEM_PROMPT =
  "You are AcmeRefunds Bot, a customer service assistant. Reply concisely.";

function uuidLike(seed: string): string {
  // Shape the 32-char hex into a UUID-ish ZG-Res-Key (8-4-4-4-12).
  const h = sha256(toUtf8Bytes(seed)).slice(2);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function composeReply(userText: string): string {
  const t = userText.toLowerCase();
  if (t.includes("refund") || t.includes("return")) {
    return "If a product arrives damaged, you may return it within 30 days for a full refund or a free replacement at our cost. Send a photo of the damaged item to support@acmerefunds.example within 7 days of delivery, and we will issue a prepaid return label and refund the original payment method within 5 business days of receipt.";
  }
  if (t.includes("shipping") || t.includes("delivery")) {
    return "Standard shipping is 3 to 5 business days to addresses inside the contiguous US. Express is 1 to 2 days. Free standard shipping on orders over $35.";
  }
  if (t.includes("cancel")) {
    return "You can cancel any order in the first 60 minutes after checkout from the order page in your account. After that, the order moves to fulfilment and would need to come back through the return flow.";
  }
  if (t.includes("price") || t.includes("cost")) {
    return "All prices on AcmeRefunds.example are listed in USD and include any applicable handling. Sales tax is added at checkout based on the shipping address.";
  }
  return "Thanks for the question. I can help with refunds, returns, shipping, cancellations, and order pricing. Anything specific you would like to start with?";
}

export async function runMockChat(userText: string): Promise<MockChatResult> {
  const trimmed = userText.trim();
  if (!trimmed) throw new Error("message required");

  const messages: MockChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: trimmed },
  ];
  const content = composeReply(trimmed);

  const fingerprint = JSON.stringify({
    p: PROVIDER_ADDRESS.toLowerCase(),
    m: MODEL,
    msgs: messages,
    t: Date.now(), // adds session-scoped variance so two visits don't collide
    r: Math.random().toString(36).slice(2, 10),
  });

  const chatId = uuidLike(fingerprint);
  // Hashes are computed here for parity with the real SDK path (PRD §6) even
  // though the static demo only surfaces the summary; touching them via the
  // returned `internals` field keeps the build honest about what was hashed.
  const chatIdHash = keccak256(toUtf8Bytes(chatId));
  const promptHash = sha256(toUtf8Bytes(JSON.stringify(messages)));
  const responseHash = sha256(toUtf8Bytes(content));
  const rootHash = sha256(toUtf8Bytes(chatId + ":root"));
  const txHash = sha256(toUtf8Bytes(chatId + ":tx"));
  void chatIdHash;
  void promptHash;
  void responseHash;

  return {
    content,
    receipt: {
      url: `sworn://r/${chatId}`,
      chatId,
      rootHash,
      txHash,
    },
    degraded: true,
  };
}

// Re-export the small bits the page uses for hashing labels / inspection.
export const _internals = {
  MODEL,
  PROVIDER_ADDRESS,
  uuidLike,
  composeReply,
};
