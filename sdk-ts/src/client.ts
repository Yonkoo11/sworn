/**
 * ReceiptClient — the developer-facing surface.
 *
 * V1 surface frozen in docs/PRD.md §8: `client.chat({ messages, model })`
 * returns `{ content, receipt?: ReceiptSummary, fullReceipt?: Receipt }`.
 *
 * This file is intentionally small. The heavy lifting lives in the three
 * adapters (broker / storage / anchor); ReceiptClient stitches them.
 *
 * - T5 (this file's first pass): wire MockBroker, hash the request/response,
 *   return `{ content, chatId }` so the unit test can assert the call shape.
 * - T8 will extend `chat()` to upload + anchor + return a full ReceiptSummary.
 */

import type {
  BrokerLike,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ProviderMode,
  ReceiptClientOptions,
  StorageLike,
} from "./types.js";
import {
  chatIdHash as chatIdHashFn,
  modelHash as modelHashFn,
  promptHash as promptHashFn,
  responseHash as responseHashFn,
} from "./hashing.js";
import { createBroker } from "./broker.js";

/** Default OpenAI-like temperature/topP if the caller omits them. */
const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_TOP_P = 1.0;

/**
 * Reject TeeTLS at the SDK boundary per PRD §11 + CLAUDE.md "TeeML only in V1".
 * Even mock-mode is V1 — the test backend must not let TeeTLS pass.
 */
function assertTeeMLMode(mode: ProviderMode): void {
  if (mode !== "TeeML") {
    throw new Error(
      `Sworn V1 only supports TeeML providers. Received mode="${mode}". ` +
        `TeeTLS support is scheduled for V2 (see docs/PRD.md §11).`,
    );
  }
}

/**
 * Internal handle so T8 can compose chat() out of broker + storage + anchor.
 * The public surface only exposes `chat()` itself.
 */
export class ReceiptClient {
  private readonly opts: ReceiptClientOptions;
  private readonly broker: BrokerLike;
  // Wired in T8 (storage upload + anchor). Underscored so tsc treats it as
  // intentionally-pending without disabling unused-locals globally.
  protected readonly _storage?: StorageLike;

  constructor(opts: ReceiptClientOptions, deps?: { broker?: BrokerLike; storage?: StorageLike }) {
    this.opts = opts;
    this.broker =
      deps?.broker ??
      createBroker({
        backend: opts.brokerBackend,
        wallet: opts.wallet,
      });
    this._storage = deps?.storage;
  }

  /**
   * Run a chat completion and (in T8) emit a receipt.
   *
   * For T5 the return shape is `{ content }` plus an internal hash bundle
   * exposed via `chatRaw` for tests. T8 will wire the full `receipt`/
   * `fullReceipt` fields.
   */
  async chat(opts: ChatOptions): Promise<ChatResult> {
    const result = await this.chatRaw(opts);
    return { content: result.content };
  }

  /**
   * Internal: returns the broker response + pre-computed hashes. T8 uses this
   * to assemble the receipt; tests use it to assert the call worked.
   */
  async chatRaw(opts: ChatOptions): Promise<{
    content: string;
    chatId: string;
    chatIdHash: string;
    modelHash: string;
    promptHash: string;
    responseHash: string;
    teeSignature: string;
    pubkeySnapshot: string;
    processResponseResult: boolean;
    finishReason: string;
    promptTokens: number;
    completionTokens: number;
    temperature: number;
    topP: number;
    seed?: number;
    messages: ChatMessage[];
    model: string;
  }> {
    if (!opts.messages?.length) {
      throw new Error("chat: messages must be non-empty");
    }
    if (!opts.model) {
      throw new Error("chat: model is required");
    }
    // TeeML-only gate. The SDK doesn't accept a `mode` param yet (TeeML is
    // implicit), so this is the place to reject any future TeeTLS leak.
    assertTeeMLMode("TeeML");

    const temperature = opts.temperature ?? DEFAULT_TEMPERATURE;
    const topP = opts.topP ?? DEFAULT_TOP_P;

    const brokerResponse = await this.broker.chat({
      providerAddress: this.opts.providerAddress,
      model: opts.model,
      messages: opts.messages,
      temperature,
      topP,
      seed: opts.seed,
      maxTokens: opts.maxTokens,
    });

    return {
      content: brokerResponse.content,
      chatId: brokerResponse.chatId,
      chatIdHash: chatIdHashFn(brokerResponse.chatId),
      modelHash: modelHashFn(brokerResponse.model),
      promptHash: promptHashFn(opts.messages),
      responseHash: responseHashFn(brokerResponse.content),
      teeSignature: brokerResponse.teeSignature,
      pubkeySnapshot: brokerResponse.pubkeySnapshot,
      processResponseResult: brokerResponse.processResponseResult,
      finishReason: brokerResponse.finishReason,
      promptTokens: brokerResponse.promptTokens,
      completionTokens: brokerResponse.completionTokens,
      temperature,
      topP,
      seed: opts.seed,
      messages: opts.messages,
      model: brokerResponse.model,
    };
  }
}
