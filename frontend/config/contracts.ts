import { type Address, type Abi } from 'viem';

export const FTSO_READER_ADDRESS: Address = '0x21a4a466613349e189bB72D866C516E41c9BC334';
export const EVIDENCE_EMITTER_ADDRESS: Address = '0x490b8F0AcD7B15485E8568CFbd1507863f07F4bD';
export const CARBON_CREDIT_NFT_ADDRESS: Address = '0x699e55d28653E5100060b0c4831002572Fd1DFF4';
export const REWARD_NFT_ADDRESS: Address = '0x7Bd5C5bF52ef42cB21a1943d86Aa5E1051e56350';
export const RETIREMENT_LOGIC_ADDRESS: Address = '0xF53f3F574f4Fc3890bAc003D431cDb97EF4250E6';
export const MARKETPLACE_ADDRESS: Address = '0xdbe60CD197E7845fb42dD3d819B0e4BCF6fa9391';
export const USER_ACTIONS_ADDRESS: Address = '0x34d54A537409eD1de328022eFBa61A9a50778665';

export const USER_ACTIONS_ABI: Abi = [
    { type: "function", name: "ACTION_TYPE_TRANSPORT_B32", inputs: [], outputs: [{ name: "", type: "bytes32", internalType: "bytes32" }], stateMutability: "view" },
    { type: "function", name: "MIN_DISTANCE_THRESHOLD_KM", inputs: [], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
    { type: "function", name: "attestationVerifierAddress", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
    { type: "function", name: "evidenceEmitterAddress", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
    { type: "function", name: "isActionVerified", inputs: [{ name: "user", type: "address", internalType: "address" }, { name: "actionType", type: "bytes32", internalType: "bytes32" }, { name: "requiredTimestamp", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "view" },
    { type: "function", name: "lastActionTimestamp", inputs: [{ name: "", type: "address", internalType: "address" }, { name: "", type: "bytes32", internalType: "bytes32" }], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
    { type: "function", name: "owner", inputs: [], outputs: [{ name: "", type: "address", internalType: "address" }], stateMutability: "view" },
    { type: "function", name: "processEvmProof", inputs: [{ name: "proofBytes", type: "bytes", internalType: "bytes" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "processJsonApiProof", inputs: [{ name: "_proof", type: "tuple", internalType: "struct IJsonApi.Proof", components: [{ name: "merkleProof", type: "bytes32[]", internalType: "bytes32[]" }, { name: "data", type: "tuple", internalType: "struct IJsonApi.Response", components: [{ name: "attestationType", type: "bytes32", internalType: "bytes32" }, { name: "sourceId", type: "bytes32", internalType: "bytes32" }, { name: "votingRound", type: "uint64", internalType: "uint64" }, { name: "lowestUsedTimestamp", type: "uint64", internalType: "uint64" }, { name: "requestBody", type: "tuple", internalType: "struct IJsonApi.RequestBody", components: [{ name: "url", type: "string", internalType: "string" }, { name: "postprocessJq", type: "string", internalType: "string" }, { name: "abi_signature", type: "string", internalType: "string" }] }, { name: "responseBody", type: "tuple", internalType: "struct IJsonApi.ResponseBody", components: [{ name: "abi_encoded_data", type: "bytes", internalType: "bytes" }] }] }] }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "recordVerifiedAction", inputs: [{ name: "user", type: "address", internalType: "address" }, { name: "actionType", type: "bytes32", internalType: "bytes32" }, { name: "timestamp", type: "uint256", internalType: "uint256" }, { name: "proofData", type: "bytes", internalType: "bytes" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "renounceOwnership", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "setAttestationVerifierAddress", inputs: [{ name: "_newVerifierAddress", type: "address", internalType: "address" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "transferOwnership", inputs: [{ name: "newOwner", type: "address", internalType: "address" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "validationStages", inputs: [{ name: "", type: "bytes32", internalType: "bytes32" }], outputs: [{ name: "", type: "uint8", internalType: "enum UserActions.ValidationStage" }], stateMutability: "view" },
    { type: "event", name: "ActionRecorded", inputs: [{ name: "user", type: "address", indexed: true, internalType: "address" }, { name: "actionType", type: "bytes32", indexed: true, internalType: "bytes32" }, { name: "timestamp", type: "uint256", indexed: false, internalType: "uint256" }, { name: "proofData", type: "bytes", indexed: false, internalType: "bytes" }], anonymous: false },
    { type: "event", name: "AttestationVerifierSet", inputs: [{ name: "newVerifier", type: "address", indexed: true, internalType: "address" }], anonymous: false },
    { type: "event", name: "EvmProofProcessed", inputs: [{ name: "validationId", type: "bytes32", indexed: true, internalType: "bytes32" }, { name: "userAddress", type: "address", indexed: true, internalType: "address" }], anonymous: false },
    { type: "event", name: "JsonApiProofProcessed", inputs: [{ name: "validationId", type: "bytes32", indexed: true, internalType: "bytes32" }, { name: "userAddress", type: "address", indexed: true, internalType: "address" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeActivityCheck", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }, { name: "activity", type: "string", indexed: false, internalType: "string" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeDecodeResult", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeDistanceCheck", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }, { name: "distance", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeStageUpdate", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }, { name: "currentStage", type: "uint8", indexed: false, internalType: "enum UserActions.ValidationStage" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeStatusCheck", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }, { name: "status", type: "string", indexed: false, internalType: "string" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeVerify", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }], anonymous: false },
    { type: "event", name: "DebugJsonProof_BeforeVerifyCall", inputs: [{ name: "validationId", type: "bytes32", indexed: false, internalType: "bytes32" }], anonymous: false }
] as const;

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

export const RETIREMENT_LOGIC_ABI: Abi = [
    { name: 'retireNFT', inputs: [{ name: 'tokenId', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable', type: 'function' },
] as const;

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

export const FTSO_READER_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"_ftsoRegistry","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"FLR_SYMBOL","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"USD_SYMBOL","inputs":[],"outputs":[{"name":"","type":"string","internalType":"string"}],"stateMutability":"view"},
    {"type":"function","name":"convertFlrToUsd","inputs":[{"name":"flrAmount","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"usdValue","type":"uint256","internalType":"uint256"},{"name":"usdDecimals","type":"uint8","internalType":"uint8"}],"stateMutability":"view"},
    {"type":"function","name":"ftsoRegistryAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"getFlrUsdPrice","inputs":[],"outputs":[{"name":"price","type":"uint256","internalType":"uint256"},{"name":"decimals","type":"uint8","internalType":"uint8"},{"name":"timestamp","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"error","name":"FTSOReader__FtsoNotFound","inputs":[]},
    {"type":"error","name":"FTSOReader__PriceQueryFailed","inputs":[]}
] as const;
