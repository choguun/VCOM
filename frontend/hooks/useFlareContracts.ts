import { useReadContract } from 'wagmi';
import type { Abi } from 'viem';
import { formatUnits } from 'viem';

// Deployed FTSOReader Address 
const FTSO_READER_ADDRESS = '0xe2e63Cfd26459C8B1ca11271eE6AB7Cf03eC4271';

// Updated FTSOReader ABI (Full ABI provided by user)
const FTSO_READER_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"_ftsoRegistry","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"FLR_SYMBOL","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"USD_SYMBOL","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"convertFlrToUsd","inputs":[{"name":"flrAmount","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"usdValue","type":"uint256","internalType":"uint256"},{"name":"usdDecimals","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},
    {"type":"function","name":"ftsoRegistryAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    // Corrected getFlrUsdPrice output order
    {"type":"function","name":"getFlrUsdPrice","inputs":[],"outputs":[{"name":"price","type":"uint256","internalType":"uint256"},{"name":"decimals","type":"uint8","internalType":"uint8"},{"name":"timestamp","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"error","name":"FTSOReader__FtsoNotFound","inputs":[]},
    {"type":"error","name":"FTSOReader__PriceQueryFailed","inputs":[]}
];

interface FlrUsdPriceData {
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
                // Ensure rawData destructuring matches the corrected ABI output order
                const [price, decimals, timestamp] = rawData as readonly [bigint, number, bigint];
                const formattedPrice = formatUnits(price, decimals); 
                return {
                    price,
                    decimals, // Correct order
                    timestamp, // Correct order
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