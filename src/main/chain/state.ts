import type { Erc20Token } from '$common/token'
import { chainIdToChain, getPublicClient } from '$main/chain/mappings'
import {
  getContract,
  type ChainContract,
  parseAbi,
  zeroAddress,
  parseUnits,
  type Hex,
  erc20Abi,
  Block,
  BlockTag,
} from 'viem'
import { binding } from '$main/handler'
import * as sql from '$main/sql'
import type { ChainTransaction } from '$common/types'
import { ChainIds } from '$common/config'
import { handle } from '$main/ipc'

const poolAbi = parseAbi(['function getReserves() view returns((uint112,uint112,uint32))'])
const factoryAbi = parseAbi(['function getPair(address, address) view returns(address)'])

binding('state:block', async (_, respond, chainId) => {
  const chain = chainIdToChain.get(chainId)!
  const client = getPublicClient(chain)
  const cancel = client.watchBlocks({
    emitOnBegin: false,
    onBlock: respond,
  })
  const block = await client.getBlock({
    blockTag: 'latest',
  })
  return [block, cancel]
})

handle('state:transaction:wait', async (chainId: ChainIds, hash: Hex) => {
  const chain = chainIdToChain.get(chainId)!
  const client = getPublicClient(chain)
  return await client.waitForTransactionReceipt({ hash })
})

handle('state:transactions', async () => {
  return sql.query.all<ChainTransaction>('ALL_TRANSACTIONS', [])
})

handle('state:transaction:data', async (chainId, hash) => {
  const chain = chainIdToChain.get(chainId)!
  const client = getPublicClient(chain)
  let block: Block | null = null
  const [transaction, receipt] = await Promise.all([
    // if this one fails, we should fail the whole thing
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }).catch(() => null),
  ])
  if (receipt) {
    block = await client.getBlock({
      blockNumber: receipt.blockNumber,
    })
  }
  return {
    transaction,
    receipt,
    block,
  }
})

handle('state:transaction', async (chainId, hash) => {
  const chain = chainIdToChain.get(chainId)!
  const client = getPublicClient(chain)
  return client.getTransaction({ hash })
})

handle('state:balance', async (chainId, address, token) => {
  const chain = chainIdToChain.get(chainId)!
  const client = getPublicClient(chain)
  if (token.address === zeroAddress) {
    return await client.getBalance({
      address,
    })
  }
  const contract = getContract({
    abi: erc20Abi,
    address: token.address,
    client,
  })
  return await contract.read.balanceOf([address])
})

handle('state:price', async (token: Erc20Token, blockNumber: BlockTag | bigint = 'latest') => {
  const chain = chainIdToChain.get(token.chain.id)!
  const client = getPublicClient(chain)

  const wrappedNative = chain.contracts!.wrappedNative as ChainContract
  const uniswapV2Factory = chain.contracts!.uniswapV2Factory as ChainContract
  const dai = chain.contracts!.dai as ChainContract
  const decimals = token.metadata!.decimals
  const factory = getContract({
    abi: factoryAbi,
    client,
    address: uniswapV2Factory.address,
  })
  let tokenAddress = token.address
  if (tokenAddress === zeroAddress) {
    tokenAddress = wrappedNative.address
  }
  const daiAddress = dai.address
  const pair = await factory.read.getPair([tokenAddress, daiAddress])
  const pool = getContract({
    abi: poolAbi,
    address: pair,
    client,
  })
  const reserves = await pool.read
    .getReserves(
      typeof blockNumber === 'string'
        ? {
            blockTag: blockNumber,
          }
        : {
            blockNumber: BigInt(blockNumber),
          },
    )
    .catch(() => null)
  if (!reserves) {
    return null
  }
  const tokenIndex = tokenAddress.toLowerCase() < daiAddress.toLowerCase() ? 0 : 1
  const daiIndex = Number(!tokenIndex)
  const tokenReserve = BigInt(reserves[tokenIndex])
  const daiReserve = BigInt(reserves[daiIndex])
  return (daiReserve * parseUnits('1', decimals)) / tokenReserve
})

handle('state:addressInfo', async (chainId, address) => {
  const chain = chainIdToChain.get(chainId)!
  const publicClient = getPublicClient(chain)
  const [code, callChecks] = await Promise.all([
    publicClient.getCode({
      address,
    }),
    publicClient.multicall({
      allowFailure: true,
      contracts: [
        {
          address,
          abi: erc20Abi,
          functionName: 'totalSupply',
        },
        {
          address,
          abi: erc20Abi,
          functionName: 'decimals',
        },
      ],
    }),
  ])
  const isContract = code !== '0x'
  const isErc20 = callChecks.some((check) => check.status === 'success')

  return new Map([
    ['isContract', isContract],
    ['isErc20', isErc20],
  ] as const)
})
