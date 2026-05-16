// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title  CommitReveal - timestamp-binding for Sworn prompt hashes
/// @notice Kills the issuer-provider collusion vector. Without commit-reveal,
///         a malicious provider could see the user's question, generate any
///         convenient answer, then collude with the user to "issue" a receipt
///         using a prompt that was picked AFTER the response was known.
///         With commit-reveal, the prompt hash is anchored on-chain BEFORE
///         the provider returns. The on-chain commit's blockNumber is the
///         lower-bound timestamp for the prompt; the reveal proves the
///         caller knew the salt all along.
///
/// Usage by the SDK:
///   1. promptHash = sha256(canonicalised messages)
///   2. salt = 32 random bytes
///   3. commitHash = keccak256(promptHash, salt)
///   4. commit(commitHash) on-chain
///   5. wait at least one block
///   6. send the prompt to the 0G Compute provider, get the response
///   7. reveal(promptHash, salt) on-chain
///   8. issue the receipt normally (recordReceipt on ReceiptRegistry)
///   9. include commitHash + commitBlock + revealBlock in the receipt body so
///      a verifier can re-derive the commit and confirm the time-ordering.
///
/// The contract intentionally does not touch ReceiptRegistry. Verifiers cross-
/// reference the two via the receipt body, which keeps the on-chain state
/// minimal and avoids coupling V1 ReceiptRegistry to this V2 mechanism.
contract CommitReveal {
    /// commitHash => block number at commit time. 0 = not committed.
    mapping(bytes32 => uint64) public commits;

    event Committed(bytes32 indexed commitHash, address indexed committer, uint64 blockNumber);
    event Revealed(
        bytes32 indexed commitHash,
        bytes32 indexed promptHash,
        bytes32 salt,
        address indexed revealer,
        uint64 commitBlock,
        uint64 revealBlock
    );

    error AlreadyCommitted(bytes32 commitHash);
    error NotCommitted(bytes32 commitHash);
    error CommitTooFresh(uint64 commitBlock, uint64 nowBlock);

    function commit(bytes32 commitHash) external {
        if (commits[commitHash] != 0) revert AlreadyCommitted(commitHash);
        commits[commitHash] = uint64(block.number);
        emit Committed(commitHash, msg.sender, uint64(block.number));
    }

    function reveal(bytes32 promptHash, bytes32 salt) external {
        bytes32 commitHash = keccak256(abi.encodePacked(promptHash, salt));
        uint64 commitBlock = commits[commitHash];
        if (commitBlock == 0) revert NotCommitted(commitHash);
        // Must be at least one block later. Same-block reveal would let an
        // attacker who watches the mempool race the commit with a reveal of
        // a different prompt.
        if (block.number <= commitBlock) revert CommitTooFresh(commitBlock, uint64(block.number));
        delete commits[commitHash];
        emit Revealed(commitHash, promptHash, salt, msg.sender, commitBlock, uint64(block.number));
    }

    /// @notice Off-chain helper. Returns 0 if commitHash never committed.
    function commitBlockOf(bytes32 commitHash) external view returns (uint64) {
        return commits[commitHash];
    }
}
