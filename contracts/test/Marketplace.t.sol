// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol"; // Using as a mock ERC721
import {Vm} from "forge-std/Vm.sol";

contract MarketplaceTest is Test {
    Marketplace marketplace;
    CarbonCreditNFT testNft;

    address deployer = address(this);
    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");
    address randomUser = makeAddr("randomUser");

    uint256 constant STARTING_BALANCE = 100 ether; // Give users some initial ETH
    uint256 constant NFT_ID_1 = 0;
    uint256 constant LISTING_PRICE = 1 ether;

    function setUp() public {
        // Deploy Marketplace
        marketplace = new Marketplace(deployer);

        // Deploy NFT contract (seller will be the initial owner/minter for simplicity)
        // Note: CarbonCreditNFT constructor grants minter role to initialOwner
        vm.startPrank(seller);
        testNft = new CarbonCreditNFT(seller);
        // Mint an NFT to the seller
        testNft.safeMint(seller, "ipfs://token1");
        vm.stopPrank();

        // Give buyer some initial Ether balance
        vm.deal(buyer, STARTING_BALANCE);
         // Give seller some initial Ether balance (for gas)
        vm.deal(seller, STARTING_BALANCE);
    }

    // --- Test listItem --- //

    function test_listItem_success() public {
        // Seller approves marketplace for the NFT
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        
        // Seller lists the item
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();

        // Verify listing details (Requires capturing listingId from ItemListed event)
        // Marketplace.Listing memory listing = marketplace.listings(listingId);
        // assertEq(listing.seller, seller, "Listing seller mismatch");
        // assertEq(listing.nftContract, address(testNft), "Listing NFT contract mismatch");
        // assertEq(listing.tokenId, NFT_ID_1, "Listing token ID mismatch");
        // assertEq(listing.priceInFLR, LISTING_PRICE, "Listing price mismatch");
        // assertTrue(listing.active, "Listing should be active");
    }

    function testFail_listItem_notApproved() public {
        vm.startPrank(seller);
        // Expect revert because marketplace is not approved
        vm.expectRevert(Marketplace.Marketplace__NotApprovedForTransfer.selector);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
    }

    function testFail_listItem_notOwner() public {
        // Random user (not owner) tries to list seller's NFT
        vm.startPrank(randomUser);
        // Even if approved by seller (hypothetically), owner check should fail
        // testNft.approve(address(marketplace), NFT_ID_1); // Seller approves
        vm.expectRevert(Marketplace.Marketplace__NotOwnerOfListing.selector);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
    }

    // --- Test buyItem --- //

    function test_buyItem_success() public {
        // 1. Seller lists the item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
        // Need to get listingId from event
        uint256 listingIdToBuy = 0; // Placeholder - MUST CAPTURE FROM EVENT

        // 2. Buyer buys the item
        uint256 sellerBalanceBefore = seller.balance;
        vm.startPrank(buyer);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToBuy);
        vm.stopPrank();

        // Verify state changes
        assertEq(testNft.ownerOf(NFT_ID_1), buyer, "Buyer should own NFT");
        // Marketplace.Listing memory listing = marketplace.listings(listingIdToBuy);
        // assertFalse(listing.active, "Listing should be inactive");
        // Check seller received payment (approximate due to gas, check increase)
        assertEq(seller.balance, sellerBalanceBefore + LISTING_PRICE, "Seller balance incorrect"); 
    }
    
    function testFail_buyItem_listingNotFound() public {
         vm.startPrank(buyer);
         vm.expectRevert(Marketplace.Marketplace__ListingNotFound.selector);
         marketplace.buyItem{value: LISTING_PRICE}(999); // Non-existent listing ID
         vm.stopPrank();
    }

    function testFail_buyItem_listingInactive() public {
        // 1. List item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        // 2. Cancel listing (Need to get listingId from event)
        uint256 listingIdToCancel = 0; // Placeholder - MUST CAPTURE FROM EVENT
        marketplace.cancelListing(listingIdToCancel);
        vm.stopPrank();

        // 3. Try to buy inactive listing
        vm.startPrank(buyer);
        vm.expectRevert(Marketplace.Marketplace__ListingNotActive.selector);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToCancel);
        vm.stopPrank();
    }

    function testFail_buyItem_incorrectPrice() public {
        // 1. List item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
        // Need to get listingId from event
        uint256 listingIdToBuy = 0; // Placeholder - MUST CAPTURE FROM EVENT

        // 2. Try to buy with wrong price
        vm.startPrank(buyer);
        vm.expectRevert(Marketplace.Marketplace__IncorrectPriceSent.selector);
        marketplace.buyItem{value: LISTING_PRICE / 2}(listingIdToBuy);
        vm.stopPrank();
    }

    // --- Test cancelListing --- //

    function test_cancelListing_success() public {
        // 1. List item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        // Need to get listingId from event
        uint256 listingIdToCancel = 0; // Placeholder - MUST CAPTURE FROM EVENT
        
        // 2. Seller cancels
        marketplace.cancelListing(listingIdToCancel);
        vm.stopPrank();

        // Verify listing is inactive
        // Marketplace.Listing memory listing = marketplace.listings(listingIdToCancel);
        // assertFalse(listing.active, "Listing should be inactive after cancel");
    }

    function testFail_cancelListing_notOwner() public {
         // 1. List item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
        // Need to get listingId from event
        uint256 listingIdToCancel = 0; // Placeholder - MUST CAPTURE FROM EVENT

        // 2. Random user tries to cancel
        vm.startPrank(randomUser);
        vm.expectRevert(Marketplace.Marketplace__NotOwnerOfListing.selector);
        marketplace.cancelListing(listingIdToCancel);
        vm.stopPrank();
    }

    function testFail_cancelListing_alreadyInactive() public {
         // 1. List item and buy it
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
        // Need to get listingId from event
        uint256 listingIdToBuy = 0; // Placeholder - MUST CAPTURE FROM EVENT
        vm.startPrank(buyer);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToBuy);
        vm.stopPrank();

        // 2. Seller tries to cancel already sold (inactive) listing
        vm.startPrank(seller);
        vm.expectRevert(Marketplace.Marketplace__ListingNotActive.selector);
        marketplace.cancelListing(listingIdToBuy); // Use listingIdToBuy here
        vm.stopPrank();
    }
} 