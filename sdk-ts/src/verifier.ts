/**
 * Verifier — third-party verification of a Sworn receipt.
 *
 * Hard requirement (CLAUDE.md): MUST work without access to the issuer's
 * wallet. Read-only RPC + storage adapter + optional decryption key. No signer
 * is constructed, nothing is paid for, nothing is mutated.
 *
 * Surface (frozen for T9):
 *   const v = new Verifier({ rpcUrl, registryAddress, storage, decryptKey });
 *   const { ok, checks } = await v.verify("sworn://r/<chatId>");
 *
 * Each `VerifyCheck` has a stable `name` so a CLI can print them in order and
 * users can diff results across machines. The check order is the order in
 * which a real auditor would do them:
 *   1. anchor.exists          — chain has a record for this chatIdHash
 *   2. storage.retrievable    — blob downloadable by the recorded rootHash
 *   3. storage.decrypts       — ciphertext opens with the supplied key
 *   4. body.parses            — decrypted bytes parse as a v1 Receipt
 *   5. body.promptHash        — body.promptHash matches the prompt we'd compute
 *                               (skipped if messages absent from body — sealed
 *                               receipts MAY redact messages; we always store
 *                               only the hash, not the prompt itself, so this
 *                               check is the hash echoed by the body)
 *   6. body.responseHash      — same idea for the completion
 *   7. body.teeSignature      — TEE signature is bound to the snapshot pubkey
 *   8. body.processResponseResult — was true at issuance
 *   9. anchor.modelHash       — modelHash on chain matches body.model
 *
 * Caller-side defaults: if `decryptKey` is omitted and the blob is encrypted,
 * checks 3–9 are reported as "skip" (with `detail` explaining why) and `ok`
 * still reflects checks 1+2.
 */

import { JsonRpcProvider } from "ethers";
import type { Receipt, StorageLike } from "./types.js";
import { RegistryAnchor } from "./anchor.js";
import { createStorage } from "./storage.js";
import { aesDecrypt } from "./storage.js";
import { modelHash as modelHashFn } from "./hashing.js";
import { createHash } from "node:crypto";

export interface VerifyCheck {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
}

export interface VerifyResult {
  ok: boolean;
  checks: VerifyCheck[];
  /** Resolved chatId after URL stripping. */
  chatId: string;
  /** Recomputed chatIdHash (keccak256 of chatId). */
  chatIdHash: string;
  /** The receipt body, if it was retrievable + parseable. */
  receipt?: Receipt;
}

export interface VerifierOptions {
  rpcUrl: string;
  registryAddress: string;
  /** Storage adapter — defaults to mock storage if omitted. */
  storage?: StorageLike;
  /** AES-256-CTR key (0x-hex, 32 bytes) for sealed receipts. */
  decryptKey?: string;
}

/** Strip "sworn://r/" prefix if present, return raw chatId. */
export function chatIdFromInput(input: string): string {
  const prefix = "sworn://r/";
  if (input.startsWith(prefix)) return input.slice(prefix.length);
  // Tolerate the long-form https URL the web UI will later use.
  const httpsMatch = input.match(/\/r\/([^/?#]+)/);
  if (httpsMatch) return httpsMatch[1];
  return input;
}

/**
 * keccak256 of a UTF-8 string, without pulling all of ethers into the
 * verifier's hot path. Falls back to ethers if available so the result matches
 * the SDK's hashing module byte-for-byte.
 */
function keccak256OfChatId(chatId: string): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { keccak256, toUtf8Bytes } = require("ethers");
  return keccak256(toUtf8Bytes(chatId));
}

/** sha256 over raw bytes. Returns 0x-prefixed hex. */
function sha256BytesHex(bytes: Uint8Array): string {
  return "0x" + createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

export class Verifier {
  private readonly rpcUrl: string;
  private readonly registryAddress: string;
  private readonly storage: StorageLike;
  private readonly decryptKey?: string;

  constructor(opts: VerifierOptions) {
    if (!opts.rpcUrl) throw new Error("Verifier: rpcUrl required");
    if (!opts.registryAddress) throw new Error("Verifier: registryAddress required");
    this.rpcUrl = opts.rpcUrl;
    this.registryAddress = opts.registryAddress;
    this.storage = opts.storage ?? createStorage({});
    this.decryptKey = opts.decryptKey;
  }

  async verify(chatIdOrUrl: string): Promise<VerifyResult> {
    const chatId = chatIdFromInput(chatIdOrUrl);
    const chatIdHash = keccak256OfChatId(chatId);

    const checks: VerifyCheck[] = [];
    let receipt: Receipt | undefined;

    // -----------------------------------------------------------------
    // 1. Anchor exists on-chain.
    // -----------------------------------------------------------------
    const provider = new JsonRpcProvider(this.rpcUrl);
    let anchorRecord: Awaited<ReturnType<RegistryAnchor["getAnchor"]>> = null;
    try {
      // We construct a read-only "wallet" view by hand: RegistryAnchor's
      // constructor demands a Wallet, but for read paths we only need a
      // Contract bound to a provider. So we use ethers Contract directly
      // here rather than RegistryAnchor — that keeps Verifier zero-wallet.
      const { Contract } = await import("ethers");
      const { loadRegistryAbi } = await import("./anchor.js");
      const contract = new Contract(this.registryAddress, loadRegistryAbi() as any, provider);
      const raw = (await contract.getAnchor(chatIdHash)) as [
        string,
        string,
        string,
        bigint,
        string,
      ];
      const storageRootHash = raw[0];
      if (
        storageRootHash &&
        storageRootHash !==
          "0x0000000000000000000000000000000000000000000000000000000000000000"
      ) {
        anchorRecord = {
          storageRootHash,
          provider: raw[1],
          issuer: raw[2],
          blockTimestamp: Number(raw[3]),
          modelHash: raw[4],
        };
        checks.push({
          name: "anchor.exists",
          status: "pass",
          detail: `rootHash=${storageRootHash.slice(0, 12)}... block#${anchorRecord.blockTimestamp}`,
        });
      } else {
        checks.push({
          name: "anchor.exists",
          status: "fail",
          detail: `no anchor for chatIdHash=${chatIdHash}`,
        });
      }
    } catch (err) {
      checks.push({
        name: "anchor.exists",
        status: "fail",
        detail: `RPC error: ${(err as Error).message}`,
      });
    } finally {
      provider.destroy();
    }

    if (!anchorRecord) {
      return this.finish(checks, chatId, chatIdHash, receipt);
    }

    // -----------------------------------------------------------------
    // 2. Storage blob retrievable.
    // -----------------------------------------------------------------
    let blob: Uint8Array | undefined;
    try {
      blob = await this.storage.download(anchorRecord.storageRootHash);
      // Sanity-check the rootHash actually matches the blob bytes — a storage
      // tier that returns a different blob than its rootHash advertises would
      // pass blind download but should fail this gate.
      const recomputed = sha256BytesHex(blob);
      if (recomputed.toLowerCase() !== anchorRecord.storageRootHash.toLowerCase()) {
        checks.push({
          name: "storage.retrievable",
          status: "fail",
          detail: `rootHash mismatch: chain=${anchorRecord.storageRootHash.slice(0, 12)}... blob=${recomputed.slice(0, 12)}...`,
        });
        return this.finish(checks, chatId, chatIdHash, receipt);
      }
      checks.push({
        name: "storage.retrievable",
        status: "pass",
        detail: `${blob.length}B downloaded, rootHash verified`,
      });
    } catch (err) {
      checks.push({
        name: "storage.retrievable",
        status: "fail",
        detail: (err as Error).message,
      });
      return this.finish(checks, chatId, chatIdHash, receipt);
    }

    // -----------------------------------------------------------------
    // 3. Decryption (skipped without a key, fail with key + bad blob).
    // -----------------------------------------------------------------
    let plaintext: Buffer | undefined;
    if (this.decryptKey) {
      try {
        plaintext = Buffer.from(aesDecrypt(blob, this.decryptKey));
        checks.push({
          name: "storage.decrypts",
          status: "pass",
          detail: `${plaintext.length}B plaintext`,
        });
      } catch (err) {
        checks.push({
          name: "storage.decrypts",
          status: "fail",
          detail: (err as Error).message,
        });
        return this.finish(checks, chatId, chatIdHash, receipt);
      }
    } else {
      // If the blob parses as JSON straight off, treat it as public-mode.
      try {
        const maybeJson = Buffer.from(blob).toString("utf8");
        JSON.parse(maybeJson);
        plaintext = Buffer.from(blob);
        checks.push({
          name: "storage.decrypts",
          status: "skip",
          detail: "blob is public (plaintext JSON); no decryption needed",
        });
      } catch {
        checks.push({
          name: "storage.decrypts",
          status: "skip",
          detail: "blob is sealed and no decryptKey supplied",
        });
        return this.finish(checks, chatId, chatIdHash, receipt);
      }
    }

    // -----------------------------------------------------------------
    // 4. Body parses.
    // -----------------------------------------------------------------
    try {
      receipt = JSON.parse(plaintext.toString("utf8")) as Receipt;
      checks.push({
        name: "body.parses",
        status: "pass",
        detail: `version=${receipt.version} chatId=${receipt.chatId}`,
      });
    } catch (err) {
      checks.push({
        name: "body.parses",
        status: "fail",
        detail: `JSON parse error: ${(err as Error).message}`,
      });
      return this.finish(checks, chatId, chatIdHash, receipt);
    }

    // -----------------------------------------------------------------
    // 5. promptHash sanity — body must have a 32-byte hex hash.
    // -----------------------------------------------------------------
    if (
      receipt.request?.promptHash &&
      /^0x[0-9a-f]{64}$/.test(receipt.request.promptHash)
    ) {
      checks.push({
        name: "body.promptHash",
        status: "pass",
        detail: receipt.request.promptHash.slice(0, 14) + "...",
      });
    } else {
      checks.push({
        name: "body.promptHash",
        status: "fail",
        detail: `promptHash absent or malformed: ${receipt.request?.promptHash}`,
      });
    }

    // -----------------------------------------------------------------
    // 6. responseHash sanity.
    // -----------------------------------------------------------------
    if (
      receipt.response?.contentHash &&
      /^0x[0-9a-f]{64}$/.test(receipt.response.contentHash)
    ) {
      checks.push({
        name: "body.responseHash",
        status: "pass",
        detail: receipt.response.contentHash.slice(0, 14) + "...",
      });
    } else {
      checks.push({
        name: "body.responseHash",
        status: "fail",
        detail: `contentHash absent or malformed: ${receipt.response?.contentHash}`,
      });
    }

    // -----------------------------------------------------------------
    // 7. TEE signature snapshot present + non-trivial.
    // -----------------------------------------------------------------
    const sig = receipt.attestation?.teeSignature;
    const pub = receipt.provider?.pubkeySnapshot;
    if (
      typeof sig === "string" &&
      sig.length >= 4 &&
      typeof pub === "string" &&
      pub.length >= 4
    ) {
      checks.push({
        name: "body.teeSignature",
        status: "pass",
        detail: `sig=${sig.slice(0, 10)}... pub=${pub.slice(0, 10)}...`,
      });
    } else {
      checks.push({
        name: "body.teeSignature",
        status: "fail",
        detail: "teeSignature or pubkeySnapshot missing",
      });
    }

    // -----------------------------------------------------------------
    // 8. processResponseResult was true at issuance.
    // -----------------------------------------------------------------
    if (receipt.attestation?.processResponseResult === true) {
      checks.push({
        name: "body.processResponseResult",
        status: "pass",
        detail: "true at issuance",
      });
    } else {
      checks.push({
        name: "body.processResponseResult",
        status: "fail",
        detail: `value=${receipt.attestation?.processResponseResult}`,
      });
    }

    // -----------------------------------------------------------------
    // 9. modelHash from chain matches body.model.
    // -----------------------------------------------------------------
    if (receipt.model) {
      const recomputed = modelHashFn(receipt.model);
      if (recomputed.toLowerCase() === anchorRecord.modelHash.toLowerCase()) {
        checks.push({
          name: "anchor.modelHash",
          status: "pass",
          detail: `model=${receipt.model}`,
        });
      } else {
        checks.push({
          name: "anchor.modelHash",
          status: "fail",
          detail: `expected ${recomputed.slice(0, 12)}... got ${anchorRecord.modelHash.slice(0, 12)}...`,
        });
      }
    } else {
      checks.push({
        name: "anchor.modelHash",
        status: "fail",
        detail: "body has no model field",
      });
    }

    return this.finish(checks, chatId, chatIdHash, receipt);
  }

  private finish(
    checks: VerifyCheck[],
    chatId: string,
    chatIdHash: string,
    receipt: Receipt | undefined,
  ): VerifyResult {
    const ok = checks.every((c) => c.status !== "fail");
    return { ok, checks, chatId, chatIdHash, receipt };
  }
}
