import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';
import { 
    createPublicClient, 
    createWalletClient, 
    http, 
    parseAbiItem, 
    toHex, 
    Hex 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { coston2Chain } from './chains'; // Assume we create a chains.ts file

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware to parse JSON bodies
app.use(express.json());

// --- Configuration (Load from environment variables) ---
const OPENWEATHERMAP_API_KEY = process.env.OPENWEATHERMAP_API_KEY;
const FLARE_RPC_URL = process.env.FLARE_RPC_URL || coston2Chain.rpcUrls.default.http[0];
const ATTESTATION_PROVIDER_PRIVATE_KEY = process.env.ATTESTATION_PROVIDER_PRIVATE_KEY as Hex | undefined;
const USER_ACTIONS_CONTRACT_ADDRESS = process.env.USER_ACTIONS_CONTRACT_ADDRESS as Hex | undefined;
const FLARE_FDC_CONTRACT_ADDRESS = process.env.FLARE_FDC_CONTRACT_ADDRESS as Hex | undefined; // Need address for FDC interaction

// Basic check for essential configuration
if (!OPENWEATHERMAP_API_KEY || !FLARE_RPC_URL || !ATTESTATION_PROVIDER_PRIVATE_KEY || !USER_ACTIONS_CONTRACT_ADDRESS || !FLARE_FDC_CONTRACT_ADDRESS) {
    console.error(
        "Missing essential environment variables. Please check your .env file. Required:",
        { 
            OPENWEATHERMAP_API_KEY: !!OPENWEATHERMAP_API_KEY,
            FLARE_RPC_URL: !!FLARE_RPC_URL,
            ATTESTATION_PROVIDER_PRIVATE_KEY: !!ATTESTATION_PROVIDER_PRIVATE_KEY,
            USER_ACTIONS_CONTRACT_ADDRESS: !!USER_ACTIONS_CONTRACT_ADDRESS,
            FLARE_FDC_CONTRACT_ADDRESS: !!FLARE_FDC_CONTRACT_ADDRESS 
        }
    );
    process.exit(1);
}

// --- Viem Clients Setup ---
const publicClient = createPublicClient({
  chain: coston2Chain,
  transport: http(FLARE_RPC_URL),
});

const account = privateKeyToAccount(ATTESTATION_PROVIDER_PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: coston2Chain,
  transport: http(FLARE_RPC_URL),
});

console.log(`Attestation Provider Wallet Address: ${account.address}`);

// --- Contract ABIs (Minimal Placeholders) ---
const userActionsAbi = [
    parseAbiItem('function recordVerifiedAction(address user, bytes32 actionType, uint256 timestamp, bytes proofData)'),
];
// TODO: Add ABI for Flare FDC contract interaction (e.g., submitting proof)
const flareFdcAbi = [
    // Example: Replace with actual FDC function signature
    // parseAbiItem('function submitAttestation(bytes32 type, bytes32 sourceId, bytes32 messageHash, address sender, bytes calldata data)'),
];

// --- FDC Attestation Logic ---

// Example: Query OpenWeatherMap for Seoul temperature
async function queryExternalAPI(params: { city?: string }): Promise<{ success: boolean; value: number | null; sourceId: string; error?: string }> {
    const city = params.city || 'Seoul'; // Default to Seoul if not specified
    const sourceId = "openweathermap.org";
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${OPENWEATHERMAP_API_KEY}&units=metric`;

    console.log(`Querying OpenWeatherMap API for ${city}...`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`OpenWeatherMap API Error (${response.status}): ${errorText}`);
            return { success: false, value: null, sourceId, error: `API Error (${response.status})` };
        }
        const data = await response.json();

        // Check if main and temp exist
        if (data && data.main && typeof data.main.temp === 'number') {
            const temp = data.main.temp;
            const conditionMet = temp > 15; // Check if temp is greater than 15°C
            console.log(`Current temperature in ${city}: ${temp}°C. Condition (temp > 15°C): ${conditionMet}`);
            return { success: conditionMet, value: temp, sourceId };
        } else {
            console.error('Invalid data structure received from OpenWeatherMap API:', data);
            return { success: false, value: null, sourceId, error: 'Invalid API response structure' };
        }
    } catch (error: any) {
        console.error("Error querying OpenWeatherMap API:", error);
        return { success: false, value: null, sourceId, error: error?.message || 'Network error' };
    }
}

async function submitAttestationToFlare(attestationData: any): Promise<Hex> {
    console.log('Preparing attestation data for Flare FDC:', attestationData);
    // TODO: Implement logic to format the attestation proof according to FDC requirements.
    // This usually involves encoding data, hashing, etc. based on the specific
    // attestation type registered with the FDC.
    const formattedProof = toHex(JSON.stringify(attestationData)); // Highly simplified placeholder
    const attestationType = toHex(attestationData.attestationType, { size: 32 }); // Example, use actual type hash
    const sourceId = toHex(attestationData.sourceId, { size: 32 }); // Example
    const messageHash = toHex(formattedProof, { size: 32 }); // Example hash

    console.log('Submitting attestation to Flare FDC contract...');
    try {
        // TODO: Replace with actual FDC contract function call and arguments
        // const { request } = await publicClient.simulateContract({
        //     address: FLARE_FDC_CONTRACT_ADDRESS,
        //     abi: flareFdcAbi,
        //     functionName: 'submitAttestation', // Replace with actual function
        //     args: [attestationType, sourceId, messageHash, account.address, formattedProof],
        //     account,
        // });
        // const txHash = await walletClient.writeContract(request);
        
        // Simulate transaction
        await new Promise(resolve => setTimeout(resolve, 200));
        const txHash: Hex = `0x${Math.random().toString(16).substring(2, 66)}`; // Placeholder tx hash

        console.log(`Flare FDC submission simulated. Tx Hash: ${txHash}`);
        return txHash;
    } catch (error) {
        console.error("Error submitting attestation to Flare FDC:", error);
        throw new Error("Flare FDC submission failed");
    }
}

async function callRecordVerifiedAction(user: string, actionType: Hex, timestamp: number, proofData: Hex): Promise<Hex> {
    console.log(`Calling recordVerifiedAction for user ${user}, actionType ${actionType}`);
    if (!USER_ACTIONS_CONTRACT_ADDRESS) throw new Error("User Actions contract address not configured");

    try {
        const { request } = await publicClient.simulateContract({
            address: USER_ACTIONS_CONTRACT_ADDRESS,
            abi: userActionsAbi,
            functionName: 'recordVerifiedAction',
            args: [user as Hex, actionType, BigInt(timestamp), proofData],
            account,
        });
        console.log("Simulated recordVerifiedAction successfully.");

        const txHash = await walletClient.writeContract(request);
        console.log(`recordVerifiedAction transaction sent. Tx Hash: ${txHash}`);

        // Optional: Wait for transaction confirmation
        // const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        // console.log('recordVerifiedAction transaction confirmed:', receipt.status);
        // if (receipt.status === 'reverted') throw new Error('recordVerifiedAction transaction reverted');
        
        return txHash;
    } catch (error) {
        console.error("Error calling recordVerifiedAction:", error);
        // Attempt to provide more specific error info if available
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to call recordVerifiedAction: ${errorMsg}`);
    }
}

// --- API Endpoints ---

app.get('/', (req: Request, res: Response) => {
    res.send('FDC Attestation Provider is running!');
});

app.post('/verify-action', async (req: Request, res: Response) => {
    // Use city from request body or default to Seoul
    const { userId, actionParams = { city: 'Seoul' } } = req.body; 

    if (!userId) { // Only userId is strictly required now
        return res.status(400).json({ error: 'Missing userId in request body' });
    }
    console.log(`Received verification request for user: ${userId} with params:`, actionParams);

    try {
        const apiResult = await queryExternalAPI(actionParams);

        if (apiResult.error) {
             console.log(`External API query failed for user ${userId}: ${apiResult.error}`);
             // Decide if this is a 500 or a 200 with failure message
             return res.status(503).json({ message: `External API query failed: ${apiResult.error}` });
        }

        if (apiResult.success) {
            console.log(`External API condition met for user ${userId}.`);
            const attestationType = "TemperatureCheckSeoul"; // Hardcoded example type

            const attestationData = {
                user: userId,
                attestationType: attestationType, 
                sourceId: apiResult.sourceId, 
                value: apiResult.value, 
                timestamp: Date.now()
            };
            const fdcTxHash = await submitAttestationToFlare(attestationData);
            console.log(`Attestation submitted to Flare. Tx Hash: ${fdcTxHash}`);

            // --- IMPORTANT: Placeholder for FDC verification confirmation ---
            console.log(`Simulating successful FDC verification for user ${userId}...`);
            await new Promise(resolve => setTimeout(resolve, 500)); 
            const isFdcVerified = true; // Placeholder 
            // ----------------------------------------------------------------

            if (isFdcVerified) {
                const actionTypeHash = toHex(attestationType, { size: 32 }); 
                const proofDataHash = fdcTxHash; 
                const currentTimestamp = Math.floor(Date.now() / 1000);
                
                const recordTxHash = await callRecordVerifiedAction(userId, actionTypeHash, currentTimestamp, proofDataHash);
                console.log(`UserActions contract updated. Tx Hash: ${recordTxHash}`);
                res.status(200).json({ message: 'Verification successful, FDC verified (simulated), action recorded.', fdcTxHash, recordTxHash });
            } else {
                 console.log(`FDC verification failed or timed out for user ${userId}.`);
                 res.status(500).json({ error: 'FDC verification failed (simulated).' });
            }

        } else {
            console.log(`External API condition NOT met for user ${userId} (Temp: ${apiResult.value}°C).`);
            res.status(200).json({ message: `Verification checked, condition (temp > 15°C) not met. Current temp: ${apiResult.value}°C` });
        }
    } catch (error: any) {
        console.error('Error processing verification request:', error);
        res.status(500).json({ error: `Internal server error: ${error.message || String(error)}` });
    }
});

// --- Server Start ---

app.listen(port, () => {
    console.log(`Attestation Provider listening on port ${port}`);
    console.log(`Make sure to create a .env file with necessary variables.`);
});
