// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ReceiptRegistry
/// @notice Anchors Sworn receipts on 0G Chain.
/// @dev One chatIdHash maps to one Anchor, ever. Replay attempts revert.
contract ReceiptRegistry {
    struct Anchor {
        bytes32 storageRootHash;
        address provider;
        address issuer;
        uint64 blockTimestamp;
        bytes32 modelHash;
    }

    /// @notice chatIdHash => Anchor
    mapping(bytes32 => Anchor) public anchors;

    event ReceiptIssued(
        bytes32 indexed chatIdHash,
        bytes32 indexed storageRootHash,
        address indexed provider,
        address issuer,
        bytes32 modelHash,
        uint64 blockTimestamp
    );

    error AlreadyAnchored(bytes32 chatIdHash);
    error ZeroChatIdHash();
    error ZeroStorageRootHash();
    error ZeroProvider();

    /// @notice Record a receipt anchor.
    /// @param chatIdHash keccak256 of the provider-returned chatId
    /// @param storageRootHash 0G Storage Merkle root of the encrypted receipt blob
    /// @param provider TeeML provider address (0x69Eb... etc)
    /// @param modelHash keccak256 of the model identifier string
    function recordReceipt(
        bytes32 chatIdHash,
        bytes32 storageRootHash,
        address provider,
        bytes32 modelHash
    ) external {
        if (chatIdHash == bytes32(0)) revert ZeroChatIdHash();
        if (storageRootHash == bytes32(0)) revert ZeroStorageRootHash();
        if (provider == address(0)) revert ZeroProvider();
        if (anchors[chatIdHash].storageRootHash != bytes32(0)) {
            revert AlreadyAnchored(chatIdHash);
        }

        anchors[chatIdHash] = Anchor({
            storageRootHash: storageRootHash,
            provider: provider,
            issuer: msg.sender,
            blockTimestamp: uint64(block.timestamp),
            modelHash: modelHash
        });

        emit ReceiptIssued(
            chatIdHash,
            storageRootHash,
            provider,
            msg.sender,
            modelHash,
            uint64(block.timestamp)
        );
    }

    /// @notice Returns true if a chatIdHash has been anchored.
    function isAnchored(bytes32 chatIdHash) external view returns (bool) {
        return anchors[chatIdHash].storageRootHash != bytes32(0);
    }

    /// @notice Convenience getter for the full anchor record.
    function getAnchor(bytes32 chatIdHash) external view returns (Anchor memory) {
        return anchors[chatIdHash];
    }
}
