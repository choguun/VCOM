'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { flareTestnet } from 'wagmi/chains';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, Upload } from "lucide-react";
import { 
    USER_ACTIONS_ADDRESS,
    CARBON_CREDIT_NFT_ADDRESS,
    USER_ACTIONS_ABI,
    CLAIM_TRANSPORT_NFT_ABI
} from '@/config/contracts';
import { keccak256, toHex, decodeEventLog } from 'viem';
import Confetti from 'react-confetti';

// Constants for action types
const ACTION_TYPE_TEMP = "TEMP_OVER_15_SEOUL";
const ACTION_TYPE_TRANSPORT = "SUSTAINABLE_TRANSPORT_KM";
const ACTION_TYPE_TEMP_B32 = keccak256(toHex(ACTION_TYPE_TEMP));
const ACTION_TYPE_TRANSPORT_B32 = keccak256(toHex(ACTION_TYPE_TRANSPORT));

const ATTESTATION_PROVIDER_API_URL = process.env.NEXT_PUBLIC_ATTESTATION_PROVIDER_URL || 'http://localhost:3001';

interface ActionStatus {
    lastRecordedTimestamp: number;
    isVerifying: boolean;
    verifyError: string | null;
    verifySuccessMessage: string | null;
    isClaiming: boolean;
    claimError: string | null;
    claimSuccessTx: string | null;
    canClaim: boolean;
    // --- New state for file handling ---
    selectedFile: File | null;
    selectedFileName: string;
    isReadingFile: boolean;
    // --- New state for FDC flow ---
    validationId: string | null; // Store the ID received from the provider
    pollingIntervalId: NodeJS.Timeout | null; // To manage status polling
    currentStatus: string | null; // Display current status from provider
    backendStatus: string | null; // Store the raw status identifier from backend
}

export default function ActionsPage() {
    const { address: userAddress, isConnected } = useAccount();
    const [showConfetti, setShowConfetti] = useState(false);

    // --- State Management for Actions --- 
    const [actionStatuses, setActionStatuses] = useState<{
        [key: string]: ActionStatus
    }>(() => ({
        [ACTION_TYPE_TEMP]: { 
            lastRecordedTimestamp: 0, isVerifying: false, verifyError: null, verifySuccessMessage: null, 
            isClaiming: false, claimError: null, claimSuccessTx: null, canClaim: false,
            selectedFile: null, selectedFileName: '', isReadingFile: false, // Add file state
            validationId: null, pollingIntervalId: null, currentStatus: null, // Add FDC state
            backendStatus: null // Initialize backendStatus
        },
        [ACTION_TYPE_TRANSPORT]: { 
            lastRecordedTimestamp: 0, isVerifying: false, verifyError: null, verifySuccessMessage: null, 
            isClaiming: false, claimError: null, claimSuccessTx: null, canClaim: false,
            selectedFile: null, selectedFileName: '', isReadingFile: false, // Add file state
            validationId: null, pollingIntervalId: null, currentStatus: null, // Add FDC state
            backendStatus: null // Initialize backendStatus
        },
    }));

    const updateActionStatus = (actionType: string, updates: Partial<ActionStatus>) => {
        setActionStatuses(prev => ({
            ...prev,
            [actionType]: { ...prev[actionType], ...updates }
        }));
    };

    // --- Status Polling Logic ---

    const stopStatusPolling = useCallback((actionType: string) => {
        const status = actionStatuses[actionType];
        if (status.pollingIntervalId) {
            clearInterval(status.pollingIntervalId);
            updateActionStatus(actionType, { pollingIntervalId: null });
            console.log(`Stopped polling for ${actionType}`);
        }
    }, [actionStatuses]); // Dependency needed to access current status state

    const checkStatus = useCallback(async (actionType: string, validationId: string) => {
        console.log(`Checking status for ${actionType} (${validationId})...`);
        try {
            const response = await fetch(`${ATTESTATION_PROVIDER_API_URL}/api/v1/validation-result/${validationId}`);
            if (!response.ok) {
                // If record not found yet, keep polling silently for a bit
                if (response.status === 404) {
                    console.log(`Validation record ${validationId} not found yet, continuing poll.`);
                    updateActionStatus(actionType, { currentStatus: "Provider processing request..." });
                    return; 
                }
                const errorData = await response.json().catch(() => ({})); // Catch JSON parse errors
                throw new Error(errorData.error || `Failed to fetch status: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`Received status update for ${validationId}:`, data.status);

            let statusMessage = `Status: ${data.status}`;
            if (data.errorMessage) {
                statusMessage += ` - ${data.errorMessage}`;
            }
            updateActionStatus(actionType, { 
                currentStatus: statusMessage, 
                backendStatus: data.status // Store the raw backend status
            });

            // Handle final states
            if (data.status === 'complete') {
                console.log(`Verification complete for ${validationId}. Enabling claim.`);
                updateActionStatus(actionType, {
                    canClaim: true,
                    verifySuccessMessage: "Verification process complete! Ready to claim.",
                    currentStatus: "Complete! Ready to claim.",
                    verifyError: null,
                });
                stopStatusPolling(actionType); // Stop polling on success
            } else if (data.status === 'error_processing') {
                console.error(`Processing error for ${validationId}:`, data.errorMessage);
                updateActionStatus(actionType, {
                    verifyError: `Processing failed: ${data.errorMessage || 'Unknown provider error'}`,
                    currentStatus: `Error: ${data.errorMessage || 'Unknown provider error'}`,
                    canClaim: false,
                });
                stopStatusPolling(actionType); // Stop polling on error
            } else if (data.status === 'failed') { // Handle OpenAI failure reported by provider
                 console.error(`Verification failed for ${validationId}:`, data.errorMessage);
                 updateActionStatus(actionType, {
                     verifyError: `Verification failed: ${data.errorMessage || 'Provider reported failure.'}`,
                     currentStatus: `Failed: ${data.errorMessage || 'Provider reported failure.'}`,
                     canClaim: false,
                 });
                stopStatusPolling(actionType); 
            }
            // Keep polling for 'verified' or 'pending_fdc'

        } catch (error: any) {
            console.error(`Error checking status for ${validationId}:`, error);
            updateActionStatus(actionType, { 
                verifyError: `Failed to check status: ${error.message}`,
                currentStatus: `Error checking status: ${error.message}`
            });
            stopStatusPolling(actionType); // Stop polling on fetch error
        }
    }, [stopStatusPolling]); // Include stopStatusPolling

    const startStatusPolling = useCallback((actionType: string, validationId: string) => {
        // Clear any existing interval for this action type first
        stopStatusPolling(actionType);

        console.log(`Starting status polling for ${actionType} (${validationId})`);
        // Initial check immediately
        checkStatus(actionType, validationId);

        // Then poll every 5 seconds (adjust interval as needed)
        const intervalId = setInterval(() => {
            // Refetch the validationId from the state inside the interval
            // This ensures we use the latest state if handleVerify is called again quickly
            const currentValidationId = actionStatuses[actionType]?.validationId;
            if (currentValidationId) {
                 checkStatus(actionType, currentValidationId);
            } else {
                 console.warn(`Polling interval for ${actionType} found no validationId, stopping.`);
                 stopStatusPolling(actionType); // Should not happen ideally
            }
           
        }, 5000); // Poll every 5 seconds

        updateActionStatus(actionType, { pollingIntervalId: intervalId });
    }, [checkStatus, stopStatusPolling, actionStatuses]); // actionStatuses needed for check inside interval

    // --- Cleanup polling intervals on unmount or user change ---
    useEffect(() => {
        return () => {
            Object.keys(actionStatuses).forEach(actionType => {
                stopStatusPolling(actionType);
            });
        };
    }, [stopStatusPolling]); // Only needs stopStatusPolling which has actionStatuses dependency internally

    // --- Read Last Action Timestamps --- 
    const { data: lastTempTimestampData } = useReadContract({
        address: USER_ACTIONS_ADDRESS,
        abi: USER_ACTIONS_ABI,
        functionName: 'lastActionTimestamp',
        args: [userAddress!, ACTION_TYPE_TEMP_B32],
        query: { enabled: !!userAddress },
    });
    const { data: lastTransportTimestampData } = useReadContract({
        address: USER_ACTIONS_ADDRESS,
        abi: USER_ACTIONS_ABI,
        functionName: 'lastActionTimestamp',
        args: [userAddress!, ACTION_TYPE_TRANSPORT_B32],
        query: { enabled: !!userAddress },
    });

    // Update state when timestamps are fetched
    useEffect(() => {
        if (lastTempTimestampData !== undefined) {
            updateActionStatus(ACTION_TYPE_TEMP, { lastRecordedTimestamp: Number(lastTempTimestampData) });
        }
    }, [lastTempTimestampData]);

    useEffect(() => {
        if (lastTransportTimestampData !== undefined) {
            updateActionStatus(ACTION_TYPE_TRANSPORT, { lastRecordedTimestamp: Number(lastTransportTimestampData) });
        }
    }, [lastTransportTimestampData]);

    // --- Handle Verification Requests --- 
    const handleVerify = async (actionType: string) => {
        if (!userAddress) return;

        updateActionStatus(actionType, { 
            isVerifying: true, 
            verifyError: null, 
            verifySuccessMessage: null, 
            claimError: null, // Clear previous claim errors too
            claimSuccessTx: null, // Clear previous tx
            canClaim: false, // Reset claim status
            validationId: null, // Reset validation ID
            currentStatus: 'Initiating verification...' // Show initial status
        });

        const status = actionStatuses[actionType];
        let requestBody: any = { userAddress, actionType };

        // --- Prepare image data if it's the transport action ---
        if (actionType === ACTION_TYPE_TRANSPORT) {
            if (!status.selectedFile) {
                 updateActionStatus(actionType, { isVerifying: false, verifyError: "Please select a screenshot file first." });
                 return;
            }
            updateActionStatus(actionType, { isReadingFile: true });
            try {
                const base64String = await readFileAsBase64(status.selectedFile);
                requestBody.imageBase64 = base64String; // <-- Fix: Use imageBase64 instead of screenshotBase64
            } catch (error) {
                console.error("Error reading file:", error);
                updateActionStatus(actionType, { isVerifying: false, isReadingFile: false, verifyError: "Failed to read the selected file." });
                return;
            } finally {
                 updateActionStatus(actionType, { isReadingFile: false });
            }
        }
        // --- --- 

        try {
            console.log("Sending verification request to Attestation Provider...");
            const response = await fetch(`${ATTESTATION_PROVIDER_API_URL}/request-attestation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Verification request failed: ${response.statusText}`);
            }

            console.log("Verification initiated response:", data);
            if (!data.validationId) {
                throw new Error("Attestation provider did not return a validation ID.");
            }
            
            // Store validationId and update status
            updateActionStatus(actionType, { 
                validationId: data.validationId,
                currentStatus: "Verification initiated. Waiting for FDC processing...", 
                verifySuccessMessage: null, 
                verifyError: null 
            });
            
            // Start polling for status updates 
            startStatusPolling(actionType, data.validationId); // <--- Call start polling
            
        } catch (error: any) {
             console.error("Verification error:", error);
             stopStatusPolling(actionType); // Stop polling if initial request fails
             updateActionStatus(actionType, { verifyError: error.message || "An unknown error occurred during verification." });
        } finally {
            updateActionStatus(actionType, { isVerifying: false });
        }
    };

    // --- Listen for ActionRecorded Event --- 
    useWatchContractEvent({
        address: USER_ACTIONS_ADDRESS,
        abi: USER_ACTIONS_ABI,
        eventName: 'ActionRecorded',
        onLogs(logs) {
            console.log('ActionRecorded event logs:', logs);
            logs.forEach(log => {
                try {
                    // Explicitly decode the event log
                    const decodedLog = decodeEventLog({
                        abi: USER_ACTIONS_ABI,
                        data: log.data,
                        topics: log.topics,
                        eventName: 'ActionRecorded'
                    });

                    // --- Type Guard --- 
                    // Check if args exists, is an object, and has the required properties
                    if ( 
                        !decodedLog.args || 
                        typeof decodedLog.args !== 'object' || 
                        Array.isArray(decodedLog.args) ||
                        !('user' in decodedLog.args) || 
                        !('actionType' in decodedLog.args) ||
                        !('timestamp' in decodedLog.args)
                    ) {
                        console.error("Decoded log args are missing, not an object, or missing properties:", decodedLog.args);
                        return; // Skip this log entry
                    }
                    
                    // --- Access args directly after guard (TypeScript should infer types now) --- 
                    const user = decodedLog.args.user as `0x${string}`; // Cast specific properties if needed
                    const eventActionTypeB32 = decodedLog.args.actionType as `0x${string}`;
                    const timestamp = decodedLog.args.timestamp as bigint;
                    
                    // Check if any cast resulted in undefined (extra safety)
                    if (typeof user === 'undefined' || typeof eventActionTypeB32 === 'undefined' || typeof timestamp === 'undefined') {
                         console.error("One or more decoded args properties are undefined after access:", decodedLog.args);
                         return; // Skip this log entry
                    }
                    
                    // --- Proceed with logic --- 
                    if (user === userAddress) {
                        const actionType = Object.keys(actionStatuses).find(key => 
                            (key === ACTION_TYPE_TEMP && eventActionTypeB32 === ACTION_TYPE_TEMP_B32) ||
                            (key === ACTION_TYPE_TRANSPORT && eventActionTypeB32 === ACTION_TYPE_TRANSPORT_B32)
                        );

                        if (actionType) {
                            console.log(`Action ${actionType} recorded for current user at timestamp ${timestamp}. Enabling claim.`);
                            updateActionStatus(actionType, {
                                lastRecordedTimestamp: Number(timestamp),
                                canClaim: true,
                                verifySuccessMessage: `Action successfully recorded on-chain at ${new Date(Number(timestamp) * 1000).toLocaleString()}! You can now claim your NFT.`
                            });
                            // stopStatusPolling(actionType); // Stop polling when event confirms success
                            updateActionStatus(actionType, { isVerifying: false, verifyError: null }); 
                        }
                    }
                } catch (error) {
                    console.error("Failed to decode ActionRecorded event log:", error, log);
                }
            });
        },
        onError(error) {
            console.error('Error watching ActionRecorded event:', error);
            // Optionally show a toast error
        }
    });

    // --- Handle NFT Claiming --- 
    const { data: claimTempHash, writeContractAsync: claimTempNFTAsync, isPending: isClaimingTemp } = useWriteContract();
    const { data: claimTransportHash, writeContractAsync: claimTransportNFTAsync, isPending: isClaimingTransport } = useWriteContract();

    const handleClaim = async (actionType: string) => {
        if (!userAddress) return;
        updateActionStatus(actionType, { isClaiming: true, claimError: null, claimSuccessTx: null });

        let claimFunctionName: 'claimTemperatureNFT' | 'claimTransportNFT';
        let writeAsyncFunction: typeof claimTempNFTAsync | typeof claimTransportNFTAsync;
        
        if (actionType === ACTION_TYPE_TEMP) {
            claimFunctionName = 'claimTemperatureNFT';
            writeAsyncFunction = claimTempNFTAsync;
            console.warn("Claiming Temp NFT requires the full CarbonCreditNFT ABI which is not currently exported in contracts.ts");
            updateActionStatus(actionType, { claimError: "Missing full NFT ABI for temp claim", isClaiming: false });
            return;
        } else if (actionType === ACTION_TYPE_TRANSPORT) {
            claimFunctionName = 'claimTransportNFT';
             writeAsyncFunction = claimTransportNFTAsync;
        } else {
            updateActionStatus(actionType, { claimError: "Invalid action type for claiming", isClaiming: false });
            return;
        }

        try {
            const abiToUse = actionType === ACTION_TYPE_TRANSPORT 
                ? CLAIM_TRANSPORT_NFT_ABI
                : USER_ACTIONS_ABI;
            
            // This check is redundant since we already handle this case above
            // and actionType can only be ACTION_TYPE_TRANSPORT at this point
            
            const hash = await writeAsyncFunction({
                address: CARBON_CREDIT_NFT_ADDRESS,
                abi: abiToUse,
                functionName: claimFunctionName,
                args: []
            });
            console.log(`Claim transaction sent for ${actionType}:`, hash);
            updateActionStatus(actionType, { claimSuccessTx: hash });
        } catch (error: any) {
            console.error(`Claim error for ${actionType}:`, error);
            updateActionStatus(actionType, { claimError: error.shortMessage || error.message || "Claiming failed.", isClaiming: false });
            toast.error("Claim Error ", { description: error.shortMessage || error.message });
        } 
    };

    // --- Monitor Claim Transaction Results --- 
    const { isLoading: isConfirmingTemp, isSuccess: isConfirmedTemp, isError: isConfirmErrorTemp } = useWaitForTransactionReceipt({ hash: claimTempHash });
    const { isLoading: isConfirmingTransport, isSuccess: isConfirmedTransport, isError: isConfirmErrorTransport } = useWaitForTransactionReceipt({ hash: claimTransportHash });
    
    // Temp Claim Confirmation Effect
    useEffect(() => {
        if (isConfirmingTemp) updateActionStatus(ACTION_TYPE_TEMP, { isClaiming: true });
        if (isConfirmedTemp) {
             updateActionStatus(ACTION_TYPE_TEMP, { isClaiming: false, canClaim: false, claimError: null, verifySuccessMessage: null });
             setShowConfetti(true);
             toast.success("Success! ", { description: "Temperature NFT Claimed Successfully!" });
             setTimeout(() => setShowConfetti(false), 5000);
        }
        if (isConfirmErrorTemp) {
             updateActionStatus(ACTION_TYPE_TEMP, { isClaiming: false, claimError: "Transaction failed during confirmation." });
        }
    }, [isConfirmingTemp, isConfirmedTemp, isConfirmErrorTemp]);

    // Transport Claim Confirmation Effect
    useEffect(() => {
        if (isConfirmingTransport) updateActionStatus(ACTION_TYPE_TRANSPORT, { isClaiming: true });
        if (isConfirmedTransport) {
             updateActionStatus(ACTION_TYPE_TRANSPORT, { isClaiming: false, canClaim: false, claimError: null, verifySuccessMessage: null, selectedFile: null, selectedFileName: '' }); // Reset file state on success
             setShowConfetti(true);
             toast.success("Success! ", { description: "Transport NFT Claimed Successfully!" });
             setTimeout(() => setShowConfetti(false), 5000);
        }
        if (isConfirmErrorTransport) {
             updateActionStatus(ACTION_TYPE_TRANSPORT, { isClaiming: false, claimError: "Transaction failed during confirmation." });
        }
    }, [isConfirmingTransport, isConfirmedTransport, isConfirmErrorTransport]);

    // --- File Handling Logic ---
    const handleFileChange = (actionType: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            updateActionStatus(actionType, { 
                selectedFile: file, 
                selectedFileName: file.name,
                verifyError: null, // Clear previous verify errors when new file is selected
                verifySuccessMessage: null
             });
        }
    };

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    };

    // --- Handle Proof Submission --- 
    const handleSubmitProofs = async (actionType: string) => {
        const status = actionStatuses[actionType];
        if (!status.validationId) {
            console.error("Cannot submit proofs, validationId is missing.");
            toast.error("Error", { description: "Validation ID is missing, cannot submit proofs." });
            return;
        }

        console.log(`Submitting proofs for ${actionType}, validationId: ${status.validationId}`);
        // Use isVerifying state to show loading on the button
        updateActionStatus(actionType, { 
            isVerifying: true, // Re-use isVerifying for loading state 
            verifyError: null, 
            verifySuccessMessage: null, 
            currentStatus: "Submitting proofs to UserActions contract..."
        });
        // Stop polling while submitting proofs, it will restart if needed or stop on final state
        stopStatusPolling(actionType);

        try {
            const response = await fetch(`${ATTESTATION_PROVIDER_API_URL}/submit-proofs/${status.validationId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // No body needed for this endpoint based on current backend structure
            });

            const data = await response.json();

            if (!response.ok) {
                 // Handle specific non-OK statuses if needed (e.g., 501 Not Implemented)
                if (response.status === 501) {
                    throw new Error("Proof submission endpoint is not implemented on the provider.");
                } 
                throw new Error(data.error || `Proof submission failed: ${response.statusText}`);
            }

            console.log("Proof submission response:", data);
            // Proof submission successful, update status and restart polling to confirm 'complete'
            updateActionStatus(actionType, { 
                isVerifying: false,
                currentStatus: "Proofs submitted. Checking final status...",
                // Optionally store proof tx hashes from data if needed: data.jsonApiProofTxHash, data.evmProofTxHash
            });
            // Restart polling to wait for the 'complete' status from the backend
            startStatusPolling(actionType, status.validationId);
            toast.info("Processing", { description: "Proofs submitted, waiting for final confirmation..." });

        } catch (error: any) {
            console.error("Proof submission error:", error);
            updateActionStatus(actionType, { 
                isVerifying: false, 
                verifyError: error.message || "An unknown error occurred during proof submission.",
                currentStatus: `Proof Submission Error: ${error.message}`
             });
            toast.error("Error", { description: `Proof submission failed: ${error.message}` });
            // Consider if polling should restart on submission error or just stop
        }
    };

    // --- Render Helper --- 
    const renderActionCard = (actionType: string, title: string, description: string) => {
        const status = actionStatuses[actionType];
        // Combine processing states
        const isProcessing = status.isVerifying || status.isClaiming || status.isReadingFile || status.pollingIntervalId !== null; 
        // Check the backendStatus directly
        const isAwaitingProofSubmission = status.backendStatus === 'pending_fdc'; 

        return (
            <Card key={actionType}>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* --- File Input for Transport Action --- */} 
                    {actionType === ACTION_TYPE_TRANSPORT && (
                        <div className="space-y-2">
                             <label htmlFor={`file-upload-${actionType}`} className="text-sm font-medium">Upload Screenshot:</label>
                            <div className="flex items-center space-x-2">
                                <Input 
                                    id={`file-upload-${actionType}`} 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={(e) => handleFileChange(actionType, e)}
                                    className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                    disabled={isProcessing}
                                />
                                {status.selectedFileName && <span className="text-sm text-muted-foreground truncate max-w-[150px]" title={status.selectedFileName}>{status.selectedFileName}</span>}
                            </div>
                        </div>
                    )}
                    {/* --- --- */} 

                    <Button 
                        onClick={() => handleVerify(actionType)} 
                        // Disable if connected but already verifying/claiming/polling/awaiting proof or can claim
                        disabled={!isConnected || isProcessing || status.canClaim } 
                        className="w-full"
                    >
                        {(status.isVerifying || status.isReadingFile) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {status.pollingIntervalId ? 'Checking Status...' : `Verify ${actionType === ACTION_TYPE_TRANSPORT ? (status.selectedFile ? 'Selected Screenshot' : 'Transport') : 'Condition'}`}
                    </Button>

                    {/* Display Current Status during polling */}
                    {status.pollingIntervalId && status.currentStatus && !status.verifyError && !status.verifySuccessMessage && (
                         <Alert variant="default" className="flex items-center">
                             <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            <AlertDescription>{status.currentStatus}</AlertDescription>
                        </Alert>
                    )}

                    {status.verifyError && (
                        <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertTitle>Verification Error</AlertTitle>
                            <AlertDescription>{status.verifyError}</AlertDescription>
                        </Alert>
                    )}
                    {/* Display final success message only when polling stops and canClaim is true */}
                    {status.verifySuccessMessage && status.canClaim && (
                         <Alert variant="default">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Verification Status</AlertTitle>
                            <AlertDescription>{status.verifySuccessMessage}</AlertDescription>
                        </Alert>
                    )}
                    
                    {/* --- Proof Submission Button (Phase 5 - Step 4) --- */}
                    {/* Show button if status is pending_fdc (or similar intermediate state) */}
                    {isAwaitingProofSubmission && (
                         <Button 
                            onClick={() => handleSubmitProofs(actionType)} // Call the new handler
                            disabled={!isConnected || status.isVerifying || status.isClaiming} // Disable while verifying/claiming
                            className="w-full"
                            variant="secondary"
                         >
                             {status.isVerifying && status.currentStatus?.includes("Submitting proofs") && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} 
                            Check & Submit Proofs
                         </Button>
                    )}

                    <Button 
                        onClick={() => handleClaim(actionType)} 
                        // Only enable claim if explicitly allowed AND not processing something else
                        disabled={!isConnected || !status.canClaim || isProcessing } 
                        className="w-full"
                        variant="outline"
                    >
                        {status.isClaiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Claim {title} NFT
                    </Button>
                    {status.claimError && (
                         <Alert variant="destructive">
                            <XCircle className="h-4 w-4" />
                            <AlertTitle>Claim Error</AlertTitle>
                            <AlertDescription>{status.claimError}</AlertDescription>
                        </Alert>
                    )}
                      {status.claimSuccessTx && !status.isClaiming && !status.claimError && (
                         <Alert variant="default">
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Claim Pending</AlertTitle>
                            <AlertDescription>
                                Transaction submitted: <a href={`${flareTestnet.blockExplorers.default.url}/tx/${status.claimSuccessTx}`} target="_blank" rel="noopener noreferrer" className="underline">View on Explorer</a>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground">
                        Last Recorded: {status.lastRecordedTimestamp > 0 ? new Date(status.lastRecordedTimestamp * 1000).toLocaleString() : 'Never'}
                    </p>
                </CardFooter>
            </Card>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6">
            {showConfetti && <Confetti recycle={false} />}
            <h1 className="text-3xl font-bold mb-6">Verify Environmental Actions</h1>
            <p className="mb-8 text-muted-foreground">Prove your real-world sustainable actions using Flare Time Series Oracle (FTSO) and FDC attestations to claim unique Carbon Credit NFTs.</p>

            {!isConnected && (
                 <Alert variant="default" className="mb-6">
                    <AlertTitle>Wallet Not Connected</AlertTitle>
                    <AlertDescription>Please connect your wallet to verify actions and claim NFTs.</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* {renderActionCard(
                    ACTION_TYPE_TEMP, 
                    "Hot Weather Activity", 
                    "Verify if the temperature in Seoul, South Korea is currently above 15°C using OpenWeatherMap data attested via FDC."
                )} */}
                {renderActionCard(
                    ACTION_TYPE_TRANSPORT, 
                    "Sustainable Transport", 
                    "Verify completion of a sustainable transport activity (cycling, walking, running, etc.) by uploading a screenshot from your fitness app (Analyzed by AI Vision)."
                )}
            </div>
        </div>
    );
} 