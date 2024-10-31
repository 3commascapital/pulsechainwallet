import { gql } from 'graphql-request'
import { native } from '$common/pools'
import type { ChainIds } from '$common/config'
import { memoizeWithTTL } from '$common/utils'
import { loopQuery, query } from '$main/indexer'
import { type Hex } from 'viem'
import type { Deposit } from '$common/indexer/gql/graphql'

export const queries = {
  STATUS: gql`
    query Status {
      _meta {
        status
      }
    }
  `,
  ALL_POOLS_UNDER_ASSET: gql`
    query AllPoolsUnderAsset($chainId: Int!, $asset: String!) {
      privacyPools(where: { chainId: $chainId, asset: $asset }, orderBy: "power", orderDirection: "asc") {
        items {
          id
          address
          denomination
          asset
          power
          poolIndex
        }
      }
    }
  `,
  DEPOSITS_FROM_COMMITMENTS: gql`
    query DepositsFromCommitments($after: String, $poolId: String!, $commitments: [String!]!) {
      privacyPools(where: { id: $poolId }) {
        items {
          id
          address
          denomination
          asset
          power
          deposits(
            limit: 1000
            after: $after
            where: { commitment_in: $commitments }
            orderBy: "leafIndex"
            orderDirection: "asc"
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            items {
              id
              logIndex
              commitment
              leaf
              leafIndex
              transactionId
              blockId
              chainId
            }
          }
        }
      }
    }
  `,
  LEAVES_UNDER_POOL: gql`
    query LeavesUnderPool($poolId: String!) {
      deposits(where: { poolId: $poolId }, orderBy: "leafIndex", orderDirection: "asc", limit: 1000) {
        items {
          leaf
        }
      }
    }
  `,
  DEPOSIT_AT: gql`
    query DepositAt($poolId: String!, $leafIndex: BigInt!) {
      deposits(where: { poolId: $poolId, leafIndex: $leafIndex }) {
        items {
          leafIndex
          pool {
            id
            address
            chainId
          }
        }
      }
    }
  `,
  WITHDRAWALS_BY_NULLIFIERS: gql`
    query WithdrawalsByNullifiers($poolId: String!, $nullifiers: [String!]!) {
      withdrawals(where: { poolId: $poolId, nullifier_in: $nullifiers }) {
        items {
          nullifier
        }
      }
    }
  `,
  WITHDRAWAL_AT: gql`
    query WithdrawalAt($poolId: String!, $nullifier: String!) {
      withdrawals(where: { poolId: $poolId, nullifier: $nullifier }) {
        items {
          nullifier
          pool {
            id
            address
            chainId
          }
          transaction {
            hash
          }
        }
      }
    }
  `,
  POOL_BY_ID: gql`
    query PoolById($poolId: String!) {
      privacyPools(where: { id: $poolId }) {
        items {
          id
          address
          chainId
          leafIndex
        }
      }
    }
  `,
}

export type QueryKey = keyof typeof queries

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
