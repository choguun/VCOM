import { type Address, type Abi } from 'viem';

// Ensure addresses are typed correctly for Viem
export const FTSO_READER_ADDRESS: Address = '0xc86420c51A934C90c387167bE963a41e248fC845';
export const CARBON_CREDIT_NFT_ADDRESS: Address = '0xd6b141B028afC2918BA55349E3c6Bf5535E9b702';
export const REWARD_NFT_ADDRESS: Address = '0xADa7171F2e9622DE5E8d56f00Cc322a2CC8b79F3';
export const RETIREMENT_LOGIC_ADDRESS: Address = '0xF6A5d8B09486129BfcbEE5281E50e78C43Dc1519';
export const MARKETPLACE_ADDRESS: Address = '0x08651112EA2a6f80Fb8C2Ab56d96098De61Ad6cF';
export const USER_ACTIONS_ADDRESS: Address = '0x5fEFDa92BA0536a3690a8479A4A5AAFc26F4ECf0';

// ABIs (Add new ABI here)

export const USER_ACTIONS_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"_initialOwner","type":"address","internalType":"address"},{"name":"_attestationVerifierAddress","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"attestationVerifierAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"lastActionTimestamp","inputs":[{"name":"","type":"address","internalType":"address"},{"name":"","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"recordVerifiedAction","inputs":[{"name":"user","type":"address","internalType":"address"},{"name":"actionType","type":"bytes32","internalType":"bytes32"},{"name":"timestamp","type":"uint256","internalType":"uint256"},{"name":"proofData","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"renounceOwnership","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"setAttestationVerifierAddress","inputs":[{"name":"_newVerifierAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"event","name":"ActionRecorded","inputs":[{"name":"user","type":"address","indexed":true,"internalType":"address"},{"name":"actionType","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"timestamp","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"proofData","type":"bytes","indexed":false,"internalType":"bytes"}],"anonymous":false},
    {"type":"event","name":"AttestationVerifierSet","inputs":[{"name":"newVerifier","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"event","name":"OwnershipTransferred","inputs":[{"name":"previousOwner","type":"address","indexed":true,"internalType":"address"},{"name":"newOwner","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"error","name":"OwnableInvalidOwner","inputs":[{"name":"owner","type":"address","internalType":"address"}]},
    {"type":"error","name":"OwnableUnauthorizedAccount","inputs":[{"name":"account","type":"address","internalType":"address"}]},
    {"type":"error","name":"ReentrancyGuardReentrantCall","inputs":[]},
    {"type":"error","name":"UserActions__ActionAlreadyRecorded","inputs":[]},
    {"type":"error","name":"UserActions__InvalidActionType","inputs":[]},
    {"type":"error","name":"UserActions__NotAttestationVerifier","inputs":[]},
    {"type":"error","name":"UserActions__TimestampTooOld","inputs":[]}
] as const;

// CarbonCreditNFT ABI fragment for Claiming
export const CLAIM_TRANSPORT_NFT_ABI: Abi = [
    {
        "inputs": [],
        "name": "claimTransportNFT",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
] as const;

export const ERC721_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"initialOwner","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"DEFAULT_ADMIN_ROLE","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},
    {"type":"function","name":"MINTER_ROLE","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},
    {"type":"function","name":"approve","inputs":[{"name":"to","type":"address","internalType":"address"},{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"balanceOf","inputs":[{"name":"owner","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"burnForRetirement","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"getApproved","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"getRoleAdmin","inputs":[{"name":"role","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},
    {"type":"function","name":"grantRole","inputs":[{"name":"role","type":"bytes32","internalType":"bytes32"},{"name":"account","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"hasRole","inputs":[{"name":"role","type":"bytes32","internalType":"bytes32"},{"name":"account","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},
    {"type":"function","name":"isApprovedForAll","inputs":[{"name":"owner","type":"address","internalType":"address"},{"name":"operator","type":"address","internalType":"address"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},
    {"type":"function","name":"name","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"ownerOf","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"renounceOwnership","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"renounceRole","inputs":[{"name":"role","type":"bytes32","internalType":"bytes32"},{"name":"callerConfirmation","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"retirementContractAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"revokeRole","inputs":[{"name":"role","type":"bytes32","internalType":"bytes32"},{"name":"account","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"safeMint","inputs":[{"name":"to","type":"address","internalType":"address"},{"name":"uri","type":"string","internalType":"string"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"safeTransferFrom","inputs":[{"name":"from","type":"address","internalType":"address"},{"name":"to","type":"address","internalType":"address"},{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"safeTransferFrom","inputs":[{"name":"from","type":"address","internalType":"address"},{"name":"to","type":"address","internalType":"address"},{"name":"tokenId","type":"uint256","internalType":"uint256"},{"name":"data","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"setApprovalForAll","inputs":[{"name":"operator","type":"address","internalType":"address"},{"name":"approved","type":"bool","internalType":"bool"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"setRetirementContract","inputs":[{"name":"_retirementContract","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"supportsInterface","inputs":[{"name":"interfaceId","type":"bytes4","internalType":"bytes4"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},
    {"type":"function","name":"symbol","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"tokenByIndex","inputs":[{"name":"index","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"tokenOfOwnerByIndex","inputs":[{"name":"owner","type":"address","internalType":"address"},{"name":"index","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"tokenURI","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"totalSupply","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"transferFrom","inputs":[{"name":"from","type":"address","internalType":"address"},{"name":"to","type":"address","internalType":"address"},{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
] as const;

// ABI fragment for RetirementLogic
export const RETIREMENT_LOGIC_ABI: Abi = [
    { name: 'retireNFT', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

// Full ABI for RetirementLogic (including events)
export const RETIREMENT_LOGIC_FULL_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"_initialOwner","type":"address","internalType":"address"},{"name":"_carbonCreditNFT","type":"address","internalType":"address"},{"name":"_rewardNFT","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"carbonCreditNFTAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"randomNumberV2Address","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"renounceOwnership","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"retireNFT","inputs":[{"name":"tokenId","type":"uint256","internalType":"uint256"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"rewardNFTAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"setCarbonCreditNFTAddress","inputs":[{"name":"_newAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"setRewardNFTAddress","inputs":[{"name":"_newAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"event","name":"NFTRetired","inputs":[{"name":"user","type":"address","indexed":true,"internalType":"address"},{"name":"tokenId","type":"uint256","indexed":true,"internalType":"uint256"},{"name":"rewardTier","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"randomNumber","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"randomTimestamp","type":"uint256","indexed":false,"internalType":"uint256"}],"anonymous":false},
    {"type":"event","name":"OwnershipTransferred","inputs":[{"name":"previousOwner","type":"address","indexed":true,"internalType":"address"},{"name":"newOwner","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"error","name":"OwnableInvalidOwner","inputs":[{"name":"owner","type":"address","internalType":"address"}]},
    {"type":"error","name":"OwnableUnauthorizedAccount","inputs":[{"name":"account","type":"address","internalType":"address"}]},
    {"type":"error","name":"ReentrancyGuardReentrantCall","inputs":[]},
    {"type":"error","name":"RetirementLogic__NftBurnFailed","inputs":[]},
    {"type":"error","name":"RetirementLogic__NotNFTOwner","inputs":[]},
    {"type":"error","name":"RetirementLogic__RewardNFTMintFailed","inputs":[]},
    {"type":"error","name":"RetirementLogic__RngNotSecure","inputs":[]}
] as const;

export const MARKETPLACE_ABI: Abi = [
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
] as const;
