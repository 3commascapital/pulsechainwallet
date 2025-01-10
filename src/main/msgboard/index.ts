import * as msgboard from '@pulsechain/msgboard'
import { getContract, toHex, type Hex } from 'viem'
import { Worker } from 'worker_threads'
import { get } from 'svelte/store'

import type { MsgboardProvider } from '$common/types'
import { query } from '$main/indexer'
import * as sql from '$main/sql'
import { chainIdToChain, getPublicClient } from '$main/chain/mappings'
import { native, type Proof, verifyWithdrawal } from '$common/pools'
import type { ChainIds } from '$common/config'
import { doWork } from '$main/msgboard/manager'
import { sqliteDate } from '$common/sql'
import { PrivacyPoolAbi } from '$common/abis/PrivacyPool'
import { emit, handle } from '$main/ipc'
import { loopWork, memoizeWithTTL, truncateHash, log } from '$common/utils'
import { proofToWithdrawalStruct } from '$main/pools'
import { config } from '$main/config'
import { transactions } from '$main/sql/transactions'
import _ from 'lodash'

/**
 * Direct type imports from msgboard module
 * @dev These type aliases are added to:
 * 1. Simplify imports throughout the application
 * 2. Provide a single point of type definition maintenance
 * 3. Allow for easier type modifications if msgboard structure changes
 * 4. Unable to compile with previous code.
 */
type Message = msgboard.Message
type Content = msgboard.Content

const board = (chainId: ChainIds) => {
  const chain = chainIdToChain.get(chainId)
  if (!chain) {
    console.error('chain not found', chainId)
    return
  }
  const provider = getPublicClient(chain)
  return new msgboard.MsgBoard(msgboard.wrap1193(provider as MsgboardProvider))
}

const updateWorkStateLog = (pool_id: Hex, leaf_index: number, reason: string) => {
  log('updating work state', truncateHash(pool_id), leaf_index, reason)
}

const workCache = new Map<string, Worker>()

const startWork = async (proof: Proof) => {
  const chainId = proof.chain_id
  const poolId = proof.pool_id
  const leafIndex = proof.leaf_index
  const b = board(chainId)!
  const chain = chainIdToChain.get(chainId)!
  const rpcUrl = chain.rpcUrls.default.http[0]
  const key = `${chainId}-${poolId}-${leafIndex}`
  const markWorking = (e: msgboard.Work) => {
    if (!workCache.has(key)) {
      return
    }
    log('working pool=%o leaf=%o block=%o nonce=%o', truncateHash(poolId), leafIndex, e.block.number, e.nonce)
    sql.query.run('MARK_PROOF_AS_WORKING', [
      {
        pool_id: poolId,
        leaf_index: leafIndex,
      },
    ])
  }
  const withdrawalStruct = await proofToWithdrawalStruct(proof)
  const exists = await nullifierExists(poolId, withdrawalStruct.nullifier)
  if (exists) {
    updateWorkStateLog(poolId, leafIndex, 'nullifier exists')
    sql.query.run('MARK_PROOF_AS_MINED', [
      {
        pool_id: poolId,
        leaf_index: leafIndex,
      },
    ])
    return
  }
  const calldata = verifyWithdrawal.encode(withdrawalStruct)
  const proc = await doWork({
    rpcUrl,
    category: poolId,
    text: calldata,
    chainId,
    progress: markWorking,
    cancel: async () => {
      workCache.delete(key)
      sql.query.run('UPDATE_WORK_STATE', [
        {
          pool_id: poolId,
          leaf_index: leafIndex,
          work_state: 'cancelled',
        },
      ])
    },
    complete: async (work: msgboard.Work) => {
      log(
        'complete hash=%o@%o nonce=%o pool=%o leaf=%o',
        truncateHash(work.hash),
        work.block.number,
        work.nonce,
        truncateHash(poolId),
        leafIndex,
      )
      await transactions.sendWork(poolId, leafIndex, async () => {
        return await b.add(work.toRLP())
      })
      workCache.delete(key)
    },
  })
  const worker = await proc.start()
  // this allows us to cancel the work if the root updates
  workCache.set(key, worker)
  updateWorkStateLog(poolId, leafIndex, 'starting work')
  sql.query.run('MARK_PROOF_WORK_START', [
    {
      pool_id: poolId,
      leaf_index: leafIndex,
      calldata,
    },
  ])
}

const resetWorkState = (pool_id: Hex, leaf_index: number, reason: string) => {
  updateWorkStateLog(pool_id, leaf_index, reason)
  sql.query.run('RESET_WORK_STATE', [
    {
      pool_id,
      leaf_index,
    },
  ])
}

const fixupFirst = async (loopState: LoopState) => {
  const proofs = sql.query.all<Proof>('PROOF_ALL_WORK_STATE_PENDING')
  const [first] = proofs
  if (!first) {
    return proofs
  }
  let changed = false
  const reset = (pool_id: Hex, leaf_index: number, reason: string) => {
    changed = true
    resetWorkState(pool_id, leaf_index, reason)
  }
  for (const proof of proofs) {
    const { work_state, leaf_index, chain_id, pool_id, message_hash, last_work_broadcast_time } = proof
    if (work_state === 'broadcasted') {
      const contents = await msgboardContents(chain_id as ChainIds)
      const poolWork = contents[pool_id] || {}
      if (poolWork) {
        const work = poolWork[message_hash!]
        if (work) {
          const work_block_number = BigInt(work.blockNumber)
          const latest = await latestBlock(chain_id as ChainIds)
          const cacheThroughBlockNumber = latest.number - 50n
          if (work_block_number < cacheThroughBlockNumber) {
            reset(pool_id, leaf_index, 'work block number too old')
          }
          const root = await getRoot(chain_id as ChainIds, pool_id)
          const {
            args: [parsedCalldata],
          } = verifyWithdrawal.decode(work.data)
          if (parsedCalldata.root !== root) {
            reset(pool_id, leaf_index, 'work root mismatch')
          }
          continue
        }
      }
      // let the work propagate through the network before claiming that it is missing
      if (+new Date(sqliteDate(last_work_broadcast_time!)) > +new Date() - 5 * 1_000) {
        continue
      }
      reset(pool_id, leaf_index, 'work missing')
    } else if (work_state === 'working') {
      // do nothing
      const { pool_id, leaf_index, last_work_activity_time } = proof
      // check that the last_work_activity_time is recent
      // if it's not recent, then we need to mark it as failed
      // if it's recent, then we need to continue
      if (!last_work_activity_time) {
        // this script got to the activity loop. mark it as if it were working
        reset(pool_id, leaf_index, 'work activity time missing')
        continue
      }
      const lastWorkActivityTime = new Date(sqliteDate(last_work_activity_time))
      const timeSinceLastWork = loopState.now.getTime() - lastWorkActivityTime.getTime()
      if (timeSinceLastWork > 30_000) {
        // if work has not been updated in 30 seconds, then restart
        // this is usually caused by the process that was working on this proof being killed
        reset(pool_id, leaf_index, 'work activity time too old')
      }
    } else {
      // do nothing
    }
  }
  return changed ? sql.query.all<Proof>('PROOF_ALL_WORK_STATE_PENDING') : proofs
}

const waitTime = {
  SHORT: 3_000,
  LONG: 30_000,
} as const

type WaitTime = (typeof waitTime)[keyof typeof waitTime]

const latestBlock = memoizeWithTTL(
  (chainId: ChainIds) => chainId,
  async (chainId: ChainIds) => {
    const chain = chainIdToChain.get(chainId)!
    const client = getPublicClient(chain)
    return client.getBlock({
      blockTag: 'latest',
    })
  },
  10_000,
)

/**
 * Retrieves message board content for a specific chain
 * @param chainId - The ID of the blockchain network
 * @returns Promise containing the message board content
 * @throws Will throw if board for chainId doesn't exist
 * @dev Uses non-null assertion as board() is expected to always return a value for valid chainIds
 */
const msgboardContents = memoizeWithTTL(
  (chainId: ChainIds) => chainId,
  async (chainId: ChainIds): Promise<Content> => {
    return board(chainId)!.content()
  },
  30_000,
)

const sortMap = <K extends string | number | bigint, V = unknown>(map: Map<K, V>) => {
  return new Map([...map.entries()].sort(([a], [b]) => (BigInt(toHex(a)) > BigInt(toHex(b)) ? 1 : -1)))
}
const serializeMap = (map: Map<unknown, unknown>) => {
  return JSON.stringify([...map.entries()].map(([k, v]) => [k, v]))
}
const logWorkState = memoizeWithTTL(
  (groupedStatus: Map<string, number[]>) => serializeMap(sortMap(groupedStatus)),
  (groupedStatus: Map<string, number[]>) => {
    log('statuses=%o', groupedStatus)
  },
  60 * 60 * 1_000,
)
const getRoot = memoizeWithTTL(
  (chainId: ChainIds, poolId: Hex) => `${chainId}-${poolId}`,
  async (chainId: ChainIds, poolId: Hex) => {
    const {
      privacyPools: {
        items: [pool],
      },
    } = await query('POOL_BY_ID', { poolId })
    const contract = getContract({
      address: pool.address as Hex,
      client: getPublicClient(chainIdToChain.get(chainId)!),
      abi: PrivacyPoolAbi,
    })
    return contract.read.getLatestRoot()
  },
  10_000,
)

type LoopState = {
  now: Date
  outstanding: number
}

const stateHandler = {
  working: async () => {
    // nothing to do while it is working
    return waitTime.SHORT
  },
  broadcasted: async (proof: Proof, state: LoopState) => {
    const { message_hash, pool_id, leaf_index, last_work_broadcast_time } = proof
    const calldata = proof.calldata as Hex
    const poolId = pool_id as Hex
    const {
      args: [parsedCalldata],
    } = verifyWithdrawal.decode(calldata)
    // check that the nullifier is not on the pool
    // check that the last_work_broadcast_time is recent
    // if it's not recent, then we need to mark it as failed
    // if it's recent, then we need to continue
    const result = await query('POOL_BY_ID', { poolId })
    const [pool] = result.privacyPools.items
    const address = pool.address as Hex
    const client = getPublicClient(chainIdToChain.get(pool.chainId as ChainIds)!)
    const contract = getContract({
      address,
      client,
      abi: PrivacyPoolAbi,
    })
    const nullified = await contract.read.nullifiers([parsedCalldata.nullifier])
    if (nullified) {
      // nullifier is on the pool, mark as failed
      sql.query.run('UPDATE_WORK_STATE', [
        {
          pool_id: poolId,
          leaf_index,
          work_state: 'mined',
        },
      ])
      updateWorkStateLog(poolId, leaf_index, 'mark as mined')
      return null
    }

    const chainId = pool.chainId as ChainIds
    const all = await msgboardContents(chainId)
    const poolWork = all[poolId]
    if (!message_hash) {
      resetWorkState(poolId, leaf_index, 'no msg hash')
      return waitTime.SHORT
    }
    // leave this resetting to the fixup first loop so
    if (!poolWork) {
      return null
    }
    const work = poolWork[message_hash]
    if (!work) {
      return null
    }
    const work_block_number = BigInt(work.blockNumber)
    const latest = await latestBlock(chainId)
    const $config = get(config)
    const blockDelay = $config.broadcastMessageCutoffBlockDelay
    const cacheThroughBlockNumber = latest.number - BigInt(blockDelay)
    if (work_block_number < cacheThroughBlockNumber) {
      resetWorkState(poolId, leaf_index, 'cached work block number too old')
      return null
    }
    state.outstanding++
    log('work is broadcasted, waiting...', truncateHash(poolId), leaf_index)
    const broadcastedAt = new Date(sqliteDate(last_work_broadcast_time!))
    const timeDelay = $config.broadcastMessageCutoffTimeDelay
    const cacheThroughTimestamp = +state.now + timeDelay
    // make this constraint more flexible to allow the user to change how quickly their funds flow
    if (+broadcastedAt > cacheThroughTimestamp) {
      return waitTime.LONG
    }
    if (state.outstanding > 1) {
      return waitTime.LONG
    }
    return null
  },
  waiting: async (proof: Proof) => {
    await startWork(proof)
    return waitTime.SHORT
  },
} as const

const nullifierExists = async (poolId: Hex, nullifier: Hex) => {
  const result = await query('WITHDRAWAL_AT', {
    poolId,
    nullifier,
  })
  return result.withdrawals.items.length > 0
}

const groupedStatusCounts = (proofs: Proof[]) => {
  return new Map(
    _(proofs)
      .groupBy('work_state')
      .entries()
      .map(([k, list]) => [k, list.map(({ leaf_index }) => leaf_index)] as const)
      .value(),
  )
}

export const ensureWorkIsBeingPerformed = async (): Promise<WaitTime> => {
  // get all the proofs that are pending
  const state = {
    now: new Date(),
    outstanding: 0,
  }
  const proofs = await fixupFirst(state)
  // check that the work is being performed on them
  const groupedStatus = groupedStatusCounts(proofs)
  logWorkState(groupedStatus)
  const anyWorking = proofs.find(({ work_state }) => work_state === 'working')
  if (anyWorking) {
    return waitTime.LONG
  }
  for (const proof of proofs) {
    const { work_state } = proof
    const shouldWait = (await stateHandler[work_state]?.(proof, state)) as null | WaitTime
    if (shouldWait) {
      return shouldWait
    }
  }
  return waitTime.SHORT
}

// let id: ReturnType<typeof setTimeout> | null = null
// let currentWork: Promise<any> | null = null

// const loop = (ms: number = 3_000) => {
//   const i = setTimeout(async () => {
//     if (i !== id) return
//     if (currentWork !== null) {
//       // if another loop started and then this loop started, then wait for the other loop to finish it's work. the id will be different so the other work will not continue
//       await currentWork
//     }
//     currentWork = ensureWorkIsBeingPerformed().catch((err) => {
//       console.log(err)
//       return 10_000
//     }).then((ms) => {
//       // if the loop is being torn down, then don't do any more work
//       if (id === null) return
//       // if another loop started, then discontinue this loop's work
//       if (i !== id) return
//       // emit the current state of the proofs
//       // this may need to be discontinued given that there could be many proofs to emit
//       emit('proof', sql.query.all('PROOF_ALL'))
//       return loop(ms)
//     })
//   }, ms)
//   currentWork = null
//   id = i
// }

const performWork = async () => {
  const waitTime = await ensureWorkIsBeingPerformed()
  // emit the current state of the proofs
  // this may need to be discontinued given that there could be many proofs to emit
  emit('proof', sql.query.all('PROOF_ALL'))
  return waitTime
}

const { loop, cancel } = loopWork(performWork)

sql.addSetupTask({
  up: () => {
    loop()
  },
  down: () => {
    cancel()
  },
})

handle('msgboard:pool:contents', async (chainId: ChainIds) => {
  const [content, poolsResponse] = await Promise.all([
    msgboardContents(chainId),
    query('ALL_POOLS_UNDER_ASSET', { chainId, asset: native }),
  ])
  const pools = poolsResponse.privacyPools.items
  const poolIds = pools.map((pool) => pool.id)
  const messages = Object.entries(content).filter(([poolId]) => poolIds.includes(poolId))
  const flattened = _(messages)
    /**
     * Processes and sorts message board entries
     * @dev Chain of operations that:
     * 1. Flattens the message map into an array using flatMap
     *    - Discards the key from [string, Record<string, Message>]
     *    - Extracts only the Message objects using Object.values
     * 2. Sorts messages by:
     *    - Block number (descending) as primary sort
     *    - Transaction hash as secondary sort
     * 3. Removes duplicate messages based on transaction hash
     *
     * @notice The negative block number (-m.blockNumber) is used to sort in descending order
     * @notice Lodash's sortBy maintains stable sort order for equal values
     */
    .flatMap(([, messages]: [string, Record<string, Message>]) => Object.values(messages))
    .sortBy([(m: Message) => -m.blockNumber, (m: Message) => m.hash])
    .uniqBy((m: Message) => {
      const {
        args: [parsedCalldata],
      } = verifyWithdrawal.decode(m.data)
      return parsedCalldata.nullifier
    })
    .reverse()
    .value()

  return {
    messages: flattened,
    pools,
  }
})
