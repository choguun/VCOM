// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol"; // Or Ownable2Step

/**
 * @title CarbonCreditNFT
 * @dev ERC721 token representing a verifiable carbon credit.
 * Includes Enumerable extension for easier frontend querying.
 * Minting is restricted to addresses with the MINTER_ROLE.
 * Burning is handled internally, likely triggered by the RetirementLogic contract.
 * Metadata is stored off-chain (e.g., IPFS) via tokenURI.
 */
contract CarbonCreditNFT is ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl, Ownable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    // Add a role or address specifically for burning via retirement logic
    address public retirementContractAddress;

    uint256 private _nextTokenId;

    // Event for setting the retirement contract
    event RetirementContractSet(address indexed retirementContract);

    // Error for unauthorized burner
    error CarbonCreditNFT__UnauthorizedBurner();

    constructor(address initialOwner)
        ERC721("Verifiable Carbon Credit", "VCC")
        Ownable(initialOwner) // Transfer ownership to the deployer
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner); // Grant admin role to deployer
        _grantRole(MINTER_ROLE, initialOwner);        // Grant minter role initially to deployer
        _nextTokenId = 1; // Initialize token IDs to start from 1
    }

    /**
     * @dev Mints a new token with a specific URI.
     * Requires the caller to have the MINTER_ROLE.
     */
    function safeMint(address to, string memory uri)
        public
        onlyRole(MINTER_ROLE)
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        return tokenId;
    }

    /**
     * @dev Burns a token upon request from the authorized RetirementLogic contract.
     * @param tokenId The ID of the token to burn.
     */
    function burnForRetirement(uint256 tokenId) public {
        // Check caller is the authorized retirement contract
        if (msg.sender != retirementContractAddress) {
            revert CarbonCreditNFT__UnauthorizedBurner();
        }
        // Check token owner is the caller of the *original* retireNFT function
        // This check is implicitly handled in RetirementLogic before calling this.
        // We just need to ensure the RetirementLogic contract calls this.
        
        // Use the internal _burn function
        _burn(tokenId); // Will call the overridden _update below
    }

    /**
     * @notice Sets the address of the contract authorized to burn NFTs for retirement.
     * @dev Only callable by the owner.
     */
    function setRetirementContract(address _retirementContract) external onlyOwner {
        retirementContractAddress = _retirementContract;
        emit RetirementContractSet(_retirementContract);
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

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage) // Keep ERC721URIStorage here
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        // Add ERC721Enumerable to the override list
        override(ERC721, ERC721Enumerable, ERC721URIStorage, AccessControl) 
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // Override _burn is needed if you inherit from multiple extensions that override it
    // However, since _update handles the core logic, explicitly overriding _burn might not be strictly
    // necessary unless you have custom burn logic. Let's rely on _update for now.
    // function _burn(uint256 tokenId) 
    //     internal 
    //     override(ERC721, ERC721URIStorage) // Add ERC721Enumerable if it also overrides _burn
    // {
    //     super._burn(tokenId);
    // }
} 