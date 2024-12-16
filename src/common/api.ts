import type {
  Block,
  BlockTag,
  GetEnsAddressReturnType,
  Hex,
  SendTransactionParameters,
  Transaction,
  TransactionReceipt,
} from 'viem'
import type { RunResult } from 'better-sqlite3'
import type { IpcMainInvokeEvent } from 'electron'
import type { Message } from '@pulsechain/msgboard'

import type { ChainIds, Config } from '$common/config'
import type { Contact, StatementParams, TransactionData } from '$common/types'
import type { ChainTransaction } from '$common/types'
import type { Erc20Token } from '$common/token'
import type { QueryKey } from '$common/indexer'
import type { Deposit, PrivacyPool, Query } from '$common/indexer/gql/graphql'
import type { UpdateableWalletMetadata } from '$common/wallets'
import type { WalletMetadata, Account } from '$common/wallets'
import type { NonceData } from '$common/wallets'
import type { PathTypes } from '$common/path'
import type { Proof } from '$common/pools'
import type { SQLQueryKeys } from './sql'
import { AddressMetadata } from './validation'

/**
 * Result interface for wallet removal operations
 * @dev Used to communicate the outcome of a wallet deletion request
 * @notice This interface ensures consistent response structure across the application
 */
export interface WalletRemoveResult {
  /**
   * Operation success status
   * @dev true if wallet was removed, false if operation failed
   */
  success: boolean

  /**
   * List of wallets remaining after removal
   * @dev Contains metadata for all wallets still in the system
   * @notice Used to update UI state after wallet removal
   */
  remainingWallets: WalletMetadata[]

  /**
   * Address of wallet that became active after removal
   * @dev null if no wallets remain or if active wallet wasn't changed
   * @notice Hex type ensures proper Ethereum address formatting
   */
  newActiveWallet: Hex | null
}

export interface API {
  'password:logout': () => boolean
  'password:login': (pass: string) => boolean
  'password:check': (pass: string) => boolean
  'password:change': (oldPass: string, newPass: string) => boolean

  'state:transaction': (chainId: ChainIds, hash: Hex) => Transaction
  'state:transactions': () => ChainTransaction[]
  'state:transaction:data': (chainId: ChainIds, hash: Hex) => TransactionData
  'state:transaction:wait': (chainId: ChainIds, hash: Hex) => TransactionReceipt
  'state:block': (chainId: ChainIds) => Block | null
  'state:price': (token: Erc20Token, blockTag: BlockTag | bigint) => bigint | null
  'state:balance': (chainId: ChainIds, address: Hex, token: Erc20Token) => bigint
  'state:addressInfo': (chainId: ChainIds, address: Hex) => AddressMetadata | null

  'indexer:start': () => void
  'indexer:stop': () => boolean
  'indexer:restart': () => void
  'indexer:query': (queryKey: QueryKey, queryParams: object) => Query
  // goes through a caching layer
  // omit the asset to use native
  'indexer:query:allPoolsUnderChainId': (chainId: ChainIds, asset?: Hex) => Query
  'indexer:query:allDepositsFromCommitments': (poolId: Hex, commitments: Hex[]) => Deposit[]

  'config:get': () => Config
  'config:set': (key: string | string[], value: unknown) => void

  'sql:run': (sql: SQLQueryKeys, ...params: StatementParams[]) => RunResult
  'sql:get': <T>(sql: SQLQueryKeys, ...params: StatementParams[]) => T | null
  'sql:all': <T>(sql: SQLQueryKeys, ...params: StatementParams[]) => T[]

  'wallet:get': (address: Hex) => WalletMetadata
  'wallet:all': () => WalletMetadata[]
  'wallet:add': (address: Hex | string, path: PathTypes) => Hex
  'wallet:update': (address: Hex, update: UpdateableWalletMetadata) => WalletMetadata | null
  'wallet:account': (address: Hex, index: number) => Account | null
  'wallet:accounts': () => Account[]
  'wallet:accountsUnder': (poolAddress: Hex) => Account[]
  'wallet:updateAddedAccounts': (walletId: Hex, added: number[]) => number[]
  'wallet:nonces': (chainId: ChainIds, address: Hex) => NonceData
  'wallet:derive': (address: Hex, path: number[]) => Hex[]
  'wallet:sendTransaction': (
    chainId: ChainIds,
    account: Account,
    input: SendTransactionParameters,
    action: string,
  ) => Hex
  'wallet:queueTransaction': (
    chainId: ChainIds,
    account: Account,
    input: Omit<SendTransactionParameters, 'maxFeePerGas' | 'maxPriorityFeePerGas' | 'nonce'>,
    action: string,
  ) => Hex
  'wallet:estimateGas': (chainId: ChainIds, input: SendTransactionParameters) => bigint
  'wallet:reveal': (pass: string, secret: Hex, index?: number) => string | false | null
  /**
   * Removes a wallet from the application
   * @param id Ethereum address of the wallet to remove (in Hex format)
   * @returns {WalletRemoveResult} Object containing operation result, remaining wallets, and new active wallet
   * @dev This is an IPC endpoint for wallet removal operations
   * @notice Will trigger UI updates through remainingWallets and newActiveWallet
   * @throws If wallet doesn't exist or cannot be removed
   */
  'wallet:remove': (id: Hex) => WalletRemoveResult

  'pool:commitmentFromAccountSignature': (account: Account, chainId: ChainIds, poolAddress: Hex) => Hex | null
  'pool:generateProofsAndCache': (
    chainId: ChainIds,
    account: Account,
    recipient: Hex,
    feePerCommitment: bigint,
    pool: PrivacyPool,
    deposits: Deposit[],
  ) => void
  'pool:secretFromAccountSignature': (account: Account, chainId: ChainIds, poolAddress: Hex) => Hex | null
  'pool:allUnderChain': (chainId: ChainIds) => PrivacyPool[]
  'pool:nullifiedCommitmentIndices': (account: Account, chainId: ChainIds, poolAddress: Hex) => bigint[]
  'ens:getEnsAddress': (chainId: ChainIds, name: string) => GetEnsAddressReturnType
  'ens:getEns': (chainId: ChainIds, address: Hex) => string | null

  'contact:all': () => Contact[]
  'contact:upsert': (contact: Contact) => void
  'contact:updateOne': (contact: Contact, name: string, note: string | null) => Contact | null
  'contact:remove': (contact: Contact) => void

  'proof:all': () => Proof[]
  'proof:allByChainId': (chainId: ChainIds) => Proof[]

  'msgboard:contents': (chainId: ChainIds) => Message[]
  'msgboard:pool:contents': (chainId: ChainIds) => {
    messages: Message[]
    pools: PrivacyPool[]
  }
}

export type Invoker<T extends keyof API> = (...args: Parameters<API[T]>) => Promise<ReturnType<API[T]>>

export type InvokerDefaultNull<T extends keyof API> = (
  ...args: Parameters<API[T]>
) => Promise<ReturnType<API[T]> | null>

export type InvokerRequireType<T extends keyof API, R = unknown> = <I extends R>(
  ...args: Parameters<API[T]>
) => Promise<I>

export type InvokerRequireTypeDefaultNull<T extends keyof API, R = unknown> = <I extends R>(
  ...args: Parameters<API[T]>
) => Promise<I | null>

export type HandlerFn<T extends keyof API> = (
  event: IpcMainInvokeEvent,
  ...params: Parameters<API[T]>
) => Promise<ReturnType<API[T]>>

export type DirectHandler<T extends keyof API> = (...params: Parameters<API[T]>) => Promise<ReturnType<API[T]>>

export const handler =
  <T extends keyof API>(fn: DirectHandler<T>) =>
  (_event: IpcMainInvokeEvent, ...params: Parameters<typeof fn>) =>
    fn(...params)
