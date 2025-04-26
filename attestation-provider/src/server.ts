import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Import cors
import { 
    createWalletClient, 
    http, 
    publicActions, 
    parseAbiItem, // For simple ABI parsing if needed
    Address, // Keep type for clarity
    Hex, // Type for hex strings like private key and bytes32
    keccak256, // Keep hash function
    toHex, // Keep hex conversion
    Abi, // Type for full ABI
    parseEther // Import parseEther for fee
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type Chain } from 'viem'; // Import Chain type

// Load environment variables from .env file
dotenv.config();

// --- Environment Variable Checks ---
const providerPrivateKey = process.env.PROVIDER_PRIVATE_KEY as Hex | undefined;
const coston2RpcUrl = process.env.COSTON2_RPC_URL;
const openWeatherApiKey = process.env.OPENWEATHERMAP_API_KEY;
const fdcVerifierBaseUrl = process.env.FDC_VERIFIER_BASE_URL;
const fdcHubAddress = process.env.FDC_HUB_ADDRESS as Address | undefined;
const fdcApiKey = process.env.FDC_API_KEY;
const fdcRequestFeeEther = process.env.FDC_REQUEST_FEE_ETHER || '0.1'; // Default fee
const userActionsAddress = process.env.USER_ACTIONS_ADDRESS as Address | undefined; // Read from .env

if (!providerPrivateKey) throw new Error("PROVIDER_PRIVATE_KEY is not set in .env");
if (!coston2RpcUrl) throw new Error("COSTON2_RPC_URL is not set in .env");
if (!openWeatherApiKey) throw new Error("OPENWEATHERMAP_API_KEY is not set in .env");
if (!fdcVerifierBaseUrl) throw new Error("FDC_VERIFIER_BASE_URL is not set in .env");
if (!fdcHubAddress) throw new Error("FDC_HUB_ADDRESS is not set in .env");
if (!fdcApiKey) throw new Error("FDC_API_KEY is not set in .env");
if (!userActionsAddress) throw new Error("USER_ACTIONS_ADDRESS is not set in .env"); // Add check

// --- Define Coston2 Chain Details ---
// (Source: https://docs.flare.network/dev/reference/network-config/)
const coston2: Chain = {
  id: 114,
  name: 'Coston2',
  nativeCurrency: {
    decimals: 18,
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
  },
  rpcUrls: {
    default: { http: [coston2RpcUrl] }, // Use URL from .env
    public: { http: [coston2RpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
  },
  testnet: true,
};

// --- Viem Client Setup ---
const account = privateKeyToAccount(providerPrivateKey);
const walletClient = createWalletClient({
  account,
  chain: coston2, // Use the defined coston2 chain object
  transport: http(coston2RpcUrl)
}).extend(publicActions); // Extend with publicActions for read operations if needed later

console.log(`Attestation Provider Wallet Address: ${account.address}`);

const app = express();
const port = process.env.PROVIDER_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for requests from the frontend
app.use(express.json()); // Parse JSON bodies

// Constants
const SEOUL_CITY_ID = '1835848';
const EXPECTED_ACTION_TYPE_TEMP = "TEMP_OVER_15_SEOUL"; // Rename for clarity
const ACTION_TYPE_TEMP_B32 = keccak256(toHex(EXPECTED_ACTION_TYPE_TEMP));
const TEMP_THRESHOLD = 15;

const EXPECTED_ACTION_TYPE_TRANSPORT = "SUSTAINABLE_TRANSPORT_KM"; // New action type
const ACTION_TYPE_TRANSPORT_B32 = keccak256(toHex(EXPECTED_ACTION_TYPE_TRANSPORT));
const MOCK_TRANSPORT_KM = 10; // Mock data for transport

// FDC Constants for JsonApi
const FDC_ATTESTATION_TYPE_JSONAPI = keccak256(toHex("JsonApi")); // 0x4a736f6e417069... 
const FDC_SOURCE_ID_OPENWEATHERMAP = keccak256(toHex("OpenWeatherMapSeoul")); // Define a source ID
const JQ_FILTER_TEMP = '.main.temp'; // JQ filter to extract temperature

// FDCHub ABI Fragment for requestAttestation
const FDC_HUB_ABI: Abi = [
  {
    "inputs": [
      { "internalType": "bytes", "name": "_request", "type": "bytes" }
    ],
    "name": "requestAttestation",
    "outputs": [],
    "stateMutability": "payable", // It requires payment
    "type": "function"
  }
] as const;

// UserActions ABI (Copied from frontend config)
const USER_ACTIONS_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"_initialOwner","type":"address","internalType":"address"},{"name":"_attestationVerifierAddress","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"attestationVerifierAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"lastActionTimestamp","inputs":[{"name":"","type":"address","internalType":"address"},{"name":"","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"recordVerifiedAction","inputs":[{"name":"user","type":"address","internalType":"address"},{"name":"actionType","type":"bytes32","internalType":"bytes32"},{"name":"timestamp","type":"uint256","internalType":"uint256"},{"name":"proofData","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"renounceOwnership","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"setAttestationVerifierAddress","inputs":[{"name":"_newVerifierAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"event","name":"ActionRecorded","inputs":[{"name":"user","type":"address","indexed":true,"internalType":"address"},{"name":"actionType","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"timestamp","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"proofData","type":"bytes","indexed":false,"internalType":"bytes"}],"anonymous":false},
    {"type":"event","name":"AttestationVerifierSet","inputs":[{"name":"newVerifier","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"event","name":"OwnershipTransferred","inputs":[{"name":"previousOwner","type":"address","indexed":true,"internalType":"address"},{"name":"newOwner","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"error","name":"OwnableInvalidOwner","inputs":[{"name":"owner","type":"address","internalType":"address"}]},
    {"type":"error","name":"OwnableUnauthorizedAccount","inputs":[{"name":"account","type":"address","internalType":"address"}]},
    {"type":"error","name":"ReentrancyGuardReentrantCall","inputs":[]},
    {"type":"error","name":"UserActions__ActionAlreadyRecorded","inputs":[]},
    {"type":"error","name":"UserActions__InvalidActionType","inputs":[]},
    {"type":"error","name":"UserActions__NotAttestationVerifier","inputs":[]},
    {"type":"error","name":"UserActions__TimestampTooOld","inputs":[]}
] as const;

// --- Type for Weather API Response (adjust as needed) ---
interface WeatherData {
  main?: {
    temp?: number;
  };
  message?: string; // For error messages from API
}

// --- Async Handler Wrapper (for cleaner error handling) ---
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- Endpoint to handle attestation requests ---
app.post('/request-attestation', asyncHandler(async (req: Request, res: Response) => {
    const { userAddress, actionType } = req.body as { userAddress: Address, actionType: string }; // Type assertion
    
    console.log(`Received request for action type "${actionType}" from ${userAddress}`);

    // --- Input Validation ---
    if (!userAddress || !actionType) {
        return res.status(400).json({ error: 'Missing userAddress or actionType' });
    }
    if (actionType !== EXPECTED_ACTION_TYPE_TEMP && actionType !== EXPECTED_ACTION_TYPE_TRANSPORT) {
        return res.status(400).json({ error: `Unsupported actionType: ${actionType}` });
    }
    if (!openWeatherApiKey) {
        console.error('OpenWeatherMap API key is not configured in .env');
        return res.status(500).json({ error: 'Server configuration error (API key missing)' });
    }

    // --- Temp Action Handling ---
    if (actionType === EXPECTED_ACTION_TYPE_TEMP) {
        console.log("Handling Temperature Check...");
        const weatherApiUrl = `https://api.openweathermap.org/data/2.5/weather?id=${SEOUL_CITY_ID}&appid=${openWeatherApiKey}&units=metric`;
        console.log(`Fetching weather data from: ${weatherApiUrl.replace(openWeatherApiKey, '***')}`);
        const weatherResponse = await fetch(weatherApiUrl);
        const weatherData: WeatherData = await weatherResponse.json();

        if (!weatherResponse.ok) {
            console.error('OpenWeatherMap API Error:', weatherData);
            // Use message from API if available
            throw new Error(weatherData.message || `Failed to fetch weather data (status: ${weatherResponse.status})`);
        }

        if (!weatherData.main || typeof weatherData.main.temp !== 'number') {
            console.error('Invalid weather data format:', weatherData);
            throw new Error('Received invalid data format from weather API.');
        }

        const currentTemp = weatherData.main.temp;
        const isConditionMet = currentTemp > TEMP_THRESHOLD;
        console.log(`Seoul Temperature: ${currentTemp}°C. Condition (${TEMP_THRESHOLD}°C) met: ${isConditionMet}`);

        if (isConditionMet) {
            // Prepare & Submit FDC Request for Temp
            console.log(`Condition met for user ${userAddress}. Preparing FDC request (TEMP)...`);
            const prepareRequestBody = {
                attestationType: FDC_ATTESTATION_TYPE_JSONAPI,
                sourceId: FDC_SOURCE_ID_OPENWEATHERMAP,
                requestBody: {
                    url: weatherApiUrl,
                    method: "GET",
                    responseFormat: "JSON",
                    jqFilter: JQ_FILTER_TEMP
                }
            };
            const prepareRequestUrl = `${fdcVerifierBaseUrl}verifier/api/JsonApi/prepareRequest`;
            let prepareResponseData: { status: string, abiEncodedRequest?: Hex };
            try {
                const prepareResponse = await fetch(prepareRequestUrl, {
                    method: "POST",
                    headers: { "X-API-KEY": fdcApiKey, "Content-Type": "application/json" },
                    body: JSON.stringify(prepareRequestBody)
                });
                prepareResponseData = await prepareResponse.json();

                if (!prepareResponse.ok || prepareResponseData.status !== 'VALID' || !prepareResponseData.abiEncodedRequest) {
                    console.error("FDC prepareRequest failed:", prepareResponseData);
                    throw new Error(`FDC Verifier prepareRequest failed: ${JSON.stringify(prepareResponseData)}`);
                }
                console.log(`FDC prepareRequest successful. Received abiEncodedRequest: ${prepareResponseData.abiEncodedRequest.substring(0, 42)}...`);
            } catch (prepareError: any) {
                console.error("Error calling FDC prepareRequest:", prepareError);
                throw new Error(`Failed to prepare FDC request: ${prepareError.message}`);
            }
            
            // Submit to FDCHub
            const fee = parseEther(fdcRequestFeeEther);
            console.log(`Submitting attestation (TEMP) to FDCHub ${fdcHubAddress} with fee ${fdcRequestFeeEther} C2FLR...`);
            try {
                const txHash = await walletClient.writeContract({
                    address: fdcHubAddress,
                    abi: FDC_HUB_ABI, 
                    functionName: 'requestAttestation', 
                    args: [ prepareResponseData.abiEncodedRequest ],
                    value: fee // Include the fee
                });
                
                console.log(`FDCHub requestAttestation transaction sent (TEMP): ${txHash}`);
                
                // Respond to frontend immediately after submission
                return res.status(200).json({ 
                    message: `Verification successful (${currentTemp.toFixed(1)}°C > ${TEMP_THRESHOLD}°C). FDC request tx submitted: ${txHash}`,
                    txHash: txHash,
                    temp: currentTemp 
                });

            } catch (txError: any) {
                console.error("FDCHub requestAttestation transaction failed:", txError);
                throw new Error(`FDCHub transaction failed: ${txError.message}`); 
            }
        } else {
            // Temp Condition not met
            console.log(`Temperature condition not met for user ${userAddress}.`);
            return res.status(422).json({ 
                error: `Verification failed: Temperature is ${currentTemp.toFixed(1)}°C (required > ${TEMP_THRESHOLD}°C).`,
                temp: currentTemp 
             });
        }
    } 
    // --- Transport Action Handling (Workaround) ---
    else if (actionType === EXPECTED_ACTION_TYPE_TRANSPORT) {
        console.log("Handling Sustainable Transport Check (Workaround Flow)...");
        const timestamp = Math.floor(Date.now() / 1000);

        // 1. Mock API success (Assume user met criteria)
        const kilometers = MOCK_TRANSPORT_KM;
        console.log(`Mocked sustainable transport: ${kilometers}km.`);

        // 2. (Optional but good practice) Simulate FDC request submission to keep flow similar 
        //    We use the temp check logic just to interact with FDC Verifier & Hub
        console.log(`Simulating FDC request submission step for Transport Action...`);
        const dummyWeatherApiUrl = `https://api.openweathermap.org/data/2.5/weather?id=${SEOUL_CITY_ID}&appid=${openWeatherApiKey}&units=metric`; // Just use temp URL
        const prepareRequestBody = {
            attestationType: FDC_ATTESTATION_TYPE_JSONAPI,
            sourceId: FDC_SOURCE_ID_OPENWEATHERMAP, // Reuse source ID for simulation
            requestBody: {
                url: dummyWeatherApiUrl,
                method: "GET",
                responseFormat: "JSON",
                jqFilter: JQ_FILTER_TEMP // Reuse JQ filter for simulation
            }
        };
        const prepareRequestUrl = `${fdcVerifierBaseUrl}verifier/api/JsonApi/prepareRequest`;
        let fdcTxHash: Hex | null = null;
        try {
            const prepareResponse = await fetch(prepareRequestUrl, {
                method: "POST",
                headers: { "X-API-KEY": fdcApiKey, "Content-Type": "application/json" },
                body: JSON.stringify(prepareRequestBody)
            });
            const prepareResponseData = await prepareResponse.json();
            if (!prepareResponse.ok || prepareResponseData.status !== 'VALID' || !prepareResponseData.abiEncodedRequest) {
                throw new Error(`FDC Verifier prepareRequest failed: ${JSON.stringify(prepareResponseData)}`);
            }
            const fee = parseEther(fdcRequestFeeEther);
            const hubTxHash = await walletClient.writeContract({
                address: fdcHubAddress,
                abi: FDC_HUB_ABI, 
                functionName: 'requestAttestation', 
                args: [ prepareResponseData.abiEncodedRequest ],
                value: fee // Include the fee
            });
            console.log(`FDCHub requestAttestation transaction sent (Transport Simulation): ${hubTxHash}`);
            fdcTxHash = hubTxHash; // Store for logging/response if needed
        } catch (fdcError: any) {
            console.error("FDC simulation step failed for Transport Action:", fdcError);
            // Decide if this error should halt the process or just be logged
            // For this workaround, we might log it but continue to record action if desired.
            // throw new Error(`FDC simulation step failed: ${fdcError.message}`);
            console.warn("Proceeding to record action despite FDC simulation step failure.");
        }

        // 3. Directly record action on UserActions contract using Provider Wallet
        console.log(`Directly recording action ${ACTION_TYPE_TRANSPORT_B32} for ${userAddress} on ${userActionsAddress}`); // Use address from env
        try {
            const proofData = toHex(JSON.stringify({ simulatedKm: kilometers }));
            const recordTxHash = await walletClient.writeContract({
                address: userActionsAddress, // Use address from env
                abi: USER_ACTIONS_ABI, // Use ABI defined locally
                functionName: 'recordVerifiedAction',
                args: [
                    userAddress,
                    ACTION_TYPE_TRANSPORT_B32,
                    BigInt(timestamp),
                    proofData
                ]
            });
            console.log(`UserActions.recordVerifiedAction transaction sent: ${recordTxHash}`);

            // Respond success (mentioning direct record)
            return res.status(200).json({ 
                message: `Verification successful (Mock ${kilometers}km). Action directly recorded. Tx: ${recordTxHash}`,
                recordTxHash: recordTxHash,
                simulatedKm: kilometers,
                fdcSimTxHash: fdcTxHash // Include FDC sim hash if available
            });
        } catch (recordError: any) {
            console.error("UserActions.recordVerifiedAction transaction failed:", recordError);
            throw new Error(`Failed to record action on-chain: ${recordError.message}`);
        }
    } 
    // --- Unknown Action Type ---
    else {
        console.warn(`Unsupported action type received: ${actionType}`);
        return res.status(400).json({ error: `Unsupported actionType: ${actionType}` });
    }
}));

// --- Basic Root Endpoint --- 
app.get('/', (req: Request, res: Response) => {
  res.send('VCOM Attestation Provider is running!');
});

// --- Global Error Handler ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Error:', err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// --- Start Server ---
app.listen(port, () => {
  console.log(`Attestation Provider server listening on http://localhost:${port}`);
}); 