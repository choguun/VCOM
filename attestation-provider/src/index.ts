import express, { Request, Response } from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config(); // Load environment variables from .env file

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const COSTON2_RPC_URL = process.env.COSTON2_RPC_URL;
const ATTESTATION_PROVIDER_PRIVATE_KEY = process.env.ATTESTATION_PROVIDER_PRIVATE_KEY;
const STATE_CONNECTOR_ADDRESS = process.env.STATE_CONNECTOR_ADDRESS;
const ATTESTATION_VERIFIER_ADDRESS = process.env.ATTESTATION_VERIFIER_ADDRESS;

const SEOUL_LAT = 37.5665; // Latitude for Seoul
const SEOUL_LON = 126.9780; // Longitude for Seoul
const TEMP_THRESHOLD_CELSIUS = 15.0;
const WEATHER_API_URL = `https://api.openweathermap.org/data/2.5/weather?lat=${SEOUL_LAT}&lon=${SEOUL_LON}&appid=${OPENWEATHERMAP_API_KEY}&units=metric`;

// --- FDC Constants (PLACEHOLDERS - Use values from Flare Documentation) ---
// See: https://docs.flare.network/tech/state-connector/attestation-types/
const ATTESTATION_TYPE_API = 'API'; // Example: Might be an enum or bytes4
const SOURCE_ID_WEATHER_API = ethers.utils.id(`https${WEATHER_API_URL.split('https')[1]}`); // Calculate sourceId based on URL (check documentation for exact format!)
const RESPONSE_BODY_MERKLE_PROOF_KEY = ethers.utils.id('main.temp'); // Key to extract the temperature field (check documentation)

// --- Input Validation ---
if (!OPENWEATHERMAP_API_KEY) {
    console.error("ERROR: OPENWEATHERMAP_API_KEY is not set in the .env file.");
    process.exit(1);
}
if (!COSTON2_RPC_URL) {
    console.error("ERROR: COSTON2_RPC_URL is not set in the .env file.");
    process.exit(1);
}
if (!ATTESTATION_PROVIDER_PRIVATE_KEY) {
    console.error("ERROR: ATTESTATION_PROVIDER_PRIVATE_KEY is not set in the .env file.");
    process.exit(1);
}
if (!STATE_CONNECTOR_ADDRESS) {
    console.error("ERROR: STATE_CONNECTOR_ADDRESS is not set in the .env file.");
    process.exit(1);
}
if (!ATTESTATION_VERIFIER_ADDRESS) {
    console.error("ERROR: ATTESTATION_VERIFIER_ADDRESS is not set in the .env file. Deploy AttestationVerifier first.");
    process.exit(1);
}

// --- Ethers Setup ---
const provider = new ethers.providers.JsonRpcProvider(COSTON2_RPC_URL);
const wallet = new ethers.Wallet(ATTESTATION_PROVIDER_PRIVATE_KEY, provider);
console.log(`Attestation Provider Wallet Address: ${wallet.address}`);

// TODO: Replace with the actual ABI for the State Connector contract from Flare documentation or @flarenetwork/flare-contracts
// Find the real ABI! Example functions/events shown below are GUESSES.
const STATE_CONNECTOR_ABI: any[] = [
    // Example function - FIND THE REAL ONE!
    "function requestAttestations(bytes calldata attestationRequest) external payable", 
    // Example event - FIND THE REAL ONE!
    // "event AttestationRequestSent(address indexed sender, bytes attestationRequest, uint256 fee)", 
];

// Check if ABI is empty (placeholder)
if (STATE_CONNECTOR_ABI.length === 0) {
    console.warn("WARNING: STATE_CONNECTOR_ABI is empty. Replace with the actual ABI.");
}

const stateConnectorContract = new ethers.Contract(
    STATE_CONNECTOR_ADDRESS,
    STATE_CONNECTOR_ABI,
    wallet // Use the wallet as the signer for sending transactions
);

// --- Core Logic ---

/**
 * Fetches current weather for Seoul and triggers FDC submission request.
 */
async function checkSeoulTempConditionAndSubmit(): Promise<void> {
    console.log('Checking Seoul temperature condition and preparing FDC request...');
    
    try {
        // We don't necessarily need to fetch the data here first, 
        // the FDC nodes will fetch it based on the request.
        // But we can log the expected outcome.
        const response = await axios.get(WEATHER_API_URL);
        const temp = response.data?.main?.temp;
        if (temp !== undefined && temp !== null) {
             console.log(`Current temperature in Seoul (for logging): ${temp}°C`);
             const conditionMet = temp > TEMP_THRESHOLD_CELSIUS;
             console.log(`Temperature > ${TEMP_THRESHOLD_CELSIUS}°C condition should be: ${conditionMet}`);
        } else {
            console.warn("Could not fetch current temp for logging.");
        }

        // --- Format the FDC Attestation Request --- 
        const attestationRequest = formatAttestationRequest();
        console.log('Formatted Attestation Request (Bytes):', attestationRequest);

        // --- Submit FDC Attestation Request --- 
        // Note: FDC requests usually require paying a fee.
        await submitAttestationRequest(attestationRequest);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('Axios error during preliminary check:', error.response?.status, error.response?.data);
        } else {
            console.error('Error preparing or submitting attestation request:', error);
        }
    }
}

/**
 * Formats the data for an FDC attestation request.
 * Replace with actual FDC request structure and encoding based on Flare documentation.
 * This typically involves ABI encoding the parameters for the specific attestation type.
 * See: https://docs.flare.network/tech/state-connector/attestation-request-encoding
 * @returns {string} The ABI-encoded attestation request bytes.
 */
function formatAttestationRequest(): string {
    console.warn("Using PLACEHOLDER attestation request formatting and encoding.");
    
    // THIS IS A HIGHLY SIMPLIFIED PLACEHOLDER based on potential structure
    // The actual structure and types MUST come from Flare documentation.
    // Example structure might include:
    // - Attestation Type (e.g., API)
    // - Source ID (hash of URL parameters)
    // - Request Body (for POST/PUT, often empty for GET)
    // - Response Body Merkle Proof key (e.g., hash of 'main.temp')
    // - Recipient contract address (where the proof should be sent)
    // - Request ID (local identifier, often a nonce or timestamp)

    const abiCoder = new ethers.utils.AbiCoder();
    
    // GUESSING the types and structure - VERIFY WITH FLARE DOCS!
    const requestStruct = [
        ATTESTATION_TYPE_API,          // type (e.g., string or bytes4)
        SOURCE_ID_WEATHER_API,         // sourceId (e.g., bytes32)
        ethers.utils.toUtf8Bytes(""),  // requestBody (e.g., bytes) - empty for GET
        RESPONSE_BODY_MERKLE_PROOF_KEY,// responseBodyProofOf (e.g., bytes32)
        ATTESTATION_VERIFIER_ADDRESS,  // recipient (address)
        Math.floor(Date.now() / 1000)  // request id / deadline (e.g., uint64) - Needs clarification from docs
    ];
    
    // GUESSING the encoding types - VERIFY WITH FLARE DOCS!
    const encodedRequest = abiCoder.encode(
        ['string', 'bytes32', 'bytes', 'bytes32', 'address', 'uint64'], 
        requestStruct
    );

    return encodedRequest; 
}

/**
 * Submits the formatted attestation request to the State Connector contract.
 * @param attestationRequest - The ABI-encoded attestation request bytes.
 */
async function submitAttestationRequest(attestationRequest: string): Promise<void> {
    console.log("Attempting to submit attestation request to State Connector...");

    // TODO: Replace with the actual submission function name from the ABI
    const submitFunctionName = "requestAttestations"; // GUESS - Verify from ABI

    // TODO: Determine the required fee from Flare documentation or helper contracts
    const fee = ethers.utils.parseEther("0.01"); // COMPLETE PLACEHOLDER - FIND ACTUAL FEE MECHANISM
    console.warn(`Using PLACEHOLDER fee: ${ethers.utils.formatEther(fee)} FLR`);


    if (STATE_CONNECTOR_ABI.length === 0 || !stateConnectorContract.functions[submitFunctionName]) {
        console.error(`ERROR: State Connector ABI is empty or function '${submitFunctionName}' not found. Cannot submit.`);
        return;
    }
    
    console.warn("Using PLACEHOLDER submission logic.");

    try {
        // Example: Call the submission function with the encoded request and fee
        console.log(`Calling ${submitFunctionName} with request: ${attestationRequest}`);
        const tx = await stateConnectorContract[submitFunctionName](attestationRequest, { value: fee });
        
        console.log(`Attestation request transaction sent: ${tx.hash}`);
        console.log("Waiting for transaction confirmation...");
        const receipt = await tx.wait();
        console.log(`Attestation request transaction confirmed in block: ${receipt.blockNumber}`);
        console.log("FDC nodes should now process the request. Verification proof will be sent to:", ATTESTATION_VERIFIER_ADDRESS);

    } catch (error) {
        console.error('Error submitting attestation request to State Connector:', error);
        // Consider adding more specific error handling (e.g., insufficient funds)
    }
}

// --- Express Server ---
app.get('/verify', async (req: Request, res: Response) => {
    console.log("Received verification request via /verify endpoint...");
    // Changed to call the submission function
    await checkSeoulTempConditionAndSubmit(); 
    // The actual result comes asynchronously via the on-chain callback
    res.json({ message: "Attestation request submitted. Check on-chain verifier contract for results." });
});

app.listen(port, () => {
    console.log(`Attestation provider server listening on port ${port}`);
    // Optionally trigger an initial check on startup
    // checkSeoulTempConditionAndSubmit(); 
}); 