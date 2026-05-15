/**
 * Storage adapter — chooses between MockStorage (default) and RealStorage (0G).
 *
 * Encryption is ALWAYS real, regardless of backend. Receipts are encrypted
 * client-side with AES-256-CTR using a user-provided key, THEN the ciphertext
 * is shipped to whichever storage backend is selected. This means the storage
 * tier never sees plaintext, even in tests (the mock test inspects the blob
 * on disk to prove it).
 *
 * MockStorage writes to /tmp/sworn-mock-storage/<rootHash>.bin where
 * rootHash = "0x" + sha256(ciphertext). Real 0G Storage returns its own
 * Merkle root via @0gfoundation/0g-storage-ts-sdk.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { StorageLike, StorageUploadResult, StorageBackend } from "./types.js";

const MOCK_STORAGE_DIR = "/tmp/sworn-mock-storage";

/* ------------------------------------------------------------------ */
/* Encryption — AES-256-CTR, IV prepended to ciphertext                */
/* ------------------------------------------------------------------ */

/** Output format: [16-byte IV][ciphertext]. Plain bytes, no framing. */
export function aesEncrypt(plaintext: Uint8Array, keyHex: string): Uint8Array {
  const key = hexToBytes(keyHex);
  if (key.length !== 32) {
    throw new Error(`AES-256-CTR key must be 32 bytes (got ${key.length})`);
  }
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-ctr", key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  return Buffer.concat([iv, ct]);
}

export function aesDecrypt(blob: Uint8Array, keyHex: string): Uint8Array {
  const key = hexToBytes(keyHex);
  if (key.length !== 32) {
    throw new Error(`AES-256-CTR key must be 32 bytes (got ${key.length})`);
  }
  if (blob.length < 16) {
    throw new Error("Encrypted blob shorter than IV length");
  }
  const buf = Buffer.from(blob);
  const iv = buf.subarray(0, 16);
  const ct = buf.subarray(16);
  const decipher = createDecipheriv("aes-256-ctr", key, iv);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function hexToBytes(hex: string): Buffer {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean, "hex");
}

/** Generate a fresh 32-byte AES-256-CTR key, returned as 0x-prefixed hex. */
export function generateEncryptionKey(): string {
  return "0x" + randomBytes(32).toString("hex");
}

/* ------------------------------------------------------------------ */
/* MockStorage                                                         */
/* ------------------------------------------------------------------ */

export class MockStorage implements StorageLike {
  private dir: string;

  constructor(dir?: string) {
    // Resolution order:
    //   1. explicit ctor arg
    //   2. SWORN_STORAGE_DIR env (lets the CLI + the test process share blobs)
    //   3. /tmp/sworn-mock-storage (default)
    this.dir = dir ?? process.env.SWORN_STORAGE_DIR ?? MOCK_STORAGE_DIR;
    if (!existsSync(this.dir)) {
      mkdirSync(this.dir, { recursive: true });
    }
  }

  async upload(blob: Uint8Array): Promise<StorageUploadResult> {
    const rootHash = "0x" + createHash("sha256").update(Buffer.from(blob)).digest("hex");
    const path = join(this.dir, `${rootHash.slice(2)}.bin`);
    writeFileSync(path, Buffer.from(blob));
    return { rootHash, storageTxHash: "" };
  }

  async download(rootHash: string): Promise<Uint8Array> {
    const path = join(this.dir, `${rootHash.startsWith("0x") ? rootHash.slice(2) : rootHash}.bin`);
    if (!existsSync(path)) {
      throw new Error(`MockStorage: rootHash ${rootHash} not found at ${path}`);
    }
    return readFileSync(path);
  }

  /** Test helper: returns the on-disk path for a rootHash. */
  pathFor(rootHash: string): string {
    return join(this.dir, `${rootHash.startsWith("0x") ? rootHash.slice(2) : rootHash}.bin`);
  }
}

/* ------------------------------------------------------------------ */
/* RealStorage — 0G Storage SDK (gated by SWORN_STORAGE=real)          */
/* ------------------------------------------------------------------ */

export class RealStorage implements StorageLike {
  private wallet: unknown;
  private clientCache: unknown = null;

  constructor(wallet: unknown) {
    this.wallet = wallet;
  }

  private async getClient(): Promise<any> {
    if (this.clientCache) return this.clientCache;
    const mod = await import("@0glabs/0g-ts-sdk").catch(() => {
      throw new Error(
        "RealStorage requires @0glabs/0g-ts-sdk to be installed. " +
          "Run: pnpm add @0glabs/0g-ts-sdk",
      );
    });
    // The 0G Storage SDK exposes an Indexer/Uploader pair. Wiring is
    // version-specific; the adapter holds the wallet and constructs on demand.
    this.clientCache = { mod, wallet: this.wallet };
    return this.clientCache;
  }

  async upload(blob: Uint8Array): Promise<StorageUploadResult> {
    const { mod, wallet } = (await this.getClient()) as {
      mod: any;
      wallet: any;
    };
    // `MemData` is the in-memory variant of AbstractFile in @0glabs/0g-ts-sdk.
    // `Blob` in this SDK is the WHATWG File-API wrapper and won't accept
    // a Node Buffer (calls .slice().arrayBuffer() internally). MemData
    // takes ArrayLike<number>, which Uint8Array satisfies.
    const { MemData, Indexer } = mod;
    const indexer = new Indexer(
      process.env.SWORN_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai",
    );
    const file = new MemData(blob);
    const [tree, treeErr] = await file.merkleTree();
    if (treeErr || !tree) {
      throw new Error(`0G Storage merkleTree() failed: ${treeErr}`);
    }
    const rootHash = tree.rootHash();
    const [tx, uploadErr] = await indexer.upload(
      file,
      process.env.SWORN_STORAGE_RPC ?? "https://evmrpc-testnet.0g.ai",
      wallet,
    );
    if (uploadErr) {
      throw new Error(`0G Storage upload failed: ${uploadErr}`);
    }
    return { rootHash, storageTxHash: (tx as any)?.hash ?? tx ?? "" };
  }

  async download(rootHash: string): Promise<Uint8Array> {
    const { mod } = (await this.getClient()) as { mod: any };
    const { Indexer } = mod;
    const indexer = new Indexer(process.env.SWORN_STORAGE_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai");
    const buf = await indexer.download(rootHash, false);
    return new Uint8Array(buf);
  }
}

/* ------------------------------------------------------------------ */
/* Factory                                                             */
/* ------------------------------------------------------------------ */

export function storageBackendFromEnv(): StorageBackend {
  const raw = process.env.SWORN_STORAGE?.toLowerCase();
  return raw === "real" ? "real" : "mock";
}

export function createStorage(opts: { backend?: StorageBackend; wallet?: unknown }): StorageLike {
  const backend = opts.backend ?? storageBackendFromEnv();
  if (backend === "real") {
    if (!opts.wallet) throw new Error("RealStorage requires a wallet");
    return new RealStorage(opts.wallet);
  }
  return new MockStorage();
}

/* ------------------------------------------------------------------ */
/* High-level helpers (used by ReceiptClient in T8)                    */
/* ------------------------------------------------------------------ */

/**
 * Encrypt a UTF-8 JSON receipt body + upload it.
 * If `encrypted` is false (public mode), the bytes are uploaded as-is.
 */
export async function encryptAndUpload(
  storage: StorageLike,
  body: string,
  opts: { encrypted: boolean; keyHex?: string },
): Promise<StorageUploadResult> {
  const plaintext = Buffer.from(body, "utf8");
  if (!opts.encrypted) {
    return storage.upload(plaintext);
  }
  if (!opts.keyHex) {
    throw new Error("encryptAndUpload: keyHex is required when encrypted=true");
  }
  const ciphertext = aesEncrypt(plaintext, opts.keyHex);
  return storage.upload(ciphertext);
}

/** Download by rootHash, decrypt if a key is supplied. */
export async function downloadAndDecrypt(
  storage: StorageLike,
  rootHash: string,
  opts: { keyHex?: string },
): Promise<string> {
  const blob = await storage.download(rootHash);
  if (!opts.keyHex) {
    return Buffer.from(blob).toString("utf8");
  }
  const plain = aesDecrypt(blob, opts.keyHex);
  return Buffer.from(plain).toString("utf8");
}
