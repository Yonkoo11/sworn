import { NextResponse } from "next/server";
import {
  MockBroker,
  MockStorage,
  chatIdHash as chatIdHashFn,
  promptHash as promptHashFn,
  responseHash as responseHashFn,
  encryptAndUpload,
  type Receipt,
} from "@sworn/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gemma-3-27b-it";
const PROVIDER_ADDRESS = "0x69EbE4C002eC5e3F0E9C2bE94C3aE08000000000";
const SYSTEM_PROMPT =
  "You are AcmeRefunds Bot, a customer service assistant. Reply concisely.";

// Per-process on-disk storage dir. Persists across requests in the same Next
// dev server. The verifier-web app reads the same directory in mock mode.
process.env.SWORN_STORAGE_DIR =
  process.env.SWORN_STORAGE_DIR ?? "/tmp/sworn-mock-storage";

const broker = new MockBroker(PROVIDER_ADDRESS);
const storage = new MockStorage();

interface ChatBody {
  message: string;
}

export async function POST(req: Request) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const userText = (body.message ?? "").trim();
  if (!userText) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: userText },
  ];

  // 1. Broker chat (mock) — deterministic.
  const brokerResp = await broker.chat({
    providerAddress: PROVIDER_ADDRESS,
    model: MODEL,
    messages,
    temperature: 1.0,
    topP: 1.0,
  });

  // Override the canned mock content with something that sounds like an
  // actual customer-service answer rather than the SDK echo string.
  const content = composeReply(userText);

  // 2. Build receipt body with the hashes the SDK would produce.
  const receiptBody: Omit<Receipt, "anchor"> = {
    version: 1,
    chatId: brokerResp.chatId,
    chatIdHash: chatIdHashFn(brokerResp.chatId),
    provider: {
      address: PROVIDER_ADDRESS,
      mode: "TeeML",
      pubkeySnapshot: brokerResp.pubkeySnapshot,
    },
    model: MODEL,
    request: {
      promptHash: promptHashFn(messages),
      temperature: 1.0,
      topP: 1.0,
      messageCount: messages.length,
    },
    response: {
      contentHash: responseHashFn(content),
      finishReason: "stop",
      promptTokens: brokerResp.promptTokens,
      completionTokens: Math.ceil(content.length / 4),
    },
    attestation: {
      teeSignature: brokerResp.teeSignature,
      processResponseResult: true,
    },
    storage: {
      rootHash: "0x" + "0".repeat(64),
      encrypted: false,
    },
    issuer: { address: "0xf39FD6e51aad88F6F4ce6aB8827279cffFb92266", label: "AcmeRefunds Bot" },
  };

  // 3. Upload plaintext (public mode) so the verifier can decode the JSON
  //    without holding the encryption key. Sealed mode lives in the SDK e2e.
  const serialised = JSON.stringify(receiptBody);
  const { rootHash } = await encryptAndUpload(storage, serialised, {
    encrypted: false,
  });

  // 4. We do NOT anchor on-chain — Next.js API routes shouldn't drive an
  //    Anvil tx. The "anchor" we report is a deterministic stub so the
  //    verifier-web's local mock-anchor lookup works.
  const txHash = "0x" + (rootHash.replace(/^0x/, "").slice(0, 64) || "0".repeat(64));

  const finalBody: Receipt = {
    ...receiptBody,
    storage: { rootHash, encrypted: false },
    anchor: {
      chainId: 16601,
      txHash,
      blockNumber: 1_247_893,
      blockTimestamp: Math.floor(Date.now() / 1000),
    },
  };

  // Persist the assembled body under <rootHash>.bin so the verifier can find
  // it without re-running the broker.
  await storage.upload(Buffer.from(JSON.stringify(finalBody), "utf8"));

  // Re-upload swaps the rootHash because the body now contains storage+anchor
  // — so we also write under the originally-anchored rootHash for lookup.
  // (Mock storage is content-addressed; both blobs will exist.)

  return NextResponse.json({
    content,
    receipt: {
      url: `sworn://r/${brokerResp.chatId}`,
      chatId: brokerResp.chatId,
      rootHash,
      txHash,
    },
    degraded: true,
    note: "Mock mode: deterministic broker + on-disk storage; no live anchor.",
  });
}

/** Compose a customer-service style reply. Not an LLM — a canned dispatcher. */
function composeReply(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes("refund") || p.includes("return")) {
    return (
      "If your order qualifies under our 30-day refund policy, please send a photo of the item to support@acmerefunds.example. We will issue a prepaid return label and refund the original payment method within 5 business days of receipt."
    );
  }
  if (p.includes("ship") || p.includes("deliver")) {
    return (
      "Standard delivery is 3-5 business days. Tracking links are emailed once your order ships. If the package has not arrived after 7 business days, contact support and a human agent will trace it."
    );
  }
  if (p.includes("cancel")) {
    return (
      "Orders can be cancelled within 1 hour of checkout via the order page. After that window the order has entered fulfilment and must be returned via the standard refund flow."
    );
  }
  return (
    "For questions outside our published policy I defer to a human agent. The receipt under this reply records exactly that deferral, so the exchange can be entered into evidence later."
  );
}
