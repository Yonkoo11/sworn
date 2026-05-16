import { useState } from "react";

/**
 * "Mint as INFT" — the receipt's optional owner action.
 *
 * Talks to the user's wallet via window.ethereum (EIP-1193) directly so we
 * don't pull in wagmi / RainbowKit just for one button. Walks the user
 * through: connect → switch to Galileo (chain 16602) → call
 * SwornReceiptInft.mintFromReceipt(chatIdHash).
 *
 * The contract enforces that only the original receipt issuer can mint, so a
 * passer-by clicking the button gets a clean revert with reason text.
 */

const INFT_ADDRESS = "0x6c70b98613Cc567e3c1FeE9248aE58d291e3AfFA";
const GALILEO_CHAIN_HEX = "0x40DA"; // 16602

// Function selector for `mintFromReceipt(bytes32)` — keccak256 of signature, first 4 bytes.
// Pre-computed via `cast keccak "mintFromReceipt(bytes32)"` to avoid bundling
// keccak in the verifier just for one selector.
const MINT_SELECTOR = "0xbadf14a8"; // keccak256("mintFromReceipt(bytes32)")[0:4]

type Status = "idle" | "requesting" | "switching" | "minting" | "minted" | "error";

interface MintInftButtonProps {
  chatIdHash: string;
}

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export function MintInftButton({ chatIdHash }: MintInftButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function onMint() {
    setError(null);
    setTxHash(null);
    if (!window.ethereum) {
      setStatus("error");
      setError("No wallet detected. Install MetaMask or another EIP-1193 wallet.");
      return;
    }
    try {
      setStatus("requesting");
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (!accounts?.length) {
        setStatus("error");
        setError("Wallet returned no accounts.");
        return;
      }
      const from = accounts[0];

      setStatus("switching");
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: GALILEO_CHAIN_HEX }],
        });
      } catch (switchErr) {
        const errObj = switchErr as { code?: number; message?: string };
        if (errObj.code === 4902) {
          // Chain unknown to the wallet — request add.
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: GALILEO_CHAIN_HEX,
                chainName: "0G Galileo Testnet",
                nativeCurrency: { name: "0G", symbol: "OG", decimals: 18 },
                rpcUrls: ["https://evmrpc-testnet.0g.ai"],
                blockExplorerUrls: ["https://chainscan-galileo.0g.ai"],
              },
            ],
          });
        } else if (errObj.code === 4001) {
          setStatus("error");
          setError("Network switch cancelled.");
          return;
        } else {
          throw switchErr;
        }
      }

      setStatus("minting");
      const cleanHash = chatIdHash.startsWith("0x") ? chatIdHash.slice(2) : chatIdHash;
      const data = MINT_SELECTOR + cleanHash.padStart(64, "0");
      const hash = (await window.ethereum.request({
        method: "eth_sendTransaction",
        params: [{ from, to: INFT_ADDRESS, data }],
      })) as string;
      setTxHash(hash);
      setStatus("minted");
    } catch (e) {
      const errObj = e as { code?: number; message?: string };
      if (errObj.code === 4001) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setError(errObj.message ?? "Mint failed.");
    }
  }

  const labelByStatus: Record<Status, string> = {
    idle: "Mint as INFT",
    requesting: "Connecting wallet…",
    switching: "Switching to Galileo…",
    minting: "Minting on-chain…",
    minted: "Minted ✓",
    error: "Try again",
  };

  return (
    <div className="mint-inft">
      <button
        type="button"
        className={`mint-inft-btn ${status}`}
        onClick={onMint}
        disabled={status === "minting" || status === "minted"}
        aria-busy={status === "minting"}
      >
        <span aria-hidden="true" className="mint-inft-btn__icon">⬡</span>
        <span className="mint-inft-btn__label">{labelByStatus[status]}</span>
      </button>
      {status === "minted" && txHash && (
        <a
          className="mint-inft-link"
          href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
        >
          View mint tx →
        </a>
      )}
      {status === "error" && error && (
        <span className="mint-inft-err" role="status">
          {error}
        </span>
      )}
      <p className="mint-inft-help">
        Mints a soulbound NFT bound to this chatId. Only the original issuer can mint.
        Requires a wallet on 0G Galileo (chain 16602).
      </p>
    </div>
  );
}
