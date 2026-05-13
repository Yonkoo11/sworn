/**
 * T9 — CLI test for sworn-verify.
 *
 * Issues a receipt via the SDK, then shells out to `tsx bin/verify.ts <chatId>`
 * with the env vars the CLI consumes. The subprocess hits the same anvil node
 * + registry + storage dir that globalSetup configured, so the verifier the
 * user would actually run on the command line is exercised end-to-end.
 *
 * Two tests:
 *   1. Verified receipt → exit 0 + "VERIFIED" in stdout.
 *   2. Bad chatId (never anchored) → exit 1.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { JsonRpcProvider, Wallet, getAddress } from "ethers";
import { ReceiptClient } from "../src/client.js";
import { MockBroker } from "../src/broker.js";
import { MockStorage, generateEncryptionKey } from "../src/storage.js";
import { RegistryAnchor } from "../src/anchor.js";

const FAKE_PROVIDER = getAddress("0x69ebe4c002ec5e3f0e9c2be94c3ae08000000000");
const SDK_DIR = resolve(__dirname, "..");
const VERIFY_BIN = resolve(SDK_DIR, "bin/verify.ts");

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

async function issueReceipt(uniq: string, key: string) {
  const storage = new MockStorage(storageDir());
  const anchor = new RegistryAnchor({
    rpcUrl: rpcUrl(),
    registryAddress: registryAddress(),
    wallet,
  });
  const client = new ReceiptClient(
    {
      wallet,
      registry: registryAddress(),
      providerAddress: FAKE_PROVIDER,
      attest: true,
      receiptEncryption: "sealed",
      encryptionKey: key,
      issuerLabel: `cli-${uniq}`,
    },
    { broker: new MockBroker(FAKE_PROVIDER), storage, anchor },
  );
  return client.chat({
    messages: [{ role: "user", content: `cli-msg-${uniq}-${Date.now()}` }],
    model: "gemma-3-27b-it",
  });
}

describe("T9 — sworn-verify CLI", () => {
  it("exits 0 and prints VERIFIED for a fresh receipt", async () => {
    const key = generateEncryptionKey();
    const result = await issueReceipt("ok-" + Date.now(), key);
    expect(result.receipt).toBeTruthy();

    const r = spawnSync(
      "pnpm",
      ["exec", "tsx", VERIFY_BIN, result.receipt!.chatId],
      {
        cwd: SDK_DIR,
        env: {
          ...process.env,
          SWORN_RPC_URL: rpcUrl(),
          SWORN_REGISTRY_ADDRESS: registryAddress(),
          SWORN_STORAGE_DIR: storageDir(),
          SWORN_DECRYPT_KEY: key,
        },
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    // eslint-disable-next-line no-console
    if (r.status !== 0) console.log("[cli stderr]", r.stderr);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/VERIFIED/);
    expect(r.stdout).toMatch(/anchor\.exists/);
    expect(r.stdout).toMatch(/storage\.retrievable/);
    expect(r.stdout).toMatch(/body\.parses/);
    expect(r.stdout).toMatch(/body\.promptHash/);
    expect(r.stdout).toMatch(/body\.responseHash/);
    expect(r.stdout).toMatch(/body\.teeSignature/);
    expect(r.stdout).toMatch(/anchor\.modelHash/);
  });

  it("exits 1 for a chatId that was never anchored", () => {
    const r = spawnSync(
      "pnpm",
      ["exec", "tsx", VERIFY_BIN, "never-issued-" + Date.now()],
      {
        cwd: SDK_DIR,
        env: {
          ...process.env,
          SWORN_RPC_URL: rpcUrl(),
          SWORN_REGISTRY_ADDRESS: registryAddress(),
          SWORN_STORAGE_DIR: storageDir(),
        },
        encoding: "utf8",
        timeout: 30_000,
      },
    );

    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/FAILED/);
  });

  it("exits 1 when SWORN_REGISTRY_ADDRESS is missing", () => {
    const env = { ...process.env };
    delete env.SWORN_REGISTRY_ADDRESS;
    const r = spawnSync("pnpm", ["exec", "tsx", VERIFY_BIN, "anything"], {
      cwd: SDK_DIR,
      env,
      encoding: "utf8",
      timeout: 30_000,
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/SWORN_REGISTRY_ADDRESS/);
  });
});
