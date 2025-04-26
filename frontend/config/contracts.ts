import { type Address, type Abi } from 'viem';

// Ensure addresses are typed correctly for Viem
export const FTSO_READER_ADDRESS: Address = '0xf1A2e0eD8AdCdb4eaFE34242aB604018D52f461c';
export const CARBON_CREDIT_NFT_ADDRESS: Address = '0x656152B512511c87D8cca31E7Eae319b48d1B60e';
export const REWARD_NFT_ADDRESS: Address = '0xDDc1457b88ef7B13a764D0eaBc2A76e627EFA034';
export const RETIREMENT_LOGIC_ADDRESS: Address = '0xB1CE21202736905dDC7762D59B3a705c68E26Ff6';
export const MARKETPLACE_ADDRESS: Address = '0xFF8D63c959b3343965B4fAE37df22906026913d7';
export const USER_ACTIONS_ADDRESS: Address = '0x6927E238673eA68b94ed5f3fb2c0e2c44679037d';

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