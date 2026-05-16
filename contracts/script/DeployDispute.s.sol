// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ReceiptDispute} from "../src/ReceiptDispute.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

contract DeployDispute is Script {
    function run() external returns (ReceiptDispute disp) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address receiptRegistry = vm.envAddress("SWORN_RECEIPT_REGISTRY");
        address revocationRegistry = vm.envAddress("SWORN_REVOCATION_REGISTRY");

        // Defaults: 0.01 OG min bond, 200-block window (~5 minutes on Galileo).
        uint256 bondMin = vm.envOr("SWORN_DISPUTE_BOND_MIN", uint256(0.01 ether));
        uint64 disputeWindow = uint64(vm.envOr("SWORN_DISPUTE_WINDOW", uint256(200)));

        console.log("Deployer:", deployer);
        console.log("ChainId:", block.chainid);
        console.log("ReceiptRegistry:", receiptRegistry);
        console.log("RevocationRegistry:", revocationRegistry);
        console.log("bondMin (wei):", bondMin);
        console.log("disputeWindow (blocks):", disputeWindow);

        vm.startBroadcast(deployerKey);
        disp = new ReceiptDispute(
            ReceiptRegistry(receiptRegistry),
            RevocationRegistry(revocationRegistry),
            bondMin,
            disputeWindow
        );
        vm.stopBroadcast();

        console.log("ReceiptDispute deployed at:", address(disp));

        string memory chainId = vm.toString(block.chainid);
        string memory path = string.concat("deployments/", chainId, "-dispute.json");
        string memory payload = string.concat(
            '{"chainId":', chainId,
            ',"dispute":"', vm.toString(address(disp)),
            '","registry":"', vm.toString(receiptRegistry),
            '","revocation":"', vm.toString(revocationRegistry),
            '","bondMin":"', vm.toString(bondMin),
            '","disputeWindow":', vm.toString(uint256(disputeWindow)),
            ',"deployer":"', vm.toString(deployer),
            '","block":', vm.toString(block.number),
            '}'
        );
        vm.writeFile(path, payload);
        console.log("Deployment record written to:", path);
    }
}
