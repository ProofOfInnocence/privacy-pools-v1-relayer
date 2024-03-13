import { ChainId } from '@/types';

export const CONTRACT_NETWORKS: { [chainId in ChainId]: string } = {
  // [ChainId.MAINNET]: '',
  [ChainId.GOERLI]: '0x30221943644ffaa55f20e915a83352d0548585ca',
  [ChainId.LOCALHOST]: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
  [ChainId.SEPOLIA]: '0x8e3E4702B4ec7400ef15fba30B3e4bfdc72aBC3B',
};

export const RPC_LIST: { [chainId in ChainId]: string } = {
  // [ChainId.MAINNET]: 'https://api.mycryptoapi.com/eth',
  [ChainId.GOERLI]: 'https://ethereum-goerli.publicnode.com',
  [ChainId.LOCALHOST]: 'http://127.0.0.1:8545/',
  [ChainId.SEPOLIA]: 'https://ethereum-sepolia-rpc.publicnode.com',
};
