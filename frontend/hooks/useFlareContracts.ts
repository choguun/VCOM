import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { FTSO_READER_ADDRESS, FTSO_READER_ABI } from '@/config/contracts';

// Export the interface so it can be imported elsewhere
export interface FlrUsdPriceData {
    price: bigint; 
    // Ensure correct order matching the ABI outputs
    decimals: number; 
    timestamp: bigint;
    formattedPrice?: string; 
}

/**
 * Custom hook to fetch the current FLR/USD price from the FTSOReader contract.
 * Handles loading, error states, and formats the price based on its decimals.
 */
export function useFlrUsdPrice() {
    const { data, isLoading, error, refetch, isError } = useReadContract({
        address: FTSO_READER_ADDRESS,
        abi: FTSO_READER_ABI,
        functionName: 'getFlrUsdPrice',
        query: {
            refetchInterval: 60000,
            select: (rawData): FlrUsdPriceData | null => {
                if (!rawData) return null;
                // Destructure according to the new return type: (uint256 value, int8 decimals, uint64 timestamp)
                const [price, decimalsInt8, timestamp] = rawData as readonly [bigint, number, bigint]; 
                
                // Convert int8 decimals to number
                const decimals = Number(decimalsInt8);
                
                // Basic validation
                if (price === BigInt(0) || decimals === 0) {
                    console.warn("[useFlrUsdPrice] Received zero price or decimals from contract.");
                    return null; // Indicate data is not valid/available
                }
                
                const formattedPrice = formatUnits(price, decimals);
                 
                return {
                    price,
                    decimals, // Use the converted number
                    timestamp, 
                    formattedPrice
                };
            }
        }
    });

    return {
        priceData: data,
        isLoadingPrice: isLoading,
        isErrorPrice: isError,
        errorPrice: error,
        refetchPrice: refetch
    };
}

// --- convertFlrToUsd function (update to use correct priceData structure) ---
/**
 * Converts an amount of FLR to USD using the provided price data.
 */
export function convertFlrToUsd(flrAmount: bigint | undefined | null, priceData: FlrUsdPriceData | null | undefined): string | null {
    // Check if priceData and necessary fields exist
    if (!flrAmount || !priceData || typeof priceData.price === 'undefined' || typeof priceData.decimals === 'undefined' || priceData.price === BigInt(0)) {
        return null;
    }

    const scale = BigInt(18 + priceData.decimals);
    // const usdValueScaled = (flrAmount * priceData.price) / (BigInt(10) ** scale); // Less precise for display
    
    // Calculate value in terms of the price's smallest unit (e.g., 10^-8 for USD)
    const usdValueFinney = (flrAmount * priceData.price) / (BigInt(10)**BigInt(18)); 
    
    // Format using the price decimals
    const formattedUsd = formatUnits(usdValueFinney, priceData.decimals);

    // Attempt to format as currency
    try {
        return parseFloat(formattedUsd).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    } catch {
        return formattedUsd; // Fallback
    }
} 