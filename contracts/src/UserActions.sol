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

    address public attestationVerifierAddress; // Address of the trusted AttestationVerifier contract

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
    event AttestationVerifierSet(address indexed newVerifier); // Event for updating the verifier

    // Errors
    error UserActions__ActionAlreadyRecorded(); // Or based on timestamp check
    error UserActions__InvalidActionType(); // If using predefined types
    error UserActions__TimestampTooOld(); // Prevent recording very old actions
    error UserActions__NotAttestationVerifier(); // Error for unauthorized caller


    /**
     * @param _initialOwner The initial owner of the contract.
     * @param _attestationVerifierAddress The address of the trusted AttestationVerifier contract.
     */
    constructor(address _initialOwner, address _attestationVerifierAddress) Ownable(_initialOwner) {
        require(_attestationVerifierAddress != address(0), "Invalid verifier address");
        attestationVerifierAddress = _attestationVerifierAddress;
        emit AttestationVerifierSet(_attestationVerifierAddress);
    }

    /**
     * @dev Modifier to restrict function calls to the designated AttestationVerifier contract.
     */
    modifier onlyAttestationVerifier() {
        if (msg.sender != attestationVerifierAddress) {
            revert UserActions__NotAttestationVerifier();
        }
        _;
    }

    /**
     * @notice Records a verified user action based on FDC proof.
     * @dev Callable only by the trusted AttestationVerifier contract.
     * Includes basic replay protection based on timestamp.
     * @param user The user who performed the action.
     * @param actionType An identifier for the type of action (e.g., keccak256("HIGH_TEMP_SEOUL")).
     * @param timestamp The timestamp associated with the verified action (e.g., from FDC proof).
     * @param proofData The FDC proof data or a hash of it (content validated by AttestationVerifier).
     */
    function recordVerifiedAction(
        address user,
        bytes32 actionType,
        uint256 timestamp,
        bytes calldata proofData // Use calldata for external calls
    )
        external
        onlyAttestationVerifier // Replaced onlyOwner with this modifier
        nonReentrant
    {
        // Basic replay/ordering protection: ensure timestamp is newer than last recorded for this user/type
        if (timestamp <= lastActionTimestamp[user][actionType]) {
            revert UserActions__TimestampTooOld(); // Or a more specific replay error
        }

        // FDC Proof Verification is now assumed to be handled by the AttestationVerifier before calling this function.

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

    /**
     * @notice Allows the owner to update the address of the trusted AttestationVerifier contract.
     * @param _newVerifierAddress The new address for the AttestationVerifier.
     */
    function setAttestationVerifierAddress(address _newVerifierAddress) external onlyOwner {
        require(_newVerifierAddress != address(0), "Invalid verifier address");
        attestationVerifierAddress = _newVerifierAddress;
        emit AttestationVerifierSet(_newVerifierAddress);
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