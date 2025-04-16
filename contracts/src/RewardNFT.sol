// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title RewardNFT
 * @dev Simple ERC721 to represent rewards for retiring CarbonCreditNFTs.
 * Minting is restricted to the RetirementLogic contract (via Ownable or specific role).
 */
contract RewardNFT is ERC721, Ownable {
    address public retirementLogicAddress;
    uint256 private _nextTokenId;

    // Mapping from token ID to reward tier (simple metadata)
    mapping(uint256 => uint256) public rewardTiers;

    // Error
    error RewardNFT__UnauthorizedMinter();

    constructor(address initialOwner, address _retirementLogicAddress)
        ERC721("Retirement Reward NFT", "RRNFT")
        Ownable(initialOwner)
    {
        retirementLogicAddress = _retirementLogicAddress;
    }

    /**
     * @dev Mints a new reward token.
     * Can only be called by the designated RetirementLogic contract.
     * @param to The address to receive the reward.
     * @param rewardTier A number representing the reward tier.
     */
    function mintReward(address to, uint256 rewardTier) external {
        if (msg.sender != retirementLogicAddress) {
            revert RewardNFT__UnauthorizedMinter();
        }
        uint256 tokenId = _nextTokenId++;
        rewardTiers[tokenId] = rewardTier;
        _safeMint(to, tokenId);
    }

    /**
     * @dev Sets the address of the allowed minter (RetirementLogic contract).
     * Only callable by the owner.
     */
    function setRetirementLogicAddress(address _newAddress) external onlyOwner {
        retirementLogicAddress = _newAddress;
    }

    // Optional: Basic tokenURI function if needed for display
    // function tokenURI(uint256 tokenId) public view override returns (string memory) {
    //     _requireOwned(tokenId);
    //     // Simple on-chain URI generation (replace with IPFS if needed)
    //     string memory baseURI = "data:application/json;base64,";
    //     return string(
    //         abi.encodePacked(
    //             baseURI,
    //             // Base64 encode basic JSON metadata
    //             // This part requires a Base64 library or manual implementation
    //             // For MVP, returning tier might be enough or skip URI
    //             "{\"name\":\"Reward NFT #",
    //             _toString(tokenId),
    //             "\", \"description\":\"A reward for carbon retirement.\", \"attributes\": [{\"trait_type\": \"Reward Tier\", \"value\": ",
    //             _toString(rewardTiers[tokenId]),
    //             "}]}"
    //         )
    //     );
    // }

    // Helper function to convert uint to string (basic implementation)
    // function _toString(uint256 value) internal pure returns (string memory) {
    //     // Implementation omitted for brevity - use a library or implement properly
    //     if (value == 0) return "0";
    //     // ... conversion logic ...
    // }

} 