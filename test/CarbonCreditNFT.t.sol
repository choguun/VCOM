// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Base64} from "openzeppelin-contracts/utils/Base64.sol";

// Mock UserActions Interface (only needed function)
interface MockUserActions {
    function lastActionTimestamp(address user, bytes32 actionType) external view returns (uint256);
}

// Simple Mock UserActions contract for testing
contract MockUserActionsContract is MockUserActions {
    mapping(address => mapping(bytes32 => uint256)) public timestamps;
    function lastActionTimestamp(address user, bytes32 actionType) external view returns (uint256) {
        return timestamps[user][actionType];
    }
    function setTimestamp(address user, bytes32 actionType, uint256 timestamp) external {
        timestamps[user][actionType] = timestamp;
    }
}

contract CarbonCreditNFTTest is Test {
    CarbonCreditNFT public carbonNft;
    address public owner = address(0x1); // Using a specific address for owner
    address public user1 = address(0x2);
    address public user2 = address(0x3);
    address public retirementContract = address(0x4);
    MockUserActionsContract public mockUserActions; // Mock contract instance

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ACTION_TYPE_TRANSPORT_B32 = keccak256(abi.encodePacked("SUSTAINABLE_TRANSPORT_KM"));

    function setUp() public {
        // Use owner address for deployment
        mockUserActions = new MockUserActionsContract(); // Deploy the mock
        carbonNft = new CarbonCreditNFT(owner, address(mockUserActions)); 
        vm.label(owner, "Owner");
        vm.label(user1, "User1");
        // Add missing labels if desired
        // vm.label(user2, "User2"); 
        // vm.label(retirementContract, "Retirement Contract");
    }

    // --- Test Claiming --- 

    function test_claimTransportNFT_Success() public {
        // Setup: Grant minter role if needed (already owner), set user actions
        // carbonNft.setUserActionsContract(address(mockUserActions)); // Already set in constructor

        // 1. Record action in mock contract
        uint256 actionTime = block.timestamp - 1 days;
        mockUserActions.setTimestamp(user1, ACTION_TYPE_TRANSPORT_B32, actionTime);

        // 2. User1 claims
        vm.prank(user1);
        carbonNft.claimTransportNFT();

        // Assert: NFT minted to user1, claim timestamp updated
        assertEq(carbonNft.balanceOf(user1), 1, "User1 should have 1 NFT after claim");
        uint256 tokenId = carbonNft.tokenOfOwnerByIndex(user1, 0);
        assertTrue(carbonNft.transportNFTClaimedTimestamp(user1) > actionTime, "Claim timestamp not updated correctly");

        // Verify token URI (basic check)
        string memory uri = carbonNft.tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0, "Token URI is empty");
        console.log("Claimed NFT URI:", uri);
    }

    function test_claimTransportNFT_Fail_NoActionRecorded() public {
        vm.prank(user1);
        vm.expectRevert(CarbonCreditNFT.CarbonCreditNFT__ActionNotVerified.selector);
        carbonNft.claimTransportNFT();
    }

    function test_claimTransportNFT_Fail_AlreadyClaimed() public {
        // Record action
        uint256 actionTime = block.timestamp - 1 days;
        mockUserActions.setTimestamp(user1, ACTION_TYPE_TRANSPORT_B32, actionTime);

        // Claim once
        vm.prank(user1);
        carbonNft.claimTransportNFT();
        uint256 firstClaimTimestamp = carbonNft.transportNFTClaimedTimestamp(user1);
        assertTrue(firstClaimTimestamp > 0);

        // Try to claim again without new action
        vm.prank(user1);
        vm.expectRevert(CarbonCreditNFT.CarbonCreditNFT__AlreadyClaimed.selector);
        carbonNft.claimTransportNFT();

        // Record NEW action
         uint256 newActionTime = block.timestamp - 1 hours;
         mockUserActions.setTimestamp(user1, ACTION_TYPE_TRANSPORT_B32, newActionTime);

        // Claim again (should succeed)
        vm.prank(user1);
        carbonNft.claimTransportNFT();
        assertTrue(carbonNft.transportNFTClaimedTimestamp(user1) > firstClaimTimestamp, "Second claim failed");
        assertEq(carbonNft.balanceOf(user1), 2, "User should have 2 NFTs after second claim");
    }

    function test_claimTransportNFT_Fail_UserActionsNotSet() public {
        // Deploy new NFT without UserActions set (use address(0))
        CarbonCreditNFT nftNoUserActions = new CarbonCreditNFT(owner, address(0));
        vm.prank(user1);
        vm.expectRevert(CarbonCreditNFT.CarbonCreditNFT__UserActionsNotSet.selector);
        nftNoUserActions.claimTransportNFT();
    }
}