/**
 * List live 0G Compute providers on Galileo via the SDK broker.
 * Helpful when the documented sample addresses are stale.
 */
import { Wallet, JsonRpcProvider } from "ethers";

const pk = process.env.PRIVATE_KEY;
if (!pk) {
  console.error("PRIVATE_KEY required (used only to instantiate signer)");
  process.exit(1);
}
const rpc = process.env.SWORN_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const provider = new JsonRpcProvider(rpc);
const wallet = new Wallet(pk, provider);

const { createZGComputeNetworkBroker } = await import("@0glabs/0g-serving-broker");
const broker: any = await createZGComputeNetworkBroker(wallet as any);

console.log("Listing services via broker.inference.listService()…\n");
const services = await broker.inference.listService();
if (!Array.isArray(services) || services.length === 0) {
  console.log("(no services returned)");
} else {
  for (const s of services as any[]) {
    console.log(`provider:  ${s.provider ?? s[0] ?? "?"}`);
    console.log(`  model:   ${s.model ?? "?"}`);
    console.log(`  url:     ${s.url ?? s.endpoint ?? "?"}`);
    console.log(`  type:    ${s.serviceType ?? s.type ?? "?"}`);
    console.log("");
  }
}
