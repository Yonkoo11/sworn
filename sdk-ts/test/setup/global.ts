/**
 * Vitest globalSetup — starts a local Anvil node and deploys ReceiptRegistry.
 *
 * Exposes (alias pairs — same value, both names supported):
 *   ANVIL_RPC_URL       / SWORN_RPC_URL          (http://127.0.0.1:8545)
 *   ANVIL_PRIVATE_KEY                            (funded account #0)
 *   REGISTRY_ADDRESS    / SWORN_REGISTRY_ADDRESS (freshly deployed)
 *   SWORN_STORAGE_DIR                            (per-suite tmp dir, MockStorage)
 *
 * Anvil's account #0 is `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` with
 * private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
 * (the canonical Hardhat/Anvil test key). Keys checked into source here are
 * test-only and harmless.
 *
 * If `contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json` is missing, we
 * shell out to `forge build` in the contracts dir to produce it.
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

const ANVIL_RPC_URL = "http://127.0.0.1:8545";
const ANVIL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let anvilProc: ChildProcess | null = null;

function loadRegistryArtifact(): { abi: any; bytecode: string } {
  const contractsDir = resolve(__dirname, "../../../contracts");
  const artifactPath = resolve(
    contractsDir,
    "out/ReceiptRegistry.sol/ReceiptRegistry.json",
  );
  if (!existsSync(artifactPath)) {
    // Build via Foundry. Quiet mode so test output stays clean.
    const r = spawnSync("forge", ["build"], {
      cwd: contractsDir,
      stdio: ["ignore", "inherit", "inherit"],
    });
    if (r.status !== 0) {
      throw new Error(`forge build failed (status ${r.status}); install Foundry`);
    }
  }
  const raw = readFileSync(artifactPath, "utf8");
  const parsed = JSON.parse(raw);
  return { abi: parsed.abi, bytecode: parsed.bytecode.object };
}

async function waitForAnvil(provider: JsonRpcProvider, timeoutMs = 10_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await provider.getBlockNumber();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  throw new Error("Anvil did not become ready within timeout");
}

export async function setup(): Promise<void> {
  // Start Anvil silently. `--silent` reduces noise; --port 8545 default.
  anvilProc = spawn("anvil", ["--silent"], {
    stdio: ["ignore", "ignore", "ignore"],
  });

  const provider = new JsonRpcProvider(ANVIL_RPC_URL);
  await waitForAnvil(provider);

  const wallet = new Wallet(ANVIL_PRIVATE_KEY, provider);
  const { abi, bytecode } = loadRegistryArtifact();
  const factory = new ContractFactory(abi, bytecode, wallet);
  const registry = await factory.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  process.env.ANVIL_RPC_URL = ANVIL_RPC_URL;
  process.env.ANVIL_PRIVATE_KEY = ANVIL_PRIVATE_KEY;
  process.env.REGISTRY_ADDRESS = address;
  // Aliases used by the SDK + verify CLI.
  process.env.SWORN_RPC_URL = ANVIL_RPC_URL;
  process.env.SWORN_REGISTRY_ADDRESS = address;
  // Shared MockStorage directory so the e2e test, verifier, and CLI all see the
  // same blobs. Fresh per test-run to avoid leftover state across suites.
  const storageDir = mkdtempSync(join(tmpdir(), "sworn-e2e-storage-"));
  process.env.SWORN_STORAGE_DIR = storageDir;

  // Stop the setup-time provider so it doesn't leak background polling intervals
  // into the test worker. Tests construct their own providers.
  provider.destroy();

  // eslint-disable-next-line no-console
  console.log(
    `[setup] Anvil ready @ ${ANVIL_RPC_URL}, Registry @ ${address}, Storage @ ${storageDir}`,
  );
}

export async function teardown(): Promise<void> {
  if (anvilProc) {
    anvilProc.kill("SIGTERM");
    anvilProc = null;
  }
}
