// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ReceiptRegistry} from "../src/ReceiptRegistry.sol";

/// @notice Deploys ReceiptRegistry to the current --rpc-url network.
/// @dev Usage:
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url galileo \
///     --private-key $PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    function run() external returns (ReceiptRegistry registry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer:", deployer);
        console.log("ChainId:", block.chainid);

        vm.startBroadcast(deployerKey);
        registry = new ReceiptRegistry();
        vm.stopBroadcast();

        console.log("ReceiptRegistry deployed at:", address(registry));

        // Write deployment record to deployments/<chainId>.json
        string memory chainId = vm.toString(block.chainid);
        string memory path = string.concat("deployments/", chainId, ".json");
        string memory payload = string.concat(
            '{"chainId":', chainId,
            ',"registry":"', vm.toString(address(registry)),
            '","deployer":"', vm.toString(deployer),
            '","block":', vm.toString(block.number),
            '}'
        );
        vm.writeFile(path, payload);
        console.log("Deployment record written to:", path);
    }
}
