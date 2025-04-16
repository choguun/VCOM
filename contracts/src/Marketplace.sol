// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC721} from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Marketplace
 * @dev A simple marketplace for trading CarbonCreditNFTs (or any ERC721) for native FLR.
 */
contract Marketplace is Ownable, ReentrancyGuard {
    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 priceInFLR; // Price in Wei
        bool active;
    }

    uint256 private _nextListingId;
    mapping(uint256 => Listing) public listings;

    // Events
    event ItemListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 priceInFLR
    );
    event ItemSold(
        uint256 indexed listingId,
        address indexed buyer,
        address seller, // Included for convenience
        address nftContract, // Included for convenience
        uint256 tokenId,    // Included for convenience
        uint256 priceInFLR
    );
    event ListingCancelled(uint256 indexed listingId);

    // Errors
    error Marketplace__NotApprovedForTransfer();
    error Marketplace__ListingNotFound();
    error Marketplace__ListingNotActive();
    error Marketplace__NotOwnerOfListing();
    error Marketplace__IncorrectPriceSent();
    error Marketplace__TransferFailed();

    constructor(address initialOwner)
        Ownable(initialOwner)
    {}

    /**
     * @notice Lists an NFT for sale.
     * @dev The marketplace contract must be approved to transfer the NFT.
     * @param nftContract The address of the NFT contract.
     * @param tokenId The ID of the token to list.
     * @param priceInFLR The selling price in Wei.
     */
    function listItem(address nftContract, uint256 tokenId, uint256 priceInFLR) public nonReentrant {
        IERC721 nft = IERC721(nftContract);
        if (nft.getApproved(tokenId) != address(this) && !nft.isApprovedForAll(msg.sender, address(this))) {
            revert Marketplace__NotApprovedForTransfer();
        }
        if (nft.ownerOf(tokenId) != msg.sender) {
            revert Marketplace__NotOwnerOfListing(); // Technically covered by approval check, but good to be explicit
        }

        uint256 listingId = _nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            priceInFLR: priceInFLR,
            active: true
        });

        emit ItemListed(listingId, msg.sender, nftContract, tokenId, priceInFLR);
    }

    /**
     * @notice Buys a listed NFT.
     * @dev Sends the required FLR amount with the transaction.
     * @param listingId The ID of the listing to purchase.
     */
    function buyItem(uint256 listingId) public payable nonReentrant {
        Listing storage listing = listings[listingId];

        if (listing.seller == address(0)) { // Check if listing exists
            revert Marketplace__ListingNotFound();
        }
        if (!listing.active) {
            revert Marketplace__ListingNotActive();
        }
        if (msg.value != listing.priceInFLR) {
            revert Marketplace__IncorrectPriceSent();
        }

        address seller = listing.seller;
        address nftContract = listing.nftContract;
        uint256 tokenId = listing.tokenId;
        uint256 price = listing.priceInFLR;

        // Mark inactive before transfer to prevent reentrancy issues not covered by the guard
        listing.active = false;

        // Transfer NFT
        IERC721(nftContract).safeTransferFrom(seller, msg.sender, tokenId);

        // Pay seller
        (bool success, ) = seller.call{value: price}("");
        if (!success) {
            // If payment fails, revert the whole transaction including the NFT transfer
            revert Marketplace__TransferFailed();
        }

        emit ItemSold(listingId, msg.sender, seller, nftContract, tokenId, price);
    }

    /**
     * @notice Cancels an active listing.
     * @dev Only the original seller can cancel.
     * @param listingId The ID of the listing to cancel.
     */
    function cancelListing(uint256 listingId) public nonReentrant {
        Listing storage listing = listings[listingId];

        if (listing.seller == address(0)) { // Check if listing exists
            revert Marketplace__ListingNotFound();
        }
        if (!listing.active) {
            revert Marketplace__ListingNotActive();
        }
        if (listing.seller != msg.sender) {
            revert Marketplace__NotOwnerOfListing();
        }

        listing.active = false;
        emit ListingCancelled(listingId);
    }
} 