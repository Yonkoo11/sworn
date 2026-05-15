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

import { JsonRpcProvider, Wallet, parseEther } from "ethers";
import { ReceiptClient, generateEncryptionKey } from "../src/index.js";

/** One-shot 0G Compute ledger setup. Idempotent: catches "already funded". */
async function ensureLedgerFunded(wallet: Wallet, providerAddress: string): Promise<void> {
  const { createZGComputeNetworkBroker } = await import("@0glabs/0g-serving-broker");
  const broker = await createZGComputeNetworkBroker(wallet as any);
  // Try a small ledger amount first; fall back to a larger value if 0G
  // enforces a higher minimum (we'd see a "minimum X" error message).
  const tryAmounts = [0.1, 0.3, 0.45];
  let funded = false;
  for (const amt of tryAmounts) {
    try {
      await broker.ledger.addLedger(amt);
      console.log(`Ledger created with ${amt} OG.`);
      funded = true;
      break;
    } catch (e) {
      const msg = (e as Error).message ?? "";
      if (/already|exist/i.test(msg)) {
        console.log("Ledger already exists, skipping addLedger.");
        funded = true;
        break;
      }
      if (/minimum/i.test(msg)) {
        console.log(`  ${amt} OG below minimum, trying next…`);
        continue;
      }
      console.log(`  addLedger(${amt}) failed: ${msg}`);
      // Continue trying — could be a transient RPC issue.
    }
  }
  if (!funded) {
    throw new Error(
      "Could not create ledger. Wallet likely needs more 0G — claim again at https://faucet.0g.ai",
    );
  }
  try {
    await broker.inference.acknowledgeProviderSigner(providerAddress);
    console.log(`Acknowledged provider signer ${providerAddress}.`);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/already|exist/i.test(msg)) {
      console.log("Provider already acknowledged.");
    } else {
      throw e;
    }
  }
  // Transfer a small amount to the provider sub-account. Gemma inference at
  // ~$0.003/1K tokens means 0.01 OG covers many test calls.
  try {
    await broker.ledger.transferFund(providerAddress, "inference", parseEther("0.05"));
    console.log("Transferred 0.05 OG to provider inference sub-account.");
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/already|exist|sufficient/i.test(msg)) {
      console.log("Provider sub-account already funded, skipping transferFund.");
    } else {
      throw e;
    }
  }
}

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

  // 0G Compute requires a funded ledger + provider sub-account before the
  // first inference call. Only do this when running against a real provider —
  // mock-broker mode skips it because no inference call goes out.
  const realBroker = (process.env.SWORN_BROKER ?? "mock") === "real";
  if (realBroker) {
    console.log("Setting up 0G Compute ledger (idempotent)…");
    await ensureLedgerFunded(wallet, PROVIDER_ADDRESS);
    console.log(``);
  } else {
    console.log("SWORN_BROKER=mock — skipping ledger setup (TEE signature simulated).");
    console.log(``);
  }

  const encryptionKey = generateEncryptionKey();

  // Backend choice is env-driven so the same script can demo:
  //   - chain+storage real, TEE signature simulated (default for Galileo at
  //     submission time, while 0G has no live TeeML providers)
  //   - everything real (post-provider deployment, flip SWORN_BROKER=real)
  const brokerBackend = (process.env.SWORN_BROKER ?? "mock") === "real" ? "real" : "mock";
  const storageBackend = (process.env.SWORN_STORAGE ?? "mock") === "real" ? "real" : "mock";
  console.log(`Backends: broker=${brokerBackend}, storage=${storageBackend}`);
  console.log(``);

  const client = new ReceiptClient({
    wallet,
    provider,
    registry,
    providerAddress: PROVIDER_ADDRESS,
    brokerBackend,
    storageBackend,
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
