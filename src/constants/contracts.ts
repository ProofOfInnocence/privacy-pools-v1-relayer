import { ChainId } from '@/types';

export const CONTRACT_NETWORKS: { [chainId in ChainId]: string } = {
  // [ChainId.MAINNET]: '',
  [ChainId.GOERLI]: '0x49Bf92Fa466854637aE5a4cD00E97DDEA43C0767',
  [ChainId.LOCALHOST]: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
};

export const RPC_LIST: { [chainId in ChainId]: string } = {
  // [ChainId.MAINNET]: 'https://api.mycryptoapi.com/eth',
  [ChainId.GOERLI]: 'https://ethereum-goerli.publicnode.com',
  [ChainId.LOCALHOST]: 'http://127.0.0.1:8545/',
};
