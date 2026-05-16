// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CommitReveal} from "../src/CommitReveal.sol";

contract CommitRevealTest is Test {
    CommitReveal internal cr;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    bytes32 internal constant PROMPT_HASH = keccak256("user: what is your refund policy?");
    bytes32 internal constant SALT = bytes32(uint256(0xABCDEF));
    bytes32 internal commitHash;

    function setUp() public {
        cr = new CommitReveal();
        commitHash = keccak256(abi.encodePacked(PROMPT_HASH, SALT));
    }

    function test_commit_records() public {
        vm.roll(100);
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CommitReveal.Committed(commitHash, alice, 100);
        cr.commit(commitHash);
        assertEq(cr.commitBlockOf(commitHash), 100);
    }

    function test_commit_replayReverts() public {
        vm.prank(alice);
        cr.commit(commitHash);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(CommitReveal.AlreadyCommitted.selector, commitHash));
        cr.commit(commitHash);
    }

    function test_reveal_happyPath() public {
        vm.roll(100);
        vm.prank(alice);
        cr.commit(commitHash);

        vm.roll(101); // strictly after
        vm.expectEmit(true, true, true, true);
        emit CommitReveal.Revealed(commitHash, PROMPT_HASH, SALT, alice, 100, 101);
        vm.prank(alice);
        cr.reveal(PROMPT_HASH, SALT);

        // Cleared so the same commit can't be replayed.
        assertEq(cr.commitBlockOf(commitHash), 0);
    }

    function test_reveal_sameBlockReverts() public {
        vm.roll(100);
        vm.prank(alice);
        cr.commit(commitHash);

        vm.expectRevert(
            abi.encodeWithSelector(CommitReveal.CommitTooFresh.selector, 100, 100)
        );
        vm.prank(alice);
        cr.reveal(PROMPT_HASH, SALT);
    }

    function test_reveal_uncommittedReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(CommitReveal.NotCommitted.selector, commitHash)
        );
        cr.reveal(PROMPT_HASH, SALT);
    }

    function test_reveal_wrongSaltReverts() public {
        vm.roll(100);
        vm.prank(alice);
        cr.commit(commitHash);
        vm.roll(101);

        bytes32 wrongSalt = bytes32(uint256(0xDEADBEEF));
        bytes32 expectedCommit = keccak256(abi.encodePacked(PROMPT_HASH, wrongSalt));
        vm.expectRevert(
            abi.encodeWithSelector(CommitReveal.NotCommitted.selector, expectedCommit)
        );
        vm.prank(alice);
        cr.reveal(PROMPT_HASH, wrongSalt);
    }

    function test_reveal_doubleSpendReverts() public {
        vm.roll(100);
        vm.prank(alice);
        cr.commit(commitHash);
        vm.roll(101);
        vm.prank(alice);
        cr.reveal(PROMPT_HASH, SALT);

        // Second reveal must fail; commit was cleared.
        vm.expectRevert(
            abi.encodeWithSelector(CommitReveal.NotCommitted.selector, commitHash)
        );
        vm.prank(alice);
        cr.reveal(PROMPT_HASH, SALT);
    }

    function test_reveal_byDifferentRevealerAllowed() public {
        // Reveal can be by anyone who knows (promptHash, salt). The committer
        // typically reveals, but the contract does not enforce this — the
        // emit event records `revealer` so the verifier can spot if a
        // different address revealed (could be a delegated agent).
        vm.roll(100);
        vm.prank(alice);
        cr.commit(commitHash);
        vm.roll(101);
        vm.expectEmit(true, true, true, true);
        emit CommitReveal.Revealed(commitHash, PROMPT_HASH, SALT, bob, 100, 101);
        vm.prank(bob);
        cr.reveal(PROMPT_HASH, SALT);
    }

    function testFuzz_commitReveal_roundtrip(bytes32 ph, bytes32 s) public {
        bytes32 cHash = keccak256(abi.encodePacked(ph, s));
        vm.roll(100);
        cr.commit(cHash);
        vm.roll(101);
        cr.reveal(ph, s);
        assertEq(cr.commitBlockOf(cHash), 0);
    }
}
