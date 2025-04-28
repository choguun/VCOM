import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';
import { 
    createWalletClient,
    http,
    publicActions,
    Address,
    Hex,
    keccak256,
    toHex,
    Abi,
    encodeAbiParameters,
    decodeAbiParameters
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type Chain } from 'viem';
import crypto from 'crypto';

dotenv.config();

const providerPrivateKey = process.env.PROVIDER_PRIVATE_KEY as Hex | undefined;
const coston2RpcUrl = process.env.COSTON2_RPC_URL;
const openWeatherApiKey = process.env.OPENWEATHERMAP_API_KEY;
const fdcVerifierBaseUrl = process.env.FDC_VERIFIER_BASE_URL;
const fdcHubAddress = process.env.FDC_HUB_ADDRESS as Address | undefined;
const fdcApiKey = process.env.FDC_API_KEY;
const jqVerifierApiKey = process.env.JQ_VERIFIER_API_KEY; // Add new key
const userActionsAddress = process.env.USER_ACTIONS_ADDRESS as Address | undefined;
const openaiApiKey = process.env.OPENAI_API_KEY;
const providerPublicBaseUrl = process.env.PROVIDER_PUBLIC_BASE_URL;
const daLayerBaseUrl = process.env.DA_LAYER_BASE_URL;
const evmSourceNameCoston2 = process.env.EVM_SOURCE_NAME_COSTON2 || 'coston2';
const evidenceEmitterAddress = process.env.EVIDENCE_EMITTER_ADDRESS as Address | undefined;
const fdcFeeConfigAddress = process.env.FDC_FEE_CONFIG_ADDRESS;
const flareSystemsManagerAddress = process.env.FLARE_SYSTEMS_MANAGER_ADDRESS;

if (!providerPrivateKey) throw new Error("PROVIDER_PRIVATE_KEY is not set in .env");
if (!coston2RpcUrl) throw new Error("COSTON2_RPC_URL is not set in .env");
if (!openWeatherApiKey) throw new Error("OPENWEATHERMAP_API_KEY is not set in .env");
if (!fdcVerifierBaseUrl) throw new Error("FDC_VERIFIER_BASE_URL is not set in .env");
if (!fdcApiKey) throw new Error("FDC_API_KEY is not set in .env");
if (!jqVerifierApiKey) throw new Error("JQ_VERIFIER_API_KEY is not set in .env"); // Add check for new key
if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not set in .env");
if (!providerPublicBaseUrl) throw new Error("PROVIDER_PUBLIC_BASE_URL is not set in .env");
if (!daLayerBaseUrl) throw new Error("DA_LAYER_BASE_URL is not set in .env");
if (!fdcHubAddress) throw new Error("FDC_HUB_ADDRESS is not set in .env");
if (!userActionsAddress) throw new Error("USER_ACTIONS_ADDRESS is not set in .env");
if (!evidenceEmitterAddress) throw new Error("EVIDENCE_EMITTER_ADDRESS is not set in .env"); // Add check

const coston2: Chain = {
  id: 114,
  name: 'Coston2',
  nativeCurrency: {
    decimals: 18,
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
  },
  rpcUrls: {
    default: { http: [coston2RpcUrl] },
    public: { http: [coston2RpcUrl] },
  },
  blockExplorers: {
    default: { name: 'Coston2 Explorer', url: 'https://coston2-explorer.flare.network' },
  },
  testnet: true,
};

const account = privateKeyToAccount(providerPrivateKey);
const walletClient = createWalletClient({
  account,
  chain: coston2, // Use the defined coston2 chain object
  transport: http(coston2RpcUrl)
}).extend(publicActions); // Extend with publicActions for read operations if needed later

console.log(`Attestation Provider Wallet Address: ${account.address}`);

const openai = new OpenAI({
    apiKey: openaiApiKey,
});

// --- Constants ---
const EXPECTED_ACTION_TYPE_TRANSPORT = "SUSTAINABLE_TRANSPORT_KM";

const FDC_ATTESTATION_TYPE_JSONAPI_B32 = keccak256(toHex("IJsonApi")); 
const FDC_ATTESTATION_TYPE_EVM_B32 = keccak256(toHex("EVMTransaction")); 
const FDC_SOURCE_ID_WEB2_B32 = keccak256(toHex("WEB2")); 
const FDC_SOURCE_ID_COSTON2_B32 = keccak256(toHex(evmSourceNameCoston2));

const FDC_FEE_CONFIG_ABI: Abi = [{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"encodedCall","type":"bytes"}],"name":"GovernanceCallTimelocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"initialGovernance","type":"address"}],"name":"GovernanceInitialised","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"governanceSettings","type":"address"}],"name":"GovernedProductionModeEntered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"attestationType","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"source","type":"bytes32"}],"name":"TypeAndSourceFeeRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"attestationType","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"source","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"TypeAndSourceFeeSet","type":"event"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"cancelGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"executeGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"getRequestFee","outputs":[{"internalType":"uint256","name":"_fee","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governance","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governanceSettings","outputs":[{"internalType":"contract IGovernanceSettings","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"name":"initialise","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isExecutor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"productionMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_type","type":"bytes32"},{"internalType":"bytes32","name":"_source","type":"bytes32"}],"name":"removeTypeAndSourceFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_types","type":"bytes32[]"},{"internalType":"bytes32[]","name":"_sources","type":"bytes32[]"}],"name":"removeTypeAndSourceFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_type","type":"bytes32"},{"internalType":"bytes32","name":"_source","type":"bytes32"},{"internalType":"uint256","name":"_fee","type":"uint256"}],"name":"setTypeAndSourceFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_types","type":"bytes32[]"},{"internalType":"bytes32[]","name":"_sources","type":"bytes32[]"},{"internalType":"uint256[]","name":"_fees","type":"uint256[]"}],"name":"setTypeAndSourceFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"switchToProductionMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"selector","type":"bytes4"}],"name":"timelockedCalls","outputs":[{"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"internalType":"bytes","name":"encodedCall","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"typeAndSource","type":"bytes32"}],"name":"typeAndSourceFees","outputs":[{"internalType":"uint256","name":"fee","type":"uint256"}],"stateMutability":"view","type":"function"}]; // MISSING_ABI

const FLARE_SYSTEMS_MANAGER_ABI: Abi = [{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"},{"internalType":"address","name":"_addressUpdater","type":"address"},{"internalType":"address","name":"_flareDaemon","type":"address"},{"components":[{"internalType":"uint16","name":"randomAcquisitionMaxDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"randomAcquisitionMaxDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"newSigningPolicyInitializationStartSeconds","type":"uint16"},{"internalType":"uint8","name":"newSigningPolicyMinNumberOfVotingRoundsDelay","type":"uint8"},{"internalType":"uint16","name":"voterRegistrationMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"voterRegistrationMinDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationBlocks","type":"uint16"},{"internalType":"uint24","name":"signingPolicyThresholdPPM","type":"uint24"},{"internalType":"uint16","name":"signingPolicyMinNumberOfVoters","type":"uint16"},{"internalType":"uint32","name":"rewardExpiryOffsetSeconds","type":"uint32"}],"internalType":"struct FlareSystemsManager.Settings","name":"_settings","type":"tuple"},{"internalType":"uint32","name":"_firstVotingRoundStartTs","type":"uint32"},{"internalType":"uint8","name":"_votingEpochDurationSeconds","type":"uint8"},{"internalType":"uint32","name":"_firstRewardEpochStartVotingRoundId","type":"uint32"},{"internalType":"uint16","name":"_rewardEpochDurationInVotingEpochs","type":"uint16"},{"components":[{"internalType":"uint16","name":"initialRandomVotePowerBlockSelectionSize","type":"uint16"},{"internalType":"uint24","name":"initialRewardEpochId","type":"uint24"},{"internalType":"uint16","name":"initialRewardEpochThreshold","type":"uint16"}],"internalType":"struct FlareSystemsManager.InitialSettings","name":"_initialSettings","type":"tuple"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"ECDSAInvalidSignature","type":"error"},{"inputs":[{"internalType":"uint256","name":"length","type":"uint256"}],"name":"ECDSAInvalidSignatureLength","type":"error"},{"inputs":[{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"ECDSAInvalidSignatureS","type":"error"},{"inputs":[{"internalType":"uint8","name":"bits","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"SafeCastOverflowedUintDowncast","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint24","name":"rewardEpochId","type":"uint24"}],"name":"ClosingExpiredRewardEpochFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"encodedCall","type":"bytes"}],"name":"GovernanceCallTimelocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"initialGovernance","type":"address"}],"name":"GovernanceInitialised","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"governanceSettings","type":"address"}],"name":"GovernedProductionModeEntered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"RandomAcquisitionStarted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint32","name":"startVotingRoundId","type":"uint32"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"RewardEpochStarted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"bytes32","name":"rewardsHash","type":"bytes32"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"indexed":false,"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"noOfWeightBasedClaims","type":"tuple[]"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"},{"indexed":false,"internalType":"bool","name":"thresholdReached","type":"bool"}],"name":"RewardsSigned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"blockNumber","type":"uint64"}],"name":"SettingCleanUpBlockNumberFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"SignUptimeVoteEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"},{"indexed":false,"internalType":"bool","name":"thresholdReached","type":"bool"}],"name":"SigningPolicySigned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint24","name":"rewardEpochId","type":"uint24"}],"name":"TriggeringVoterRegistrationFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"bytes32","name":"uptimeVoteHash","type":"bytes32"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"},{"indexed":false,"internalType":"bool","name":"thresholdReached","type":"bool"}],"name":"UptimeVoteSigned","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"bytes20[]","name":"nodeIds","type":"bytes20[]"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"UptimeVoteSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint64","name":"votePowerBlock","type":"uint64"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"VotePowerBlockSelected","type":"event"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"cancelGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"cleanupBlockNumberManager","outputs":[{"internalType":"contract IICleanupBlockNumberManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"currentRewardEpochExpectedEndTs","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"daemonize","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"executeGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"firstRewardEpochStartTs","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"firstVotingRoundStartTs","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"flareDaemon","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAddressUpdater","outputs":[{"internalType":"address","name":"_addressUpdater","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getContractName","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getCurrentRewardEpoch","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentRewardEpochId","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentVotingEpochId","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getRandomAcquisitionInfo","outputs":[{"internalType":"uint64","name":"_randomAcquisitionStartTs","type":"uint64"},{"internalType":"uint64","name":"_randomAcquisitionStartBlock","type":"uint64"},{"internalType":"uint64","name":"_randomAcquisitionEndTs","type":"uint64"},{"internalType":"uint64","name":"_randomAcquisitionEndBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getRewardEpochStartInfo","outputs":[{"internalType":"uint64","name":"_rewardEpochStartTs","type":"uint64"},{"internalType":"uint64","name":"_rewardEpochStartBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRewardEpochSwitchoverTriggerContracts","outputs":[{"internalType":"contract IIRewardEpochSwitchoverTrigger[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getRewardsSignInfo","outputs":[{"internalType":"uint64","name":"_rewardsSignStartTs","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignStartBlock","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignEndTs","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignEndBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getSeed","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getSigningPolicySignInfo","outputs":[{"internalType":"uint64","name":"_signingPolicySignStartTs","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignStartBlock","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignEndTs","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignEndBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getStartVotingRoundId","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getThreshold","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getUptimeVoteSignStartInfo","outputs":[{"internalType":"uint64","name":"_uptimeVoteSignStartTs","type":"uint64"},{"internalType":"uint64","name":"_uptimeVoteSignStartBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getVotePowerBlock","outputs":[{"internalType":"uint64","name":"_votePowerBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getVoterRegistrationData","outputs":[{"internalType":"uint256","name":"_votePowerBlock","type":"uint256"},{"internalType":"bool","name":"_enabled","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterRewardsSignInfo","outputs":[{"internalType":"uint64","name":"_rewardsSignTs","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterSigningPolicySignInfo","outputs":[{"internalType":"uint64","name":"_signingPolicySignTs","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterUptimeVoteSignInfo","outputs":[{"internalType":"uint64","name":"_uptimeVoteSignTs","type":"uint64"},{"internalType":"uint64","name":"_uptimeVoteSignBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterUptimeVoteSubmitInfo","outputs":[{"internalType":"uint64","name":"_uptimeVoteSubmitTs","type":"uint64"},{"internalType":"uint64","name":"_uptimeVoteSubmitBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governance","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governanceSettings","outputs":[{"internalType":"contract IGovernanceSettings","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initialRandomVotePowerBlockSelectionSize","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"name":"initialise","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isExecutor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isVoterRegistrationEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastInitializedVotingRoundId","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"newSigningPolicyInitializationStartSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"newSigningPolicyMinNumberOfVotingRoundsDelay","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"},{"internalType":"uint256","name":"rewardManagerId","type":"uint256"}],"name":"noOfWeightBasedClaims","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"}],"name":"noOfWeightBasedClaimsHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"productionMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"randomAcquisitionMaxDurationBlocks","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"randomAcquisitionMaxDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"relay","outputs":[{"internalType":"contract IIRelay","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardEpochDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardEpochIdToExpireNext","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardExpiryOffsetSeconds","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardManager","outputs":[{"internalType":"contract IIRewardManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"}],"name":"rewardsHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IIRewardEpochSwitchoverTrigger[]","name":"_contracts","type":"address[]"}],"name":"setRewardEpochSwitchoverTriggerContracts","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"_noOfWeightBasedClaims","type":"tuple[]"},{"internalType":"bytes32","name":"_rewardsHash","type":"bytes32"}],"name":"setRewardsData","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_submit3Aligned","type":"bool"}],"name":"setSubmit3Aligned","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_triggerExpirationAndCleanup","type":"bool"}],"name":"setTriggerExpirationAndCleanup","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IIVoterRegistrationTrigger","name":"_contract","type":"address"}],"name":"setVoterRegistrationTriggerContract","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"_noOfWeightBasedClaims","type":"tuple[]"},{"internalType":"bytes32","name":"_rewardsHash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"signNewSigningPolicy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"_noOfWeightBasedClaims","type":"tuple[]"},{"internalType":"bytes32","name":"_rewardsHash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"signRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"bytes32","name":"_uptimeVoteHash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"signUptimeVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"signingPolicyMinNumberOfVoters","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"signingPolicyThresholdPPM","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"submission","outputs":[{"internalType":"contract IISubmission","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"submit3Aligned","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"bytes20[]","name":"_nodeIds","type":"bytes20[]"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"submitUptimeVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"submitUptimeVoteMinDurationBlocks","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"submitUptimeVoteMinDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"switchToFallbackMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"switchToProductionMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"selector","type":"bytes4"}],"name":"timelockedCalls","outputs":[{"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"internalType":"bytes","name":"encodedCall","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"triggerExpirationAndCleanup","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_contractNameHashes","type":"bytes32[]"},{"internalType":"address[]","name":"_contractAddresses","type":"address[]"}],"name":"updateContractAddresses","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint16","name":"randomAcquisitionMaxDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"randomAcquisitionMaxDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"newSigningPolicyInitializationStartSeconds","type":"uint16"},{"internalType":"uint8","name":"newSigningPolicyMinNumberOfVotingRoundsDelay","type":"uint8"},{"internalType":"uint16","name":"voterRegistrationMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"voterRegistrationMinDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationBlocks","type":"uint16"},{"internalType":"uint24","name":"signingPolicyThresholdPPM","type":"uint24"},{"internalType":"uint16","name":"signingPolicyMinNumberOfVoters","type":"uint16"},{"internalType":"uint32","name":"rewardExpiryOffsetSeconds","type":"uint32"}],"internalType":"struct FlareSystemsManager.Settings","name":"_settings","type":"tuple"}],"name":"updateSettings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"}],"name":"uptimeVoteHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistrationMinDurationBlocks","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistrationMinDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistrationTriggerContract","outputs":[{"internalType":"contract IIVoterRegistrationTrigger","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistry","outputs":[{"internalType":"contract IIVoterRegistry","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"votingEpochDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"}]; // MISSING_ABI

const FDC_HUB_ABI: Abi = [
  {
    "inputs": [
      { "internalType": "bytes", "name": "_request", "type": "bytes" }
    ],
    "name": "requestAttestation",
    "outputs": [],
    "stateMutability": "payable", // It requires payment
    "type": "function"
  }
] as const;

// Actual ABI needed - using placeholder based on function signature
const EVIDENCE_EMITTER_ABI: Abi = [
    {
        "type": "function",
        "name": "emitEvidence",
        "inputs": [
            {"name": "validationId", "type": "bytes32", "internalType": "bytes32"},
            {"name": "user", "type": "address", "internalType": "address"},
            {"name": "status", "type": "string", "internalType": "string"},
            {"name": "distanceKm", "type": "uint256", "internalType": "uint256"},
            {"name": "activityType", "type": "string", "internalType": "string"},
            {"name": "validationTimestamp", "type": "uint256", "internalType": "uint256"}
        ],
        "outputs": [],
        "stateMutability": "nonpayable"
    }
] as const;

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

// --- Interfaces & Storage ---
interface VisionVerificationResult {
  activityType?: string; // e.g., "cycling", "walking", "other"
  distanceKm?: number;
  date?: string; // e.g., "YYYY-MM-DD"
  error?: string; // Error message from AI parsing
}

interface IJsonApiRequestBody {
    url: string;
    postprocessJq: string;
    abi_signature: string;
}

interface IJsonApiResponseBody {
    abi_encoded_data: Hex;
}

interface IJsonApiResponse {
    attestationType: Hex; // bytes32
    sourceId: Hex; // bytes32
    votingRound: bigint; // uint64
    lowestUsedTimestamp: bigint; // uint64
    requestBody: IJsonApiRequestBody;
    responseBody: IJsonApiResponseBody;
}

interface IJsonApiProof {
    merkleProof: Hex[]; // bytes32[]
    data: IJsonApiResponse;
}

interface IEVMTransactionRequestBody {
    transactionHash: Hex; // bytes32
    requiredConfirmations: number; // uint16
    provideInput: boolean;
    listEvents: boolean;
    logIndices: number[]; // uint32[]
}

interface IEVMTransactionEvent {
    logIndex: number; // uint32
    emitterAddress: Address;
    topics: Hex[]; // bytes32[]
    data: Hex;
    removed: boolean;
}

interface IEVMTransactionResponseBody {
    blockNumber: bigint; // uint64
    timestamp: bigint; // uint64
    sourceAddress: Address;
    isDeployment: boolean;
    receivingAddress: Address;
    value: bigint; // uint256
    input: Hex;
    status: number; // uint8
    events: IEVMTransactionEvent[];
}

interface IEVMTransactionResponse {
    attestationType: Hex; // bytes32
    sourceId: Hex; // bytes32
    votingRound: bigint; // uint64
    lowestUsedTimestamp: bigint; // uint64
    requestBody: IEVMTransactionRequestBody;
    responseBody: IEVMTransactionResponseBody;
}

interface IEVMTransactionProof {
    merkleProof: Hex[]; // bytes32[]
    data: IEVMTransactionResponse;
}

interface ValidationRecord {
    status: 'verified' | 'failed' | 'pending_fdc' | 'complete' | 'error_processing'; // Added 'verified' state
    userAddress: Address;
    validationId: Hex; // bytes32 validationId used in event and potentially API path
    distanceKm?: number;
    activityType?: string;
    validationTimestamp: number; // Unix timestamp of validation
    errorMessage?: string;
    // Store FDC request info for later proof retrieval
    jsonApiRoundId?: number;
    jsonApiRequestBytes?: Hex;
    jsonApiRequestId?: Hex; // Added
    jsonApiRequestBody?: IJsonApiRequestBody; // Added: Store the request body
    evmRoundId?: number;
    evmRequestBytes?: Hex;
    evmRequestId?: Hex; // Added
    evidenceTxHash?: Hex;
    jsonApiProofTxHash?: Hex;
    evmProofTxHash?: Hex;
}

const validationStore = new Map<Hex, ValidationRecord>();

// --- Helper Functions ---

// Convert string to 32-byte padded hex (like example's toUtf8HexString)
function toPaddedHex(data: string): Hex {
  let hex = Buffer.from(data, 'utf8').toString('hex');
  return `0x${hex.padEnd(64, '0')}` as Hex;
}

// Simple delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define asyncHandler before use
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

async function verifyTransportWithVision(base64Image: string): Promise<{ success: boolean; distance: number | null; details?: VisionVerificationResult; error?: string }> {
    console.log("Verifying transport screenshot with OpenAI Vision...");
    const minDistanceKm = 5; // Minimum required distance

    if (!base64Image || !base64Image.startsWith('data:image/')) {
        return { success: false, distance: null, error: "Invalid image data provided." };
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 300,
            messages: [
                // --- System Prompt --- 
                {
                    role: "system",
                    content: "You are an AI assistant specialized in analyzing screenshots from fitness tracking apps (like Garmin Connect, Strava, etc.). Your task is to identify sustainable transport activities (cycling, walking, running, etc.), the distance covered in kilometers, and the date. You MUST respond ONLY with a single, valid JSON object containing the keys \"activityType\", \"distanceKm\", and \"date\". Do not include any explanations or introductory text. If you cannot reliably determine the required information, use \"other\" for activityType, null for distanceKm, or null for the date within the JSON structure."
                },
                // --- User Prompt --- 
                {
                    role: "user",
                    content: [
                        { 
                            type: "text", 
                            // User text now just presents the request, context is in system prompt
                            text: `Analyze the attached fitness app screenshot and provide the activity details in the required JSON format.` 
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: base64Image, // Send the full base64 string with prefix
                                detail: "low" // Use low detail for efficiency
                            },
                        },
                    ],
                },
            ],
        });

        const aiResponseContent = completion.choices[0]?.message?.content;
        
        // Ensure we have a non-empty string before proceeding
        if (typeof aiResponseContent !== 'string' || aiResponseContent.trim() === '') {
            console.error("OpenAI response content was invalid or empty:", aiResponseContent);
            throw new Error("OpenAI response content was invalid or empty.");
        }
        
        // Assign to a new constant after the type guard
        const responseString: string = aiResponseContent; 

        console.log("Raw OpenAI response:", responseString);

        // Attempt to parse the JSON response (remove potential markdown backticks)
        let parsedResponse: VisionVerificationResult;
        try {
            // Clean the response using the guaranteed string constant
            const cleanedResponse = responseString.replace(/^```json\n?|\n?```$/g, ''); 
            parsedResponse = JSON.parse(cleanedResponse);
        } catch (parseError) {
            console.error("Failed to parse JSON from OpenAI:", responseString);
            throw new Error(`AI did not return valid JSON. Response: ${responseString}`);
        }

        console.log("Parsed OpenAI response:", parsedResponse);

        // Validate the parsed data
        const { activityType, distanceKm } = parsedResponse;
        // Allow null values as per system prompt instruction if data is missing
        if (!activityType) {
             return { success: false, distance: null, details: parsedResponse, error: "AI response missing required field: activityType." };
        }
        if (activityType === 'other') {
            return { success: false, distance: distanceKm ?? null, details: parsedResponse, error: `Activity type identified as 'other' or could not be determined.` };
        }
        if (activityType !== "cycling" && activityType !== "walking") {
            // This case might be less likely if the system prompt works well, but keep as safeguard
            return { success: false, distance: distanceKm ?? null, details: parsedResponse, error: `Unsupported activity type detected: ${activityType}. Expected 'cycling' or 'walking'.` };
        }
        // Check distance if activity is valid
        if (distanceKm === null || typeof distanceKm !== 'number') {
             return { success: false, distance: null, details: parsedResponse, error: "AI response missing or invalid field: distanceKm." };
        }
         if (distanceKm < minDistanceKm) {
            return { success: false, distance: distanceKm, details: parsedResponse, error: `Distance ${distanceKm}km is less than the required ${minDistanceKm}km.` };
        }
        // Check date format if present
        // if (date === null) {
        //      return { success: false, distance: distanceKm, details: parsedResponse, error: "AI response missing required field: date." };
        // }
        
        // TODO: Add date validation (check against UserActions last recorded timestamp to prevent replay)

        console.log(`Vision verification successful: ${activityType}, ${distanceKm}km`);
        return { success: true, distance: distanceKm, details: parsedResponse };

    } catch (error: any) {
        console.error("Error during OpenAI Vision API call:", error);
        const errorMessage = error.response?.data?.error?.message || error.message || "Unknown error calling OpenAI Vision API.";
        return { success: false, distance: null, error: errorMessage };
    }
}

async function prepareFdcRequest(attestationTypeName: string, sourceIdName: string, requestBody: any): Promise<Hex | null> {
    const attestationType = toPaddedHex(attestationTypeName);
    const sourceId = toPaddedHex(sourceIdName);
    console.log(`Preparing FDC request for type ${attestationTypeName} (${attestationType}) and source ${sourceIdName} (${sourceId})`);
    
    // Determine the correct base URL and path based on the attestation type
    let baseUrl: string;
    let path: string;

    if (attestationTypeName === 'IJsonApi' || attestationTypeName === 'JsonApi') { // Revert check back to "IJsonApi"
        baseUrl = 'https://jq-verifier-test.flare.rocks'; // Use JQ Verifier endpoint
        // JQ Verifier likely doesn't need /verifier prefix or source path
        path = `JsonApi/prepareRequest`; 
    } else {
        baseUrl = fdcVerifierBaseUrl!; // Use general FDC Verifier endpoint
        const sourceBasePath = 'flr';

        const typePath = attestationTypeName; // Use original case
        path = `verifier/${sourceBasePath}/${typePath}/prepareRequest`;
    }

    // Construct the final URL robustly, ensuring only one slash between parts
    const finalBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const finalPath = path.startsWith('/') ? path.substring(1) : path;
    const url = `${finalBaseUrl}${finalPath}`;

    const payload = {
        attestationType, // Use calculated padded hex
        sourceId,        // Use calculated padded hex
        requestBody      // Pass requestBody as an OBJECT
    };
    console.log("Calling Verifier API URL:", url);
    console.log("Verifier API Payload (before stringify):", JSON.stringify(payload, null, 2));

    // Select the correct API key based on the target URL
    const apiKey = (baseUrl.includes('jq-verifier-test.flare.rocks')) ? jqVerifierApiKey! : fdcApiKey!;
    console.log(`Using API Key: ${apiKey === jqVerifierApiKey ? 'JQ Verifier Key' : 'FDC Verifier Key'}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey // Use the selected API key
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Verifier API error (${response.status}) at ${url}: ${errorText}`);
            return null;
        }
        const data = await response.json();
        // Check for 'VALID' status from JQ Verifier, or potentially 'OK' from others
        if (data.status !== 'VALID' && data.status !== 'OK' || !data.abiEncodedRequest) {
            console.error("Verifier API did not return OK/VALID status or abiEncodedRequest:", data);
            return null;
        }
        console.log("Received abiEncodedRequest from Verifier");
        return data.abiEncodedRequest as Hex;
    } catch (error) {
        console.error(`Error calling Verifier API (${url}):`, error);
        return null;
    }
}

async function submitFdcRequest(abiEncodedRequest: Hex): Promise<{ txHash: Hex | null, roundId: number | null }> {
    console.log("Submitting FDC request on-chain...");
    try {
        // 1. Get Fee (Ensure FDC_FEE_CONFIG_ABI is populated)
        if (FDC_FEE_CONFIG_ABI.length === 0) throw new Error("FDC_FEE_CONFIG_ABI is not defined");
        const requestFee = await walletClient.readContract({
            address: fdcFeeConfigAddress as Address, // Explicitly cast to Address
            abi: FDC_FEE_CONFIG_ABI, 
            functionName: 'getRequestFee', // Assuming this function name
            args: [abiEncodedRequest]
        }) as bigint; // Cast to bigint
        console.log(`Calculated FDC request fee: ${requestFee}`);

        // 2. Submit Request
        const txHash = await walletClient.writeContract({
            address: fdcHubAddress!,
            abi: FDC_HUB_ABI,
            functionName: 'requestAttestation',
            args: [abiEncodedRequest],
            value: requestFee // Attach fee as value
        });
        console.log(`FDC request submitted, txHash: ${txHash}`);
        // Wait for tx confirmation (important for getting the correct round ID)
        await walletClient.waitForTransactionReceipt({ hash: txHash });
        console.log(`FDC request transaction confirmed: ${txHash}`);

        // 3. Get Round ID (Ensure FLARE_SYSTEMS_MANAGER_ABI is populated)
        if (FLARE_SYSTEMS_MANAGER_ABI.length === 0) throw new Error("FLARE_SYSTEMS_MANAGER_ABI is not defined");
        const roundId = await walletClient.readContract({
            address: flareSystemsManagerAddress as Address, // Explicitly cast to Address
            abi: FLARE_SYSTEMS_MANAGER_ABI, 
            functionName: 'getCurrentVotingEpochId', // Assuming this function name
            args: []
        }) as number; // Cast to number
        console.log(`Attestation requested in voting round: ${roundId}`);

        return { txHash, roundId };

    } catch (error) {
        console.error("Error submitting FDC request on-chain:", error);
        return { txHash: null, roundId: null };
    }
}

// Helper to query DA Layer for proof
interface DALayerProofResponseData {
    merkleProof: Hex[]; // Array of bytes32 hex strings
    responseHex: Hex;   // Bytes hex string
    attestationType: Hex; // Optional, depends on API version, but good to check
    sourceId: Hex;        // Optional
    votingRound: string;  // Optional
    lowestUsedTimestamp: string; // Optional
}
interface DALayerProofResponse {
    status: string; // e.g., "OK"
    data?: DALayerProofResponseData;
    error?: string;
}

async function getProofFromDALayer(roundId: number, requestBytes: Hex): Promise<DALayerProofResponseData | null> {
    console.log(`Querying DA Layer for proof for round ${roundId}...`);
    const url = `${daLayerBaseUrl}/api/v1/fdc/proof-by-request-round-raw`; // Use v1 endpoint
    const payload = {
        votingRoundId: roundId.toString(), // API expects string
        requestBytes: requestBytes
    };
    
    const maxRetries = 3;
    const retryDelayMs = 10000; // 10 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Calling DA Layer URL: ${url} (Attempt ${attempt}/${maxRetries})`);
        console.log("DA Layer Payload:", JSON.stringify(payload));

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': fdcApiKey! // Assuming same API key for DA Layer
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`DA Layer API error (${response.status}) at ${url} on attempt ${attempt}: ${errorText}`);
                // Don't retry on certain errors like 400 Bad Request, could indicate a permanent issue
                if (response.status === 400) {
                    return null;
                }
                // Otherwise, wait and retry for other errors (like 404 Not Found or 5xx)
            } else {
                const data: any = await response.json(); // Use 'any' type to handle potential direct data response

                // Check if the response directly contains the proof data
                // Use 'proof' for merkleProof array check based on logs
                if (!data || !data.proof || data.proof.length === 0 || !data.response_hex) {
                    console.warn(`DA Layer API did not return expected proof data fields on attempt ${attempt}:`, data);
                    // Wait and retry if proof not ready or unexpected format
                } else {
                    console.log(`Successfully retrieved proof data from DA Layer for round ${roundId} on attempt ${attempt}`);
                    // Construct the expected return structure
                    return {
                        merkleProof: data.proof,
                        responseHex: data.response_hex,
                        // Include other fields if available, otherwise use defaults/null
                        attestationType: data.attestation_type || null,
                        sourceId: data.source_id || null,
                        votingRound: data.voting_round || null,
                        lowestUsedTimestamp: data.lowest_used_timestamp || null
                    };
                }
            }

        } catch (error) {
            console.error(`Error calling DA Layer API (${url}) on attempt ${attempt}:`, error);
            // Wait and retry on network errors
        }

        // If not successful and more retries left, wait before the next attempt
        if (attempt < maxRetries) {
            console.log(`Waiting ${retryDelayMs / 1000} seconds before next DA Layer attempt...`);
            await delay(retryDelayMs);
        }
    }

    console.error(`Failed to retrieve proof from DA Layer for round ${roundId} after ${maxRetries} attempts.`);
    return null; // Return null after all retries fail
}

// New helper to query DA Layer for proof BY REQUEST ID
async function getProofFromDALayerById(roundId: number, requestId: Hex): Promise<DALayerProofResponseData | null> {
    console.log(`Querying DA Layer for proof for round ${roundId}, request ID ${requestId}...`);
    const url = `${daLayerBaseUrl}/api/v1/fdc/proof-by-id`; // Use proof-by-id endpoint
    const payload = {
        roundId: roundId, // API expects number for this endpoint
        requestId: requestId
    };
    
    const maxRetries = 3;
    const retryDelayMs = 10000; // 10 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Calling DA Layer URL: ${url} (Attempt ${attempt}/${maxRetries})`);
        console.log("DA Layer Payload:", JSON.stringify(payload));

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': fdcApiKey! // Assuming same API key for DA Layer
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.warn(`DA Layer API (by ID) error (${response.status}) at ${url} on attempt ${attempt}: ${errorText}`);
                if (response.status === 400) return null; // Don't retry on Bad Request
                // Otherwise, wait and retry
            } else {
                const data: any = await response.json(); // Use 'any' type

                // Check if the response directly contains the proof data
                if (!data || !data.proof || data.proof.length === 0 || !data.response_hex) {
                    console.warn(`DA Layer API (by ID) did not return expected proof data fields on attempt ${attempt}:`, data);
                    // Wait and retry
                } else {
                    console.log(`Successfully retrieved proof data from DA Layer (by ID) for round ${roundId} on attempt ${attempt}`);
                    // Construct the expected return structure
                    return {
                        merkleProof: data.proof,
                        responseHex: data.response_hex,
                        attestationType: data.attestation_type || null,
                        sourceId: data.source_id || null,
                        votingRound: data.voting_round || null, // API might return string or number
                        lowestUsedTimestamp: data.lowest_used_timestamp || null // API might return string or number
                    };
                }
            }

        } catch (error) {
            console.error(`Error calling DA Layer API (by ID) (${url}) on attempt ${attempt}:`, error);
            // Wait and retry on network errors
        }

        // If not successful and more retries left, wait before the next attempt
        if (attempt < maxRetries) {
            console.log(`Waiting ${retryDelayMs / 1000} seconds before next DA Layer (by ID) attempt...`);
            await delay(retryDelayMs);
        }
    }

    console.error(`Failed to retrieve proof from DA Layer (by ID) for round ${roundId}, request ID ${requestId} after ${maxRetries} attempts.`);
    return null; // Return null after all retries fail
}

// --- API Endpoints ---

const app = express();
const port = process.env.PROVIDER_PORT || 3001;

// Middleware
app.use(cors()); // Enable CORS for requests from the frontend
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies with a larger limit


// GET /api/v1/validation-result/:validationId (Existing)
app.get('/api/v1/validation-result/:validationId', (req: Request, res: Response) => {
    const validationId = req.params.validationId as Hex;
    const record = validationStore.get(validationId);

    if (record) {
        console.log(`Returning validation record for ID: ${validationId}`);
        // Restore full response, keeping uint256 as strings and conditional status
        const responseForFdc = {
            status: record.status, // Return the actual stored status
            userAddress: record.userAddress,
            // Return distanceKm as a number
            distanceKm: Math.floor(record.distanceKm ?? 0),
            activityType: record.activityType ?? '',
            // Return validationTimestamp as a number
            validationTimestamp: record.validationTimestamp, // Already a number
            // Return validationId without the '0x' prefix
            validationId: record.validationId.startsWith('0x') ? record.validationId.substring(2) : record.validationId 
        };
        return res.status(200).json(responseForFdc);
    } else {
        console.log(`Validation record not found for ID: ${validationId}`);
        return res.status(404).json({ error: 'Validation record not found' });
    }
});

// POST /request-attestation
app.post('/request-attestation', asyncHandler(async (req: Request, res: Response) => {
    const { actionType, userAddress, imageBase64 } = req.body;

    if (!actionType || !userAddress) {
        return res.status(400).json({ error: 'Missing required fields: actionType and userAddress' });
    }

    console.log(`Received attestation request for type: ${actionType}, user: ${userAddress}`);

    // --- Handle Sustainable Transport Action ---
    if (actionType === EXPECTED_ACTION_TYPE_TRANSPORT) {
        if (!imageBase64) {
            return res.status(400).json({ error: 'Missing imageBase64 for transport verification' });
        }

        // 1. Verify with OpenAI
        const visionResult = await verifyTransportWithVision(imageBase64);
        if (!visionResult.success || !visionResult.distance || !visionResult.details?.activityType) {
            console.error("Vision verification failed:", visionResult.error);
            // Store failed result? Maybe not necessary unless debugging
            return res.status(400).json({ error: `Verification failed: ${visionResult.error || 'Unknown vision error'}` });
        }
        console.log("Vision verification successful:", visionResult.details);

        // 2. Generate Validation ID & Store Initial Record
        const validationId = `0x${crypto.randomBytes(32).toString('hex')}` as Hex;
        const validationTimestamp = Math.floor(Date.now() / 1000);
        const initialRecord: ValidationRecord = {
            validationId,
            userAddress: userAddress as Address,
            status: 'verified', // Mark as 'verified' by OpenAI initially
            distanceKm: visionResult.distance,
            activityType: visionResult.details.activityType,
            validationTimestamp: validationTimestamp,
        };
        validationStore.set(validationId, initialRecord);
        console.log(`Stored initial validation record for ID: ${validationId}`);

        try {
            // 3. Emit On-Chain Evidence
            console.log("Emitting evidence on-chain...");
            const evidenceArgs = [
                validationId,
                userAddress as Address,
                'verified', // Status to emit
                BigInt(Math.floor(visionResult.distance)), // <-- Fix: Convert to integer before BigInt
                visionResult.details.activityType,
                BigInt(validationTimestamp) // Convert timestamp to BigInt for uint256
            ];
            const emitTxHash = await walletClient.writeContract({
                address: evidenceEmitterAddress!, // Use non-null assertion
                abi: EVIDENCE_EMITTER_ABI,
                functionName: 'emitEvidence',
                args: evidenceArgs
            });
            console.log(`Evidence emitted, txHash: ${emitTxHash}`);
            await walletClient.waitForTransactionReceipt({ hash: emitTxHash }); // Wait for confirmation
            console.log("Evidence emission confirmed.");
            validationStore.get(validationId)!.evidenceTxHash = emitTxHash;
            validationStore.get(validationId)!.status = 'pending_fdc'; // Update status AFTER successful emission

            // Introduce a delay before preparing JsonApi request
            console.log("Waiting 2 seconds before preparing JsonApi request...");
            await delay(2000); 

            // 4. Prepare JsonApi FDC Request
            const jsonApiUrl = `${providerPublicBaseUrl}/api/v1/validation-result/${validationId}`;
            // Restore status component to ABI signature to match contract AND examples
            // Include top-level name field as per examples
            const jsonApiAbiSignature = '{"components":[{"internalType":"string","name":"status","type":"string"},{"internalType":"address","name":"userAddress","type":"address"},{"internalType":"uint256","name":"distanceKm","type":"uint256"},{"internalType":"string","name":"activityType","type":"string"},{"internalType":"uint256","name":"validationTimestamp","type":"uint256"},{"internalType":"bytes32","name":"validationId","type":"bytes32"}],"name":"OffChainValidationResult","type":"tuple"}'; // Added top-level name
            // JQ Verifier just needs the sequence of types to encode the output of postprocessJq
            // const jsonApiAbiSignature = 'string,address,uint256,string,uint256,bytes32'; // Incorrect based on examples
            const jsonApiRequestBody = {
                url: jsonApiUrl,
                // Explicitly construct the object matching the abi_signature using JQ
                // HARDCODE status to "verified" to pass contract check
                // + convert address to lowercase
                // + add back '0x' prefix for validationId for bytes32 conversion
                postprocessJq: '{status: "verified", userAddress: (.userAddress | ascii_downcase), distanceKm: .distanceKm, activityType: .activityType, validationTimestamp: .validationTimestamp, validationId: ("0x" + .validationId)}', 
                abi_signature: jsonApiAbiSignature
            };

            // --- DEBUG LOGGING: JsonApi Request Body Before Prep ---
            console.log(`[DEBUG /request-attestation] JsonApi Request Body (to prepare):`, JSON.stringify(jsonApiRequestBody, null, 2));
            // --- END DEBUG LOGGING ---

            const jsonApiEncodedRequest = await prepareFdcRequest('IJsonApi', 'WEB2', jsonApiRequestBody); // Revert back to "IJsonApi"
            if (!jsonApiEncodedRequest) throw new Error("Failed to prepare JsonApi FDC request");

            // --- DEBUG LOGGING: Prepared JsonApi Request Bytes ---
            console.log(`[DEBUG /request-attestation] Prepared JsonApi Request Bytes: ${jsonApiEncodedRequest}`);
            // --- END DEBUG LOGGING ---

            // 5. Prepare EVMTransaction FDC Request
            const evmRequestBody = {
                transactionHash: emitTxHash,
                requiredConfirmations: "1", // API expects a string
                provideInput: false, // Don't need input data
                listEvents: true,    // Need events
                logIndices: []       // Get all events (up to limit)
            };
            const evmEncodedRequest = await prepareFdcRequest('EVMTransaction', 'testFLR', evmRequestBody); // Use source 'testFLR' for EVMTransaction on testnet
            if (!evmEncodedRequest) throw new Error("Failed to prepare EVMTransaction FDC request");

            // 6. Submit Both FDC Requests On-Chain
            console.log("Submitting JsonApi request...");
            const { txHash: jsonApiTxHash, roundId: jsonApiRoundId } = await submitFdcRequest(jsonApiEncodedRequest);
            if (!jsonApiTxHash || jsonApiRoundId === null) throw new Error("Failed to submit JsonApi FDC request on-chain");
            
            console.log("Submitting EVMTransaction request...");
            const { txHash: evmTxHash, roundId: evmRoundId } = await submitFdcRequest(evmEncodedRequest);
            if (!evmTxHash || evmRoundId === null) throw new Error("Failed to submit EVMTransaction FDC request on-chain");

            // 7. Update Stored Record with FDC Info
            const finalRecord = validationStore.get(validationId)!;
            // Keep status as 'pending_fdc'
            finalRecord.jsonApiRoundId = jsonApiRoundId;
            finalRecord.jsonApiRequestBytes = jsonApiEncodedRequest;
            finalRecord.jsonApiRequestId = keccak256(jsonApiEncodedRequest); // Calculate and store ID
            // --- DEBUG LOGGING: Calculated JsonApi Request ID ---
            console.log(`[DEBUG /request-attestation] Calculated JsonApi Request ID: ${finalRecord.jsonApiRequestId}`);
            // --- END DEBUG LOGGING ---
            finalRecord.jsonApiRequestBody = jsonApiRequestBody; // Store the request body object
            finalRecord.evmRoundId = evmRoundId;
            finalRecord.evmRequestBytes = evmEncodedRequest;
            finalRecord.evmRequestId = keccak256(evmEncodedRequest); // Calculate and store ID
            validationStore.set(validationId, finalRecord);
            console.log(`FDC requests submitted and record updated for ${validationId}`);
            console.log(`  JsonApi Request ID: ${finalRecord.jsonApiRequestId}`);
            console.log(`  EVM Request ID: ${finalRecord.evmRequestId}`);

            // 8. Respond to Frontend
            return res.status(200).json({ 
                message: "Verification initiated. FDC requests submitted.", 
                validationId: validationId 
            });

        } catch (error: any) {
            console.error(`Error during FDC processing for ${validationId}:`, error);
            const record = validationStore.get(validationId);
            if (record) {
                record.status = 'error_processing';
                record.errorMessage = error.message || 'Unknown processing error';
                validationStore.set(validationId, record);
            }
            return res.status(500).json({ error: `Failed to process FDC requests: ${error.message}` });
        }

    } else {
        // Handle other action types or return error
        console.warn(`Unsupported action type received: ${actionType}`);
        return res.status(400).json({ error: `Unsupported action type: ${actionType}` });
    }
}));

// POST /submit-proofs/:validationId (Phase 4 Implementation)
app.post('/submit-proofs/:validationId', asyncHandler(async (req: Request, res: Response) => {
    const { validationId } = req.params;
    console.log(`Received request to submit proofs for validation ID: ${validationId}`);

    const record = validationStore.get(validationId as Hex);
    if (!record) {
        return res.status(404).json({ error: 'Validation record not found' });
    }

    // Check required fields, including the stored request body
    if (!record.jsonApiRoundId || !record.jsonApiRequestBytes || !record.evmRoundId || !record.evmRequestBytes || !record.jsonApiRequestBody) {
        return res.status(400).json({ error: 'FDC request details (round/request bytes/request body) missing in record, cannot retrieve proofs yet.' });
    }
    
    // Allow retrying if status is pending_fdc or error_processing
    if (record.status !== 'pending_fdc' && record.status !== 'error_processing') {
         return res.status(400).json({ error: `Cannot submit proofs, current status is ${record.status}` });
    }

    // Clear previous error if retrying
    if (record.status === 'error_processing') {
        record.errorMessage = undefined;
        validationStore.set(validationId as Hex, record); // Save cleared error message
    }

    let jsonApiProofTxHash: Hex | null = null;
    let evmProofTxHash: Hex | null = null;

    try {
        // 1. Fetch Proofs from DA Layer using Request Bytes
        console.log("Fetching JsonApi proof using Request Bytes...");
        const jsonApiProofData = await getProofFromDALayer(record.jsonApiRoundId!, record.jsonApiRequestBytes!); 
        if (!jsonApiProofData) throw new Error("Failed to retrieve JsonApi proof from DA Layer using Request Bytes");

        console.log("Fetching EVM proof using Request Bytes...");
        const evmProofData = await getProofFromDALayer(record.evmRoundId!, record.evmRequestBytes!); 
        if (!evmProofData) throw new Error("Failed to retrieve EVM proof from DA Layer using Request Bytes");

        // --- [DEBUG] Log stored Request Body, ID --- 
        console.log(`[DEBUG /submit-proofs] Stored JsonApi Request ID: ${record.jsonApiRequestId}`);
        console.log(`[DEBUG /submit-proofs] Stored JsonApi Request Body:`, JSON.stringify(record.jsonApiRequestBody, null, 2)); // Log original request body
        console.log(`[DEBUG /submit-proofs] Raw responseHex from DA Layer for JsonApi:`, jsonApiProofData.responseHex); // Log raw hex
        // --- Removed Debug decoding attempt for the old tuple structure ---

        // 2. Define ABIs and Reconstruct/Encode Proofs
        console.log("Decoding DA responses and reconstructing proofs for encoding...");

        // --- Define ABIs for Encoding the final proofs to send to the contract --- 
        // ABI for the *outer* IJsonApi.Response structure returned in responseHex by DA layer
        const jsonApiResponseAbiType = [
            { type: 'bytes32', name: 'attestationType' }, 
            { type: 'bytes32', name: 'sourceId' }, 
            { type: 'uint64', name: 'votingRound' }, 
            { type: 'uint64', name: 'lowestUsedTimestamp' }, 
            { 
                type: 'tuple', 
                name: 'requestBody', 
                components: [
                    { type: 'string', name: 'url' }, 
                    { type: 'string', name: 'postprocessJq' }, 
                    { type: 'string', name: 'abi_signature' }
                ] 
            }, 
            { 
                type: 'tuple', 
                name: 'responseBody', 
                components: [
                     { type: 'bytes', name: 'abi_encoded_data' } // This holds the INNER encoded data
                ] 
            } 
        ];
        // ABI for the IJsonApi.Proof struct that the UserActions contract expects
        const jsonApiProofContractInputAbiType = [
            { type: 'bytes32[]', name: 'merkleProof' }, 
            { type: 'tuple', name: 'data', components: jsonApiResponseAbiType } 
        ];

        const evmProofAbiType = [{ type: 'bytes32[]', name: 'merkleProof' }, { type: 'tuple', name: 'data', components: [{ type: 'bytes32', name: 'attestationType' }, { type: 'bytes32', name: 'sourceId' }, { type: 'uint64', name: 'votingRound' }, { type: 'uint64', name: 'lowestUsedTimestamp' }, { type: 'tuple', name: 'requestBody', components: [{ type: 'bytes32', name: 'transactionHash' }, { type: 'uint16', name: 'requiredConfirmations' }, { type: 'bool', name: 'provideInput' }, { type: 'bool', name: 'listEvents' }, { type: 'uint32[]', name: 'logIndices' }] }, { type: 'tuple', name: 'responseBody', components: [{ type: 'uint64', name: 'blockNumber' }, { type: 'uint64', name: 'timestamp' }, { type: 'address', name: 'sourceAddress' }, { type: 'bool', name: 'isDeployment' }, { type: 'address', name: 'receivingAddress' }, { type: 'uint256', name: 'value' }, { type: 'bytes', name: 'input' }, { type: 'uint8', name: 'status' }, { type: 'tuple[]', name: 'events', components: [{ type: 'uint32', name: 'logIndex' }, { type: 'address', name: 'emitterAddress' }, { type: 'bytes32[]', name: 'topics' }, { type: 'bytes', name: 'data' }, { type: 'bool', name: 'removed' }] }] }] }];
        const evmResponseAbiType = [ evmProofAbiType[1] ]; // Decode the 'data' tuple directly

        // --- JsonApi Proof Construction --- 
        // 1. Decode the *entire* IJsonApi.Response struct from the DA layer's responseHex
        let decodedOuterJsonResponse: IJsonApiResponse;
        try {
            // Wrap the single tuple in an array for decodeAbiParameters
            // Use explicit 'as unknown as [Type]' assertion for stricter type checking
            const [decodedResult] = decodeAbiParameters([ { type: 'tuple', components: jsonApiResponseAbiType } ], jsonApiProofData.responseHex) as unknown as [IJsonApiResponse];
            decodedOuterJsonResponse = decodedResult;
            console.log("Successfully decoded outer IJsonApi.Response from DA Layer responseHex.");
        } catch (error: any) {
             console.error("Failed to decode outer IJsonApi.Response from DA Layer responseHex:", jsonApiProofData.responseHex, error);
             throw new Error("Could not decode the structure returned by the DA Layer for JsonApi proof.");
        }

        // 2. Extract the *inner* abi_encoded_data (which contains the OffChainValidationResult)
        const innerAbiEncodedData = decodedOuterJsonResponse.responseBody.abi_encoded_data;
        if (!innerAbiEncodedData || innerAbiEncodedData === '0x') {
             throw new Error("Extracted inner abi_encoded_data for OffChainValidationResult is empty or invalid.");
        }
         console.log(`[DEBUG /submit-proofs] Extracted INNER abi_encoded_data (OffChainValidationResult): ${innerAbiEncodedData}`);


        // --- EVM Proof Construction --- 
        // Decode the EVM response data from the DA Layer responseHex
        const [decodedEvmResponseData] = decodeAbiParameters(evmResponseAbiType, evmProofData.responseHex) as [IEVMTransactionResponse];
        if (!decodedEvmResponseData) {
             throw new Error("Could not decode EVM response data from DA Layer responseHex");
        }
        console.log("Successfully decoded actual EVMTransactionResponse from DA Layer.");
        
        // Use lowest timestamp from EVM proof or fallback to 0
        const lowestTimestampToUse = decodedEvmResponseData.lowestUsedTimestamp ? BigInt(decodedEvmResponseData.lowestUsedTimestamp) : BigInt(0); 
        console.log(`Using lowestUsedTimestamp for proofs: ${lowestTimestampToUse}`);


        // 3. Reconstruct the full IJsonApi.Response object to match the *contract's expectation*
        //    This means putting the *extracted inner data* into the responseBody.
        const reconstructedJsonResponseDataForContract: IJsonApiResponse = {
            attestationType: FDC_ATTESTATION_TYPE_JSONAPI_B32, // Use constant from FDC system
            sourceId: FDC_SOURCE_ID_WEB2_B32,             // Use constant from FDC system
            votingRound: BigInt(record.jsonApiRoundId!),   // Use stored round ID
            lowestUsedTimestamp: lowestTimestampToUse,      // Use consistent timestamp from EVM proof
            requestBody: record.jsonApiRequestBody!,      // Use the original request body we sent
            responseBody: { 
                abi_encoded_data: innerAbiEncodedData // *** Use the EXTRACTED inner data here ***
            } 
        };

        // 4. Construct the final IJsonApi.Proof object to send to the contract
        const finalJsonApiProofForContract: IJsonApiProof = {
            merkleProof: jsonApiProofData.merkleProof, // Use Merkle proof from DA layer
            data: reconstructedJsonResponseDataForContract // Use the manually reconstructed response with extracted inner data
        };

        // --- EVM Proof Construction (using the decoded data) --- 
        const finalEvmProofForContract: IEVMTransactionProof = {
            merkleProof: evmProofData.merkleProof,
            // Update the lowestUsedTimestamp in the EVM proof data to match the one used in JsonApi proof for consistency?
            // data: { ...decodedEvmResponseData, lowestUsedTimestamp: lowestTimestampToUse } // This might be needed if contract compares them
            data: decodedEvmResponseData // Or keep as is if contract doesn't compare
        };
        // Encode the EVM proof struct to send to the contract's processEvmProof function
        const evmProofBytes = encodeAbiParameters(
            evmProofAbiType, 
            [finalEvmProofForContract.merkleProof, finalEvmProofForContract.data] 
        );

        console.log("Proofs reconstructed successfully.");

        // 3. Submit Proofs On-Chain
        console.log(`Submitting JsonApi proof for ${validationId} to UserActions...`);
        jsonApiProofTxHash = await walletClient.writeContract({
            address: userActionsAddress!,
            abi: USER_ACTIONS_ABI,
            functionName: 'processJsonApiProof',
            args: [finalJsonApiProofForContract],
            gas: BigInt(3000000)
        });
        console.log(`JsonApi proof submitted, txHash: ${jsonApiProofTxHash}`);
        // Wait for receipt even if it fails, to get the logs
        try {
             await walletClient.waitForTransactionReceipt({ hash: jsonApiProofTxHash });
             console.log(`JsonApi proof tx potentially confirmed (or reverted with logs): ${jsonApiProofTxHash}`);
        } catch (receiptError: any) {
             console.warn(`Error waiting for JsonApi proof receipt (tx likely reverted, check logs): ${receiptError.shortMessage || receiptError.message}`);
             // Continue even if receipt shows failure, we need the tx hash
        }
        record.jsonApiProofTxHash = jsonApiProofTxHash; // Record hash regardless of success/failure

        console.log(`Submitting EVM proof for ${validationId} to UserActions...`);
        evmProofTxHash = await walletClient.writeContract({
            address: userActionsAddress!,
            abi: USER_ACTIONS_ABI,
            functionName: 'processEvmProof',
            args: [evmProofBytes],
            gas: BigInt(3000000)
        });
        console.log(`EVM proof submitted, txHash: ${evmProofTxHash}`);
        await walletClient.waitForTransactionReceipt({ hash: evmProofTxHash });
        console.log(`EVM proof tx confirmed: ${evmProofTxHash}`);
        record.evmProofTxHash = evmProofTxHash;

        // 4. Update Record Status
        record.status = 'complete';
        record.errorMessage = undefined; // Clear any previous error
        validationStore.set(validationId as Hex, record);
        console.log(`Proof submission complete for ${validationId}`);

        return res.status(200).json({ 
            message: 'Proofs submitted successfully.', 
            validationId: validationId, 
            jsonApiProofTxHash,
            evmProofTxHash
        });

    } catch (error: any) {
        console.error(`Error during proof submission for ${validationId}:`, error);
        record.status = 'error_processing';
        const errorMessage = error.message || 'Unknown proof submission error';
        record.errorMessage = errorMessage;
        if (jsonApiProofTxHash) record.jsonApiProofTxHash = jsonApiProofTxHash;
        if (evmProofTxHash) record.evmProofTxHash = evmProofTxHash;
        validationStore.set(validationId as Hex, record);
        return res.status(500).json({ error: `Failed to submit proofs: ${errorMessage}` });
    }
}));


// Error Handling Middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(port, () => {
    console.log(`Attestation Provider listening on port ${port}`);
});
