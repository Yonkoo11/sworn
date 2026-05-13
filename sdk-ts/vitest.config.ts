import { defineConfig } from "vitest/config";

/**
 * Vitest config for @sworn/sdk.
 *
 * - `globalSetup` boots a local Anvil + deploys ReceiptRegistry for anchor /
 *   e2e tests. T5 (client + hashing) tests do not touch the chain, but the
 *   global setup runs for the whole suite — it is fast (~1s) and the address
 *   is consumed via env so non-chain tests are unaffected.
 *
 * - Tests are co-located under `test/` to keep `src/` shippable.
 *
 * - 30s default test timeout for chain interactions (Anvil deploy + tx).
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/setup/global.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
