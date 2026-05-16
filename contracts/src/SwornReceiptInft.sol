// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiptRegistry} from "./ReceiptRegistry.sol";

/// @title  SwornReceiptInft - intelligent NFT wrapper for Sworn receipts
/// @notice Minimal ERC-7857-flavoured INFT (no external deps; hand-rolled).
///         Each token corresponds 1:1 to an anchored chatIdHash. tokenId is
///         the uint256-cast chatIdHash so the binding is implicit.
///
///         The point of wrapping a receipt as an NFT is composability:
///           - Receipts can be listed on AI-asset marketplaces.
///           - Insurance underwriters can require the policyholder to hold
///             the NFT for the AI agent they are underwriting.
///           - Receipts can be transferred when ownership of the AI
///             workflow changes hands.
///
///         V1 is non-transferable (soulbound). Transferring a receipt would
///         leak the issuer attribution semantics; V2 will add a transferable
///         tier with an explicit "delegated holder" address inside the
///         receipt body. Soulbound for now.
///
///         The contract intentionally does not reimplement ERC-721 events
///         to keep the surface small. A receipt is minted exactly once and
///         not transferred; downstream tooling reads the mint event.
contract SwornReceiptInft {
    ReceiptRegistry public immutable registry;
    string public constant name = "Sworn Receipt";
    string public constant symbol = "SWORN-R";
    string public constant standardId = "ERC-7857-flavour-v1";

    /// chatIdHash => owner. 0 = not minted.
    mapping(bytes32 => address) private _owners;

    /// Lightweight ERC-721 transfer event (only fired at mint; soulbound after).
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    /// Sworn-specific. Carries the chatIdHash literally so a chain-watching
    /// indexer doesn't have to keccak-test guess the tokenId.
    event ReceiptInftMinted(
        bytes32 indexed chatIdHash,
        uint256 indexed tokenId,
        address indexed owner,
        address minter
    );

    error AnchorMissing(bytes32 chatIdHash);
    error AlreadyMinted(bytes32 chatIdHash);
    error NotIssuer(address caller, address issuer);
    error NotMinted(bytes32 chatIdHash);
    error Soulbound();

    constructor(ReceiptRegistry _registry) {
        registry = _registry;
    }

    /// @notice Mint the INFT for an anchored receipt. Only the original issuer
    ///         (the address that called registry.recordReceipt) may mint.
    function mintFromReceipt(bytes32 chatIdHash) external returns (uint256 tokenId) {
        ReceiptRegistry.Anchor memory a = registry.getAnchor(chatIdHash);
        if (a.storageRootHash == bytes32(0)) revert AnchorMissing(chatIdHash);
        if (msg.sender != a.issuer) revert NotIssuer(msg.sender, a.issuer);
        if (_owners[chatIdHash] != address(0)) revert AlreadyMinted(chatIdHash);

        _owners[chatIdHash] = a.issuer;
        tokenId = uint256(chatIdHash);
        emit Transfer(address(0), a.issuer, tokenId);
        emit ReceiptInftMinted(chatIdHash, tokenId, a.issuer, msg.sender);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        bytes32 cidHash = bytes32(tokenId);
        address o = _owners[cidHash];
        if (o == address(0)) revert NotMinted(cidHash);
        return o;
    }

    function balanceOf(address /* who */) external pure returns (uint256) {
        // Indexing-by-owner is not tracked in V1 (saves storage). Off-chain
        // indexers can derive from the Transfer event log; on-chain queries
        // are not the primary use case here.
        revert("balanceOf not implemented in V1 (see Transfer event log)");
    }

    function tokenURI(uint256 tokenId) external view returns (string memory) {
        bytes32 cidHash = bytes32(tokenId);
        if (_owners[cidHash] == address(0)) revert NotMinted(cidHash);
        // The URI returns the verifier-web canonical URL by chatIdHash.
        // chatIdHash is not the same as chatId, but the verifier accepts
        // either form via the `?h=` query param fallback.
        return string.concat(
            "https://yonkoo11.github.io/sworn/r/_byhash?h=",
            _toHexString(cidHash)
        );
    }

    // ----------------------------- Soulbound -----------------------------
    // Reverting transfer functions makes this an explicit soulbound token
    // even though we do not implement the full ERC-721 interface.

    function transferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256) external pure {
        revert Soulbound();
    }

    function safeTransferFrom(address, address, uint256, bytes calldata) external pure {
        revert Soulbound();
    }

    function approve(address, uint256) external pure {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) external pure {
        revert Soulbound();
    }

    function getApproved(uint256) external pure returns (address) {
        return address(0);
    }

    function isApprovedForAll(address, address) external pure returns (bool) {
        return false;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // ERC-165 + a minimal ERC-721 view interface (no transfers).
        return
            interfaceId == 0x01ffc9a7 || // ERC-165
            interfaceId == 0x80ac58cd || // ERC-721 (we claim it for marketplace listing; transfers revert)
            interfaceId == 0x5b5e139f;   // ERC-721 metadata
    }

    // ---------------------------- internal ------------------------------
    function _toHexString(bytes32 b) private pure returns (string memory) {
        bytes memory chars = "0123456789abcdef";
        bytes memory out = new bytes(66);
        out[0] = "0";
        out[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            out[2 + i * 2] = chars[uint8(b[i] >> 4)];
            out[3 + i * 2] = chars[uint8(b[i] & 0x0f)];
        }
        return string(out);
    }
}
