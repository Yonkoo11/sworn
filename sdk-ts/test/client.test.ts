/**
 * T5 — client.ts + hashing.ts
 *
 * Validates the MockBroker chat path and the hashing utilities. No chain,
 * no storage. The point: `client.chat({ ... })` returns content + chatId,
 * and hashes are stable.
 */

import { describe, expect, it } from "vitest";
import { Wallet } from "ethers";
import { ReceiptClient } from "../src/client.js";
import { MockBroker } from "../src/broker.js";
import {
  chatIdHash,
  modelHash,
  promptHash,
  responseHash,
  canonicaliseMessages,
  keccak256Utf8,
  sha256Hex,
} from "../src/hashing.js";

const FAKE_PROVIDER = "0x69EbE4C002eC5e3F0E9C2bE94C3aE08000000000";

/** Build a ReceiptClient without touching any wallet/chain. */
function makeClient() {
  // No provider — T5 tests are pure mock-broker, no chain or wallet
  // operations happen, so we keep the provider null to avoid background polling
  // leaks when the suite tears down.
  const wallet = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  );
  return new ReceiptClient(
    {
      wallet,
      registry: process.env.REGISTRY_ADDRESS ?? "0x0000000000000000000000000000000000000000",
      providerAddress: FAKE_PROVIDER,
      brokerBackend: "mock",
    },
    { broker: new MockBroker(FAKE_PROVIDER) },
  );
}

describe("hashing", () => {
  it("keccak256 of a known string matches the EVM expectation", () => {
    // keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
    expect(keccak256Utf8("")).toBe(
      "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
    );
  });

  it("sha256 of empty string matches RFC test vector", () => {
    expect(sha256Hex("")).toBe(
      "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("canonicaliseMessages is stable and order-preserving", () => {
    const a = canonicaliseMessages([
      { role: "user", content: "hi" },
      { role: "assistant", content: "yo" },
    ]);
    const b = canonicaliseMessages([
      { role: "user", content: "hi" },
      { role: "assistant", content: "yo" },
    ]);
    expect(a).toBe(b);
    expect(a).toBe('[{"role":"user","content":"hi"},{"role":"assistant","content":"yo"}]');
  });

  it("promptHash differs when message content changes", () => {
    const h1 = promptHash([{ role: "user", content: "policy?" }]);
    const h2 = promptHash([{ role: "user", content: "refund?" }]);
    expect(h1).not.toBe(h2);
  });

  it("chatIdHash and modelHash return 32-byte hex strings", () => {
    const id = chatIdHash("abc-123");
    const m = modelHash("gemma-3-27b-it");
    expect(id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(m).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("responseHash differs for different content", () => {
    expect(responseHash("a")).not.toBe(responseHash("b"));
  });
});

describe("MockBroker", () => {
  it("returns a deterministic chatId for the same request", async () => {
    const b = new MockBroker(FAKE_PROVIDER);
    const req = {
      providerAddress: FAKE_PROVIDER,
      model: "gemma-3-27b-it",
      messages: [{ role: "user" as const, content: "hello" }],
      temperature: 0.7,
      topP: 1.0,
    };
    const r1 = await b.chat(req);
    const r2 = await b.chat(req);
    expect(r1.chatId).toBe(r2.chatId);
    expect(r1.teeSignature).toBe(r2.teeSignature);
    expect(r1.pubkeySnapshot).toBe(r2.pubkeySnapshot);
  });

  it("returns different chatIds for different messages", async () => {
    const b = new MockBroker(FAKE_PROVIDER);
    const base = {
      providerAddress: FAKE_PROVIDER,
      model: "gemma-3-27b-it",
      temperature: 0.7,
      topP: 1.0,
    };
    const r1 = await b.chat({ ...base, messages: [{ role: "user", content: "a" }] });
    const r2 = await b.chat({ ...base, messages: [{ role: "user", content: "b" }] });
    expect(r1.chatId).not.toBe(r2.chatId);
  });

  it("rejects empty messages array", async () => {
    const b = new MockBroker(FAKE_PROVIDER);
    await expect(
      b.chat({
        providerAddress: FAKE_PROVIDER,
        model: "gemma-3-27b-it",
        messages: [],
        temperature: 0.7,
        topP: 1.0,
      }),
    ).rejects.toThrow(/messages/);
  });
});

describe("ReceiptClient.chat (T5 minimum)", () => {
  it("returns content via MockBroker", async () => {
    const c = makeClient();
    const { content } = await c.chat({
      messages: [{ role: "user", content: "What is your refund policy?" }],
      model: "gemma-3-27b-it",
    });
    expect(content).toMatch(/^\[mock:gemma-3-27b-it\]/);
    expect(content).toMatch(/refund policy/);
  });

  it("chatRaw exposes hashes for downstream tasks (T8)", async () => {
    const c = makeClient();
    const raw = await c.chatRaw({
      messages: [{ role: "user", content: "hi" }],
      model: "gemma-3-27b-it",
    });
    expect(raw.chatId).toBeTruthy();
    expect(raw.chatIdHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(raw.modelHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(raw.promptHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(raw.responseHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(raw.processResponseResult).toBe(true);
  });

  it("two identical chat calls produce identical hashes", async () => {
    const c = makeClient();
    const opts = {
      messages: [{ role: "user" as const, content: "hi" }],
      model: "gemma-3-27b-it",
    };
    const a = await c.chatRaw(opts);
    const b = await c.chatRaw(opts);
    expect(a.chatId).toBe(b.chatId);
    expect(a.responseHash).toBe(b.responseHash);
    expect(a.teeSignature).toBe(b.teeSignature);
  });

  it("rejects empty messages", async () => {
    const c = makeClient();
    await expect(
      c.chat({ messages: [], model: "gemma-3-27b-it" }),
    ).rejects.toThrow(/messages/);
  });

  it("rejects missing model", async () => {
    const c = makeClient();
    await expect(
      // @ts-expect-error — intentionally bad input
      c.chat({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/model/);
  });
});
