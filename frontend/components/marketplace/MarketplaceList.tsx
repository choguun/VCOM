'use client'; // Needs to be client component for potential hooks later

import React, { useState, useEffect } from 'react';
import NFTCard from '@/components/nft/NFTCard';
import { useReadContract } from 'wagmi';
import { parseAbiItem } from 'viem'; // For defining ABI items

// --- Contract Config --- TODO: Move to a central config file later
const MARKETPLACE_CONTRACT_ADDRESS = "0xd06b5a486f7239AE03a0af3e38E2041c932B0920"; // <-- REPLACE WITH ACTUAL DEPLOYED ADDRESS

// Manually define ABI fragments for Marketplace contract
const marketplaceAbi = [
  // Function to get a listing by ID
  parseAbiItem('function listings(uint256 listingId) view returns (address seller, address nftContract, uint256 tokenId, uint256 priceInFLR, bool active)'),
  // Function/Variable to get the next listing ID (effectively the count)
  parseAbiItem('function _nextListingId() view returns (uint256)'), // Assuming it's public or has a getter
  // Event (optional, for listening to updates later)
  // parseAbiItem('event ItemListed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)'),
];

// Placeholder data structure for listings
interface Listing {
  id: string; // Corresponds to listingId
  tokenId: number;
  price: string; // e.g., "150 FLR"
  seller: string;
  nftContract: string;
  active: boolean;
  // Add potential metadata fetched later
  name?: string;
  description?: string;
  imageUrl?: string;
}

// Simulate fetching metadata (replace with actual IPFS/API call)
const fetchNFTMetadata = async (nftContract: string, tokenId: number): Promise<Partial<Listing>> => {
    console.log(`Simulating metadata fetch for ${nftContract} #${tokenId}`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate short delay
    // TODO: Fetch actual metadata from tokenURI (likely IPFS)
    return {
        name: `NFT #${tokenId}`,
        description: `Description for NFT #${tokenId} fetched from metadata.`,
        imageUrl: undefined // Use placeholder for now
    }
}

const MarketplaceList = () => {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 1. Read the total number of listings (_nextListingId)
  const { data: nextListingIdData, isLoading: isLoadingCount, error: countError } = useReadContract({
    address: MARKETPLACE_CONTRACT_ADDRESS,
    abi: marketplaceAbi,
    functionName: '_nextListingId',
    // chainId: coston2Chain.id // Optional: Specify chain if not default
  });

  const listingCount = nextListingIdData ? Number(nextListingIdData) : 0;

  // 2. Fetch individual listings based on count (example structure)
  useEffect(() => {
    if (isLoadingCount || countError || listingCount === 0) {
        // Handle loading state or error for count, or if count is zero
        if (!isLoadingCount) setIsLoading(false);
        if (countError) {
             console.error("Error fetching listing count:", countError);
             setError("Failed to fetch listing count.");
        }
         if (listingCount === 0 && !isLoadingCount && !countError) {
             setError(null); // Clear previous errors if count is now 0
             setListings([]); // Ensure listings are empty
         }
        return;
    }

    const fetchAllListings = async () => {
        console.log(`Attempting to fetch details for ${listingCount} listings...`);
        setError(null);
        setIsLoading(true);
        const fetchedListings: Listing[] = [];
        try {
            for (let i = 0; i < listingCount; i++) {
                // In a real app, useReadContract might not be ideal inside a loop.
                // Consider multicall or a dedicated hook for fetching multiple items.
                // This is a simplified example using sequential reads (inefficient).
                
                // TODO: Replace this sequential fetching with a more efficient method (useReadContracts, multicall)
                // Fetch listing data (this part needs wagmi integration)
                // const listingData = await readContract(config, {
                //     address: MARKETPLACE_CONTRACT_ADDRESS,
                //     abi: marketplaceAbi,
                //     functionName: 'listings',
                //     args: [BigInt(i)]
                // });
                
                // --- Placeholder data until wagmi read inside loop is set up --- 
                const listingData = { 
                    seller: `0xSeller${i+1}...`, 
                    nftContract: '0xVCC...',
                    tokenId: BigInt(100 + i), 
                    priceInFLR: BigInt(150 + i*10) * BigInt(10)**BigInt(16), // Price in wei (e.g., 1.5 FLR)
                    active: true 
                };
                // --- End Placeholder --- 

                if (listingData && listingData.active) {
                    const metadata = await fetchNFTMetadata(listingData.nftContract, Number(listingData.tokenId));
                    // Format price from wei to FLR string (example)
                    const priceInFlr = parseFloat((Number(listingData.priceInFLR) / 1e18).toFixed(2));
                    
                    fetchedListings.push({
                        id: i.toString(),
                        tokenId: Number(listingData.tokenId),
                        price: `${priceInFlr} CFLR`, // Use CFLR for Coston2
                        seller: listingData.seller,
                        nftContract: listingData.nftContract,
                        active: listingData.active,
                        ...metadata // Add fetched metadata
                    });
                }
            }
            setListings(fetchedListings);
        } catch (err) {            console.error("Error fetching individual listings:", err);
            setError("Failed to fetch listing details.");
        } finally {
            setIsLoading(false);
        }
    };

    fetchAllListings();

  }, [nextListingIdData, isLoadingCount, countError, listingCount]); // Re-run if count changes

  const handleBuyClick = (listingId: string) => {
    console.log(`Attempting to buy listing: ${listingId}`);
    // TODO: Implement buy logic - requires useWriteContract hook
    alert(`Buy functionality requires useWriteContract hook (listing ${listingId}).`);
  };

  // Combined loading state
  if (isLoading) {
    return <div className="text-center p-10">Loading listings...</div>;
  }

  if (error) {
    return <div className="text-center p-10 text-red-500">Error: {error}</div>;
  }

  if (!isLoading && listings.length === 0) {
    return <div className="text-center p-10 text-muted-foreground">No active items listed for sale.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {listings.map((listing) => (
        <NFTCard
          key={listing.id}
          tokenId={listing.tokenId}
          name={listing.name}
          description={listing.description}
          imageUrl={listing.imageUrl}
          price={listing.price}
          actionButtonLabel="Buy Now"
          onActionClick={() => handleBuyClick(listing.id)}
        />
      ))}
    </div>
  );
};

export default MarketplaceList; 