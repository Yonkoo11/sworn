/**
 * T6 — storage.ts
 *
 * AES-256-CTR round-trip + MockStorage upload/download. One test reads the
 * on-disk blob and asserts the plaintext is nowhere to be found, proving the
 * storage tier never sees the cleartext.
 */

import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  MockStorage,
  aesEncrypt,
  aesDecrypt,
  generateEncryptionKey,
  encryptAndUpload,
  downloadAndDecrypt,
  createStorage,
  storageBackendFromEnv,
} from "../src/storage.js";

const SECRET_PLAINTEXT = "MEDICAL_RECORD: patient Jane Doe, MRN 123456, allergy: penicillin";

function isolatedStorage(): MockStorage {
  const dir = mkdtempSync(join(tmpdir(), "sworn-test-"));
  return new MockStorage(dir);
}

describe("AES-256-CTR primitive", () => {
  it("round-trips bytes", () => {
    const key = generateEncryptionKey();
    const ct = aesEncrypt(Buffer.from(SECRET_PLAINTEXT, "utf8"), key);
    const pt = aesDecrypt(ct, key);
    expect(Buffer.from(pt).toString("utf8")).toBe(SECRET_PLAINTEXT);
  });

  it("ciphertext differs across encryptions (random IV)", () => {
    const key = generateEncryptionKey();
    const ct1 = aesEncrypt(Buffer.from("same content"), key);
    const ct2 = aesEncrypt(Buffer.from("same content"), key);
    expect(Buffer.from(ct1).equals(Buffer.from(ct2))).toBe(false);
  });

  it("fails on wrong key length", () => {
    expect(() => aesEncrypt(Buffer.from("x"), "0x00")).toThrow(/32 bytes/);
  });

  it("generateEncryptionKey returns 32 bytes of 0x-hex", () => {
    const k = generateEncryptionKey();
    expect(k).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe("MockStorage upload + download", () => {
  it("round-trips an arbitrary blob via rootHash", async () => {
    const storage = isolatedStorage();
    const blob = Buffer.from("hello sworn", "utf8");
    const { rootHash, storageTxHash } = await storage.upload(blob);
    expect(rootHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(storageTxHash).toBe("");

    const back = await storage.download(rootHash);
    expect(Buffer.from(back).toString("utf8")).toBe("hello sworn");
  });

  it("throws on unknown rootHash", async () => {
    const storage = isolatedStorage();
    await expect(storage.download("0x" + "ab".repeat(32))).rejects.toThrow(/not found/);
  });

  it("the rootHash is deterministic for the same bytes", async () => {
    const s1 = isolatedStorage();
    const s2 = isolatedStorage();
    const blob = Buffer.from("deterministic");
    const a = await s1.upload(blob);
    const b = await s2.upload(blob);
    expect(a.rootHash).toBe(b.rootHash);
  });
});

describe("encryptAndUpload + downloadAndDecrypt", () => {
  it("encrypts before storing — plaintext never hits disk", async () => {
    const storage = isolatedStorage();
    const key = generateEncryptionKey();

    const { rootHash } = await encryptAndUpload(storage, SECRET_PLAINTEXT, {
      encrypted: true,
      keyHex: key,
    });

    // Read the raw bytes from disk and assert no plaintext substring leaks.
    const onDiskPath = storage.pathFor(rootHash);
    expect(existsSync(onDiskPath)).toBe(true);
    const onDiskBytes = readFileSync(onDiskPath);
    expect(onDiskBytes.includes(Buffer.from("MEDICAL_RECORD"))).toBe(false);
    expect(onDiskBytes.includes(Buffer.from("Jane Doe"))).toBe(false);
    expect(onDiskBytes.includes(Buffer.from("penicillin"))).toBe(false);

    const back = await downloadAndDecrypt(storage, rootHash, { keyHex: key });
    expect(back).toBe(SECRET_PLAINTEXT);
  });

  it("public mode skips encryption and stores plaintext", async () => {
    const storage = isolatedStorage();
    const { rootHash } = await encryptAndUpload(storage, "public hello", {
      encrypted: false,
    });
    const onDiskBytes = readFileSync(storage.pathFor(rootHash));
    expect(onDiskBytes.includes(Buffer.from("public hello"))).toBe(true);

    const back = await downloadAndDecrypt(storage, rootHash, {});
    expect(back).toBe("public hello");
  });

  it("decrypt with wrong key returns garbage, not the plaintext", async () => {
    const storage = isolatedStorage();
    const key = generateEncryptionKey();
    const wrong = generateEncryptionKey();
    const { rootHash } = await encryptAndUpload(storage, SECRET_PLAINTEXT, {
      encrypted: true,
      keyHex: key,
    });
    const back = await downloadAndDecrypt(storage, rootHash, { keyHex: wrong });
    expect(back).not.toBe(SECRET_PLAINTEXT);
  });

  it("encrypted=true without a key throws", async () => {
    const storage = isolatedStorage();
    await expect(
      encryptAndUpload(storage, "x", { encrypted: true }),
    ).rejects.toThrow(/keyHex/);
  });
});

describe("storage factory", () => {
  it("defaults to mock when SWORN_STORAGE is unset", () => {
    const prev = process.env.SWORN_STORAGE;
    delete process.env.SWORN_STORAGE;
    expect(storageBackendFromEnv()).toBe("mock");
    expect(createStorage({})).toBeInstanceOf(MockStorage);
    if (prev) process.env.SWORN_STORAGE = prev;
  });

  it("respects SWORN_STORAGE=real", () => {
    const prev = process.env.SWORN_STORAGE;
    process.env.SWORN_STORAGE = "real";
    expect(storageBackendFromEnv()).toBe("real");
    if (prev) process.env.SWORN_STORAGE = prev;
    else delete process.env.SWORN_STORAGE;
  });
});
