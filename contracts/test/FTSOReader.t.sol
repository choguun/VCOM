// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {FTSOReader} from "../src/FTSOReader.sol";
import {Vm} from "forge-std/Vm.sol";

// Minimal Interface for IFtsoRegistry (Workaround)
interface IFtsoRegistry {
     function getFtsoBySymbol(string memory _symbol) external view returns (address _ftso);
}

// Minimal Interface for IIFtso (Workaround)
interface IIFtso {
    function getCurrentPriceWithDecimals() external view returns (uint256 _price, uint256 _timestamp, uint8 _decimals);
}

// Mock FTSO Registry
contract MockFtsoRegistry is IFtsoRegistry {
    address public mockFtsoAddress;
    function setMockFtsoAddress(address _addr) external {
        mockFtsoAddress = _addr;
    }
    function getFtsoBySymbol(string memory _symbol) external view returns (address _ftso) {
        // Simple mock: return predefined address for "FLR"
        if (keccak256(abi.encodePacked(_symbol)) == keccak256(abi.encodePacked("FLR"))) {
            return mockFtsoAddress;
        }
        return address(0);
    }
}

// Mock FTSO (Price Feed)
contract MockFtso is IIFtso {
    uint256 public mockPrice;
    uint8 public mockDecimals;
    uint256 public mockTimestamp;

    function setMockData(uint256 _price, uint8 _decimals, uint256 _timestamp) external {
        mockPrice = _price;
        mockDecimals = _decimals;
        mockTimestamp = _timestamp;
    }

    function getCurrentPriceWithDecimals() external view returns (uint256 _price, uint256 _timestamp, uint8 _decimals) {
        return (mockPrice, mockTimestamp, mockDecimals);
    }
}


contract FTSOReaderTest is Test {
    FTSOReader ftsoReader;
    MockFtsoRegistry mockRegistry;
    MockFtso mockFtso;
    address deployer = address(this);

    function setUp() public {
        // Deploy mocks
        mockRegistry = new MockFtsoRegistry();
        mockFtso = new MockFtso();
        mockRegistry.setMockFtsoAddress(address(mockFtso));

        // Deploy FTSOReader with mock registry address
        ftsoReader = new FTSOReader(address(mockRegistry));
    }

    function testDeployment() public {
        assertEq(ftsoReader.ftsoRegistryAddress(), address(mockRegistry), "Test Fail: Incorrect registry address");
    }

    function testGetFlrUsdPrice_success() public {
        // Set mock data in the mock FTSO
        uint256 price = 25 * 10**5; // $0.25 with 5 decimals
        uint8 decimals = 5;
        uint256 timestamp = block.timestamp - 1 minutes;
        mockFtso.setMockData(price, decimals, timestamp);

        // Call the reader
        (uint256 fetchedPrice, uint8 fetchedDecimals, uint256 fetchedTimestamp) = ftsoReader.getFlrUsdPrice();

        // Assert results
        assertEq(fetchedPrice, price, "Fetched price mismatch");
        assertEq(fetchedDecimals, decimals, "Fetched decimals mismatch");
        assertEq(fetchedTimestamp, timestamp, "Fetched timestamp mismatch");
    }
    
    function testGetFlrUsdPrice_ftsoNotFound() public {
         // Configure mock registry to return address(0) for FLR
         mockRegistry.setMockFtsoAddress(address(0));
         
         vm.expectRevert(FTSOReader.FTSOReader__FtsoNotFound.selector);
         ftsoReader.getFlrUsdPrice();
    }

    // Test conversion logic
    function testConvertFlrToUsd() public {
        // Set mock data: $0.25 / FLR, 5 decimals
        uint256 price = 25 * 10**5; 
        uint8 decimals = 5;
        uint256 timestamp = block.timestamp - 1 minutes;
        mockFtso.setMockData(price, decimals, timestamp);

        uint256 flrAmountWei = 100 ether; // 100 FLR
        
        // Expected USD value scaled by 10^18
        // (100 * 10^18) * (0.25 * 10^5) * 10^(18-5) / 10^18
        // = 100 * 10^18 * 0.25 * 10^5 * 10^13 / 10^18
        // = 100 * 0.25 * 10^18 = 25 * 10^18
        uint256 expectedUsdValue = 25 ether;
        uint8 expectedUsdDecimals = 18;

        (uint256 usdValue, uint8 usdDecimals) = ftsoReader.convertFlrToUsd(flrAmountWei);

        assertEq(usdValue, expectedUsdValue, "USD value mismatch");
        assertEq(usdDecimals, expectedUsdDecimals, "USD decimals mismatch");
    }
} 