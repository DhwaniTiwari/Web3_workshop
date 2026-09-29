import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { mainnet, sepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

// Define Monad Testnet Chain
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'] },
    public: { http: [process.env.NEXT_PUBLIC_MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || 'https://testnet.monadexplorer.com',
    },
  },
  testnet: true,
});

// Define Local Hardhat Chain
export const hardhatLocal = defineChain({
  id: 31337,
  name: 'Hardhat Localhost',
  nativeCurrency: {
    name: 'Local ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
  testnet: true,
});

export const config = createConfig({
  chains: [monadTestnet, hardhatLocal, sepolia, mainnet],
  connectors: [
    injected({ target: 'metaMask' }),
    injected(),
  ],
  transports: {
    [monadTestnet.id]: http('https://testnet-rpc.monad.xyz'),
    [hardhatLocal.id]: http('http://127.0.0.1:8545'),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
});
