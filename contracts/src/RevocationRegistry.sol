// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  RevocationRegistry — Sworn provider revocations
/// @notice Admin-keyed list of TeeML providers whose attestation key has been
///         compromised, deprecated, or otherwise removed from the trust set.
///         The public verifier consults this contract; if a receipt's provider
///         appears here as of a block AT OR AFTER the receipt's anchor block,
///         the receipt is invalidated retroactively.
///
/// Threat model:
///   - Owner can add or remove providers. This is a centralised trust point in
///     V1 to keep the surface small. V2 should move to multisig or governance.
///   - Owner cannot forge a revocation BEFORE the actual issuance block —
///     the on-chain revokedAtBlock is set to `block.number` at revoke time,
///     so a verifier comparing it to the receipt's anchor block can tell
///     whether the receipt was already invalid at issuance or was revoked
///     after the fact.
///
/// Verifier semantics:
///   - If revokedAtBlock == 0  → not revoked.
///   - If revokedAtBlock <= receipt.anchor.blockNumber → invalid at issuance.
///   - If revokedAtBlock  > receipt.anchor.blockNumber → revoked after the
///     fact; receipt was valid when issued. Verifier shows an amber warning.
contract RevocationRegistry {
    struct Revocation {
        uint64 revokedAtBlock;
        uint64 revokedAtTimestamp;
        bytes32 reasonHash; // keccak256 of free-text reason, off-chain
    }

    address public owner;

    mapping(address => Revocation) private _revocations;

    event ProviderRevoked(
        address indexed provider,
        bytes32 indexed reasonHash,
        uint64 blockNumber,
        uint64 blockTimestamp,
        address revokedBy
    );
    event ProviderUnrevoked(address indexed provider, address unrevokedBy);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error NotOwner();
    error AlreadyRevoked(address provider);
    error NotRevoked(address provider);
    error ZeroAddress();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    /// @notice Mark a provider as revoked at the current block.
    /// @param  provider    The TeeML provider address being revoked.
    /// @param  reasonHash  keccak256 of a human-readable reason. Reason text
    ///                     is published off-chain (e.g. in the project README
    ///                     or a Sworn governance post). Keeping the reason
    ///                     off-chain saves gas + lets the reason be richer.
    function revoke(address provider, bytes32 reasonHash) external onlyOwner {
        if (provider == address(0)) revert ZeroAddress();
        if (_revocations[provider].revokedAtBlock != 0) revert AlreadyRevoked(provider);
        _revocations[provider] = Revocation({
            revokedAtBlock: uint64(block.number),
            revokedAtTimestamp: uint64(block.timestamp),
            reasonHash: reasonHash
        });
        emit ProviderRevoked(
            provider,
            reasonHash,
            uint64(block.number),
            uint64(block.timestamp),
            msg.sender
        );
    }

    /// @notice Reverse a revocation. Useful when a revocation was issued in
    ///         error or when the provider has been restored to the trust set.
    function unrevoke(address provider) external onlyOwner {
        if (_revocations[provider].revokedAtBlock == 0) revert NotRevoked(provider);
        delete _revocations[provider];
        emit ProviderUnrevoked(provider, msg.sender);
    }

    /// @notice Query a provider's revocation status. Returns the zero struct
    ///         when not revoked. Verifier compares revokedAtBlock against the
    ///         receipt's anchor block to decide invalid-at-issuance vs
    ///         valid-but-revoked-since.
    function getRevocation(address provider)
        external
        view
        returns (Revocation memory)
    {
        return _revocations[provider];
    }

    function isRevoked(address provider) external view returns (bool) {
        return _revocations[provider].revokedAtBlock != 0;
    }
}
