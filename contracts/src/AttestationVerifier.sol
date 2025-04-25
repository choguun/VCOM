// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {UserActions} from "./UserActions.sol"; 

// --- TODO: Replace with actual Interface from Flare documentation or @flarenetwork/flare-contracts ---
// The interface MUST define the callback function signature the State Connector uses.
interface IStateConnector {
    // Example Callback Function - FIND THE REAL ONE!
    // function attestationCallback(bytes calldata attestationData) external;
    // NOTE: The SC address might not be immutable if upgradable, consider making it settable.
    // function stateConnectorAddress() external view returns (address);
}

// Minimal interface for UserActions contract
interface IUserActions {
    // Use bytes32 for actionType for consistency/gas
    function recordVerifiedAction(address user, bytes32 actionType, uint256 timestamp, bytes calldata proofData) external; 
}

/**
 * @title AttestationVerifier
 * @notice Receives verified attestations from the Flare State Connector, 
 *         decodes them, checks validity, and records valid user actions.
 * @dev Requires accurate State Connector interface and understanding of FDC proof structures.
 */
contract AttestationVerifier is Ownable {
    // Use IStateConnector interface
    IStateConnector public immutable stateConnector;
    IUserActions public userActions; // Made mutable to allow updates
    address public trustedAttestationProvider; // Address of the off-chain service wallet that INITIATES requests

    // --- TODO: Define constants for expected attestation types and source IDs from FDC Docs ---
    // Example structure based on API Attestation Type
    // bytes4 public constant ATTESTATION_TYPE_API = bytes4(keccak256("API")); // Or enum value from SC
    // bytes32 public constant SOURCE_ID_WEATHER_API = keccak256(abi.encodePacked("https://api.openweathermap.org/data/2.5/weather?...")); // Use exact URL hash format
    // bytes32 public constant RESPONSE_BODY_MERKLE_PROOF_KEY = keccak256(abi.encodePacked("main.temp")); // Use exact key hash format
    uint256 public constant TEMP_THRESHOLD_CELSIUS_SCALED = 15 * 10**5; // Example: Scale threshold if value in proof is scaled (e.g., 5 decimals)
    bytes32 public constant ACTION_TYPE_HIGH_TEMP_SEOUL = keccak256("HIGH_TEMP_SEOUL");

    // Keep track of processed request IDs or hashes to prevent replay
    mapping(bytes32 => bool) public isAttestationProcessed;

    // Events
    event AttestationReceived(bytes32 indexed attestationHash, bytes data);
    event AttestationDecodedAndVerified(
        bytes32 indexed attestationHash, 
        address indexed requester, // Who initiated the request (off-chain provider)
        bytes32 sourceId, 
        uint64 timestamp, // Timestamp from the proof
        bytes responseBody // Decoded relevant part of the response
    );
    event ActionRecordingFailed(bytes32 indexed attestationHash, address indexed user, bytes32 actionType, string reason);
    event UserActionRecorded(bytes32 indexed attestationHash, address indexed user, bytes32 actionType);
    event TrustedAttestationProviderSet(address indexed newProvider);
    event UserActionsContractSet(address indexed newUserActions);

    // Errors
    error AttestationVerifier__InvalidCaller(address caller);
    error AttestationVerifier__InvalidAttestationType(bytes4 receivedType);
    error AttestationVerifier__InvalidSourceId(bytes32 receivedSourceId);
    error AttestationVerifier__UntrustedProvider(address receivedProvider);
    error AttestationVerifier__AttestationAlreadyProcessed(bytes32 attestationHash);
    error AttestationVerifier__InvalidProofData();
    error AttestationVerifier__ConditionNotMet();
    error AttestationVerifier__TimestampOutOfRange();

    // --- TODO: Define Structs for FDC Proof Data based on Flare Docs --- 
    // Example structure - FIND THE REAL ONE!
    struct AttestationRequestData { // Data originally sent by the provider
        bytes4 attestationType;
        bytes32 sourceId;
        bytes requestBody;         // Often empty for GET
        bytes32 responseBodyProofOf; // Key for Merkle proof
        address recipient;        // Should be this contract
        uint64 requestId;         // Identifier used by provider
    }

    struct AttestationProofData { // Data received from State Connector
        uint64 blockNumber;         // Chain block number of verification
        uint64 timestamp;           // Timestamp of verification
        bytes32 sourceId;           // Source ID verified
        AttestationRequestData request; // Original request data
        bytes responseBody;        // Verified response data matching the proof key
        // ... potentially other fields like Merkle proofs, status codes ...
    }


    /**
     * @param _initialOwner The owner of the contract.
     * @param _stateConnectorAddress The address of the Flare State Connector contract.
     * @param _userActionsAddress The address of the UserActions contract.
     * @param _trustedAttestationProvider The wallet address of the off-chain service allowed to initiate requests.
     */
    constructor(
        address _initialOwner,
        address _stateConnectorAddress,
        address _userActionsAddress,
        address _trustedAttestationProvider
    ) Ownable(_initialOwner) {
        require(_stateConnectorAddress != address(0), "Invalid SC address");
        require(_userActionsAddress != address(0), "Invalid UserActions address");
        require(_trustedAttestationProvider != address(0), "Invalid Trusted Provider address");
        
        stateConnector = IStateConnector(_stateConnectorAddress);
        userActions = IUserActions(_userActionsAddress);
        trustedAttestationProvider = _trustedAttestationProvider;
    }

    /**
     * @notice === TODO: THIS IS THE STATE CONNECTOR CALLBACK ===
     * @notice FIND THE CORRECT FUNCTION SIGNATURE FROM FLARE DOCS and rename this function.
     * @notice Receives the verified attestation proof data from the State Connector.
     * @dev MUST verify msg.sender is the State Connector.
     *      Decodes proof, performs checks, and triggers UserActions.recordVerifiedAction.
     * @param attestationData The raw, encoded attestation proof data from the State Connector.
     */
    function attestationCallback(bytes calldata attestationData) external {
        // 1. Verify Caller
        // require(msg.sender == address(stateConnector), "Invalid caller"); // Basic check
        // Alternative: Use SC registry or Ownable transfer if SC address can change.
        if (msg.sender != address(stateConnector)) { // Use immutable address for now
             revert AttestationVerifier__InvalidCaller(msg.sender);
        }

        bytes32 attestationHash = keccak256(attestationData);
        emit AttestationReceived(attestationHash, attestationData);

        // 2. Check if already processed
        if (isAttestationProcessed[attestationHash]) {
            revert AttestationVerifier__AttestationAlreadyProcessed(attestationHash);
        }

        // 3. Decode Proof Data (using the structure defined in AttestationProofData)
        // --- TODO: Replace with actual decoding logic based on Flare FDC proof structure ---
        // Example using placeholder struct:
        (AttestationProofData memory proof) = abi.decode(attestationData, (AttestationProofData)); 
        // --- End TODO ---

        // 4. Perform Checks on Decoded Data
        // a) Check Attestation Type (ensure it's API)
        // require(proof.request.attestationType == ATTESTATION_TYPE_API, "Invalid type");

        // b) Check Source ID (ensure it matches expected Weather API source)
        // require(proof.sourceId == SOURCE_ID_WEATHER_API, "Invalid source");

        // c) Check Recipient (should be this contract)
        // require(proof.request.recipient == address(this), "Invalid recipient");

        // d) Check Requesting Provider (ensure it's our trusted off-chain service)
        // This might require the proof structure to include the original requester address.
        // Assuming proof.request has a 'requester' field for this check:
        // address requester = proof.request.requester; // Assuming this field exists in the real proof
        // require(requester == trustedAttestationProvider, "Untrusted provider");
        address requester = trustedAttestationProvider; // Placeholder if not in proof

        // e) Timestamp validation (e.g., not too old)
        // require(block.timestamp - proof.timestamp < 1 hours, "Timestamp too old"); // Example: 1 hour validity
        
        // f) Decode the actual response body (temperature)
        // --- TODO: Replace with actual decoding based on `proof.responseBody` format --- 
        // Example: Assuming response body is abi.encoded (int256) for temp * 10^5
        int256 temperatureScaled = abi.decode(proof.responseBody, (int256)); 
        // --- End TODO ---

        emit AttestationDecodedAndVerified(
            attestationHash, 
            requester,
            proof.sourceId,
            proof.timestamp, 
            proof.responseBody
        );

        // 5. Check Application-Specific Condition (Temp > Threshold)
        if (temperatureScaled <= int256(TEMP_THRESHOLD_CELSIUS_SCALED)) {
             revert AttestationVerifier__ConditionNotMet();
        }

        // 6. Mark as processed
        isAttestationProcessed[attestationHash] = true;

        // 7. Trigger User Action Recording
        // --- TODO: Determine how to get the target `user` address ---
        // Option A: User address included in the original request data (needs field in AttestationRequestData)
        // Option B: User address derived from request ID or other data.
        // Option C: Provider submits requests on behalf of users (less ideal for user-centric actions).
        address user = address(0); // <<< --- !!! CRITICAL PLACEHOLDER: DETERMINE USER ADDRESS !!!
        // Example if user address was part of requestData (assuming `proof.request.userAddress` field)
        // user = proof.request.userAddress; 
        // require(user != address(0), "User address missing");
        // --- End TODO ---

        try userActions.recordVerifiedAction(user, ACTION_TYPE_HIGH_TEMP_SEOUL, proof.timestamp, attestationData) {
            emit UserActionRecorded(attestationHash, user, ACTION_TYPE_HIGH_TEMP_SEOUL);
        } catch Error(string memory reason) {
            emit ActionRecordingFailed(attestationHash, user, ACTION_TYPE_HIGH_TEMP_SEOUL, reason);
        } catch {
            emit ActionRecordingFailed(attestationHash, user, ACTION_TYPE_HIGH_TEMP_SEOUL, "Unknown revert");
        }
    }

    /**
     * @notice Allows the owner to update the trusted attestation provider address.
     * @param _newProvider The address of the new trusted provider wallet.
     */
    function setTrustedAttestationProvider(address _newProvider) external onlyOwner {
        require(_newProvider != address(0), "Invalid address");
        trustedAttestationProvider = _newProvider;
        emit TrustedAttestationProviderSet(_newProvider);
    }

    /**
     * @notice Allows the owner to update the UserActions contract address.
     * @param _newUserActionsAddress The address of the new UserActions contract.
     */
    function setUserActionsContract(address _newUserActionsAddress) external onlyOwner {
        require(_newUserActionsAddress != address(0), "Invalid address");
        userActions = IUserActions(_newUserActionsAddress);
        emit UserActionsContractSet(_newUserActionsAddress);
    }

    // --- TODO: Add helper functions for proof data decoding specific to chosen attestation types if needed ---
} 