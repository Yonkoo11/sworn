/**
 * Hashing utilities used across the SDK.
 *
 * Two algorithms by design:
 *  - keccak256: chatIdHash + modelHash. EVM-native, what the registry indexes by.
 *  - sha256: promptHash + responseHash + content/blob digests. Cheap to compute
 *    in any verifier environment (browsers, CI) without ethers loaded.
 *
 * All inputs are normalised to UTF-8 bytes first. Canonicalisation of the
 * messages array is explicit so independent verifiers reproduce the same
 * promptHash byte-for-byte.
 */

import { createHash } from "node:crypto";
import { keccak256 as ethKeccak256, toUtf8Bytes } from "ethers";
import type { ChatMessage } from "./types.js";

/** keccak256 over a UTF-8 string, returns 0x-prefixed 32-byte hex. */
export function keccak256Utf8(input: string): string {
  return ethKeccak256(toUtf8Bytes(input));
}

/** sha256 over UTF-8 string OR raw bytes, returns 0x-prefixed 32-byte hex. */
export function sha256Hex(input: string | Uint8Array): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input);
  return "0x" + createHash("sha256").update(buf).digest("hex");
}

/**
 * Canonical JSON form of the messages array.
 *
 * Stable across implementations because:
 *  - field order is fixed ({ role, content })
 *  - no extra whitespace
 *  - JSON.stringify already escapes consistently for UTF-8 strings
 *
 * If a future verifier wants to recompute promptHash from a Receipt body,
 * it MUST run the same canonicalisation. That function lives in this file.
 */
export function canonicaliseMessages(messages: ChatMessage[]): string {
  const normalised = messages.map((m) => ({ role: m.role, content: m.content }));
  return JSON.stringify(normalised);
}

/** keccak256 of the chatId string, lowercased to match EVM bytes32. */
export function chatIdHash(chatId: string): string {
  return keccak256Utf8(chatId);
}

/** keccak256 of the model identifier string. */
export function modelHash(model: string): string {
  return keccak256Utf8(model);
}

/** sha256 of the canonicalised messages array. */
export function promptHash(messages: ChatMessage[]): string {
  return sha256Hex(canonicaliseMessages(messages));
}

/** sha256 of the completion text. */
export function responseHash(content: string): string {
  return sha256Hex(content);
}
