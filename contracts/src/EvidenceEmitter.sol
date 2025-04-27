// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EvidenceEmitter
 * @dev Emits an event containing details of an off-chain validation performed by a trusted provider.
 * This event can then be attested to using the FDC EVMTransaction type.
 */
contract EvidenceEmitter is Ownable {

    /**
     * @notice Emitted when a trusted provider successfully validates an off-chain action.
     * @param validationId A unique identifier for this specific validation instance.
     * @param userAddress The user whose action was validated.
     * @param status The outcome status (e.g., "verified").
     * @param distanceKm The validated distance (if applicable).
     * @param activityType The validated activity type (if applicable).
     * @param validationTimestamp The timestamp (Unix epoch seconds) when the provider performed the validation.
     */
    event ValidationEvidence(
        bytes32 indexed validationId,
        address indexed userAddress,
        string status,
        uint256 distanceKm,
        string activityType,
        uint256 validationTimestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Emits validation evidence. Can only be called by the contract owner.
     * @dev The owner should be set to the Attestation Provider's wallet address.
     * @param validationId A unique identifier for the validation.
     * @param userAddress The user whose action was validated.
     * @param status The outcome status (e.g., "verified").
     * @param distanceKm The validated distance (if applicable).
     * @param activityType The validated activity type (if applicable).
     * @param validationTimestamp The timestamp of the off-chain validation.
     */
    function emitEvidence(
        bytes32 validationId,
        address userAddress,
        string calldata status,
        uint256 distanceKm,
        string calldata activityType,
        uint256 validationTimestamp
    ) external onlyOwner {
        emit ValidationEvidence(
            validationId,
            userAddress,
            status,
            distanceKm,
            activityType,
            validationTimestamp
        );
    }
} 