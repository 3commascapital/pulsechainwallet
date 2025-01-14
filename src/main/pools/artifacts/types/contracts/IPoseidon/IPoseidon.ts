/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
  BaseContract,
  BigNumberish,
  BytesLike,
  FunctionFragment,
  Result,
  Interface,
  ContractRunner,
  ContractMethod,
  Listener,
} from 'ethers'
import type {
  TypedContractEvent,
  TypedDeferredTopicFilter,
  TypedEventLog,
  TypedListener,
  TypedContractMethod,
} from '../../common'

export interface IPoseidonInterface extends Interface {
  getFunction(nameOrSignature: 'poseidon(bytes32[2])' | 'poseidon(uint256[2])'): FunctionFragment

  encodeFunctionData(functionFragment: 'poseidon(bytes32[2])', values: [[BytesLike, BytesLike]]): string
  encodeFunctionData(functionFragment: 'poseidon(uint256[2])', values: [[BigNumberish, BigNumberish]]): string

  decodeFunctionResult(functionFragment: 'poseidon(bytes32[2])', data: BytesLike): Result
  decodeFunctionResult(functionFragment: 'poseidon(uint256[2])', data: BytesLike): Result
}

export interface IPoseidon extends BaseContract {
  connect(runner?: ContractRunner | null): IPoseidon
  waitForDeployment(): Promise<this>

  interface: IPoseidonInterface

  queryFilter<TCEvent extends TypedContractEvent>(
    event: TCEvent,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined,
  ): Promise<Array<TypedEventLog<TCEvent>>>
  queryFilter<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined,
  ): Promise<Array<TypedEventLog<TCEvent>>>

  on<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>
  on<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>,
  ): Promise<this>

  once<TCEvent extends TypedContractEvent>(event: TCEvent, listener: TypedListener<TCEvent>): Promise<this>
  once<TCEvent extends TypedContractEvent>(
    filter: TypedDeferredTopicFilter<TCEvent>,
    listener: TypedListener<TCEvent>,
  ): Promise<this>

  listeners<TCEvent extends TypedContractEvent>(event: TCEvent): Promise<Array<TypedListener<TCEvent>>>
  listeners(eventName?: string): Promise<Array<Listener>>
  removeAllListeners<TCEvent extends TypedContractEvent>(event?: TCEvent): Promise<this>

  'poseidon(bytes32[2])': TypedContractMethod<[arg0: [BytesLike, BytesLike]], [string], 'view'>

  'poseidon(uint256[2])': TypedContractMethod<[arg0: [BigNumberish, BigNumberish]], [bigint], 'view'>

  getFunction<T extends ContractMethod = ContractMethod>(key: string | FunctionFragment): T

  getFunction(
    nameOrSignature: 'poseidon(bytes32[2])',
  ): TypedContractMethod<[arg0: [BytesLike, BytesLike]], [string], 'view'>
  getFunction(
    nameOrSignature: 'poseidon(uint256[2])',
  ): TypedContractMethod<[arg0: [BigNumberish, BigNumberish]], [bigint], 'view'>

  filters: {}
}
