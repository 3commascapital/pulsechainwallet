import type { BigNumber } from '@ethersproject/bignumber'
import * as snarkjs from 'snarkjs'
// import brotliPromise from 'brotli-wasm?asset'
import { BigNumberish } from 'ethers'
import {
  // bytesToHex,
  // bytesToHex,
  getAddress,
  getContract,
  isAddress,
  keccak256,
  encodePacked,
  numberToHex,
  toHex,
  zeroAddress,
  type Hex,
} from 'viem'
import { AccessList, poseidon, subsetDataToBytes, toFE, MerkleTree } from '$main/pools/pools-ts'
import { WalletMetadata, type Account } from '$common/wallets'
import type { WithdrawalProofStruct } from '$common/types'
import * as safe from '$main/safe'
import { type Proof } from '$common/pools'

import withdrawFromSubsetWasm from '$main/pools/pools-ts/withdraw_from_subset.wasm?asset'
import withdrawFromSubsetZkey from '$main/pools/pools-ts/withdraw_from_subset_final.zkey?asset'
// import withdrawFromSubsetVerifier from '$main/pools/pools-ts/withdraw_from_subset_verifier.json'

import * as fs from 'fs'
import * as sql from '$main/sql'
import type { PrivacyPool, Deposit } from '$common/indexer/gql/graphql'
import { fetchLeavesUnderPool } from '$main/indexer/queries'
import { chainIdToChain, getPublicClient } from '$main/chain'
import { ChainIds } from '$common/config'
import { handle } from '$main/ipc'
import { PrivacyPoolAbi } from '$common/abis/PrivacyPool'
// import { memoizeWithTTL } from '$common/utils'
// import { query } from '$main/indexer'
import { allDepositsFromCommitments, allPoolsUnderChainId } from '$main/indexer'
import { valueToJSON } from '$main/json'
import { query } from '$main/indexer'
import _ from 'lodash'
import { poolIdFromParts, truncateHash } from '$common/utils'
import { transactions } from '$main/sql/transactions'

let zkeyBytes!: Uint8Array
let wasmBytes!: Uint8Array

// let brotli!: BrotliWasmType

// type Options = {
//   quality?: number
// };

// type BrotliWasmType = {
//   decompress(buf: Uint8Array): Uint8Array;
//   compress(buf: Uint8Array, options?: Options): Uint8Array;
// }

export const init = async () => {
  // brotli = await import(brotliPromise) as BrotliWasmType
  // console.log(brotli)
  zkeyBytes = await fs.promises.readFile(withdrawFromSubsetZkey)
  wasmBytes = await fs.promises.readFile(withdrawFromSubsetWasm)
  // const WASM_FNAME = await path.join('resources', 'pools', 'withdraw_from_subset.wasm')
  // await Command.create('ls', ['-la', resourceDir]).execute()
  // wasmBytes = await fs.readFile(WASM_FNAME, {
  //   baseDir: fs.BaseDirectory.Resource,
  // })
  // const ZKEY_FNAME = await path.join('resources', 'pools', 'withdraw_from_subset_final.zkey')
  // zkeyBytes = await fs.readFile(ZKEY_FNAME, {
  //   baseDir: fs.BaseDirectory.Resource,
  // })
  // const VERIFIER_FNAME = await path.join('resources', 'pools', 'withdraw_from_subset_verifier.json')
  // const verifierBytes = await fs.readFile(VERIFIER_FNAME, {
  //   baseDir: fs.BaseDirectory.Resource,
  // })
  // const verifier = JSON.parse(new TextDecoder().decode(verifierBytes))
  // console.log(verifier)
  // console.log('wasm=%o, zkey=%o', wasmBytes.length, zkeyBytes.length)
}

export const compress = async (bufferData: Uint8Array) => {
  return bufferData
  // await brotliPromise
  // console.log(brotli)
  // return bytesToHex(brotli.compress(bufferData))
}

// type DepositToWithdraw = {
//   path: string;
//   secret: Hex;
// }

const asInt = (accessList: AccessList) => {
  return accessList.accessType === 'allowlist' ? 1 : 0
}

export const generateAssetMetadata = (assetAddress: string, denomination: string | bigint) =>
  hashMod(['address', 'uint256'], [assetAddress, denomination])

export const hashMod = (types: string[], values: unknown[]) => {
  return toFE(BigInt(keccak256(encodePacked(types, values))))
}

export const toHexString = (number: bigint | string | Hex) => {
  return numberToHex(BigInt(number), { size: 32 })
}

type UserDefinedInputs = {
  recipient: Hex
  path: number
  refund?: bigint
  relayer?: Hex
  fee?: bigint
  deadline?: bigint
}

export const proofToWithdrawalStruct = async (proof: Proof) => {
  const poolId = proof.pool_id
  const chainId = proof.chain_id
  const allPoolsResult = await allPoolsUnderChainId(chainId)
  const userInputs = valueToJSON.parse<UserDefinedInputs>(proof.user_inputs)
  const pool = allPoolsResult.privacyPools.items.find((p) => p.id === poolId)
  if (!pool) throw new Error('pool not found')
  const leaves = await fetchLeavesUnderPool(poolId)
  const depositTree = MerkleTree.fullEmpty({
    treeLength: 0,
    zeroString: 'empty',
  })
  for (const leaf of leaves) {
    depositTree.insert(leaf)
  }
  const chain = chainIdToChain.get(chainId)!
  const poolContract = getContract({
    address: pool.address as Hex,
    abi: PrivacyPoolAbi,
    client: getPublicClient(chain),
  })
  const root = await poolContract.read.getLatestRoot()
  const inMemoryRoot = depositTree.root.toHexString() as Hex
  console.log(
    'roots id=%o length=%o\n\tcontract=%o\n\tinmemory=%o',
    truncateHash(poolId),
    leaves.length,
    truncateHash(root),
    truncateHash(inMemoryRoot),
  )
  if (root !== inMemoryRoot) {
    throw new Error('roots mismatch')
  }
  const isKnownRoot = await poolContract.read.isKnownRoot([inMemoryRoot]).catch((e) => {
    console.log('error', e)
    return false
  })
  if (!isKnownRoot) {
    throw new Error('root not known')
  }
  const blocklist = AccessList.fullEmpty({
    accessType: 'blocklist',
    subsetLength: depositTree.length,
  })
  // add block / allow list logic here when lists are implemented
  const secretHex = safe.decrypt(proof.secret) as Hex
  return await createProofCalldata(secretHex, pool.asset as Hex, pool.denomination, depositTree, blocklist, {
    ...userInputs,
    path: +proof.leaf_index,
  })
}

const createProofCalldata = async (
  secret: Hex,
  assetAddress: Hex,
  denomination: bigint,
  depositTree: MerkleTree,
  accessList: AccessList,
  userDefinedInputs: UserDefinedInputs,
) => {
  // oldestLoneDeposit.secret -> commitment
  // commitment -> proof
  // proof -> WithdrawalStruct{proof}
  const subsetBytes = subsetDataToBytes(accessList.subsetData)
  const bufferData = Uint8Array.from(subsetBytes.data)
  const subsetData = toHex(await compress(bufferData))
  const withdrawalData = {
    accessType: asInt(accessList),
    bitLength: subsetBytes.bitLength,
    subsetData,
    refund: 0n,
    relayer: zeroAddress,
    fee: 0n,
    deadline: 0n,
    ...userDefinedInputs,
  } as const
  const proof = depositTree.generateProof(withdrawalData.path)
  if (!depositTree.verifyProof(proof)) {
    throw new Error('proof verification failed')
  }
  const subsetProof = accessList.generateProof(withdrawalData.path)
  const nullifier = poseidon([secret, 1n, `${withdrawalData.path}`])
  const withdrawalKeys: (keyof typeof withdrawalData)[] = [
    'recipient',
    'refund',
    'relayer',
    'fee',
    'deadline',
    'accessType',
    'bitLength',
    'subsetData',
  ]
  const withdrawalValues = withdrawalKeys.map((k) => withdrawalData[k])
  const withdrawMetadata = hashMod(
    ['address', 'uint256', 'address', 'uint256', 'uint256', 'uint8', 'uint24', 'bytes'],
    withdrawalValues,
  )
  const assetMetadata = generateAssetMetadata(getAddress(assetAddress), BigInt(denomination))
  const input = {
    root: toHexString(depositTree.root.toBigInt()),
    subsetRoot: toHexString(accessList.root.toBigInt()),
    nullifier: toHexString((nullifier as BigNumber).toBigInt()),
    assetMetadata: assetMetadata.toHexString(),
    withdrawMetadata: withdrawMetadata.toHexString(),
    secret,
    path: withdrawalData.path,
    mainProof: proof.siblings.map((b) => toHex(b.toBigInt(), { size: 32 })),
    subsetProof: subsetProof.siblings.map((b) => toHex(b.toBigInt(), { size: 32 })),
  }
  const { proof: fullProof } = await snarkjs.groth16.fullProve(input, wasmBytes, zkeyBytes)
  const solidityInput = {
    flatProof: [
      fullProof.pi_a[0] as Hex,
      fullProof.pi_a[1] as Hex,
      fullProof.pi_b[0][1] as Hex,
      fullProof.pi_b[0][0] as Hex,
      fullProof.pi_b[1][1] as Hex,
      fullProof.pi_b[1][0] as Hex,
      fullProof.pi_c[0] as Hex,
      fullProof.pi_c[1] as Hex,
    ],
    root: input.root,
    subsetRoot: input.subsetRoot,
    nullifier: input.nullifier,
    ...withdrawalData,
  }
  const withdrawalStruct: WithdrawalProofStruct = {
    accessType: solidityInput.accessType,
    bitLength: solidityInput.bitLength,
    subsetData: solidityInput.subsetData,
    flatProof: solidityInput.flatProof.map((hex) => BigInt(hex)) as unknown as WithdrawalProofStruct['flatProof'],
    root: solidityInput.root,
    subsetRoot: solidityInput.subsetRoot,
    nullifier: solidityInput.nullifier,
    recipient: solidityInput.recipient,
    refund: solidityInput.refund,
    relayer: solidityInput.relayer,
    fee: solidityInput.fee,
    deadline: solidityInput.deadline,
  }
  return withdrawalStruct
}

export const getProofInfo = async (
  chainId: ChainIds,
  account: Account,
  recipient: Hex,
  feePerCommitment: bigint,
  pool: PrivacyPool,
  deposits: Deposit[],
) => {
  if (!account) console.log('no account')
  if (!isAddress(recipient)) console.log('no recipient')
  if (!deposits.length) console.log('no deposits')
  if (!pool) console.log('no pool')
  const poolAddress = getAddress(pool.address) as Hex
  // const poolId = pool.id as Hex
  const secret = await secretFromAccountSignature(account, chainId, poolAddress)
  if (!secret) console.log('missing secret')
  const secretHex = numberToHex(secret!.toBigInt(), { size: 32 })
  const encryptedSecret = safe.encrypt(secretHex)
  return {
    chainId,
    pool,
    deposits,
    secret: encryptedSecret,
    shared: {
      recipient,
      fee: feePerCommitment,
    } as UserDefinedInputs,
  } as const
  // return deposits.map((deposit) => {
  // })
  // const leaves = await fetchLeavesUnderPool(poolId)
  // const depositTree = MerkleTree.fullEmpty({
  //   treeLength: 0,
  //   zeroString: 'empty',
  // })
  // for (const leaf of leaves) {
  //   depositTree.insert(leaf)
  // }
  // const chain = chainIdToChain.get(chainId)!
  // const poolContract = getContract({
  //   address: poolAddress,
  //   abi: PrivacyPoolAbi,
  //   client: getPublicClient(chain),
  // })
  // const root = await poolContract.read.getLatestRoot()
  // const inMemoryRoot = depositTree.root.toHexString()
  // console.log('roots id=%o length=%o onchain=%o, local=%o', poolId, leaves.length, root, inMemoryRoot)
  // if (root !== inMemoryRoot) {
  //   throw new Error('roots mismatch')
  // }
  // const blocklist = AccessList.fullEmpty({
  //   accessType: 'blocklist',
  //   subsetLength: depositTree.length,
  // })
  // const insertable = deposits.map((deposit) => {
  // const calldata = await createProof(secretHex, pool.asset as Hex, pool.denomination, depositTree, blocklist, {
  //   ...shared,
  //   path: +deposit.leafIndex,
  // })
  //   return {
  //     pool,
  //     deposit,
  //     secret: secretHex,
  //   }
  // })
  // const shared = {
  //   recipient,
  //   fee: feePerCommitment,
  // } as const
  // const proofs = sql.insertProofs()(insertable)
  // const proofs = await Promise.all(deposits.map(async (deposit) => {
  //   const calldata = await createProof(secretHex, pool.asset as Hex, pool.denomination, depositTree, blocklist, {
  //     ...shared,
  //     path: +deposit.leafIndex,
  //   })
  //   return {
  //     pool,
  //     deposit,
  //     calldata,
  //     depositTree,
  //   }
  // }))
  // return proofs
}

// export const verifyWithdrawal = {
//   encode: (calldata: WithdrawalProofStruct) => encodeFunctionData({
//     abi: PrivacyPoolAbi,
//     functionName: 'verifyWithdrawal',
//     args: [calldata],
//   }),
//   decode: (data: Hex) => {
//     return decodeFunctionData({
//       abi: PrivacyPoolAbi,
//       data,
//     }) as {
//       args: [WithdrawalProofStruct]
//       functionName: 'verifyWithdrawal'
//     }
//   },
// }

export const cacheProofs = async (info: Awaited<ReturnType<typeof getProofInfo>>) => {
  const { chainId, pool, deposits, secret, shared } = info
  const serializedProofs = deposits.map(({ leafIndex }) => ({
    chain_id: chainId,
    pool_id: pool.id as Hex,
    leaf_index: +leafIndex,
    work_state: 'waiting' as const,
    secret,
    user_inputs: valueToJSON.stringify(shared),
  }))
  transactions.insertProofs(serializedProofs)
}

export const generateProofsAndCache = async (
  chainId: ChainIds,
  account: Account,
  recipient: Hex,
  feePerCommitment: bigint,
  pool: PrivacyPool,
  deposits: Deposit[],
) => {
  const proofs = await getProofInfo(chainId, account, recipient, feePerCommitment, pool, deposits)
  await cacheProofs(proofs)
}

export const secretFromAccountSignature = async (account: Account, chainId: ChainIds, poolAddress: Hex) => {
  const chain = chainIdToChain.get(chainId)!
  const wallet = sql.query.get<WalletMetadata>('WALLET_GET', [{ id: account.wallet_id }])
  if (!wallet) {
    return null
  }

  const $account = safe.deriveAccountFromSecret(wallet.path_type, safe.decrypt(wallet.encrypted), account.address_index)
  if (!$account) {
    return null
  }
  const signature = await $account.signTypedData({
    primaryType: 'ShieldInput',
    types: {
      ShieldInput: [
        {
          name: 'sender',
          type: 'address',
        },
        {
          name: 'pool',
          type: 'address',
        },
      ],
    },
    domain: {
      name: 'Shield',
      version: '1',
      verifyingContract: poolAddress,
      chainId: chain.id,
    },
    message: {
      sender: account.address,
      pool: poolAddress,
    },
  })
  const pk = keccak256(signature)
  return toFE(pk)
}

export const secretToCommitment = (secret: BigNumberish | BigNumber) => {
  const commitment = poseidon([secret])
  return numberToHex(BigInt(commitment.toString()), { size: 32 })
}

export const commitmentFromAccountSignature = async (account: Account, chainId: ChainIds, poolAddress: Hex) => {
  const secret = await secretFromAccountSignature(account, chainId, poolAddress)
  if (!secret) return null
  return secretToCommitment(secret)
}

export const nullifiedCommitmentIndices = async (account: Account, chainId: ChainIds, poolAddress: Hex) => {
  const params = [account, chainId, poolAddress] as const
  const secret = await secretFromAccountSignature(...params)
  if (!secret) return []
  const commitment = secretToCommitment(secret)
  const poolId = poolIdFromParts(chainId, poolAddress)
  const deposits = await allDepositsFromCommitments(poolId, [commitment])
  if (!deposits.length) return []
  const knownNullifiers =
    deposits
      .map(({ leafIndex }) => +leafIndex)
      ?.map((path) => {
        const nullifier = poseidon([secret, 1n, `${path}`])
        return numberToHex(BigInt(nullifier.toString()), { size: 32 })
      }) || []
  // at least 1 privacy pool was returned if there was also at least 1 deposit
  const nullified = await query('WITHDRAWALS_BY_NULLIFIERS', {
    poolId,
    nullifiers: knownNullifiers,
  })
  const registeredNullifiers = new Set(nullified.withdrawals.items.map(({ nullifier }) => nullifier as Hex))
  return _(knownNullifiers)
    .map((n, i) => (registeredNullifiers.has(n) ? `${i}` : false))
    .compact()
    .map((i) => BigInt(i))
    .value()
}

handle('pool:commitmentFromAccountSignature', commitmentFromAccountSignature)

handle('pool:secretFromAccountSignature', async (...params) => {
  const result = await secretFromAccountSignature(...params)
  if (!result) return null
  return toHex(result.toBigInt(), { size: 32 })
})

handle('pool:nullifiedCommitmentIndices', nullifiedCommitmentIndices)

handle('pool:generateProofsAndCache', generateProofsAndCache)

handle('proof:all', async () => {
  return sql.query.all<Proof>('PROOF_ALL')
})

handle('proof:allByChainId', (chainId: ChainIds) => {
  return sql.query.all('PROOF_ALL_BY_CHAIN_ID', [{ chain_id: chainId }])
})
