// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol"; // Or Ownable2Step
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol"; // For string conversions
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol"; // For on-chain metadata

// Interface for UserActions contract (to read lastActionTimestamp)
interface IUserActions {
    function lastActionTimestamp(address user, bytes32 actionType) external view returns (uint256);
}

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
    address public retirementContractAddress;
    address public userActionsContractAddress; // Address of the UserActions contract
    bytes32 public constant ACTION_TYPE_TRANSPORT_B32 = keccak256(abi.encodePacked("SUSTAINABLE_TRANSPORT_KM"));

    uint256 private _nextTokenId;

    // Mapping to track the timestamp when a user last claimed a transport NFT
    mapping(address => uint256) public transportNFTClaimedTimestamp;

    // Events
    event RetirementContractSet(address indexed retirementContract);
    event UserActionsContractSet(address indexed userActionsContract);
    event TransportNFTClaimed(address indexed user, uint256 indexed tokenId, uint256 actionTimestamp);

    // Errors
    error CarbonCreditNFT__UnauthorizedBurner();
    error CarbonCreditNFT__UserActionsNotSet();
    error CarbonCreditNFT__ActionNotVerified();
    error CarbonCreditNFT__AlreadyClaimed();

    constructor(address initialOwner, address _userActionsAddress) // Add UserActions address to constructor
        ERC721("Verifiable Carbon Credit", "VCC")
        Ownable(initialOwner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
        _nextTokenId = 1;
        if (_userActionsAddress == address(0)) revert CarbonCreditNFT__UserActionsNotSet();
        userActionsContractAddress = _userActionsAddress;
        emit UserActionsContractSet(_userActionsAddress);
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
     * @notice Allows a user to claim a Carbon Credit NFT after verifying 
     *         a sustainable transport action via the UserActions contract.
     * @dev Checks if the action was recorded after the last claim for this user.
     */
    function claimTransportNFT() public {
        if (userActionsContractAddress == address(0)) {
            revert CarbonCreditNFT__UserActionsNotSet();
        }

        address claimer = msg.sender;
        
        // 1. Check last action timestamp from UserActions contract
        uint256 lastActionTime = IUserActions(userActionsContractAddress)
            .lastActionTimestamp(claimer, ACTION_TYPE_TRANSPORT_B32);

        if (lastActionTime == 0) {
            revert CarbonCreditNFT__ActionNotVerified(); // Action never recorded
        }

        // 2. Check if already claimed since the last action
        uint256 lastClaimTime = transportNFTClaimedTimestamp[claimer];
        if (lastActionTime <= lastClaimTime) {
            revert CarbonCreditNFT__AlreadyClaimed(); // Action timestamp must be newer than last claim
        }

        // 3. Update claimed timestamp
        transportNFTClaimedTimestamp[claimer] = block.timestamp;

        // 4. Mint the NFT
        uint256 newTokenId = _nextTokenId++;
        string memory newTokenURI = _buildTransportTokenURI(newTokenId, claimer, lastActionTime);
        _safeMint(claimer, newTokenId);
        _setTokenURI(newTokenId, newTokenURI);

        emit TransportNFTClaimed(claimer, newTokenId, lastActionTime);
    }

    /**
     * @dev Internal function to build the token URI for claimed transport NFTs.
     *      Generates on-chain JSON metadata.
     */
    function _buildTransportTokenURI(uint256 tokenId, address owner, uint256 actionTimestamp) internal pure returns (string memory) {
        string memory json = string(abi.encodePacked(
            '{',
                '"name": "Verified Sustainable Transport Credit #', Strings.toString(tokenId), '",',
                '"description": "This NFT represents a verified sustainable transport action (e.g., cycling > 5km) recorded via the Flare Data Connector.",',
                '"attributes": [',
                    '{"trait_type": "Action Type", "value": "SUSTAINABLE_TRANSPORT_KM"},',
                    '{"trait_type": "Owner", "value": "', Strings.toHexString(uint160(owner), 20), '"},',
                    '{"trait_type": "Verified Timestamp", "value": ', Strings.toString(actionTimestamp), '}',
                ']',
            '}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    /**
     * @notice Sets the address of the contract authorized to burn NFTs for retirement.
     * @dev Only callable by the owner.
     */
    function setRetirementContract(address _retirementContract) external onlyOwner {
        retirementContractAddress = _retirementContract;
        emit RetirementContractSet(_retirementContract);
    }

    function setUserActionsContract(address _userActionsAddress) external onlyOwner {
        if (_userActionsAddress == address(0)) revert CarbonCreditNFT__UserActionsNotSet();
        userActionsContractAddress = _userActionsAddress;
        emit UserActionsContractSet(_userActionsAddress);
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