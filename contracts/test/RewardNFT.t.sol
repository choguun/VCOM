// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RewardNFT} from "../src/RewardNFT.sol";
import {Vm} from "forge-std/Vm.sol";

contract RewardNFTTest is Test {
    RewardNFT rewardNft;
    address deployer = address(this);
    address user = makeAddr("user");
    address retirementLogicAddress = makeAddr("retirementLogic"); // Mock address
    address otherAddress = makeAddr("other");

    function setUp() public {
        // Deploy RewardNFT, setting retirementLogicAddress during deployment
        rewardNft = new RewardNFT(deployer, retirementLogicAddress);
    }

    function testDeployment() public {
        assertEq(rewardNft.name(), "Retirement Reward NFT", "Test Fail: Incorrect name");
        assertEq(rewardNft.symbol(), "RRNFT", "Test Fail: Incorrect symbol");
        assertEq(rewardNft.owner(), deployer, "Test Fail: Incorrect owner");
        assertEq(rewardNft.retirementLogicAddress(), retirementLogicAddress, "Test Fail: Incorrect retirement logic address");
    }

    function testMintReward_success() public {
        uint256 rewardTier = 1;
        uint256 expectedTokenId = 0;

        // Prank as the authorized retirementLogicAddress
        vm.startPrank(retirementLogicAddress);
        rewardNft.mintReward(user, rewardTier);
        vm.stopPrank();

        assertEq(rewardNft.balanceOf(user), 1, "User balance should be 1");
        assertEq(rewardNft.ownerOf(expectedTokenId), user, "Incorrect token owner");
        assertEq(rewardNft.rewardTiers(expectedTokenId), rewardTier, "Incorrect reward tier stored");
    }

    function testFail_MintReward_unauthorized() public {
         uint256 rewardTier = 1;
         // Try minting from an unauthorized address
         vm.startPrank(otherAddress);
         vm.expectRevert(RewardNFT.RewardNFT__UnauthorizedMinter.selector);
         rewardNft.mintReward(user, rewardTier);
         vm.stopPrank();
    }

    function testSetRetirementLogicAddress() public {
        address newLogicAddress = makeAddr("newLogic");
        // Only owner (deployer) can set it
        vm.prank(deployer);
        rewardNft.setRetirementLogicAddress(newLogicAddress);
        assertEq(rewardNft.retirementLogicAddress(), newLogicAddress, "Failed to set new retirement logic address");
    }

    function testFail_SetRetirementLogicAddress_notOwner() public {
        address newLogicAddress = makeAddr("newLogic");
        // Non-owner tries to set
        vm.startPrank(otherAddress);
        vm.expectRevert("Ownable: caller is not the owner"); // Standard Ownable error
        rewardNft.setRetirementLogicAddress(newLogicAddress);
        vm.stopPrank();
    }
} 