/**
 * ReceiptClient — the developer-facing surface.
 *
 * V1 surface frozen in docs/PRD.md §8: `client.chat({ messages, model })`
 * returns `{ content, receipt?: ReceiptSummary, fullReceipt?: Receipt }`.
 *
 * This file is intentionally small. The heavy lifting lives in the three
 * adapters (broker / storage / anchor); ReceiptClient stitches them.
 *
 * - T5 (first pass): wire MockBroker, hash request/response, return content.
 * - T8 (this revision): assemble the full Receipt body, encrypt+upload via
 *   the storage adapter, anchor on-chain via RegistryAnchor, and return a
 *   ReceiptSummary + fullReceipt.
 */

import type {
  BrokerLike,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ProviderMode,
  Receipt,
  ReceiptClientOptions,
  ReceiptSummary,
  StorageLike,
} from "./types.js";
import {
  chatIdHash as chatIdHashFn,
  modelHash as modelHashFn,
  promptHash as promptHashFn,
  responseHash as responseHashFn,
} from "./hashing.js";
import { createBroker } from "./broker.js";
import { createStorage, encryptAndUpload } from "./storage.js";
import { RegistryAnchor } from "./anchor.js";
import { JsonRpcProvider } from "ethers";

/** Default OpenAI-like temperature/topP if the caller omits them. */
const DEFAULT_TEMPERATURE = 1.0;
const DEFAULT_TOP_P = 1.0;

/**
 * Validate the declared provider mode. V1.1 supports both modes, labelled
 * differently in the receipt so a verifier never overstates the attestation
 * strength:
 *   - TeeML   = "model-attested" (TEE runs the model; signed output binds to
 *                inputs cryptographically — strongest)
 *   - TeeTLS  = "transport-attested" (TEE proxies an upstream provider's
 *                response over TLS; binds the transport, not the model —
 *                weaker, but still useful for the ~half of 0G's provider menu)
 * Unknown modes are rejected at the SDK boundary.
 */
function assertValidProviderMode(mode: ProviderMode): void {
  if (mode !== "TeeML" && mode !== "TeeTLS") {
    throw new Error(
      `Unknown provider.mode="${mode}". Sworn supports TeeML | TeeTLS.`,
    );
  }
}

/** V1 receipt URI scheme. Web UI rewrites this to an https URL later. */
export function receiptUrlForChatId(chatId: string): string {
  return `sworn://r/${chatId}`;
}

/**
 * Internal handle composing chat() out of broker + storage + anchor.
 * The public surface only exposes `chat()` itself.
 */
export class ReceiptClient {
  private readonly opts: ReceiptClientOptions;
  private readonly broker: BrokerLike;
  protected readonly _storage: StorageLike;
  protected readonly _anchor?: RegistryAnchor;

  constructor(
    opts: ReceiptClientOptions,
    deps?: { broker?: BrokerLike; storage?: StorageLike; anchor?: RegistryAnchor },
  ) {
    this.opts = opts;
    this.broker =
      deps?.broker ??
      createBroker({
        backend: opts.brokerBackend,
        wallet: opts.wallet,
      });
    this._storage =
      deps?.storage ??
      createStorage({
        backend: opts.storageBackend,
        wallet: opts.wallet,
      });
    // The anchor is only constructible when we know the RPC + registry. The
    // tests inject one directly; in real use the caller passes wallet+registry
    // and we wire it from opts. The `opts.provider` already carries an RPC.
    if (deps?.anchor) {
      this._anchor = deps.anchor;
    } else if (opts.registry && opts.wallet) {
      const rpcUrl =
        (opts.provider as unknown as { _getConnection?: () => { url: string } })
          ?._getConnection?.()?.url ??
        process.env.SWORN_RPC_URL ??
        "";
      if (rpcUrl) {
        this._anchor = new RegistryAnchor({
          rpcUrl,
          registryAddress: opts.registry,
          wallet: opts.wallet,
        });
      }
    }
  }

  /**
   * Run a chat completion and (if attest is on, which is the V1 default) emit
   * a receipt anchored on-chain with the body stored encrypted on 0G Storage.
   *
   * Returns `{ content }` only when `attest=false`. Otherwise the full
   * `{ content, receipt, fullReceipt }` triple — receipt is the small public
   * summary, fullReceipt is the §6 schema body.
   */
  async chat(opts: ChatOptions): Promise<ChatResult> {
    const raw = await this.chatRaw(opts);
    // Opt-in: a caller must explicitly set `attest: true` either at construction
    // (`new ReceiptClient({ attest: true, ... })`) or per-call. This avoids
    // surprise gas+storage charges on a vanilla `chat()` call. The PRD §8
    // example sets `attest: true` at construction — same shape as here.
    const attest = opts.attest ?? this.opts.attest ?? false;
    if (!attest) {
      return { content: raw.content };
    }
    if (!this._anchor) {
      throw new Error(
        "chat: attest=true requires a configured registry+wallet (or an injected anchor)",
      );
    }

    const encryptionMode = this.opts.receiptEncryption ?? "sealed";
    const sealed = encryptionMode === "sealed";
    if (sealed && !this.opts.encryptionKey) {
      throw new Error(
        "chat: receiptEncryption=sealed requires an encryptionKey (32-byte hex). " +
          "Pass `encryptionKey` to ReceiptClient or set receiptEncryption: \"public\".",
      );
    }

    // Step 1: pre-compute the receipt body WITHOUT storage.rootHash / anchor
    // fields, then JSON, encrypt, upload to get rootHash. We then anchor that
    // rootHash on-chain. Finally we fold tx/block info back into the receipt
    // body returned to the caller. The body persisted on storage is the
    // pre-anchor view (it doesn't know its own txHash yet — which is normal
    // for any commit-then-anchor pipeline).
    const bodyForStorage: Omit<Receipt, "anchor"> & { anchor?: undefined } = {
      version: 1,
      chatId: raw.chatId,
      chatIdHash: raw.chatIdHash,
      provider: {
        address: this.opts.providerAddress,
        mode: this.opts.providerMode ?? "TeeML",
        pubkeySnapshot: raw.pubkeySnapshot,
      },
      model: raw.model,
      request: {
        promptHash: raw.promptHash,
        temperature: raw.temperature,
        seed: raw.seed,
        topP: raw.topP,
        messageCount: raw.messages.length,
      },
      response: {
        contentHash: raw.responseHash,
        finishReason: raw.finishReason,
        promptTokens: raw.promptTokens,
        completionTokens: raw.completionTokens,
      },
      attestation: {
        teeSignature: raw.teeSignature,
        processResponseResult: raw.processResponseResult,
      },
      storage: {
        // Filled below after upload; kept as a placeholder so JSON shape is
        // stable for hashing tools that pre-validate.
        rootHash: "0x" + "0".repeat(64),
        encrypted: sealed,
        encryptionScheme: sealed ? "AES-256-CTR" : undefined,
      },
      issuer: this.opts.wallet
        ? {
            address: this.opts.wallet.address,
            label: this.opts.issuerLabel,
          }
        : undefined,
    };

    // Self-reference: the rootHash inside the body would be circular, so we
    // upload the body WITH a zero placeholder, then fold the real rootHash
    // into the in-memory copy returned to the caller. The verifier knows the
    // canonical authority for rootHash is the on-chain anchor, not the body.
    const serialised = JSON.stringify(bodyForStorage);
    const { rootHash } = await encryptAndUpload(this._storage, serialised, {
      encrypted: sealed,
      keyHex: this.opts.encryptionKey,
    });

    // Step 2: anchor on-chain.
    const anchorResult = await this._anchor.anchor({
      chatIdHash: raw.chatIdHash,
      storageRootHash: rootHash,
      providerAddress: this.opts.providerAddress,
      modelHash: raw.modelHash,
    });

    // Step 3: assemble the returned receipt — the in-memory body now has the
    // real rootHash + anchor fields filled in.
    const fullReceipt: Receipt = {
      ...(bodyForStorage as Omit<Receipt, "anchor">),
      storage: {
        rootHash,
        encrypted: sealed,
        encryptionScheme: sealed ? "AES-256-CTR" : undefined,
      },
      anchor: {
        chainId: await this.chainId(),
        txHash: anchorResult.txHash,
        blockNumber: anchorResult.blockNumber,
        blockTimestamp: anchorResult.blockTimestamp,
      },
    };

    const receipt: ReceiptSummary = {
      url: receiptUrlForChatId(raw.chatId),
      chatId: raw.chatId,
      rootHash,
      txHash: anchorResult.txHash,
      blockNumber: anchorResult.blockNumber,
    };

    return { content: raw.content, receipt, fullReceipt };
  }

  /** Try to read chainId off the wallet provider; default to 0 if not wired. */
  private async chainId(): Promise<number> {
    const provider = this.opts.wallet?.provider ?? this.opts.provider;
    if (!provider) return 0;
    try {
      const net = await (provider as JsonRpcProvider).getNetwork();
      return Number(net.chainId);
    } catch {
      return 0;
    }
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
    // Validate the declared mode (TeeML | TeeTLS). Receipts carry the mode
    // verbatim so a verifier can label the attestation tier honestly.
    assertValidProviderMode(this.opts.providerMode ?? "TeeML");

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
