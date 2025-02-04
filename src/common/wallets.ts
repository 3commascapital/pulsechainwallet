import type { Hex } from 'viem'

import { PathTypes } from '$common/path'

export type SeedType = 'phrase' | 'pk' | 'read-only'

export type PK = Hex

export type Phrase = string

export type PrivateWalletInfo = PK | Phrase

export type WalletMetadata = {
  id: Hex
  path_type: PathTypes
  user_order: number
  address_index: number
  type: SeedType
  name: string | null
  encrypted: Hex
}

export type InsertableWalletMetadata = Omit<WalletMetadata, 'user_order'>

export type UpdateableWalletMetadata = Pick<WalletMetadata, 'name'>

export type NonceData = {
  latest: number
  pending: number
}

export type Account = {
  address: Hex
  wallet_id: Hex
  address_index: number
  added: boolean
}

export type AccountTarget = {
  wallet_id: Hex
  index: number
}

export const defaultName = (type: SeedType, seedIndex: number, addressIndex: number) => {
  if (type === 'phrase') {
    return `Seed Phrase ${seedIndex + 1} # ${addressIndex + 1}`
  }
  // type === 'pk'
  return `Private Key ${seedIndex + 1}`
}
