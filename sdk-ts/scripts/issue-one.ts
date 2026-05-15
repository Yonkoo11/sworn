/**
 * Issue ONE real Sworn receipt on 0G Galileo testnet.
 *
 * Reads from env (set by ../scripts/issue-one.sh):
 *   PRIVATE_KEY              — funded Galileo wallet (never logged)
 *   SWORN_RPC_URL            — Galileo RPC
 *   SWORN_REGISTRY_ADDRESS   — deployed ReceiptRegistry
 *   SWORN_BROKER=real        — flips MockBroker → RealBroker
 *   SWORN_STORAGE=real       — flips MockStorage → RealStorage
 *
 * Pipeline (mirrors PRD §6, §7, §8):
 *   1. Real 0G Compute call via @0glabs/0g-serving-broker
 *   2. Encrypt response body (AES-256-CTR) + upload to 0G Storage
 *   3. recordReceipt() on the registry → on-chain ReceiptIssued event
 *   4. Print the receipt URL — paste into the public verifier
 */

import { JsonRpcProvider, Wallet } from "ethers";
import { ReceiptClient, generateEncryptionKey } from "../src/index.js";

const MODEL = "gemma-3-27b-it";
const PROVIDER_ADDRESS = "0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08"; // Gemma 3 27B TeeML

function need(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const rpcUrl = need("SWORN_RPC_URL");
  const registry = need("SWORN_REGISTRY_ADDRESS");
  const pk = need("PRIVATE_KEY");

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(pk, provider);
  console.log(`Issuer:    ${wallet.address}`);
  console.log(`Registry:  ${registry}`);
  console.log(`Provider:  ${PROVIDER_ADDRESS} (Gemma 3 27B, TeeML)`);
  console.log(``);

  const encryptionKey = generateEncryptionKey();

  const client = new ReceiptClient({
    wallet,
    provider,
    registry,
    providerAddress: PROVIDER_ADDRESS,
    brokerBackend: "real",
    storageBackend: "real",
    attest: true,
    receiptEncryption: "sealed",
    encryptionKey,
    issuerLabel: "Sworn live demo (AcmeRefunds Bot)",
  });

  const userQ = "What is your refund policy for damaged goods?";
  console.log(`Question:  "${userQ}"`);
  console.log(`Calling 0G Compute (TeeML, ${MODEL})…`);
  const start = Date.now();

  const { content, receipt, fullReceipt } = await client.chat({
    messages: [{ role: "user", content: userQ }],
    model: MODEL,
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(``);
  console.log(`Answered in ${elapsed}s.`);
  console.log(``);
  console.log(`--- Reply ---`);
  console.log(content);
  console.log(``);
  console.log(`--- Receipt ---`);
  console.log(`url:         ${receipt?.url}`);
  console.log(`chatId:      ${receipt?.chatId}`);
  console.log(`rootHash:    ${receipt?.rootHash}`);
  console.log(`txHash:      ${receipt?.txHash}`);
  console.log(`blockNumber: ${receipt?.blockNumber}`);
  console.log(``);
  console.log(`--- Public links ---`);
  console.log(`Explorer:    https://chainscan-galileo.0g.ai/tx/${receipt?.txHash}`);
  console.log(`Verifier:    https://yonkoo11.github.io/sworn/r/${receipt?.chatId}`);
  console.log(``);

  if (fullReceipt) {
    // generateEncryptionKey() returns a 0x-prefixed hex string already.
    const enc = encryptionKey.replace(/^0x/, "");
    console.log(`(Receipt body is encrypted on 0G Storage. To open the sealed`);
    console.log(`view in the verifier, pass &k=0x${enc} as a query parameter — but`);
    console.log(`only the issuer should share that key. The verifier still`);
    console.log(`shows status banner, anchor, storage rootHash, and 8 of 9 checks`);
    console.log(`pass without the key.)`);
  }
}

main().catch((e) => {
  console.error(`Failed: ${e?.message ?? e}`);
  process.exit(1);
});
