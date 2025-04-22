// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol"; // Good practice

/**
 * @title UserActions
 * @dev Manages the state of user actions verified via Flare FDC.
 * Stores proof of verified environmental actions.
 */
contract UserActions is Ownable, ReentrancyGuard {

    // Struct to store details of a recorded action (optional, could use mapping directly)
    // struct ActionRecord {
    //     address user;
    //     bytes32 actionType; // Use bytes32 for gas efficiency if action types are fixed
    //     uint256 timestamp;
    //     bytes proofData; // Store FDC proof or relevant data hash
    // }

    // Mapping to track recorded actions to prevent replays
    // mapping(bytes32 => bool) public isActionRecorded; // Key could be hash(user, actionType, timestamp, proofData)

    // Simpler mapping: track last recorded timestamp for a user/actionType pair
    mapping(address => mapping(bytes32 => uint256)) public lastActionTimestamp;

    // Event
    event ActionRecorded(
        address indexed user,
        bytes32 indexed actionType,
        uint256 timestamp,
        bytes proofData // Include proof data hash or identifier
    );

    // Errors
    error UserActions__ActionAlreadyRecorded(); // Or based on timestamp check
    error UserActions__InvalidActionType(); // If using predefined types
    error UserActions__TimestampTooOld(); // Prevent recording very old actions


    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Records a verified user action based on FDC proof.
     * @dev Currently callable only by the owner. Will later be called by an Attestation Verifier.
     * Includes basic replay protection based on timestamp.
     * @param user The user who performed the action.
     * @param actionType An identifier for the type of action (e.g., keccak256("HIGH_TEMP_SEOUL")).
     * @param timestamp The timestamp associated with the verified action (e.g., from FDC proof).
     * @param proofData The FDC proof data or a hash of it.
     */
    function recordVerifiedAction(
        address user,
        bytes32 actionType,
        uint256 timestamp,
        bytes calldata proofData // Use calldata for external calls
    )
        external
        onlyOwner // Replace with attestation verifier check later
        nonReentrant
    {
        // Basic replay/ordering protection: ensure timestamp is newer than last recorded for this user/type
        if (timestamp <= lastActionTimestamp[user][actionType]) {
            revert UserActions__TimestampTooOld(); // Or a more specific replay error
        }

        // --- Future FDC Proof Verification Would Go Here ---
        // This section would involve interacting with FDC contracts
        // to verify the validity and content of proofData based on actionType and timestamp.
        // For now, we assume the proof is valid as only the owner can call this.

        // Store the latest timestamp
        lastActionTimestamp[user][actionType] = timestamp;

        // Emit event
        emit ActionRecorded(user, actionType, timestamp, proofData);

        // Optional: Store more detailed record if needed using a struct and mapping
        // bytes32 recordHash = keccak256(abi.encodePacked(user, actionType, timestamp, proofData));
        // if (isActionRecorded[recordHash]) {
        //     revert UserActions__ActionAlreadyRecorded();
        // }
        // isActionRecorded[recordHash] = true;
    }

    // --- Potential Future Functions ---
    // function hasPerformedAction(address user, bytes32 actionType) external view returns (bool) {
    //     return lastActionTimestamp[user][actionType] > 0;
    // }
    //
    // function getLastActionTime(address user, bytes32 actionType) external view returns (uint256) {
    //     return lastActionTimestamp[user][actionType];
    // }

} 