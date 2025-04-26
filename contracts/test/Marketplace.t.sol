// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Marketplace} from "../src/Marketplace.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol"; // Using as a mock ERC721
import {Vm} from "forge-std/Vm.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol"; // For standard ERC721 errors

contract MarketplaceTest is Test {
    Marketplace marketplace;
    CarbonCreditNFT testNft; // Using CarbonCreditNFT instance as a mock ERC721

    address owner; // Marketplace owner
    address seller;
    address buyer;
    address nonOwner;

    uint256 constant STARTING_BALANCE = 100 ether;
    uint256 constant NFT_ID_1 = 0; // Assuming first minted token is ID 0
    uint256 constant LISTING_PRICE = 1 ether;
    string constant TEST_URI = "ipfs://mock_uri";

    // Event signatures for decoding logs
    bytes32 constant ITEMLISTED_SIG = keccak256("ItemListed(uint256,address,address,uint256,uint256)");
    bytes32 constant ITEMSOLD_SIG = keccak256("ItemSold(uint256,address,address,address,uint256,uint256)");
    bytes32 constant LISTINGCANCELLED_SIG = keccak256("ListingCancelled(uint256)");

    function setUp() public {
        owner = makeAddr("owner");
        seller = makeAddr("seller");
        buyer = makeAddr("buyer");
        nonOwner = makeAddr("nonOwner");

        // Deploy Marketplace with owner
        vm.startPrank(owner);
        marketplace = new Marketplace(owner);
        vm.stopPrank();

        // Deploy NFT contract (owner deploys, grants minter role to seller)
        vm.startPrank(owner);
        testNft = new CarbonCreditNFT(owner, address(this));
        testNft.grantRole(testNft.MINTER_ROLE(), seller);
        vm.stopPrank();

        // Seller mints an NFT to themselves
        vm.startPrank(seller);
        testNft.safeMint(seller, TEST_URI);
        vm.stopPrank();
        assertEq(testNft.ownerOf(NFT_ID_1), seller, "Setup Fail: Seller should own NFT");

        // Give users Ether
        vm.deal(buyer, STARTING_BALANCE);
        vm.deal(seller, STARTING_BALANCE);
        vm.deal(owner, STARTING_BALANCE); // Owner might need gas too
    }

    // --- Test listItem ---

    function testListItem_Success() public {
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);

        // Enable log recording
        vm.recordLogs();

        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();

        // Get recorded logs
        Vm.Log[] memory entries = vm.getRecordedLogs();

        // Find the ItemListed event and extract listingId (topic[1])
        uint256 listingId = _findListingIdFromLogs(entries, ITEMLISTED_SIG, seller, address(testNft));

        // Assertions using captured listingId
        (address sellerAddr, address nftAddr, uint256 tkId, uint256 price, bool active) = marketplace.listings(listingId);
        assertEq(sellerAddr, seller, "Seller mismatch");
        assertEq(nftAddr, address(testNft), "NFT contract mismatch");
        assertEq(tkId, NFT_ID_1, "Token ID mismatch");
        assertEq(price, LISTING_PRICE, "Price mismatch");
        assertTrue(active, "Listing should be active");
    }

    function testListItem_RevertIf_NotApproved() public {
        vm.startPrank(seller);
        // No approval given
        // Assuming the marketplace checks for approval using testNft.getApproved(NFT_ID_1)
        // or ownerOf before transfer. The exact revert might depend on Marketplace.sol logic.
        // vm.expectRevert(Marketplace.Marketplace__NotApprovedForNFT.selector); 
        // Check for standard ERC721 error
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721InsufficientApproval.selector, address(marketplace), NFT_ID_1));
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
    }

     function testListItem_RevertIf_NotOwner() public {
        // Buyer (not owner) tries to list seller's NFT
        vm.startPrank(buyer);
        // Need to approve first for the owner check to be reached?
        // No, the check should happen based on msg.sender vs ownerOf(tokenId)

        // vm.expectRevert(Marketplace.Marketplace__NotNFTOwner.selector); // Typo in error name
        vm.expectRevert(Marketplace.Marketplace__NotOwnerOfListing.selector); // Correct error name
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        vm.stopPrank();
    }

    function testListItem_RevertIf_ZeroPrice() public {
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.expectRevert(Marketplace.Marketplace__PriceMustBeAboveZero.selector);
        marketplace.listItem(address(testNft), NFT_ID_1, 0);
        vm.stopPrank();
    }


    // --- Test buyItem ---

    function testBuyItem_Success() public {
        // 1. Seller lists item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs(); // Start recording before listItem
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToBuy = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Buyer buys item
        uint256 sellerInitialBalance = seller.balance;
        vm.startPrank(buyer);
        vm.recordLogs(); // Start recording before buyItem
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToBuy);
        Vm.Log[] memory buyEntries = vm.getRecordedLogs(); // Capture buy logs
        vm.stopPrank();

        // 3. Verify ItemSold event (Optional check)
        _findItemSoldLog(buyEntries, ITEMSOLD_SIG, listingIdToBuy, buyer);

        // 4. Assertions
        assertEq(testNft.ownerOf(NFT_ID_1), buyer, "NFT should be transferred to buyer");
        (, , , , bool listingActive) = marketplace.listings(listingIdToBuy); // Only need active status
        assertFalse(listingActive, "Listing should be inactive");
        assertEq(seller.balance, sellerInitialBalance + LISTING_PRICE, "Seller should receive payment");
        assertEq(address(marketplace).balance, 0, "Marketplace should not hold funds");
    }

    function testBuyItem_RevertIf_ListingNotActive() public {
         // 1. Seller lists item and capture listingId
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs(); // Start recording before listItem
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToInteract = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Buyer buys it once
        vm.startPrank(buyer);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToInteract);
        vm.stopPrank();

        // 3. Buyer tries to buy again
        vm.startPrank(buyer);
        vm.deal(buyer, LISTING_PRICE); // Give funds again just in case
        vm.expectRevert(Marketplace.Marketplace__ListingNotActive.selector);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToInteract);
        vm.stopPrank();
    }

    function testBuyItem_RevertIf_IncorrectPrice() public {
        // 1. Seller lists item and capture listingId
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs(); // Start recording before listItem
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToBuy = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Buyer tries to buy with less value
        vm.startPrank(buyer);
        vm.expectRevert(Marketplace.Marketplace__IncorrectPriceSent.selector); // Correct error name
        marketplace.buyItem{value: LISTING_PRICE - 1 wei}(listingIdToBuy); // Send less
        vm.stopPrank();
    }

    function testBuyItem_RevertIf_SellerBuysOwnItem() public {
        // 1. Seller lists item and capture listingId
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs(); // Start recording before listItem
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToBuy = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Seller tries to buy own item
        vm.startPrank(seller);
        vm.expectRevert(Marketplace.Marketplace__CannotBuyOwnItem.selector);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToBuy);
        vm.stopPrank();
    }

    // --- Test cancelListing ---

    function testCancelListing_Success() public {
        // 1. Seller lists item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs(); // Record logs for listItem
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToCancel = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Seller cancels listing
        vm.startPrank(seller);
        vm.recordLogs(); // Record logs for cancelListing
        marketplace.cancelListing(listingIdToCancel);
        Vm.Log[] memory cancelEntries = vm.getRecordedLogs();
        vm.stopPrank();

        // 3. Verify ListingCancelled event
        _findListingCancelledLog(cancelEntries, LISTINGCANCELLED_SIG, listingIdToCancel);

        // 4. Assertions
        (,,, , bool active) = marketplace.listings(listingIdToCancel); // Get active status
        assertFalse(active, "Listing should be inactive after cancel");
    }

    function testCancelListing_RevertIf_NotSeller() public {
        // 1. Seller lists item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs();
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToCancel = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Buyer tries to cancel
        vm.startPrank(buyer);
        // vm.expectRevert(Marketplace.Marketplace__NotListingOwner.selector); // Typo in error name
        vm.expectRevert(Marketplace.Marketplace__NotOwnerOfListing.selector); // Correct error name
        marketplace.cancelListing(listingIdToCancel);
        vm.stopPrank();
    }

    function testCancelListing_RevertIf_ListingNotActive() public {
         // 1. Seller lists item and capture listingId
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs(); // Start recording before listItem
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToInteract = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        // 2. Seller cancels listing once
        vm.startPrank(seller);
        marketplace.cancelListing(listingIdToInteract);
        vm.stopPrank();

        // 3. Seller tries to cancel again
        vm.startPrank(seller);
        vm.expectRevert(Marketplace.Marketplace__ListingNotActive.selector);
        marketplace.cancelListing(listingIdToInteract);
        vm.stopPrank();
    }

    // Test case: Trying to cancel an item that was already bought (also inactive)
    function testCancelListing_RevertIf_ListingBought() public {
        // 1. List and Buy item
        vm.startPrank(seller);
        testNft.approve(address(marketplace), NFT_ID_1);
        vm.recordLogs();
        marketplace.listItem(address(testNft), NFT_ID_1, LISTING_PRICE);
        Vm.Log[] memory listEntries = vm.getRecordedLogs();
        vm.stopPrank();
        uint256 listingIdToInteract = _findListingIdFromLogs(listEntries, ITEMLISTED_SIG, seller, address(testNft));

        vm.startPrank(buyer);
        marketplace.buyItem{value: LISTING_PRICE}(listingIdToInteract);
        vm.stopPrank();

        // 2. Seller tries to cancel bought item
        vm.startPrank(seller);
        vm.expectRevert(Marketplace.Marketplace__ListingNotActive.selector);
        marketplace.cancelListing(listingIdToInteract);
        vm.stopPrank();
    }
    
    // --- Helper Functions for Log Parsing ---
    function _findListingIdFromLogs(Vm.Log[] memory entries, bytes32 eventSig, address expectedSeller, address expectedNftContract) internal pure returns (uint256 listingId) {
        bool found = false;
        for (uint i = 0; i < entries.length; i++) {
            Vm.Log memory entry = entries[i];
            // ItemListed has 3 indexed topics: eventSig, listingId, seller, nftContract
            if (entry.topics.length == 4 && entry.topics[0] == eventSig && 
                address(uint160(uint256(entry.topics[2]))) == expectedSeller &&
                address(uint160(uint256(entry.topics[3]))) == expectedNftContract
            ) {
                listingId = uint256(entry.topics[1]);
                found = true;
                break;
            }
        }
        require(found, "ItemListed event not found or topics mismatch");
        return listingId;
    }

    function _findItemSoldLog(Vm.Log[] memory entries, bytes32 eventSig, uint256 expectedListingId, address expectedBuyer) internal pure {
        bool found = false;
        for (uint i = 0; i < entries.length; i++) {
             Vm.Log memory entry = entries[i];
             // ItemSold has 3 indexed topics: eventSig, listingId, buyer
             if (entry.topics.length == 3 && entry.topics[0] == eventSig && 
                 uint256(entry.topics[1]) == expectedListingId && 
                 address(uint160(uint256(entry.topics[2]))) == expectedBuyer
             ) {
                 found = true;
                 break;
             }
        }
        require(found, "ItemSold event not found or topics mismatch");
    }

    function _findListingCancelledLog(Vm.Log[] memory entries, bytes32 eventSig, uint256 expectedListingId) internal pure {
        bool found = false;
        for (uint i = 0; i < entries.length; i++) {
             Vm.Log memory entry = entries[i];
             // ListingCancelled has 2 indexed topics: eventSig, listingId
             if (entry.topics.length == 2 && entry.topics[0] == eventSig && 
                 uint256(entry.topics[1]) == expectedListingId 
             ) {
                 found = true;
                 break;
             }
        }
        require(found, "ListingCancelled event not found or topic mismatch");
    }

} 