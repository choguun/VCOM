'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import type { Abi } from 'viem';
import { MARKETPLACE_ABI, MARKETPLACE_ADDRESS, ERC721_ABI } from '@/config/contracts';

// Passed from MyAssetsPage
interface NftData {
    id: bigint;
    contractAddress: `0x${string}`;
    metadata?: { name?: string };
}

interface ListItemDialogProps {
    nft: NftData;
    onListingComplete: () => void; 
}

export default function ListItemDialog({ nft, onListingComplete }: ListItemDialogProps) {
    const [price, setPrice] = useState('');
    const [isApproving, setIsApproving] = useState(false);
    const [isListing, setIsListing] = useState(false);
    const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>();
    const [listingTxHash, setListingTxHash] = useState<`0x${string}` | undefined>();

    const { address: connectedAddress } = useAccount();

    // --- Wagmi Hooks ---

    // Check approval status
    const { data: approvedAddress, refetch: refetchApproval } = useReadContract({
        address: nft.contractAddress,
        abi: ERC721_ABI,
        functionName: 'getApproved',
        args: [nft.id],
        query: { enabled: !!nft },
    });

    // Approve hook
    const { writeContract: approveNft, isPending: isApprovePending } = useWriteContract();

    // Listing hook
    const { writeContract: listItem, isPending: isListPending } = useWriteContract();

    // Wait for approval tx
    const { isLoading: isApprovalTxLoading, isSuccess: isApprovalTxSuccess } = useWaitForTransactionReceipt({ hash: approvalTxHash });
    // Wait for listing tx
    const { isLoading: isListingTxLoading, isSuccess: isListingTxSuccess } = useWaitForTransactionReceipt({ hash: listingTxHash });

    const needsApproval = approvedAddress !== MARKETPLACE_ADDRESS;
    const isLoading = isApprovePending || isApprovalTxLoading || isListPending || isListingTxLoading;

    // --- Handlers ---

    const handleApprove = () => {
        setIsApproving(true);
        toast.info(`Requesting approval for Marketplace to manage NFT #${nft.id}...`);
        approveNft({ 
            address: nft.contractAddress,
            abi: ERC721_ABI,
            functionName: 'approve',
            args: [MARKETPLACE_ADDRESS, nft.id]
        }, {
            onSuccess: (hash) => {
                setApprovalTxHash(hash);
                toast.success(`Approval transaction submitted: ${hash}`);
            },
            onError: (err) => {
                toast.error(`Approval failed: ${err.message}`);
                setIsApproving(false);
            }
        });
    };

    const handleList = () => {
        if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
            toast.error("Please enter a valid positive price.");
            return;
        }
        setIsListing(true);
        const priceWei = parseEther(price); // Convert FLR string to wei bigint
        toast.info(`Listing NFT #${nft.id} for ${price} C2FLR...`);

        listItem({ 
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI, 
            functionName: 'listItem',
            args: [nft.contractAddress, nft.id, priceWei]
        }, {
            onSuccess: (hash) => {
                setListingTxHash(hash);
                toast.success(`Listing transaction submitted: ${hash}`);
            },
            onError: (err) => {
                toast.error(`Listing failed: ${err.message}`);
                setIsListing(false);
            }
        });
    };

    // --- Effects ---

    // Refetch approval status after approval tx succeeds
    useEffect(() => {
        if (isApprovalTxSuccess) {
            toast.success(`NFT #${nft.id} approved successfully!`);
            setIsApproving(false);
            refetchApproval(); // Update approval status
        }
    }, [isApprovalTxSuccess, nft.id, refetchApproval]);

    // Close dialog after listing tx succeeds
    useEffect(() => {
        if (isListingTxSuccess) {
            toast.success(`NFT #${nft.id} listed successfully!`);
            setIsListing(false);
            onListingComplete(); // Call the callback
        }
    }, [isListingTxSuccess, nft.id, onListingComplete]);


    return (
        <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nft-name" className="text-right">
                    NFT
                </Label>
                <span id="nft-name" className="col-span-3 truncate">
                    {nft.metadata?.name || `Token #${nft.id}`} ({nft.id.toString()})
                </span>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="price" className="text-right">
                    Price (C2FLR)
                </Label>
                <Input
                    id="price"
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="col-span-3"
                    placeholder="e.g., 10.5"
                    disabled={isLoading}
                />
            </div>
            <div className='flex justify-end space-x-2 mt-4'>
                {needsApproval && (
                    <Button 
                        onClick={handleApprove}
                        disabled={isApproving || isLoading}
                    >
                        {isApprovalTxLoading ? 'Approving...' : isApproving ? 'Check Wallet...' : '1. Approve'}
                    </Button>
                )}
                 <Button 
                    onClick={handleList}
                    disabled={needsApproval || isListing || isLoading}
                 >
                    {isListingTxLoading ? 'Listing...' : isListing ? 'Check Wallet...' : needsApproval ? '2. List Item' : 'List Item'}
                 </Button>
            </div>
        </div>
    );
} 