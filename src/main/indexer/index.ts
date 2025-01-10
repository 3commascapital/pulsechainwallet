import * as graphqlRequest from 'graphql-request'
import { get } from 'svelte/store'
import _ from 'lodash'

import { config } from '$main/config'
import { type QueryKey, queries } from '$common/indexer'
import { fetchStatus } from '$main/indexer/store'
import type { Query, PageInfo, Deposit } from '$common/indexer/gql/graphql'
import { handle } from '$main/ipc'
import { memoizeWithTTL } from '$common/utils'
import { ChainIds } from '$common/config'
import { native } from '$common/pools'
import type { Hex } from 'viem'

let client: graphqlRequest.GraphQLClient | null = null
let id: NodeJS.Timeout | null = null

export const start = () => {
  client = new graphqlRequest.GraphQLClient(get(config).indexer.url)
  id = setInterval(() => fetchStatus(), 5_000)
}

export const stop = async () => {
  if (!client) {
    return false
  }
  client = null
  clearInterval(id!)
  id = null
  return true
}

export const restart = async () => {
  console.log('restarting indexer')
  await stop()
  start()
}

export const query = async (queryKey: QueryKey, vars?: object) => {
  // return null as unknown as T
  return await client!.request<Query>(queries[queryKey], vars)
}

type GenericPage<T> = { items: T[]; pageInfo: PageInfo }
const defaultPageInfo = () => ({ items: [], pageInfo: { hasNextPage: false, endCursor: null } })
export const loopQuery = async <T = unknown>(queryKey: QueryKey, accessKey: string, vars: object = {}) => {
  let hasNextPage = true
  const collection: T[][] = []
  let after: string | null = null
  while (hasNextPage) {
    const response = await query(queryKey, {
      ...vars,
      after,
    })
    const { items, pageInfo } = (_.get(response, accessKey) || defaultPageInfo()) as GenericPage<T>
    collection.push(items || [])
    hasNextPage = pageInfo?.hasNextPage || false
    after = pageInfo?.endCursor || null
  }
  // flatten once at the end
  return _.flatten(collection)
}

/**
 * IPC handler for starting the indexer
 * @dev Changed from direct function reference to async arrow function
 *
 * Before:
 * handle('indexer:start', start)
 *
 * After:
 * handle('indexer:start', async () => {
 *   return start()
 * })
 *
 * @notice This change ensures proper async/await handling in the IPC context
 * @notice Provides more explicit Promise resolution
 * @returns Promise from the start() function
 * @throws Propagates any errors from the start() function
 */
handle('indexer:start', async () => {
  return start()
})

handle('indexer:stop', stop)
handle('indexer:restart', restart)

handle('indexer:query', query)

export const allPoolsUnderChainId = memoizeWithTTL(
  (chainId: ChainIds) => chainId,
  async (chainId: ChainIds) => {
    return query('ALL_POOLS_UNDER_ASSET', { chainId, asset: native })
  },
  1000 * 60 * 5,
)

export const allDepositsFromCommitments = async (poolId: Hex, commitments: Hex[]) => {
  return await loopQuery<Deposit>('DEPOSITS_FROM_COMMITMENTS', 'privacyPools.items.[0].deposits', {
    poolId,
    commitments,
  })
}

handle('indexer:query:allPoolsUnderChainId', allPoolsUnderChainId)
handle('indexer:query:allDepositsFromCommitments', allDepositsFromCommitments)
