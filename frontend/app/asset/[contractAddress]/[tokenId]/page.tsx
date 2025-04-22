'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation'; // Hook to get route params in client components
import NFTCard from '@/components/nft/NFTCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Placeholder types (replace with actual contract data structures)
interface NftDetails {
    tokenId: string;
    contractAddress: string;
    name?: string;
    description?: string;
    imageUrl?: string;
    owner?: string;
    isCarbonCredit?: boolean; // Flag to determine if it's a retir-able NFT
    // Add other relevant metadata/properties
}

// Simulate fetching NFT details
const fetchNftDetails = async (contractAddress: string, tokenId: string): Promise<NftDetails | null> => {
    console.log(`Simulating fetch for NFT: ${contractAddress} #${tokenId}`);
    await new Promise(resolve => setTimeout(resolve, 300));
    // TODO: Replace with actual contract read calls (tokenURI, ownerOf, etc.) and metadata fetching
    
    // Example data (determine type based on mock contract address)
    const isCC = contractAddress.toLowerCase().includes('vcc'); // Simple check for example
    if (tokenId === '50' && isCC) {
        return {
            tokenId,
            contractAddress,
            name: 'My Credit #50',
            description: 'Detailed description of Carbon Credit #50. Acquired through verified action XYZ.',
            owner: '0xUserAddressPlaceholder',
            imageUrl: undefined,
            isCarbonCredit: true,
        };
    } else if (tokenId === '1' && !isCC) {
         return {
            tokenId,
            contractAddress,
            name: 'Retirement Reward #1',
            description: 'Reward NFT received for retiring a Carbon Credit. Represents Tier 1 reward.',
            owner: '0xUserAddressPlaceholder',
            imageUrl: undefined,
            isCarbonCredit: false,
        };
    }
    
    return null; // NFT not found
};


const NftDetailPage = () => {
    const params = useParams();
    const contractAddress = params.contractAddress as string;
    const tokenId = params.tokenId as string;

    const [nftDetails, setNftDetails] = useState<NftDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!contractAddress || !tokenId) return;

        const loadDetails = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const details = await fetchNftDetails(contractAddress, tokenId);
                if (details) {
                    setNftDetails(details);
                } else {
                    setError('NFT not found or details could not be loaded.');
                }
            } catch (err) {
                console.error("Error fetching NFT details:", err);
                setError("Failed to load NFT details.");
            } finally {
                setIsLoading(false);
            }
        };

        loadDetails();
    }, [contractAddress, tokenId]);

    const handleRetireClick = () => {
        if (!nftDetails) return;
        console.log(`Attempting to retire NFT: ${nftDetails.contractAddress} #${nftDetails.tokenId}`);
        // TODO: Implement retire logic using useWriteContract
        alert(`Retire functionality not implemented yet for token ${nftDetails.tokenId}.`);
    };

    if (isLoading) {
        return <div className="text-center p-10">Loading NFT details...</div>;
    }

    if (error) {
        return <div className="text-center p-10 text-red-500">Error: {error}</div>;
    }

    if (!nftDetails) {
        // Should be caught by error state, but as a fallback
        return <div className="text-center p-10 text-muted-foreground">NFT details not available.</div>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Asset Details</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* NFT Card Preview */}
                <div className="md:col-span-1">
                    <NFTCard 
                        tokenId={nftDetails.tokenId}
                        name={nftDetails.name}
                        imageUrl={nftDetails.imageUrl}
                        // No price or action button needed on the card itself here
                    />
                </div>

                {/* Details Section */}
                <div className="md:col-span-2 space-y-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>{nftDetails.name || `Token #${nftDetails.tokenId}`}</CardTitle>
                            <CardDescription>Contract: {nftDetails.contractAddress}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                             <p className="text-sm">
                                 <span className="font-semibold">Token ID:</span> {nftDetails.tokenId}
                             </p>
                            {nftDetails.owner && (
                                <p className="text-sm">
                                     <span className="font-semibold">Owner:</span> {nftDetails.owner}
                                </p>
                            )}
                            {nftDetails.description && (
                                <div>
                                     <h3 className="font-semibold text-sm mb-1">Description</h3>
                                     <p className="text-sm text-muted-foreground">{nftDetails.description}</p>
                                </div>
                            )}
                            {/* TODO: Add more metadata display here (Attributes, etc.) */}
                        </CardContent>
                    </Card>

                    {/* Retirement Section (Conditional) */}
                    {nftDetails.isCarbonCredit && (
                        <Card>
                             <CardHeader>
                                 <CardTitle>Retire Carbon Credit</CardTitle>
                                 <CardDescription>Retiring this NFT permanently removes it from circulation and triggers a chance to receive a random Reward NFT.</CardDescription>
                             </CardHeader>
                             <CardContent>
                                 {/* TODO: Add details about RNG fee if needed */}
                                 <Button className="w-full" onClick={handleRetireClick}>
                                     Retire this NFT
                                 </Button>
                                  {/* Placeholder for retirement status/result */}
                                  <div className="mt-4 text-sm text-muted-foreground">
                                      Retirement status will appear here...
                                  </div>
                             </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NftDetailPage; 