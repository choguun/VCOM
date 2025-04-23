// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FTSOReader} from "../src/FTSOReader.sol";
import {Vm} from "forge-std/Vm.sol";

// --- Minimal Interfaces (Needed for interaction and Mocking) ---
interface IFtsoRegistry {
    function getFtsoBySymbol(string memory _symbol) external view returns (IIFtso _ftso);
    // Add other functions if needed
}

interface IIFtso {
     function getCurrentPriceWithDecimals() external view returns (uint256 _price, uint256 _epochId, uint8 _decimals);
     // Add other functions if needed
}
// --- End Minimal Interfaces ---

// --- Mock Contracts ---
contract MockFtsoRegistry is IFtsoRegistry {
    IIFtso public mockFtso;
    string public requestedSymbol;

    constructor(IIFtso _mockFtso) {
        mockFtso = _mockFtso;
    }

    function getFtsoBySymbol(string memory _symbol) external view returns (IIFtso _ftso) {
        // Store requested symbol for verification if needed
        // requestedSymbol = _symbol; // Requires making requestedSymbol non-constant or using internal variable
        return mockFtso;
    }
}

contract MockFtso is IIFtso {
    uint256 public mockPrice = 25000; // Example: $0.25 USD with 5 decimals
    uint8 public mockDecimals = 5;
    uint256 public mockEpochId = 1700000000; // Example epoch ID

    function getCurrentPriceWithDecimals() external view returns (uint256 _price, uint256 _epochId, uint8 _decimals) {
        return (mockPrice, mockEpochId, mockDecimals);
    }

    // Helper to set mock values
    function setMockValues(uint256 _price, uint8 _decimals, uint256 _epochId) external {
        mockPrice = _price;
        mockDecimals = _decimals;
        mockEpochId = _epochId;
    }
}
// --- End Mock Contracts ---

contract FTSOReaderTest is Test {
    FTSOReader ftsoReader;
    MockFtsoRegistry mockRegistry;
    MockFtso mockFtso;

    address deployer = address(this);

    function setUp() public {
        // Deploy mocks
        mockFtso = new MockFtso();
        mockRegistry = new MockFtsoRegistry(mockFtso);

        // Deploy FTSOReader with the address of the mock registry
        ftsoReader = new FTSOReader(address(mockRegistry));
    }

    // --- Test getFlrUsdPrice ---

    function testGetPrice_Success() public {
        // Set mock values (optional, uses defaults otherwise)
        uint256 expectedPrice = 30000; // $0.30
        uint8 expectedDecimals = 5;
        uint256 expectedEpochId = 1700001000;
        mockFtso.setMockValues(expectedPrice, expectedDecimals, expectedEpochId);

        (uint256 price, uint8 decimals, uint256 timestamp) = ftsoReader.getFlrUsdPrice();

        assertEq(price, expectedPrice, "Price mismatch");
        assertEq(decimals, expectedDecimals, "Decimals mismatch");
        // Note: FTSOReader currently sets timestamp = epochId due to workaround
        assertEq(timestamp, expectedEpochId, "Timestamp/EpochId mismatch");
    }

    function testGetPrice_FtsoNotFound() public {
        // Configure mock registry to return address(0) for the FTSO
        MockFtsoRegistry registryReturningZero = new MockFtsoRegistry(IIFtso(address(0)));
        FTSOReader readerWithBadRegistry = new FTSOReader(address(registryReturningZero));

        vm.expectRevert(FTSOReader.FTSOReader__FtsoNotFound.selector);
        readerWithBadRegistry.getFlrUsdPrice();
    }
    
    // Test potential failure during the FTSO call itself
    function testGetPrice_PriceQueryFailed() public {
        // We need a way to make the mockFtso revert.
        // Add a revert condition to the mock or use a different mock.
        // For now, this test is a placeholder.
        assertTrue(true, "Test for PriceQueryFailed revert not implemented");
    }

    // --- Test convertFlrToUsd ---

    function testConvert_Success() public {
        // Use default mock values: price = 25000 ($0.25), decimals = 5
        uint256 flrAmount = 100 ether; // 100 FLR in Wei (100 * 10^18)

        uint256 expectedUsdValue = 25 ether; // $25 scaled by 10^18
        uint8 expectedUsdDecimals = 18; 

        (uint256 usdValue, uint8 usdDecimals) = ftsoReader.convertFlrToUsd(flrAmount);

        assertEq(usdValue, expectedUsdValue, "USD value mismatch");
        assertEq(usdDecimals, expectedUsdDecimals, "USD decimals mismatch");
    }

     function testConvert_HighPriceDecimals() public {
         uint256 flrAmount = 1 ether; // 1 FLR
         mockFtso.setMockValues(1 * 10**20, 20, 1700002000); // Price = 1, Decimals = 20

        uint256 expectedUsdValue = 1 * 10**36;
        uint8 expectedUsdDecimals = 18;

        (uint256 usdValue, uint8 usdDecimals) = ftsoReader.convertFlrToUsd(flrAmount);

        assertEq(usdValue, expectedUsdValue, "USD value mismatch (high decimals)");
        assertEq(usdDecimals, expectedUsdDecimals, "USD decimals mismatch (high decimals)");
    }
    
    // Test potential overflow in conversion logic (e.g., very large flrAmount)
    function testConvert_Overflow() public {
        // Set price to avoid intermediate overflow during multiplication if possible
        mockFtso.setMockValues(1, 5, 1700003000); // Price = 1, Decimals = 5
        uint256 largeFlrAmount = type(uint256).max; 

        // Whether this reverts depends on the exact calculation order in convertFlrToUsd
        // and whether intermediate multiplication overflows.
        // If it uses `(flrAmount * price) * scalingFactor`, it might overflow.
        vm.expectRevert(); // Expecting potential arithmetic overflow revert
        ftsoReader.convertFlrToUsd(largeFlrAmount);
    }

} 