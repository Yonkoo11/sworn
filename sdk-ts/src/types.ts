/**
 * Sworn — Receipt schema v1 + SDK option types.
 * Schema frozen in docs/PRD.md §6. New fields require v2 bump.
 */

import type { Wallet, JsonRpcProvider } from "ethers";

/** Chat message — OpenAI-compatible shape. */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Provider modes. V1 = TeeML only. TeeTLS rejected at SDK level until V2. */
export type ProviderMode = "TeeML" | "TeeTLS";

/** Storage encryption schemes. */
export type EncryptionScheme = "AES-256-CTR" | "ECIES";

/** Receipt — the dispute primitive. Schema v1 (frozen). */
export interface Receipt {
  version: 1;
  /** ZG-Res-Key returned by the provider response. */
  chatId: string;
  /** keccak256(chatId), used as the on-chain index. */
  chatIdHash: string;
  provider: {
    address: string;
    mode: ProviderMode;
    /** Provider attestation pubkey at issuance time (survives rotation). */
    pubkeySnapshot: string;
  };
  /** Model identifier, e.g. "gemma-3-27b-it". */
  model: string;
  request: {
    /** sha256 of the canonicalised messages array. */
    promptHash: string;
    temperature: number;
    seed?: number;
    topP: number;
    messageCount: number;
  };
  response: {
    /** sha256 of the completion text. */
    contentHash: string;
    finishReason: string;
    promptTokens: number;
    completionTokens: number;
  };
  attestation: {
    /** Raw TEE signature returned with the response. */
    teeSignature: string;
    /** Result of broker.inference.processResponse at issuance. */
    processResponseResult: boolean;
  };
  storage: {
    /** 0G Storage Merkle root for the encrypted/plain blob. */
    rootHash: string;
    encrypted: boolean;
    encryptionScheme?: EncryptionScheme;
  };
  anchor: {
    /** 16602 testnet (Galileo) / 16661 mainnet (Aristotle). */
    chainId: number;
    txHash: string;
    blockNumber: number;
    blockTimestamp: number;
  };
  issuer?: {
    address: string;
    /** Optional human-readable label ("Acme Support Bot v3"). */
    label?: string;
  };
}

/** Public-facing receipt summary returned from client.chat(). */
export interface ReceiptSummary {
  /** Where to fetch the full receipt blob. */
  url: string;
  /** Same chatId that was anchored. */
  chatId: string;
  /** 0G Storage Merkle root. */
  rootHash: string;
  /** Anchor transaction hash. */
  txHash: string;
  /** Optional anchor block number. */
  blockNumber?: number;
}

/** Broker backend selector. */
export type BrokerBackend = "real" | "mock";

/** Storage backend selector. */
export type StorageBackend = "real" | "mock";

/** Options at SDK construction time. */
export interface ReceiptClientOptions {
  /**
   * ethers v6 Wallet OR a signer-equivalent. Used to:
   *   1. sign on-chain anchor txs
   *   2. pay 0G Compute provider via the broker
   */
  wallet: Wallet;
  /** RPC provider — defaults to wallet.provider. */
  provider?: JsonRpcProvider;
  /** Deployed ReceiptRegistry address. */
  registry: string;
  /** TeeML or TeeTLS provider address (e.g. Gemma 3 27B). */
  providerAddress: string;
  /**
   * Attestation tier of the provider. "TeeML" (default) means the TEE runs
   * the model itself; "TeeTLS" means the TEE proxies an upstream provider
   * over TLS (weaker, transport-only). The verifier renders both with
   * different labels.
   */
  providerMode?: ProviderMode;
  /** Emit receipts by default. Can be overridden per-call. */
  attest?: boolean;
  /** "sealed" (default, encrypted) or "public" (plaintext blob). */
  receiptEncryption?: "sealed" | "public";
  /** AES-256-CTR key (hex, 32 bytes) used for sealed receipts. Required if attest && sealed. */
  encryptionKey?: string;
  /**
   * Backend selectors (default "mock" if env SWORN_BROKER / SWORN_STORAGE unset).
   * Real backends call live Galileo; mock backends are deterministic stubs.
   */
  brokerBackend?: BrokerBackend;
  storageBackend?: StorageBackend;
  /** Optional issuer label baked into the receipt body. */
  issuerLabel?: string;
}

/** Options for a single chat call. */
export interface ChatOptions {
  messages: ChatMessage[];
  /** Model identifier, e.g. "gemma-3-27b-it". */
  model: string;
  temperature?: number;
  topP?: number;
  seed?: number;
  maxTokens?: number;
  /** Override SDK default. */
  attest?: boolean;
}

/** Result returned from client.chat(). */
export interface ChatResult {
  /** AI response text. */
  content: string;
  /** Present when attest === true. */
  receipt?: ReceiptSummary;
  /** Raw full receipt body, present when attest === true. */
  fullReceipt?: Receipt;
}

/** Shape returned by any broker backend for a chat completion. */
export interface BrokerChatResponse {
  content: string;
  chatId: string;
  /** Provider's TEE signature on the response. */
  teeSignature: string;
  /** Model echoed by the provider. */
  model: string;
  /** Result of processResponse — true means TEE attestation checks pass. */
  processResponseResult: boolean;
  /** Provider attestation pubkey at this moment. */
  pubkeySnapshot: string;
  finishReason: string;
  promptTokens: number;
  completionTokens: number;
}

/** Shape returned by any storage backend after upload. */
export interface StorageUploadResult {
  rootHash: string;
  /** Some backends return a tx hash for the storage transfer. Empty string for in-memory mocks. */
  storageTxHash: string;
}

/** Broker backend contract. */
export interface BrokerLike {
  chat(opts: {
    providerAddress: string;
    model: string;
    messages: ChatMessage[];
    temperature: number;
    topP: number;
    seed?: number;
    maxTokens?: number;
  }): Promise<BrokerChatResponse>;
}

/** Storage backend contract. */
export interface StorageLike {
  /** Upload a binary blob, return rootHash. */
  upload(blob: Uint8Array): Promise<StorageUploadResult>;
  /** Download a blob by rootHash. Throws if not found. */
  download(rootHash: string): Promise<Uint8Array>;
}
