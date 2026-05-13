/**
 * T7 — anchor.ts on a local Anvil + deployed ReceiptRegistry.
 *
 * Validates:
 *   (a) anchor() succeeds, ReceiptIssued is emitted with all 6 args
 *   (b) re-anchoring the same chatIdHash reverts (replay protection)
 *   (c) getAnchor() and findIssuedEvent() return what was written
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  JsonRpcProvider,
  Wallet,
  keccak256,
  toUtf8Bytes,
  getAddress,
} from "ethers";
import { RegistryAnchor } from "../src/anchor.js";

// ethers v6 enforces EIP-55 checksum on contract address args; pass through
// getAddress so a lowercased / inconsistent-case literal still works.
const FAKE_PROVIDER = getAddress("0x69ebe4c002ec5e3f0e9c2be94c3ae08000000000");

function rpcUrl(): string {
  return process.env.SWORN_RPC_URL ?? "http://127.0.0.1:8545";
}
function registry(): string {
  const r = process.env.SWORN_REGISTRY_ADDRESS;
  if (!r) throw new Error("SWORN_REGISTRY_ADDRESS not set (globalSetup didn't run?)");
  return r;
}
function pk(): string {
  return (
    process.env.ANVIL_PRIVATE_KEY ??
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );
}

let provider: JsonRpcProvider;
let sharedWallet: Wallet;
let sharedAnchor: RegistryAnchor;

beforeAll(() => {
  provider = new JsonRpcProvider(rpcUrl());
  sharedWallet = new Wallet(pk(), provider);
  sharedAnchor = new RegistryAnchor({
    rpcUrl: rpcUrl(),
    registryAddress: registry(),
    wallet: sharedWallet,
  });
});

afterAll(() => {
  provider.destroy();
});

/**
 * Reuse one wallet + anchor across tests so ethers' nonce tracking stays
 * coherent. Each anchor call uses a unique chatIdHash, so order independence
 * still holds at the contract level.
 */
function makeAnchor(): RegistryAnchor {
  return sharedAnchor;
}

/** Pseudo-unique chatIdHash per test so we don't collide with prior runs. */
function uniqueChatIdHash(label: string): string {
  return keccak256(toUtf8Bytes(`${label}-${Date.now()}-${Math.random()}`));
}

describe("RegistryAnchor.anchor", () => {
  it("debug: shows nonce flow", async () => {
    const addr = sharedWallet.address;
    const n1 = await provider.getTransactionCount(addr, "latest");
    const n1p = await provider.getTransactionCount(addr, "pending");
    console.log(`[debug] before tx: latest=${n1} pending=${n1p}`);
    const anchor = makeAnchor();
    const chatIdHash = uniqueChatIdHash("debug");
    const storageRootHash = keccak256(toUtf8Bytes("root-debug"));
    const modelHash = keccak256(toUtf8Bytes("dbg"));
    await anchor.anchor({ chatIdHash, storageRootHash, providerAddress: FAKE_PROVIDER, modelHash });
    const n2 = await provider.getTransactionCount(addr, "latest");
    const n2p = await provider.getTransactionCount(addr, "pending");
    console.log(`[debug] after tx: latest=${n2} pending=${n2p}`);
  });

  it("records a receipt and emits ReceiptIssued with all 6 args", async () => {
    const anchor = makeAnchor();
    const chatIdHash = uniqueChatIdHash("happy");
    const storageRootHash = keccak256(toUtf8Bytes("root-happy"));
    const modelHash = keccak256(toUtf8Bytes("gemma-3-27b-it"));

    const result = await anchor.anchor({
      chatIdHash,
      storageRootHash,
      providerAddress: FAKE_PROVIDER,
      modelHash,
    });

    expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(result.blockNumber).toBeGreaterThan(0);
    expect(result.blockTimestamp).toBeGreaterThan(0);

    // Read back the event explicitly to assert all 6 args (3 indexed + 3 data).
    const evt = await anchor.findIssuedEvent(chatIdHash);
    expect(evt).not.toBeNull();
    expect(evt!.storageRootHash.toLowerCase()).toBe(storageRootHash.toLowerCase());
    expect(evt!.provider.toLowerCase()).toBe(FAKE_PROVIDER.toLowerCase());
    expect(evt!.modelHash.toLowerCase()).toBe(modelHash.toLowerCase());
    expect(evt!.issuer).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(evt!.blockTimestamp).toBeGreaterThan(0);
    expect(evt!.txHash).toBe(result.txHash);
  });

  it("reverts when the same chatIdHash is anchored twice (replay protection)", async () => {
    const anchor = makeAnchor();
    const chatIdHash = uniqueChatIdHash("replay");
    const storageRootHash = keccak256(toUtf8Bytes("root-replay"));
    const modelHash = keccak256(toUtf8Bytes("gemma-3-27b-it"));

    await anchor.anchor({
      chatIdHash,
      storageRootHash,
      providerAddress: FAKE_PROVIDER,
      modelHash,
    });

    // Replay with a different rootHash — must still revert.
    await expect(
      anchor.anchor({
        chatIdHash,
        storageRootHash: keccak256(toUtf8Bytes("root-different")),
        providerAddress: FAKE_PROVIDER,
        modelHash,
      }),
    ).rejects.toThrow();
  });

  it("getAnchor() reads back what anchor() wrote", async () => {
    const anchor = makeAnchor();
    const chatIdHash = uniqueChatIdHash("readback");
    const storageRootHash = keccak256(toUtf8Bytes("root-readback"));
    const modelHash = keccak256(toUtf8Bytes("gpt-test"));

    expect(await anchor.isAnchored(chatIdHash)).toBe(false);

    const written = await anchor.anchor({
      chatIdHash,
      storageRootHash,
      providerAddress: FAKE_PROVIDER,
      modelHash,
    });

    expect(await anchor.isAnchored(chatIdHash)).toBe(true);

    const record = await anchor.getAnchor(chatIdHash);
    expect(record).not.toBeNull();
    expect(record!.storageRootHash.toLowerCase()).toBe(storageRootHash.toLowerCase());
    expect(record!.modelHash.toLowerCase()).toBe(modelHash.toLowerCase());
    expect(record!.provider.toLowerCase()).toBe(FAKE_PROVIDER.toLowerCase());
    expect(record!.blockTimestamp).toBe(written.blockTimestamp);
  });

  it("getAnchor() returns null for an unknown chatIdHash", async () => {
    const anchor = makeAnchor();
    const random = keccak256(toUtf8Bytes(`never-anchored-${Math.random()}`));
    expect(await anchor.getAnchor(random)).toBeNull();
  });

  it("rejects construction with missing config", () => {
    const wallet = new Wallet(pk(), provider);
    expect(
      () =>
        new RegistryAnchor({
          rpcUrl: "",
          registryAddress: registry(),
          wallet,
        }),
    ).toThrow(/rpcUrl/);
  });
});
