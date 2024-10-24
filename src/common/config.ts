import type { Hex } from "viem"
import poolsConfig from './pools-config.json'
import { mainnet, pulsechain, pulsechainV4 } from 'viem/chains'

type ChainIds = 1 | 369 | 943

type ScopedChainConfig = {
  /** the pool power that was last focused on for this chain */
  poolPower: number
  /** the rpc urls to use for this chain. default values can be restored */
  rpcs: string[]
  /** the pool config for this chain */
  pools?: PoolConfig
}

type ContractDeployment = {
  transactionHash: Hex
  blockNumber: string;
  address: Hex;
}

type PoolConfig = {
  poseidon: ContractDeployment;
  factory: ContractDeployment;
}

type ChainPoolConfig = {
  [key in ChainIds]: PoolConfig
}

const pools = poolsConfig as unknown as ChainPoolConfig

export type Config = {
  // which wallet+account is being focused on currently
  walletCount: number | null
  walletId: Hex | null
  addressIndex: number | null
  chainId: ChainIds
  // indexer is cross chain for now
  indexer: {
    url: string
  }
  byChain: Record<number, ScopedChainConfig>
}

export const defaultConfig: Config = {
  walletCount: null,
  walletId: null,
  addressIndex: null,
  chainId: 369,
  indexer: {
    url: 'https://pulsechainwallet-indexer.up.railway.app',
  },
  byChain: {
    [mainnet.id]: {
      poolPower: 18,
      rpcs: [
        'https://rpc.pulsechain.com',
      ],
      pools: pools[mainnet.id],
    },
    [pulsechain.id]: {
      poolPower: 24,
      rpcs: [
        'https://rpc.pulsechain.com',
      ],
      pools: pools[pulsechain.id],
    },
    [pulsechainV4.id]: {
      poolPower: 15,
      rpcs: [
        'https://rpc.v4.testnet.pulsechain.com',
      ],
      pools: pools[pulsechainV4.id],
    },
  },
}
