'use client'; // Needs client hooks for fetching user assets later

import React, { useState, useEffect } from 'react';
import NFTCard from '@/components/nft/NFTCard';

// Placeholder data structure for owned NFTs
interface OwnedNFT {
  tokenId: number;
  contractAddress: string;
  // Metadata
  name?: string;
  description?: string;
  imageUrl?: string;
  // Specific data
  rewardTier?: number; // For Reward NFTs
}

// Simulate fetching data
const fetchOwnedAssets = async (userAddress: string | undefined): Promise<{ carbonCredits: OwnedNFT[], rewardNFTs: OwnedNFT[] }> => {
    if (!userAddress) return { carbonCredits: [], rewardNFTs: [] }; // Return empty if no user address
    
    console.log(`Simulating fetching assets for user: ${userAddress}...`);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    // TODO: Replace with actual contract calls using wagmi/viem
    // Need to call balanceOf and tokenOfOwnerByIndex (or similar) on both NFT contracts
    return {
        carbonCredits: [
            { tokenId: 50, contractAddress: '0xVCC...', name: 'My Credit #50', description: 'A credit I own.', imageUrl: undefined },
            { tokenId: 51, contractAddress: '0xVCC...', name: 'My Credit #51', description: 'Another one.', imageUrl: undefined },
        ],
        rewardNFTs: [
            { tokenId: 1, contractAddress: '0xRRNFT...', name: 'Retirement Reward', description: 'Reward for retiring an NFT.', rewardTier: 1, imageUrl: undefined },
        ]
    };
};

const MyAssetsPage = () => {
    // TODO: Get connected user address using wagmi's useAccount hook
    const { address } = { address: "0xUserAddressPlaceholder" }; // Placeholder address
    
    const [carbonCredits, setCarbonCredits] = useState<OwnedNFT[]>([]);
    const [rewardNFTs, setRewardNFTs] = useState<OwnedNFT[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadAssets = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const { carbonCredits: ccData, rewardNFTs: rnData } = await fetchOwnedAssets(address);
                setCarbonCredits(ccData);
                setRewardNFTs(rnData);
            } catch (err) {
                console.error("Error fetching owned assets:", err);
                setError("Failed to load owned assets.");
            } finally {
                setIsLoading(false);
            }
        };
        if (address) { // Only load if address is available
             loadAssets();
        } else {
             setIsLoading(false); // Not loading if no user connected
        }
    }, [address]);

    const handleRetireClick = (tokenId: number) => {
        console.log(`Attempting to retire Carbon Credit NFT: ${tokenId}`);
        // TODO: Implement retire logic - requires wallet connection & contract interaction
        alert(`Retire functionality not implemented yet for token ${tokenId}.`);
    };

    if (!address) {
         return <div className="text-center p-10 text-muted-foreground">Please connect your wallet to view your assets.</div>;
    }

    if (isLoading) {
        return <div className="text-center p-10">Loading your assets...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">Error: {error}</div>;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold mb-6">My Assets</h1>
            <p className="text-muted-foreground mb-6">
                View your collected Carbon Credit NFTs and Retirement Reward NFTs.
            </p>

            {/* Carbon Credits Section */}
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">My Carbon Credits (VCC)</h2>
                {carbonCredits.length === 0 ? (
                    <p className="text-muted-foreground">You do not own any Carbon Credits.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {carbonCredits.map((nft) => (
                            <NFTCard
                                key={`${nft.contractAddress}-${nft.tokenId}`}
                                tokenId={nft.tokenId}
                                name={nft.name}
                                description={nft.description}
                                imageUrl={nft.imageUrl}
                                actionButtonLabel="Retire NFT"
                                onActionClick={() => handleRetireClick(nft.tokenId)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {/* Reward NFTs Section */}
            <section>
                 <h2 className="text-2xl font-semibold mb-4 border-t pt-6">My Reward NFTs (RRNFT)</h2>
                 {rewardNFTs.length === 0 ? (
                     <p className="text-muted-foreground">You do not own any Reward NFTs.</p>
                 ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                         {rewardNFTs.map((nft) => (
                             <NFTCard
                                 key={`${nft.contractAddress}-${nft.tokenId}`}
                                 tokenId={nft.tokenId}
                                 name={nft.name}
                                 description={`${nft.description} (Tier: ${nft.rewardTier})`}
                                 imageUrl={nft.imageUrl}
                                 // No action button needed for reward NFTs in this view
                             />
                         ))}
                     </div>
                 )}
            </section>
        </div>
    );
};

export default MyAssetsPage; 