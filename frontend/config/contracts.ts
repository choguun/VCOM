import { type Address, type Abi } from 'viem';

// Ensure addresses are typed correctly for Viem
export const FTSO_READER_ADDRESS: Address = '0x63bc3E370694359BE6d171391A11B05389FcAFf4';
export const CARBON_CREDIT_NFT_ADDRESS: Address = '0x7e8Be6A5717e64205Ad97B5e2aF39b658a2360E5';
export const REWARD_NFT_ADDRESS: Address = '0xddcB9a7a57D84A9927BF67051704898637C651EC';
export const RETIREMENT_LOGIC_ADDRESS: Address = '0x308d2C1C8673f5Ac856671f6074d25A16f53e9BA';
export const MARKETPLACE_ADDRESS: Address = '0x1D29123b5f1BC75310C83328502526Fe54caa039';
export const USER_ACTIONS_ADDRESS: Address = '0xe697020B7751c6d5a3155617642Bc55E2592bb5F';

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

// You can add other ABIs here as needed
// export const MARKETPLACE_ABI: Abi = [...] etc.

// You can also export them as an object if preferred
// export const contractAddresses = {
//   ftsoReader: FTSO_READER_ADDRESS,
//   carbonCreditNFT: CARBON_CREDIT_NFT_ADDRESS,
//   rewardNFT: REWARD_NFT_ADDRESS,
//   retirementLogic: RETIREMENT_LOGIC_ADDRESS,
//   marketplace: MARKETPLACE_ADDRESS,
//   userActions: USER_ACTIONS_ADDRESS,
// }; 