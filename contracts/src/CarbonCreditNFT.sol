// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol"; // Or Ownable2Step

/**
 * @title CarbonCreditNFT
 * @dev ERC721 token representing a verifiable carbon credit.
 * Minting is restricted to addresses with the MINTER_ROLE.
 * Burning is handled internally, likely triggered by the RetirementLogic contract.
 * Metadata is stored off-chain (e.g., IPFS) via tokenURI.
 */
contract CarbonCreditNFT is ERC721, ERC721URIStorage, AccessControl, Ownable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _nextTokenId;

    constructor(address initialOwner)
        ERC721("Verifiable Carbon Credit", "VCC")
        Ownable(initialOwner) // Transfer ownership to the deployer
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner); // Grant admin role to deployer
        _grantRole(MINTER_ROLE, initialOwner);        // Grant minter role initially to deployer
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
     * @dev Burns a token. Made internal because it should likely only be called
     * by the RetirementLogic contract upon successful retirement.
     * We override the public burn function to prevent accidental burning.
     */
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
    }

    // The following functions are overrides required by Solidity.

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 