// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";

contract ReceiptRegistryTest is Test {
    ReceiptRegistry internal registry;

    address internal constant PROVIDER = 0x69Eb5a0BD7d0f4bF39eD5CE9Bd3376c61863aE08;
    bytes32 internal constant CHAT_ID_HASH = keccak256("chat-id-1");
    bytes32 internal constant STORAGE_ROOT = keccak256("rootHash-1");
    bytes32 internal constant MODEL_HASH = keccak256("gemma-3-27b-it");

    address internal issuer = address(0xABCD);

    event ReceiptIssued(
        bytes32 indexed chatIdHash,
        bytes32 indexed storageRootHash,
        address indexed provider,
        address issuer,
        bytes32 modelHash,
        uint64 blockTimestamp
    );

    function setUp() public {
        registry = new ReceiptRegistry();
    }

    function test_recordReceipt_storesAnchor() public {
        vm.prank(issuer);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);

        (
            bytes32 storedRoot,
            address storedProvider,
            address storedIssuer,
            uint64 storedTs,
            bytes32 storedModel
        ) = registry.anchors(CHAT_ID_HASH);

        assertEq(storedRoot, STORAGE_ROOT, "rootHash mismatch");
        assertEq(storedProvider, PROVIDER, "provider mismatch");
        assertEq(storedIssuer, issuer, "issuer mismatch");
        assertEq(storedModel, MODEL_HASH, "modelHash mismatch");
        assertEq(storedTs, uint64(block.timestamp), "timestamp mismatch");
    }

    function test_recordReceipt_emitsEvent() public {
        vm.expectEmit(true, true, true, true, address(registry));
        emit ReceiptIssued(
            CHAT_ID_HASH,
            STORAGE_ROOT,
            PROVIDER,
            issuer,
            MODEL_HASH,
            uint64(block.timestamp)
        );

        vm.prank(issuer);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);
    }

    function test_isAnchored_returnsTrueAfterRecord() public {
        assertFalse(registry.isAnchored(CHAT_ID_HASH));
        vm.prank(issuer);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);
        assertTrue(registry.isAnchored(CHAT_ID_HASH));
    }

    function test_recordReceipt_replayReverts() public {
        vm.prank(issuer);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);

        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(ReceiptRegistry.AlreadyAnchored.selector, CHAT_ID_HASH)
        );
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);
    }

    function test_recordReceipt_replayDifferentRootStillReverts() public {
        vm.prank(issuer);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);

        vm.prank(address(0xBEEF));
        vm.expectRevert(
            abi.encodeWithSelector(ReceiptRegistry.AlreadyAnchored.selector, CHAT_ID_HASH)
        );
        registry.recordReceipt(CHAT_ID_HASH, keccak256("different-root"), PROVIDER, MODEL_HASH);
    }

    function test_recordReceipt_rejectsZeroChatIdHash() public {
        vm.expectRevert(ReceiptRegistry.ZeroChatIdHash.selector);
        registry.recordReceipt(bytes32(0), STORAGE_ROOT, PROVIDER, MODEL_HASH);
    }

    function test_recordReceipt_rejectsZeroStorageRoot() public {
        vm.expectRevert(ReceiptRegistry.ZeroStorageRootHash.selector);
        registry.recordReceipt(CHAT_ID_HASH, bytes32(0), PROVIDER, MODEL_HASH);
    }

    function test_recordReceipt_rejectsZeroProvider() public {
        vm.expectRevert(ReceiptRegistry.ZeroProvider.selector);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, address(0), MODEL_HASH);
    }

    function test_getAnchor_returnsStruct() public {
        vm.prank(issuer);
        registry.recordReceipt(CHAT_ID_HASH, STORAGE_ROOT, PROVIDER, MODEL_HASH);

        ReceiptRegistry.Anchor memory a = registry.getAnchor(CHAT_ID_HASH);
        assertEq(a.storageRootHash, STORAGE_ROOT);
        assertEq(a.provider, PROVIDER);
        assertEq(a.issuer, issuer);
        assertEq(a.modelHash, MODEL_HASH);
    }

    function testFuzz_recordReceipt_uniqueChatIds(
        bytes32 chatIdHashA,
        bytes32 chatIdHashB,
        bytes32 rootA,
        bytes32 rootB
    ) public {
        vm.assume(chatIdHashA != bytes32(0) && chatIdHashB != bytes32(0));
        vm.assume(rootA != bytes32(0) && rootB != bytes32(0));
        vm.assume(chatIdHashA != chatIdHashB);

        registry.recordReceipt(chatIdHashA, rootA, PROVIDER, MODEL_HASH);
        registry.recordReceipt(chatIdHashB, rootB, PROVIDER, MODEL_HASH);

        assertTrue(registry.isAnchored(chatIdHashA));
        assertTrue(registry.isAnchored(chatIdHashB));
    }
}
