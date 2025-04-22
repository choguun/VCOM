// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Removed unused IERC721Receiver import for now

// Import Flare Interfaces
import {RandomNumberV2Interface} from "flare-foundry-periphery-package/coston2/RandomNumberV2Interface.sol";
// Removed incorrect IFlareDaemon, IFtsoRegistry, IIFtso imports

// Interfaces for our other contracts
interface IRewardNFT {
    function mintReward(address to, uint256 rewardTier) external;
}

// Use internal _burn, need access or specific burn function
interface ICarbonCreditNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    function burnForRetirement(uint256 tokenId) external;
}

/**
 * @title RetirementLogic
 * @dev Handles the process of retiring a CarbonCreditNFT and rewarding the user.
 * Interacts with Flare RNG (RandomNumberV2).
 */
contract RetirementLogic is Ownable, ReentrancyGuard {

    // Flare Random Number V2 contract address (Coston2)
    // Found at https://dev.flare.network/network/guides/secure-random-numbers/
    address public immutable randomNumberV2Address = 0x5CdF9eAF3EB8b44fB696984a1420B56A7575D250;
    address public carbonCreditNFTAddress; // Address of the CarbonCreditNFT contract
    address public rewardNFTAddress;       // Address of the RewardNFT contract

    // Removed RANDOMNESS_FEE_NATIVE
    // Removed rngRequestInitiator mapping
    // Removed rngRequestTokenId mapping

    // Event
    event NFTRetired(address indexed user, uint256 indexed tokenId, uint256 rewardTier, uint256 randomNumber, uint256 randomTimestamp);
    // Removed RngRequested event

    // Errors
    error RetirementLogic__NotNFTOwner();
    // Removed RetirementLogic__NFTTransferFailed
    error RetirementLogic__NftBurnFailed(); // More specific error
    error RetirementLogic__RngNotSecure(); // Renamed/added error
    error RetirementLogic__RewardNFTMintFailed();
    // Removed RetirementLogic__FeePaymentFailed
    // Removed RetirementLogic__InvalidCallbackOrigin
    // Removed RetirementLogic__UnknownRngRequestId


    constructor(
        address _initialOwner,
        // Removed _flareDaemon, _ftsoRegistry
        address _carbonCreditNFT,
        address _rewardNFT
    ) Ownable(_initialOwner) {
        // Removed assignments for flareDaemonAddress, ftsoRegistryAddress
        carbonCreditNFTAddress = _carbonCreditNFT;
        rewardNFTAddress = _rewardNFT;
    }

    /**
     * @notice Retires an NFT, fetching a secure random number for a reward.
     * @dev User must own the NFT. Reads RNG from Flare's RandomNumberV2 contract.
     * @param tokenId The ID of the CarbonCreditNFT to retire.
     */
    function retireNFT(uint256 tokenId) public nonReentrant { // Removed payable
        ICarbonCreditNFT carbonNFT = ICarbonCreditNFT(carbonCreditNFTAddress);
        IRewardNFT rewardNFT = IRewardNFT(rewardNFTAddress);
        RandomNumberV2Interface rng = RandomNumberV2Interface(randomNumberV2Address);

        // 1. Check Ownership
        if (carbonNFT.ownerOf(tokenId) != msg.sender) {
            revert RetirementLogic__NotNFTOwner();
        }

        // 2. Burn the NFT
        try carbonNFT.burnForRetirement(tokenId) { }
        catch {
             revert RetirementLogic__NftBurnFailed();
        }

        // 3. Get Secure Random Number
        (uint256 randomNumber, bool isSecure, uint256 randomTimestamp) = rng.getRandomNumber();

        // 4. Check Security
        if (!isSecure) {
            revert RetirementLogic__RngNotSecure();
        }

        // 5. Determine Reward Tier (Example Logic - using the secure random number)
        uint256 rewardTier = (randomNumber % 100) < 10 ? 1 : 0; // 10% chance for tier 1, else tier 0

        // 6. Mint Reward NFT
        try rewardNFT.mintReward(msg.sender, rewardTier) { }
        catch {
             revert RetirementLogic__RewardNFTMintFailed();
        }

        // 7. Emit Event
        emit NFTRetired(msg.sender, tokenId, rewardTier, randomNumber, randomTimestamp);
    }

     /**
      * @notice Callback function is NO LONGER USED with RandomNumberV2.
      * Kept commented out for reference, but should be removed.
      */
    /*
    function receiveRandomNumber(uint256 _randomNumber, bytes32 _requestId) external {
        // ... old logic removed ...
    }
    */

    // --- Admin Functions ---

    function setCarbonCreditNFTAddress(address _newAddress) external onlyOwner {
        carbonCreditNFTAddress = _newAddress;
    }

    function setRewardNFTAddress(address _newAddress) external onlyOwner {
        rewardNFTAddress = _newAddress;
    }

    // Removed withdrawEther (no fees collected)
    // Removed receive() fallback (no direct payments needed)
} 