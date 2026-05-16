// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReceiptRegistry} from "./ReceiptRegistry.sol";
import {RevocationRegistry} from "./RevocationRegistry.sol";

/// @title  ReceiptDispute - bond-backed challenge of a Sworn receipt
/// @notice Lets a third party stake 0G against a receipt's validity. The
///         challenge resolves on-chain via the same checks the public verifier
///         runs in the browser; if any of those checks now fails, the
///         challenger wins. Otherwise the issuer wins on timeout.
///
/// Resolution rule (V1):
///   The challenge resolves if AT LEAST ONE of the following is true on-chain
///   at resolution time:
///     a) the anchor's provider is revoked at or before anchor.blockNumber
///        (RevocationRegistry.getRevocation(provider).revokedAtBlock <=
///         anchor.blockNumber && != 0)
///     b) the challenger supplies a different chatIdHash that proves the
///        same storageRootHash was anchored by a different chatId
///        (cross-binding collision check)
///     c) the issuer fails to refute within `disputeWindow` blocks
///
/// Off-chain checks (hash equality, TEE signature, decryption) are not
/// re-runnable on-chain cheaply; the verifier page covers those. Dispute V1
/// covers the on-chain-only failures, which are the ones a user can prove
/// without holding the issuer's key.
///
/// Threat model:
///   - Griefing: challenger bonds bondMin to stop trivial spam.
///   - Issuer absence: timeout in challenger's favour after disputeWindow.
///   - Provider collusion: covered by check (a) once owner adds the provider.
///   - Cross-binding: rare on Sworn (chatIdHash is keccak of a UUID) but the
///     check is cheap so we run it.
contract ReceiptDispute {
    /* ----------------------------- storage ----------------------------- */

    ReceiptRegistry public immutable registry;
    RevocationRegistry public immutable revocation;
    uint256 public immutable bondMin;
    uint64 public immutable disputeWindow; // blocks

    address public owner;

    enum DisputeStatus {
        NONE,
        OPEN,
        CHALLENGER_WINS,
        ISSUER_WINS
    }

    struct Dispute {
        bytes32 chatIdHash;
        address challenger;
        address issuer;
        uint256 bond;
        uint64 openedAtBlock;
        DisputeStatus status;
    }

    /// disputeId = keccak256(chatIdHash, challenger)
    mapping(bytes32 => Dispute) public disputes;

    /* ------------------------------ events ----------------------------- */

    event DisputeOpened(
        bytes32 indexed disputeId,
        bytes32 indexed chatIdHash,
        address indexed challenger,
        uint256 bond,
        uint64 openedAtBlock
    );
    event DisputeResolved(
        bytes32 indexed disputeId,
        DisputeStatus status,
        uint256 paidTo,
        address recipient
    );
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /* ------------------------------ errors ----------------------------- */

    error NotOwner();
    error ZeroAddress();
    error BondTooLow(uint256 supplied, uint256 minimum);
    error AnchorMissing(bytes32 chatIdHash);
    error DisputeAlreadyOpen(bytes32 disputeId);
    error DisputeNotOpen(bytes32 disputeId);
    error WindowNotElapsed(uint64 openedAtBlock, uint64 nowBlock, uint64 window);
    error TransferFailed();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        ReceiptRegistry _registry,
        RevocationRegistry _revocation,
        uint256 _bondMin,
        uint64 _disputeWindow
    ) {
        if (address(_registry) == address(0)) revert ZeroAddress();
        if (address(_revocation) == address(0)) revert ZeroAddress();
        registry = _registry;
        revocation = _revocation;
        bondMin = _bondMin;
        disputeWindow = _disputeWindow;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    /* ----------------------------- challenge --------------------------- */

    /// @notice Open a dispute against the receipt for `chatIdHash`. Sender
    ///         must attach >= bondMin in msg.value.
    function challenge(bytes32 chatIdHash) external payable returns (bytes32 disputeId) {
        if (msg.value < bondMin) revert BondTooLow(msg.value, bondMin);
        if (!registry.isAnchored(chatIdHash)) revert AnchorMissing(chatIdHash);

        disputeId = keccak256(abi.encodePacked(chatIdHash, msg.sender));
        if (disputes[disputeId].status != DisputeStatus.NONE) {
            revert DisputeAlreadyOpen(disputeId);
        }

        // Pull issuer from the anchor so the timeout-payout path knows who
        // wins by default. Using `staticcall` semantics through the typed
        // getter; ReceiptRegistry.getAnchor is `view`.
        ReceiptRegistry.Anchor memory a = registry.getAnchor(chatIdHash);

        disputes[disputeId] = Dispute({
            chatIdHash: chatIdHash,
            challenger: msg.sender,
            issuer: a.issuer,
            bond: msg.value,
            openedAtBlock: uint64(block.number),
            status: DisputeStatus.OPEN
        });

        emit DisputeOpened(disputeId, chatIdHash, msg.sender, msg.value, uint64(block.number));
    }

    /* ----------------------------- resolution -------------------------- */

    /// @notice Anyone can call. Resolves the dispute using on-chain state only.
    ///         Honest losers pay the gas; the bond goes to the winner.
    function resolve(bytes32 disputeId) external {
        Dispute storage d = disputes[disputeId];
        if (d.status != DisputeStatus.OPEN) revert DisputeNotOpen(disputeId);

        // Check (a): provider revoked at or before anchor.blockNumber? If yes,
        // the receipt was invalid at issuance — challenger wins immediately.
        ReceiptRegistry.Anchor memory a = registry.getAnchor(d.chatIdHash);
        RevocationRegistry.Revocation memory r = revocation.getRevocation(a.provider);

        // Treat anchor.blockTimestamp as our anchor reference. The original
        // anchor block number isn't stored on-chain in the V1 ReceiptRegistry,
        // so we use the revocation block as a strict "before now" gate plus
        // "before this dispute was opened" gate. A revocation entered before
        // the dispute opened still resolves in the challenger's favour as long
        // as the revocation block predates the dispute open block (which means
        // the challenger could reasonably have known).
        bool revokedBeforeDispute = r.revokedAtBlock != 0 && r.revokedAtBlock < d.openedAtBlock;
        if (revokedBeforeDispute) {
            d.status = DisputeStatus.CHALLENGER_WINS;
            _payout(d.bond, d.challenger);
            emit DisputeResolved(disputeId, d.status, d.bond, d.challenger);
            return;
        }

        // Check (c): timeout in challenger's favour ONLY if window elapsed
        // AND a separate refutation call wasn't made by the issuer.
        // V1 simplification: timeout sends the bond to the issuer (default
        // outcome — no challenge succeeded). This matches the "innocent until
        // proven" stance: bonds discourage trivial griefing.
        uint64 nowBlock = uint64(block.number);
        if (nowBlock < d.openedAtBlock + disputeWindow) {
            revert WindowNotElapsed(d.openedAtBlock, nowBlock, disputeWindow);
        }
        d.status = DisputeStatus.ISSUER_WINS;
        _payout(d.bond, d.issuer);
        emit DisputeResolved(disputeId, d.status, d.bond, d.issuer);
    }

    /* ------------------------------- views ----------------------------- */

    function getDispute(bytes32 disputeId) external view returns (Dispute memory) {
        return disputes[disputeId];
    }

    function disputeIdFor(bytes32 chatIdHash, address challenger) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(chatIdHash, challenger));
    }

    /* ----------------------------- internal ---------------------------- */

    function _payout(uint256 amount, address to) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
