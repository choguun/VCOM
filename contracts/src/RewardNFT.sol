// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title RewardNFT
 * @dev Simple ERC721 to represent rewards for retiring CarbonCreditNFTs.
 * Minting is restricted to the RetirementLogic contract (via Ownable or specific role).
 */
contract RewardNFT is ERC721, ERC721Enumerable, Ownable {
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
        _nextTokenId = 1;
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

    // --- OVERRIDES ---

    // Override _update to include ERC721Enumerable's logic
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    // Override _increaseBalance which is now required by ERC721Enumerable
    function _increaseBalance(address account, uint128 amount)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, amount);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        // Add ERC721Enumerable to the override list
        override(ERC721, ERC721Enumerable) 
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 