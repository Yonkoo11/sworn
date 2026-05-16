// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {ReceiptDispute} from "../src/ReceiptDispute.sol";

contract ReceiptDisputeTest is Test {
    ReceiptRegistry internal reg;
    RevocationRegistry internal rev;
    ReceiptDispute internal disp;

    address internal owner = address(this);
    address internal issuer = address(0x1111);
    address internal challenger = address(0x2222);
    address internal provider = 0x69EbE4c002ec5e3f0e9C2be94C3Ae08000000000;

    bytes32 internal constant CHAT_HASH = keccak256("chat-1");
    bytes32 internal constant ROOT_HASH = keccak256("root-1");
    bytes32 internal constant MODEL_HASH = keccak256("gemma-3-27b-it");

    uint256 internal constant BOND_MIN = 0.01 ether;
    uint64 internal constant WINDOW = 100;

    function setUp() public {
        reg = new ReceiptRegistry();
        rev = new RevocationRegistry();
        disp = new ReceiptDispute(reg, rev, BOND_MIN, WINDOW);

        // Issuer registers a receipt.
        vm.prank(issuer);
        reg.recordReceipt(CHAT_HASH, ROOT_HASH, provider, MODEL_HASH);

        // Fund the challenger.
        vm.deal(challenger, 10 ether);
    }

    function test_constructor_setsImmutables() public {
        assertEq(address(disp.registry()), address(reg));
        assertEq(address(disp.revocation()), address(rev));
        assertEq(disp.bondMin(), BOND_MIN);
        assertEq(disp.disputeWindow(), WINDOW);
        assertEq(disp.owner(), owner);
    }

    function test_challenge_recordsDispute() public {
        vm.roll(50);
        vm.prank(challenger);
        bytes32 id = disp.challenge{value: BOND_MIN}(CHAT_HASH);

        ReceiptDispute.Dispute memory d = disp.getDispute(id);
        assertEq(d.chatIdHash, CHAT_HASH);
        assertEq(d.challenger, challenger);
        assertEq(d.issuer, issuer);
        assertEq(d.bond, BOND_MIN);
        assertEq(d.openedAtBlock, 50);
        assertEq(uint8(d.status), uint8(ReceiptDispute.DisputeStatus.OPEN));
    }

    function test_challenge_bondTooLowReverts() public {
        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(
                ReceiptDispute.BondTooLow.selector,
                BOND_MIN - 1,
                BOND_MIN
            )
        );
        disp.challenge{value: BOND_MIN - 1}(CHAT_HASH);
    }

    function test_challenge_anchorMissingReverts() public {
        bytes32 unknown = keccak256("no-such-chat");
        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(ReceiptDispute.AnchorMissing.selector, unknown)
        );
        disp.challenge{value: BOND_MIN}(unknown);
    }

    function test_challenge_duplicateReverts() public {
        vm.prank(challenger);
        bytes32 id = disp.challenge{value: BOND_MIN}(CHAT_HASH);
        vm.prank(challenger);
        vm.expectRevert(
            abi.encodeWithSelector(ReceiptDispute.DisputeAlreadyOpen.selector, id)
        );
        disp.challenge{value: BOND_MIN}(CHAT_HASH);
    }

    function test_resolve_challengerWinsWhenProviderRevokedBeforeDispute() public {
        // Owner revokes the provider before the challenge.
        vm.roll(10);
        rev.revoke(provider, keccak256("compromised"));

        vm.roll(50);
        vm.prank(challenger);
        bytes32 id = disp.challenge{value: BOND_MIN}(CHAT_HASH);

        uint256 challengerBefore = challenger.balance;
        disp.resolve(id);
        assertEq(challenger.balance - challengerBefore, BOND_MIN, "challenger refunded + nothing extra");

        ReceiptDispute.Dispute memory d = disp.getDispute(id);
        assertEq(uint8(d.status), uint8(ReceiptDispute.DisputeStatus.CHALLENGER_WINS));
    }

    function test_resolve_issuerWinsOnTimeout() public {
        vm.roll(50);
        vm.prank(challenger);
        bytes32 id = disp.challenge{value: BOND_MIN}(CHAT_HASH);

        // Window not yet elapsed.
        vm.roll(50 + WINDOW - 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                ReceiptDispute.WindowNotElapsed.selector,
                50,
                50 + WINDOW - 1,
                WINDOW
            )
        );
        disp.resolve(id);

        // Window elapsed; issuer wins.
        vm.roll(50 + WINDOW);
        uint256 issuerBefore = issuer.balance;
        disp.resolve(id);
        assertEq(issuer.balance - issuerBefore, BOND_MIN);

        ReceiptDispute.Dispute memory d = disp.getDispute(id);
        assertEq(uint8(d.status), uint8(ReceiptDispute.DisputeStatus.ISSUER_WINS));
    }

    function test_resolve_alreadyResolvedReverts() public {
        vm.roll(10);
        rev.revoke(provider, keccak256("compromised"));
        vm.roll(50);
        vm.prank(challenger);
        bytes32 id = disp.challenge{value: BOND_MIN}(CHAT_HASH);
        disp.resolve(id);
        vm.expectRevert(
            abi.encodeWithSelector(ReceiptDispute.DisputeNotOpen.selector, id)
        );
        disp.resolve(id);
    }

    function test_disputeIdFor_isDeterministic() public {
        bytes32 expected = keccak256(abi.encodePacked(CHAT_HASH, challenger));
        assertEq(disp.disputeIdFor(CHAT_HASH, challenger), expected);
    }

    function test_transferOwnership_zeroReverts() public {
        vm.expectRevert(ReceiptDispute.ZeroAddress.selector);
        disp.transferOwnership(address(0));
    }

    function testFuzz_disputeIdUnique(bytes32 c, address ch) public {
        vm.assume(ch != address(0));
        bytes32 a = disp.disputeIdFor(c, ch);
        bytes32 b = disp.disputeIdFor(c, ch);
        assertEq(a, b);
    }
}
