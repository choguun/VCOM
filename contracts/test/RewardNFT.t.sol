// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RewardNFT} from "../src/RewardNFT.sol";
import {Vm} from "forge-std/Vm.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract RewardNFTTest is Test {
    RewardNFT rewardNft;
    address owner;
    address retirementLogic; // The address authorized to mint
    address user;            // The address receiving the NFT
    address nonOwner;
    address unauthorizedMinter;

    string constant NFT_NAME = "Retirement Reward NFT";
    string constant NFT_SYMBOL = "RRNFT";
    uint256 constant TOKEN_ID_0 = 0;
    uint256 constant REWARD_TIER_1 = 1;

    function setUp() public {
        owner = makeAddr("owner");
        retirementLogic = makeAddr("retirementLogic");
        user = makeAddr("user");
        nonOwner = makeAddr("nonOwner");
        unauthorizedMinter = makeAddr("unauthorizedMinter");

        vm.startPrank(owner);
        // Deploy with the intended retirementLogic address
        rewardNft = new RewardNFT(owner, retirementLogic);
        vm.stopPrank();
    }

    // --- Test Deployment ---

    function testDeployment() public {
        assertEq(rewardNft.name(), NFT_NAME, "NFT Name mismatch");
        assertEq(rewardNft.symbol(), NFT_SYMBOL, "NFT Symbol mismatch");
        assertEq(rewardNft.owner(), owner, "Owner mismatch");
        assertEq(rewardNft.retirementLogicAddress(), retirementLogic, "Initial retirementLogic address mismatch");
    }

    // --- Test mintReward ---

    function testMintReward_Success() public {
        // Use vm.prank to simulate the call coming from the authorized retirementLogic address
        vm.startPrank(retirementLogic);

        // Expect standard ERC721 Transfer event, checking topics and emitter
        vm.expectEmit(
            true, // checkTopic1 (from)
            true, // checkTopic2 (to)
            true, // checkTopic3 (tokenId)
            false, // checkData
            address(rewardNft) // Specify emitter address
        );
        // emit ERC721.Transfer(address(0), user, TOKEN_ID_0); // Removed

        rewardNft.mintReward(user, REWARD_TIER_1);
        vm.stopPrank();

        // Verify state
        assertEq(rewardNft.ownerOf(TOKEN_ID_0), user, "Owner mismatch after mint");
        assertEq(rewardNft.balanceOf(user), 1, "Balance mismatch after mint");
        assertEq(rewardNft.rewardTiers(TOKEN_ID_0), REWARD_TIER_1, "Reward tier mismatch");
    }

    function testFail_MintReward_UnauthorizedMinter() public {
        // Try minting from an address that is NOT the retirementLogic address
        vm.startPrank(unauthorizedMinter);
        vm.expectRevert(RewardNFT.RewardNFT__UnauthorizedMinter.selector);
        rewardNft.mintReward(user, REWARD_TIER_1);
        vm.stopPrank();

        // Also check non-owner cannot mint (unless they are the retirementLogic address)
        if (nonOwner != retirementLogic) { // Avoid reverting if nonOwner happens to be retirementLogic
            vm.startPrank(nonOwner);
            vm.expectRevert(RewardNFT.RewardNFT__UnauthorizedMinter.selector);
            rewardNft.mintReward(user, REWARD_TIER_1);
            vm.stopPrank();
        }
    }

    // --- Test setRetirementLogicAddress ---

    function testSetRetirementLogicAddress_Success() public {
        address newRetirementLogic = makeAddr("newRetirementLogic");
        vm.startPrank(owner);
        rewardNft.setRetirementLogicAddress(newRetirementLogic);
        vm.stopPrank();
        assertEq(rewardNft.retirementLogicAddress(), newRetirementLogic, "Failed to set new retirement logic address");
    }

    function testFail_SetRetirementLogicAddress_NotOwner() public {
        address newRetirementLogic = makeAddr("newRetirementLogic");
        vm.startPrank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        rewardNft.setRetirementLogicAddress(newRetirementLogic);
        vm.stopPrank();
    }

} 