// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/**
 * @title UserActions
 * @dev Stores records of verified environmental actions performed by users.
 * Actions are recorded by a trusted attestation source.
 */
contract UserActions is Ownable {
    // Address authorized to record verified actions (Attestation Verifier/Provider)
    address public attestationVerifierAddress;

    struct ActionRecord {
        address user;
        bytes32 actionType; // e.g., keccak256("temp_gt_15_seoul")
        uint256 timestamp;   // Timestamp of verification/recording
        bytes proofData;     // Optional: Store proof data hash or reference
    }

    uint256 public nextActionId;
    mapping(uint256 => ActionRecord) public actionRecords;

    // Mapping to prevent replay attacks: user => actionType => lastRecordedTimestamp
    mapping(address => mapping(bytes32 => uint256)) public lastActionTimestamp;

    // Events
    event ActionRecorded(
        uint256 indexed actionId,
        address indexed user,
        bytes32 indexed actionType,
        uint256 timestamp
    );
    event AttestationVerifierSet(address indexed newVerifierAddress);

    // Errors
    error UserActions__UnauthorizedRecorder();
    error UserActions__ActionAlreadyRecordedRecently(); // Or similar replay protection error
    error UserActions__InvalidActionType(); // If predefined types are used

    constructor(address initialOwner, address initialVerifierAddress)
        Ownable(initialOwner)
    {
        attestationVerifierAddress = initialVerifierAddress;
        emit AttestationVerifierSet(initialVerifierAddress);
    }

    /**
     * @notice Records a verified action for a user.
     * @dev Only callable by the designated attestationVerifierAddress.
     * Includes basic replay protection based on timestamp.
     * @param user The user who performed the action.
     * @param actionType Identifier for the type of action verified.
     * @param timestamp The timestamp associated with the verification (e.g., block timestamp).
     * @param proofData Optional data related to the proof.
     */
    function recordVerifiedAction(
        address user,
        bytes32 actionType,
        uint256 timestamp,
        bytes calldata proofData // Using calldata for potentially large proof data
    ) public {
        if (msg.sender != attestationVerifierAddress) {
            revert UserActions__UnauthorizedRecorder();
        }

        // Basic replay protection: ensure this action hasn't been recorded too recently
        // A more robust system might check against a specific proof hash or nonce from FDC
        // Allow minimum 1 hour between same actions for a user (example)
        if (timestamp <= lastActionTimestamp[user][actionType] + 1 hours) {
             revert UserActions__ActionAlreadyRecordedRecently();
        }

        uint256 actionId = nextActionId++;
        actionRecords[actionId] = ActionRecord({
            user: user,
            actionType: actionType,
            timestamp: timestamp,
            proofData: proofData
        });

        lastActionTimestamp[user][actionType] = timestamp;

        emit ActionRecorded(actionId, user, actionType, timestamp);
    }

    /**
     * @notice Updates the address authorized to record actions.
     * @dev Only callable by the owner.
     */
    function setAttestationVerifier(address _newVerifierAddress) external onlyOwner {
        attestationVerifierAddress = _newVerifierAddress;
        emit AttestationVerifierSet(_newVerifierAddress);
    }
} 