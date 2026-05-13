/**
 * RegistryAnchor — calls `recordReceipt` on the deployed ReceiptRegistry.
 *
 * Surface (frozen for T7):
 *   const anchor = new RegistryAnchor({ rpcUrl, registryAddress, wallet });
 *   const { txHash, blockNumber, blockTimestamp } = await anchor.anchor({
 *     chatIdHash, storageRootHash, providerAddress, modelHash
 *   });
 *
 * Loads the ABI from the Foundry artifact at
 * `../contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json`. If the artifact
 * is missing, falls back to the inline ABI fragment defined here so the SDK
 * still imports in environments where the contract hasn't been compiled.
 *
 * Read-only helpers (`getAnchor`, `isAnchored`, `findIssuedEvent`) are exposed
 * so the Verifier (T9) can re-read the same anchor without touching this class
 * indirectly through ReceiptClient.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Contract,
  JsonRpcProvider,
  type ContractTransactionResponse,
  type EventLog,
  type Log,
  type Wallet,
  type Provider,
} from "ethers";

/**
 * Minimal ABI fragment we depend on. Used as a fallback when the Foundry
 * artifact is not on disk (e.g. SDK shipped to npm without contracts/out).
 * Kept in sync with `contracts/src/ReceiptRegistry.sol`.
 */
export const RECEIPT_REGISTRY_ABI = [
  {
    type: "function",
    name: "recordReceipt",
    inputs: [
      { name: "chatIdHash", type: "bytes32" },
      { name: "storageRootHash", type: "bytes32" },
      { name: "provider", type: "address" },
      { name: "modelHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAnchor",
    inputs: [{ name: "chatIdHash", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "storageRootHash", type: "bytes32" },
          { name: "provider", type: "address" },
          { name: "issuer", type: "address" },
          { name: "blockTimestamp", type: "uint64" },
          { name: "modelHash", type: "bytes32" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isAnchored",
    inputs: [{ name: "chatIdHash", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ReceiptIssued",
    inputs: [
      { name: "chatIdHash", type: "bytes32", indexed: true },
      { name: "storageRootHash", type: "bytes32", indexed: true },
      { name: "provider", type: "address", indexed: true },
      { name: "issuer", type: "address", indexed: false },
      { name: "modelHash", type: "bytes32", indexed: false },
      { name: "blockTimestamp", type: "uint64", indexed: false },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyAnchored", inputs: [{ name: "chatIdHash", type: "bytes32" }] },
  { type: "error", name: "ZeroChatIdHash", inputs: [] },
  { type: "error", name: "ZeroProvider", inputs: [] },
  { type: "error", name: "ZeroStorageRootHash", inputs: [] },
] as const;

/** Load full ABI from the Foundry artifact; fall back to inline fragment. */
export function loadRegistryAbi(): readonly unknown[] {
  // ESM-safe __dirname.
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, "../../contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json"),
    resolve(here, "../../../contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json"),
    resolve(process.cwd(), "contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json"),
    resolve(process.cwd(), "../contracts/out/ReceiptRegistry.sol/ReceiptRegistry.json"),
  ];
  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = readFileSync(path, "utf8");
      const parsed = JSON.parse(raw) as { abi?: unknown[] };
      if (parsed.abi) return parsed.abi;
    }
  }
  return RECEIPT_REGISTRY_ABI as unknown as readonly unknown[];
}

export interface RegistryAnchorOptions {
  rpcUrl: string;
  registryAddress: string;
  wallet: Wallet;
}

export interface AnchorInput {
  chatIdHash: string;
  storageRootHash: string;
  providerAddress: string;
  modelHash: string;
}

export interface AnchorResult {
  txHash: string;
  blockNumber: number;
  blockTimestamp: number;
}

export interface AnchorRecord {
  storageRootHash: string;
  provider: string;
  issuer: string;
  blockTimestamp: number;
  modelHash: string;
}

export class RegistryAnchor {
  readonly rpcUrl: string;
  readonly registryAddress: string;
  private readonly wallet: Wallet;
  private readonly providerRpc: Provider;
  private readonly contract: Contract;

  constructor(opts: RegistryAnchorOptions) {
    if (!opts.rpcUrl) throw new Error("RegistryAnchor: rpcUrl required");
    if (!opts.registryAddress) throw new Error("RegistryAnchor: registryAddress required");
    if (!opts.wallet) throw new Error("RegistryAnchor: wallet required");

    this.rpcUrl = opts.rpcUrl;
    this.registryAddress = opts.registryAddress;
    const walletProvider = opts.wallet.provider;
    this.providerRpc = walletProvider ?? new JsonRpcProvider(opts.rpcUrl);
    this.wallet = walletProvider ? opts.wallet : opts.wallet.connect(this.providerRpc);

    this.contract = new Contract(
      opts.registryAddress,
      loadRegistryAbi() as any,
      this.wallet,
    );
  }

  /**
   * Call `recordReceipt` on-chain. Reads the nonce via the raw RPC so the
   * provider's internal `eth_getTransactionCount` cache (4s polling on a
   * JsonRpcProvider) cannot serve a stale value when txs land back-to-back
   * faster than the poll interval — which is the default on Anvil.
   */
  async anchor(input: AnchorInput): Promise<AnchorResult> {
    const nonceHex = await (this.providerRpc as JsonRpcProvider).send(
      "eth_getTransactionCount",
      [this.wallet.address, "pending"],
    );
    const nonce = Number(nonceHex);
    const tx: ContractTransactionResponse = await this.contract.recordReceipt(
      input.chatIdHash,
      input.storageRootHash,
      input.providerAddress,
      input.modelHash,
      { nonce },
    );
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("anchor: tx mined but receipt was null");
    }
    const block = await this.providerRpc.getBlock(receipt.blockNumber);
    if (!block) {
      throw new Error(`anchor: block ${receipt.blockNumber} not found`);
    }
    return {
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      blockTimestamp: Number(block.timestamp),
    };
  }

  /** Read the anchor record back. Returns null if not anchored. */
  async getAnchor(chatIdHash: string): Promise<AnchorRecord | null> {
    const result = (await this.contract.getAnchor(chatIdHash)) as [
      string,
      string,
      string,
      bigint,
      string,
    ];
    const storageRootHash = result[0];
    if (
      !storageRootHash ||
      storageRootHash ===
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    ) {
      return null;
    }
    return {
      storageRootHash,
      provider: result[1],
      issuer: result[2],
      blockTimestamp: Number(result[3]),
      modelHash: result[4],
    };
  }

  /** True if a chatIdHash has already been anchored. */
  async isAnchored(chatIdHash: string): Promise<boolean> {
    return (await this.contract.isAnchored(chatIdHash)) as boolean;
  }

  /**
   * Find the first ReceiptIssued event for a given chatIdHash by scanning
   * from genesis. Suitable for short test chains; for mainnet, the caller
   * should pass a tighter `fromBlock`.
   */
  async findIssuedEvent(
    chatIdHash: string,
    fromBlock: number = 0,
  ): Promise<{
    txHash: string;
    blockNumber: number;
    blockTimestamp: number;
    storageRootHash: string;
    provider: string;
    issuer: string;
    modelHash: string;
  } | null> {
    const filter = this.contract.filters.ReceiptIssued(chatIdHash);
    const logs = (await this.contract.queryFilter(filter, fromBlock, "latest")) as (Log | EventLog)[];
    if (!logs.length) return null;
    const log = logs[0] as EventLog;
    const args = log.args;
    const block = await this.providerRpc.getBlock(log.blockNumber);
    return {
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      blockTimestamp: Number(block?.timestamp ?? args[5]),
      storageRootHash: args[1] as string,
      provider: args[2] as string,
      issuer: args[3] as string,
      modelHash: args[4] as string,
    };
  }
}
