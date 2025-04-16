// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol";

contract CarbonCreditNFTTest is Test {
    CarbonCreditNFT carbonNft;
    address deployer = address(this); // The test contract itself is the deployer
    address user1 = makeAddr("user1");
    address minter = makeAddr("minter");

    // Setup function runs before each test case
    function setUp() public {
        // Deploy the NFT contract, passing the deployer as the initial owner
        carbonNft = new CarbonCreditNFT(deployer);

        // Grant MINTER_ROLE to the minter address for testing minting
        carbonNft.grantRole(carbonNft.MINTER_ROLE(), minter);
    }

    // Test contract deployment and initial state
    function testDeployment() public {
        assertEq(carbonNft.name(), "Verifiable Carbon Credit", "Test Failed: Incorrect name");
        assertEq(carbonNft.symbol(), "VCC", "Test Failed: Incorrect symbol");
        assertEq(carbonNft.owner(), deployer, "Test Failed: Incorrect owner");

        // Check default admin role for deployer
        assertTrue(carbonNft.hasRole(carbonNft.DEFAULT_ADMIN_ROLE(), deployer), "Test Failed: Deployer should have admin role");
        // Check minter role initially granted to deployer
        assertTrue(carbonNft.hasRole(carbonNft.MINTER_ROLE(), deployer), "Test Failed: Deployer should have initial minter role");
        // Check minter role granted in setUp
        assertTrue(carbonNft.hasRole(carbonNft.MINTER_ROLE(), minter), "Test Failed: Minter should have minter role");
    }

    // Test minting functionality
    function testMinting() public {
        string memory tokenURI = "ipfs://example";
        uint256 expectedTokenId = 0;

        // Use vm.prank to simulate the transaction coming from the 'minter' address
        vm.prank(minter);
        uint256 tokenId = carbonNft.safeMint(user1, tokenURI);

        assertEq(tokenId, expectedTokenId, "Test Failed: Incorrect token ID minted");
        assertEq(carbonNft.ownerOf(tokenId), user1, "Test Failed: Incorrect owner after mint");
        assertEq(carbonNft.tokenURI(tokenId), tokenURI, "Test Failed: Incorrect token URI");
        assertEq(carbonNft.balanceOf(user1), 1, "Test Failed: Incorrect balance after mint");
    }

    // Test minting permissions - should fail if called by non-minter
    function testFail_MintWithoutRole() public {
        string memory tokenURI = "ipfs://exampleFail";

        // Expect a revert because user1 doesn't have MINTER_ROLE
        // Foundry typically expects specific error messages, but AccessControl uses codes.
        // We can expect any revert here initially.
        vm.expectRevert(); // Expecting a revert due to lack of role
        vm.prank(user1);
        carbonNft.safeMint(user1, tokenURI);
    }

    // Test internal burn function accessibility (it shouldn't be directly callable)
    // Note: Foundry cannot directly test internal functions easily unless they are exposed
    // via a public wrapper function in the contract (which we avoided).
    // We also cannot directly test the intended behavior where RetirementLogic calls _burn,
    // as that requires deploying RetirementLogic and setting permissions.
    // We will test the burn logic via RetirementLogic tests later.

    // Test setting token URI (implicitly tested in testMinting)

    // Test role management
    function testRoleManagement() public {
        address newMinter = makeAddr("newMinter");
        // Deployer (admin) grants MINTER_ROLE
        vm.prank(deployer);
        carbonNft.grantRole(carbonNft.MINTER_ROLE(), newMinter);
        assertTrue(carbonNft.hasRole(carbonNft.MINTER_ROLE(), newMinter), "Test Failed: Grant role failed");

        // Deployer (admin) revokes MINTER_ROLE
        vm.prank(deployer);
        carbonNft.revokeRole(carbonNft.MINTER_ROLE(), newMinter);
        assertFalse(carbonNft.hasRole(carbonNft.MINTER_ROLE(), newMinter), "Test Failed: Revoke role failed");
    }
} 