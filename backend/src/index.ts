import express, { Request, Response } from 'express';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3001; // Use port 3001 to avoid conflict with frontend (usually 3000)

// Middleware to parse JSON bodies
app.use(express.json());

// --- Configuration (Load from environment variables) ---
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL; // e.g., OpenWeatherMap URL
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;
const FLARE_RPC_URL = process.env.FLARE_RPC_URL;         // e.g., Coston2 RPC
const ATTESTATION_PROVIDER_PRIVATE_KEY = process.env.ATTESTATION_PROVIDER_PRIVATE_KEY;
const USER_ACTIONS_CONTRACT_ADDRESS = process.env.USER_ACTIONS_CONTRACT_ADDRESS;

// Basic check for essential configuration
if (!EXTERNAL_API_URL || !FLARE_RPC_URL || !ATTESTATION_PROVIDER_PRIVATE_KEY || !USER_ACTIONS_CONTRACT_ADDRESS) {
    console.error("Missing essential environment variables. Please check your .env file.");
    process.exit(1);
}

// --- FDC Attestation Logic (Placeholders) ---

async function queryExternalAPI(params: any): Promise<any> {
    // TODO: Implement logic to query the chosen external API
    // Example: Check temperature in Seoul > 15°C
    console.log(`Querying external API: ${EXTERNAL_API_URL} with params:`, params);
    // const response = await fetch(EXTERNAL_API_URL + ... + EXTERNAL_API_KEY);
    // const data = await response.json();
    // return { success: data.main.temp > 15 }; // Example condition
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate async work
    return { success: true, value: 16 }; // Placeholder successful response
}

async function submitAttestationToFlare(attestationData: any): Promise<string> {
    // TODO: Implement logic to format the attestation proof according to FDC requirements
    // TODO: Connect to Flare network (using ethers.js/viem with FLARE_RPC_URL)
    // TODO: Use ATTESTATION_PROVIDER_PRIVATE_KEY to sign and send the transaction to the FDC contracts
    console.log('Submitting attestation to Flare:', attestationData);
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate async work
    return `0x${Math.random().toString(16).substring(2, 12)}`; // Placeholder transaction hash
}

async function callRecordVerifiedAction(user: string, actionType: string, timestamp: number, proofData: string): Promise<string> {
    // TODO: Implement logic to call the `recordVerifiedAction` function on the UserActions contract
    // TODO: Connect to Flare network (using ethers.js/viem with FLARE_RPC_URL)
    // TODO: Use ATTESTATION_PROVIDER_PRIVATE_KEY to sign and send the transaction
    // NOTE: This should ONLY be called *after* the FDC has successfully verified the attestation submitted by submitAttestationToFlare
    console.log(`Calling recordVerifiedAction for user ${user}, actionType ${actionType}`);
    await new Promise(resolve => setTimeout(resolve, 150)); // Simulate async work
    return `0x${Math.random().toString(16).substring(2, 12)}`; // Placeholder transaction hash
}

// --- API Endpoints ---

app.get('/', (req: Request, res: Response) => {
    res.send('FDC Attestation Provider is running!');
});

/**
 * @route POST /verify-action
 * @description Endpoint to trigger the verification of a user action.
 * Body: { userId: string, actionParams: any } (Example structure)
 */
app.post('/verify-action', async (req: Request, res: Response) => {
    const { userId, actionParams } = req.body;

    if (!userId || !actionParams) {
        return res.status(400).json({ error: 'Missing userId or actionParams in request body' });
    }

    console.log(`Received verification request for user: ${userId}`);

    try {
        // 1. Query the external API
        const apiResult = await queryExternalAPI(actionParams);

        // 2. Check if the condition is met
        if (apiResult.success) {
            console.log(`External API condition met for user ${userId}.`);

            // 3. Prepare and submit attestation data to Flare FDC
            const attestationData = {
                user: userId,
                // Define specific attestation type based on actionParams/API result
                attestationType: "TemperatureCheckSeoul", // Example
                sourceId: "OpenWeatherMap", // Example
                value: apiResult.value, // Example
                timestamp: Date.now()
            };
            const fdcTxHash = await submitAttestationToFlare(attestationData);
            console.log(`Attestation submitted to Flare. Tx Hash: ${fdcTxHash}`);

            // --- IMPORTANT --- 
            // In a real implementation, you would need to wait for the FDC
            // to process and verify the attestation.
            // This might involve polling the FDC status or listening for events.
            // Only after successful verification should you call `recordVerifiedAction`.
            // ------------------

            // 4. (Simulated Post-FDC Verification) Call the UserActions contract
            // TODO: Replace placeholder logic with actual post-FDC confirmation
            console.log(`Simulating successful FDC verification for user ${userId}...`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
            
            const actionTypeHash = "0x..."; // TODO: Calculate keccak256 hash matching contract
            const recordTxHash = await callRecordVerifiedAction(userId, actionTypeHash, Math.floor(Date.now() / 1000), fdcTxHash);
            console.log(`UserActions contract updated. Tx Hash: ${recordTxHash}`);

            res.status(200).json({ message: 'Verification successful, attestation submitted, action recorded (simulated).', fdcTxHash, recordTxHash });
        } else {
            console.log(`External API condition NOT met for user ${userId}.`);
            res.status(200).json({ message: 'Verification checked, condition not met.' });
        }
    } catch (error) {
        console.error('Error processing verification request:', error);
        res.status(500).json({ error: 'Internal server error during verification.' });
    }
});

// --- Server Start ---

app.listen(port, () => {
    console.log(`Attestation Provider listening on port ${port}`);
    console.log(`Make sure to create a .env file with necessary variables.`);
});
