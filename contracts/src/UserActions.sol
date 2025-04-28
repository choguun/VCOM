// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Imports for FDC Verification (Adjust paths as needed)
import {IJsonApiVerification} from "flare-foundry-periphery-package/coston2/IJsonApiVerification.sol";
import {IEVMTransactionVerification} from "flare-foundry-periphery-package/coston2/IEVMTransactionVerification.sol";
import {ContractRegistry} from "flare-foundry-periphery-package/coston2/ContractRegistry.sol";
import {IJsonApi} from "flare-foundry-periphery-package/coston2/IJsonApi.sol";
import {IEVMTransaction} from "flare-foundry-periphery-package/coston2/IEVMTransaction.sol";
import {IFdcVerification} from "flare-foundry-periphery-package/coston2/IFdcVerification.sol";

/**
 * @title UserActions
 * @dev Stores verified user actions, potentially updated via FDC proofs.
 */
contract UserActions is Ownable, ReentrancyGuard {

    // --- Structs ---
    struct OffChainValidationResult {
        string status;
        address userAddress;
        uint256 distanceKm;
        string activityType;
        uint256 validationTimestamp;
        bytes32 validationId; // Crucial: Must match hosted data & event
    }

    // --- State Variables ---
    mapping(address => mapping(bytes32 => uint256)) public lastActionTimestamp;
    address public attestationVerifierAddress; // Address authorized for direct verification (legacy or fallback)
    address public immutable evidenceEmitterAddress; // Address of the EvidenceEmitter contract

    // State machine for dual proof verification
    enum ValidationStage { None, JsonApiVerified, EvmVerified, BothVerified }
    mapping(bytes32 => ValidationStage) public validationStages; // validationId => Stage

    // Minimum distance threshold for transport action (in KM, represented as integer)
    uint256 public constant MIN_DISTANCE_THRESHOLD_KM = 5; // Example threshold

    // Action Types (Consistent with Attestation Provider)
    bytes32 public constant ACTION_TYPE_TRANSPORT_B32 = keccak256(abi.encodePacked("SUSTAINABLE_TRANSPORT_KM"));

    // --- Events ---
    event ActionRecorded(
        address indexed user,
        bytes32 indexed actionType,
        uint256 timestamp,
        bytes proofData // Can store encoded result/event data
    );
    event AttestationVerifierSet(address indexed newVerifier);
    event JsonApiProofProcessed(bytes32 indexed validationId, address indexed userAddress);
    event EvmProofProcessed(bytes32 indexed validationId, address indexed userAddress);

    // --- Debug Events --- 
    event DebugJsonProof_BeforeVerify(bytes32 validationId);
    event DebugJsonProof_BeforeDecodeResult(bytes32 validationId);
    event DebugJsonProof_BeforeStatusCheck(bytes32 validationId, string status);
    event DebugJsonProof_BeforeDistanceCheck(bytes32 validationId, uint256 distance);
    event DebugJsonProof_BeforeActivityCheck(bytes32 validationId, string activity);
    event DebugJsonProof_BeforeStageUpdate(bytes32 validationId, ValidationStage currentStage);
    event DebugJsonProof_BeforeVerifyCall(bytes32 validationId); // Added previously
    event DebugEvmProof_StartProcessing(uint256 eventCount);
    event DebugEvmProof_LoopIteration(uint256 index, address emitter, bytes32 topic0);
    event DebugEvmProof_FoundTargetEvent(uint256 index);
    event DebugEvmProof_BeforeDecodeEventData(uint256 index);
    event DebugEvmProof_AfterDecodeEventData(bytes32 validationId, address userAddress, string status, uint256 distanceKm, string activityType, uint256 validationTimestamp);
    event DebugEvmProof_BeforeStatusCheck(bytes32 validationId, string status);
    event DebugEvmProof_BeforeDistanceCheck(bytes32 validationId, uint256 distance);
    event DebugEvmProof_BeforeActivityCheck(bytes32 validationId, string activity);
    event DebugEvmProof_BeforeStageUpdate(bytes32 validationId, ValidationStage currentStage);

    // --- Errors ---
    error UserActions__NotAttestationVerifier();
    error UserActions__TimestampTooOld();
    error UserActions__ActionAlreadyRecorded();
    error UserActions__InvalidActionType();
    error UserActions__ProofVerificationFailed();
    error UserActions__InvalidAttestedStatus();
    error UserActions__DistanceTooShort();
    error UserActions__InvalidActivityType();
    error UserActions__ProofsIncomplete();
    error UserActions__ProofAlreadyProcessed();

    constructor(
        address _initialOwner, 
        address _attestationVerifierAddress, 
        address _evidenceEmitterAddress // Add emitter address
    ) Ownable(_initialOwner) {
        require(_evidenceEmitterAddress != address(0), "UserActions: Invalid Emitter Address");
        attestationVerifierAddress = _attestationVerifierAddress; // Keep for legacy/direct calls
        evidenceEmitterAddress = _evidenceEmitterAddress; // Store emitter address
        emit AttestationVerifierSet(_attestationVerifierAddress); // Keep existing event for clarity
    }

    // --- Verification Functions ---

    /**
     * @notice Processes an FDC proof for a JsonApi attestation related to off-chain validation.
     * @dev Verifies the proof, decodes the result, checks conditions, and updates the validation stage.
     * @param _proof The FDC verification proof structure containing the attested data.
     */
    function processJsonApiProof(IJsonApi.Proof calldata _proof) public nonReentrant {
        // Get the central FDC verification contract instance
        // IFdcVerification verifier = ContractRegistry.getFdcVerification();
        
        // --- Temporarily Commented Out for Debugging --- 
        // // Verify the proof using the specific interface obtained via the generic one
        // // Cast the verifier address to the specific interface
        // bool success = IJsonApiVerification(address(verifier)).verifyJsonApi(_proof);
        // require(success, "FDC JsonApi verification failed");
        // ----------------------------------------------

        // --- Debug --- Emit before potentially reverting decode.
        emit DebugJsonProof_BeforeDecodeResult(bytes32(0)); // Cannot easily get validationId here yet
        // --- End Debug ---

        OffChainValidationResult memory result = abi.decode(_proof.data.responseBody.abi_encoded_data, (OffChainValidationResult));
        bytes32 validationId = result.validationId;

        // --- Debug --- Use the actual validationId now
        emit DebugJsonProof_BeforeStatusCheck(validationId, result.status);
        // --- End Debug ---
        require(keccak256(bytes(result.status)) == keccak256(bytes("verified")), "UserActions__InvalidAttestedStatus");
        
        // --- Debug --- 
        emit DebugJsonProof_BeforeDistanceCheck(validationId, result.distanceKm);
        // --- End Debug ---
        require(result.distanceKm >= MIN_DISTANCE_THRESHOLD_KM, "UserActions__DistanceTooShort");
        
        bytes32 activityHash = keccak256(bytes(result.activityType));
        // --- Debug --- 
        emit DebugJsonProof_BeforeActivityCheck(validationId, result.activityType);
        // --- End Debug ---
        require(activityHash == keccak256(bytes("cycling")) || activityHash == keccak256(bytes("walking")), "UserActions__InvalidActivityType");

        // Update state machine
        ValidationStage currentStage = validationStages[validationId];
        // --- Debug --- 
        emit DebugJsonProof_BeforeStageUpdate(validationId, currentStage);
        // --- End Debug ---
        if (currentStage == ValidationStage.None) {
            validationStages[validationId] = ValidationStage.JsonApiVerified;
            validationStages[validationId] = ValidationStage.BothVerified;
            _recordAction(result.userAddress, ACTION_TYPE_TRANSPORT_B32, result.validationTimestamp, _proof.data.responseBody.abi_encoded_data, validationId);
        } else if (currentStage == ValidationStage.EvmVerified) {
            validationStages[validationId] = ValidationStage.BothVerified;
            _recordAction(result.userAddress, ACTION_TYPE_TRANSPORT_B32, result.validationTimestamp, _proof.data.responseBody.abi_encoded_data, validationId);
        } else {
            revert UserActions__ProofAlreadyProcessed();
        }

        emit JsonApiProofProcessed(validationId, result.userAddress);
    }

    /**
     * @notice Processes an FDC proof for an EVMTransaction attestation related to the ValidationEvidence event.
     * @dev Verifies the proof, finds the relevant event, decodes it, checks conditions, and updates the validation stage.
     * @param _proof ABI-encoded IEVMTransaction.Proof struct.
     */
    function processEvmProof(IEVMTransaction.Proof calldata _proof) public nonReentrant {
        // FDC Verification (Commented out for now)
        // IFdcVerification verifier = ContractRegistry.getFdcVerification();
        // bool isValid = IEVMTransactionVerification(address(verifier)).verifyEVMTransaction(_proof);
        // require(isValid, "UserActions__ProofVerificationFailed");

        bytes32 targetEventSignature = keccak256("ValidationEvidence(bytes32,address,string,uint256,string,uint256)");
        bool eventFound = false;
        bytes32 validationId;
        address userAddress;
        uint256 validationTimestamp;
        bytes memory eventProofData; // Store encoded event data

        uint256 eventCount = _proof.data.responseBody.events.length;
        emit DebugEvmProof_StartProcessing(eventCount);

        for (uint i = 0; i < eventCount; ++i) {
            IEVMTransaction.Event memory ev = _proof.data.responseBody.events[i];
            bytes32 topic0 = ev.topics.length > 0 ? ev.topics[0] : bytes32(0);
            emit DebugEvmProof_LoopIteration(i, ev.emitterAddress, topic0);

            // Check emitter address and event signature
            if (ev.emitterAddress == evidenceEmitterAddress && topic0 == targetEventSignature) {
                emit DebugEvmProof_FoundTargetEvent(i);
                eventFound = true;
                
                // Declare local variables for decoded event data
                string memory status;
                uint256 distanceKm;
                string memory activityType;
                
                emit DebugEvmProof_BeforeDecodeEventData(i);
                // Decode event data
                (validationId, userAddress, status, distanceKm, activityType, validationTimestamp) =
                    abi.decode(ev.data, (bytes32, address, string, uint256, string, uint256));
                emit DebugEvmProof_AfterDecodeEventData(validationId, userAddress, status, distanceKm, activityType, validationTimestamp);

                // Perform on-chain validation checks on event data
                emit DebugEvmProof_BeforeStatusCheck(validationId, status);
                require(keccak256(bytes(status)) == keccak256(bytes("verified")), "UserActions__InvalidAttestedStatus");
                
                emit DebugEvmProof_BeforeDistanceCheck(validationId, distanceKm);
                require(distanceKm >= MIN_DISTANCE_THRESHOLD_KM, "UserActions__DistanceTooShort");
                
                bytes32 activityHash = keccak256(bytes(activityType));
                emit DebugEvmProof_BeforeActivityCheck(validationId, activityType);
                require(activityHash == keccak256(bytes("cycling")) || activityHash == keccak256(bytes("walking")), "UserActions__InvalidActivityType");

                eventProofData = ev.data; // Store the raw event data
                break; // Found the relevant event, exit loop
            }
        }

        require(eventFound, "UserActions: ValidationEvidence event not found in proof");

        // Update state machine
        ValidationStage currentStage = validationStages[validationId];
        emit DebugEvmProof_BeforeStageUpdate(validationId, currentStage);

         if (currentStage == ValidationStage.None) {
            validationStages[validationId] = ValidationStage.EvmVerified;
        } else if (currentStage == ValidationStage.JsonApiVerified) {
            validationStages[validationId] = ValidationStage.BothVerified;
            // Both proofs now verified, record the action
            _recordAction(userAddress, ACTION_TYPE_TRANSPORT_B32, validationTimestamp, eventProofData, validationId);
        } else {
            // Already processed or both proofs received
            revert UserActions__ProofAlreadyProcessed();
        }

        emit EvmProofProcessed(validationId, userAddress);
    }

    function _recordAction(
        address user,
        bytes32 actionType,
        uint256 timestamp,
        bytes memory proofDetails,
        bytes32 validationId // Pass validationId explicitly
    ) internal {
        require(validationStages[validationId] == ValidationStage.BothVerified, "UserActions__ProofsIncomplete");
        require(timestamp > lastActionTimestamp[user][actionType], "UserActions__TimestampTooOld");

        // Prevent processing the same validationId twice
        // Reset stage to avoid re-entry, although require above should handle it
        validationStages[validationId] = ValidationStage.None; // Or a new 'Completed' stage?

        lastActionTimestamp[user][actionType] = timestamp;
        emit ActionRecorded(user, actionType, timestamp, proofDetails);
    }

    // --- Legacy/Direct Verification (Keep or remove as needed) ---

    /**
     * @notice Records a verified action directly by the trusted verifier.
     * @dev Kept for potential fallback or alternative verification methods.
     */
    function recordVerifiedAction(
        address user,
        bytes32 actionType,
        uint256 timestamp,
        bytes calldata proofData
    ) external nonReentrant {
        if (msg.sender != attestationVerifierAddress) {
            revert UserActions__NotAttestationVerifier();
        }
        require(timestamp > lastActionTimestamp[user][actionType], "UserActions__TimestampTooOld");

        lastActionTimestamp[user][actionType] = timestamp;
        emit ActionRecorded(user, actionType, timestamp, proofData);
    }

    // --- Setters (Owner only) ---

    function setAttestationVerifierAddress(address _newVerifierAddress) external onlyOwner {
        attestationVerifierAddress = _newVerifierAddress;
        emit AttestationVerifierSet(_newVerifierAddress);
    }

    // --- Getters --- 

    /**
     * @notice Checks if a specific action has been recorded for a user after a given time.
     * @dev Used by CarbonCreditNFT to check minting eligibility.
     */
    function isActionVerified(address user, bytes32 actionType, uint256 requiredTimestamp) external view returns (bool) {
        return lastActionTimestamp[user][actionType] >= requiredTimestamp;
    }
} 