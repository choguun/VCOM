// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {RetirementLogic} from "../src/RetirementLogic.sol";
import {CarbonCreditNFT} from "../src/CarbonCreditNFT.sol"; 
import {RewardNFT} from "../src/RewardNFT.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

// --- Minimal Interfaces (Workaround for build issues) ---
interface IFlareDaemon {
    function requestRandomNumber() external payable returns (bytes32 requestId);
    function isGenerated(bytes32 _requestId, address _caller, uint256 _randomNumber) external view returns (bool);
    // Add other functions if needed by RetirementLogic
}

interface IFtsoRegistry {
     function getFtsoBySymbol(string memory _symbol) external view returns (address _ftso);
     // Add other functions if needed by RetirementLogic
}
// --- End Minimal Interfaces ---

// --- Mock Contracts (Optional but helpful for complex interactions) ---
// For this test, we might not need full mocks yet, but demonstrating structure:
contract MockFlareDaemon is IFlareDaemon {
    bytes32 public lastRequestId;
    uint256 public valueReceived;
    mapping(bytes32 => bool) public generatedRequests; // Simulate isGenerated
    mapping(bytes32 => uint256) public storedRandomNumbers; // Store mock random number

    function requestRandomNumber() external payable returns (bytes32 requestId) {
        valueReceived = msg.value;
        requestId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        lastRequestId = requestId;
        // Store a predictable random number for testing the callback
        storedRandomNumbers[requestId] = 123456789; 
        return requestId;
    }

    function isGenerated(bytes32 _requestId, address _caller, uint256 _randomNumber) external view returns (bool) {
        // Simple mock: Returns true if the request ID exists and number matches
        return generatedRequests[_requestId] && storedRandomNumbers[_requestId] == _randomNumber;
    }
    
    // Helper to mark a request as generated for callback tests
    function setGenerated(bytes32 _requestId) external {
        generatedRequests[_requestId] = true;
    }
}

// --- Test Contract ---
contract RetirementLogicTest is Test {
    // Contracts
    RetirementLogic retirementLogic;
    CarbonCreditNFT carbonNft;
    RewardNFT rewardNft;
    MockFlareDaemon mockDaemon;
    // FTSO Registry - can be a dummy address if not strictly needed by current logic
    address ftsoRegistry = address(0xdead); 

    // Users
    address deployer = address(this);
    address user;

    // Constants
    uint256 constant NFT_ID_TO_RETIRE = 0;
    uint256 constant RNG_FEE = 0.1 ether; // Match constant in RetirementLogic

    function setUp() public {
        // Create users
        address owner = makeAddr("owner");
        user = makeAddr("user"); // Make user a state variable if needed in tests

        // Deploy contracts
        vm.startPrank(owner);
        
        // 1. Deploy CarbonCreditNFT (only needs owner)
        carbonNft = new CarbonCreditNFT(owner);
        
        // 2. Deploy RewardNFT (needs owner and retirementLogic address, deploy with 0 initially)
        rewardNft = new RewardNFT(owner, address(0)); 

        // 3. Deploy RetirementLogic (needs owner, carbonNft, rewardNft addresses)
        retirementLogic = new RetirementLogic(
            owner, 
            address(carbonNft), 
            address(rewardNft)
        );

        // 4. Set authorized addresses
        // CarbonCreditNFT: Set RetirementLogic address for burning
        carbonNft.setRetirementContract(address(retirementLogic));
        // RewardNFT: Set RetirementLogic address for minting
        rewardNft.setRetirementLogicAddress(address(retirementLogic));
        
        // Mint an NFT to the user (owner has MINTER_ROLE by default)
        carbonNft.safeMint(user, "ipfs://some_uri"); // Correct signature (to, uri)
        // NOTE: This assumes the first token minted will have ID 0 (NFT_ID_TO_RETIRE)
        
        vm.stopPrank();
    }

    // --- retireNFT Tests ---

    // function testRetireNFT_Success() public {
    //     // User approves RetirementLogic contract
    //     vm.startPrank(user);
    //     carbonNft.approve(address(retirementLogic), NFT_ID_TO_RETIRE);

    //     // --- Set Expectations BEFORE the call ---
        
    //     // Expect NFTRetired event from RetirementLogic
    //     // Check indexed topics: user, tokenId, rewardTier. Ignore non-indexed randomNumber, randomTimestamp.
    //     vm.expectEmit(true, true, true, false); 
    //     emit RetirementLogic.NFTRetired(user, NFT_ID_TO_RETIRE, 0, 0, 0); // Expect tier 0 for now

    //     // Expect standard ERC721 Transfer event from RewardNFT upon minting
    //     // Check indexed topics: from, to, tokenId AND emitter address.
    //     vm.expectEmit(
    //         true, // checkTopic1 (from)
    //         true, // checkTopic2 (to)
    //         true, // checkTopic3 (tokenId)
    //         false, // checkData
    //         address(rewardNft) // Specify emitter address
    //     );

    //     // --- Call the function --- 
    //     retirementLogic.retireNFT(NFT_ID_TO_RETIRE);
    //     vm.stopPrank();

    //     // --- Assertions AFTER the call ---
    //     vm.expectRevert(abi.encodeWithSelector(ERC721.ERC721NonexistentToken.selector, NFT_ID_TO_RETIRE));
    //     carbonNft.ownerOf(NFT_ID_TO_RETIRE); // Verify NFT is burned
    // }

    function testRetireNFT_RevertIf_NotOwner() public {
        // Another user (owner) tries to retire the user's NFT
        vm.startPrank(deployer); // Using deployer here, assuming distinct from 'owner' in setUp if needed
        vm.expectRevert(RetirementLogic.RetirementLogic__NotNFTOwner.selector);
        retirementLogic.retireNFT(NFT_ID_TO_RETIRE);
        vm.stopPrank();
    }

    // --- receiveRandomNumber Tests (Removed as callback is removed) ---
} 