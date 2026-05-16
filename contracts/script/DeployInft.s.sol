// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SwornReceiptInft} from "../src/SwornReceiptInft.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";

contract DeployInft is Script {
    function run() external returns (SwornReceiptInft inft) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address registry = vm.envAddress("SWORN_RECEIPT_REGISTRY");
        console.log("Deployer:", deployer);
        console.log("ChainId:", block.chainid);
        console.log("Registry:", registry);

        vm.startBroadcast(deployerKey);
        inft = new SwornReceiptInft(ReceiptRegistry(registry));
        vm.stopBroadcast();

        console.log("SwornReceiptInft deployed at:", address(inft));

        string memory chainId = vm.toString(block.chainid);
        string memory path = string.concat("deployments/", chainId, "-inft.json");
        string memory payload = string.concat(
            '{"chainId":', chainId,
            ',"inft":"', vm.toString(address(inft)),
            '","registry":"', vm.toString(registry),
            '","deployer":"', vm.toString(deployer),
            '","block":', vm.toString(block.number),
            '}'
        );
        vm.writeFile(path, payload);
        console.log("Deployment record written to:", path);
    }
}
