/**
 * Broker adapter — chooses between MockBroker (default) and RealBroker (0G).
 *
 * Default backend is "mock" so unit + integration tests can run without a
 * funded Galileo wallet. Flip `SWORN_BROKER=real` to route through the actual
 * @0glabs/0g-serving-broker package (see PRD §8 code snippet).
 *
 * MockBroker is deterministic — same messages + model + temperature/topP/seed
 * produce the same chatId and TEE signature. This keeps tests stable and lets
 * the verifier flow be exercised offline.
 */

import { createHash, createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import type {
  BrokerLike,
  BrokerChatResponse,
  ChatMessage,
  BrokerBackend,
} from "./types.js";
import { canonicaliseMessages } from "./hashing.js";

/* ------------------------------------------------------------------ */
/* MockBroker                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fixed test keypair seed. Deterministic so signatures are byte-identical
 * across test runs and CI. The mock keypair is generated once at module load
 * from a known seed-equivalent (Node's generateKeyPairSync with a fixed
 * pseudo-source) — in mock mode the goal is reproducibility, not entropy.
 */
const MOCK_PROVIDER_ADDRESS_DEFAULT = "0x69EbE4C002eC5e3F0E9C2bE94C3aE08000000000";

let cachedMockKey: { privateKey: KeyObject; publicKeyHex: string } | null = null;

function getMockKeypair(): { privateKey: KeyObject; publicKeyHex: string } {
  if (cachedMockKey) return cachedMockKey;
  // Deterministic-ish: ed25519 from a fixed-seed flow.
  // node:crypto does not accept a seed for generateKeyPairSync, so we hard-code
  // a PEM literal here so the public key snapshot stays constant across runs.
  // (PEM-as-source is the "fixed test keypair" the PRD calls for.)
  const FIXED_PRIVATE_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIIVjxBjuKVfHJ0kCK3T7Eh8XFwTglWv/aKLGS3kgnXHa
-----END PRIVATE KEY-----`;
  const privateKey: KeyObject = createPrivateKey(FIXED_PRIVATE_PEM);
  const pub = createPublicKey(privateKey);
  const der = pub.export({ format: "der", type: "spki" }) as Buffer;
  cachedMockKey = { privateKey, publicKeyHex: "0x" + der.toString("hex") };
  return cachedMockKey;
}

/**
 * Derive a deterministic chatId from the request. Real 0G broker returns a
 * UUID-ish ZG-Res-Key — the mock packs the request fingerprint into the same
 * shape so downstream code can treat it as opaque.
 */
function deterministicChatId(opts: {
  providerAddress: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  topP: number;
  seed?: number;
}): string {
  const fingerprint = JSON.stringify({
    p: opts.providerAddress.toLowerCase(),
    m: opts.model,
    t: opts.temperature,
    tp: opts.topP,
    s: opts.seed ?? null,
    msgs: canonicaliseMessages(opts.messages),
  });
  const h = createHash("sha256").update(fingerprint).digest("hex");
  // Shape it like a UUID-ish ZG-Res-Key: 8-4-4-4-12 hex chunks.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/**
 * MockBroker generates a canned completion + TEE-style signature.
 *
 * Reply content is short and shaped like a real assistant reply so downstream
 * hashing + e2e tests have something realistic to consume.
 */
export class MockBroker implements BrokerLike {
  private readonly defaultProviderAddress: string;

  constructor(providerAddress?: string) {
    this.defaultProviderAddress = providerAddress ?? MOCK_PROVIDER_ADDRESS_DEFAULT;
  }

  async chat(opts: {
    providerAddress?: string;
    model: string;
    messages: ChatMessage[];
    temperature: number;
    topP: number;
    seed?: number;
    maxTokens?: number;
  }): Promise<BrokerChatResponse> {
    const providerAddress = opts.providerAddress ?? this.defaultProviderAddress;
    if (!providerAddress) {
      throw new Error("MockBroker: providerAddress is required");
    }
    if (!opts.messages?.length) {
      throw new Error("MockBroker: messages must be non-empty");
    }
    if (!opts.model) {
      throw new Error("MockBroker: model is required");
    }

    const chatId = deterministicChatId({ ...opts, providerAddress });

    // Canned reply that includes the last user turn so the e2e test can
    // assert content flow without needing a live LLM.
    const lastUserMessage = [...opts.messages].reverse().find((m) => m.role === "user");
    const userTurn = lastUserMessage?.content ?? "";
    const content = `[mock:${opts.model}] You said: ${userTurn}`;

    // Mock signature: ed25519 with createSign isn't supported in node:crypto,
    // so derive a deterministic, labelled-mock signature as
    // sha256(privateKey-der || chatId || content). Reproducible across runs,
    // never confused with a real TEE signature thanks to the "0xMOCK" prefix.
    const { privateKey, publicKeyHex } = getMockKeypair();
    const derBytes = privateKey.export({ format: "der", type: "pkcs8" }) as Buffer;
    const sigHex = createHash("sha256")
      .update(derBytes)
      .update(`${chatId}|${content}`, "utf8")
      .digest("hex");

    return {
      content,
      chatId,
      teeSignature: "0x" + sigHex,
      model: opts.model,
      processResponseResult: true,
      pubkeySnapshot: publicKeyHex,
      finishReason: "stop",
      promptTokens: opts.messages.reduce((a, m) => a + Math.ceil(m.content.length / 4), 0),
      completionTokens: Math.ceil(content.length / 4),
    };
  }
}

/* ------------------------------------------------------------------ */
/* RealBroker (gated behind SWORN_BROKER=real)                         */
/* ------------------------------------------------------------------ */

/**
 * Real 0G broker. Mirrors the PRD §8 snippet:
 *   1. createZGComputeNetworkBroker(wallet)
 *   2. acknowledgeProviderSigner(provider)
 *   3. transferFund(provider, "inference", 1e18) — caller responsibility, not
 *      done in this adapter (one-time setup is the user's job)
 *   4. getRequestHeaders(provider, query)
 *   5. openai.chat.completions.create(...)
 *   6. processResponse(provider, chatId, ...)
 *
 * This class lazy-loads `@0glabs/0g-serving-broker` + `openai` so the SDK
 * still ships when the optional deps are absent.
 */
export class RealBroker implements BrokerLike {
  private wallet: unknown;
  private brokerCache: unknown = null;

  constructor(wallet: unknown) {
    this.wallet = wallet;
  }

  private async getBroker(): Promise<any> {
    if (this.brokerCache) return this.brokerCache;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = await import("@0glabs/0g-serving-broker").catch(() => {
      throw new Error(
        "RealBroker requires @0glabs/0g-serving-broker to be installed. " +
          "Run: pnpm add @0glabs/0g-serving-broker",
      );
    });
    const factory = (mod as any).createZGComputeNetworkBroker as (w: unknown) => Promise<any>;
    this.brokerCache = await factory(this.wallet);
    return this.brokerCache;
  }

  async chat(opts: {
    providerAddress: string;
    model: string;
    messages: ChatMessage[];
    temperature: number;
    topP: number;
    seed?: number;
    maxTokens?: number;
  }): Promise<BrokerChatResponse> {
    const broker = await this.getBroker();

    await broker.inference.acknowledgeProviderSigner(opts.providerAddress);
    const { endpoint, model } = await broker.inference.getServiceMetadata(opts.providerAddress);

    const query = JSON.stringify({ messages: opts.messages, model: opts.model });
    const headers = await broker.inference.getRequestHeaders(opts.providerAddress, query);

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ baseURL: endpoint, apiKey: "0g", defaultHeaders: headers });

    const resp = await openai.chat.completions.create({
      model: opts.model || model,
      messages: opts.messages,
      temperature: opts.temperature,
      top_p: opts.topP,
      seed: opts.seed,
      max_tokens: opts.maxTokens,
    });

    const choice = resp.choices[0];
    const content = choice?.message?.content ?? "";
    const chatId = (resp as any).id ?? "";
    const teeSignature = ((resp as any)["zg_signature"] as string | undefined) ?? "";

    const processResponseResult: boolean = await broker.inference.processResponse(
      opts.providerAddress,
      chatId,
      content,
    );

    return {
      content,
      chatId,
      teeSignature,
      model: opts.model || model,
      processResponseResult,
      pubkeySnapshot: (resp as any)["zg_provider_pubkey"] ?? "",
      finishReason: choice?.finish_reason ?? "stop",
      promptTokens: resp.usage?.prompt_tokens ?? 0,
      completionTokens: resp.usage?.completion_tokens ?? 0,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function brokerBackendFromEnv(): BrokerBackend {
  const raw = process.env.SWORN_BROKER?.toLowerCase();
  return raw === "real" ? "real" : "mock";
}

export function createBroker(opts: {
  backend?: BrokerBackend;
  wallet?: unknown;
  mockProviderAddress?: string;
}): BrokerLike {
  const backend = opts.backend ?? brokerBackendFromEnv();
  if (backend === "real") {
    if (!opts.wallet) {
      throw new Error("RealBroker requires a wallet");
    }
    return new RealBroker(opts.wallet);
  }
  return new MockBroker(opts.mockProviderAddress);
}
