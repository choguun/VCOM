import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import OpenAI from 'openai';
import { 
    createWalletClient, 
    http, 
    publicActions, 
    parseAbiItem, // For simple ABI parsing if needed
    Address, // Keep type for clarity
    Hex, // Type for hex strings like private key and bytes32
    keccak256, // Keep hash function
    toHex, // Keep hex conversion
    Abi, // Type for full ABI
    parseEther // Import parseEther for fee
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { type Chain } from 'viem';
import crypto from 'crypto'; // Import crypto for generating validationId

dotenv.config();

const providerPrivateKey = process.env.PROVIDER_PRIVATE_KEY as Hex | undefined;
const coston2RpcUrl = process.env.COSTON2_RPC_URL;
const openWeatherApiKey = process.env.OPENWEATHERMAP_API_KEY;
const fdcVerifierBaseUrl = process.env.FDC_VERIFIER_BASE_URL;
const fdcHubAddress = process.env.FDC_HUB_ADDRESS as Address | undefined;
const fdcApiKey = process.env.FDC_API_KEY;
const userActionsAddress = process.env.USER_ACTIONS_ADDRESS as Address | undefined;
const openaiApiKey = process.env.OPENAI_API_KEY;
const providerPublicBaseUrl = process.env.PROVIDER_PUBLIC_BASE_URL; // Public URL of this service (e.g., https://your-provider.com)
const daLayerBaseUrl = process.env.DA_LAYER_BASE_URL; // e.g., https://dalayer-api.coston2.flare.network
const evmSourceNameCoston2 = process.env.EVM_SOURCE_NAME_COSTON2 || 'coston2'; // Source name for EVMTransaction

// --- Contract Addresses & ABIs (Load from env or keep hardcoded if preferred) ---
const evidenceEmitterAddress = process.env.EVIDENCE_EMITTER_ADDRESS as Address | undefined; // Load Emitter Address
// Use fixed Coston2 addresses for system contracts
const fdcFeeConfigAddress: Address = '0x191a1282Ac700edE65c5B0AaF313BAcC3eA7fC7e';
const flareSystemsManagerAddress: Address = '0xA90Db6D10F856799b10ef2A77EBCbF460aC71e52';

// TODO: Get actual ABIs for these
const FDC_FEE_CONFIG_ABI: Abi = [{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"encodedCall","type":"bytes"}],"name":"GovernanceCallTimelocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"initialGovernance","type":"address"}],"name":"GovernanceInitialised","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"governanceSettings","type":"address"}],"name":"GovernedProductionModeEntered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"attestationType","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"source","type":"bytes32"}],"name":"TypeAndSourceFeeRemoved","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"attestationType","type":"bytes32"},{"indexed":true,"internalType":"bytes32","name":"source","type":"bytes32"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"TypeAndSourceFeeSet","type":"event"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"cancelGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"executeGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes","name":"_data","type":"bytes"}],"name":"getRequestFee","outputs":[{"internalType":"uint256","name":"_fee","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governance","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governanceSettings","outputs":[{"internalType":"contract IGovernanceSettings","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"name":"initialise","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isExecutor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"productionMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_type","type":"bytes32"},{"internalType":"bytes32","name":"_source","type":"bytes32"}],"name":"removeTypeAndSourceFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_types","type":"bytes32[]"},{"internalType":"bytes32[]","name":"_sources","type":"bytes32[]"}],"name":"removeTypeAndSourceFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32","name":"_type","type":"bytes32"},{"internalType":"bytes32","name":"_source","type":"bytes32"},{"internalType":"uint256","name":"_fee","type":"uint256"}],"name":"setTypeAndSourceFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_types","type":"bytes32[]"},{"internalType":"bytes32[]","name":"_sources","type":"bytes32[]"},{"internalType":"uint256[]","name":"_fees","type":"uint256[]"}],"name":"setTypeAndSourceFees","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"switchToProductionMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"selector","type":"bytes4"}],"name":"timelockedCalls","outputs":[{"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"internalType":"bytes","name":"encodedCall","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32","name":"typeAndSource","type":"bytes32"}],"name":"typeAndSourceFees","outputs":[{"internalType":"uint256","name":"fee","type":"uint256"}],"stateMutability":"view","type":"function"}]; // MISSING_ABI
const FLARE_SYSTEMS_MANAGER_ABI: Abi = [{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"},{"internalType":"address","name":"_addressUpdater","type":"address"},{"internalType":"address","name":"_flareDaemon","type":"address"},{"components":[{"internalType":"uint16","name":"randomAcquisitionMaxDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"randomAcquisitionMaxDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"newSigningPolicyInitializationStartSeconds","type":"uint16"},{"internalType":"uint8","name":"newSigningPolicyMinNumberOfVotingRoundsDelay","type":"uint8"},{"internalType":"uint16","name":"voterRegistrationMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"voterRegistrationMinDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationBlocks","type":"uint16"},{"internalType":"uint24","name":"signingPolicyThresholdPPM","type":"uint24"},{"internalType":"uint16","name":"signingPolicyMinNumberOfVoters","type":"uint16"},{"internalType":"uint32","name":"rewardExpiryOffsetSeconds","type":"uint32"}],"internalType":"struct FlareSystemsManager.Settings","name":"_settings","type":"tuple"},{"internalType":"uint32","name":"_firstVotingRoundStartTs","type":"uint32"},{"internalType":"uint8","name":"_votingEpochDurationSeconds","type":"uint8"},{"internalType":"uint32","name":"_firstRewardEpochStartVotingRoundId","type":"uint32"},{"internalType":"uint16","name":"_rewardEpochDurationInVotingEpochs","type":"uint16"},{"components":[{"internalType":"uint16","name":"initialRandomVotePowerBlockSelectionSize","type":"uint16"},{"internalType":"uint24","name":"initialRewardEpochId","type":"uint24"},{"internalType":"uint16","name":"initialRewardEpochThreshold","type":"uint16"}],"internalType":"struct FlareSystemsManager.InitialSettings","name":"_initialSettings","type":"tuple"}],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"ECDSAInvalidSignature","type":"error"},{"inputs":[{"internalType":"uint256","name":"length","type":"uint256"}],"name":"ECDSAInvalidSignatureLength","type":"error"},{"inputs":[{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"ECDSAInvalidSignatureS","type":"error"},{"inputs":[{"internalType":"uint8","name":"bits","type":"uint8"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"SafeCastOverflowedUintDowncast","type":"error"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint24","name":"rewardEpochId","type":"uint24"}],"name":"ClosingExpiredRewardEpochFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"indexed":false,"internalType":"bytes","name":"encodedCall","type":"bytes"}],"name":"GovernanceCallTimelocked","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"initialGovernance","type":"address"}],"name":"GovernanceInitialised","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"governanceSettings","type":"address"}],"name":"GovernedProductionModeEntered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"RandomAcquisitionStarted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint32","name":"startVotingRoundId","type":"uint32"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"RewardEpochStarted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"bytes32","name":"rewardsHash","type":"bytes32"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"indexed":false,"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"noOfWeightBasedClaims","type":"tuple[]"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"},{"indexed":false,"internalType":"bool","name":"thresholdReached","type":"bool"}],"name":"RewardsSigned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint64","name":"blockNumber","type":"uint64"}],"name":"SettingCleanUpBlockNumberFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"SignUptimeVoteEnabled","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"},{"indexed":false,"internalType":"bool","name":"thresholdReached","type":"bool"}],"name":"SigningPolicySigned","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallCanceled","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"bytes4","name":"selector","type":"bytes4"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"TimelockedGovernanceCallExecuted","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint24","name":"rewardEpochId","type":"uint24"}],"name":"TriggeringVoterRegistrationFailed","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"bytes32","name":"uptimeVoteHash","type":"bytes32"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"},{"indexed":false,"internalType":"bool","name":"thresholdReached","type":"bool"}],"name":"UptimeVoteSigned","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":true,"internalType":"address","name":"signingPolicyAddress","type":"address"},{"indexed":true,"internalType":"address","name":"voter","type":"address"},{"indexed":false,"internalType":"bytes20[]","name":"nodeIds","type":"bytes20[]"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"UptimeVoteSubmitted","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"uint24","name":"rewardEpochId","type":"uint24"},{"indexed":false,"internalType":"uint64","name":"votePowerBlock","type":"uint64"},{"indexed":false,"internalType":"uint64","name":"timestamp","type":"uint64"}],"name":"VotePowerBlockSelected","type":"event"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"cancelGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"cleanupBlockNumberManager","outputs":[{"internalType":"contract IICleanupBlockNumberManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"currentRewardEpochExpectedEndTs","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"daemonize","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"_selector","type":"bytes4"}],"name":"executeGovernanceCall","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"firstRewardEpochStartTs","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"firstVotingRoundStartTs","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"flareDaemon","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getAddressUpdater","outputs":[{"internalType":"address","name":"_addressUpdater","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getContractName","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"pure","type":"function"},{"inputs":[],"name":"getCurrentRewardEpoch","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentRewardEpochId","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getCurrentVotingEpochId","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getRandomAcquisitionInfo","outputs":[{"internalType":"uint64","name":"_randomAcquisitionStartTs","type":"uint64"},{"internalType":"uint64","name":"_randomAcquisitionStartBlock","type":"uint64"},{"internalType":"uint64","name":"_randomAcquisitionEndTs","type":"uint64"},{"internalType":"uint64","name":"_randomAcquisitionEndBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getRewardEpochStartInfo","outputs":[{"internalType":"uint64","name":"_rewardEpochStartTs","type":"uint64"},{"internalType":"uint64","name":"_rewardEpochStartBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getRewardEpochSwitchoverTriggerContracts","outputs":[{"internalType":"contract IIRewardEpochSwitchoverTrigger[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getRewardsSignInfo","outputs":[{"internalType":"uint64","name":"_rewardsSignStartTs","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignStartBlock","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignEndTs","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignEndBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getSeed","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getSigningPolicySignInfo","outputs":[{"internalType":"uint64","name":"_signingPolicySignStartTs","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignStartBlock","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignEndTs","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignEndBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getStartVotingRoundId","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getThreshold","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"}],"name":"getUptimeVoteSignStartInfo","outputs":[{"internalType":"uint64","name":"_uptimeVoteSignStartTs","type":"uint64"},{"internalType":"uint64","name":"_uptimeVoteSignStartBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getVotePowerBlock","outputs":[{"internalType":"uint64","name":"_votePowerBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"_rewardEpochId","type":"uint256"}],"name":"getVoterRegistrationData","outputs":[{"internalType":"uint256","name":"_votePowerBlock","type":"uint256"},{"internalType":"bool","name":"_enabled","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterRewardsSignInfo","outputs":[{"internalType":"uint64","name":"_rewardsSignTs","type":"uint64"},{"internalType":"uint64","name":"_rewardsSignBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterSigningPolicySignInfo","outputs":[{"internalType":"uint64","name":"_signingPolicySignTs","type":"uint64"},{"internalType":"uint64","name":"_signingPolicySignBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterUptimeVoteSignInfo","outputs":[{"internalType":"uint64","name":"_uptimeVoteSignTs","type":"uint64"},{"internalType":"uint64","name":"_uptimeVoteSignBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"address","name":"_voter","type":"address"}],"name":"getVoterUptimeVoteSubmitInfo","outputs":[{"internalType":"uint64","name":"_uptimeVoteSubmitTs","type":"uint64"},{"internalType":"uint64","name":"_uptimeVoteSubmitBlock","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governance","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"governanceSettings","outputs":[{"internalType":"contract IGovernanceSettings","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"initialRandomVotePowerBlockSelectionSize","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IGovernanceSettings","name":"_governanceSettings","type":"address"},{"internalType":"address","name":"_initialGovernance","type":"address"}],"name":"initialise","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isExecutor","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"isVoterRegistrationEnabled","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"lastInitializedVotingRoundId","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"newSigningPolicyInitializationStartSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"newSigningPolicyMinNumberOfVotingRoundsDelay","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"},{"internalType":"uint256","name":"rewardManagerId","type":"uint256"}],"name":"noOfWeightBasedClaims","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"}],"name":"noOfWeightBasedClaimsHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"productionMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"randomAcquisitionMaxDurationBlocks","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"randomAcquisitionMaxDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"relay","outputs":[{"internalType":"contract IIRelay","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardEpochDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardEpochIdToExpireNext","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardExpiryOffsetSeconds","outputs":[{"internalType":"uint32","name":"","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"rewardManager","outputs":[{"internalType":"contract IIRewardManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"}],"name":"rewardsHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"contract IIRewardEpochSwitchoverTrigger[]","name":"_contracts","type":"address[]"}],"name":"setRewardEpochSwitchoverTriggerContracts","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"_noOfWeightBasedClaims","type":"tuple[]"},{"internalType":"bytes32","name":"_rewardsHash","type":"bytes32"}],"name":"setRewardsData","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_submit3Aligned","type":"bool"}],"name":"setSubmit3Aligned","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bool","name":"_triggerExpirationAndCleanup","type":"bool"}],"name":"setTriggerExpirationAndCleanup","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"contract IIVoterRegistrationTrigger","name":"_contract","type":"address"}],"name":"setVoterRegistrationTriggerContract","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"_noOfWeightBasedClaims","type":"tuple[]"},{"internalType":"bytes32","name":"_rewardsHash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"signNewSigningPolicy","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"components":[{"internalType":"uint256","name":"rewardManagerId","type":"uint256"},{"internalType":"uint256","name":"noOfWeightBasedClaims","type":"uint256"}],"internalType":"struct IFlareSystemsManager.NumberOfWeightBasedClaims[]","name":"_noOfWeightBasedClaims","type":"tuple[]"},{"internalType":"bytes32","name":"_rewardsHash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"signRewards","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"bytes32","name":"_uptimeVoteHash","type":"bytes32"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"signUptimeVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"signingPolicyMinNumberOfVoters","outputs":[{"internalType":"uint16","name":"","type":"uint16"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"signingPolicyThresholdPPM","outputs":[{"internalType":"uint24","name":"","type":"uint24"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"submission","outputs":[{"internalType":"contract IISubmission","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"submit3Aligned","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint24","name":"_rewardEpochId","type":"uint24"},{"internalType":"bytes20[]","name":"_nodeIds","type":"bytes20[]"},{"components":[{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"internalType":"struct IFlareSystemsManager.Signature","name":"_signature","type":"tuple"}],"name":"submitUptimeVote","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"submitUptimeVoteMinDurationBlocks","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"submitUptimeVoteMinDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"switchToFallbackMode","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"switchToProductionMode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes4","name":"selector","type":"bytes4"}],"name":"timelockedCalls","outputs":[{"internalType":"uint256","name":"allowedAfterTimestamp","type":"uint256"},{"internalType":"bytes","name":"encodedCall","type":"bytes"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"triggerExpirationAndCleanup","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes32[]","name":"_contractNameHashes","type":"bytes32[]"},{"internalType":"address[]","name":"_contractAddresses","type":"address[]"}],"name":"updateContractAddresses","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"components":[{"internalType":"uint16","name":"randomAcquisitionMaxDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"randomAcquisitionMaxDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"newSigningPolicyInitializationStartSeconds","type":"uint16"},{"internalType":"uint8","name":"newSigningPolicyMinNumberOfVotingRoundsDelay","type":"uint8"},{"internalType":"uint16","name":"voterRegistrationMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"voterRegistrationMinDurationBlocks","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationSeconds","type":"uint16"},{"internalType":"uint16","name":"submitUptimeVoteMinDurationBlocks","type":"uint16"},{"internalType":"uint24","name":"signingPolicyThresholdPPM","type":"uint24"},{"internalType":"uint16","name":"signingPolicyMinNumberOfVoters","type":"uint16"},{"internalType":"uint32","name":"rewardExpiryOffsetSeconds","type":"uint32"}],"internalType":"struct FlareSystemsManager.Settings","name":"_settings","type":"tuple"}],"name":"updateSettings","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"rewardEpochId","type":"uint256"}],"name":"uptimeVoteHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistrationMinDurationBlocks","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistrationMinDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistrationTriggerContract","outputs":[{"internalType":"contract IIVoterRegistrationTrigger","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"voterRegistry","outputs":[{"internalType":"contract IIVoterRegistry","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"votingEpochDurationSeconds","outputs":[{"internalType":"uint64","name":"","type":"uint64"}],"stateMutability":"view","type":"function"}]; // MISSING_ABI

if (!providerPrivateKey) throw new Error("PROVIDER_PRIVATE_KEY is not set in .env");
if (!coston2RpcUrl) throw new Error("COSTON2_RPC_URL is not set in .env");
if (!openWeatherApiKey) throw new Error("OPENWEATHERMAP_API_KEY is not set in .env");
if (!fdcVerifierBaseUrl) throw new Error("FDC_VERIFIER_BASE_URL is not set in .env");
if (!fdcApiKey) throw new Error("FDC_API_KEY is not set in .env");
if (!openaiApiKey) throw new Error("OPENAI_API_KEY is not set in .env");
if (!providerPublicBaseUrl) throw new Error("PROVIDER_PUBLIC_BASE_URL is not set in .env");
if (!daLayerBaseUrl) throw new Error("DA_LAYER_BASE_URL is not set in .env");
if (!fdcHubAddress) throw new Error("FDC_HUB_ADDRESS is not set in .env");
if (!userActionsAddress) throw new Error("USER_ACTIONS_ADDRESS is not set in .env");
if (!evidenceEmitterAddress) throw new Error("EVIDENCE_EMITTER_ADDRESS is not set in .env"); // Add check

// --- Coston2 Chain Definition & Wallet Client ---
const coston2: Chain = {
  id: 114,
  name: 'Coston2',
  nativeCurrency: {
    decimals: 18,
    name: 'Coston2 Flare',
    symbol: 'C2FLR',
  },
  rpcUrls: {
    default: { http: [coston2RpcUrl] }, // Use URL from .env
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

const FDC_ATTESTATION_TYPE_JSONAPI_B32 = keccak256(toHex("JsonApi")); 
const FDC_ATTESTATION_TYPE_EVM_B32 = keccak256(toHex("EVMTransaction")); 
const FDC_SOURCE_ID_WEB2_B32 = keccak256(toHex("WEB2")); 
const FDC_SOURCE_ID_COSTON2_B32 = keccak256(toHex(evmSourceNameCoston2));

// --- ABIs (Ensure UserActions ABI is updated) ---

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

// Add UserActions ABI here for use in proof submission
// TODO: Ensure this ABI is the final one from build artifacts
const USER_ACTIONS_ABI: Abi = [
    {"type":"constructor","inputs":[{"name":"_initialOwner","type":"address","internalType":"address"},{"name":"_attestationVerifierAddress","type":"address","internalType":"address"},{"name":"_evidenceEmitterAddress","type":"address","internalType":"address"}],"stateMutability":"nonpayable"},
    {"type":"function","name":"ACTION_TYPE_TRANSPORT_B32","inputs":[],"outputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"stateMutability":"view"},
    {"type":"function","name":"MIN_DISTANCE_THRESHOLD_KM","inputs":[],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"attestationVerifierAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"evidenceEmitterAddress","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"isActionVerified","inputs":[{"name":"user","type":"address","internalType":"address"},{"name":"actionType","type":"bytes32","internalType":"bytes32"},{"name":"requiredTimestamp","type":"uint256","internalType":"uint256"}],"outputs":[{"name":"","type":"bool","internalType":"bool"}],"stateMutability":"view"},
    {"type":"function","name":"lastActionTimestamp","inputs":[{"name":"","type":"address","internalType":"address"},{"name":"","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"uint256","internalType":"uint256"}],"stateMutability":"view"},
    {"type":"function","name":"owner","inputs":[],"outputs":[{"name":"","type":"address","internalType":"address"}],"stateMutability":"view"},
    {"type":"function","name":"processEvmProof","inputs":[{"name":"proofBytes","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"processJsonApiProof","inputs":[{"name":"proofBytes","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"recordVerifiedAction","inputs":[{"name":"user","type":"address","internalType":"address"},{"name":"actionType","type":"bytes32","internalType":"bytes32"},{"name":"timestamp","type":"uint256","internalType":"uint256"},{"name":"proofData","type":"bytes","internalType":"bytes"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"renounceOwnership","inputs":[],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"setAttestationVerifierAddress","inputs":[{"name":"_newVerifierAddress","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"transferOwnership","inputs":[{"name":"newOwner","type":"address","internalType":"address"}],"outputs":[],"stateMutability":"nonpayable"},
    {"type":"function","name":"validationStages","inputs":[{"name":"","type":"bytes32","internalType":"bytes32"}],"outputs":[{"name":"","type":"uint8","internalType":"enum UserActions.ValidationStage"}],"stateMutability":"view"},
    {"type":"event","name":"ActionRecorded","inputs":[{"name":"user","type":"address","indexed":true,"internalType":"address"},{"name":"actionType","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"timestamp","type":"uint256","indexed":false,"internalType":"uint256"},{"name":"proofData","type":"bytes","indexed":false,"internalType":"bytes"}],"anonymous":false},
    {"type":"event","name":"AttestationVerifierSet","inputs":[{"name":"newVerifier","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"event","name":"EvmProofProcessed","inputs":[{"name":"validationId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"userAddress","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"event","name":"JsonApiProofProcessed","inputs":[{"name":"validationId","type":"bytes32","indexed":true,"internalType":"bytes32"},{"name":"userAddress","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"event","name":"OwnershipTransferred","inputs":[{"name":"previousOwner","type":"address","indexed":true,"internalType":"address"},{"name":"newOwner","type":"address","indexed":true,"internalType":"address"}],"anonymous":false},
    {"type":"error","name":"OwnableInvalidOwner","inputs":[{"name":"owner","type":"address","internalType":"address"}]},
    {"type":"error","name":"OwnableUnauthorizedAccount","inputs":[{"name":"account","type":"address","internalType":"address"}]},
    {"type":"error","name":"ReentrancyGuardReentrantCall","inputs":[]},
    {"type":"error","name":"UserActions__ActionAlreadyRecorded","inputs":[]},
    {"type":"error","name":"UserActions__DistanceTooShort","inputs":[]},
    {"type":"error","name":"UserActions__InvalidActionType","inputs":[]},
    {"type":"error","name":"UserActions__InvalidAttestedStatus","inputs":[]},
    {"type":"error","name":"UserActions__NotAttestationVerifier","inputs":[]},
    {"type":"error","name":"UserActions__ProofAlreadyProcessed","inputs":[]},
    {"type":"error","name":"UserActions__ProofVerificationFailed","inputs":[]},
    {"type":"error","name":"UserActions__ProofsIncomplete","inputs":[]},
    {"type":"error","name":"UserActions__TimestampTooOld","inputs":[]}
] as const;

// --- Interfaces & Storage ---
interface WeatherData {
  main?: {
    temp?: number;
  };
  message?: string; // For error messages from API
}

interface VisionVerificationResult {
  activityType?: string; // e.g., "cycling", "walking", "other"
  distanceKm?: number;
  date?: string; // e.g., "YYYY-MM-DD"
  error?: string; // Error message from AI parsing
}

// --- Storage for Validation Results ---
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
    evmRoundId?: number;
    evmRequestBytes?: Hex;
    evidenceTxHash?: Hex;
    jsonApiProofTxHash?: Hex;
    evmProofTxHash?: Hex;
}

const validationStore = new Map<Hex, ValidationRecord>();

// --- Helper Functions ---

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

async function prepareFdcRequest(attestationType: Hex, sourceId: Hex, requestBody: any): Promise<Hex | null> {
    console.log(`Preparing FDC request for type ${attestationType} and source ${sourceId}`);
    // Determine the base path based on sourceId
    const sourceBasePath = (sourceId === FDC_SOURCE_ID_WEB2_B32) ? 'web2' : evmSourceNameCoston2; // Assuming non-WEB2 is EVM chain
    const attestationTypeName = (attestationType === FDC_ATTESTATION_TYPE_JSONAPI_B32) ? 'JsonApi' : 'EVMTransaction';

    const url = `${fdcVerifierBaseUrl}/verifier/${sourceBasePath}/${attestationTypeName}/prepareRequest`;
    const payload = {
        attestationType,
        sourceId,
        requestBody: JSON.stringify(requestBody) // Verifier API expects requestBody to be a string
    };
    console.log("Calling Verifier API URL:", url);
    console.log("Verifier API Payload:", JSON.stringify(payload, null, 2));

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': fdcApiKey!
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Verifier API error (${response.status}) at ${url}: ${errorText}`);
            return null;
        }
        const data = await response.json();
        if (data.status !== 'OK' || !data.abiEncodedRequest) {
            console.error("Verifier API did not return OK status or abiEncodedRequest:", data);
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
            address: fdcFeeConfigAddress!,
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
            address: flareSystemsManagerAddress!,
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
    
    console.log("Calling DA Layer URL:", url);
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
            console.error(`DA Layer API error (${response.status}) at ${url}: ${errorText}`);
            return null;
        }

        const data: DALayerProofResponse = await response.json();

        if (data.status !== 'OK' || !data.data || !data.data.merkleProof || !data.data.responseHex) {
            console.error("DA Layer API did not return OK status or expected data fields:", data);
            return null;
        }
        
        console.log(`Successfully retrieved proof data from DA Layer for round ${roundId}`);
        return data.data;

    } catch (error) {
        console.error(`Error calling DA Layer API (${url}):`, error);
        return null;
    }
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
        // Return only necessary fields, exclude sensitive FDC request bytes if needed
        const { jsonApiRequestBytes, evmRequestBytes, ...responseRecord } = record;
        return res.status(200).json(responseRecord);
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
                BigInt(visionResult.distance), // Convert distance to BigInt for uint256
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

            // 4. Prepare JsonApi FDC Request
            const jsonApiUrl = `${providerPublicBaseUrl}/api/v1/validation-result/${validationId}`;
            const jsonApiAbiSignature = '{\"components\":[{\"internalType\":\"string\",\"name\":\"status\",\"type\":\"string\"},{\"internalType\":\"address\",\"name\":\"userAddress\",\"type\":\"address\"},{\"internalType\":\"uint256\",\"name\":\"distanceKm\",\"type\":\"uint256\"},{\"internalType\":\"string\",\"name\":\"activityType\",\"type\":\"string\"},{\"internalType\":\"uint256\",\"name\":\"validationTimestamp\",\"type\":\"uint256\"},{\"internalType\":\"bytes32\",\"name\":\"validationId\",\"type\":\"bytes32\"}],\"name\":\"OffChainValidationResult\",\"type\":\"tuple\"}';
            const jsonApiRequestBody = {
                url: jsonApiUrl,
                postprocessJq: '.', // Get the whole object
                abi_signature: jsonApiAbiSignature
            };
            const jsonApiEncodedRequest = await prepareFdcRequest(FDC_ATTESTATION_TYPE_JSONAPI_B32, FDC_SOURCE_ID_WEB2_B32, jsonApiRequestBody);
            if (!jsonApiEncodedRequest) throw new Error("Failed to prepare JsonApi FDC request");

            // 5. Prepare EVMTransaction FDC Request
            const evmRequestBody = {
                transactionHash: emitTxHash,
                requiredConfirmations: 1,
                provideInput: false, // Don't need input data
                listEvents: true,    // Need events
                logIndices: []       // Get all events (up to limit)
            };
            const evmEncodedRequest = await prepareFdcRequest(FDC_ATTESTATION_TYPE_EVM_B32, FDC_SOURCE_ID_COSTON2_B32, evmRequestBody);
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
            finalRecord.evmRoundId = evmRoundId;
            finalRecord.evmRequestBytes = evmEncodedRequest;
            validationStore.set(validationId, finalRecord);
            console.log(`FDC requests submitted and record updated for ${validationId}`);

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

    if (!record.jsonApiRoundId || !record.jsonApiRequestBytes || !record.evmRoundId || !record.evmRequestBytes) {
        return res.status(400).json({ error: 'FDC request details missing in record, cannot retrieve proofs yet.' });
    }
    
    if (record.status !== 'pending_fdc') {
         return res.status(400).json({ error: `Cannot submit proofs, current status is ${record.status}` });
    }

    let jsonApiProofTxHash: Hex | null = null;
    let evmProofTxHash: Hex | null = null;

    try {
        // 1. Fetch Proofs from DA Layer
        console.log("Fetching JsonApi proof...");
        const jsonApiProofData = await getProofFromDALayer(record.jsonApiRoundId, record.jsonApiRequestBytes);
        if (!jsonApiProofData) throw new Error("Failed to retrieve JsonApi proof from DA Layer");

        console.log("Fetching EVM proof...");
        const evmProofData = await getProofFromDALayer(record.evmRoundId, record.evmRequestBytes);
        if (!evmProofData) throw new Error("Failed to retrieve EVM proof from DA Layer");

        // 2. ABI-encode Proofs for Contract Call
        // Note: The DA Layer responseHex is already the ABI-encoded Response struct. 
        // We need to combine it with the merkleProof into the Proof struct and ABI-encode *that*.
        // We currently lack the exact IJsonApi.Response/IEVMTransaction.Response types here for perfect encoding.
        // We will pass the raw components needed for UserActions.sol to decode.
        // THIS IS A SIMPLIFICATION - A robust solution would use `encodeAbiParameters` with full type definitions.
        
        // For UserActions.processJsonApiProof(bytes calldata proofBytes) -> proofBytes = abi.encode(IJsonApi.Proof)
        // Need abi.encode( (bytes32[], IJsonApi.Response) )
        // Since we don't have IJsonApi.Response type easily, we pass the raw bytes from DA Layer.
        // THIS WILL LIKELY FAIL ON-CHAIN without proper encoding. Needs refinement.
        
        // *** Placeholder Encoding - Needs Correction *** 
        // const jsonProofBytes = encodeAbiParameters(
        //     parseAbiParameters('bytes32[] merkleProof, bytes responseBytes'), 
        //     [jsonApiProofData.merkleProof, jsonApiProofData.responseHex]
        // );
         const jsonProofBytes = jsonApiProofData.responseHex; // <--- TEMP HACK: Passing only responseHex

        // const evmProofBytes = encodeAbiParameters(
        //     parseAbiParameters('bytes32[] merkleProof, bytes responseBytes'), 
        //     [evmProofData.merkleProof, evmProofData.responseHex]
        // );
         const evmProofBytes = evmProofData.responseHex; // <--- TEMP HACK: Passing only responseHex
         // ******************************************

         console.warn("Using temporary placeholder for proof encoding - likely needs correction for on-chain calls!")

        // 3. Submit Proofs On-Chain
        console.log(`Submitting JsonApi proof for ${validationId} to UserActions...`);
        jsonApiProofTxHash = await walletClient.writeContract({
            address: userActionsAddress!,
            abi: USER_ACTIONS_ABI,
            functionName: 'processJsonApiProof',
            args: [jsonProofBytes] // Pass the encoded proof
        });
        console.log(`JsonApi proof submitted, txHash: ${jsonApiProofTxHash}`);
        await walletClient.waitForTransactionReceipt({ hash: jsonApiProofTxHash });
        console.log(`JsonApi proof tx confirmed: ${jsonApiProofTxHash}`);
        record.jsonApiProofTxHash = jsonApiProofTxHash;

        console.log(`Submitting EVM proof for ${validationId} to UserActions...`);
        evmProofTxHash = await walletClient.writeContract({
            address: userActionsAddress!,
            abi: USER_ACTIONS_ABI,
            functionName: 'processEvmProof',
            args: [evmProofBytes] // Pass the encoded proof
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
        record.errorMessage = error.message || 'Unknown proof submission error';
        // Store partial tx hashes if available
        if (jsonApiProofTxHash) record.jsonApiProofTxHash = jsonApiProofTxHash;
        if (evmProofTxHash) record.evmProofTxHash = evmProofTxHash;
        validationStore.set(validationId as Hex, record);
        return res.status(500).json({ error: `Failed to submit proofs: ${error.message}` });
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
