import { BigNumberish } from 'ethers';
import { BytesLike } from '@ethersproject/bytes';

// const MAINNET_CHAIN_ID = 1;
const GOERLI_CHAIN_ID = 5;
const LOCALHOST_CHAIN_ID = 31337;
const SEPOLIA_CHAIN_ID = 11155111;

export enum ChainId {
  // MAINNET = MAINNET_CHAIN_ID,
  GOERLI = GOERLI_CHAIN_ID,
  LOCALHOST = LOCALHOST_CHAIN_ID,
  SEPOLIA = SEPOLIA_CHAIN_ID,
}

export type ExtData = {
  recipient: string;
  relayer: string;
  fee: BigNumberish;
  extAmount: BigNumberish;
  encryptedOutput1: BytesLike;
  encryptedOutput2: BytesLike;
};

export type ArgsProof = {
  proof: BytesLike;
  root: BytesLike;
  inputNullifiers: string[];
  outputCommitments: BytesLike[];
  publicAmount: string;
  extDataHash: string;
};

export type MembershipProof = { membershipProofURI: string };

export interface Transaction {
  membershipProof: MembershipProof;
  extData: ExtData;
  args: ArgsProof;
  status: string;
  txHash?: string;
  confirmations?: number;
  failedReason?: string;
}
