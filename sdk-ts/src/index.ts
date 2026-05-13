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
export {
  MockStorage,
  RealStorage,
  createStorage,
  storageBackendFromEnv,
  aesEncrypt,
  aesDecrypt,
  generateEncryptionKey,
  encryptAndUpload,
  downloadAndDecrypt,
} from "./storage.js";
export { ReceiptClient } from "./client.js";
export {
  RegistryAnchor,
  RECEIPT_REGISTRY_ABI,
  loadRegistryAbi,
  type RegistryAnchorOptions,
  type AnchorInput,
  type AnchorResult,
  type AnchorRecord,
} from "./anchor.js";
