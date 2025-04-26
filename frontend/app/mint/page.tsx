'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { Abi } from 'viem';

// Deployed NFT Contract Address
const CARBON_CREDIT_NFT_ADDRESS = '0x656152B512511c87D8cca31E7Eae319b48d1B60e'; 

// --- Updated ABI for safeMint(address to, string memory tokenURI) --- 
const MINT_NFT_ABI: Abi = [
    {
        "inputs": [
            { "internalType": "address", "name": "to", "type": "address" },
            // { "internalType": "uint256", "name": "tokenId", "type": "uint256" }, // Removed tokenId
            { "internalType": "string", "name": "tokenURI", "type": "string" }
        ],
        "name": "safeMint", // Verify this function name again if contract changes
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export default function MintPage() {
    const { address, isConnected } = useAccount();
    const [recipient, setRecipient] = useState('');
    // const [tokenId, setTokenId] = useState(''); // --- Remove Token ID state
    const [name, setName] = useState(''); // +++ Add Name state
    const [description, setDescription] = useState(''); // +++ Add Description state
    // const [tokenUri, setTokenUri] = useState(''); // --- Remove Token URI state (handled internally now)
    const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();

    // Wagmi hooks for minting
    const { 
        writeContract: mintNft, 
        isPending: isMintPending, 
        error: mintError 
    } = useWriteContract();

    const { isLoading: isTxLoading, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ 
        hash: mintTxHash,
    });

    const handleMint = () => {
        if (!isConnected || !mintNft) {
            toast.error("Please connect wallet or wait for initialization.");
            return;
        }
        // --- Update validation: check recipient, name, description --- 
        if (!recipient || !name || !description) { 
            toast.error("Please fill in Recipient, Name, and Description.");
            return;
        }
        if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
            toast.error("Invalid recipient address format.");
            return;
        }
        // +++ Prepare metadata JSON (including image) +++
        const metadataJson = {
            name: name,
            description: description
        };

        // Stringify the JSON to store directly on-chain
        const tokenUriForTx = JSON.stringify(metadataJson);

        // Validate URI length? (Optional - might hit gas limits if too long)
        // console.log("Using on-chain JSON Token URI:", tokenUriForTx);

        // --- Update mint call args --- 
        toast.info(`Initiating mint to ${recipient}...`);
        mintNft({
            address: CARBON_CREDIT_NFT_ADDRESS,
            abi: MINT_NFT_ABI,
            functionName: 'safeMint',
            args: [recipient as `0x${string}`, tokenUriForTx], // Use recipient and stringified JSON URI
        }, {
            onSuccess: (hash) => {
                setMintTxHash(hash);
                toast.success(`Mint transaction submitted: ${hash}`);
                // Clear fields on success submission
                setRecipient('');
                setName('');
                setDescription('');
            },
            onError: (err) => {
                toast.error(`Mint failed: ${err.message}`);
            }
        });
    };

    // Effect to show final success message (keep as is)
    useEffect(() => {
        if (isTxSuccess) {
            toast.success("NFT minted successfully!");
            setMintTxHash(undefined); 
        }
    }, [isTxSuccess]);

    const isLoading = isMintPending || isTxLoading;

    return (
        <div className="space-y-6 max-w-md mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">Mint Carbon Credit NFT</h1>
            <p className="text-muted-foreground">
                Mint a new Carbon Credit NFT. Token ID is auto-generated. (Requires Minter Role)
            </p>

            <div className="space-y-4">
                {/* --- Recipient Input (Keep as is) --- */}
                <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="recipient">Recipient Address</Label>
                    <Input 
                        type="text" 
                        id="recipient" 
                        placeholder="0x..." 
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                 {/* +++ Add Name Input +++ */}
                 <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="name">NFT Name</Label>
                    <Input 
                        type="text" 
                        id="name" 
                        placeholder="e.g., Verified Redwood Credit" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                 {/* +++ Add Description Input +++ */}
                 <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="description">Description</Label>
                    <Textarea 
                        id="description" 
                        placeholder="Describe the origin and details of this carbon credit..." 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        disabled={isLoading}
                        rows={4} // Adjust rows as needed
                    />
                </div>
                
                 {/* --- Remove Token ID Input --- */}
                 {/* <div className="grid w-full items-center gap-1.5"> ... </div> */}
                 
                 {/* --- Remove Token URI Input --- */}
                 {/* <div className="grid w-full items-center gap-1.5"> ... </div> */}

                <Button 
                    onClick={handleMint}
                    disabled={!isConnected || isLoading}
                    className="w-full"
                >
                    {isLoading ? "Minting..." : "Mint NFT"}
                </Button>

                {mintError && (
                    <p className="text-sm text-red-500 text-center">Error: {mintError.message}</p>
                )}
            </div>
        </div>
    );
} 