// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract RevocationRegistryTest is Test {
    RevocationRegistry internal reg;
    address internal owner = address(this);
    address internal alice = address(0xA11CE);
    address internal provider = 0x69EbE4c002ec5e3f0e9C2be94C3Ae08000000000;
    bytes32 internal constant REASON = keccak256("key compromise: see security/2026-05-15.md");

    function setUp() public {
        reg = new RevocationRegistry();
    }

    function test_constructor_setsOwner() public {
        assertEq(reg.owner(), owner);
    }

    function test_revoke_recordsAndEmits() public {
        vm.roll(100);
        vm.warp(1_000_000);
        vm.expectEmit(true, true, false, true);
        emit RevocationRegistry.ProviderRevoked(provider, REASON, 100, 1_000_000, owner);
        reg.revoke(provider, REASON);

        RevocationRegistry.Revocation memory r = reg.getRevocation(provider);
        assertEq(r.revokedAtBlock, 100);
        assertEq(r.revokedAtTimestamp, 1_000_000);
        assertEq(r.reasonHash, REASON);
        assertTrue(reg.isRevoked(provider));
    }

    function test_revoke_replayReverts() public {
        reg.revoke(provider, REASON);
        vm.expectRevert(abi.encodeWithSelector(RevocationRegistry.AlreadyRevoked.selector, provider));
        reg.revoke(provider, REASON);
    }

    function test_revoke_zeroAddressReverts() public {
        vm.expectRevert(RevocationRegistry.ZeroAddress.selector);
        reg.revoke(address(0), REASON);
    }

    function test_revoke_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(RevocationRegistry.NotOwner.selector);
        reg.revoke(provider, REASON);
    }

    function test_unrevoke_clears() public {
        reg.revoke(provider, REASON);
        reg.unrevoke(provider);
        assertFalse(reg.isRevoked(provider));
        RevocationRegistry.Revocation memory r = reg.getRevocation(provider);
        assertEq(r.revokedAtBlock, 0);
    }

    function test_unrevoke_notRevokedReverts() public {
        vm.expectRevert(abi.encodeWithSelector(RevocationRegistry.NotRevoked.selector, provider));
        reg.unrevoke(provider);
    }

    function test_unrevoke_onlyOwner() public {
        reg.revoke(provider, REASON);
        vm.prank(alice);
        vm.expectRevert(RevocationRegistry.NotOwner.selector);
        reg.unrevoke(provider);
    }

    function test_transferOwnership_flow() public {
        reg.transferOwnership(alice);
        assertEq(reg.owner(), alice);
        vm.expectRevert(RevocationRegistry.NotOwner.selector);
        reg.revoke(provider, REASON);
        vm.prank(alice);
        reg.revoke(provider, REASON);
        assertTrue(reg.isRevoked(provider));
    }

    function test_transferOwnership_zeroReverts() public {
        vm.expectRevert(RevocationRegistry.ZeroAddress.selector);
        reg.transferOwnership(address(0));
    }

    function testFuzz_revokeIsIdempotentlyQueryable(address p, bytes32 r) public {
        vm.assume(p != address(0));
        reg.revoke(p, r);
        assertTrue(reg.isRevoked(p));
        assertEq(reg.getRevocation(p).reasonHash, r);
    }
}
