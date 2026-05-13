#!/usr/bin/env -S npx tsx
/**
 * sworn-verify — CLI front-end for the Verifier class.
 *
 * Usage:
 *   sworn-verify <chatId>
 *   sworn-verify sworn://r/<chatId>
 *
 * Required env:
 *   SWORN_REGISTRY_ADDRESS    deployed ReceiptRegistry address
 *
 * Optional env:
 *   SWORN_RPC_URL             default http://127.0.0.1:8545
 *   SWORN_STORAGE_DIR         default /tmp/sworn-mock-storage
 *   SWORN_DECRYPT_KEY         0x-hex 32-byte AES-256-CTR key (for sealed receipts)
 *
 * Exit codes:
 *   0 — verified
 *   1 — any check failed OR missing required env / bad CLI usage
 */

import pc from "picocolors";
import { Verifier } from "../src/verifier.js";
import { MockStorage } from "../src/storage.js";

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error(pc.red("error:") + " " + msg);
  process.exit(1);
}

async function main(): Promise<void> {
  const arg = process.argv[2];
  if (!arg) {
    fail("usage: sworn-verify <chatId | sworn://r/<chatId>>");
  }

  const registry = process.env.SWORN_REGISTRY_ADDRESS;
  if (!registry) {
    fail(
      "SWORN_REGISTRY_ADDRESS is required (deployed ReceiptRegistry address).",
    );
  }

  const rpcUrl = process.env.SWORN_RPC_URL ?? "http://127.0.0.1:8545";
  const storageDir = process.env.SWORN_STORAGE_DIR ?? "/tmp/sworn-mock-storage";
  const decryptKey = process.env.SWORN_DECRYPT_KEY;

  // eslint-disable-next-line no-console
  console.log(pc.bold("Sworn Receipt Verifier"));
  // eslint-disable-next-line no-console
  console.log(pc.dim(`  rpc:       ${rpcUrl}`));
  // eslint-disable-next-line no-console
  console.log(pc.dim(`  registry:  ${registry}`));
  // eslint-disable-next-line no-console
  console.log(pc.dim(`  storage:   ${storageDir}`));
  // eslint-disable-next-line no-console
  console.log(pc.dim(`  decrypt:   ${decryptKey ? "yes" : "no"}`));
  // eslint-disable-next-line no-console
  console.log("");

  const verifier = new Verifier({
    rpcUrl,
    registryAddress: registry,
    storage: new MockStorage(storageDir),
    decryptKey,
  });

  const result = await verifier.verify(arg);

  // eslint-disable-next-line no-console
  console.log(pc.bold(`Receipt: ${result.chatId}`));
  // eslint-disable-next-line no-console
  console.log(pc.dim(`  chatIdHash: ${result.chatIdHash}`));
  // eslint-disable-next-line no-console
  console.log("");

  for (const c of result.checks) {
    const mark =
      c.status === "pass"
        ? pc.green("✓")
        : c.status === "fail"
          ? pc.red("✗")
          : pc.yellow("•");
    const name =
      c.status === "fail" ? pc.red(c.name) : c.status === "pass" ? pc.green(c.name) : pc.yellow(c.name);
    // eslint-disable-next-line no-console
    console.log(`  ${mark} ${name}  ${pc.dim(c.detail)}`);
  }
  // eslint-disable-next-line no-console
  console.log("");

  if (result.ok) {
    // eslint-disable-next-line no-console
    console.log(pc.green(pc.bold("Result: VERIFIED")));
    process.exit(0);
  } else {
    // eslint-disable-next-line no-console
    console.log(pc.red(pc.bold("Result: FAILED")));
    process.exit(1);
  }
}

main().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error(pc.red("fatal:") + " " + err.message);
  process.exit(1);
});
