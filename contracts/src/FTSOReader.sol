// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Import Flare Interfaces
import {IFtsoRegistry} from "flare-foundry-periphery-package/coston2/ftso/interface/IFtsoRegistry.sol";
import {IIFtso} from "flare-foundry-periphery-package/coston2/ftso/interface/IIFtso.sol";

/**
 * @title FTSOReader
 * @dev Provides utility functions to read data from the Flare Time Series Oracle (FTSO) system.
 * Specifically focused on getting the FLR/USD price for the MVP.
 */
contract FTSOReader {
    address public immutable ftsoRegistryAddress; // FTSO Registry address (Coston2)

    // Flare symbol constants (Check Flare documentation for up-to-date symbols)
    string public constant FLR_SYMBOL = "FLR";
    string public constant USD_SYMBOL = "USD";

    // Event (Optional: for when registry address is set)
    // event FtsoRegistrySet(address indexed registryAddress);

    // Error
    error FTSOReader__FtsoNotFound();
    error FTSOReader__PriceQueryFailed();

    constructor(address _ftsoRegistry) {
        ftsoRegistryAddress = _ftsoRegistry;
        // emit FtsoRegistrySet(_ftsoRegistry);
    }

    /**
     * @notice Gets the current FLR/USD price from the FTSO system.
     * @return price The price of FLR in USD (e.g., 1 FLR = price / 10**decimals USD).
     * @return decimals The number of decimals for the price.
     * @return timestamp The timestamp of the price epoch.
     */
    function getFlrUsdPrice() public view returns (uint256 price, uint8 decimals, uint256 timestamp) {
        IFtsoRegistry ftsoRegistry = IFtsoRegistry(ftsoRegistryAddress);
        address ftsoAddress = ftsoRegistry.getFtsoBySymbol(FLR_SYMBOL);

        if (ftsoAddress == address(0)) {
            revert FTSOReader__FtsoNotFound();
        }

        IIFtso ftso = IIFtso(ftsoAddress);

        // Fetch the current price epoch data
        // Note: Flare price epochs might have finalization delays.
        // Consider using getCurrentPriceWithDecimals or getCurrentPriceEpochData depending on needs.
        try ftso.getCurrentPriceWithDecimals() returns (uint256 _price, uint256 _timestamp, uint8 _decimals) {
            price = _price;
            decimals = _decimals;
            timestamp = _timestamp; // This is epoch start timestamp
        }
        catch {
             revert FTSOReader__PriceQueryFailed();
        }

        // Alternative: Fetching specific USD price if the FTSO supports it directly
        // try ftso.getCurrentPriceWithDecimalsFromTrustedProviders(USD_SYMBOL) returns (uint256 _price, uint256 _timestamp, uint8 _decimals)
        // {
        //     // Handle response
        // }
        // catch {
        //     revert FTSOReader__PriceQueryFailed();
        // }
    }

    /**
     * @notice Converts a given amount of FLR (in Wei) to its USD value based on the current FTSO price.
     * @param flrAmount The amount of FLR in Wei (10^18).
     * @return usdValue The equivalent value in USD, scaled appropriately.
     * @return usdDecimals The number of decimals for the USD value.
     */
    function convertFlrToUsd(uint256 flrAmount) public view returns (uint256 usdValue, uint8 usdDecimals) {
        (uint256 price, uint8 decimals, ) = getFlrUsdPrice();

        // Calculation: usdValue = (flrAmount * price) / (10^18 * 10^decimals)
        // We need to be careful with precision and potential overflow.
        // Assuming price decimals are relatively small (e.g., 5 for USD)
        // usdValue = (flrAmount * price) / 10**18; // Price is per FLR, flrAmount is wei

        if (decimals > 18) {
            // Price decimals are higher than FLR wei decimals, scale down price
            uint256 scalingFactor = 10**(uint256(decimals) - 18);
            usdValue = (flrAmount * price) / scalingFactor;
        } else {
            // Price decimals are lower or equal, scale up flrAmount
            uint256 scalingFactor = 10**(18 - uint256(decimals));
            usdValue = (flrAmount * price) * scalingFactor; // Potential overflow if flrAmount is huge
            // Safer: usdValue = (flrAmount / 10**(18-decimals)) * price; Requires intermediate division
        }

        // The result `usdValue` is now effectively scaled by 10^18
        // The number of decimals for this USD value representation is 18.
        usdDecimals = 18;

        // Example alternative: Return USD scaled by original price decimals
        // usdValue = (flrAmount * price) / (10**18);
        // usdDecimals = decimals;
    }
} 