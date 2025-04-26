'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatEther, parseEther, decodeEventLog } from 'viem'; // Import decodeEventLog
import type { Abi, Log } from 'viem'; 
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useFlrUsdPrice, convertFlrToUsd } from "@/hooks/useFlareContracts"; // Import the hook and helper
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { 
    MARKETPLACE_ADDRESS, 
    CARBON_CREDIT_NFT_ADDRESS 
} from '@/config/contracts'; // Import addresses from config

// --- Marketplace ABI --- 
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

// --- Added from MyAssetsPage --- 
// Basic ERC721 ABI fragments needed for tokenURI
const ERC721_ABI: Abi = [
  { name: 'tokenURI', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [{ name: 'uri', type: 'string' }], stateMutability: 'view', type: 'function' },
] as const;

interface NftMetadata {
    name?: string;
    description?: string;
    image?: string;
    // Add other potential attributes
}

// --- fetchMetadata Helper ---
async function fetchMetadata(tokenUri: string): Promise<{ metadata: NftMetadata | null; error?: string }> {
    if (!tokenUri) {
        return { metadata: null, error: "Token URI is empty." };
    }

    // 1. Check if it's the placeholder
    if (tokenUri === 'ipfs://METADATA_PLACEHOLDER') {
        return { metadata: null, error: "Metadata not available (placeholder)." };
    }

    // 2. Check if it looks like a JSON string (On-Chain JSON)
    if (tokenUri.startsWith('{') && tokenUri.endsWith('}')) {
        try {
            const metadata = JSON.parse(tokenUri);
            if (typeof metadata === 'object' && metadata !== null) {
                return { metadata: metadata as NftMetadata };
            }
            return { metadata: null, error: "Invalid on-chain JSON metadata format" };
        } catch (e) {
            console.error("Failed to parse on-chain JSON metadata:", e);
            return { metadata: null, error: "Failed to parse on-chain JSON metadata." };
        }
    }

    // 3. Assume it's a URL (IPFS or HTTP)
    const url = tokenUri.startsWith('ipfs://')
        ? `https://ipfs.io/ipfs/${tokenUri.split('ipfs://')[1]}`
        : tokenUri;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                return { metadata: null, error: "Metadata not found (invalid URI)." };
            }
            // Attempt to read non-JSON error response as text
            const errorText = await response.text().catch(() => `Status: ${response.status}`);
            throw new Error(`HTTP error! ${errorText}`); 
        }
        
        // Attempt to parse response as JSON
        const metadata = await response.json();
        if (typeof metadata === 'object' && metadata !== null) {
             // Handle potential image IPFS URI within metadata
            if (metadata.image && metadata.image.startsWith('ipfs://')) {
                metadata.image = `https://ipfs.io/ipfs/${metadata.image.split('ipfs://')[1]}`;
            }
            return { metadata: metadata as NftMetadata };
        }
        return { metadata: null, error: "Invalid metadata format from URL" };
    } catch (error: any) {
        console.error("Failed to fetch or parse metadata from URL:", url, error);
        return { metadata: null, error: error.message || "Unknown metadata fetch error" };
    }
}
// --- End fetchMetadata Helper ---

// Define the structure of a listing based on the ABI output
interface Listing {
  listingId: bigint; 
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  priceInFLR: bigint;
  active: boolean;
  // Add metadata fields
  tokenUri?: string;
  metadata?: NftMetadata;
  metadataError?: string;
}

const MAX_LISTINGS_TO_FETCH = 20; 
const ITEMS_PER_PAGE = 8; // Number of items to show initially and per load

// +++ MOCK DATA SECTION +++
const USE_MOCK_DATA = false; // Set to true to use mock data, false to use live data

const MOCK_LISTINGS: Listing[] = USE_MOCK_DATA ? [
  {
    listingId: BigInt(1000), 
    seller: '0xMockSeller100000000000000000000000000',
    nftContract: CARBON_CREDIT_NFT_ADDRESS as `0x${string}`, // Cast to required type
    tokenId: BigInt(1), 
    priceInFLR: parseEther('15'), 
    active: true,
    metadata: {
        name: 'Mock Carbon Credit #1',
        description: 'This is a sample description for a mock NFT.',
        image: '/placeholder-nft.png' // Use a placeholder image
    }
  },
  {
    listingId: BigInt(1001),
    seller: '0xMockSeller200000000000000000000000000',
    nftContract: CARBON_CREDIT_NFT_ADDRESS as `0x${string}`, // Cast to required type
    tokenId: BigInt(2),
    priceInFLR: parseEther('25.5'),
    active: true,
    metadata: {
        name: 'Mock Carbon Credit #2',
        description: 'Another sample description for testing purposes.',
        image: '/placeholder-nft.png'
    }
  },
  // Add more mock listings as needed (copy and paste the structure)
  // Example: Add 10 more mock items for pagination testing
  ...Array.from({ length: 10 }).map((_, i) => ({
    listingId: BigInt(1002 + i),
    seller: `0xMockSeller${3 + i}00000000000000000000000000` as `0x${string}`,
    nftContract: CARBON_CREDIT_NFT_ADDRESS as `0x${string}`, // Cast to required type
    tokenId: BigInt(3 + i),
    priceInFLR: parseEther((30 + i * 2).toString()),
    active: true,
    metadata: {
        name: `Mock Carbon Credit #${3 + i}`,
        description: `Description for mock item ${3 + i}.`,
        image: '/placeholder-nft.png'
    }
  }))
] : [];
// +++ END MOCK DATA SECTION +++

export default function MarketplacePage() {
  const { address } = useAccount(); // Get connected user address
  const [buyingListingId, setBuyingListingId] = useState<bigint | null>(null); // Track purchase
  const [cancellingListingId, setCancellingListingId] = useState<bigint | null>(null); // Add state for cancelling
  const [listingsWithMetadata, setListingsWithMetadata] = useState<Listing[]>([]);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE); // +++ Add display count state
  const { priceData, isLoadingPrice, isErrorPrice, errorPrice } = useFlrUsdPrice();

  // --- Fetch Listings (Base data) ---
  const listingCalls = useMemo(() => {
    const calls = [];
    for (let i = 0; i < MAX_LISTINGS_TO_FETCH; i++) {
      calls.push({
        address: MARKETPLACE_ADDRESS as `0x${string}`,
        abi: MARKETPLACE_ABI,
        functionName: 'listings',
        args: [BigInt(i)],
      });
    }
    return calls;
  }, []);

  const { 
    data: baseListingsData,
    isLoading: isLoadingListings,
    error: errorListings,
    refetch: refetchListings 
  } = useReadContracts({
      allowFailure: true, 
      contracts: listingCalls,
      query: {
          select: (data): Omit<Listing, 'tokenUri' | 'metadata' | 'metadataError'>[] => { // Select only base data first
              const activeListings: Omit<Listing, 'tokenUri' | 'metadata' | 'metadataError'>[] = [];
              data.forEach((item, index) => {
                  if (item.status === 'success' && item.result) {
                      const listingResult = item.result as readonly [ `0x${string}`, `0x${string}`, bigint, bigint, boolean ];
                      if (listingResult[4]) { 
                          activeListings.push({
                              listingId: BigInt(index),
                              seller: listingResult[0],
                              nftContract: listingResult[1],
                              tokenId: listingResult[2],
                              priceInFLR: listingResult[3],
                              active: listingResult[4],
                          });
                      }
                  }
              });
              return activeListings; 
          },
          enabled: !USE_MOCK_DATA
      }
  });

  const baseListings = baseListingsData ?? [];

  // --- Fetch Token URIs based on baseListings ---
  const tokenUriCalls = useMemo(() => {
      if (baseListings.length === 0) return [];
      return baseListings.map(item => ({
          address: item.nftContract, // Use specific NFT contract address
          abi: ERC721_ABI, // Use the minimal ABI with tokenURI
          functionName: 'tokenURI',
          args: [item.tokenId],
      }));
  }, [baseListings]);

  const { 
      data: tokenUrisData, 
      isLoading: isLoadingUris,
      error: errorUris 
  } = useReadContracts({
      allowFailure: true, 
      contracts: tokenUriCalls,
      query: {
          enabled: !USE_MOCK_DATA && baseListings.length > 0,
          select: (data) => {
              // Combine base listing info with token URI or error
              return baseListings.map((item, index) => ({
                  ...item, // Includes listingId, seller, nftContract, tokenId, priceInFLR, active
                  tokenUri: data[index].status === 'success' ? data[index].result as string : undefined,
                  metadataError: data[index].status !== 'success' ? (data[index].error?.message ?? "Failed to fetch URI") : undefined
              }));
          }
      }
  });

  // --- Fetch Metadata based on Token URIs ---
  useEffect(() => {
      if (USE_MOCK_DATA) return; // Skip metadata fetch if using mock data
      const listingsWithUris = tokenUrisData;
      if (!listingsWithUris || listingsWithUris.length === 0) {
          setListingsWithMetadata([]); // Reset if URIs are not loaded or empty
          setIsFetchingMetadata(false);
          return;
      }

      if (!isLoadingUris && !isFetchingMetadata) { // Check isLoadingUris instead
          let isMounted = true;
          setIsFetchingMetadata(true);
          setMetadataError(null);

          Promise.all(listingsWithUris.map(async (listingInfo) => {
              if (!listingInfo.tokenUri) {
                  return { ...listingInfo, metadata: null }; 
              }
              const { metadata, error } = await fetchMetadata(listingInfo.tokenUri);
              return { ...listingInfo, metadata, metadataError: error ?? listingInfo.metadataError };
          })).then((results) => {
              if (isMounted) {
                  setListingsWithMetadata(results as Listing[]); // results should now match Listing[]
                  setIsFetchingMetadata(false);
              }
          }).catch(err => {
               console.error("Unexpected error fetching metadata batch:", err);
               if (isMounted) {
                   setMetadataError("Unexpected error processing metadata.");
                   setIsFetchingMetadata(false);
               }
          });

          return () => { isMounted = false; };
      }
  }, [tokenUrisData, isLoadingUris, isFetchingMetadata]);

  // --- Buy Item Logic ---
  const { 
    data: buyTxHash,
    isPending: isBuyPending,
    error: buyError,
    writeContract: buyItem
  } = useWriteContract();

  const { isLoading: isBuyTxLoading, isSuccess: isBuyTxSuccess } = useWaitForTransactionReceipt({ 
    hash: buyTxHash,
    query: { enabled: !!buyTxHash }
  });

  const handleBuy = (listingId: bigint, price: bigint) => {
    if (!buyItem) return;
    setBuyingListingId(listingId); // Track which item is being bought
    toast.info(`Initiating purchase for listing #${listingId}...`);
    buyItem({ 
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: 'buyItem',
      args: [listingId],
      value: price // Send the priceInFLR as msg.value
    }, {
        onSuccess: (hash) => {
             toast.success(`Purchase transaction submitted: ${hash}`);
        },
        onError: (err) => {
            toast.error(`Purchase failed: ${err.message}`);
            setBuyingListingId(null); // Reset on error
        }
    });
  };

  useEffect(() => {
      if (isBuyTxSuccess) {
          toast.success(`Successfully purchased listing #${buyingListingId}!`);
          setBuyingListingId(null); // Reset
          refetchListings(); // Refetch listings after successful purchase
      }
      if (buyError) {
          // Handled in onError callback
      }
  }, [isBuyTxSuccess, buyError, buyingListingId, refetchListings]);

  // --- Cancel Listing Logic ---
  const { 
    data: cancelTxHash,
    isPending: isCancelPending,
    error: cancelError,
    writeContract: cancelListing
  } = useWriteContract();

  const { isLoading: isCancelTxLoading, isSuccess: isCancelTxSuccess } = useWaitForTransactionReceipt({ 
    hash: cancelTxHash,
    query: { enabled: !!cancelTxHash }
  });

  const handleCancel = (listingId: bigint) => {
    if (!cancelListing) return;
    setCancellingListingId(listingId);
    toast.info(`Initiating cancellation for listing #${listingId}...`);
    cancelListing({ 
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: 'cancelListing',
      args: [listingId]
    }, {
        onSuccess: (hash) => {
             toast.success(`Cancellation transaction submitted: ${hash}`);
        },
        onError: (err) => {
            toast.error(`Cancellation failed: ${err.message}`);
            setCancellingListingId(null);
        }
    });
  };

  useEffect(() => {
      if (isCancelTxSuccess) {
          toast.success(`Successfully cancelled listing #${cancellingListingId}!`);
          setCancellingListingId(null);
          refetchListings(); 
      }
      if (cancelError) {
          // Handled in onError callback
      }
  }, [isCancelTxSuccess, cancelError, cancellingListingId, refetchListings]);

  // --- Watch ItemSold Event ---
  useWatchContractEvent({
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      eventName: 'ItemSold',
      onLogs(logs) {
        console.log('ItemSold event received:', logs);
        logs.forEach((log: Log) => { // Explicitly type log as Log from viem
          try {
            // Use decodeEventLog for safe parsing
            const decodedLog = decodeEventLog({
              abi: MARKETPLACE_ABI,
              data: log.data,
              topics: log.topics,
              eventName: 'ItemSold' // Specify event name again for filtering/type safety
            });
            
            // Access args from the decoded log
            const args = decodedLog.args as {
                listingId?: bigint;
                buyer?: `0x${string}`;
            };

            const message = `Item #${args.listingId?.toString()} just sold${args.buyer ? ` to ${args.buyer}` : ''}!`;
            toast.info(message);
            
            setTimeout(() => {
                refetchListings();
            }, 1000); 

          } catch (e) {
            console.error("Failed to decode ItemSold event:", e, log);
          }
        });
      },
      onError(error) {
          console.error('Error watching ItemSold event:', error);
          toast.error('Error listening for market events.');
      }
  });

  // +++ Watch ItemListed Event +++
  useWatchContractEvent({ 
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    eventName: 'ItemListed',
    onLogs(logs) {
      console.log('ItemListed event received:', logs);
      logs.forEach((log: Log) => {
        try {
          const decodedLog = decodeEventLog({
            abi: MARKETPLACE_ABI,
            data: log.data,
            topics: log.topics,
            eventName: 'ItemListed'
          });
          // Ensure correct type assertion for ItemListed args
          const args = decodedLog.args as { 
              listingId?: bigint; 
              seller?: `0x${string}`; 
              nftContract?: `0x${string}`;
              tokenId?: bigint;
              priceInFLR?: bigint;
          };
          const message = `New listing #${args.listingId?.toString()}! (Token #${args.tokenId?.toString()} by ${args.seller?.substring(0,6)}...)`;
          toast.info(message);
          // Refetch after a short delay to allow indexer/node to catch up
          setTimeout(() => { refetchListings(); }, 1500); 
        } catch (e) {
          console.error("Failed to decode ItemListed event:", e, log);
        }
      });
    },
    onError(error) {
        console.error('Error watching ItemListed event:', error);
        toast.error('Error listening for new listings.');
    }
  });

  // +++ Watch ListingCancelled Event +++
  useWatchContractEvent({ 
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    eventName: 'ListingCancelled',
    onLogs(logs) {
      console.log('ListingCancelled event received:', logs);
      logs.forEach((log: Log) => {
        try {
          const decodedLog = decodeEventLog({
            abi: MARKETPLACE_ABI,
            data: log.data,
            topics: log.topics,
            eventName: 'ListingCancelled'
          });
          const args = decodedLog.args as { listingId?: bigint; }; // Type assertion for ListingCancelled
          const message = `Listing #${args.listingId?.toString()} was cancelled.`;
          toast.warning(message); // Use warning style for cancellation
          // Refetch after a short delay
          setTimeout(() => { refetchListings(); }, 1500); 
        } catch (e) {
          console.error("Failed to decode ListingCancelled event:", e, log);
        }
      });
    },
    onError(error) {
        console.error('Error watching ListingCancelled event:', error);
        toast.error('Error listening for cancellations.');
    }
  });

  // Determine which data to use
  const dataToDisplay = USE_MOCK_DATA ? MOCK_LISTINGS : listingsWithMetadata;

  // Adjust loading/error states if using mock data
  const isInitialLoading = !USE_MOCK_DATA && isLoadingListings; 
  const isDetailLoading = !USE_MOCK_DATA && !isInitialLoading && (isLoadingUris || isFetchingMetadata); 
  let combinedError: string | null = USE_MOCK_DATA ? null : (errorListings?.message || errorUris?.message || metadataError || (isErrorPrice ? errorPrice?.message || "Price Error" : null));

  // Handler for Load More button
  const handleLoadMore = () => {
    // Use dataToDisplay length for calculation
    setDisplayCount(prev => Math.min(prev + ITEMS_PER_PAGE, dataToDisplay.length));
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-muted-foreground">
          Browse and purchase verifiable carbon credits issued on the Flare Network.
        </p>

        {/* --- Updated Loading Display Logic --- */}
        {isInitialLoading && (
          // Show skeleton grid ONLY during initial listing load
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader><Skeleton className="aspect-square rounded-md mb-2" /><Skeleton className="h-5 w-3/4 mb-1" /><Skeleton className="h-3 w-1/2" /></CardHeader>
                <CardContent><Skeleton className="h-3 w-full" /></CardContent>
                <CardFooter className="justify-end"><Skeleton className="h-8 w-16" /></CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Show text indicator while loading details (URIs/Metadata) */}
        {isDetailLoading && (
            <p className="text-center text-muted-foreground py-4">Loading details for listed items...</p>
        )}

        {/* Show error if any occurred */}
        {combinedError && (
          <p className="text-center text-red-500">
            {combinedError} 
          </p>
        )}

        {/* Display listings only if NOT initial loading, NOT detail loading, AND no error */}
        {!isInitialLoading && !isDetailLoading && !combinedError && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {dataToDisplay.slice(0, displayCount).map((item) => {
                const isBuyingThis = isBuyPending && buyingListingId === item.listingId;
                const isCancellingThis = isCancelPending && cancellingListingId === item.listingId;
                const isOwnedByCurrentUser = !USE_MOCK_DATA && item.seller.toLowerCase() === address?.toLowerCase();
                const usdPrice = convertFlrToUsd(item.priceInFLR, priceData);
                return (
                  <Card key={item.listingId.toString()}>
                    <CardHeader>
                      <div className="aspect-square bg-muted rounded-md mb-2 flex items-center justify-center overflow-hidden">
                         {/* --- Always display placeholder image --- */}
                         <img 
                              src="/placeholder-nft.jpg" 
                              alt={item.metadata?.name || `Token #${item.tokenId.toString()}`}
                              className="object-contain w-full h-full" 
                          />
                         {/* Remove previous logic checking item.metadata?.image */}
                         {/* {item.metadata?.image ? ( ... ) : item.metadataError ? ( ... ) : ( ... ) } */}
                      </div>
                      <CardTitle className="text-lg truncate">{item.metadata?.name || `Token #${item.tokenId.toString()}`}</CardTitle>
                      <CardDescription>
                        Price: {formatEther(item.priceInFLR)} C2FLR
                        {/* Display USD price if available */}
                        {usdPrice && <span className="text-xs text-muted-foreground ml-1">({usdPrice})</span>}
                        {isLoadingPrice && <span className="text-xs text-muted-foreground ml-1">(...)</span>} 
                      </CardDescription> 
                    </CardHeader>
                    <CardContent>
                        {/* Optionally display metadata description */}
                        <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{item.metadata?.description || "No description."}</p>
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <p className="text-xs text-muted-foreground truncate cursor-help" title={item.seller}> 
                                Seller: {item.seller}
                              </p>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{item.seller}</p>
                          </TooltipContent>
                        </Tooltip>
                        {item.metadataError && <p className="text-xs text-destructive">Error: {item.metadataError}</p>}
                    </CardContent>
                    <CardFooter className="justify-end">
                       {/* Conditionally render Buy or Cancel button */}
                       {isOwnedByCurrentUser ? (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span> 
                                 <Button 
                                   variant="destructive"
                                   size="sm" 
                                   onClick={() => handleCancel(item.listingId)}
                                   disabled={isCancellingThis || isCancelTxLoading || isCancelPending}
                                   style={{ pointerEvents: (isCancellingThis || isCancelTxLoading || isCancelPending) ? 'none' : 'auto' }} 
                                 >
                                    {isCancellingThis ? "Cancelling..." : "Cancel Listing"}
                                 </Button> 
                               </span>
                             </TooltipTrigger>
                             <TooltipContent>
                               <p>Remove this listing from the marketplace.</p>
                             </TooltipContent>
                           </Tooltip>
                       ) : (
                           <Tooltip>
                             <TooltipTrigger asChild>
                               <span> 
                                 <Button 
                                   size="sm" 
                                   onClick={() => handleBuy(item.listingId, item.priceInFLR)}
                                   disabled={isBuyingThis || isBuyTxLoading || !address}
                                   style={{ pointerEvents: (isBuyingThis || isBuyTxLoading || !address) ? 'none' : 'auto' }}
                                 >
                                   {isBuyingThis ? "Buying..." : "Buy Now"}
                                 </Button> 
                               </span>
                             </TooltipTrigger>
                              <TooltipContent>
                                <p>Buy NFT #{item.tokenId.toString()} for {formatEther(item.priceInFLR)} C2FLR</p>
                              </TooltipContent>
                            </Tooltip>
                       )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
            
            {/* +++ Conditionally render "Load More" button +++ */}
            {displayCount < dataToDisplay.length && (
              <div className="text-center mt-6">
                <Button onClick={handleLoadMore} variant="secondary">
                  Load More ({dataToDisplay.length - displayCount} remaining)
                </Button>
        </div>
            )}

            {/* Adjust "No items" message condition */}
            {dataToDisplay.length === 0 && (
                <p className="text-muted-foreground col-span-full text-center py-4">No active items found.</p>
            )}
          </>
        )}
    </div>
    </TooltipProvider>
  );
}
