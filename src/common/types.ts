import type { Hex, Abi, Block, TransactionReceipt, Transaction } from 'viem'

export type Call = {
  allowFailure?: boolean
  functionName: string
  target?: Hex
  abi?: Abi
  args?: (bigint | Hex | Hex[])[]
  callData?: Hex
}

export type ServiceWorkerMessage = {
  type: string
  rpc: string
  chainId: number
  data: string
  category: string
  hardFactor: string
  easyFactor: string
}

export type Tree = {
  label: string
  children: Tree[]
}

export type MessageData = {
  log?: string
  work?: string
  complete?: string
  progress?: string
  type: string
}

export type WithdrawalProofStruct = {
  accessType: Hex
  nullifier: Hex
  flatProof: [Hex, Hex, Hex, Hex, Hex, Hex, Hex, Hex]
  root: Hex
  subsetRoot: Hex
  recipient: Hex
  refund: Hex
  relayer: Hex
  fee: Hex
  deadline: Hex
  bitLength: Hex
  subsetData: Hex
}

export type TransactionAction = 'send' | 'shield' | 'unshield' | 'swap' | 'approve' | 'stake' | 'unstake'


export type TransactionData = {
  transaction: Transaction,
  receipt: TransactionReceipt,
  block: Block,
}

export type ChainTransaction = {
  chain_id: number
  hash: Hex
  action: TransactionAction
}
