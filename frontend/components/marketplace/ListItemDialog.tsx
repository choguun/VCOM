'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import type { Abi } from 'viem';

// --- Import relevant ABIs and Addresses ---

// ABI needed for NFT approval
const ERC721_ABI_WITH_APPROVAL: Abi = [
    { name: 'approve', inputs: [{ name: 'to', type: 'address' }, { name: 'tokenId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable', type: 'function' },
    { name: 'getApproved', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'operator', type: 'address' }], stateMutability: 'view', type: 'function' },
] as const;

// Marketplace ABI (including listItem)
const MARKETPLACE_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"initialOwner","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"buyItem","inputs":[{"name":"listingId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"payable"},
    {"type":"function","name":"cancelListing","inputs":[{"name":"listingId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"listItem","inputs":[{"name":"nftContract","type":"address","internalType":"address"},{"name":"tokenId","type":"uint256","internalType":"uint256"},{"name":"priceInFLR","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"listings","inputs":[{"name":"","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"seller","type":"address","internalType":"address"},{"name":"nftContract","type":"address","internalType":"address"},{"name":"tokenId","type":"uint256","internalType":"uint256"},{"name":"priceInFLR","type":"uint256","internalType":"uint256"},{"name":"active","type":"bool","internalType":"bool"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"renounceOwnership","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"event","name":"ItemListed","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"seller","type":"address","indexed":true,"internalType":"address"},{"name":"nftContract","type":"address","indexed":true,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"priceInFLR","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},
    {"type":"event","name":"ItemSold","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"buyer","type":"address","indexed":true,"internalType":"address"},{"name":"seller","type":"address","indexed":false,"internalType":"address"},{"name":"nftContract","type":"address","indexed":false,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"priceInFLR","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},
    {"type":"event","name":"ListingCancelled","inputs":[{"name":"listingId","type":"uint256","indexed":true,"internalType":"uint256"}],"anonymous":false},
    {"type":"event","name":"OwnershipTransferred","inputs":[{"name":"previousOwner","type":"address","indexed":true,"internalType":"address"},{"name":"newOwner","type":"address","indexed":true,"internalType":"address"}]}
];

const MARKETPLACE_CONTRACT_ADDRESS = '0xd06b5a486f7239AE03a0af3e38E2041c932B0920';

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
        abi: ERC721_ABI_WITH_APPROVAL,
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

    const needsApproval = approvedAddress?.toLowerCase() !== MARKETPLACE_CONTRACT_ADDRESS.toLowerCase();
    const isLoading = isApprovePending || isApprovalTxLoading || isListPending || isListingTxLoading;

    // --- Handlers ---

    const handleApprove = () => {
        setIsApproving(true);
        toast.info(`Requesting approval for Marketplace to manage NFT #${nft.id}...`);
        approveNft({ 
            address: nft.contractAddress,
            abi: ERC721_ABI_WITH_APPROVAL,
            functionName: 'approve',
            args: [MARKETPLACE_CONTRACT_ADDRESS, nft.id]
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
            address: MARKETPLACE_CONTRACT_ADDRESS,
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