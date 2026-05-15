// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";

/// @notice Deploys RevocationRegistry alongside ReceiptRegistry.
contract DeployRevocation is Script {
    function run() external returns (RevocationRegistry reg) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer:", deployer);
        console.log("ChainId:", block.chainid);

        vm.startBroadcast(deployerKey);
        reg = new RevocationRegistry();
        vm.stopBroadcast();

        console.log("RevocationRegistry deployed at:", address(reg));

        string memory chainId = vm.toString(block.chainid);
        string memory path = string.concat("deployments/", chainId, "-revocation.json");
        string memory payload = string.concat(
            '{"chainId":', chainId,
            ',"revocation":"', vm.toString(address(reg)),
            '","deployer":"', vm.toString(deployer),
            '","block":', vm.toString(block.number),
            '}'
        );
        vm.writeFile(path, payload);
        console.log("Deployment record written to:", path);
    }
}
