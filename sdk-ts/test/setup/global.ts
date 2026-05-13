/**
 * Vitest globalSetup — starts a local Anvil node and deploys ReceiptRegistry.
 *
 * Exposes:
 *   ANVIL_RPC_URL       — e.g. http://127.0.0.1:8545
 *   ANVIL_PRIVATE_KEY   — funded account #0 private key
 *   REGISTRY_ADDRESS    — freshly deployed ReceiptRegistry address
 *
 * Anvil's account #0 is `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` with
 * private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
 * (the canonical Hardhat/Anvil test key). Keys checked into source here are
 * test-only and harmless.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JsonRpcProvider, Wallet, ContractFactory } from "ethers";

const ANVIL_RPC_URL = "http://127.0.0.1:8545";
const ANVIL_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let anvilProc: ChildProcess | null = null;

function loadRegistryArtifact(): { abi: any; bytecode: string } {
  const artifactPath = resolve(
    __dirname,
    "../../../contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json",
  );
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

  // Stop the setup-time provider so it doesn't leak background polling intervals
  // into the test worker. Tests construct their own providers.
  provider.destroy();

  // eslint-disable-next-line no-console
  console.log(`[setup] Anvil ready @ ${ANVIL_RPC_URL}, Registry @ ${address}`);
}

export async function teardown(): Promise<void> {
  if (anvilProc) {
    anvilProc.kill("SIGTERM");
    anvilProc = null;
  }
}
