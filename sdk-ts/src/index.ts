/**
 * @sworn/sdk public entrypoint.
 * Schema and surface frozen per docs/PRD.md §6 + §8.
 */

export type {
  ChatMessage,
  ProviderMode,
  EncryptionScheme,
  Receipt,
  ReceiptSummary,
  ReceiptClientOptions,
  ChatOptions,
  ChatResult,
  BrokerBackend,
  StorageBackend,
  BrokerChatResponse,
  StorageUploadResult,
  BrokerLike,
  StorageLike,
} from "./types.js";

export {
  keccak256Utf8,
  sha256Hex,
  canonicaliseMessages,
  chatIdHash,
  modelHash,
  promptHash,
  responseHash,
} from "./hashing.js";

export { MockBroker, RealBroker, createBroker, brokerBackendFromEnv } from "./broker.js";
export { ReceiptClient } from "./client.js";
