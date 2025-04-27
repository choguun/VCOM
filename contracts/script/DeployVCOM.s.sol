// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {Vm} from "forge-std/Vm.sol";

// Import your contracts (adjust paths as needed)
import {FTSOReader} from "../src/FTSOReader.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol";
import {RewardNFT} from "../src/RewardNFT.sol";
import {RetirementLogic} from "../src/RetirementLogic.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {UserActions} from "../src/UserActions.sol";
import {EvidenceEmitter} from "../src/EvidenceEmitter.sol";
// Import interfaces if needed (e.g., AccessControl)
// import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol"; // Might not be needed if RewardNFT doesn't use it

contract DeployVCOM is Script {

    // --- Removed FTSO System Address Constants ---

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log("Deployer Address:", deployerAddress);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy FTSOReader (constructor now takes no arguments)
        FTSOReader ftsoReader = new FTSOReader(); 
        console.log("FTSOReader deployed at:", address(ftsoReader));

        // 2. Deploy EvidenceEmitter (Owner = Deployer/Attestation Provider)
        EvidenceEmitter evidenceEmitter = new EvidenceEmitter(deployerAddress);
        console.log("EvidenceEmitter deployed at:", address(evidenceEmitter));

        // 3. Deploy UserActions (Pass deployer and emitter address)
        UserActions userActions = new UserActions(
            deployerAddress, 
            deployerAddress, // Assuming deployer is also initial direct verifier
            address(evidenceEmitter) // Pass the deployed emitter address
        );
        console.log("UserActions deployed at:", address(userActions));

        // 4. Deploy CarbonCreditNFT (Adjust numbering, needs UserActions address)
        CarbonCreditNFT carbonNft = new CarbonCreditNFT(deployerAddress, address(userActions));
        console.log("CarbonCreditNFT deployed at:", address(carbonNft));

        // 5. Deploy RewardNFT *before* RetirementLogic (Adjust numbering)
        RewardNFT rewardNft = new RewardNFT(deployerAddress, address(0)); 
        console.log("RewardNFT deployed at:", address(rewardNft));

        // 6. Deploy RetirementLogic (Adjust numbering, now has rewardNft address)
        RetirementLogic retirementLogic = new RetirementLogic(
            deployerAddress,
            address(carbonNft),
            address(rewardNft)
        );
        console.log("RetirementLogic deployed at:", address(retirementLogic));

        // 7. Deploy Marketplace (Adjust numbering)
        Marketplace marketplace = new Marketplace(address(carbonNft));
        console.log("Marketplace deployed at:", address(marketplace));

        // --- Post-Deployment Setup ---
        // Grant necessary roles if constructors didn't handle it.
        // Example: If RewardNFT minter needs to be RetirementLogic, and constructor didn't set it:
        // bytes32 minterRole = keccak256("MINTER_ROLE");
        // bool hasRole = rewardNft.hasRole(minterRole, address(retirementLogic));
        // if (!hasRole) {
        //    // Assuming rewardNft uses AccessControl and deployer is ADMIN
        //    rewardNft.grantRole(minterRole, address(retirementLogic));
        //    console.log("Granted MINTER_ROLE on RewardNFT to RetirementLogic");
        // } else {
        //    console.log("RetirementLogic already has MINTER_ROLE on RewardNFT");
        // }
        // Add similar checks/grants for other roles as needed.

        // Set retirement logic address in CarbonCreditNFT & RewardNFT
        carbonNft.setRetirementContract(address(retirementLogic));
        rewardNft.setRetirementLogicAddress(address(retirementLogic));
        
        vm.stopBroadcast();

        console.log("\n--- Deployment Summary ---");
        console.log("FTSOReader:", address(ftsoReader));
        console.log("EvidenceEmitter:", address(evidenceEmitter));
        console.log("CarbonCreditNFT:", address(carbonNft));
        console.log("RewardNFT:", address(rewardNft));
        console.log("RetirementLogic:", address(retirementLogic));
        console.log("Marketplace:", address(marketplace));
        console.log("UserActions:", address(userActions));
        console.log("------------------------\n");
        // console.log("Review contract constructors and roles setup (RewardNFT Minter?).");
    }
} 