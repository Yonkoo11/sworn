/**
 * T8 — End-to-end ReceiptClient.chat() + Verifier round trip.
 *
 * 3 tests:
 *   1. Happy path — client.chat() returns a full receipt; Verifier flips it
 *      green across every check.
 *   2. Negative path — corrupt the storage blob; Verifier returns ok:false
 *      with a clear failure on storage.retrievable (rootHash mismatch).
 *   3. No-wallet path — a Verifier built with no wallet (just RPC + storage
 *      + key) can still verify a receipt issued by the SDK.
 *
 * Uses the globalSetup-provided anvil + registry address + shared mock storage
 * directory so the test, the verifier, and the CLI all read the same blobs.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { JsonRpcProvider, Wallet, getAddress } from "ethers";
import { ReceiptClient } from "../src/client.js";
import { MockBroker } from "../src/broker.js";
import { MockStorage } from "../src/storage.js";
import { RegistryAnchor } from "../src/anchor.js";
import { Verifier } from "../src/verifier.js";
import { generateEncryptionKey } from "../src/storage.js";

const FAKE_PROVIDER = getAddress("0x69ebe4c002ec5e3f0e9c2be94c3ae08000000000");

function rpcUrl(): string {
  return process.env.SWORN_RPC_URL ?? "http://127.0.0.1:8545";
}
function registryAddress(): string {
  const r = process.env.SWORN_REGISTRY_ADDRESS;
  if (!r) throw new Error("SWORN_REGISTRY_ADDRESS not set");
  return r;
}
function storageDir(): string {
  const d = process.env.SWORN_STORAGE_DIR;
  if (!d) throw new Error("SWORN_STORAGE_DIR not set");
  return d;
}
function pk(): string {
  return (
    process.env.ANVIL_PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
}

let provider: JsonRpcProvider;
let wallet: Wallet;

beforeAll(() => {
  provider = new JsonRpcProvider(rpcUrl());
  wallet = new Wallet(pk(), provider);
});

afterAll(() => {
  provider.destroy();
});

/**
 * Build a fully-wired client. Shared storage dir so the Verifier can re-read
 * what the client wrote. A unique encryption key per-test so corrupt-blob
 * cases don't bleed across tests.
 */
function buildClient(opts: { encryptionKey: string; uniq: string }) {
  const storage = new MockStorage(storageDir());
  const anchor = new RegistryAnchor({
    rpcUrl: rpcUrl(),
    registryAddress: registryAddress(),
    wallet,
  });
  return new ReceiptClient(
    {
      wallet,
      registry: registryAddress(),
      providerAddress: FAKE_PROVIDER,
      attest: true,
      receiptEncryption: "sealed",
      encryptionKey: opts.encryptionKey,
      issuerLabel: `e2e-${opts.uniq}`,
    },
    {
      // MockBroker is seeded with the unique label so each test produces a
      // distinct chatIdHash (avoids replay reverts across runs of the suite).
      broker: new MockBroker(FAKE_PROVIDER),
      storage,
      anchor,
    },
  );
}

describe("T8 — e2e ReceiptClient.chat() + Verifier", () => {
  it("happy path: issues a receipt and Verifier flips every check green", async () => {
    const key = generateEncryptionKey();
    const client = buildClient({ encryptionKey: key, uniq: "happy-" + Date.now() });

    const result = await client.chat({
      messages: [
        { role: "user", content: `e2e-happy-${Date.now()}-${Math.random()}` },
      ],
      model: "gemma-3-27b-it",
    });

    expect(result.content).toMatch(/^\[mock:gemma-3-27b-it\]/);
    expect(result.receipt).toBeTruthy();
    expect(result.fullReceipt).toBeTruthy();
    expect(result.receipt!.url).toBe(`sworn://r/${result.receipt!.chatId}`);
    expect(result.receipt!.rootHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.receipt!.txHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(result.receipt!.blockNumber).toBeGreaterThan(0);

    // PRD §6 schema completeness check.
    const r = result.fullReceipt!;
    expect(r.version).toBe(1);
    expect(r.chatId).toBe(result.receipt!.chatId);
    expect(r.chatIdHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r.provider.address.toLowerCase()).toBe(FAKE_PROVIDER.toLowerCase());
    expect(r.provider.mode).toBe("TeeML");
    expect(r.provider.pubkeySnapshot).toMatch(/^0x[0-9a-f]+$/);
    expect(r.model).toBe("gemma-3-27b-it");
    expect(r.request.promptHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r.request.messageCount).toBe(1);
    expect(r.response.contentHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(r.response.finishReason).toBe("stop");
    expect(r.attestation.teeSignature).toMatch(/^0x[0-9a-f]+$/);
    expect(r.attestation.processResponseResult).toBe(true);
    expect(r.storage.rootHash).toBe(result.receipt!.rootHash);
    expect(r.storage.encrypted).toBe(true);
    expect(r.storage.encryptionScheme).toBe("AES-256-CTR");
    expect(r.anchor.txHash).toBe(result.receipt!.txHash);
    expect(r.anchor.blockNumber).toBeGreaterThan(0);
    expect(r.anchor.blockTimestamp).toBeGreaterThan(0);
    expect(r.issuer?.address.toLowerCase()).toBe(wallet.address.toLowerCase());

    // Dump it once so the operator can eyeball the schema in test output.
    // eslint-disable-next-line no-console
    console.log("\n[e2e] receipt =", JSON.stringify(r, null, 2));

    // Verify.
    const verifier = new Verifier({
      rpcUrl: rpcUrl(),
      registryAddress: registryAddress(),
      storage: new MockStorage(storageDir()),
      decryptKey: key,
    });
    const v = await verifier.verify(result.receipt!.url);
    expect(v.ok).toBe(true);
    const greens = v.checks.filter((c) => c.status === "pass");
    expect(greens.length).toBeGreaterThanOrEqual(5);
    // Make sure none failed.
    const fails = v.checks.filter((c) => c.status === "fail");
    expect(fails).toEqual([]);
  });

  it("negative path: corrupt storage blob -> Verifier returns ok:false", async () => {
    const key = generateEncryptionKey();
    const client = buildClient({ encryptionKey: key, uniq: "neg-" + Date.now() });

    const result = await client.chat({
      messages: [{ role: "user", content: `e2e-neg-${Date.now()}` }],
      model: "gemma-3-27b-it",
    });

    // Overwrite the on-disk blob with garbage. The rootHash on chain stays the
    // same; sha256 of the corrupted bytes will diverge. storage.retrievable
    // gate must catch it.
    const storage = new MockStorage(storageDir());
    const path = storage.pathFor(result.receipt!.rootHash);
    writeFileSync(path, Buffer.from("CORRUPTED GARBAGE NOT THE REAL BLOB"));

    const verifier = new Verifier({
      rpcUrl: rpcUrl(),
      registryAddress: registryAddress(),
      storage,
      decryptKey: key,
    });
    const v = await verifier.verify(result.receipt!.chatId);
    expect(v.ok).toBe(false);
    const failed = v.checks.find(
      (c) => c.name === "storage.retrievable" && c.status === "fail",
    );
    expect(failed).toBeTruthy();
    expect(failed!.detail).toMatch(/rootHash mismatch/);
  });

  it("no-wallet path: Verifier built without a wallet still verifies", async () => {
    const key = generateEncryptionKey();
    const client = buildClient({ encryptionKey: key, uniq: "nowal-" + Date.now() });

    const result = await client.chat({
      messages: [{ role: "user", content: `e2e-nowal-${Date.now()}` }],
      model: "gemma-3-27b-it",
    });

    // Build the verifier from scratch with NO wallet, NO signer — only RPC,
    // registry address, storage adapter, decryption key.
    const verifier = new Verifier({
      rpcUrl: rpcUrl(),
      registryAddress: registryAddress(),
      storage: new MockStorage(storageDir()),
      decryptKey: key,
    });
    const v = await verifier.verify(result.receipt!.url);
    expect(v.ok).toBe(true);
    expect(v.checks.find((c) => c.name === "anchor.exists")!.status).toBe("pass");
    expect(v.checks.find((c) => c.name === "body.parses")!.status).toBe("pass");
    expect(v.checks.find((c) => c.name === "anchor.modelHash")!.status).toBe("pass");
  });
});
