// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {SwornReceiptInft} from "../src/SwornReceiptInft.sol";

contract SwornReceiptInftTest is Test {
    ReceiptRegistry internal reg;
    SwornReceiptInft internal inft;

    address internal issuer = address(0x1111);
    address internal mallory = address(0x2222);
    address internal provider = 0x69EbE4c002ec5e3f0e9C2be94C3Ae08000000000;

    bytes32 internal constant CHAT_HASH = keccak256("chat-1");
    bytes32 internal constant ROOT_HASH = keccak256("root-1");
    bytes32 internal constant MODEL_HASH = keccak256("gemma-3-27b-it");

    function setUp() public {
        reg = new ReceiptRegistry();
        inft = new SwornReceiptInft(reg);
        vm.prank(issuer);
        reg.recordReceipt(CHAT_HASH, ROOT_HASH, provider, MODEL_HASH);
    }

    function test_constructor() public {
        assertEq(address(inft.registry()), address(reg));
        assertEq(inft.name(), "Sworn Receipt");
        assertEq(inft.symbol(), "SWORN-R");
    }

    function test_mintFromReceipt_happyPath() public {
        uint256 expectedToken = uint256(CHAT_HASH);
        vm.expectEmit(true, true, true, true);
        emit SwornReceiptInft.Transfer(address(0), issuer, expectedToken);
        vm.prank(issuer);
        uint256 t = inft.mintFromReceipt(CHAT_HASH);
        assertEq(t, expectedToken);
        assertEq(inft.ownerOf(t), issuer);
    }

    function test_mintFromReceipt_anchorMissing() public {
        bytes32 unknown = keccak256("no-such-chat");
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(SwornReceiptInft.AnchorMissing.selector, unknown)
        );
        inft.mintFromReceipt(unknown);
    }

    function test_mintFromReceipt_notIssuerReverts() public {
        vm.prank(mallory);
        vm.expectRevert(
            abi.encodeWithSelector(SwornReceiptInft.NotIssuer.selector, mallory, issuer)
        );
        inft.mintFromReceipt(CHAT_HASH);
    }

    function test_mintFromReceipt_duplicateReverts() public {
        vm.prank(issuer);
        inft.mintFromReceipt(CHAT_HASH);
        vm.prank(issuer);
        vm.expectRevert(
            abi.encodeWithSelector(SwornReceiptInft.AlreadyMinted.selector, CHAT_HASH)
        );
        inft.mintFromReceipt(CHAT_HASH);
    }

    function test_transferReverts() public {
        vm.prank(issuer);
        uint256 t = inft.mintFromReceipt(CHAT_HASH);
        vm.expectRevert(SwornReceiptInft.Soulbound.selector);
        inft.transferFrom(issuer, mallory, t);
        vm.expectRevert(SwornReceiptInft.Soulbound.selector);
        inft.safeTransferFrom(issuer, mallory, t);
        vm.expectRevert(SwornReceiptInft.Soulbound.selector);
        inft.approve(mallory, t);
    }

    function test_tokenURI_includesChatIdHashHex() public {
        vm.prank(issuer);
        uint256 t = inft.mintFromReceipt(CHAT_HASH);
        string memory uri = inft.tokenURI(t);
        // Must be of the form ".../r/_byhash?h=0x<hex>"
        bytes memory uriBytes = bytes(uri);
        assertGt(uriBytes.length, 50);
        // Check the prefix.
        bytes memory prefix = bytes("https://yonkoo11.github.io/sworn/r/_byhash?h=0x");
        for (uint256 i = 0; i < prefix.length; i++) {
            assertEq(uriBytes[i], prefix[i]);
        }
    }

    function test_supportsInterface_ERC165andERC721() public {
        assertTrue(inft.supportsInterface(0x01ffc9a7)); // ERC-165
        assertTrue(inft.supportsInterface(0x80ac58cd)); // ERC-721
        assertTrue(inft.supportsInterface(0x5b5e139f)); // metadata
        assertFalse(inft.supportsInterface(0xdeadbeef));
    }

    function test_balanceOf_revertsNotImplemented() public {
        vm.expectRevert();
        inft.balanceOf(issuer);
    }
}
