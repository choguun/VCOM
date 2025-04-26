import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';
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
import { type Chain } from 'viem';

dotenv.config();

const providerPrivateKey = process.env.PROVIDER_PRIVATE_KEY as Hex | undefined;
const coston2RpcUrl = process.env.COSTON2_RPC_URL;
const openWeatherApiKey = process.env.OPENWEATHERMAP_API_KEY;
const fdcVerifierBaseUrl = process.env.FDC_VERIFIER_BASE_URL;
const fdcHubAddress = process.env.FDC_HUB_ADDRESS as Address | undefined;
const fdcApiKey = process.env.FDC_API_KEY;
const fdcRequestFeeEther = process.env.FDC_REQUEST_FEE_ETHER || '0.1'; // Default fee
const userActionsAddress = process.env.USER_ACTIONS_ADDRESS as Address | undefined;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!providerPrivateKey) throw new Error("PROVIDER_PRIVATE_KEY is not set in .env");
if (!coston2RpcUrl) throw new Error("COSTON2_RPC_URL is not set in .env");
if (!openWeatherApiKey) throw new Error("OPENWEATHERMAP_API_KEY is not set in .env");
if (!fdcVerifierBaseUrl) throw new Error("FDC_VERIFIER_BASE_URL is not set in .env");
if (!fdcHubAddress) throw new Error("FDC_HUB_ADDRESS is not set in .env");
if (!fdcApiKey) throw new Error("FDC_API_KEY is not set in .env");
if (!userActionsAddress) throw new Error("USER_ACTIONS_ADDRESS is not set in .env"); // Add check
if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not set in .env"); // <-- Add check

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

const account = privateKeyToAccount(providerPrivateKey);
const walletClient = createWalletClient({
  account,
  chain: coston2, // Use the defined coston2 chain object
  transport: http(coston2RpcUrl)
}).extend(publicActions); // Extend with publicActions for read operations if needed later

console.log(`Attestation Provider Wallet Address: ${account.address}`);

const openai = new OpenAI({
    apiKey: openaiApiKey,
});

const app = express();
const port = process.env.PROVIDER_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for requests from the frontend
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies with a larger limit

// Constants
const SEOUL_CITY_ID = '1835848';
const EXPECTED_ACTION_TYPE_TEMP = "TEMP_OVER_15_SEOUL";
const TEMP_THRESHOLD = 15;

const EXPECTED_ACTION_TYPE_TRANSPORT = "SUSTAINABLE_TRANSPORT_KM"; // New action type
const ACTION_TYPE_TRANSPORT_B32 = keccak256(toHex(EXPECTED_ACTION_TYPE_TRANSPORT));

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

interface WeatherData {
  main?: {
    temp?: number;
  };
  message?: string; // For error messages from API
}

interface VisionVerificationResult {
  activityType?: string; // e.g., "cycling", "walking", "other"
  distanceKm?: number;
  date?: string; // e.g., "YYYY-MM-DD"
  error?: string; // Error message from AI parsing
}

async function verifyTransportWithVision(base64Image: string): Promise<{ success: boolean; distance: number | null; details?: VisionVerificationResult; error?: string }> {
    console.log("Verifying transport screenshot with OpenAI Vision...");
    const minDistanceKm = 5; // Minimum required distance

    if (!base64Image || !base64Image.startsWith('data:image/')) {
        return { success: false, distance: null, error: "Invalid image data provided." };
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 300,
            messages: [
                // --- System Prompt --- 
                {
                    role: "system",
                    content: "You are an AI assistant specialized in analyzing screenshots from fitness tracking apps (like Garmin Connect, Strava, etc.). Your task is to identify sustainable transport activities (cycling, walking, running, etc.), the distance covered in kilometers, and the date. You MUST respond ONLY with a single, valid JSON object containing the keys \"activityType\", \"distanceKm\", and \"date\". Do not include any explanations or introductory text. If you cannot reliably determine the required information, use \"other\" for activityType, null for distanceKm, or null for the date within the JSON structure."
                },
                // --- User Prompt --- 
                {
                    role: "user",
                    content: [
                        { 
                            type: "text", 
                            // User text now just presents the request, context is in system prompt
                            text: `Analyze the attached fitness app screenshot and provide the activity details in the required JSON format.` 
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64Image, // Send the full base64 string with prefix
                                detail: "low" // Use low detail for efficiency
                            },
                        },
                    ],
                },
            ],
        });

        const aiResponseContent = completion.choices[0]?.message?.content;
        
        // Ensure we have a non-empty string before proceeding
        if (typeof aiResponseContent !== 'string' || aiResponseContent.trim() === '') {
            console.error("OpenAI response content was invalid or empty:", aiResponseContent);
            throw new Error("OpenAI response content was invalid or empty.");
        }
        
        // Assign to a new constant after the type guard
        const responseString: string = aiResponseContent; 

        console.log("Raw OpenAI response:", responseString);

        // Attempt to parse the JSON response (remove potential markdown backticks)
        let parsedResponse: VisionVerificationResult;
        try {
            // Clean the response using the guaranteed string constant
            const cleanedResponse = responseString.replace(/^```json\n?|\n?```$/g, ''); 
            parsedResponse = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error("Failed to parse JSON from OpenAI:", responseString);
            throw new Error(`AI did not return valid JSON. Response: ${responseString}`);
        }

        console.log("Parsed OpenAI response:", parsedResponse);

        // Validate the parsed data
        const { activityType, distanceKm } = parsedResponse;
        // Allow null values as per system prompt instruction if data is missing
        if (!activityType) {
             return { success: false, distance: null, details: parsedResponse, error: "AI response missing required field: activityType." };
        }
        if (activityType === 'other') {
            return { success: false, distance: distanceKm ?? null, details: parsedResponse, error: `Activity type identified as 'other' or could not be determined.` };
        }
        if (activityType !== "cycling" && activityType !== "walking") {
            // This case might be less likely if the system prompt works well, but keep as safeguard
            return { success: false, distance: distanceKm ?? null, details: parsedResponse, error: `Unsupported activity type detected: ${activityType}. Expected 'cycling' or 'walking'.` };
        }
        // Check distance if activity is valid
        if (distanceKm === null || typeof distanceKm !== 'number') {
             return { success: false, distance: null, details: parsedResponse, error: "AI response missing or invalid field: distanceKm." };
        }
         if (distanceKm < minDistanceKm) {
            return { success: false, distance: distanceKm, details: parsedResponse, error: `Distance ${distanceKm}km is less than the required ${minDistanceKm}km.` };
        }
        // Check date format if present
        // if (date === null) {
        //      return { success: false, distance: distanceKm, details: parsedResponse, error: "AI response missing required field: date." };
        // }
        // if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        //      return { success: false, distance: distanceKm, details: parsedResponse, error: `Invalid date format detected: ${date}. Expected YYYY-MM-DD.` };
        // }
        
        // TODO: Add date validation (check against UserActions last recorded timestamp to prevent replay)

        console.log(`Vision verification successful: ${activityType}, ${distanceKm}km`);
        return { success: true, distance: distanceKm, details: parsedResponse };

    } catch (error: any) {
        console.error("Error during OpenAI Vision API call:", error);
        const errorMessage = error.response?.data?.error?.message || error.message || "Unknown error calling OpenAI Vision API.";
        return { success: false, distance: null, error: errorMessage };
    }
}

// --- Async Handler Wrapper (for cleaner error handling) ---
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// --- Endpoint to handle attestation requests ---
app.post('/request-attestation', asyncHandler(async (req: Request, res: Response) => {
    const { userAddress, actionType, screenshotBase64 } = req.body as { userAddress: Address, actionType: string, screenshotBase64?: string }; 
    
    console.log(`Received request for action type "${actionType}" from ${userAddress}`);

    // --- Input Validation ---
    if (!userAddress || !actionType) {
        return res.status(400).json({ error: 'Missing userAddress or actionType' });
    }
    if (actionType !== EXPECTED_ACTION_TYPE_TEMP && actionType !== EXPECTED_ACTION_TYPE_TRANSPORT) {
        return res.status(400).json({ error: `Unsupported actionType: ${actionType}` });
    }
    
    // Validation specific to transport action
    if (actionType === EXPECTED_ACTION_TYPE_TRANSPORT && !screenshotBase64) {
        return res.status(400).json({ error: 'Missing screenshotBase64 for transport verification' });
    }

    // --- Temp Action Handling (Keep existing logic if needed) ---
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
    // --- Transport Action Handling (Using OpenAI Vision) ---
    else if (actionType === EXPECTED_ACTION_TYPE_TRANSPORT) {
        console.log("Handling Sustainable Transport Check (OpenAI Vision Flow)...");
        
        // 1. Verify Screenshot with OpenAI Vision
        const verificationResult = await verifyTransportWithVision(screenshotBase64 as string);

        if (!verificationResult.success) {
            console.error("Screenshot verification failed:", verificationResult.error);
            return res.status(422).json({ // 422 Unprocessable Entity seems appropriate
                error: `Screenshot verification failed: ${verificationResult.error}`,
                details: verificationResult.details // Include details if available
            });
        }

        const { distance } = verificationResult; // Verified distance
        const timestamp = Math.floor(Date.now() / 1000);

        // 2. Directly record action on UserActions contract
        console.log(`Recording action ${ACTION_TYPE_TRANSPORT_B32} for ${userAddress} on ${userActionsAddress}`);
        try {
            // Include verified details in proofData
            const proofData = toHex(JSON.stringify({ 
                verifiedKm: distance, 
                verificationMethod: "OpenAI-Vision",
                activityType: verificationResult.details?.activityType,
                // date: verificationResult.details?.date
            })); 
            const recordTxHash = await walletClient.writeContract({
                address: userActionsAddress,
                abi: USER_ACTIONS_ABI,
                functionName: 'recordVerifiedAction',
                args: [
                    userAddress,
                    ACTION_TYPE_TRANSPORT_B32,
                    BigInt(timestamp),
                    proofData // Store verification details
                ]
            });
            console.log(`UserActions.recordVerifiedAction transaction sent: ${recordTxHash}`);

            // Respond success
            return res.status(200).json({ 
                message: `Verification successful (${distance}km verified via Vision). Action recorded. Tx: ${recordTxHash}`,
                recordTxHash: recordTxHash,
                verifiedKm: distance,
                details: verificationResult.details
            });
        } catch (recordError: any) {
            console.error("UserActions.recordVerifiedAction transaction failed:", recordError);
            // Extract specific Viem error if possible
             const errorMessage = recordError.shortMessage || recordError.message || "Failed to record action on-chain";
            // Send 500 for contract interaction errors
            return res.status(500).json({ error: `Failed to record action on-chain: ${errorMessage}` }); 
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
