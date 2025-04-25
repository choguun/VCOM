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
// Import interfaces if needed (e.g., AccessControl)
// import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol"; // Might not be needed if RewardNFT doesn't use it

contract DeployVCOM is Script {

    // --- Constants for Coston2 (Replace with actual addresses) ---
    address constant FLARE_FTSO_REGISTRY = 0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019;
    address constant FLARE_RNG_PROVIDER = 0x5CdF9eAF3EB8b44fB696984a1420B56A7575D250;
    // -------------------------------------------------------------

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log("Deployer Address:", deployerAddress);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy FTSOReader
        FTSOReader ftsoReader = new FTSOReader(FLARE_FTSO_REGISTRY);
        console.log("FTSOReader deployed at:", address(ftsoReader));

        // 2. Deploy CarbonCreditNFT
        // Assuming initialOwner. VERIFY THIS!
        CarbonCreditNFT carbonNft = new CarbonCreditNFT(deployerAddress);
        console.log("CarbonCreditNFT deployed at:", address(carbonNft));

        // 3. Deploy RewardNFT *before* RetirementLogic
        // Compiler requires 2 address args. Assuming (initialOwner, carbonNftAddress). **VERIFY THIS!**
        RewardNFT rewardNft = new RewardNFT(deployerAddress, address(carbonNft));
        console.log("RewardNFT deployed at:", address(rewardNft));

        // 4. Deploy RetirementLogic (Now has rewardNft address)
        // ** VERIFY RetirementLogic CONSTRUCTOR ARGUMENTS! **
        RetirementLogic retirementLogic = new RetirementLogic(
            address(carbonNft),
            address(rewardNft), // Pass actual rewardNft address
            FLARE_RNG_PROVIDER
        );
        console.log("RetirementLogic deployed at:", address(retirementLogic));

        // 5. Deploy Marketplace
        Marketplace marketplace = new Marketplace(address(carbonNft));
        console.log("Marketplace deployed at:", address(marketplace));

        // 6. Deploy UserActions
        // Compiler requires 2 constructor args. Using deployerAddress for both. **VERIFY UserActions CONSTRUCTOR ARGUMENTS!**
        UserActions userActions = new UserActions(deployerAddress, deployerAddress);
        console.log("UserActions deployed at:", address(userActions));

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

        vm.stopBroadcast();

        console.log("\n--- Deployment Summary ---");
        console.log("FTSOReader:", address(ftsoReader));
        console.log("CarbonCreditNFT:", address(carbonNft));
        console.log("RewardNFT:", address(rewardNft)); // Deployed before RetirementLogic
        console.log("RetirementLogic:", address(retirementLogic));
        console.log("Marketplace:", address(marketplace));
        console.log("UserActions:", address(userActions));
        console.log("------------------------\n");
        // console.log("Review contract constructors and roles setup (RewardNFT Minter?).");
    }
} 