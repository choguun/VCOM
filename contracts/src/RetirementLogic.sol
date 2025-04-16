// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IERC721Receiver} from "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol"; // Optional, for safe NFT transfer checks

// Import Flare Interfaces (Adjust paths based on installation)
// Assuming installation path: lib/flare-foundry-periphery-package/src/
import {IFlareDaemon} from "flare-foundry-periphery-package/coston2/stateConnector/interface/IFlareDaemon.sol";
import {IFtsoRegistry} from "flare-foundry-periphery-package/coston2/ftso/interface/IFtsoRegistry.sol"; // Needed for randomness fee
import {IIFtso} from "flare-foundry-periphery-package/coston2/ftso/interface/IIFtso.sol"; // Needed for randomness fee

// Interfaces for our other contracts (define or import later)
interface IRewardNFT {
    function mintReward(address to, uint256 rewardTier) external;
}

// Use internal _burn, need access or specific burn function
interface ICarbonCreditNFT {
    function ownerOf(uint256 tokenId) external view returns (address);
    // Option 1: Add a specific burn function callable by this contract
    function burnForRetirement(uint256 tokenId) external;
    // Option 2: Grant MINTER_ROLE or a BURNER_ROLE to this contract to call _burn
    // Option 3: Make _burn public (not recommended)
}

/**
 * @title RetirementLogic
 * @dev Handles the process of retiring a CarbonCreditNFT and rewarding the user.
 * Interacts with Flare RNG.
 */
contract RetirementLogic is Ownable, ReentrancyGuard { // Potentially add IERC721Receiver if needed

    address public immutable flareDaemonAddress; // Flare Daemon contract address (Coston2)
    address public immutable ftsoRegistryAddress; // FTSO Registry address (Coston2)
    address public carbonCreditNFTAddress; // Address of the CarbonCreditNFT contract
    address public rewardNFTAddress;       // Address of the RewardNFT contract

    uint256 public constant RANDOMNESS_FEE_NATIVE = 1 * 1e17; // 0.1 FLR (example, check current fee)

    // Mapping to store who initiated the RNG request for a given request ID
    mapping(bytes32 => address) public rngRequestInitiator;
    // Mapping to store which NFT was being retired for a given request ID
    mapping(bytes32 => uint256) public rngRequestTokenId;

    // Event
    event NFTRetired(address indexed user, uint256 indexed tokenId, uint256 rewardTier, uint256 randomNumber);
    event RngRequested(bytes32 indexed requestId, address indexed initiator, uint256 tokenId);

    // Errors
    error RetirementLogic__NotNFTOwner();
    error RetirementLogic__NFTTransferFailed(); // If using safeTransferFrom first
    error RetirementLogic__FeePaymentFailed();
    error RetirementLogic__InvalidCallbackOrigin();
    error RetirementLogic__UnknownRngRequestId();
    error RetirementLogic__RewardNFTMintFailed(); // Placeholder


    constructor(
        address _initialOwner,
        address _flareDaemon,
        address _ftsoRegistry,
        address _carbonCreditNFT,
        address _rewardNFT
    ) Ownable(_initialOwner) {
        flareDaemonAddress = _flareDaemon;
        ftsoRegistryAddress = _ftsoRegistry;
        carbonCreditNFTAddress = _carbonCreditNFT;
        rewardNFTAddress = _rewardNFT;
    }

    /**
     * @notice Retires an NFT, initiating the RNG process for a reward.
     * @dev User must own the NFT. Requires FLR payment for RNG fee.
     * @param tokenId The ID of the CarbonCreditNFT to retire.
     */
    function retireNFT(uint256 tokenId) public payable nonReentrant {
        ICarbonCreditNFT carbonNFT = ICarbonCreditNFT(carbonCreditNFTAddress);

        // 1. Check Ownership
        if (carbonNFT.ownerOf(tokenId) != msg.sender) {
            revert RetirementLogic__NotNFTOwner();
        }

        // 2. Check RNG Fee Payment (This requires FTSO to convert if fee is in USD)
        // Simple version: Assume fixed native fee
        if (msg.value < RANDOMNESS_FEE_NATIVE) {
           revert RetirementLogic__FeePaymentFailed(); // Or more specific error
        }
        // Refund excess payment
        if (msg.value > RANDOMNESS_FEE_NATIVE) {
             payable(msg.sender).transfer(msg.value - RANDOMNESS_FEE_NATIVE);
        }

        // 3. Burn the NFT (Requires CarbonCreditNFT contract to allow this)
        // Using Option 1 from interface comment:
        try carbonNFT.burnForRetirement(tokenId) { }
        catch {
             // Handle potential burn failure if needed
             revert("RetirementLogic: NFT burn failed"); // Generic error for now
        }

        // 4. Request Random Number
        IFlareDaemon flareDaemon = IFlareDaemon(flareDaemonAddress);
        bytes32 requestId = flareDaemon.requestRandomNumber{value: RANDOMNESS_FEE_NATIVE}();

        // 5. Store Request Info
        rngRequestInitiator[requestId] = msg.sender;
        rngRequestTokenId[requestId] = tokenId;

        emit RngRequested(requestId, msg.sender, tokenId);
    }

     /**
      * @notice Callback function called by the Flare Daemon with the random number.
      * @dev MUST verify that the caller is the Flare Daemon.
      * @param _randomNumber The generated random number.
      * @param _requestId The ID of the original request.
      */
    function receiveRandomNumber(uint256 _randomNumber, bytes32 _requestId) external {
        // 1. Verify Caller
        // IMPORTANT: Replace address(0) with the actual Flare Daemon address or use a more robust method
        // if (msg.sender != flareDaemonAddress) { // Simple check
        //    revert RetirementLogic__InvalidCallbackOrigin();
        // }
        // Flare's recommended check:
        if (!IFlareDaemon(flareDaemonAddress).isGenerated(_requestId, address(this), _randomNumber)) {
           revert RetirementLogic__InvalidCallbackOrigin();
        }


        // 2. Retrieve Request Info
        address initiator = rngRequestInitiator[_requestId];
        uint256 retiredTokenId = rngRequestTokenId[_requestId];

        if (initiator == address(0)) {
            revert RetirementLogic__UnknownRngRequestId(); // Request ID not found or already processed
        }

        // 3. Clear Request Info (prevent replay)
        delete rngRequestInitiator[_requestId];
        delete rngRequestTokenId[_requestId];

        // 4. Determine Reward Tier (Example Logic)
        uint256 rewardTier = (_randomNumber % 100) < 10 ? 1 : 0; // 10% chance for tier 1, else tier 0

        // 5. Mint Reward NFT
        IRewardNFT rewardNFT = IRewardNFT(rewardNFTAddress);
        try rewardNFT.mintReward(initiator, rewardTier) { }
        catch {
             // Handle potential mint failure if needed
             revert RetirementLogic__RewardNFTMintFailed();
        }


        emit NFTRetired(initiator, retiredTokenId, rewardTier, _randomNumber);
    }

    // --- Admin Functions ---

    function setCarbonCreditNFTAddress(address _newAddress) external onlyOwner {
        carbonCreditNFTAddress = _newAddress;
    }

    function setRewardNFTAddress(address _newAddress) external onlyOwner {
        rewardNFTAddress = _newAddress;
    }

    // Function to withdraw stuck FLR (e.g., from overpaid fees if transfer fails)
    function withdrawEther() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    // Receive function to accept direct FLR payments if needed (e.g., for fees)
    receive() external payable {}
} 