// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {RetirementLogic} from "../src/RetirementLogic.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol"; 
import {RewardNFT} from "../src/RewardNFT.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// import {RandomNumberV2Interface} from "flare-foundry-periphery-package/src/flare/RandomNumberV2Interface.sol"; // Import RNG interface
import {RandomNumberV2Interface} from "flare-foundry-periphery-package/flare/RandomNumberV2Interface.sol"; // Adjusted import path based on remapping

// --- Mock RNG Contract ---
contract MockRandomNumberV2 is RandomNumberV2Interface {
    uint256 public mockRandomNumber = 1234567890; // Default mock number
    bool public mockIsSecure = true;
    uint256 public mockTimestamp = block.timestamp;

    function getRandomNumber()
        external view
        returns (
            uint256 _randomNumber,
            bool _isSecureRandom,
            uint256 _randomTimestamp
        )
    {
        return (mockRandomNumber, mockIsSecure, mockTimestamp);
    }

    function getRandomNumberHistorical(uint256 _votingRoundId) 
        external view 
        returns (uint256, bool, uint256) 
    { 
        // Not needed for current tests, revert or return default 
        revert("MockRandomNumberV2: getRandomNumberHistorical not implemented");
    }
    
    // Helper functions to control mock behavior
    function setMockValues(uint256 _number, bool _isSecure) external {
        mockRandomNumber = _number;
        mockIsSecure = _isSecure;
        mockTimestamp = block.timestamp;
    }
}

// --- Test Contract ---
contract RetirementLogicTest is Test {
    // Contracts
    RetirementLogic retirementLogic;
    CarbonCreditNFT carbonNft;
    RewardNFT rewardNft;
    MockRandomNumberV2 mockRng; // Use the mock RNG

    // Users
    address deployer = address(this); // Keep deployer for potential future use
    address owner; // Owner of the contracts
    address user;

    // Constants
    uint256 constant NFT_ID_TO_RETIRE = 0;
    uint256 constant TOKEN_ID_0 = 0; // Add constant for expected reward token ID

    function setUp() public {
        // Create users
        owner = makeAddr("owner");
        user = makeAddr("user");

        // Deploy contracts
        vm.startPrank(owner);
        
        carbonNft = new CarbonCreditNFT(owner);
        rewardNft = new RewardNFT(owner, address(0)); 
        retirementLogic = new RetirementLogic(owner, address(carbonNft), address(rewardNft));
        mockRng = new MockRandomNumberV2(); // Deploy the mock RNG

        // --- Overwrite hardcoded RNG address in RetirementLogic using vm.store ---
        // 1. Find the storage slot for randomNumberV2Address (it's the first state variable after Ownable)
        // Ownable uses 1 slot (owner). ReentrancyGuard uses 1 slot (_status).
        // randomNumberV2Address is the 3rd variable = slot 2 (0-indexed)
        bytes32 slot = bytes32(uint256(2)); 
        // 2. Store the mockRng address in that slot for the retirementLogic instance
        vm.store(address(retirementLogic), slot, bytes32(uint256(uint160(address(mockRng)))));
        // Verify the overwrite worked (optional but good practice)
        // assertEq(bytes32(uint256(uint160(retirementLogic.randomNumberV2Address()))), bytes32(uint256(uint160(address(mockRng)))));
        // Note: Direct reading of immutable might not work easily, but vm.load can check the slot value

        // Set authorized addresses
        carbonNft.setRetirementContract(address(retirementLogic));
        rewardNft.setRetirementLogicAddress(address(retirementLogic));
        
        // Mint an NFT to the user 
        carbonNft.safeMint(user, "ipfs://some_uri"); 
        
        vm.stopPrank();
    }

    // --- retireNFT Tests ---

    // function testRetireNFT_Success() public { ... } // Keep commented for now
    function testRetireNFT_Success_Tier0Reward() public {
        // Set mock RNG to return a specific number resulting in tier 0 (e.g., number >= 10)
        // and ensure it's marked secure
        uint256 mockRandomNum = 50; // Example number >= 10
        uint256 expectedRewardTier = 0;
        mockRng.setMockValues(mockRandomNum, true);
        uint256 expectedTimestamp = mockRng.mockTimestamp(); // Get timestamp set by mock

        // User approves RetirementLogic contract
        vm.startPrank(user);
        carbonNft.approve(address(retirementLogic), NFT_ID_TO_RETIRE);

        // --- Set Expectations BEFORE the call ---
        vm.expectEmit(true, true, true, false); 
        emit RetirementLogic.NFTRetired(user, NFT_ID_TO_RETIRE, expectedRewardTier, mockRandomNum, expectedTimestamp);

        // Expect standard ERC721 Transfer event from RewardNFT upon minting
        vm.expectEmit(true, true, true, false, address(rewardNft)); // Check topics and emitter

        // --- Call the function ---
        retirementLogic.retireNFT(NFT_ID_TO_RETIRE);
        vm.stopPrank();

        // --- Assertions AFTER the call ---
        vm.expectRevert(); // Simple revert check
        carbonNft.ownerOf(NFT_ID_TO_RETIRE); // Verify Carbon NFT is burned

        assertEq(rewardNft.balanceOf(user), 1, "Reward NFT should be minted");
        assertEq(rewardNft.ownerOf(TOKEN_ID_0), user, "Reward NFT owner mismatch");
        assertEq(rewardNft.rewardTiers(TOKEN_ID_0), expectedRewardTier, "Reward tier mismatch");
    }

    function testRetireNFT_Success_Tier1Reward() public {
        // Set mock RNG to return a specific number resulting in tier 1 (e.g., number < 10)
        uint256 mockRandomNum = 5; // Example number < 10
        uint256 expectedRewardTier = 1;
        mockRng.setMockValues(mockRandomNum, true);
         uint256 expectedTimestamp = mockRng.mockTimestamp();

        vm.startPrank(user);
        carbonNft.approve(address(retirementLogic), NFT_ID_TO_RETIRE);

        vm.expectEmit(true, true, true, false);
        emit RetirementLogic.NFTRetired(user, NFT_ID_TO_RETIRE, expectedRewardTier, mockRandomNum, expectedTimestamp);
        vm.expectEmit(true, true, true, false, address(rewardNft)); // Check topics and emitter

        retirementLogic.retireNFT(NFT_ID_TO_RETIRE);
        vm.stopPrank();

        vm.expectRevert(); // Simple revert check
        carbonNft.ownerOf(NFT_ID_TO_RETIRE);
        assertEq(rewardNft.balanceOf(user), 1);
        assertEq(rewardNft.ownerOf(TOKEN_ID_0), user);
        assertEq(rewardNft.rewardTiers(TOKEN_ID_0), expectedRewardTier);
    }


    function testFail_RetireNFT_RngNotSecure() public {
        // Set mock RNG to return isSecure = false
        mockRng.setMockValues(12345, false);

        vm.startPrank(user);
        carbonNft.approve(address(retirementLogic), NFT_ID_TO_RETIRE);

        vm.expectRevert(RetirementLogic.RetirementLogic__RngNotSecure.selector);
        retirementLogic.retireNFT(NFT_ID_TO_RETIRE);
        vm.stopPrank();

        // Verify Carbon NFT was NOT burned
        assertEq(carbonNft.ownerOf(NFT_ID_TO_RETIRE), user, "Carbon NFT should not have been burned");
        // Verify Reward NFT was NOT minted
         assertEq(rewardNft.balanceOf(user), 0, "Reward NFT should not have been minted");
    }

    function testRetireNFT_RevertIf_NotOwner() public {
        vm.startPrank(owner); // Use owner who is not the NFT holder
        vm.expectRevert(RetirementLogic.RetirementLogic__NotNFTOwner.selector);
        retirementLogic.retireNFT(NFT_ID_TO_RETIRE);
        vm.stopPrank();
    }

    // --- receiveRandomNumber Tests (Removed as callback is removed) ---
} 