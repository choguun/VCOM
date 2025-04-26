'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWatchContractEvent, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { keccak256, toHex, type Abi, type Address, type Log, decodeEventLog } from 'viem';
import { 
    USER_ACTIONS_ADDRESS, 
    USER_ACTIONS_ABI, 
    CARBON_CREDIT_NFT_ADDRESS, 
    CLAIM_TRANSPORT_NFT_ABI
} from '@/config/contracts';

// Define the specific action types we are checking
const ACTION_TYPE_TEMP = "TEMP_OVER_15_SEOUL";
const ACTION_TYPE_TEMP_B32 = keccak256(toHex(ACTION_TYPE_TEMP));

const ACTION_TYPE_TRANSPORT = "SUSTAINABLE_TRANSPORT_KM";
const ACTION_TYPE_TRANSPORT_B32 = keccak256(toHex(ACTION_TYPE_TRANSPORT));

// Base URL for the attestation provider service
const ATTESTATION_PROVIDER_URL = process.env.NEXT_PUBLIC_ATTESTATION_PROVIDER_URL || 'http://localhost:3001'; 

// Placeholder ABI fragment for the new claim function
// const CLAIM_NFT_ABI: Abi = [...] // Remove old definition

export default function VerifiableActionsPage() {
    const { address, isConnected } = useAccount();
    const [isCheckingTemp, setIsCheckingTemp] = useState(false);
    const [isCheckingTransport, setIsCheckingTransport] = useState(false);
    const [lastTempActionTime, setLastTempActionTime] = useState<number | null>(null);
    const [lastTransportActionTime, setLastTransportActionTime] = useState<number | null>(null);
    const [tempStatus, setTempStatus] = useState<string>('Idle');
    const [transportStatus, setTransportStatus] = useState<string>('Idle');
    const [canClaimTransportNFT, setCanClaimTransportNFT] = useState(false);
    const [claimTxHash, setClaimTxHash] = useState<`0x${string}` | undefined>();

    // Read last timestamps
    const { data: tempTimestampData, isLoading: isLoadingTempTS, error: tempTSError, refetch: refetchTempTS } = useReadContract({
        address: USER_ACTIONS_ADDRESS,
        abi: USER_ACTIONS_ABI,
        functionName: 'lastActionTimestamp',
        args: [address!, ACTION_TYPE_TEMP_B32],
        query: { enabled: isConnected && !!address, select: (data) => data ? Number(data as bigint) : null }
    });
    const { data: transportTimestampData, isLoading: isLoadingTransportTS, error: transportTSError, refetch: refetchTransportTS } = useReadContract({
        address: USER_ACTIONS_ADDRESS,
        abi: USER_ACTIONS_ABI,
        functionName: 'lastActionTimestamp',
        args: [address!, ACTION_TYPE_TRANSPORT_B32],
        query: { enabled: isConnected && !!address, select: (data) => data ? Number(data as bigint) : null }
    });

    useEffect(() => { setLastTempActionTime(tempTimestampData ?? null); }, [tempTimestampData]);
    useEffect(() => { setLastTransportActionTime(transportTimestampData ?? null); }, [transportTimestampData]);

    // Wagmi hooks for claiming
    const { writeContract: claimNft, isPending: isClaimPending, error: claimError } = useWriteContract();
    const { isLoading: isClaimTxLoading, isSuccess: isClaimTxSuccess } = useWaitForTransactionReceipt({ hash: claimTxHash });

    // --- Watch ActionRecorded Event ---
    useWatchContractEvent({
        address: USER_ACTIONS_ADDRESS,
        abi: USER_ACTIONS_ABI,
        eventName: 'ActionRecorded',
        onLogs(logs) {
            console.log('ActionRecorded event received:', logs);
            logs.forEach((log: any) => {
                try {
                    const decodedLog = decodeEventLog({
                        abi: USER_ACTIONS_ABI,
                        data: log.data,
                        topics: log.topics,
                        eventName: 'ActionRecorded'
                    });

                    const args = decodedLog.args as {
                        user?: Address;
                        actionType?: `0x${string}`;
                        timestamp?: bigint;
                    };

                    if (args.user?.toLowerCase() === address?.toLowerCase()) {
                        const recordedTime = args.timestamp ? Number(args.timestamp) : Date.now() / 1000;
                        const timeStr = new Date(recordedTime * 1000).toLocaleString();

                        if (args.actionType === ACTION_TYPE_TEMP_B32) {
                            setLastTempActionTime(recordedTime);
                            setTempStatus(`Action recorded successfully at ${timeStr}!`);
                            toast.success(`Action '${ACTION_TYPE_TEMP}' verified and recorded!`);
                        } else if (args.actionType === ACTION_TYPE_TRANSPORT_B32) {
                            setLastTransportActionTime(recordedTime);
                            setTransportStatus(`Action recorded successfully at ${timeStr}! Claim enabled.`);
                            setCanClaimTransportNFT(true);
                            toast.success(`Action '${ACTION_TYPE_TRANSPORT}' verified and recorded! You can now claim your NFT.`);
                        }
                    }
                } catch (e) {
                    console.error("Failed to decode ActionRecorded event:", e, log);
                }
            });
        },
        onError(error) {
            console.error('Error watching ActionRecorded event:', error);
            toast.error('Error listening for action recording events.');
        }
    });

    // --- Handler to Request Verification --- 
    const handleCheckAction = async (actionType: string) => {
        if (!isConnected || !address) {
            toast.error("Please connect your wallet first.");
            return;
        }

        const isTemp = actionType === ACTION_TYPE_TEMP;
        const setLoading = isTemp ? setIsCheckingTemp : setIsCheckingTransport;
        const setStatus = isTemp ? setTempStatus : setTransportStatus;

        setLoading(true);
        setStatus('Requesting verification...');
        toast.info(`Requesting verification for action: ${actionType}`);

        try {
            const response = await fetch(`${ATTESTATION_PROVIDER_URL}/request-attestation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userAddress: address, actionType: actionType }),
            });
            const result = await response.json();
            if (!response.ok) { throw new Error(result.error || `Server responded with status ${response.status}`); }
            
            setStatus(result.message || 'Verification request submitted. Waiting for on-chain confirmation...');
            toast.success(result.message || 'Verification request sent!');
        } catch (error: any) { 
            console.error("Error requesting attestation:", error);
            setStatus(`Failed to request verification: ${error.message}`);
            toast.error(`Verification request failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Handler to Claim Transport NFT --- 
    const handleClaimTransportNFT = () => {
        if (!isConnected || !address || !canClaimTransportNFT || !claimNft) {
            toast.error("Cannot claim NFT. Ensure action is verified and wallet connected.");
            return;
        }
        toast.info("Initiating Transport NFT claim...");
        claimNft({ 
            address: CARBON_CREDIT_NFT_ADDRESS,
            abi: CLAIM_TRANSPORT_NFT_ABI,
            functionName: 'claimTransportNFT',
            args: [],
        }, {
            onSuccess: (hash) => {
                setClaimTxHash(hash);
                toast.success(`Claim transaction submitted: ${hash}`);
                setCanClaimTransportNFT(false);
            },
            onError: (err) => {
                toast.error(`Claim failed: ${err.message}`);
            }
        });
    };

    // Effect to show final claim success message
    useEffect(() => {
        if (isClaimTxSuccess) {
            toast.success("Sustainable Transport NFT claimed successfully!");
            setClaimTxHash(undefined);
        }
    }, [isClaimTxSuccess]);

    const isClaiming = isClaimPending || isClaimTxLoading;

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Verifiable Actions</h1>
            <p className="text-muted-foreground">
                Trigger off-chain checks and record verified environmental actions on the Flare Network using the FDC.
            </p>

            {/* Temperature Action Card */}
            <Card>
                <CardHeader>
                    <CardTitle>{ACTION_TYPE_TEMP}</CardTitle>
                    <CardDescription>
                        Verify if the current temperature in Seoul, South Korea is greater than 15°C.
                        (Requires off-chain Attestation Provider service to be running).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">Status:</p>
                        <p className="text-sm text-muted-foreground break-words">
                            {isLoadingTempTS ? "Loading..." : 
                             tempTSError ? `Error: ${tempTSError.message}` : 
                             lastTempActionTime ? `Last recorded: ${new Date(lastTempActionTime * 1000).toLocaleString()}` : 
                             "Not recorded."}
                        </p>
                        {tempStatus !== 'Idle' && !lastTempActionTime && 
                            <p className="text-sm text-blue-600 mt-1">{tempStatus}</p>
                        }
                    </div>
                    <Button 
                        onClick={() => handleCheckAction(ACTION_TYPE_TEMP)}
                        disabled={!isConnected || isCheckingTemp || isLoadingTempTS}
                        className="w-full"
                    >
                        {isCheckingTemp ? "Verifying..." : "Verify Temp > 15°C"}
                    </Button>
                </CardContent>
            </Card>

            {/* Sustainable Transport Action Card */}
            <Card>
                <CardHeader>
                    <CardTitle>{ACTION_TYPE_TRANSPORT}</CardTitle>
                    <CardDescription>
                        Verify completing a sustainable transport journey (e.g., {'>'} 5km cycle). 
                        Successful verification allows claiming a special Carbon Credit NFT.
                        (Verification uses mock data & FDC request simulation).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">Status:</p>
                        <p className="text-sm text-muted-foreground break-words">
                           {isLoadingTransportTS ? "Loading..." : 
                            transportTSError ? `Error: ${transportTSError.message}` : 
                            lastTransportActionTime ? `Last recorded: ${new Date(lastTransportActionTime * 1000).toLocaleString()}` : 
                            "Not recorded."}
                        </p>
                        {transportStatus !== 'Idle' && transportStatus && (
                            <>
                                <p className={`text-sm mt-1 ${canClaimTransportNFT ? 'text-green-600' : 'text-blue-600'}`}>{transportStatus}</p>
                            </>
                        )}
                    </div>
                    <div className="flex space-x-2">
                        <Button 
                            onClick={() => handleCheckAction(ACTION_TYPE_TRANSPORT)}
                            disabled={!isConnected || isCheckingTransport || isLoadingTransportTS || canClaimTransportNFT}
                            className="flex-1"
                        >
                            {isCheckingTransport ? "Verifying..." : "Verify Transport"}
                        </Button>
                        <Button 
                            onClick={handleClaimTransportNFT}
                            disabled={!isConnected || !canClaimTransportNFT || isClaiming}
                            className="flex-1"
                        >
                            {isClaiming ? "Claiming..." : "Claim Transport NFT"}
                        </Button>
                    </div>
                     {claimError && (
                        <p className="text-sm text-red-500">Claim Error: {claimError.message}</p>
                    )}
                </CardContent>
            </Card>

        </div>
    );
} 