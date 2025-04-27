// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ContractRegistry} from "flare-foundry-periphery-package/coston2/ContractRegistry.sol";
import {FtsoV2Interface} from "flare-foundry-periphery-package/coston2/FtsoV2Interface.sol"; // Assumed path

/**
 * @title FTSOReader V2
 * @dev Provides utility functions to read data from the Flare Time Series Oracle (FTSO) system on Coston2.
 * Uses FeedIdConverter, FeedPublisher, and FeedDecimals instead of FtsoRegistry.
 */
contract FTSOReader {
    FtsoV2Interface internal ftsoV2;

    constructor() {
        ftsoV2 = ContractRegistry.getFtsoV2();
    }

    function getFlrUsdPrice() external returns
        (uint256 value, int8 decimals, uint64 timestamp) {
        return ftsoV2.getFeedById(0x01464c522f55534400000000000000000000000000);
    }
} 