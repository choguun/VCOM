'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

// Placeholder for the Attestation Provider API endpoint
const ATTESTATION_PROVIDER_API = '/api/verify-action'; // Example endpoint

export default function ActionsPage() {
    const { address, isConnected } = useAccount();
    const [isLoading, setIsLoading] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
    const [verificationError, setVerificationError] = useState<string | null>(null);

    // Placeholder - will need state and connection to FDC flow
    const handleVerifyAction = async () => {
        if (!isConnected || !address) {
            toast.error("Please connect your wallet first.");
            return;
        }

        setIsLoading(true);
        setVerificationStatus(null);
        setVerificationError(null);
        toast.info("Initiating verification with provider...");

        // Simulate API call to the Attestation Provider
        try {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

            // *** In a real implementation, replace simulation with fetch: ***
            /*
            const response = await fetch(ATTESTATION_PROVIDER_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userAddress: address,
                    actionType: 'TEMP_SEOUL_GT_15' // Example action type identifier
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: "Unknown API error" }));
                throw new Error(errorData.message || `API request failed with status ${response.status}`);
            }

            const result = await response.json();
            setVerificationStatus(result.message || "Verification request submitted successfully.");
            toast.success(result.message || "Verification request submitted.");
            */

            // --- Simulation Result --- 
            const simulatedResult = { message: "Verification request submitted successfully to provider (Simulated)." };
            setVerificationStatus(simulatedResult.message);
            toast.success(simulatedResult.message);
            // -------------------------

        } catch (error: any) {
            console.error("Action verification error:", error);
            setVerificationError(error.message || "Failed to submit verification request.");
            toast.error(error.message || "Verification submission failed.");
        } finally {
            setIsLoading(false);
        }
    }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Verifiable Actions</h1>
      <p className="text-muted-foreground">
        Perform environmental actions and get them verified on-chain via Flare FDC.
      </p>

      <Card>
        <CardHeader>
            <CardTitle>Verify High Temperature Action</CardTitle>
            <CardDescription>
                Verify if the current temperature in Seoul is above 15°C using an external API and FDC.
                (This is the example action described in the project plan).
            </CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Click the button to start the verification process via the Attestation Provider.</p>
            <Button onClick={handleVerifyAction} disabled={isLoading || !isConnected}>
                {isLoading ? "Submitting..." : "Verify Seoul Temp > 15°C"}
            </Button>
            {/* Display status/result here */}
            {verificationStatus && (
                <p className="mt-4 text-sm text-green-600">{verificationStatus}</p>
            )}
            {verificationError && (
                <p className="mt-4 text-sm text-red-500">Error: {verificationError}</p>
            )}
        </CardContent>
      </Card>

      {/* Placeholder for Action History */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">My Verified Actions History</h2>
        {/* Map over user's recorded actions here */}
        <p className="text-muted-foreground">You have no verified actions recorded yet.</p>
      </div>

    </div>
  );
} 