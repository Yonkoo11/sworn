// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CommitReveal} from "../src/CommitReveal.sol";

contract DeployCommitReveal is Script {
    function run() external returns (CommitReveal cr) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        console.log("Deployer:", deployer);
        console.log("ChainId:", block.chainid);

        vm.startBroadcast(deployerKey);
        cr = new CommitReveal();
        vm.stopBroadcast();

        console.log("CommitReveal deployed at:", address(cr));

        string memory chainId = vm.toString(block.chainid);
        string memory path = string.concat("deployments/", chainId, "-commitreveal.json");
        string memory payload = string.concat(
            '{"chainId":', chainId,
            ',"commitReveal":"', vm.toString(address(cr)),
            '","deployer":"', vm.toString(deployer),
            '","block":', vm.toString(block.number),
            '}'
        );
        vm.writeFile(path, payload);
        console.log("Deployment record written to:", path);
    }
}
