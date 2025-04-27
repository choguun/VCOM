'use client'; // Needs to be client component for potential hooks later

import React, { useState, useEffect, useMemo } from 'react';
import NFTCard from '@/components/nft/NFTCard';
import {
    useAccount,
    useReadContract,
    useReadContracts,
    useWriteContract,
    useWaitForTransactionReceipt
} from 'wagmi';
import { formatUnits } from 'viem'; // For defining ABI items
import { toast } from "sonner";

// --- Config Imports --- 
import { 
    MARKETPLACE_ADDRESS, 
    MARKETPLACE_ABI, // Assuming full Marketplace ABI is exported
    ERC721_ABI // Assuming a generic ERC721 ABI is exported
} from '@/config/contracts';
import { fetchMetadata, type NftMetadata } from '@/lib/nftUtils'; // Import from shared utility file

// Data structure for listings (combined on-chain and off-chain data)
interface CombinedListing {
    id: bigint; // listingId from contract
    tokenId: bigint;
    price: bigint; // priceInFLR (wei)
    seller: `0x${string}`;
    nftContract: `0x${string}`;
    active: boolean;
    tokenUri?: string; // Fetched separately
    metadata?: NftMetadata | null; // Allow metadata to be optional or null
    metadataError?: string;
    // Derived/Formatted fields
    formattedPrice?: string; 
}

// --- Component --- 

const MarketplaceList = () => {
    const { address: connectedAddress } = useAccount(); // Get connected user address
    const [listings, setListings] = useState<CombinedListing[]>([]);
    const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [buyingListingId, setBuyingListingId] = useState<bigint | null>(null);

    // 1. Read the total number of listings (_nextListingId)
    const { data: nextListingIdData, isLoading: isLoadingCount, error: countError } = useReadContract({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: '_nextListingId',
        // chainId: flareTestnet.id // Specify chain if needed
    });

    const listingCount = useMemo(() => nextListingIdData ? Number(nextListingIdData) : 0, [nextListingIdData]);

    // 2. Prepare calls to fetch listing details for IDs 0 to count-1
    const listingDetailCalls = useMemo(() => {
        if (listingCount === 0) return [];
        const calls: any[] = [];
        // Assuming listing IDs start from 0 or 1. Adjust loop if needed.
        // If _nextListingId is the *next* ID, the valid IDs are 0 to count-1.
        // If it represents the *total count*, IDs might be 1 to count.
        // Assuming IDs are 0 to count-1 for this example.
        for (let i = BigInt(0); i < listingCount; i++) {
            calls.push({
                address: MARKETPLACE_ADDRESS,
                abi: MARKETPLACE_ABI,
                functionName: 'listings',
                args: [i],
            });
        }
        return calls;
    }, [listingCount]);

    // 3. Fetch Listing Details
    const listingDetailsRead = useReadContracts({
        allowFailure: true, // Allow individual listing reads to fail
        contracts: listingDetailCalls,
        query: {
            enabled: listingDetailCalls.length > 0,
            select: (data) => {
                // Process results, associating with listingId
                return data.map((item, index) => {
                    const listingId = BigInt(index); // Assuming index corresponds to listingId
                    if (item.status === 'success' && Array.isArray(item.result)) {
                        const [seller, nftContract, tokenId, priceInFLR, active] = item.result as [`0x${string}`, `0x${string}`, bigint, bigint, boolean];
                        // Filter out inactive/invalid listings early
                        if (!active || nftContract === '0x0000000000000000000000000000000000000000') return null;
                        return {
                            id: listingId,
                            seller,
                            nftContract,
                            tokenId,
                            price: priceInFLR,
                            active,
                        };
                    } else {
                        console.warn(`Failed to fetch listing details for ID ${listingId}:`, item.error?.message);
                        return null; // Represent failed fetch
                    }
                }).filter(item => item !== null) as CombinedListing[]; // Filter out nulls and assert type
            }
        }
    });

    const activeListings = useMemo(() => listingDetailsRead.data ?? [], [listingDetailsRead.data]);

    // 4. Prepare tokenURI calls based on fetched listings
    const tokenUriCalls = useMemo(() => {
        if (activeListings.length === 0) return [];
        return activeListings.map(listing => ({
            address: listing.nftContract,
            abi: ERC721_ABI, // Use generic ERC721 ABI for tokenURI
            functionName: 'tokenURI',
            args: [listing.tokenId],
        }));
    }, [activeListings]);

    // 5. Fetch Token URIs
    const tokenUrisRead = useReadContracts({
        allowFailure: true,
        contracts: tokenUriCalls,
        query: {
            enabled: tokenUriCalls.length > 0,
            select: (data) => {
                // Combine active listings with their URIs
                return activeListings.map((listing, index) => ({
                    ...listing,
                    tokenUri: data[index].status === 'success' ? data[index].result as string : undefined,
                    metadataError: data[index].status !== 'success' ? (data[index].error?.message ?? "Failed to fetch URI") : undefined
                }));
            }
        }
    });

    // 6. Fetch Metadata based on URIs
    useEffect(() => {
        const listingsWithUris = tokenUrisRead.data;
        if (!listingsWithUris || listingsWithUris.length === 0) {
            setListings([]); // Reset if URIs not loaded or empty
            setIsFetchingMetadata(false);
            return;
        }

        // Avoid redundant fetches if data hasn't changed
        if (!tokenUrisRead.isFetching && !isFetchingMetadata) {
            let isMounted = true;
            setIsFetchingMetadata(true);
            setGlobalError(null);

            Promise.all(listingsWithUris.map(async (listingInfo) => {
                const { tokenUri } = listingInfo;
                if (!tokenUri) {
                    console.warn(`Token URI missing for tokenId: ${listingInfo.tokenId}`);
                    return {
                        ...listingInfo,
                        metadata: undefined, // Explicitly undefined
                        metadataError: "Token URI is missing",
                    };
                }
                try {
                    const fetchResult = await fetchMetadata(tokenUri);
                    if (fetchResult.error) {
                         console.error(`Failed to fetch metadata for ${tokenUri}:`, fetchResult.error);
                        return { 
                            ...listingInfo, 
                            metadata: undefined, // Explicitly undefined
                            metadataError: fetchResult.error 
                        };
                    }
                    // Success case: extract metadata
                    return { 
                        ...listingInfo, 
                        metadata: fetchResult.metadata, // Correctly assign the metadata object
                        metadataError: undefined // Clear any previous URI error
                    }; 
                } catch (metaError: any) { // Catch unexpected errors during fetchMetadata call itself
                    console.error(`Unexpected error fetching metadata for ${tokenUri}:`, metaError);
                    return {
                        ...listingInfo,
                        metadata: undefined, // Explicitly undefined
                        metadataError: metaError.message || "Unexpected fetch error",
                    };
                }
            })).then((results) => {
                if (isMounted) {
                    setListings(results);
                    setIsFetchingMetadata(false);
                }
            }).catch(err => {
                console.error("Unexpected error fetching metadata batch:", err);
                if (isMounted) {
                    setGlobalError("Unexpected error processing metadata.");
                    setIsFetchingMetadata(false);
                }
            });

            return () => { isMounted = false; };
        }
    }, [tokenUrisRead.data, tokenUrisRead.isFetching, isFetchingMetadata]);

    // --- Buy Item Logic --- 
     const { 
        data: buyTxHash, 
        isPending: isBuyPending, 
        writeContract: buyItem 
    } = useWriteContract();

    const { isLoading: isBuyTxLoading, isSuccess: isBuyTxSuccess } = useWaitForTransactionReceipt({ 
        hash: buyTxHash,
        query: { enabled: !!buyTxHash } 
    });

    const handleBuyClick = (listing: CombinedListing) => {
        if (!buyItem) {
            toast.error("Buy function not ready.");
            return;
        }
        if (!connectedAddress) {
             toast.error("Please connect your wallet to buy.");
            return;
        }
        if (listing.seller.toLowerCase() === connectedAddress.toLowerCase()) {
            toast.warning("You cannot buy your own listing.");
            return;
        }

        setBuyingListingId(listing.id);
        toast.info(`Initiating purchase for NFT #${listing.tokenId}...`);

        buyItem({
            address: MARKETPLACE_ADDRESS,
            abi: MARKETPLACE_ABI,
            functionName: 'buyItem',
            args: [listing.id],
            value: listing.price, // Send the required price in wei
        }, {
            onSuccess: (hash) => {
                toast.success(`Purchase transaction submitted: ${hash}`);
                // Optionally optimistically update UI or wait for confirmation
            },
            onError: (err: any) => {
                toast.error(`Purchase failed: ${err.shortMessage || err.message}`);
                setBuyingListingId(null);
            },
            // onSettled: () => { // Use onSettled if you need cleanup regardless of success/error
            //     setBuyingListingId(null);
            // }
        });
    };

    // Effect to handle buy transaction confirmation
    useEffect(() => {
        if (isBuyTxSuccess) {
            toast.success(`NFT successfully purchased! Listing ID: ${buyingListingId}`);
            setBuyingListingId(null);
            // Trigger refetch of listings after purchase
            listingDetailsRead.refetch(); 
            tokenUrisRead.refetch(); // Need to refetch URIs too
        }
        // isBuyTxLoading handles the pending state via buyingListingId
        // Error is handled in the onError callback of buyItem
    }, [isBuyTxSuccess, buyingListingId, listingDetailsRead, tokenUrisRead]);


    // --- Render Logic --- 

    const isInitialLoading = isLoadingCount;
    const isDetailLoading = !isInitialLoading && (listingDetailsRead.isLoading || tokenUrisRead.isLoading || isFetchingMetadata);
    // Consolidate error checking
    const combinedError = globalError || countError?.message || listingDetailsRead.error?.message || tokenUrisRead.error?.message;

    if (isInitialLoading) {
        return <div className="text-center p-10">Loading listing count...</div>;
    }

    if (combinedError) {
        return <div className="text-center p-10 text-red-500">Error: {combinedError}</div>;
    }
    
    if (isDetailLoading) {
         return <div className="text-center p-10">Loading listing details...</div>;
    }

    if (!isDetailLoading && listings.length === 0) {
        return <div className="text-center p-10 text-muted-foreground">No active items listed for sale.</div>;
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {listings.map((listing) => {
                const isBuyingThis = (isBuyPending || isBuyTxLoading) && buyingListingId === listing.id;
                return (
                    <NFTCard
                        key={listing.id.toString()}
                        tokenId={Number(listing.tokenId)}
                        name={listing.metadata?.name}
                        description={listing.metadata?.description}
                        imageUrl={listing.metadata?.image}
                        price={listing.formattedPrice}
                        actionButtonLabel={isBuyingThis ? "Buying..." : "Buy Now"}
                        onActionClick={() => handleBuyClick(listing)}
                    />
                );
             })}
        </div>
    );
};

export default MarketplaceList; 