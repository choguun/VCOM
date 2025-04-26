// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol";
import {Vm} from "forge-std/Vm.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract CarbonCreditNFTTest is Test {
    CarbonCreditNFT carbonNft;
    address owner;
    address minter;
    address user;
    address retirementContract;
    address nonOwner;

    string constant NFT_NAME = "Verifiable Carbon Credit";
    string constant NFT_SYMBOL = "VCC";
    string constant TEST_URI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    uint256 constant TOKEN_ID_0 = 0;

    function setUp() public {
        owner = makeAddr("owner");
        minter = makeAddr("minter"); // Separate minter for testing roles
        user = makeAddr("user");
        retirementContract = makeAddr("retirementContract");
        nonOwner = makeAddr("nonOwner");

        vm.startPrank(owner);
        carbonNft = new CarbonCreditNFT(owner, address(0));
        // Grant minter role to the 'minter' address for testing
        carbonNft.grantRole(carbonNft.MINTER_ROLE(), minter);
        // Set the authorized retirement contract address
        carbonNft.setRetirementContract(retirementContract);
        vm.stopPrank();
    }

    // --- Test Deployment ---

    function testDeployment() public {
        assertEq(carbonNft.name(), NFT_NAME, "NFT Name mismatch");
        assertEq(carbonNft.symbol(), NFT_SYMBOL, "NFT Symbol mismatch");
        assertEq(carbonNft.owner(), owner, "Owner mismatch");
        assertTrue(carbonNft.hasRole(carbonNft.DEFAULT_ADMIN_ROLE(), owner), "Owner should have admin role");
        assertTrue(carbonNft.hasRole(carbonNft.MINTER_ROLE(), owner), "Owner should have minter role");
        assertTrue(carbonNft.hasRole(carbonNft.MINTER_ROLE(), minter), "Minter address should have minter role");
        assertEq(carbonNft.retirementContractAddress(), retirementContract, "Retirement contract address mismatch");
    }

    // --- Test safeMint ---

    function testMint_Success() public {
        vm.startPrank(minter); // Use authorized minter address

        // Expect standard ERC721 Transfer event, checking topics and emitter
        vm.expectEmit(
            true, // checkTopic1 (from = address(0))
            true, // checkTopic2 (to = user)
            true, // checkTopic3 (tokenId = TOKEN_ID_0)
            false, // checkData
            address(carbonNft) // Specify emitter address
        );

        uint256 tokenId = carbonNft.safeMint(user, TEST_URI);
        vm.stopPrank();

        assertEq(tokenId, TOKEN_ID_0, "Incorrect tokenId minted");
        assertEq(carbonNft.ownerOf(TOKEN_ID_0), user, "Owner mismatch after mint");
        assertEq(carbonNft.balanceOf(user), 1, "Balance mismatch after mint");
        assertEq(carbonNft.tokenURI(TOKEN_ID_0), TEST_URI, "Token URI mismatch");
    }

    function testFail_Mint_NotMinter() public {
        vm.startPrank(nonOwner); // Address without MINTER_ROLE
        // Expect revert from AccessControl: AccessControlUnauthorizedAccount(address account, bytes32 neededRole)
        bytes32 minterRole = carbonNft.MINTER_ROLE();
        // vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorizedAccount.selector, nonOwner, minterRole));
        // vm.expectRevert(bytes(string(abi.encodePacked("AccessControlUnauthorizedAccount(", abi.encode(nonOwner), ",", abi.encode(minterRole), ")"))));
        vm.expectRevert(); // Simple revert check for now
        carbonNft.safeMint(user, TEST_URI);
        vm.stopPrank();
    }

    // --- Test setRetirementContract ---

    function testSetRetirementContract_Success() public {
        address newRetirementContract = makeAddr("newRetirementContract");
        vm.startPrank(owner);
        vm.expectEmit(true, false, false, false); // Check indexed retirementContract
        emit CarbonCreditNFT.RetirementContractSet(newRetirementContract);
        carbonNft.setRetirementContract(newRetirementContract);
        vm.stopPrank();
        assertEq(carbonNft.retirementContractAddress(), newRetirementContract, "Failed to set new retirement contract");
    }

    function testFail_SetRetirementContract_NotOwner() public {
        address newRetirementContract = makeAddr("newRetirementContract");
        vm.startPrank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        carbonNft.setRetirementContract(newRetirementContract);
        vm.stopPrank();
    }

    // --- Test burnForRetirement ---

    function testBurn_Success() public {
        // 1. Mint a token first
        vm.startPrank(minter);
        carbonNft.safeMint(user, TEST_URI); // Mints tokenId 0
        vm.stopPrank();
        assertEq(carbonNft.ownerOf(TOKEN_ID_0), user); // Verify mint

        // 2. Call burn from the authorized retirement contract address
        vm.startPrank(retirementContract);
        vm.expectEmit(
            true, // checkTopic1 (from = user)
            true, // checkTopic2 (to = address(0))
            true, // checkTopic3 (tokenId = TOKEN_ID_0)
            false, // checkData
            address(carbonNft) // Specify emitter address
        );
        carbonNft.burnForRetirement(TOKEN_ID_0);
        vm.stopPrank();

        // 3. Verify burn
        assertEq(carbonNft.balanceOf(user), 0, "Balance should be zero after burn");
        vm.expectRevert(); // Simple revert check for now (for ownerOf on non-existent token)
        carbonNft.ownerOf(TOKEN_ID_0);
    }

     function testFail_Burn_NotAuthorizedContract() public {
        // 1. Mint a token first
        vm.startPrank(minter);
        carbonNft.safeMint(user, TEST_URI); // Mints tokenId 0
        vm.stopPrank();

        // 2. Try to call burn from an unauthorized address (e.g., the user themselves)
        vm.startPrank(user);
        vm.expectRevert(CarbonCreditNFT.CarbonCreditNFT__UnauthorizedBurner.selector);
        carbonNft.burnForRetirement(TOKEN_ID_0);
        vm.stopPrank();

         // 3. Try to call burn from nonOwner address
        vm.startPrank(nonOwner);
        vm.expectRevert(CarbonCreditNFT.CarbonCreditNFT__UnauthorizedBurner.selector);
        carbonNft.burnForRetirement(TOKEN_ID_0);
        vm.stopPrank();
    }

    // --- Optional: Add tests for supportsInterface, tokenURI edge cases etc. ---

} 